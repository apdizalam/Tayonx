const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ['customer', 'cargo_provider', 'individual_cargo', 'admin'], default: 'customer', required: true },
  country: { type: String, required: true, default: 'Somaliland' },
}, { timestamps: true });

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
