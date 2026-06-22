require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const { initDB } = require('./db');
const authRoutes = require('./routes/auth');
const { router: courseRoutes, setProcessWaitlistFill: setCourseProcessFill } = require('./routes/courses');
const bookingRoutes = require('./routes/bookings');
const { setProcessWaitlistFill: setBookingProcessFill } = bookingRoutes;
const feedbackRoutes = require('./routes/feedbacks');
const summaryRoutes = require('./routes/course-summaries');
const statsRoutes = require('./routes/stats');
const { router: waitlistRoutes, processWaitlistFill } = require('./routes/waitlists');

const app = express();
const PORT = process.env.PORT || 8161;

initDB();

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/feedbacks', feedbackRoutes);
app.use('/api/course-summaries', summaryRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/waitlists', waitlistRoutes);

setCourseProcessFill(processWaitlistFill);
setBookingProcessFill(processWaitlistFill);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: '服务器内部错误', error: err.message });
});

app.listen(PORT, () => {
  console.log(`课程预约管理系统后端服务已启动`);
  console.log(`服务地址: http://localhost:${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/api/health`);
  console.log(`----------------------------------------`);
  console.log(`示例账号:`);
  console.log(`  管理员: admin / admin123`);
  console.log(`  助教:   assistant / assistant123`);
  console.log(`  学生1:  student1 / student123`);
  console.log(`  学生2:  student2 / student123`);
});

module.exports = app;
