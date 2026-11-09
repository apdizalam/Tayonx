const express = require('express');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/User');
const UploadedFile = require('../models/UploadedFile');
const VerificationRequest = require('../models/VerificationRequest');
const ShippingRequest = require('../models/ShippingRequest');
const publicUser = require('../lib/publicUser');
const { requestSummary, documentPopulate } = require('../lib/verificationSummary');
const { authenticate, requireRole } = require('../middleware/authenticate');
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
const editableRoles = [...ACCOUNT_ROLES, 'admin'];

router.use(authenticate, requireRole('admin'));

function databaseUnavailable(res) {
  return res.status(503).json({ error: 'The user service is unavailable.' });
}

function validId(id) {
  return mongoose.isValidObjectId(id);
}

function requestBody(req) {
  return req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
}

function handleServerError(res, error) {
  if (error.code === 11000) {
    return res.status(409).json({ error: 'An account with this email already exists.', field: 'email' });
  }
  console.error('User management error:', error);
  return res.status(500).json({ error: 'The user could not be processed.' });
}

function checkPhoto(req, role) {
  const photo = uploadedFile(req, 'profilePhoto');
  if (!photo) return { photo: null };
  if (role !== 'customer') return { error: 'Only customer accounts have a profile picture.' };
  const typeError = checkFileType(photo, IMAGE_TYPES);
  return typeError ? { error: typeError } : { photo };
}

router.get('/', async (req, res) => {
  if (mongoose.connection.readyState !== 1) return databaseUnavailable(res);
  try {
    const users = await User.find()
      .select('name email role country phone profilePhoto verification createdAt updatedAt')
      .sort({ createdAt: -1 });
    return res.json({ users: users.map(publicUser) });
  } catch (error) {
    return handleServerError(res, error);
  }
});

// Full details of one account for the admin "View user" modal: profile, verification
// history with uploaded documents, and a short activity summary.
router.get('/:id', async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'Invalid user id.' });
  if (mongoose.connection.readyState !== 1) return databaseUnavailable(res);
  try {
    const user = await User.findById(req.params.id)
      .select('name email role country phone profilePhoto verification createdAt updatedAt');
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const isProvider = ['cargo_provider', 'individual_cargo'].includes(user.role);
    const [verificationRequests, activity] = await Promise.all([
      isProvider
        ? VerificationRequest.find({ user: user._id }).sort({ createdAt: -1 }).limit(10).populate(documentPopulate)
        : [],
      user.role === 'customer'
        ? ShippingRequest.aggregate([
          { $match: { customer: user._id } },
          { $group: { _id: null, requests: { $sum: 1 }, active: { $sum: { $cond: [{ $in: ['$status', ['open', 'offers_received', 'in_progress', 'purchased', 'shipping']] }, 1, 0] } } } },
        ])
        : isProvider
          ? ShippingRequest.aggregate([
            { $unwind: '$offers' },
            { $match: { 'offers.provider': user._id } },
            { $group: { _id: null, offers: { $sum: 1 }, accepted: { $sum: { $cond: [{ $eq: ['$offers.status', 'accepted'] }, 1, 0] } } } },
          ])
          : [],
    ]);
    const stats = activity[0] || {};
    return res.json({
      user: publicUser(user),
      verificationRequests: verificationRequests.map(requestSummary),
      activity: user.role === 'customer'
        ? { requests: stats.requests || 0, activeRequests: stats.active || 0 }
        : isProvider ? { offers: stats.offers || 0, acceptedOffers: stats.accepted || 0 } : {},
    });
  } catch (error) {
    return handleServerError(res, error);
  }
});

router.post('/', acceptUploads(['profilePhoto']), async (req, res) => {
  if (mongoose.connection.readyState !== 1) return databaseUnavailable(res);
  const body = requestBody(req);
  const role = normalizeRole(body.role);
  if (!ACCOUNT_ROLES.includes(role)) {
    return res.status(400).json({ error: `Choose a valid role: ${ACCOUNT_ROLES.join(', ')}.`, field: 'role' });
  }
  const { fields, error, field } = validateAccountFields(body, { role });
  if (error) return res.status(400).json({ error, field });
  const passwordError = validatePassword(body.password);
  if (passwordError) return res.status(400).json({ error: passwordError, field: 'password' });
  const { photo, error: photoError } = checkPhoto(req, role);
  if (photoError) return res.status(400).json({ error: photoError, field: 'profilePhoto' });

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
    return res.status(201).json({ user: publicUser(user) });
  } catch (error) {
    if (photoId) await UploadedFile.deleteOne({ _id: photoId }).catch(() => {});
    return handleServerError(res, error);
  }
});

// Partial update: only the fields that are sent are validated and changed.
router.put('/:id', acceptUploads(['profilePhoto']), async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'Invalid user id.' });
  if (mongoose.connection.readyState !== 1) return databaseUnavailable(res);
  const body = requestBody(req);

  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    let role = user.role;
    if (Object.hasOwn(body, 'role')) {
      role = normalizeRole(body.role);
      if (!editableRoles.includes(role)) {
        return res.status(400).json({ error: `Choose a valid role: ${editableRoles.join(', ')}.`, field: 'role' });
      }
    }
    const { fields, error, field } = validateAccountFields(body, { role, partial: true });
    if (error) return res.status(400).json({ error, field });
    if (Object.hasOwn(body, 'password') && body.password !== '') {
      const passwordError = validatePassword(body.password);
      if (passwordError) return res.status(400).json({ error: passwordError, field: 'password' });
    }
    const { photo, error: photoError } = checkPhoto(req, role);
    if (photoError) return res.status(400).json({ error: photoError, field: 'profilePhoto' });
    if (!Object.keys(fields).length && role === user.role && !body.password && !photo) {
      return res.status(400).json({ error: 'Provide at least one user field to update.' });
    }

    if (user._id.equals(req.user._id) && role !== 'admin') {
      return res.status(409).json({ error: 'You cannot remove your own administrator access.' });
    }
    if (user.role === 'admin' && role !== 'admin' && await User.countDocuments({ role: 'admin' }) <= 1) {
      return res.status(409).json({ error: 'The last administrator cannot be demoted.' });
    }
    if (fields.email && fields.email !== user.email && await User.exists({ email: fields.email })) {
      return res.status(409).json({ error: 'An account with this email already exists.', field: 'email' });
    }

    Object.assign(user, fields, { role });
    if (body.password) user.password = await bcrypt.hash(body.password, 12);
    if (photo) {
      const oldPhoto = user.profilePhoto;
      user.profilePhoto = await saveUploadedFile(photo, { owner: user._id, purpose: 'profile_photo' });
      if (oldPhoto) await UploadedFile.deleteOne({ _id: oldPhoto }).catch(() => {});
    }
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
    await UploadedFile.deleteMany({ owner: user._id });
    await VerificationRequest.deleteMany({ user: user._id });
    return res.status(204).end();
  } catch (error) {
    return handleServerError(res, error);
  }
});

module.exports = router;
