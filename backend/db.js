const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'data', 'course_booking.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'assistant', 'student')),
      name TEXT NOT NULL,
      phone TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      instructor TEXT NOT NULL,
      capacity INTEGER NOT NULL DEFAULT 30,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      classroom_area TEXT,
      feedback_template TEXT DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'bookable' CHECK(status IN ('bookable', 'full', 'pending', 'ongoing', 'feedback_pending', 'completed', 'suspended')),
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      course_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'booked' CHECK(status IN ('booked', 'cancelled', 'attended', 'no_show')),
      booked_at TEXT DEFAULT (datetime('now', 'localtime')),
      cancelled_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
      UNIQUE(user_id, course_id)
    );

    CREATE TABLE IF NOT EXISTS feedbacks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      course_id INTEGER NOT NULL,
      rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
      content TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS course_summaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL UNIQUE,
      assistant_id INTEGER NOT NULL,
      actual_attendance INTEGER DEFAULT 0,
      materials_prepared TEXT,
      exception_notes TEXT,
      summary TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
      FOREIGN KEY (assistant_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS waitlists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      course_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'waiting' CHECK(status IN ('waiting', 'notified', 'confirmed', 'rejected', 'expired', 'removed')),
      joined_at TEXT DEFAULT (datetime('now', 'localtime')),
      notified_at TEXT,
      confirmed_at TEXT,
      rejected_at TEXT,
      expires_at TEXT,
      removed_by INTEGER,
      removed_reason TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
      FOREIGN KEY (removed_by) REFERENCES users(id) ON DELETE SET NULL,
      UNIQUE(user_id, course_id)
    );

    CREATE TABLE IF NOT EXISTS waitlist_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      waitlist_id INTEGER NOT NULL,
      course_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      action_by INTEGER,
      details TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (waitlist_id) REFERENCES waitlists(id) ON DELETE CASCADE,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (action_by) REFERENCES users(id) ON DELETE SET NULL
    );
  `);
}

function seedData() {
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (userCount > 0) return;

  const insertUser = db.prepare(
    'INSERT INTO users (username, password, role, name, phone) VALUES (?, ?, ?, ?, ?)'
  );

  const hash = (pwd) => bcrypt.hashSync(pwd, 10);

  insertUser.run('admin', hash('admin123'), 'admin', '系统管理员', '13800000001');
  insertUser.run('assistant', hash('assistant123'), 'assistant', '助教小王', '13800000002');
  insertUser.run('student1', hash('student123'), 'student', '学生张三', '13800000003');
  insertUser.run('student2', hash('student123'), 'student', '学生李四', '13800000004');

  const defaultTemplate = JSON.stringify([
    { key: 'teaching', label: '教学质量', type: 'rating' },
    { key: 'environment', label: '教室环境', type: 'rating' },
    { key: 'materials', label: '课程资料', type: 'rating' },
    { key: 'comment', label: '综合评价', type: 'text' }
  ]);

  const insertCourse = db.prepare(
    `INSERT INTO courses (title, instructor, capacity, start_time, end_time, classroom_area, feedback_template, status) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const now = new Date();
  const fmt = (d) => d.toISOString().slice(0, 19).replace('T', ' ');
  const addDays = (d, days) => { const nd = new Date(d); nd.setDate(nd.getDate() + days); return nd; };
  const addHours = (d, h) => { const nd = new Date(d); nd.setHours(nd.getHours() + h); return nd; };

  const courses = [
    ['Python 编程入门', '李教授', 30, fmt(addDays(now, -10)), fmt(addHours(addDays(now, -10), 3)), 'A栋301', defaultTemplate, 'completed'],
    ['数据结构与算法', '王教授', 25, fmt(addDays(now, -5)), fmt(addHours(addDays(now, -5), 4)), 'B栋202', defaultTemplate, 'completed'],
    ['Web 前端开发', '张老师', 20, fmt(addDays(now, -1)), fmt(addHours(addDays(now, -1), 3)), 'C栋105', defaultTemplate, 'feedback_pending'],
    ['机器学习基础', '陈教授', 35, fmt(addDays(now, 2)), fmt(addHours(addDays(now, 2), 4)), 'A栋501', defaultTemplate, 'ongoing'],
    ['数据库系统原理', '刘老师', 2, fmt(addDays(now, 5)), fmt(addHours(addDays(now, 5), 3)), 'B栋303', defaultTemplate, 'bookable']
  ];

  const courseIds = [];
  for (const c of courses) {
    const info = insertCourse.run(...c);
    courseIds.push(info.lastInsertRowid);
  }

  const insertBooking = db.prepare(
    'INSERT INTO bookings (user_id, course_id, status, booked_at, cancelled_at) VALUES (?, ?, ?, ?, ?)'
  );

  const bookings = [
    [3, courseIds[0], 'attended', fmt(addDays(now, -10)), null],
    [4, courseIds[0], 'attended', fmt(addDays(now, -10)), null],
    [3, courseIds[1], 'attended', fmt(addDays(now, -5)), null],
    [4, courseIds[1], 'no_show', fmt(addDays(now, -5)), null],
    [3, courseIds[2], 'attended', fmt(addDays(now, -1)), null],
    [4, courseIds[2], 'booked', fmt(addDays(now, -1)), null],
    [3, courseIds[3], 'booked', fmt(addDays(now, -1)), null],
    [4, courseIds[4], 'booked', fmt(now), null],
    [3, courseIds[4], 'booked', fmt(now), null]
  ];

  const bookingIds = [];
  for (const b of bookings) {
    try {
      const info = insertBooking.run(...b);
      bookingIds.push(info.lastInsertRowid);
    } catch (e) {
      bookingIds.push(null);
    }
  }

  const insertFeedback = db.prepare(
    'INSERT INTO feedbacks (booking_id, user_id, course_id, rating, content) VALUES (?, ?, ?, ?, ?)'
  );

  const feedbacks = [
    [bookingIds[0], 3, courseIds[0], 5, JSON.stringify({ teaching: 5, environment: 4, materials: 5, comment: '课程非常棒，老师讲解清晰！' })],
    [bookingIds[1], 4, courseIds[0], 4, JSON.stringify({ teaching: 4, environment: 4, materials: 4, comment: '内容不错，希望有更多练习。' })],
    [bookingIds[2], 3, courseIds[1], 3, JSON.stringify({ teaching: 3, environment: 4, materials: 3, comment: '内容偏难，希望能讲得更慢一些。' })],
    [bookingIds[4], 3, courseIds[2], 5, JSON.stringify({ teaching: 5, environment: 5, materials: 4, comment: '老师非常有耐心，学到了很多实用知识！' })]
  ];

  for (const f of feedbacks) {
    insertFeedback.run(...f);
  }

  const insertSummary = db.prepare(
    `INSERT INTO course_summaries (course_id, assistant_id, actual_attendance, materials_prepared, exception_notes, summary) 
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  insertSummary.run(
    courseIds[0], 2, 28,
    'PPT课件、练习题、参考资料',
    '无',
    '本次课程参与度高，学员反馈积极，整体效果良好。大部分学员掌握了 Python 基础语法。'
  );
}

function initDB() {
  initTables();
  seedData();
  return db;
}

module.exports = { db, initDB };
