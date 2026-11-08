const mongoose = require('mongoose');

const fileRef = { type: mongoose.Schema.Types.ObjectId, ref: 'UploadedFile', default: null };

const verificationRequestSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  accountType: { type: String, enum: ['cargo_provider', 'individual_cargo'], required: true },
  documents: {
    businessLicense: fileRef,
    idDocument: fileRef,
    companyLegalDocument: fileRef,
  },
  // Personal details (individual cargo) or contact person details (cargo company).
  details: {
    legalName: { type: String, trim: true, maxlength: 100, default: '' },
    idNumber: { type: String, trim: true, maxlength: 50, default: '' },
    dateOfBirth: { type: Date, default: null },
    address: { type: String, trim: true, maxlength: 200, default: '' },
    registrationNumber: { type: String, trim: true, maxlength: 60, default: '' },
  },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
  reviewNote: { type: String, trim: true, maxlength: 1000, default: '' },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt: { type: Date, default: null },
}, { timestamps: true });

verificationRequestSchema.index({ createdAt: -1 });

module.exports = mongoose.models.VerificationRequest || mongoose.model('VerificationRequest', verificationRequestSchema);
