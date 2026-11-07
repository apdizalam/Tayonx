const express = require('express');
const mongoose = require('mongoose');
const ShippingRequest = require('../models/ShippingRequest');
const { authenticate, requireRole } = require('../middleware/authenticate');

const router = express.Router();
const requestStatuses = ['open', 'offers_received', 'in_progress', 'purchased', 'shipping', 'delivered', 'cancelled'];

router.use(authenticate);

function databaseUnavailable(res) {
  return res.status(503).json({ error: 'The shipping request service is unavailable.' });
}

function validId(id) {
  return mongoose.isValidObjectId(id);
}

function requestFields(body) {
  return {
    product: typeof body.product === 'string' ? body.product.trim() : '',
    sourceCountry: typeof body.sourceCountry === 'string' ? body.sourceCountry.trim() : '',
    destination: typeof body.destination === 'string' ? body.destination.trim() : '',
    quantity: typeof body.quantity === 'string' ? body.quantity.trim() : '',
    details: typeof body.details === 'string' ? body.details.trim() : '',
  };
}

function fieldsError(fields) {
  if (!fields.product || fields.product.length > 160) return 'Product is required and must be 160 characters or fewer.';
  if (!fields.sourceCountry || fields.sourceCountry.length > 80) return 'A source country is required.';
  if (!fields.destination || fields.destination.length > 160) return 'A destination is required.';
  if (!fields.quantity || fields.quantity.length > 100) return 'A quantity is required.';
  if (fields.details.length > 2000) return 'Details must be 2,000 characters or fewer.';
  return null;
}

function handleServerError(res, error) {
  console.error('Shipping request error:', error);
  return res.status(500).json({ error: 'The shipping request could not be processed.' });
}

router.get('/', async (req, res) => {
  if (mongoose.connection.readyState !== 1) return databaseUnavailable(res);

  try {
    let filter = {};
    if (req.user.role === 'customer') {
      filter = { customer: req.user._id };
    } else if (req.user.role === 'cargo_provider') {
      filter = req.query.scope === 'offers'
        ? { 'offers.provider': req.user._id }
        : {
          status: { $in: ['open', 'offers_received'] },
          declinedBy: { $ne: req.user._id },
          'offers.provider': { $ne: req.user._id },
        };
    }
    let query = ShippingRequest.find(filter);
    const hideOffers = req.user.role === 'cargo_provider' && req.query.scope !== 'offers';
    if (hideOffers) query = query.select('-offers');
    query = query.populate('customer', 'name').sort({ createdAt: -1 });
    if (!hideOffers) query = query.populate('offers.provider', 'name');
    const requests = await query;
    return res.json({ requests });
  } catch (error) {
    return handleServerError(res, error);
  }
});

router.post('/', requireRole('customer'), async (req, res) => {
  if (mongoose.connection.readyState !== 1) return databaseUnavailable(res);
  const fields = requestFields(req.body || {});
  const error = fieldsError(fields);
  if (error) return res.status(400).json({ error });

  try {
    const request = await ShippingRequest.create({ ...fields, customer: req.user._id });
    await request.populate('customer', 'name');
    return res.status(201).json({ request });
  } catch (createError) {
    return handleServerError(res, createError);
  }
});

router.get('/offers', async (req, res) => {
  if (mongoose.connection.readyState !== 1) return databaseUnavailable(res);
  try {
    let filter = {};
    if (req.user.role === 'customer') filter = { customer: req.user._id };
    if (req.user.role === 'cargo_provider') filter = { 'offers.provider': req.user._id };
    const requests = await ShippingRequest.find(filter)
      .populate('customer', 'name')
      .populate('offers.provider', 'name')
      .sort({ createdAt: -1 });
    const offers = requests.flatMap((request) => request.offers
      .filter((offer) => req.user.role === 'admin'
        || (req.user.role === 'customer' && request.customer?._id.equals(req.user._id))
        || (req.user.role === 'cargo_provider' && offer.provider?._id.equals(req.user._id)))
      .map((offer) => ({
        ...offer.toObject(),
        request: {
          id: request.id,
          product: request.product,
          sourceCountry: request.sourceCountry,
          destination: request.destination,
          quantity: request.quantity,
          status: request.status,
          customer: request.customer,
        },
      })));
    return res.json({ offers });
  } catch (error) {
    return handleServerError(res, error);
  }
});

router.get('/:id', async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'Invalid request id.' });
  if (mongoose.connection.readyState !== 1) return databaseUnavailable(res);

  try {
    const request = await ShippingRequest.findById(req.params.id)
      .populate('customer', 'name')
      .populate('offers.provider', 'name');
    if (!request) return res.status(404).json({ error: 'Shipping request not found.' });
    if (req.user.role === 'customer' && (!request.customer || !request.customer._id.equals(req.user._id))) {
      return res.status(403).json({ error: 'You do not have access to this request.' });
    }
    if (req.user.role === 'cargo_provider'
      && !['open', 'offers_received'].includes(request.status)
      && !request.offers.some((offer) => offer.provider?._id.equals(req.user._id))) {
      return res.status(404).json({ error: 'Shipping request not found.' });
    }
    if (req.user.role === 'cargo_provider') {
      request.offers = request.offers.filter((offer) => offer.provider?._id.equals(req.user._id));
    }
    return res.json({ request });
  } catch (error) {
    return handleServerError(res, error);
  }
});

router.put('/:id', async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'Invalid request id.' });
  if (mongoose.connection.readyState !== 1) return databaseUnavailable(res);

  try {
    const request = await ShippingRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ error: 'Shipping request not found.' });
    if (req.user.role !== 'admin' && !request.customer.equals(req.user._id)) {
      return res.status(403).json({ error: 'Only the request owner or an admin can edit this request.' });
    }
    const fields = requestFields(req.body || {});
    const error = fieldsError(fields);
    if (error) return res.status(400).json({ error });
    Object.assign(request, fields);
    await request.save();
    await request.populate('customer', 'name');
    return res.json({ request });
  } catch (error) {
    return handleServerError(res, error);
  }
});

router.delete('/:id', async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'Invalid request id.' });
  if (mongoose.connection.readyState !== 1) return databaseUnavailable(res);

  try {
    const request = await ShippingRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ error: 'Shipping request not found.' });
    if (req.user.role !== 'admin' && !request.customer.equals(req.user._id)) {
      return res.status(403).json({ error: 'Only the request owner or an admin can delete this request.' });
    }
    await request.deleteOne();
    return res.status(204).end();
  } catch (error) {
    return handleServerError(res, error);
  }
});

router.post('/:id/decline', requireRole('cargo_provider'), async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'Invalid request id.' });
  if (mongoose.connection.readyState !== 1) return databaseUnavailable(res);

  try {
    const request = await ShippingRequest.findOneAndUpdate(
      {
        _id: req.params.id,
        status: { $in: ['open', 'offers_received'] },
        'offers.provider': { $ne: req.user._id },
      },
      { $addToSet: { declinedBy: req.user._id } },
      { new: true },
    );
    if (!request) return res.status(404).json({ error: 'This request is no longer available.' });
    return res.json({ message: 'Request declined.', requestId: request.id });
  } catch (error) {
    return handleServerError(res, error);
  }
});

router.post('/:id/offers', requireRole('cargo_provider'), async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'Invalid request id.' });
  if (mongoose.connection.readyState !== 1) return databaseUnavailable(res);

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const price = Number(body.price);
  const deliveryDays = Number(body.deliveryDays);
  const includes = typeof body.includes === 'string' ? body.includes.trim() : '';
  if (!Number.isFinite(price) || price <= 0 || price > 1000000000) {
    return res.status(400).json({ error: 'Enter a valid offer price greater than zero.' });
  }
  if (!Number.isInteger(deliveryDays) || deliveryDays < 1 || deliveryDays > 365) {
    return res.status(400).json({ error: 'Delivery time must be between 1 and 365 days.' });
  }
  if (includes.length > 500) return res.status(400).json({ error: 'Offer details must be 500 characters or fewer.' });

  try {
    const request = await ShippingRequest.findOne({
      _id: req.params.id,
      status: { $in: ['open', 'offers_received'] },
      declinedBy: { $ne: req.user._id },
      'offers.provider': { $ne: req.user._id },
    });
    if (!request) return res.status(404).json({ error: 'This request is unavailable or you have already responded.' });
    request.offers.push({ provider: req.user._id, price, deliveryDays, includes });
    request.status = 'offers_received';
    await request.save();
    const offer = request.offers[request.offers.length - 1];
    return res.status(201).json({ offer: { ...offer.toObject(), request: request.id } });
  } catch (error) {
    return handleServerError(res, error);
  }
});

router.put('/offers/:offerId', requireRole('cargo_provider', 'admin'), async (req, res) => {
  if (!validId(req.params.offerId)) return res.status(400).json({ error: 'Invalid offer id.' });
  if (mongoose.connection.readyState !== 1) return databaseUnavailable(res);

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const price = Number(body.price);
  const deliveryDays = Number(body.deliveryDays);
  const includes = typeof body.includes === 'string' ? body.includes.trim() : '';
  if (!Number.isFinite(price) || price <= 0 || price > 1000000000) return res.status(400).json({ error: 'Enter a valid offer price greater than zero.' });
  if (!Number.isInteger(deliveryDays) || deliveryDays < 1 || deliveryDays > 365) return res.status(400).json({ error: 'Delivery time must be between 1 and 365 days.' });
  if (includes.length > 500) return res.status(400).json({ error: 'Offer details must be 500 characters or fewer.' });

  try {
    const filter = req.user.role === 'admin'
      ? { 'offers._id': req.params.offerId }
      : { 'offers._id': req.params.offerId, 'offers.provider': req.user._id };
    const request = await ShippingRequest.findOne(filter);
    if (!request) return res.status(404).json({ error: 'Offer not found.' });
    const offer = request.offers.id(req.params.offerId);
    if (offer.status !== 'pending') return res.status(409).json({ error: 'Only pending offers can be edited.' });
    Object.assign(offer, { price, deliveryDays, includes });
    await request.save();
    return res.json({ offer: { ...offer.toObject(), request: request.id } });
  } catch (error) {
    return handleServerError(res, error);
  }
});

router.delete('/offers/:offerId', requireRole('cargo_provider', 'admin'), async (req, res) => {
  if (!validId(req.params.offerId)) return res.status(400).json({ error: 'Invalid offer id.' });
  if (mongoose.connection.readyState !== 1) return databaseUnavailable(res);

  try {
    const filter = req.user.role === 'admin'
      ? { 'offers._id': req.params.offerId }
      : { 'offers._id': req.params.offerId, 'offers.provider': req.user._id };
    const request = await ShippingRequest.findOne(filter);
    if (!request) return res.status(404).json({ error: 'Offer not found.' });
    const offer = request.offers.id(req.params.offerId);
    if (offer.status !== 'pending') return res.status(409).json({ error: 'Only pending offers can be deleted.' });
    request.offers.pull(req.params.offerId);
    request.status = request.offers.some((item) => item.status === 'pending') ? 'offers_received' : 'open';
    await request.save();
    return res.status(204).end();
  } catch (error) {
    return handleServerError(res, error);
  }
});

router.patch('/offers/:offerId/status', requireRole('customer', 'admin'), async (req, res) => {
  const { status } = req.body || {};
  if (!['accepted', 'declined'].includes(status)) return res.status(400).json({ error: 'Choose accepted or declined.' });
  if (!validId(req.params.offerId)) return res.status(400).json({ error: 'Invalid offer id.' });
  if (mongoose.connection.readyState !== 1) return databaseUnavailable(res);

  try {
    const request = await ShippingRequest.findOne({ 'offers._id': req.params.offerId });
    if (!request) return res.status(404).json({ error: 'Offer not found.' });
    if (req.user.role === 'customer' && !request.customer.equals(req.user._id)) {
      return res.status(403).json({ error: 'Only the request owner can respond to this offer.' });
    }
    const offer = request.offers.id(req.params.offerId);
    if (offer.status !== 'pending' || request.status === 'cancelled') {
      return res.status(409).json({ error: 'This offer can no longer be changed.' });
    }

    if (status === 'accepted') {
      request.offers.forEach((item) => {
        item.status = item.id === offer.id ? 'accepted' : 'declined';
      });
      request.status = 'in_progress';
    } else {
      offer.status = 'declined';
      request.status = request.offers.some((item) => item.status === 'pending') ? 'offers_received' : 'open';
    }
    await request.save();
    return res.json({ offer: { ...offer.toObject(), request: request.id }, requestStatus: request.status });
  } catch (error) {
    return handleServerError(res, error);
  }
});

router.patch('/:id/status', async (req, res) => {
  const { status } = req.body || {};
  if (!requestStatuses.includes(status)) return res.status(400).json({ error: 'Choose a valid shipment status.' });
  if (!validId(req.params.id)) return res.status(400).json({ error: 'Invalid request id.' });
  if (mongoose.connection.readyState !== 1) return databaseUnavailable(res);

  try {
    const request = await ShippingRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ error: 'Shipping request not found.' });
    const isOwner = request.customer.equals(req.user._id);
    const assignedProvider = request.offers.some((offer) => offer.provider.equals(req.user._id) && offer.status === 'accepted');
    if (req.user.role === 'customer' && !isOwner) return res.status(403).json({ error: 'Only the request owner can update this shipment.' });
    if (req.user.role === 'cargo_provider' && !assignedProvider) return res.status(403).json({ error: 'Only the selected cargo provider can update this shipment.' });

    const transitions = {
      open: ['cancelled'],
      offers_received: ['cancelled'],
      in_progress: ['purchased', 'cancelled'],
      purchased: ['shipping'],
      shipping: ['delivered'],
      delivered: [],
      cancelled: [],
    };
    if (req.user.role !== 'admin' && !transitions[request.status].includes(status)) {
      return res.status(409).json({ error: `Cannot change shipment from ${request.status} to ${status}.` });
    }
    request.status = status;
    await request.save();
    return res.json({ request });
  } catch (error) {
    return handleServerError(res, error);
  }
});

module.exports = router;