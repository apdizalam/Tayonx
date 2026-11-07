const express = require('express');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/User');
const { authenticate, requireRole } = require('../middleware/authenticate');

const router = express.Router();
const creatableRoles = ['customer', 'cargo_provider', 'individual_cargo'];
const editableRoles = [...creatableRoles, 'admin'];
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const passwordMinimumLength = 8;
const passwordMaximumBytes = 72;

router.use(authenticate, requireRole('admin'));

function databaseUnavailable(res) {
  return res.status(503).json({ error: 'The user service is unavailable.' });
}

function validId(id) {
  return mongoose.isValidObjectId(id);
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    country: user.country,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function handleServerError(res, error) {
  if (error.code === 11000) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }
  console.error('User management error:', error);
  return res.status(500).json({ error: 'The user could not be processed.' });
}

function normalizeFields(body, { creating = false } = {}) {
  const fields = {};
  if (Object.hasOwn(body, 'name') || creating) {
    fields.name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!fields.name || fields.name.length > 100) {
      return { error: 'Name is required and must be 100 characters or fewer.' };
    }
  }
  if (Object.hasOwn(body, 'email') || creating) {
    fields.email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!emailPattern.test(fields.email) || fields.email.length > 254) {
      return { error: 'Enter a valid email address.' };
    }
  }
  if (Object.hasOwn(body, 'country') || creating) {
    fields.country = typeof body.country === 'string' ? body.country.trim() : '';
    if (!fields.country) fields.country = 'Somaliland';
    if (fields.country.length > 100) return { error: 'Country must be 100 characters or fewer.' };
  }
  if (Object.hasOwn(body, 'role') || creating) {
    fields.role = typeof body.role === 'string' ? body.role.trim().toLowerCase() : '';
    const allowedRoles = creating ? creatableRoles : editableRoles;
    if (!allowedRoles.includes(fields.role)) {
      return { error: `Choose a valid role: ${allowedRoles.join(', ')}.` };
    }
  }
  return { fields };
}

function validPassword(password) {
  return typeof password === 'string'
    && password.length >= passwordMinimumLength
    && Buffer.byteLength(password, 'utf8') <= passwordMaximumBytes;
}

router.get('/', async (req, res) => {
  if (mongoose.connection.readyState !== 1) return databaseUnavailable(res);
  try {
    const users = await User.find()
      .select('name email role country createdAt updatedAt')
      .sort({ createdAt: -1 });
    return res.json({ users: users.map(publicUser) });
  } catch (error) {
    return handleServerError(res, error);
  }
});

router.post('/', async (req, res) => {
  if (mongoose.connection.readyState !== 1) return databaseUnavailable(res);
  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
  const { fields, error } = normalizeFields(body, { creating: true });
  if (error) return res.status(400).json({ error });
  if (!validPassword(body.password)) {
    return res.status(400).json({ error: 'Password must be at least 8 characters and no more than 72 UTF-8 bytes.' });
  }

  try {
    const user = await User.create({
      ...fields,
      password: await bcrypt.hash(body.password, 12),
    });
    return res.status(201).json({ user: publicUser(user) });
  } catch (error) {
    return handleServerError(res, error);
  }
});

router.put('/:id', async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'Invalid user id.' });
  if (mongoose.connection.readyState !== 1) return databaseUnavailable(res);
  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
  const { fields, error } = normalizeFields(body);
  if (error) return res.status(400).json({ error });
  if (Object.hasOwn(body, 'password') && body.password !== '' && !validPassword(body.password)) {
    return res.status(400).json({ error: 'Password must be at least 8 characters and no more than 72 UTF-8 bytes.' });
  }
  if (!Object.keys(fields).length && !body.password) {
    return res.status(400).json({ error: 'Provide at least one user field to update.' });
  }

  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    if (user._id.equals(req.user._id) && fields.role && fields.role !== 'admin') {
      return res.status(409).json({ error: 'You cannot remove your own administrator access.' });
    }
    if (user.role === 'admin' && fields.role && fields.role !== 'admin') {
      const adminCount = await User.countDocuments({ role: 'admin' });
      if (adminCount <= 1) {
        return res.status(409).json({ error: 'The last administrator cannot be demoted.' });
      }
    }
    Object.assign(user, fields);
    if (body.password) user.password = await bcrypt.hash(body.password, 12);
    await user.save();
    return res.json({ user: publicUser(user) });
  } catch (error) {
    return handleServerError(res, error);
  }
});

router.delete('/:id', async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'Invalid user id.' });
  if (mongoose.connection.readyState !== 1) return databaseUnavailable(res);

  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    if (user._id.equals(req.user._id)) {
      return res.status(409).json({ error: 'You cannot delete your own administrator account.' });
    }
    if (user.role === 'admin' && await User.countDocuments({ role: 'admin' }) <= 1) {
      return res.status(409).json({ error: 'The last administrator cannot be deleted.' });
    }
    await user.deleteOne();
    return res.status(204).end();
  } catch (error) {
    return handleServerError(res, error);
  }
});

module.exports = router;
