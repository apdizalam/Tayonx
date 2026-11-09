const express = require('express');
const mongoose = require('mongoose');
const User = require('../models/User');
const UploadedFile = require('../models/UploadedFile');
const VerificationRequest = require('../models/VerificationRequest');
const publicUser = require('../lib/publicUser');
const { requestSummary, documentPopulate } = require('../lib/verificationSummary');
const { authenticate, requireRole } = require('../middleware/authenticate');
const { CARGO_ROLES, cleanString } = require('../constants/accounts');
const {
  DOCUMENT_TYPES,
  acceptUploads,
  checkFileType,
  saveUploadedFile,
  uploadedFile,
} = require('../lib/uploads');

const router = express.Router();
router.use(authenticate);

const REVIEW_MESSAGE = 'Your details are under review. Please wait up to 24 hours for verification or feedback.';

// Which documents each account type must upload, mapped to their stored purpose.
const REQUIRED_DOCUMENTS = {
  cargo_provider: [
    ['businessLicense', 'business_license', 'Business license'],
    ['idDocument', 'id_document', 'ID or passport photo'],
    ['companyLegalDocument', 'company_legal_document', 'Company legal document'],
  ],
  individual_cargo: [
    ['idDocument', 'id_document', 'Legal ID or passport photo'],
  ],
};

function databaseUnavailable(res) {
  return res.status(503).json({ error: 'The verification service is unavailable.' });
}

function emitToAdmins(req, event, payload) {
  req.app.get('io')?.to('admins').emit(event, payload);
}

function validateDetails(body, accountType) {
  const details = {
    legalName: cleanString(body.legalName),
    idNumber: cleanString(body.idNumber),
    address: cleanString(body.address),
    registrationNumber: cleanString(body.registrationNumber),
    dateOfBirth: null,
  };
  if (details.legalName.length > 100) return { error: 'Legal name must be 100 characters or fewer.', field: 'legalName' };
  if (details.idNumber.length > 50) return { error: 'ID number must be 50 characters or fewer.', field: 'idNumber' };
  if (details.address.length > 200) return { error: 'Address must be 200 characters or fewer.', field: 'address' };
  if (details.registrationNumber.length > 60) return { error: 'Registration number must be 60 characters or fewer.', field: 'registrationNumber' };

  if (accountType === 'individual_cargo') {
    if (details.legalName.split(' ').filter(Boolean).length < 3) {
      return { error: 'Enter your full legal name exactly as on your ID (three names).', field: 'legalName' };
    }
    if (!/^[A-Za-z0-9-]{4,50}$/.test(details.idNumber)) {
      return { error: 'Enter your ID or passport number (letters, numbers and dashes).', field: 'idNumber' };
    }
    const birthDate = new Date(cleanString(body.dateOfBirth));
    const ageMs = Date.now() - birthDate.getTime();
    const age = ageMs / (365.25 * 24 * 60 * 60 * 1000);
    if (Number.isNaN(birthDate.getTime()) || age < 18 || age > 100) {
      return { error: 'Enter a valid date of birth (you must be at least 18).', field: 'dateOfBirth' };
    }
    details.dateOfBirth = birthDate;
    if (details.address.length < 5) {
      return { error: 'Enter your current address (city and district).', field: 'address' };
    }
  } else if (details.legalName && details.legalName.split(' ').filter(Boolean).length < 2) {
    return { error: 'Enter the contact person’s full name.', field: 'legalName' };
  }
  return { details };
}

// ---- Cargo accounts: read and submit their own verification ----

router.get('/me', requireRole(...CARGO_ROLES), async (req, res) => {
  if (mongoose.connection.readyState !== 1) return databaseUnavailable(res);
  try {
    const user = await User.findById(req.user._id);
    const latest = await VerificationRequest.findOne({ user: req.user._id }).sort({ createdAt: -1 }).populate(documentPopulate);
    return res.json({
      verification: publicUser(user).verification,
      request: latest ? requestSummary(latest) : null,
      requiredDocuments: REQUIRED_DOCUMENTS[user.role].map(([field, , label]) => ({ field, label })),
    });
  } catch (error) {
    console.error('Verification read error:', error);
    return res.status(500).json({ error: 'Verification status could not be loaded.' });
  }
});

router.post(
  '/',
  requireRole(...CARGO_ROLES),
  acceptUploads(['businessLicense', 'idDocument', 'companyLegalDocument']),
  async (req, res) => {
    if (mongoose.connection.readyState !== 1) return databaseUnavailable(res);
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const accountType = req.user.role;
    const required = REQUIRED_DOCUMENTS[accountType];

    for (const [field, , label] of required) {
      const file = uploadedFile(req, field);
      if (!file) return res.status(400).json({ error: `${label} is required.`, field });
      const typeError = checkFileType(file, DOCUMENT_TYPES);
      if (typeError) return res.status(400).json({ error: `${label}: ${typeError}`, field });
    }
    const unexpected = Object.keys(req.files || {}).find((field) => !required.some(([name]) => name === field));
    if (unexpected) return res.status(400).json({ error: 'This document is not needed for your account type.', field: unexpected });

    const { details, error, field } = validateDetails(body, accountType);
    if (error) return res.status(400).json({ error, field });

    const savedFiles = [];
    try {
      const user = await User.findById(req.user._id);
      if (user.verification?.status === 'pending') {
        return res.status(409).json({ error: REVIEW_MESSAGE });
      }
      if (user.verification?.status === 'approved') {
        return res.status(409).json({ error: 'Your account is already verified.' });
      }

      const documents = {};
      for (const [fieldName, purpose] of required) {
        const id = await saveUploadedFile(uploadedFile(req, fieldName), { owner: user._id, purpose });
        savedFiles.push(id);
        documents[fieldName] = id;
      }
      const request = await VerificationRequest.create({ user: user._id, accountType, documents, details });
      user.verification = { status: 'pending', submittedAt: request.createdAt, reviewedAt: null, reviewNote: '' };
      await user.save();

      await request.populate([{ path: 'user' }, ...documentPopulate]);
      const summary = requestSummary(request);
      emitToAdmins(req, 'verification_submitted', summary);
      return res.status(201).json({ message: REVIEW_MESSAGE, verification: publicUser(user).verification, request: summary });
    } catch (error) {
      if (savedFiles.length) await UploadedFile.deleteMany({ _id: { $in: savedFiles } }).catch(() => {});
      console.error('Verification submit error:', error);
      return res.status(500).json({ error: 'Your documents could not be submitted. Please try again.' });
    }
  },
);

// ---- Administrators: review requests ----

router.get('/requests', requireRole('admin'), async (req, res) => {
  if (mongoose.connection.readyState !== 1) return databaseUnavailable(res);
  const status = typeof req.query.status === 'string' ? req.query.status : 'all';
  if (!['pending', 'approved', 'rejected', 'all'].includes(status)) {
    return res.status(400).json({ error: 'Choose a valid status filter.' });
  }
  try {
    const filter = status === 'all' ? {} : { status };
    const [requests, pendingCount] = await Promise.all([
      VerificationRequest.find(filter).sort({ createdAt: -1 }).limit(200).populate([{ path: 'user' }, ...documentPopulate]),
      VerificationRequest.countDocuments({ status: 'pending' }),
    ]);
    return res.json({ requests: requests.map(requestSummary), pendingCount });
  } catch (error) {
    console.error('Verification list error:', error);
    return res.status(500).json({ error: 'Verification requests could not be loaded.' });
  }
});

router.patch('/requests/:id', requireRole('admin'), async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid verification request id.' });
  if (mongoose.connection.readyState !== 1) return databaseUnavailable(res);
  const decision = typeof req.body?.decision === 'string' ? req.body.decision : '';
  const note = cleanString(req.body?.note);
  if (!['approved', 'rejected'].includes(decision)) {
    return res.status(400).json({ error: 'Choose approve or reject.', field: 'decision' });
  }
  if (decision === 'rejected' && note.length < 5) {
    return res.status(400).json({ error: 'Explain what the user needs to fix (at least 5 characters).', field: 'note' });
  }
  if (note.length > 1000) return res.status(400).json({ error: 'Feedback must be 1,000 characters or fewer.', field: 'note' });

  try {
    const request = await VerificationRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ error: 'Verification request not found.' });
    if (request.status !== 'pending') {
      return res.status(409).json({ error: `This request was already ${request.status}.` });
    }
    const user = await User.findById(request.user);
    if (!user) return res.status(404).json({ error: 'The account for this request no longer exists.' });

    const reviewedAt = new Date();
    Object.assign(request, { status: decision, reviewNote: note, reviewedBy: req.user._id, reviewedAt });
    await request.save();
    user.verification = { status: decision, submittedAt: user.verification?.submittedAt || request.createdAt, reviewedAt, reviewNote: note };
    await user.save();

    await request.populate([{ path: 'user' }, ...documentPopulate]);
    const summary = requestSummary(request);
    const io = req.app.get('io');
    io?.to(`user:${user.id}`).emit('verification_reviewed', { verification: publicUser(user).verification });
    emitToAdmins(req, 'verification_updated', summary);
    return res.json({ request: summary });
  } catch (error) {
    console.error('Verification review error:', error);
    return res.status(500).json({ error: 'The review could not be saved.' });
  }
});

module.exports = router;
