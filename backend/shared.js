const { db } = require('./db');

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

function parseCourse(row) {
  if (!row) return row;
  return {
    ...row,
    feedback_template: row.feedback_template ? JSON.parse(row.feedback_template) : []
  };
}

function getWaitlistStats(courseId) {
  const waiting = db.prepare("SELECT COUNT(*) as count FROM waitlists WHERE course_id = ? AND status = 'waiting'").get(courseId).count;
  const notified = db.prepare("SELECT COUNT(*) as count FROM waitlists WHERE course_id = ? AND status = 'notified'").get(courseId).count;
  const confirmed = db.prepare("SELECT COUNT(*) as count FROM waitlists WHERE course_id = ? AND status = 'confirmed'").get(courseId).count;
  const rejected = db.prepare("SELECT COUNT(*) as count FROM waitlists WHERE course_id = ? AND status = 'rejected'").get(courseId).count;
  const expired = db.prepare("SELECT COUNT(*) as count FROM waitlists WHERE course_id = ? AND status = 'expired'").get(courseId).count;
  const removed = db.prepare("SELECT COUNT(*) as count FROM waitlists WHERE course_id = ? AND status = 'removed'").get(courseId).count;
  const total = db.prepare("SELECT COUNT(*) as count FROM waitlists WHERE course_id = ? AND status IN ('waiting', 'notified')").get(courseId).count;
  return { waiting, notified, confirmed, rejected, expired, removed, total, in_fill: notified };
}

module.exports = {
  getBookedCount,
  updateCourseStatus,
  parseCourse,
  getWaitlistStats
};
