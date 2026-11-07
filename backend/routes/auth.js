const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');

const router = express.Router();
const tokenLifetime = '1h';

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be set to at least 32 characters.');
  }
  return secret;
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

function sendAuthError(res, error) {
  if (error.message === 'JWT_SECRET must be set to at least 32 characters.') {
    return res.status(503).json({ error: 'Authentication is not configured.' });
  }
  console.error('Authentication error:', error);
  return res.status(500).json({ error: 'Authentication could not be completed.' });
}

router.post('/login', async (req, res) => {
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }
  if (email.length > 254 || Buffer.byteLength(password, 'utf8') > 72) {
    return res.status(400).json({ error: 'Invalid email or password.' });
  }
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: 'The account service is unavailable.' });
  }

  try {
    const user = await User.findOne({ email }).select('+password');
    const passwordMatches = user && await bcrypt.compare(password, user.password);

    if (!passwordMatches) {
      return res.status(401).json({ error: 'Email or password is incorrect.' });
    }

    const token = jwt.sign({ sub: user.id }, getJwtSecret(), { expiresIn: tokenLifetime });
    return res.json({ token, user: publicUser(user) });
  } catch (error) {
    return sendAuthError(res, error);
  }
});

router.post('/register', async (req, res) => {
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const role = req.body.role || 'customer';

  if (!name || name.length > 100) {
    return res.status(400).json({ error: 'Name is required and must be 100 characters or fewer.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }
  if (password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
    return res.status(400).json({ error: 'Password must be at least 8 characters and no more than 72 UTF-8 bytes.' });
  }
  if (!['customer', 'cargo_provider'].includes(role)) {
    return res.status(400).json({ error: 'Choose a valid account type.' });
  }
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: 'The account service is unavailable.' });
  }

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const user = await User.create({
      name,
      email,
      password: await bcrypt.hash(password, 12),
      role,
    });
    const token = jwt.sign({ sub: user.id }, getJwtSecret(), { expiresIn: tokenLifetime });
    return res.status(201).json({ token, user: publicUser(user) });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }
    return sendAuthError(res, error);
  }
});

router.get('/me', async (req, res) => {
  const authorization = req.get('authorization') || '';
  const [scheme, token] = authorization.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Authentication is required.' });
  }
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: 'The account service is unavailable.' });
  }

  try {
    const payload = jwt.verify(token, getJwtSecret());
    if (typeof payload !== 'object' || typeof payload.sub !== 'string' || !mongoose.isValidObjectId(payload.sub)) {
      return res.status(401).json({ error: 'Session is invalid or expired.' });
    }

    const user = await User.findById(payload.sub);
    if (!user) {
      return res.status(401).json({ error: 'Session is invalid or expired.' });
    }
    return res.json({ user: publicUser(user) });
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Session is invalid or expired.' });
    }
    return sendAuthError(res, error);
  }
});

module.exports = router;
