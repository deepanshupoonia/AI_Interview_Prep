const jwt = require('jsonwebtoken');
const pool = require('../db');

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided, authorization denied.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id: user.id }
    next();
  } catch (err) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};

const requireAdmin = async (req, res, next) => {
  try {
    const userResult = await pool.query('SELECT id, role, status FROM users WHERE id = $1', [req.user.id]);

    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: 'User not found.' });
    }

    const user = userResult.rows[0];
    if (user.status !== 'active') {
      return res.status(403).json({ message: 'Account is inactive.' });
    }

    if (user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required.' });
    }

    req.user.role = user.role;
    next();
  } catch (err) {
    res.status(500).json({ message: 'Unable to verify admin access.' });
  }
};

module.exports = authMiddleware;
module.exports.requireAdmin = requireAdmin;
