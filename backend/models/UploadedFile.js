const mongoose = require('mongoose');

// Small uploaded files (profile photos, product photos, verification documents) stored in MongoDB.
// Each file is at most 5 MB, well under MongoDB's 16 MB document limit.
const uploadedFileSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  purpose: {
    type: String,
    enum: ['profile_photo', 'product_photo', 'business_license', 'id_document', 'company_legal_document'],
    required: true,
  },
  originalName: { type: String, trim: true, maxlength: 200, default: '' },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true },
  data: { type: Buffer, required: true, select: false },
}, { timestamps: true });

module.exports = mongoose.models.UploadedFile || mongoose.model('UploadedFile', uploadedFileSchema);
