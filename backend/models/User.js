const mongoose = require('mongoose');

const verificationSchema = new mongoose.Schema({
  status: { type: String, enum: ['unverified', 'pending', 'approved', 'rejected'], default: 'unverified' },
  submittedAt: { type: Date, default: null },
  reviewedAt: { type: Date, default: null },
  reviewNote: { type: String, trim: true, maxlength: 1000, default: '' },
}, { _id: false });

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ['customer', 'cargo_provider', 'individual_cargo', 'admin'], default: 'customer', required: true },
  country: { type: String, required: true, default: 'Somaliland' },
  phone: { type: String, trim: true, maxlength: 20, default: '' },
  profilePhoto: { type: mongoose.Schema.Types.ObjectId, ref: 'UploadedFile', default: null },
  verification: { type: verificationSchema, default: () => ({}) },
}, { timestamps: true });

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
