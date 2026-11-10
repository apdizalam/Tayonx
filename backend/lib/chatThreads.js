const ChatThreadState = require('../models/ChatThreadState');

/**
 * Re-open *closed* chat threads between a customer and a cargo provider when there is a relevant
 * update between them (a direct request, an offer, an offer decision or a shipment status change).
 *
 * Only closed threads come back: a thread the user deleted (clearedAt at or after hiddenAt) stays
 * deleted until a new message is sent. Messages are never touched. When anything was restored,
 * both users get a `chat_threads_changed` socket event so an open chat list refreshes at once.
 * Failures are logged and never break the request that triggered them.
 */
async function restoreClosedThreads(app, firstUserId, secondUserId) {
  if (!firstUserId || !secondUserId || String(firstUserId) === String(secondUserId)) return;
  try {
    const result = await ChatThreadState.updateMany(
      {
        $or: [
          { user: firstUserId, contact: secondUserId },
          { user: secondUserId, contact: firstUserId },
        ],
        hiddenAt: { $ne: null },
        // null / missing clearedAt sorts below any date, so never-deleted threads match too.
        $expr: { $lt: ['$clearedAt', '$hiddenAt'] },
      },
      { $set: { hiddenAt: null } },
    );
    if (result.modifiedCount) {
      app?.get?.('io')?.to(`user:${firstUserId}`).to(`user:${secondUserId}`).emit('chat_threads_changed');
    }
  } catch (error) {
    console.error('Chat thread restore error:', error);
  }
}

module.exports = { restoreClosedThreads };
