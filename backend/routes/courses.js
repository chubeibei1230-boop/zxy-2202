const express = require('express');
const { db } = require('../db');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

function parseCourse(row) {
  if (!row) return row;
  return {
    ...row,
    feedback_template: row.feedback_template ? JSON.parse(row.feedback_template) : []
  };
}

function getBookedCount(courseId) {
  return db.prepare(
    "SELECT COUNT(*) as count FROM bookings WHERE course_id = ? AND status != 'cancelled'"
  ).get(courseId).count;
}

function updateCourseStatus(courseId) {
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(courseId);
  if (!course) return;
  const booked = getBookedCount(courseId);
  if (course.status === 'bookable' && booked >= course.capacity) {
    db.prepare("UPDATE courses SET status = 'full' WHERE id = ?").run(courseId);
  } else if (course.status === 'full' && booked < course.capacity) {
    db.prepare("UPDATE courses SET status = 'bookable' WHERE id = ?").run(courseId);
  }
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

  const rows = db.prepare(sql).all(...params).map(parseCourse).map(c => ({
    ...c,
    booked_count: getBookedCount(c.id)
  }));
  res.json({ courses: rows });
});

router.get('/:id', auth, (req, res) => {
  const course = parseCourse(db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id));
  if (!course) {
    return res.status(404).json({ message: '课程不存在' });
  }
  course.booked_count = getBookedCount(course.id);
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

  db.prepare(
    `UPDATE courses SET title = ?, instructor = ?, capacity = ?, start_time = ?, end_time = ?, 
     classroom_area = ?, feedback_template = ?, status = ? WHERE id = ?`
  ).run(
    title || existing.title,
    instructor || existing.instructor,
    capacity !== undefined ? capacity : existing.capacity,
    start_time || existing.start_time,
    end_time || existing.end_time,
    classroom_area !== undefined ? classroom_area : existing.classroom_area,
    feedback_template ? JSON.stringify(feedback_template) : existing.feedback_template,
    status || existing.status,
    req.params.id
  );

  updateCourseStatus(req.params.id);
  const course = parseCourse(db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id));
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

module.exports = { router, updateCourseStatus, getBookedCount, parseCourse };
