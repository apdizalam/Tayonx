const express = require('express');
const mongoose = require('mongoose');
const Chat = require('../models/Chat');
const ChatReport = require('../models/ChatReport');
const ShippingRequest = require('../models/ShippingRequest');
const User = require('../models/User');
const { authenticate } = require('../middleware/authenticate');

const router = express.Router();
const historyLimit = 200;

router.use(authenticate);

function databaseUnavailable(res) {
  return res.status(503).json({ error: 'The chat service is unavailable.' });
}

const CARGO_ROLES = ['cargo_provider', 'individual_cargo'];

// A customer and a cargo provider may only chat when they have real, current business:
//  - the provider's offer was accepted (shipment in progress or completed — after-sales support), or
//  - the provider has a pending offer on a request that is still open for offers, or
//  - the customer sent the request directly to this provider, it is still open for offers, and
//    neither side has declined (customer declined their offer / provider declined the request).
// Declined offers, declined or cancelled requests no longer qualify. Admins can chat with anyone.
// `businessFilter` (MongoDB) and `hasBusiness` (in memory) must stay in sync.
const OPEN_STATUSES = ['open', 'offers_received'];

function businessFilter(providerId) {
  return [
    { offers: { $elemMatch: { provider: providerId, status: 'accepted' } } },
    { offers: { $elemMatch: { provider: providerId, status: 'pending' } }, status: { $in: OPEN_STATUSES } },
    {
      targetProvider: providerId,
      status: { $in: OPEN_STATUSES },
      declinedBy: { $ne: providerId },
      offers: { $not: { $elemMatch: { provider: providerId, status: 'declined' } } },
    },
  ];
}

function hasBusiness(request, providerId) {
  const id = String(providerId);
  const offer = (request.offers || []).find((item) => String(item.provider) === id);
  if (offer?.status === 'accepted') return true;
  const open = OPEN_STATUSES.includes(request.status);
  if (offer?.status === 'pending' && open) return true;
  return String(request.targetProvider || '') === id && open
    && !(request.declinedBy || []).some((declined) => String(declined) === id)
    && offer?.status !== 'declined';
}

async function canChatBetween(firstUser, secondUser) {
  if (firstUser.role === 'admin' || secondUser.role === 'admin') return true;
  const customer = [firstUser, secondUser].find((user) => user.role === 'customer');
  const provider = [firstUser, secondUser].find((user) => CARGO_ROLES.includes(user.role));
  if (!customer || !provider) return false; // customer↔customer and provider↔provider are never allowed
  return Boolean(await ShippingRequest.exists({ customer: customer._id, $or: businessFilter(provider._id) }));
}

/** Ids of the providers (for a customer) or customers (for a provider) the user may chat with. */
async function businessCounterpartIds(user) {
  const ids = new Set();
  if (user.role === 'customer') {
    const requests = await ShippingRequest.find({ customer: user._id })
      .select('status targetProvider declinedBy offers.provider offers.status').lean();
    for (const request of requests) {
      const candidates = [request.targetProvider, ...(request.offers || []).map((offer) => offer.provider)].filter(Boolean);
      for (const providerId of candidates) if (hasBusiness(request, providerId)) ids.add(String(providerId));
    }
  } else if (CARGO_ROLES.includes(user.role)) {
    const requests = await ShippingRequest.find({ $or: businessFilter(user._id) }).select('customer').lean();
    for (const request of requests) ids.add(String(request.customer));
  }
  return ids;
}

function publicContact(user, lastMessage) {
  return {
    id: user.id,
    name: user.name,
    role: user.role,
    country: user.country,
    lastMessage: lastMessage || null,
  };
}

function publicMessage(message) {
  return {
    id: message.id,
    sender: message.sender?._id ? {
      id: message.sender.id,
      name: message.sender.name,
    } : String(message.sender),
    recipient: message.recipient?._id ? {
      id: message.recipient.id,
      name: message.recipient.name,
    } : String(message.recipient),
    text: message.text,
    createdAt: message.createdAt,
  };
}

router.get('/contacts', async (req, res) => {
  if (mongoose.connection.readyState !== 1) return databaseUnavailable(res);

  try {
    if (req.user.role === 'admin') {
      const users = await User.find({ _id: { $ne: req.user._id } }).select('name role country');
      return res.json({
        contacts: users.map((contact) => publicContact(contact, null))
          .sort((first, second) => first.name.localeCompare(second.name)),
      });
    }

    // Same rule as canChatBetween: only counterparties with current business, plus support admins.
    const ids = await businessCounterpartIds(req.user);

    const supportAdmins = await User.find({ role: 'admin', _id: { $ne: req.user._id } }).select('_id');
    const contactIds = [...new Set([...ids, ...supportAdmins.map((admin) => String(admin._id))])];
    if (!contactIds.length) return res.json({ contacts: [] });

    const [users, recentMessages] = await Promise.all([
      User.find({ _id: { $in: contactIds } }).select('name role country'),
      Chat.aggregate([
        { $match: { $or: [{ sender: req.user._id }, { recipient: req.user._id }] } },
        {
          $addFields: {
            contactId: {
              $cond: [{ $eq: ['$sender', req.user._id] }, '$recipient', '$sender'],
            },
          },
        },
        { $sort: { createdAt: -1 } },
        {
          $group: {
            _id: '$contactId',
            lastMessage: { $first: { text: '$text', createdAt: '$createdAt' } },
          },
        },
      ]),
    ]);
    const messagesByContact = new Map(recentMessages.map((entry) => [String(entry._id), entry.lastMessage]));
    const contacts = users.map((contact) => publicContact(contact, messagesByContact.get(String(contact._id))))
      .sort((first, second) => {
        const firstDate = new Date(first.lastMessage?.createdAt || 0).getTime();
        const secondDate = new Date(second.lastMessage?.createdAt || 0).getTime();
        return secondDate - firstDate || first.name.localeCompare(second.name);
      });
    return res.json({ contacts });
  } catch (error) {
    console.error('Chat contacts error:', error);
    return res.status(500).json({ error: 'Chat contacts could not be loaded.' });
  }
});

router.post('/:userId/report', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.userId)) {
    return res.status(400).json({ error: 'Invalid conversation user id.' });
  }
  if (String(req.user._id) === req.params.userId || req.user.role === 'admin') {
    return res.status(400).json({ error: 'This account cannot report that conversation.' });
  }
  if (mongoose.connection.readyState !== 1) return databaseUnavailable(res);
  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
  const allowedReasons = ['harassment', 'spam', 'fraud', 'inappropriate', 'other'];
  const reason = typeof body.reason === 'string' ? body.reason : '';
  const details = typeof body.details === 'string' ? body.details.trim() : '';
  const messageId = typeof body.messageId === 'string' ? body.messageId : '';
  if (!allowedReasons.includes(reason)) {
    return res.status(400).json({ error: `Choose a valid report reason: ${allowedReasons.join(', ')}.` });
  }
  if (details.length > 2000) {
    return res.status(400).json({ error: 'Report details must be 2,000 characters or fewer.' });
  }
  if (messageId && !mongoose.isValidObjectId(messageId)) {
    return res.status(400).json({ error: 'Invalid reported message id.' });
  }

  try {
    const reportedUser = await User.findById(req.params.userId).select('name role');
    if (!reportedUser) return res.status(404).json({ error: 'Conversation user not found.' });
    // Users can report anyone they may chat with, or anyone they have already exchanged messages
    // with (even if the business has since ended).
    const talkedBefore = await Chat.exists({
      $or: [
        { sender: req.user._id, recipient: reportedUser._id },
        { sender: reportedUser._id, recipient: req.user._id },
      ],
    });
    if (!talkedBefore && !await canChatBetween(req.user, reportedUser)) {
      return res.status(403).json({ error: 'You can only report a permitted chat conversation.' });
    }

    let reportedMessage = null;
    if (messageId) {
      reportedMessage = await Chat.findOne({
        _id: messageId,
        $or: [
          { sender: req.user._id, recipient: reportedUser._id },
          { sender: reportedUser._id, recipient: req.user._id },
        ],
      }).select('_id');
      if (!reportedMessage) return res.status(404).json({ error: 'Reported message not found in this conversation.' });
    }
    if (await ChatReport.exists({ reporter: req.user._id, reportedUser: reportedUser._id, status: 'open' })) {
      return res.status(409).json({ error: 'You already have an open report for this conversation.' });
    }

    const report = await ChatReport.create({
      reporter: req.user._id,
      reportedUser: reportedUser._id,
      message: reportedMessage?._id || null,
      reason,
      details,
    });
    return res.status(201).json({ report: { id: report.id, status: report.status, createdAt: report.createdAt } });
  } catch (error) {
    console.error('Chat report creation error:', error);
    return res.status(500).json({ error: 'The chat report could not be submitted.' });
  }
});

router.get('/:userId', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.userId)) {
    return res.status(400).json({ error: 'Invalid conversation user id.' });
  }
  if (String(req.user._id) === req.params.userId) {
    return res.status(400).json({ error: 'You cannot open a conversation with yourself.' });
  }
  if (mongoose.connection.readyState !== 1) return databaseUnavailable(res);

  try {
    const contact = await User.findById(req.params.userId).select('name role country');
    if (!contact) return res.status(404).json({ error: 'Conversation user not found.' });
    if (!await canChatBetween(req.user, contact)) {
      return res.status(403).json({ error: 'You can only message customers or cargo providers you are currently doing business with, or an administrator.' });
    }

    const messages = await Chat.find({
      $or: [
        { sender: req.user._id, recipient: contact._id },
        { sender: contact._id, recipient: req.user._id },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(historyLimit)
      .populate('sender', 'name')
      .populate('recipient', 'name');
    return res.json({
      contact: publicContact(contact, null),
      messages: messages.reverse().map(publicMessage),
    });
  } catch (error) {
    console.error('Chat history error:', error);
    return res.status(500).json({ error: 'Chat history could not be loaded.' });
  }
});

module.exports = { router, canChatBetween, publicMessage, databaseUnavailable };
