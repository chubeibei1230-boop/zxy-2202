const express = require('express');
const { db } = require('../db');
const { auth, requireRole } = require('../middleware/auth');
const { updateCourseStatus, getBookedCount, parseCourse, getWaitlistStats } = require('../shared');

const router = express.Router();

const WAITLIST_CONFIRM_TIMEOUT_MINUTES = 30;

function enrichWaitlist(waitlist) {
  if (!waitlist) return waitlist;
  const user = db.prepare('SELECT id, username, name, phone FROM users WHERE id = ?').get(waitlist.user_id);
  const course = db.prepare('SELECT id, title, instructor, start_time, end_time, classroom_area, capacity, status FROM courses WHERE id = ?').get(waitlist.course_id);
  
  const positionRow = db.prepare(`
    SELECT COUNT(*) as pos FROM waitlists 
    WHERE course_id = ? AND status = 'waiting' AND joined_at < ?
  `).get(waitlist.course_id, waitlist.joined_at);
  
  return {
    ...waitlist,
    user,
    course,
    position: positionRow.pos + 1
  };
}

function addWaitlistLog(waitlistId, courseId, userId, action, actionBy, details) {
  db.prepare(`
    INSERT INTO waitlist_logs (waitlist_id, course_id, user_id, action, action_by, details)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(waitlistId, courseId, userId, action, actionBy, details ? JSON.stringify(details) : null);
}

function expireOldNotificationsInternal(courseId) {
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  let expired;
  if (courseId) {
    expired = db.prepare(`
      SELECT * FROM waitlists 
      WHERE course_id = ? AND status = 'notified' AND expires_at <= ?
    `).all(courseId, now);
  } else {
    expired = db.prepare(`
      SELECT * FROM waitlists 
      WHERE status = 'notified' AND expires_at <= ?
    `).all(now);
  }
  
  const affectedCourseIds = new Set();
  for (const w of expired) {
    db.prepare("UPDATE waitlists SET status = 'expired' WHERE id = ?").run(w.id);
    addWaitlistLog(w.id, w.course_id, w.user_id, 'expired', null, { reason: '确认超时' });
    affectedCourseIds.add(w.course_id);
  }
  return { count: expired.length, affectedCourseIds: [...affectedCourseIds] };
}

function expireOldNotifications(courseId) {
  const result = expireOldNotificationsInternal(courseId);
  for (const cid of result.affectedCourseIds) {
    processWaitlistFill(cid);
  }
  return result.count;
}

function processWaitlistFill(courseId) {
  expireOldNotificationsInternal(courseId);
  
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(courseId);
  if (!course) return;
  
  let availableSlots = course.capacity - getBookedCount(courseId);
  if (availableSlots <= 0) return;
  
  const pendingNotify = db.prepare("SELECT COUNT(*) as count FROM waitlists WHERE course_id = ? AND status = 'notified'").get(courseId).count;
  availableSlots -= pendingNotify;
  if (availableSlots <= 0) return;
  
  const waiters = db.prepare(`
    SELECT * FROM waitlists 
    WHERE course_id = ? AND status = 'waiting'
    ORDER BY joined_at ASC
    LIMIT ?
  `).all(courseId, availableSlots);
  
  const now = new Date();
  const expires = new Date(now.getTime() + WAITLIST_CONFIRM_TIMEOUT_MINUTES * 60 * 1000);
  const nowStr = now.toISOString().slice(0, 19).replace('T', ' ');
  const expiresStr = expires.toISOString().slice(0, 19).replace('T', ' ');
  
  for (const w of waiters) {
    db.prepare(`
      UPDATE waitlists SET status = 'notified', notified_at = ?, expires_at = ? WHERE id = ?
    `).run(nowStr, expiresStr, w.id);
    addWaitlistLog(w.id, w.course_id, w.user_id, 'notified', null, { 
      expires_at: expiresStr,
      timeout_minutes: WAITLIST_CONFIRM_TIMEOUT_MINUTES
    });
  }
  
  return waiters.length;
}

router.get('/my', auth, requireRole('student'), (req, res) => {
  expireOldNotifications(null);

  const rows = db.prepare(`
    SELECT * FROM waitlists 
    WHERE user_id = ?
    ORDER BY joined_at DESC
  `).all(req.user.id);
  
  const result = rows.map(w => {
    const enriched = enrichWaitlist(w);
    return enriched;
  });
  
  res.json({ waitlists: result });
});

router.get('/course/:courseId', auth, (req, res) => {
  const { courseId } = req.params;
  
  if (req.user.role === 'student') {
    return res.status(403).json({ message: '权限不足' });
  }
  
  expireOldNotifications(courseId);
  
  const rows = db.prepare(`
    SELECT * FROM waitlists 
    WHERE course_id = ? AND status IN ('waiting', 'notified', 'confirmed')
    ORDER BY 
      CASE status 
        WHEN 'notified' THEN 0 
        WHEN 'waiting' THEN 1 
        WHEN 'confirmed' THEN 2 
      END,
      joined_at ASC
  `).all(courseId);
  
  const result = rows.map((w, idx) => {
    const enriched = enrichWaitlist(w);
    enriched.display_rank = w.status === 'waiting' ? 
      db.prepare("SELECT COUNT(*) as c FROM waitlists WHERE course_id = ? AND status = 'waiting' AND joined_at < ?").get(courseId, w.joined_at).c + 1 : null;
    return enriched;
  });
  
  const stats = getWaitlistStats(courseId);
  res.json({ waitlists: result, stats });
});

router.get('/course/:courseId/my-status', auth, requireRole('student'), (req, res) => {
  const { courseId } = req.params;
  expireOldNotifications(courseId);
  
  const w = db.prepare(`
    SELECT * FROM waitlists 
    WHERE course_id = ? AND user_id = ? AND status IN ('waiting', 'notified')
  `).get(courseId, req.user.id);
  
  if (!w) {
    return res.json({ waitlist: null });
  }
  
  const enriched = enrichWaitlist(w);
  res.json({ waitlist: enriched });
});

router.post('/course/:courseId/join', auth, requireRole('student'), (req, res) => {
  const { courseId } = req.params;
  const userId = req.user.id;
  
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(courseId);
  if (!course) {
    return res.status(404).json({ message: '课程不存在' });
  }
  
  if (!['bookable', 'full', 'pending'].includes(course.status)) {
    return res.status(400).json({ message: '当前课程状态不可加入候补' });
  }
  
  const existingBooking = db.prepare(
    "SELECT * FROM bookings WHERE user_id = ? AND course_id = ? AND status != 'cancelled'"
  ).get(userId, courseId);
  if (existingBooking) {
    return res.status(400).json({ message: '您已预约该课程，无需加入候补' });
  }
  
  const existingWaitlist = db.prepare(
    "SELECT * FROM waitlists WHERE user_id = ? AND course_id = ? AND status IN ('waiting', 'notified')"
  ).get(userId, courseId);
  if (existingWaitlist) {
    return res.status(400).json({ message: '您已在候补队列中' });
  }
  
  const bookedCount = getBookedCount(courseId);
  if (bookedCount < course.capacity) {
    return res.status(400).json({ message: '课程仍有名额，请直接预约' });
  }
  
  try {
    let waitlistId;
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    
    const existingFinished = db.prepare(`
      SELECT * FROM waitlists WHERE user_id = ? AND course_id = ? 
      AND status IN ('rejected', 'expired', 'removed', 'confirmed')
    `).get(userId, courseId);
    
    if (existingFinished) {
      db.prepare(`
        UPDATE waitlists SET status = 'waiting', joined_at = ?, notified_at = NULL, 
        confirmed_at = NULL, rejected_at = NULL, expires_at = NULL, removed_by = NULL, removed_reason = NULL
        WHERE id = ?
      `).run(now, existingFinished.id);
      waitlistId = existingFinished.id;
    } else {
      const info = db.prepare(`
        INSERT INTO waitlists (user_id, course_id, status, joined_at) VALUES (?, ?, 'waiting', ?)
      `).run(userId, courseId, now);
      waitlistId = info.lastInsertRowid;
    }
    
    const waitlist = enrichWaitlist(db.prepare('SELECT * FROM waitlists WHERE id = ?').get(waitlistId));
    addWaitlistLog(waitlist.id, courseId, userId, 'joined', userId, existingFinished ? { rejoin: true } : null);
    
    res.status(201).json({ waitlist });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(400).json({ message: '您已在候补队列中' });
    }
    throw err;
  }
});

router.post('/:id/leave', auth, requireRole('student'), (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  
  const waitlist = db.prepare('SELECT * FROM waitlists WHERE id = ?').get(id);
  if (!waitlist) {
    return res.status(404).json({ message: '候补记录不存在' });
  }
  if (waitlist.user_id !== userId) {
    return res.status(403).json({ message: '只能退出自己的候补' });
  }
  if (!['waiting', 'notified'].includes(waitlist.status)) {
    return res.status(400).json({ message: '当前状态无法退出候补' });
  }
  
  db.prepare("UPDATE waitlists SET status = 'removed', removed_by = ?, removed_reason = '主动退出' WHERE id = ?").run(userId, id);
  addWaitlistLog(id, waitlist.course_id, userId, 'left', userId, { reason: '主动退出' });
  
  if (waitlist.status === 'notified') {
    processWaitlistFill(waitlist.course_id);
  }
  
  res.json({ message: '已退出候补队列' });
});

router.post('/:id/confirm', auth, requireRole('student'), (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  
  expireOldNotifications(null);
  
  const waitlist = db.prepare('SELECT * FROM waitlists WHERE id = ?').get(id);
  if (!waitlist) {
    return res.status(404).json({ message: '候补记录不存在' });
  }
  if (waitlist.user_id !== userId) {
    return res.status(403).json({ message: '只能确认自己的补位' });
  }
  if (waitlist.status === 'expired') {
    processWaitlistFill(waitlist.course_id);
    return res.status(400).json({ message: '补位确认已超时，名额已顺延给下一位' });
  }
  if (waitlist.status !== 'notified') {
    return res.status(400).json({ message: '当前状态无法确认补位' });
  }
  
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(waitlist.course_id);
  const bookedCount = getBookedCount(waitlist.course_id);
  if (bookedCount >= course.capacity) {
    return res.status(400).json({ message: '名额已被占用，补位失败' });
  }
  
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  
  const tx = db.transaction(() => {
    db.prepare("UPDATE waitlists SET status = 'confirmed', confirmed_at = ? WHERE id = ?").run(now, id);
    addWaitlistLog(id, waitlist.course_id, userId, 'confirmed', userId, null);
    
    let bookingId;
    const cancelledBooking = db.prepare(
      "SELECT * FROM bookings WHERE user_id = ? AND course_id = ? AND status = 'cancelled'"
    ).get(userId, waitlist.course_id);
    
    if (cancelledBooking) {
      db.prepare(
        "UPDATE bookings SET status = 'booked', booked_at = ?, cancelled_at = NULL WHERE id = ?"
      ).run(now, cancelledBooking.id);
      bookingId = cancelledBooking.id;
    } else {
      const bookingInfo = db.prepare(`
        INSERT INTO bookings (user_id, course_id, status, booked_at) VALUES (?, ?, 'booked', ?)
      `).run(userId, waitlist.course_id, now);
      bookingId = bookingInfo.lastInsertRowid;
    }
    
    return bookingId;
  });
  
  const bookingId = tx();
  updateCourseStatus(waitlist.course_id);
  
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId);
  const courseParsed = parseCourse(db.prepare('SELECT * FROM courses WHERE id = ?').get(waitlist.course_id));
  courseParsed.booked_count = getBookedCount(waitlist.course_id);
  
  processWaitlistFill(waitlist.course_id);
  
  res.json({ 
    message: '补位成功，已转为正式预约', 
    booking,
    course: courseParsed
  });
});

router.post('/:id/reject', auth, requireRole('student'), (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  
  expireOldNotifications(null);
  
  const waitlist = db.prepare('SELECT * FROM waitlists WHERE id = ?').get(id);
  if (!waitlist) {
    return res.status(404).json({ message: '候补记录不存在' });
  }
  if (waitlist.user_id !== userId) {
    return res.status(403).json({ message: '只能拒绝自己的补位' });
  }
  if (waitlist.status !== 'notified') {
    return res.status(400).json({ message: '当前状态无法拒绝补位' });
  }
  
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

  db.prepare(`
    UPDATE waitlists SET status = 'rejected', rejected_at = ?, 
    notified_at = NULL, expires_at = NULL WHERE id = ?
  `).run(now, id);
  addWaitlistLog(id, waitlist.course_id, userId, 'rejected', userId, { reason: '拒绝本次补位，保留候补位置' });

  processWaitlistFill(waitlist.course_id);

  db.prepare(`
    UPDATE waitlists SET status = 'waiting', notified_at = NULL, expires_at = NULL WHERE id = ?
  `).run(id);

  res.json({ message: '已拒绝本次补位，已保留候补位置，名额将顺延给下一位候补' });
});

router.delete('/:id/admin-remove', auth, requireRole('admin', 'assistant'), (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  
  const waitlist = db.prepare('SELECT * FROM waitlists WHERE id = ?').get(id);
  if (!waitlist) {
    return res.status(404).json({ message: '候补记录不存在' });
  }
  
  const wasNotified = waitlist.status === 'notified';
  
  db.prepare(`
    UPDATE waitlists SET status = 'removed', removed_by = ?, removed_reason = ? WHERE id = ?
  `).run(req.user.id, reason || '管理员移除', id);
  
  addWaitlistLog(id, waitlist.course_id, waitlist.user_id, 'admin_removed', req.user.id, { reason: reason || '管理员移除' });
  
  if (wasNotified) {
    processWaitlistFill(waitlist.course_id);
  }
  
  res.json({ message: '已移除候补记录' });
});

router.get('/course/:courseId/logs', auth, requireRole('admin', 'assistant'), (req, res) => {
  const { courseId } = req.params;
  
  const rows = db.prepare(`
    SELECT wl.*, u.name as action_by_name, us.name as user_name
    FROM waitlist_logs wl
    LEFT JOIN users u ON wl.action_by = u.id
    LEFT JOIN users us ON wl.user_id = us.id
    WHERE wl.course_id = ?
    ORDER BY wl.created_at DESC
  `).all(courseId);
  
  res.json({ logs: rows });
});

router.get('/stats/summary', auth, (req, res) => {
  expireOldNotifications(null);
  const userId = req.user.id;
  const role = req.user.role;
  
  if (role === 'student') {
    const waiting = db.prepare(
      "SELECT COUNT(*) as count FROM waitlists WHERE user_id = ? AND status = 'waiting'"
    ).get(userId).count;
    const notified = db.prepare(
      "SELECT COUNT(*) as count FROM waitlists WHERE user_id = ? AND status = 'notified'"
    ).get(userId).count;
    const confirmed = db.prepare(
      "SELECT COUNT(*) as count FROM waitlists WHERE user_id = ? AND status = 'confirmed'"
    ).get(userId).count;
    
    const notifiedItems = db.prepare(`
      SELECT w.*, c.title as course_title, c.start_time, c.end_time, c.instructor
      FROM waitlists w
      LEFT JOIN courses c ON w.course_id = c.id
      WHERE w.user_id = ? AND w.status = 'notified'
      ORDER BY w.expires_at ASC
    `).all(userId);
    
    res.json({
      waiting,
      notified,
      confirmed,
      total: waiting + notified,
      pending_notifications: notifiedItems
    });
  } else {
    const totalWaiting = db.prepare(
      "SELECT COUNT(*) as count FROM waitlists WHERE status = 'waiting'"
    ).get().count;
    const totalNotified = db.prepare(
      "SELECT COUNT(*) as count FROM waitlists WHERE status = 'notified'"
    ).get().count;
    const totalConfirmed = db.prepare(
      "SELECT COUNT(*) as count FROM waitlists WHERE status = 'confirmed'"
    ).get().count;
    
    const coursesWithWaitlist = db.prepare(`
      SELECT c.id, c.title, c.status, c.capacity,
        (SELECT COUNT(*) FROM waitlists w WHERE w.course_id = c.id AND w.status = 'waiting') as waiting_count,
        (SELECT COUNT(*) FROM waitlists w WHERE w.course_id = c.id AND w.status = 'notified') as notified_count,
        (SELECT COUNT(*) FROM bookings b WHERE b.course_id = c.id AND b.status != 'cancelled') as booked_count
      FROM courses c
      WHERE c.id IN (SELECT DISTINCT course_id FROM waitlists WHERE status IN ('waiting', 'notified'))
      ORDER BY waiting_count DESC
      LIMIT 10
    `).all();
    
    res.json({
      total_waiting: totalWaiting,
      total_notified: totalNotified,
      total_confirmed: totalConfirmed,
      total_active: totalWaiting + totalNotified,
      courses_with_waitlist: coursesWithWaitlist
    });
  }
});

module.exports = { router, processWaitlistFill, getWaitlistStats, WAITLIST_CONFIRM_TIMEOUT_MINUTES };
