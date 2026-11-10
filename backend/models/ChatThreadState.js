const mongoose = require('mongoose');

// Per-user view state of one chat thread (user ↔ contact). Only affects what *this* user sees:
//  - hiddenAt  ("Close chat"): the thread is hidden from the user's list until a newer message
//               arrives or the user opens it again.
//  - clearedAt ("Delete chat"): messages up to this time are no longer shown to this user.
// The messages themselves are never deleted, so the other participant keeps their history and
// administrators can still review reported conversations.
const chatThreadStateSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  contact: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  hiddenAt: { type: Date, default: null },
  clearedAt: { type: Date, default: null },
}, { timestamps: true });

chatThreadStateSchema.index({ user: 1, contact: 1 }, { unique: true });

module.exports = mongoose.models.ChatThreadState || mongoose.model('ChatThreadState', chatThreadStateSchema);
