const express = require('express');
const { db } = require('../db');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

function enrichFeedback(fb) {
  if (!fb) return fb;
  return {
    ...fb,
    content: fb.content ? JSON.parse(fb.content) : {}
  };
}

router.post('/', auth, requireRole('student'), (req, res) => {
  const { booking_id, rating, content } = req.body;

  if (!booking_id || !rating) {
    return res.status(400).json({ message: '预约ID和评分必填' });
  }
  if (rating < 1 || rating > 5) {
    return res.status(400).json({ message: '评分必须在1-5之间' });
  }

  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(booking_id);
  if (!booking) {
    return res.status(404).json({ message: '预约不存在' });
  }
  if (booking.user_id !== req.user.id) {
    return res.status(403).json({ message: '只能对自己的预约提交反馈' });
  }

  const existing = db.prepare('SELECT * FROM feedbacks WHERE booking_id = ?').get(booking_id);
  if (existing) {
    return res.status(400).json({ message: '该预约已提交反馈' });
  }

  const info = db.prepare(
    'INSERT INTO feedbacks (booking_id, user_id, course_id, rating, content) VALUES (?, ?, ?, ?, ?)'
  ).run(
    booking_id,
    req.user.id,
    booking.course_id,
    rating,
    JSON.stringify(content || {})
  );

  const fb = enrichFeedback(db.prepare('SELECT * FROM feedbacks WHERE id = ?').get(info.lastInsertRowid));
  res.status(201).json({ feedback: fb });
});

router.get('/', auth, (req, res) => {
  let sql = 'SELECT * FROM feedbacks WHERE 1=1';
  const params = [];

  if (req.user.role === 'student') {
    sql += ' AND user_id = ?';
    params.push(req.user.id);
  }
  if (req.query.course_id) {
    sql += ' AND course_id = ?';
    params.push(req.query.course_id);
  }
  if (req.query.rating) {
    sql += ' AND rating = ?';
    params.push(req.query.rating);
  }

  sql += ' ORDER BY created_at DESC';
  const rows = db.prepare(sql).all(...params).map(enrichFeedback);
  res.json({ feedbacks: rows });
});

module.exports = router;
