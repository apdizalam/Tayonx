const express = require('express');
const mongoose = require('mongoose');
const UploadedFile = require('../models/UploadedFile');
const { authenticate } = require('../middleware/authenticate');

const router = express.Router();
router.use(authenticate);

// Streams an uploaded file. Profile and product photos are visible to any signed-in user;
// verification documents only to their owner and administrators.
router.get('/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid file id.' });
  if (mongoose.connection.readyState !== 1) return res.status(503).json({ error: 'The file service is unavailable.' });

  try {
    const file = await UploadedFile.findById(req.params.id).select('+data');
    if (!file) return res.status(404).json({ error: 'File not found.' });

    const isOwner = file.owner && file.owner.equals(req.user._id);
    const isAdmin = req.user.role === 'admin';
    // Profile and product photos are shown to other signed-in users (e.g. cargo providers quoting a request).
    const publicPurpose = ['profile_photo', 'product_photo'].includes(file.purpose);
    if (!publicPurpose && !isOwner && !isAdmin) {
      return res.status(403).json({ error: 'You do not have permission to view this file.' });
    }

    const safeName = (file.originalName || 'file').replace(/[^\w.-]+/g, '_').slice(0, 120);
    res.set({
      'Content-Type': file.mimeType,
      'Content-Length': String(file.data.length),
      'Content-Disposition': `inline; filename="${safeName}"`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, max-age=300',
    });
    return res.send(file.data);
  } catch (error) {
    console.error('File download error:', error);
    return res.status(500).json({ error: 'The file could not be loaded.' });
  }
});

module.exports = router;
