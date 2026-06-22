const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../db');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.post('/login', (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: '用户名和密码必填' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) {
    return res.status(401).json({ message: '用户名或密码错误' });
  }

  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) {
    return res.status(401).json({ message: '用户名或密码错误' });
  }

  if (role && role !== user.role) {
    return res.status(401).json({ message: `当前账号角色为「${user.role}」，请选择正确的角色登录` });
  }

  const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
  const { password: _, ...userInfo } = user;

  res.json({ token, user: userInfo });
});

router.get('/me', auth, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
