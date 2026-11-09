// Verified cargo providers directory for customers (and admins).
// Privacy: only public profile fields are returned. Verification submissions, ID/passport
// photos, business licenses and legal documents are NEVER included here — those stay
// admin-only (see routes/users.js and routes/verification.js).
const express = require('express');
const mongoose = require('mongoose');
const User = require('../models/User');
const ShippingRequest = require('../models/ShippingRequest');
const { authenticate, requireRole } = require('../middleware/authenticate');

const router = express.Router();
const CARGO_ROLES = ['cargo_provider', 'individual_cargo'];
const VERIFIED_FILTER = { role: { $in: CARGO_ROLES }, 'verification.status': 'approved' };
const PUBLIC_FIELDS = 'name email phone role country verification.status verification.reviewedAt createdAt';

router.use(authenticate, requireRole('customer', 'admin'));

function databaseUnavailable(res) {
  return res.status(503).json({ error: 'The cargo company directory is unavailable.' });
}

function publicProvider(user, stats = {}) {
  return {
    id: user.id,
    name: user.name,
    role: user.role,
    country: user.country,
    email: user.email,
    phone: user.phone || '',
    verified: user.verification?.status === 'approved',
    verifiedAt: user.verification?.reviewedAt || null,
    memberSince: user.createdAt,
    stats: {
      offers: stats.offers || 0,
      acceptedOffers: stats.accepted || 0,
      completedShipments: stats.delivered || 0,
    },
  };
}

async function providerStats(ids) {
  if (!ids.length) return new Map();
  const rows = await ShippingRequest.aggregate([
    { $unwind: '$offers' },
    { $match: { 'offers.provider': { $in: ids } } },
    {
      $group: {
        _id: '$offers.provider',
        offers: { $sum: 1 },
        accepted: { $sum: { $cond: [{ $eq: ['$offers.status', 'accepted'] }, 1, 0] } },
        delivered: { $sum: { $cond: [{ $and: [{ $eq: ['$offers.status', 'accepted'] }, { $eq: ['$status', 'delivered'] }] }, 1, 0] } },
      },
    },
  ]);
  return new Map(rows.map((row) => [String(row._id), row]));
}

// GET /api/providers — every verified cargo company / individual provider, any country.
router.get('/', async (req, res) => {
  if (mongoose.connection.readyState !== 1) return databaseUnavailable(res);
  try {
    const providers = await User.find(VERIFIED_FILTER).select(PUBLIC_FIELDS).sort({ name: 1 });
    const stats = await providerStats(providers.map((provider) => provider._id));
    return res.json({ providers: providers.map((provider) => publicProvider(provider, stats.get(String(provider._id)))) });
  } catch (error) {
    console.error('Provider directory error:', error);
    return res.status(500).json({ error: 'Cargo companies could not be loaded.' });
  }
});

// GET /api/providers/:id — one verified provider's public profile (404 if not verified).
router.get('/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid cargo company id.' });
  if (mongoose.connection.readyState !== 1) return databaseUnavailable(res);
  try {
    const provider = await User.findOne({ _id: req.params.id, ...VERIFIED_FILTER }).select(PUBLIC_FIELDS);
    if (!provider) return res.status(404).json({ error: 'Cargo company not found.' });
    const stats = await providerStats([provider._id]);
    return res.json({ provider: publicProvider(provider, stats.get(String(provider._id))) });
  } catch (error) {
    console.error('Provider profile error:', error);
    return res.status(500).json({ error: 'This cargo company could not be loaded.' });
  }
});

module.exports = router;
