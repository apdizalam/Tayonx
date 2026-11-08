const express = require('express');
const mongoose = require('mongoose');
const Chat = require('../models/Chat');
const ChatReport = require('../models/ChatReport');
const PlatformSettings = require('../models/PlatformSettings');
const User = require('../models/User');
const { authenticate, requireRole } = require('../middleware/authenticate');

const router = express.Router();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const defaultSettings = {
  key: 'platform',
  siteName: 'Tayonx',
  supportEmail: 'support@tayonx.com',
  systemNotifications: true,
  platformFeeRate: 0,
};
const reportStatuses = ['open', 'reviewed', 'resolved', 'dismissed'];

router.use(authenticate, requireRole('admin'));

function databaseUnavailable(res) {
  return res.status(503).json({ error: 'The admin service is unavailable.' });
}

function handleAdminError(res, error, context) {
  console.error(`${context}:`, error);
  return res.status(500).json({ error: 'The requested admin data could not be processed.' });
}

function publicSettings(settings) {
  return {
    siteName: settings.siteName,
    supportEmail: settings.supportEmail,
    systemNotifications: settings.systemNotifications,
    platformFeeRate: settings.platformFeeRate,
    updatedAt: settings.updatedAt,
  };
}

function participant(userId, usersById) {
  const user = usersById.get(String(userId));
  return user ? { id: String(user._id || user.id), name: user.name, role: user.role } : { id: String(userId), name: 'Deleted user', role: 'unknown' };
}

function publicReport(report) {
  const publicUser = (user) => user ? {
    id: String(user._id || user.id),
    name: user.name,
    role: user.role,
  } : null;
  return {
    id: String(report._id || report.id),
    reporter: publicUser(report.reporter),
    reportedUser: publicUser(report.reportedUser),
    message: report.message ? {
      id: String(report.message._id || report.message.id),
      text: report.message.text,
      createdAt: report.message.createdAt,
    } : null,
    reason: report.reason,
    details: report.details,
    status: report.status,
    resolutionNote: report.resolutionNote,
    resolvedBy: report.resolvedBy ? { id: String(report.resolvedBy._id || report.resolvedBy.id), name: report.resolvedBy.name } : null,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
  };
}

router.get('/chats', async (req, res) => {
  if (mongoose.connection.readyState !== 1) return databaseUnavailable(res);

  try {
    const [conversationGroups, reports] = await Promise.all([
      Chat.aggregate([
        { $sort: { createdAt: -1 } },
        {
          $addFields: {
            conversationKey: {
              $cond: [
                { $lt: ['$sender', '$recipient'] },
                { $concat: [{ $toString: '$sender' }, ':', { $toString: '$recipient' }] },
                { $concat: [{ $toString: '$recipient' }, ':', { $toString: '$sender' }] },
              ],
            },
            participantIds: { $setUnion: [['$sender'], ['$recipient']] },
          },
        },
        {
          $group: {
            _id: '$conversationKey',
            participantIds: { $first: '$participantIds' },
            lastMessage: { $first: { id: '$_id', sender: '$sender', text: '$text', createdAt: '$createdAt' } },
            messageCount: { $sum: 1 },
          },
        },
        { $sort: { 'lastMessage.createdAt': -1 } },
        {
          $lookup: {
            from: User.collection.name,
            localField: 'participantIds',
            foreignField: '_id',
            as: 'participants',
            pipeline: [{ $project: { name: 1, role: 1 } }],
          },
        },
        { $project: { _id: 0, id: '$_id', participantIds: 1, participants: 1, lastMessage: 1, messageCount: 1 } },
      ]),
      ChatReport.find()
        .sort({ status: 1, createdAt: -1 })
        .populate('reporter', 'name role')
        .populate('reportedUser', 'name role')
        .populate('message', 'text createdAt sender recipient')
        .populate('resolvedBy', 'name')
        .lean(),
    ]);

    const conversations = conversationGroups.map((conversation) => {
      const usersById = new Map(conversation.participants.map((user) => [String(user._id), user]));
      return {
        id: conversation.id,
        participants: conversation.participantIds.map((id) => participant(id, usersById)),
        lastMessage: {
          id: String(conversation.lastMessage.id),
          senderId: String(conversation.lastMessage.sender),
          text: conversation.lastMessage.text,
          createdAt: conversation.lastMessage.createdAt,
        },
        messageCount: conversation.messageCount,
      };
    });
    return res.json({ conversations, reports: reports.map(publicReport) });
  } catch (error) {
    return handleAdminError(res, error, 'Admin chat list error');
  }
});

router.get('/chats/conversations/:firstUserId/:secondUserId', async (req, res) => {
  const { firstUserId, secondUserId } = req.params;
  if (!mongoose.isValidObjectId(firstUserId) || !mongoose.isValidObjectId(secondUserId)) {
    return res.status(400).json({ error: 'Invalid conversation user id.' });
  }
  if (firstUserId === secondUserId) {
    return res.status(400).json({ error: 'Choose two different conversation users.' });
  }
  if (mongoose.connection.readyState !== 1) return databaseUnavailable(res);

  try {
    const participants = await User.find({ _id: { $in: [firstUserId, secondUserId] } }).select('name role country');
    if (participants.length !== 2) return res.status(404).json({ error: 'Conversation user not found.' });
    const messages = await Chat.find({
      $or: [
        { sender: firstUserId, recipient: secondUserId },
        { sender: secondUserId, recipient: firstUserId },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(200)
      .populate('sender', 'name role')
      .populate('recipient', 'name role');
    return res.json({
      participants: participants.map((user) => ({ id: user.id, name: user.name, role: user.role })),
      messages: messages.reverse().map((message) => ({
        id: message.id,
        sender: message.sender ? { id: message.sender.id, name: message.sender.name, role: message.sender.role } : null,
        recipient: message.recipient ? { id: message.recipient.id, name: message.recipient.name, role: message.recipient.role } : null,
        text: message.text,
        createdAt: message.createdAt,
      })),
    });
  } catch (error) {
    return handleAdminError(res, error, 'Admin conversation inspection error');
  }
});

router.patch('/chats/reports/:reportId', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.reportId)) {
    return res.status(400).json({ error: 'Invalid report id.' });
  }
  if (mongoose.connection.readyState !== 1) return databaseUnavailable(res);
  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
  const status = typeof body.status === 'string' ? body.status : '';
  const resolutionNote = typeof body.resolutionNote === 'string' ? body.resolutionNote.trim() : '';
  if (!reportStatuses.includes(status)) {
    return res.status(400).json({ error: `Choose a valid report status: ${reportStatuses.join(', ')}.` });
  }
  if (resolutionNote.length > 1000) {
    return res.status(400).json({ error: 'Resolution note must be 1,000 characters or fewer.' });
  }

  try {
    const report = await ChatReport.findById(req.params.reportId);
    if (!report) return res.status(404).json({ error: 'Report not found.' });
    report.status = status;
    report.resolutionNote = resolutionNote;
    report.resolvedBy = ['resolved', 'dismissed'].includes(status) ? req.user._id : null;
    await report.save();
    await report.populate([
      { path: 'reporter', select: 'name role' },
      { path: 'reportedUser', select: 'name role' },
      { path: 'message', select: 'text createdAt sender recipient' },
      { path: 'resolvedBy', select: 'name' },
    ]);
    return res.json({ report: publicReport(report) });
  } catch (error) {
    return handleAdminError(res, error, 'Chat report moderation error');
  }
});

router.get('/settings', async (req, res) => {
  if (mongoose.connection.readyState !== 1) return databaseUnavailable(res);
  try {
    const settings = await PlatformSettings.findOneAndUpdate(
      { key: 'platform' },
      { $setOnInsert: defaultSettings },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true, runValidators: true },
    );
    return res.json({ settings: publicSettings(settings) });
  } catch (error) {
    return handleAdminError(res, error, 'Admin settings read error');
  }
});

router.put('/settings', async (req, res) => {
  if (mongoose.connection.readyState !== 1) return databaseUnavailable(res);
  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
  const siteName = typeof body.siteName === 'string' ? body.siteName.trim() : '';
  const supportEmail = typeof body.supportEmail === 'string' ? body.supportEmail.trim().toLowerCase() : '';
  const feeRateInput = body.platformFeeRate;
  const platformFeeRate = Number(feeRateInput);
  if (!siteName || siteName.length > 100) {
    return res.status(400).json({ error: 'Site name is required and must be 100 characters or fewer.' });
  }
  if (!emailPattern.test(supportEmail) || supportEmail.length > 254) {
    return res.status(400).json({ error: 'Enter a valid support email address.' });
  }
  if (typeof body.systemNotifications !== 'boolean') {
    return res.status(400).json({ error: 'System notifications must be enabled or disabled.' });
  }
  if ((typeof feeRateInput !== 'number' && (typeof feeRateInput !== 'string' || !feeRateInput.trim()))
    || !Number.isFinite(platformFeeRate) || platformFeeRate < 0 || platformFeeRate > 100) {
    return res.status(400).json({ error: 'Platform fee rate must be a number between 0 and 100.' });
  }

  try {
    const settings = await PlatformSettings.findOneAndUpdate(
      { key: 'platform' },
      {
        $set: { siteName, supportEmail, systemNotifications: body.systemNotifications, platformFeeRate },
        $setOnInsert: { key: 'platform' },
      },
      { upsert: true, returnDocument: 'after', runValidators: true },
    );
    return res.json({ settings: publicSettings(settings) });
  } catch (error) {
    return handleAdminError(res, error, 'Admin settings update error');
  }
});

module.exports = router;
