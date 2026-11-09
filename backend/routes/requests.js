const express = require('express');
const mongoose = require('mongoose');
const ShippingRequest = require('../models/ShippingRequest');
const UploadedFile = require('../models/UploadedFile');
const { authenticate, requireRole } = require('../middleware/authenticate');
const { parseQuantity, readOfferBody, repriceOffer } = require('../lib/offerPricing');
const {
  IMAGE_TYPES,
  acceptUploads,
  checkFileType,
  saveUploadedFile,
  uploadedFile,
} = require('../lib/uploads');

const DELIVERY_METHODS = ['sea', 'air'];

const router = express.Router();
const requestStatuses = ['open', 'offers_received', 'in_progress', 'purchased', 'shipping', 'delivered', 'cancelled'];
const cargoProviderRoles = ['cargo_provider', 'individual_cargo'];

router.use(authenticate);

function isCargoProvider(user) {
  return cargoProviderRoles.includes(user.role);
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Cargo providers only work with requests shipped from their own profile country
// (e.g. a provider in China sees requests whose source country is China).
// Matching ignores case and surrounding spaces.
function providerCountryFilter(user) {
  const country = typeof user.country === 'string' ? user.country.trim() : '';
  if (!country) return { _id: null }; // no country on the profile → match nothing
  return { sourceCountry: new RegExp(`^\\s*${escapeRegExp(country)}\\s*$`, 'i') };
}

function sameCountry(user, request) {
  const a = typeof user.country === 'string' ? user.country.trim().toLowerCase() : '';
  const b = typeof request.sourceCountry === 'string' ? request.sourceCountry.trim().toLowerCase() : '';
  return Boolean(a) && a === b;
}

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
    deliveryMethod: typeof body.deliveryMethod === 'string' ? body.deliveryMethod.trim().toLowerCase() : '',
  };
}

/** Validates an optional product photo upload; returns { photo } or { error }. */
function readProductPhoto(req) {
  const photo = uploadedFile(req, 'productPhoto');
  if (!photo) return { photo: null };
  const typeError = checkFileType(photo, IMAGE_TYPES);
  return typeError ? { error: `Product photo: ${typeError}` } : { photo };
}

function wantsPhotoRemoved(body) {
  return body.removeProductPhoto === true || body.removeProductPhoto === 'true';
}

function fieldsError(fields) {
  if (!fields.product || fields.product.length > 160) return 'Product is required and must be 160 characters or fewer.';
  if (!fields.sourceCountry || fields.sourceCountry.length > 80) return 'A source country is required.';
  if (!fields.destination || fields.destination.length > 160) return 'A destination is required.';
  if (!fields.quantity || fields.quantity.length > 100) return 'A quantity is required.';
  // Offers are priced per item, so the quantity must contain a whole number.
  if (!parseQuantity(fields.quantity)) return 'Quantity must include a whole number, e.g. "50 laptops".';
  if (fields.details.length > 2000) return 'Details must be 2,000 characters or fewer.';
  if (!DELIVERY_METHODS.includes(fields.deliveryMethod)) return 'Choose a delivery method: Ship (Maritime) or Aircraft (Air freight).';
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
    } else if (isCargoProvider(req.user)) {
      filter = req.query.scope === 'offers'
        ? { 'offers.provider': req.user._id }
        : {
          status: { $in: ['open', 'offers_received'] },
          declinedBy: { $ne: req.user._id },
          'offers.provider': { $ne: req.user._id },
          ...providerCountryFilter(req.user),
        };
    }
    let query = ShippingRequest.find(filter);
    const hideOffers = isCargoProvider(req.user) && req.query.scope !== 'offers';
    if (hideOffers) query = query.select('-offers');
    query = query.populate('customer', 'name').sort({ createdAt: -1 });
    if (!hideOffers) query = query.populate('offers.provider', 'name');
    const requests = await query;
    return res.json({ requests });
  } catch (error) {
    return handleServerError(res, error);
  }
});

// Accepts JSON or multipart/form-data (with an optional `productPhoto` image).
router.post('/', requireRole('customer'), acceptUploads(['productPhoto']), async (req, res) => {
  if (mongoose.connection.readyState !== 1) return databaseUnavailable(res);
  const fields = requestFields(req.body || {});
  const error = fieldsError(fields);
  if (error) return res.status(400).json({ error });
  const { photo, error: photoError } = readProductPhoto(req);
  if (photoError) return res.status(400).json({ error: photoError, field: 'productPhoto' });

  let photoId = null;
  try {
    if (photo) photoId = await saveUploadedFile(photo, { owner: req.user._id, purpose: 'product_photo' });
    const request = await ShippingRequest.create({ ...fields, productPhoto: photoId, customer: req.user._id });
    await request.populate('customer', 'name');
    return res.status(201).json({ request });
  } catch (createError) {
    if (photoId) await UploadedFile.deleteOne({ _id: photoId }).catch(() => {});
    return handleServerError(res, createError);
  }
});

router.get('/offers', async (req, res) => {
  if (mongoose.connection.readyState !== 1) return databaseUnavailable(res);
  try {
    let filter = {};
    if (req.user.role === 'customer') filter = { customer: req.user._id };
    if (isCargoProvider(req.user)) filter = { 'offers.provider': req.user._id };
    const requests = await ShippingRequest.find(filter)
      .populate('customer', 'name')
      .populate('offers.provider', 'name')
      .sort({ createdAt: -1 });
    const offers = requests.flatMap((request) => request.offers
      .filter((offer) => req.user.role === 'admin'
        || (req.user.role === 'customer' && request.customer?._id.equals(req.user._id))
        || (isCargoProvider(req.user) && offer.provider?._id.equals(req.user._id)))
      .map((offer) => ({
        ...offer.toObject(),
        request: {
          id: request.id,
          product: request.product,
          sourceCountry: request.sourceCountry,
          destination: request.destination,
          quantity: request.quantity,
          deliveryMethod: request.deliveryMethod,
          productPhoto: request.productPhoto,
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
    // Providers can open a request they already quoted on, or an open request from their own country.
    if (isCargoProvider(req.user)
      && !request.offers.some((offer) => offer.provider?._id.equals(req.user._id))
      && (!['open', 'offers_received'].includes(request.status) || !sameCountry(req.user, request))) {
      return res.status(404).json({ error: 'Shipping request not found.' });
    }
    if (isCargoProvider(req.user)) {
      request.offers = request.offers.filter((offer) => offer.provider?._id.equals(req.user._id));
    }
    return res.json({ request });
  } catch (error) {
    return handleServerError(res, error);
  }
});

// Accepts JSON or multipart/form-data. A new `productPhoto` replaces the old one;
// `removeProductPhoto=true` removes it.
router.put('/:id', acceptUploads(['productPhoto']), async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'Invalid request id.' });
  if (mongoose.connection.readyState !== 1) return databaseUnavailable(res);

  try {
    const request = await ShippingRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ error: 'Shipping request not found.' });
    if (req.user.role !== 'admin' && !request.customer.equals(req.user._id)) {
      return res.status(403).json({ error: 'Only the request owner or an admin can edit this request.' });
    }
    const body = req.body || {};
    const fields = requestFields(body);
    const error = fieldsError(fields);
    if (error) return res.status(400).json({ error });
    const { photo, error: photoError } = readProductPhoto(req);
    if (photoError) return res.status(400).json({ error: photoError, field: 'productPhoto' });

    Object.assign(request, fields);
    const oldPhoto = request.productPhoto;
    if (photo) {
      request.productPhoto = await saveUploadedFile(photo, { owner: request.customer, purpose: 'product_photo' });
    } else if (wantsPhotoRemoved(body)) {
      request.productPhoto = null;
    }
    if (oldPhoto && !oldPhoto.equals?.(request.productPhoto)) {
      await UploadedFile.deleteOne({ _id: oldPhoto }).catch(() => {});
    }
    // Keep pending per-item quotes consistent with the new quantity (subtotal and total).
    const newCount = parseQuantity(request.quantity);
    for (const offer of request.offers) {
      if (offer.status === 'pending') repriceOffer(offer, newCount);
    }
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
    if (request.productPhoto) await UploadedFile.deleteOne({ _id: request.productPhoto }).catch(() => {});
    return res.status(204).end();
  } catch (error) {
    return handleServerError(res, error);
  }
});

router.post('/:id/decline', requireRole(...cargoProviderRoles), async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'Invalid request id.' });
  if (mongoose.connection.readyState !== 1) return databaseUnavailable(res);

  try {
    const request = await ShippingRequest.findOneAndUpdate(
      {
        _id: req.params.id,
        status: { $in: ['open', 'offers_received'] },
        'offers.provider': { $ne: req.user._id },
        ...providerCountryFilter(req.user),
      },
      { $addToSet: { declinedBy: req.user._id } },
      { returnDocument: 'after' },
    );
    if (!request) return res.status(404).json({ error: 'This request is no longer available.' });
    return res.json({ message: 'Request declined.', requestId: request.id });
  } catch (error) {
    return handleServerError(res, error);
  }
});

router.post('/:id/offers', requireRole(...cargoProviderRoles), async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'Invalid request id.' });
  if (mongoose.connection.readyState !== 1) return databaseUnavailable(res);

  const body = req.body && typeof req.body === 'object' ? req.body : {};

  try {
    const request = await ShippingRequest.findOne({
      _id: req.params.id,
      status: { $in: ['open', 'offers_received'] },
      declinedBy: { $ne: req.user._id },
      'offers.provider': { $ne: req.user._id },
      ...providerCountryFilter(req.user),
    });
    if (!request) return res.status(404).json({ error: 'This request is unavailable or you have already responded.' });
    const { fields, error, field } = readOfferBody(body, request.quantity);
    if (error) return res.status(400).json({ error, field });
    request.offers.push({ provider: req.user._id, ...fields });
    request.status = 'offers_received';
    await request.save();
    const offer = request.offers[request.offers.length - 1];
    return res.status(201).json({ offer: { ...offer.toObject(), request: request.id } });
  } catch (error) {
    return handleServerError(res, error);
  }
});

// Only the provider who sent an offer can edit it. Administrators have read-only access to offers.
router.put('/offers/:offerId', requireRole(...cargoProviderRoles), async (req, res) => {
  if (!validId(req.params.offerId)) return res.status(400).json({ error: 'Invalid offer id.' });
  if (mongoose.connection.readyState !== 1) return databaseUnavailable(res);

  const body = req.body && typeof req.body === 'object' ? req.body : {};

  try {
    const request = await ShippingRequest.findOne({ 'offers._id': req.params.offerId, 'offers.provider': req.user._id });
    if (!request) return res.status(404).json({ error: 'Offer not found.' });
    const offer = request.offers.id(req.params.offerId);
    if (offer.status !== 'pending') return res.status(409).json({ error: 'Only pending offers can be edited.' });
    const { fields, error, field } = readOfferBody(body, request.quantity);
    if (error) return res.status(400).json({ error, field });
    Object.assign(offer, fields);
    await request.save();
    return res.json({ offer: { ...offer.toObject(), request: request.id } });
  } catch (error) {
    return handleServerError(res, error);
  }
});

// Remove an offer:
//  - the provider can withdraw their own pending offer;
//  - the customer can remove a pending or declined offer from their own request.
// Accepted offers are never removed (the shipment is underway). Administrators are read-only.
router.delete('/offers/:offerId', requireRole(...cargoProviderRoles, 'customer'), async (req, res) => {
  if (!validId(req.params.offerId)) return res.status(400).json({ error: 'Invalid offer id.' });
  if (mongoose.connection.readyState !== 1) return databaseUnavailable(res);

  try {
    const isCustomer = req.user.role === 'customer';
    const filter = isCustomer
      ? { 'offers._id': req.params.offerId, customer: req.user._id }
      : { 'offers._id': req.params.offerId, 'offers.provider': req.user._id };
    const request = await ShippingRequest.findOne(filter);
    if (!request) return res.status(404).json({ error: 'Offer not found.' });
    const offer = request.offers.id(req.params.offerId);
    if (!isCustomer && !offer.provider.equals(req.user._id)) return res.status(404).json({ error: 'Offer not found.' });
    const removable = isCustomer ? ['pending', 'declined'] : ['pending'];
    if (!removable.includes(offer.status)) {
      return res.status(409).json({ error: offer.status === 'accepted' ? 'Accepted offers cannot be removed while the shipment is in progress.' : 'Only pending offers can be withdrawn.' });
    }
    if (request.status === 'cancelled') return res.status(409).json({ error: 'This request was cancelled.' });
    request.offers.pull(req.params.offerId);
    // Only re-derive the status while the request is still collecting offers
    // (removing a declined offer must not reopen a shipment that is in progress).
    if (['open', 'offers_received'].includes(request.status)) {
      request.status = request.offers.some((item) => item.status === 'pending') ? 'offers_received' : 'open';
    }
    await request.save();
    return res.status(204).end();
  } catch (error) {
    return handleServerError(res, error);
  }
});

// The customer decides on offers for their own request:
//   pending  -> accepted | declined
//   declined -> pending   ("reconsider"), only while the request has no accepted offer.
// Administrators have read-only access to offers.
router.patch('/offers/:offerId/status', requireRole('customer'), async (req, res) => {
  const { status } = req.body || {};
  if (!['accepted', 'declined', 'pending'].includes(status)) return res.status(400).json({ error: 'Choose accepted, declined or pending.' });
  if (!validId(req.params.offerId)) return res.status(400).json({ error: 'Invalid offer id.' });
  if (mongoose.connection.readyState !== 1) return databaseUnavailable(res);

  try {
    const request = await ShippingRequest.findOne({ 'offers._id': req.params.offerId });
    if (!request) return res.status(404).json({ error: 'Offer not found.' });
    if (!request.customer.equals(req.user._id)) {
      return res.status(403).json({ error: 'Only the request owner can respond to this offer.' });
    }
    const offer = request.offers.id(req.params.offerId);
    if (request.status === 'cancelled') {
      return res.status(409).json({ error: 'This request was cancelled.' });
    }

    if (status === 'pending') {
      if (offer.status !== 'declined') return res.status(409).json({ error: 'Only declined offers can be reconsidered.' });
      if (!['open', 'offers_received'].includes(request.status) || request.offers.some((item) => item.status === 'accepted')) {
        return res.status(409).json({ error: 'You already accepted another offer for this request.' });
      }
      offer.status = 'pending';
      request.status = 'offers_received';
      await request.save();
      return res.json({ offer: { ...offer.toObject(), request: request.id }, requestStatus: request.status });
    }

    if (offer.status !== 'pending') {
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
    if (isCargoProvider(req.user) && !assignedProvider) return res.status(403).json({ error: 'Only the selected cargo provider can update this shipment.' });

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