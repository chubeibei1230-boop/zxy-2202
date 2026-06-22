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

function processAttendances(attendances) {
  if (!Array.isArray(attendances) || attendances.length === 0) return 0;
  const stmt = db.prepare('UPDATE bookings SET status = ? WHERE id = ?');
  let updated = 0;
  const statusMap = {
    present: 'attended', absent: 'no_show',
    attended: 'attended', no_show: 'no_show',
    'attended': 'attended', 'no_show': 'no_show'
  };
  for (const item of attendances) {
    const targetStatus = statusMap[item.status];
    if (targetStatus && item.booking_id) {
      try {
        const info = stmt.run(targetStatus, item.booking_id);
        if (info.changes > 0) updated++;
      } catch (e) {}
    }
  }
  return updated;
}

router.post('/', auth, requireRole('assistant', 'admin'), (req, res) => {
  const { course_id, actual_attendance, materials_prepared, exception_notes, summary,
          materials, exceptions, attendances } = req.body;

  if (!course_id) {
    return res.status(400).json({ message: '课程ID必填' });
  }

  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(course_id);
  if (!course) {
    return res.status(404).json({ message: '课程不存在' });
  }

  const finalMaterials = materials_prepared !== undefined ? materials_prepared : (materials || '');
  const finalExceptions = exception_notes !== undefined ? exception_notes : (exceptions || '');
  const finalSummary = summary || '';
  const finalAttendance = actual_attendance !== undefined ? actual_attendance : 0;

  if (attendances) processAttendances(attendances);

  const existing = db.prepare('SELECT * FROM course_summaries WHERE course_id = ?').get(course_id);
  const assistantId = req.user.role === 'admin' ? (req.body.assistant_id || req.user.id) : req.user.id;

  let summaryRow;
  if (existing) {
    if (req.user.role === 'assistant' && existing.assistant_id !== req.user.id) {
      return res.status(403).json({ message: '只能修改自己创建的结课摘要' });
    }
    db.prepare(
      `UPDATE course_summaries SET actual_attendance = ?, materials_prepared = ?, exception_notes = ?, summary = ?, assistant_id = ? WHERE id = ?`
    ).run(
      finalAttendance !== undefined ? finalAttendance : existing.actual_attendance,
      finalMaterials !== undefined ? finalMaterials : existing.materials_prepared,
      finalExceptions !== undefined ? finalExceptions : existing.exception_notes,
      finalSummary !== undefined ? finalSummary : existing.summary,
      assistantId,
      existing.id
    );
    summaryRow = db.prepare(
      'SELECT cs.*, c.title as course_title, c.instructor FROM course_summaries cs LEFT JOIN courses c ON cs.course_id = c.id WHERE cs.id = ?'
    ).get(existing.id);
  } else {
    const info = db.prepare(
      `INSERT INTO course_summaries (course_id, assistant_id, actual_attendance, materials_prepared, exception_notes, summary) 
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(course_id, assistantId, finalAttendance || 0, finalMaterials || '', finalExceptions || '', finalSummary || '');
    summaryRow = db.prepare(
      'SELECT cs.*, c.title as course_title, c.instructor FROM course_summaries cs LEFT JOIN courses c ON cs.course_id = c.id WHERE cs.id = ?'
    ).get(info.lastInsertRowid);
  }

  db.prepare("UPDATE courses SET status = 'feedback_pending' WHERE id = ? AND status IN ('ongoing', 'pending')").run(course_id);

  res.status(existing ? 200 : 201).json({ summary: summaryRow, created: !existing });
});

router.put('/:id', auth, requireRole('assistant', 'admin'), (req, res) => {
  const existing = db.prepare('SELECT * FROM course_summaries WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ message: '结课摘要不存在' });
  }

  if (req.user.role === 'assistant' && existing.assistant_id !== req.user.id) {
    return res.status(403).json({ message: '只能修改自己创建的结课摘要' });
  }

  const { actual_attendance, materials_prepared, exception_notes, summary,
          materials, exceptions, attendances } = req.body;

  const finalMaterials = materials_prepared !== undefined ? materials_prepared : (materials !== undefined ? materials : existing.materials_prepared);
  const finalExceptions = exception_notes !== undefined ? exception_notes : (exceptions !== undefined ? exceptions : existing.exception_notes);
  const finalSummary = summary !== undefined ? summary : existing.summary;
  const finalAttendance = actual_attendance !== undefined ? actual_attendance : existing.actual_attendance;

  if (attendances) processAttendances(attendances);

  db.prepare(
    `UPDATE course_summaries SET actual_attendance = ?, materials_prepared = ?, exception_notes = ?, summary = ? WHERE id = ?`
  ).run(finalAttendance, finalMaterials, finalExceptions, finalSummary, req.params.id);

  const row = db.prepare(
    'SELECT cs.*, c.title as course_title, c.instructor FROM course_summaries cs LEFT JOIN courses c ON cs.course_id = c.id WHERE cs.id = ?'
  ).get(req.params.id);

  res.json({ summary: row });
});

module.exports = router;
