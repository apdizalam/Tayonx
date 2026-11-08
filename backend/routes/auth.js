const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const UploadedFile = require('../models/UploadedFile');
const publicUser = require('../lib/publicUser');
const {
  ACCOUNT_ROLES,
  normalizeRole,
  validateAccountFields,
  validatePassword,
} = require('../constants/accounts');
const {
  IMAGE_TYPES,
  acceptUploads,
  checkFileType,
  saveUploadedFile,
  uploadedFile,
} = require('../lib/uploads');

const router = express.Router();
const tokenLifetime = '1h';

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be set to at least 32 characters.');
  }
  return secret;
}

function sendAuthError(res, error) {
  if (error.message === 'JWT_SECRET must be set to at least 32 characters.') {
    return res.status(503).json({ error: 'Authentication is not configured.' });
  }
  console.error('Authentication error:', error);
  return res.status(500).json({ error: 'Authentication could not be completed.' });
}

// Public sign-up. Accepts JSON or multipart/form-data (customers may attach a profile photo).
router.post('/register', acceptUploads(['profilePhoto']), async (req, res) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const role = normalizeRole(body.role || 'customer');
  if (!ACCOUNT_ROLES.includes(role)) {
    return res.status(400).json({ error: 'Choose a valid account type.', field: 'role' });
  }

  const { fields, error, field } = validateAccountFields(body, { role });
  if (error) return res.status(400).json({ error, field });

  const passwordError = validatePassword(body.password);
  if (passwordError) return res.status(400).json({ error: passwordError, field: 'password' });

  const photo = uploadedFile(req, 'profilePhoto');
  if (photo && role !== 'customer') {
    return res.status(400).json({ error: 'Only customer accounts can upload a profile picture at sign-up.', field: 'profilePhoto' });
  }
  if (photo) {
    const typeError = checkFileType(photo, IMAGE_TYPES);
    if (typeError) return res.status(400).json({ error: typeError, field: 'profilePhoto' });
  }
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: 'The account service is unavailable.' });
  }

  let photoId = null;
  try {
    if (await User.exists({ email: fields.email })) {
      return res.status(409).json({ error: 'An account with this email already exists.', field: 'email' });
    }
    if (photo) photoId = await saveUploadedFile(photo, { owner: null, purpose: 'profile_photo' });

    const user = await User.create({
      ...fields,
      role,
      password: await bcrypt.hash(body.password, 12),
      profilePhoto: photoId,
    });
    if (photoId) await UploadedFile.updateOne({ _id: photoId }, { owner: user._id });
    return res.status(201).json({ message: 'Account created successfully.', user: publicUser(user) });
  } catch (error) {
    if (photoId) await UploadedFile.deleteOne({ _id: photoId }).catch(() => {});
    if (error.code === 11000) {
      return res.status(409).json({ error: 'An account with this email already exists.', field: 'email' });
    }
    return sendAuthError(res, error);
  }
});

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
