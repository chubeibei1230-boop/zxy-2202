const express = require('express');
const { db } = require('../db');
const { auth, requireRole } = require('../middleware/auth');
const { updateCourseStatus } = require('../shared');

let _processWaitlistFill = null;
function processWaitlistFill(courseId) {
  if (_processWaitlistFill) return _processWaitlistFill(courseId);
}

function setProcessWaitlistFill(fn) {
  _processWaitlistFill = fn;
}



const router = express.Router();

function enrichBooking(booking) {
  if (!booking) return booking;
  const course = db.prepare('SELECT id, title, instructor, start_time, end_time, classroom_area, status FROM courses WHERE id = ?').get(booking.course_id);
  const user = db.prepare('SELECT id, username, name, phone FROM users WHERE id = ?').get(booking.user_id);
  return { ...booking, course, user };
}

router.post('/', auth, requireRole('student'), (req, res) => {
  const { course_id } = req.body;
  if (!course_id) {
    return res.status(400).json({ message: '课程ID必填' });
  }

  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(course_id);
  if (!course) {
    return res.status(404).json({ message: '课程不存在' });
  }

  if (!['bookable', 'full'].includes(course.status)) {
    return res.status(400).json({ message: '当前课程状态不可预约' });
  }

  const existing = db.prepare(
    "SELECT * FROM bookings WHERE user_id = ? AND course_id = ? AND status != 'cancelled'"
  ).get(req.user.id, course_id);
  if (existing) {
    return res.status(400).json({ message: '您已预约该课程，不能重复预约' });
  }

  const bookedCount = db.prepare(
    "SELECT COUNT(*) as count FROM bookings WHERE course_id = ? AND status != 'cancelled'"
  ).get(course_id).count;

  if (bookedCount >= course.capacity) {
    return res.status(400).json({ message: '课程已满，无法预约' });
  }

  try {
    let bookingId;
    const cancelledBooking = db.prepare(
      "SELECT * FROM bookings WHERE user_id = ? AND course_id = ? AND status = 'cancelled'"
    ).get(req.user.id, course_id);
    
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    if (cancelledBooking) {
      db.prepare(
        "UPDATE bookings SET status = 'booked', booked_at = ?, cancelled_at = NULL WHERE id = ?"
      ).run(now, cancelledBooking.id);
      bookingId = cancelledBooking.id;
    } else {
      const info = db.prepare(
        "INSERT INTO bookings (user_id, course_id, status, booked_at) VALUES (?, ?, 'booked', ?)"
      ).run(req.user.id, course_id, now);
      bookingId = info.lastInsertRowid;
    }

    updateCourseStatus(course_id);
    const booking = enrichBooking(db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId));
    res.status(201).json({ booking });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(400).json({ message: '您已预约该课程' });
    }
    throw err;
  }
});

router.delete('/:id', auth, requireRole('student'), (req, res) => {
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
  if (!booking) {
    return res.status(404).json({ message: '预约不存在' });
  }
  if (booking.user_id !== req.user.id) {
    return res.status(403).json({ message: '只能取消自己的预约' });
  }
  if (booking.status === 'cancelled') {
    return res.status(400).json({ message: '该预约已取消' });
  }

  db.prepare(
    "UPDATE bookings SET status = 'cancelled', cancelled_at = datetime('now', 'localtime') WHERE id = ?"
  ).run(req.params.id);

  updateCourseStatus(booking.course_id);
  processWaitlistFill(booking.course_id);
  res.json({ message: '取消成功' });
});

router.get('/', auth, (req, res) => {
  let sql = 'SELECT * FROM bookings WHERE 1=1';
  const params = [];

  if (req.user.role === 'student') {
    sql += ' AND user_id = ?';
    params.push(req.user.id);
  } else if (req.user.role === 'assistant') {
    const { course_id } = req.query;
    if (course_id) {
      sql += ' AND course_id = ?';
      params.push(course_id);
    }
  }

  if (req.query.status) {
    sql += ' AND status = ?';
    params.push(req.query.status);
  }
  if (req.query.course_id) {
    sql += ' AND course_id = ?';
    params.push(req.query.course_id);
  }

  sql += ' ORDER BY booked_at DESC';
  const rows = db.prepare(sql).all(...params).map(enrichBooking);
  res.json({ bookings: rows });
});

router.put('/:id/confirm-attendance', auth, requireRole('student'), (req, res) => {
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
  if (!booking) {
    return res.status(404).json({ message: '预约不存在' });
  }
  if (booking.user_id !== req.user.id) {
    return res.status(403).json({ message: '只能确认自己的预约' });
  }
  if (booking.status !== 'booked') {
    return res.status(400).json({ message: '当前状态无法确认到场' });
  }

  db.prepare("UPDATE bookings SET status = 'attended' WHERE id = ?").run(req.params.id);
  const updated = enrichBooking(db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id));
  res.json({ booking: updated });
});

router.put('/:id/assistant-mark', auth, requireRole('assistant', 'admin'), (req, res) => {
  const { status } = req.body;
  if (!['attended', 'no_show'].includes(status)) {
    return res.status(400).json({ message: '状态必须是 attended 或 no_show' });
  }

  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
  if (!booking) {
    return res.status(404).json({ message: '预约不存在' });
  }

  db.prepare('UPDATE bookings SET status = ? WHERE id = ?').run(status, req.params.id);
  const updated = enrichBooking(db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id));
  res.json({ booking: updated });
});

router.post('/batch-attendance', auth, requireRole('assistant', 'admin'), (req, res) => {
  const { course_id, attendances = [] } = req.body;
  if (!course_id) {
    return res.status(400).json({ message: '课程ID必填' });
  }
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(course_id);
  if (!course) {
    return res.status(404).json({ message: '课程不存在' });
  }

  let updated = 0;
  const errors = [];
  const stmt = db.prepare('UPDATE bookings SET status = ? WHERE id = ?');
  for (const item of attendances) {
    try {
      const statusMap = { present: 'attended', absent: 'no_show', attended: 'attended', no_show: 'no_show' };
      const targetStatus = statusMap[item.status];
      if (targetStatus && item.booking_id) {
        const info = stmt.run(targetStatus, item.booking_id);
        if (info.changes > 0) updated++;
      }
    } catch (e) {
      errors.push(`booking_id=${item.booking_id}: ${e.message}`);
    }
  }

  res.json({ message: '批量更新完成', updated_count: updated, errors });
});

module.exports = router;
module.exports.setProcessWaitlistFill = setProcessWaitlistFill;
