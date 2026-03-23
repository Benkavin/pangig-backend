const jwt = require('jsonwebtoken');

// Verify JWT token
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Admin only
function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// Contractor only
function contractorOnly(req, res, next) {
  if (req.user?.role !== 'contractor') {
    return res.status(403).json({ error: 'Contractor access required' });
  }
  next();
}

module.exports = { authMiddleware, adminOnly, contractorOnly };
