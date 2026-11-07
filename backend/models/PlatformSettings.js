const mongoose = require('mongoose');

const platformSettingsSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, default: 'platform' },
  siteName: { type: String, required: true, trim: true, maxlength: 100, default: 'Tayonx' },
  supportEmail: { type: String, required: true, trim: true, lowercase: true, maxlength: 254, default: 'support@tayonx.com' },
  systemNotifications: { type: Boolean, required: true, default: true },
  platformFeeRate: { type: Number, required: true, min: 0, max: 100, default: 0 },
}, { timestamps: true });

module.exports = mongoose.models.PlatformSettings || mongoose.model('PlatformSettings', platformSettingsSchema);
