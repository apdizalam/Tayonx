const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');

async function authenticate(req, res, next) {
  const authorization = req.get('authorization') || '';
  const [scheme, token] = authorization.split(' ');
  const secret = process.env.JWT_SECRET;

  if (!secret || secret.length < 32) {
    return res.status(503).json({ error: 'Authentication is not configured.' });
  }
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Authentication is required.' });
  }
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: 'The account service is unavailable.' });
  }

  try {
    const payload = jwt.verify(token, secret);
    if (typeof payload !== 'object' || typeof payload.sub !== 'string' || !mongoose.isValidObjectId(payload.sub)) {
      return res.status(401).json({ error: 'Session is invalid or expired.' });
    }

    const user = await User.findById(payload.sub).select('name email role country verification.status');
    if (!user) {
      return res.status(401).json({ error: 'Session is invalid or expired.' });
    }
    req.user = user;
    return next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Session is invalid or expired.' });
    }
    console.error('Authentication error:', error);
    return res.status(500).json({ error: 'Authentication could not be completed.' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to perform this action.' });
    }
    return next();
  };
}

module.exports = { authenticate, requireRole };