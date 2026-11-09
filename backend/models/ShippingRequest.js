const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema({
  provider: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  // All amounts in USD, calculated by the server (see lib/offerPricing.js):
  //   subtotal = quantityCount × unitPrice,  price (total offer price) = subtotal + deliveryFee.
  // Offers created before itemised pricing only have `price` (and possibly unitPrice/quantityCount).
  price: { type: Number, required: true, min: 0.01 },
  unitPrice: { type: Number, min: 0.01, default: null },
  quantityCount: { type: Number, min: 1, default: null },
  subtotal: { type: Number, min: 0.01, default: null },
  deliveryFee: { type: Number, min: 0, default: null },
  deliveryDays: { type: Number, required: true, min: 1, max: 365 },
  includes: { type: String, trim: true, maxlength: 500, default: '' },
  status: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending' },
}, { timestamps: true });

const shippingRequestSchema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  product: { type: String, required: true, trim: true, maxlength: 160 },
  sourceCountry: { type: String, required: true, trim: true, maxlength: 80 },
  destination: { type: String, required: true, trim: true, maxlength: 160 },
  quantity: { type: String, required: true, trim: true, maxlength: 100 },
  details: { type: String, trim: true, maxlength: 2000, default: '' },
  // "sea" = Ship (Maritime), "air" = Aircraft (Air freight). Older requests have none.
  deliveryMethod: { type: String, enum: ['sea', 'air', null], default: null },
  // Optional photo of the product, stored in UploadedFile (purpose "product_photo").
  productPhoto: { type: mongoose.Schema.Types.ObjectId, ref: 'UploadedFile', default: null },
  status: {
    type: String,
    enum: ['open', 'offers_received', 'in_progress', 'purchased', 'shipping', 'delivered', 'cancelled'],
    default: 'open',
    index: true,
  },
  // The verified cargo company/provider the customer chose for this request.
  // Requests without one (older requests) are open to verified providers in the source country.
  targetProvider: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  declinedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  offers: [offerSchema],
}, { timestamps: true });

module.exports = mongoose.models.ShippingRequest || mongoose.model('ShippingRequest', shippingRequestSchema);