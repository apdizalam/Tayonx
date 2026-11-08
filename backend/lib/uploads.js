const multer = require('multer');
const UploadedFile = require('../models/UploadedFile');

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const DOCUMENT_TYPES = [...IMAGE_TYPES, 'application/pdf'];

// Detect the real file type from its first bytes instead of trusting the browser.
function sniffMimeType(buffer) {
  if (!buffer || buffer.length < 12) return '';
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  if (buffer.toString('ascii', 0, 5) === '%PDF-') return 'application/pdf';
  return '';
}

/**
 * Multer middleware that keeps files in memory (we persist them to MongoDB ourselves)
 * and turns upload errors into clean 400 JSON responses.
 */
function acceptUploads(fieldNames) {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_BYTES, files: fieldNames.length, fields: 30 },
  }).fields(fieldNames.map((name) => ({ name, maxCount: 1 })));

  return (req, res, next) => {
    upload(req, res, (error) => {
      if (!error) return next();
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Each file must be 5 MB or smaller.', field: error.field });
      }
      if (error.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({ error: 'Unexpected file field in upload.', field: error.field });
      }
      if (error instanceof multer.MulterError) {
        return res.status(400).json({ error: 'The upload could not be read.' });
      }
      return next(error);
    });
  };
}

function uploadedFile(req, field) {
  return req.files?.[field]?.[0] || null;
}

/** Returns an error message if the file is not one of the allowed real types. */
function checkFileType(file, allowedTypes) {
  const realType = sniffMimeType(file.buffer);
  if (!realType || !allowedTypes.includes(realType)) {
    return allowedTypes.includes('application/pdf')
      ? 'Upload a JPG, PNG, WebP image or a PDF document.'
      : 'Upload a JPG, PNG or WebP image.';
  }
  return '';
}

async function saveUploadedFile(file, { owner, purpose }) {
  const stored = await UploadedFile.create({
    owner,
    purpose,
    originalName: String(file.originalname || '').slice(0, 200),
    mimeType: sniffMimeType(file.buffer),
    size: file.size,
    data: file.buffer,
  });
  return stored._id;
}

module.exports = {
  DOCUMENT_TYPES,
  IMAGE_TYPES,
  MAX_FILE_BYTES,
  acceptUploads,
  checkFileType,
  saveUploadedFile,
  uploadedFile,
};
