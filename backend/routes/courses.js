const express = require('express');
const { db } = require('../db');
const { auth, requireRole } = require('../middleware/auth');
const { parseCourse, getBookedCount, updateCourseStatus, getWaitlistStats } = require('../shared');

let _processWaitlistFill = null;
function processWaitlistFill(courseId) {
  if (_processWaitlistFill) return _processWaitlistFill(courseId);
}

const router = express.Router();

function setProcessWaitlistFill(fn) {
  _processWaitlistFill = fn;
}



router.get('/', auth, (req, res) => {
  const { status, instructor, keyword, start_date, end_date, statuses } = req.query;
  let sql = 'SELECT * FROM courses WHERE 1=1';
  const params = [];

  let statusList = statuses || status;
  if (statusList) {
    if (!Array.isArray(statusList)) {
      statusList = String(statusList).split(',').filter(Boolean);
    }
    if (statusList.length > 0) {
      const placeholders = statusList.map(() => '?').join(',');
      sql += ` AND status IN (${placeholders})`;
      params.push(...statusList);
    }
  }
  if (instructor) {
    sql += ' AND instructor LIKE ?';
    params.push(`%${instructor}%`);
  }
  if (keyword) {
    sql += ' AND (title LIKE ? OR instructor LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`);
  }
  if (start_date) {
    sql += ' AND date(start_time) >= date(?)';
    params.push(start_date);
  }
  if (end_date) {
    sql += ' AND date(end_time) <= date(?)';
    params.push(end_date);
  }
  sql += ' ORDER BY start_time DESC';

  const userId = req.user.id;
  const rows = db.prepare(sql).all(...params).map(parseCourse).map(c => {
    const bookedCount = getBookedCount(c.id);
    const waitlistStats = getWaitlistStats(c.id);
    
    let userBookingId = null;
    if (req.user.role === 'student') {
      const b = db.prepare(
        "SELECT id FROM bookings WHERE user_id = ? AND course_id = ? AND status != 'cancelled'"
      ).get(userId, c.id);
      if (b) userBookingId = b.id;
    }
    
    let userWaitlistId = null;
    let userWaitlistStatus = null;
    if (req.user.role === 'student') {
      const w = db.prepare(
        "SELECT id, status FROM waitlists WHERE user_id = ? AND course_id = ? AND status IN ('waiting', 'notified')"
      ).get(userId, c.id);
      if (w) {
        userWaitlistId = w.id;
        userWaitlistStatus = w.status;
      }
    }
    
    return {
      ...c,
      booked_count: bookedCount,
      waitlist_count: waitlistStats.total,
      waitlist_in_fill: waitlistStats.in_fill,
      user_booking_id: userBookingId,
      user_waitlist_id: userWaitlistId,
      user_waitlist_status: userWaitlistStatus
    };
  });
  res.json({ courses: rows });
});

router.get('/:id', auth, (req, res) => {
  const course = parseCourse(db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id));
  if (!course) {
    return res.status(404).json({ message: '课程不存在' });
  }
  course.booked_count = getBookedCount(course.id);
  const waitlistStats = getWaitlistStats(course.id);
  course.waitlist_count = waitlistStats.total;
  course.waitlist_waiting = waitlistStats.waiting;
  course.waitlist_in_fill = waitlistStats.in_fill;
  course.waitlist_confirmed = waitlistStats.confirmed;
  
  const userId = req.user.id;
  if (req.user.role === 'student') {
    const b = db.prepare(
      "SELECT id FROM bookings WHERE user_id = ? AND course_id = ? AND status != 'cancelled'"
    ).get(userId, course.id);
    course.user_booking_id = b ? b.id : null;
    
    const w = db.prepare(
      "SELECT id, status, joined_at FROM waitlists WHERE user_id = ? AND course_id = ? AND status IN ('waiting', 'notified')"
    ).get(userId, course.id);
    course.user_waitlist = w ? {
      id: w.id,
      status: w.status,
      joined_at: w.joined_at
    } : null;
  }
  
  const fbStats = db.prepare(`
    SELECT 
      COUNT(*) as feedback_count,
      AVG(rating) as avg_rating
    FROM feedbacks WHERE course_id = ?
  `).get(course.id);
  course.feedback_count = fbStats.feedback_count || 0;
  course.avg_rating = fbStats.avg_rating ? Math.round(fbStats.avg_rating * 10) / 10 : null;
  
  res.json({ course });
});

router.post('/', auth, requireRole('admin'), (req, res) => {
  const { title, instructor, capacity, start_time, end_time, classroom_area, feedback_template, status } = req.body;

  if (!title || !instructor || !start_time || !end_time) {
    return res.status(400).json({ message: '标题、讲师、开始时间、结束时间必填' });
  }

  const info = db.prepare(
    `INSERT INTO courses (title, instructor, capacity, start_time, end_time, classroom_area, feedback_template, status) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    title,
    instructor,
    capacity || 30,
    start_time,
    end_time,
    classroom_area || '',
    JSON.stringify(feedback_template || []),
    status || 'bookable'
  );

  const course = parseCourse(db.prepare('SELECT * FROM courses WHERE id = ?').get(info.lastInsertRowid));
  res.status(201).json({ course });
});

router.put('/:id', auth, requireRole('admin'), (req, res) => {
  const existing = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ message: '课程不存在' });
  }

  const { title, instructor, capacity, start_time, end_time, classroom_area, feedback_template, status } = req.body;

  const newCapacity = capacity !== undefined ? capacity : existing.capacity;
  const capacityIncreased = newCapacity > existing.capacity;

  db.prepare(
    `UPDATE courses SET title = ?, instructor = ?, capacity = ?, start_time = ?, end_time = ?, 
     classroom_area = ?, feedback_template = ?, status = ? WHERE id = ?`
  ).run(
    title || existing.title,
    instructor || existing.instructor,
    newCapacity,
    start_time || existing.start_time,
    end_time || existing.end_time,
    classroom_area !== undefined ? classroom_area : existing.classroom_area,
    feedback_template ? JSON.stringify(feedback_template) : existing.feedback_template,
    status || existing.status,
    req.params.id
  );

  updateCourseStatus(req.params.id);
  
  if (capacityIncreased) {
    processWaitlistFill(req.params.id);
  }
  
  const course = parseCourse(db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id));
  course.booked_count = getBookedCount(course.id);
  const waitlistStats = getWaitlistStats(course.id);
  course.waitlist_count = waitlistStats.total;
  course.waitlist_waiting = waitlistStats.waiting;
  course.waitlist_in_fill = waitlistStats.in_fill;
  
  res.json({ course });
});

router.put('/:id/status', auth, requireRole('admin'), (req, res) => {
  const { status } = req.body;
  const validStatuses = ['bookable', 'full', 'pending', 'ongoing', 'feedback_pending', 'completed', 'suspended'];
  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({ message: '无效的状态值' });
  }

  const existing = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ message: '课程不存在' });
  }

  db.prepare('UPDATE courses SET status = ? WHERE id = ?').run(status, req.params.id);
  const course = parseCourse(db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id));
  res.json({ course });
});

router.delete('/:id', auth, requireRole('admin'), (req, res) => {
  const existing = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ message: '课程不存在' });
  }

  db.prepare('DELETE FROM courses WHERE id = ?').run(req.params.id);
  res.json({ message: '删除成功' });
});

module.exports = { router, setProcessWaitlistFill };
