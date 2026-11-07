const mongoose = require('mongoose');

const chatReportSchema = new mongoose.Schema({
  reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  reportedUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  message: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat', default: null },
  reason: {
    type: String,
    enum: ['harassment', 'spam', 'fraud', 'inappropriate', 'other'],
    required: true,
  },
  details: { type: String, trim: true, maxlength: 2000, default: '' },
  status: {
    type: String,
    enum: ['open', 'reviewed', 'resolved', 'dismissed'],
    default: 'open',
    index: true,
  },
  resolutionNote: { type: String, trim: true, maxlength: 1000, default: '' },
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

chatReportSchema.index({ reporter: 1, reportedUser: 1, status: 1 });
chatReportSchema.index({ createdAt: -1 });

module.exports = mongoose.models.ChatReport || mongoose.model('ChatReport', chatReportSchema);
