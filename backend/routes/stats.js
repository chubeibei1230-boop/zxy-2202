const express = require('express');
const { db } = require('../db');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function parseDate(s) {
  return new Date(s.replace(' ', 'T'));
}

router.get('/dashboard', auth, (req, res) => {
  const bookingTrend = [];
  for (let i = 29; i >= 0; i--) {
    const day = daysAgo(i);
    const count = db.prepare(
      "SELECT COUNT(*) as count FROM bookings WHERE date(booked_at) = date(?)"
    ).get(day).count;
    const cancelled = db.prepare(
      "SELECT COUNT(*) as count FROM bookings WHERE date(cancelled_at) = date(?)"
    ).get(day).count;
    bookingTrend.push({ date: day, booked: count, cancelled });
  }

  const totalBookings = db.prepare("SELECT COUNT(*) as count FROM bookings WHERE status != 'cancelled'").get().count;
  const attendedBookings = db.prepare("SELECT COUNT(*) as count FROM bookings WHERE status = 'attended'").get().count;
  const noShowBookings = db.prepare("SELECT COUNT(*) as count FROM bookings WHERE status = 'no_show'").get().count;
  const attendanceRate = (attendedBookings + noShowBookings) > 0
    ? Math.round((attendedBookings / (attendedBookings + noShowBookings)) * 100)
    : 0;

  const avgRatingRow = db.prepare('SELECT AVG(rating) as avg FROM feedbacks').get();
  const avgRating = avgRatingRow.avg ? parseFloat(avgRatingRow.avg.toFixed(2)) : 0;

  const lowAttendanceCourses = [];
  const summaries = db.prepare(
    `SELECT cs.*, c.title, c.capacity, c.end_time FROM course_summaries cs 
     LEFT JOIN courses c ON cs.course_id = c.id`
  ).all();
  for (const s of summaries) {
    const booked = db.prepare(
      "SELECT COUNT(*) as count FROM bookings WHERE course_id = ? AND status != 'cancelled'"
    ).get(s.course_id).count;
    if (booked > 0 && (s.actual_attendance / booked) < 0.5) {
      lowAttendanceCourses.push({
        course_id: s.course_id,
        title: s.title,
        actual_attendance: s.actual_attendance,
        booked_count: booked,
        rate: Math.round((s.actual_attendance / booked) * 100)
      });
    }
  }

  const threeDaysAgo = daysAgo(3);
  const feedbackMissingCourses = [];
  const oldCompletedCourses = db.prepare(
    `SELECT c.* FROM courses c 
     WHERE c.status IN ('completed', 'feedback_pending') 
     AND date(c.end_time) <= date(?)`
  ).all(threeDaysAgo);
  for (const c of oldCompletedCourses) {
    const bookedStudents = db.prepare(
      "SELECT DISTINCT user_id FROM bookings WHERE course_id = ? AND status IN ('booked', 'attended', 'no_show')"
    ).all(c.id).map(b => b.user_id);
    const feedbackUsers = db.prepare(
      "SELECT DISTINCT user_id FROM feedbacks WHERE course_id = ?"
    ).all(c.id).map(f => f.user_id);
    const missing = bookedStudents.filter(id => !feedbackUsers.includes(id));
    if (missing.length > 0) {
      feedbackMissingCourses.push({
        course_id: c.id,
        title: c.title,
        booked_count: bookedStudents.length,
        feedback_count: feedbackUsers.length,
        missing_count: missing.length
      });
    }
  }

  const capacityCourses = [];
  const allCourses = db.prepare('SELECT * FROM courses ORDER BY start_time').all();
  for (const c of allCourses) {
    const booked = db.prepare(
      "SELECT COUNT(*) as count FROM bookings WHERE course_id = ? AND status != 'cancelled'"
    ).get(c.id).count;
    if (booked >= c.capacity && c.capacity > 0) {
      capacityCourses.push({
        course_id: c.id,
        title: c.title,
        capacity: c.capacity,
        booked_count: booked
      });
    }
  }

  const oneDayAgo = daysAgo(1);
  const missingSummaryCourses = db.prepare(
    `SELECT c.* FROM courses c 
     LEFT JOIN course_summaries cs ON c.id = cs.course_id 
     WHERE cs.id IS NULL 
     AND date(c.end_time) <= date(?)
     AND c.status IN ('completed', 'feedback_pending', 'ongoing')`
  ).all(oneDayAgo).map(c => ({
    course_id: c.id,
    title: c.title,
    end_time: c.end_time,
    instructor: c.instructor
  }));

  const totalCourses = db.prepare('SELECT COUNT(*) as count FROM courses').get().count;
  const totalUsers = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'student'").get().count;
  const totalFeedbacks = db.prepare('SELECT COUNT(*) as count FROM feedbacks').get().count;

  res.json({
    overview: {
      total_courses: totalCourses,
      total_students: totalUsers,
      total_bookings: totalBookings,
      total_feedbacks: totalFeedbacks,
      attendance_rate: attendanceRate,
      avg_rating: avgRating
    },
    booking_trend: bookingTrend,
    pending_items: {
      low_attendance_courses: lowAttendanceCourses,
      feedback_missing_courses: feedbackMissingCourses,
      capacity_insufficient_courses: capacityCourses.slice(0, 10),
      missing_summary_courses: missingSummaryCourses
    }
  });
});

router.get('/feedback', auth, (req, res) => {
  const ratingDistribution = [];
  for (let r = 1; r <= 5; r++) {
    const count = db.prepare('SELECT COUNT(*) as count FROM feedbacks WHERE rating = ?').get(r).count;
    ratingDistribution.push({ rating: r, count });
  }

  const courseStats = db.prepare(
    `SELECT c.id, c.title, c.instructor, 
            COUNT(DISTINCT f.id) as feedback_count,
            AVG(f.rating) as avg_rating
     FROM courses c 
     LEFT JOIN feedbacks f ON c.id = f.course_id 
     GROUP BY c.id 
     ORDER BY feedback_count DESC`
  ).all().map(r => ({
    ...r,
    avg_rating: r.avg_rating ? parseFloat(r.avg_rating.toFixed(2)) : 0
  }));

  const totalFeedbacks = db.prepare('SELECT COUNT(*) as count FROM feedbacks').get().count;
  const overallAvg = db.prepare('SELECT AVG(rating) as avg FROM feedbacks').get().avg || 0;

  res.json({
    summary: {
      total_feedbacks: totalFeedbacks,
      overall_avg_rating: parseFloat(overallAvg.toFixed(2))
    },
    rating_distribution: ratingDistribution,
    course_feedback_stats: courseStats
  });
});

router.get('/courses', auth, (req, res) => {
  const { keyword, instructor, status, start_date, end_date, min_rating, max_rating } = req.query;

  let sql = `SELECT c.*, 
    (SELECT COUNT(*) FROM bookings b WHERE b.course_id = c.id AND b.status != 'cancelled') as booked_count,
    (SELECT COUNT(*) FROM feedbacks f WHERE f.course_id = c.id) as feedback_count,
    (SELECT AVG(f.rating) FROM feedbacks f WHERE f.course_id = c.id) as avg_rating
    FROM courses c WHERE 1=1`;
  const params = [];

  if (keyword) {
    sql += ' AND (c.title LIKE ? OR c.instructor LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`);
  }
  if (instructor) {
    sql += ' AND c.instructor LIKE ?';
    params.push(`%${instructor}%`);
  }
  if (status) {
    sql += ' AND c.status = ?';
    params.push(status);
  }
  if (start_date) {
    sql += ' AND date(c.start_time) >= date(?)';
    params.push(start_date);
  }
  if (end_date) {
    sql += ' AND date(c.end_time) <= date(?)';
    params.push(end_date);
  }

  sql += ' ORDER BY c.start_time DESC';

  let courses = db.prepare(sql).all(...params).map(c => ({
    ...c,
    avg_rating: c.avg_rating ? parseFloat(c.avg_rating.toFixed(2)) : 0,
    feedback_template: c.feedback_template ? JSON.parse(c.feedback_template) : []
  }));

  if (min_rating) {
    courses = courses.filter(c => c.avg_rating >= parseFloat(min_rating));
  }
  if (max_rating) {
    courses = courses.filter(c => c.avg_rating <= parseFloat(max_rating));
  }

  res.json({ courses, total: courses.length });
});

module.exports = router;
