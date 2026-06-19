const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// Utility for email validation
const isEmailValid = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

// @route   POST /api/auth/register
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Please provide name, email, and password.' });
  }

  if (!isEmailValid(email)) {
    return res.status(400).json({ message: 'Invalid email format.' });
  }

  try {
    const userCheck = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userCheck.rows.length > 0) {
      return res.status(409).json({ message: 'Email already exists.' });
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const newUser = await pool.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email, created_at',
      [name, email, passwordHash]
    );

    const user = newUser.rows[0];
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({ token, profile: user });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error. Check that PostgreSQL is running and the database tables are created.' });
  }
});

// @route   POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Please provide email and password.' });
  }

  try {
    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const user = userResult.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    const profile = { id: user.id, name: user.name, email: user.email, created_at: user.created_at };

    res.json({ token, profile });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error. Check that PostgreSQL is running and the database tables are created.' });
  }
});

// @route   GET /api/auth/profile
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const userResult = await pool.query('SELECT id, name, email, created_at FROM users WHERE id = $1', [req.user.id]);
    if (userResult.rows.length === 0) return res.status(404).json({ message: 'User not found.' });
    const user = userResult.rows[0];

    const statsResult = await pool.query(`
      SELECT 
        COUNT(id) AS total_interviews,
        AVG(score) AS overall_avg_score
      FROM interviews
      WHERE user_id = $1
    `, [req.user.id]);
    
    const categoryStats = await pool.query(`
      SELECT type, AVG(score) as avg_score
      FROM interviews
      WHERE user_id = $1
      GROUP BY type
      ORDER BY avg_score DESC NULLS LAST
      LIMIT 1
    `, [req.user.id]);

    const total_interviews = parseInt(statsResult.rows[0].total_interviews) || 0;
    const overall_avg_score = parseFloat(statsResult.rows[0].overall_avg_score) || 0;
    const highest_category = categoryStats.rows.length > 0 ? categoryStats.rows[0].type : null;

    res.json({
      name: user.name,
      email: user.email,
      created_at: user.created_at,
      stats: {
        total_interviews,
        overall_avg_score: overall_avg_score.toFixed(2),
        highest_score_category: highest_category
      }
    });

  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error. Check that PostgreSQL is running and the database tables are created.' });
  }
});

// @route   PUT /api/auth/profile
router.put('/profile', authMiddleware, async (req, res) => {
  const { name, email, currentPassword, newPassword } = req.body;
  if (!name && !email && !newPassword) {
    return res.status(400).json({ message: 'Provide a name, email, or new password to update.' });
  }

  if (email && !isEmailValid(email)) {
    return res.status(400).json({ message: 'Invalid email format.' });
  }

  if (newPassword && newPassword.length < 6) {
    return res.status(400).json({ message: 'New password must be at least 6 characters.' });
  }

  try {
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    if (userResult.rows.length === 0) return res.status(404).json({ message: 'User not found' });

    const user = userResult.rows[0];
    const sensitiveChange = (email && email !== user.email) || Boolean(newPassword);

    if (sensitiveChange) {
      if (!currentPassword) {
        return res.status(400).json({ message: 'Current password is required to change email or password.' });
      }

      const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
      if (!isMatch) return res.status(401).json({ message: 'Current password is incorrect.' });
    }

    if (email && email !== user.email) {
      const emailCheck = await pool.query('SELECT id FROM users WHERE email = $1 AND id <> $2', [email, req.user.id]);
      if (emailCheck.rows.length > 0) {
        return res.status(409).json({ message: 'Email already exists.' });
      }
    }

    const nextName = name || user.name;
    const nextEmail = email || user.email;
    const nextPasswordHash = newPassword ? await bcrypt.hash(newPassword, 10) : user.password_hash;

    const result = await pool.query(
      'UPDATE users SET name = $1, email = $2, password_hash = $3 WHERE id = $4 RETURNING id, name, email, created_at',
      [nextName, nextEmail, nextPasswordHash, req.user.id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error. Check that PostgreSQL is running and the database tables are created.' });
  }
});

module.exports = router;
