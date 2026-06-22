const express = require('express');
const { db } = require('../db');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, (req, res) => {
  let sql = 'SELECT cs.*, c.title as course_title, c.instructor, c.start_time, c.end_time, u.name as assistant_name ' +
    'FROM course_summaries cs ' +
    'LEFT JOIN courses c ON cs.course_id = c.id ' +
    'LEFT JOIN users u ON cs.assistant_id = u.id WHERE 1=1';
  const params = [];

  if (req.user.role === 'assistant') {
    sql += ' AND cs.assistant_id = ?';
    params.push(req.user.id);
  }
  if (req.query.course_id) {
    sql += ' AND cs.course_id = ?';
    params.push(req.query.course_id);
  }

  sql += ' ORDER BY cs.created_at DESC';
  const rows = db.prepare(sql).all(...params);
  res.json({ summaries: rows });
});

router.post('/', auth, requireRole('assistant', 'admin'), (req, res) => {
  const { course_id, actual_attendance, materials_prepared, exception_notes, summary } = req.body;

  if (!course_id) {
    return res.status(400).json({ message: '课程ID必填' });
  }

  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(course_id);
  if (!course) {
    return res.status(404).json({ message: '课程不存在' });
  }

  const existing = db.prepare('SELECT * FROM course_summaries WHERE course_id = ?').get(course_id);
  if (existing) {
    return res.status(400).json({ message: '该课程已存在结课摘要，请使用更新接口' });
  }

  const assistantId = req.user.role === 'admin' ? (req.body.assistant_id || req.user.id) : req.user.id;

  const info = db.prepare(
    `INSERT INTO course_summaries (course_id, assistant_id, actual_attendance, materials_prepared, exception_notes, summary) 
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    course_id,
    assistantId,
    actual_attendance || 0,
    materials_prepared || '',
    exception_notes || '',
    summary || ''
  );

  const row = db.prepare(
    'SELECT cs.*, c.title as course_title, c.instructor FROM course_summaries cs LEFT JOIN courses c ON cs.course_id = c.id WHERE cs.id = ?'
  ).get(info.lastInsertRowid);

  db.prepare("UPDATE courses SET status = 'completed' WHERE id = ? AND status IN ('feedback_pending', 'ongoing')").run(course_id);

  res.status(201).json({ summary: row });
});

router.put('/:id', auth, requireRole('assistant', 'admin'), (req, res) => {
  const existing = db.prepare('SELECT * FROM course_summaries WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ message: '结课摘要不存在' });
  }

  if (req.user.role === 'assistant' && existing.assistant_id !== req.user.id) {
    return res.status(403).json({ message: '只能修改自己创建的结课摘要' });
  }

  const { actual_attendance, materials_prepared, exception_notes, summary } = req.body;

  db.prepare(
    `UPDATE course_summaries SET actual_attendance = ?, materials_prepared = ?, exception_notes = ?, summary = ? WHERE id = ?`
  ).run(
    actual_attendance !== undefined ? actual_attendance : existing.actual_attendance,
    materials_prepared !== undefined ? materials_prepared : existing.materials_prepared,
    exception_notes !== undefined ? exception_notes : existing.exception_notes,
    summary !== undefined ? summary : existing.summary,
    req.params.id
  );

  const row = db.prepare(
    'SELECT cs.*, c.title as course_title, c.instructor FROM course_summaries cs LEFT JOIN courses c ON cs.course_id = c.id WHERE cs.id = ?'
  ).get(req.params.id);

  res.json({ summary: row });
});

module.exports = router;
