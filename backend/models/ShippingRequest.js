const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema({
  provider: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  price: { type: Number, required: true, min: 0.01 },
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
  status: {
    type: String,
    enum: ['open', 'offers_received', 'in_progress', 'purchased', 'shipping', 'delivered', 'cancelled'],
    default: 'open',
    index: true,
  },
  declinedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  offers: [offerSchema],
}, { timestamps: true });

module.exports = mongoose.models.ShippingRequest || mongoose.model('ShippingRequest', shippingRequestSchema);