const express = require('express');
const mongoose = require('mongoose');
const Chat = require('../models/Chat');
const ShippingRequest = require('../models/ShippingRequest');
const User = require('../models/User');
const { authenticate } = require('../middleware/authenticate');

const router = express.Router();
const historyLimit = 200;

router.use(authenticate);

function databaseUnavailable(res) {
  return res.status(503).json({ error: 'The chat service is unavailable.' });
}

async function canChatBetween(firstUser, secondUser) {
  if (firstUser.role === 'admin' || secondUser.role === 'admin') return true;
  return Boolean(await ShippingRequest.exists({
    $or: [
      { customer: firstUser._id, 'offers.provider': secondUser._id },
      { customer: secondUser._id, 'offers.provider': firstUser._id },
    ],
  }));
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

    const requests = await ShippingRequest.find({
      $or: [
        { customer: req.user._id },
        { 'offers.provider': req.user._id },
      ],
    }).select('customer offers.provider').lean();
    const ids = new Set();
    for (const request of requests) {
      if (String(request.customer) === String(req.user._id)) {
        for (const offer of request.offers || []) ids.add(String(offer.provider));
      } else {
        ids.add(String(request.customer));
      }
    }

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
      return res.status(403).json({ error: 'You can only message shipment counterparties or an administrator.' });
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
