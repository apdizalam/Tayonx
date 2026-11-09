const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Chat = require('./models/Chat');
const User = require('./models/User');
const { canChatBetween, publicMessage } = require('./routes/chats');

function registerChatSocket(io) {
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) return next(new Error('Authentication is not configured.'));
    if (typeof token !== 'string' || !token) return next(new Error('Authentication is required.'));
    if (mongoose.connection.readyState !== 1) return next(new Error('The chat service is unavailable.'));

    try {
      const payload = jwt.verify(token, secret);
      if (typeof payload !== 'object' || typeof payload.sub !== 'string' || !mongoose.isValidObjectId(payload.sub)) {
        return next(new Error('Session is invalid or expired.'));
      }
      const user = await User.findById(payload.sub).select('name role');
      if (!user) return next(new Error('Session is invalid or expired.'));
      socket.data.user = user;
      return next();
    } catch (error) {
      if (['JsonWebTokenError', 'TokenExpiredError'].includes(error.name)) {
        return next(new Error('Session is invalid or expired.'));
      }
      console.error('Chat socket authentication error:', error);
      return next(new Error('Chat authentication could not be completed.'));
    }
  });

  io.on('connection', (socket) => {
    const sender = socket.data.user;
    socket.join(`user:${sender.id}`);
    // Administrators receive live verification alerts.
    if (sender.role === 'admin') socket.join('admins');

    socket.on('send_message', async (payload, acknowledge) => {
      const reply = typeof acknowledge === 'function' ? acknowledge : () => {};
      try {
        jwt.verify(socket.handshake.auth.token, process.env.JWT_SECRET);
      } catch {
        reply({ error: 'Session is invalid or expired.' });
        socket.disconnect(true);
        return;
      }
      if (mongoose.connection.readyState !== 1) {
        reply({ error: 'The chat service is unavailable.' });
        return;
      }
      const recipientId = typeof payload?.recipientId === 'string' ? payload.recipientId : '';
      const text = typeof payload?.text === 'string' ? payload.text.trim() : '';
      if (!mongoose.isValidObjectId(recipientId) || String(sender._id) === recipientId) {
        reply({ error: 'Choose a valid conversation recipient.' });
        return;
      }
      if (!text || text.length > 4000) {
        reply({ error: 'Message text must be between 1 and 4,000 characters.' });
        return;
      }

      try {
        const currentSender = await User.findById(sender._id).select('name role');
        if (!currentSender) {
          reply({ error: 'Session is invalid or expired.' });
          socket.disconnect(true);
          return;
        }
        const recipient = await User.findById(recipientId).select('name role');
        if (!recipient) {
          reply({ error: 'Conversation user not found.' });
          return;
        }
        if (!await canChatBetween(currentSender, recipient)) {
          reply({ error: 'You can only message customers or cargo providers you are currently doing business with, or an administrator.' });
          return;
        }

        const message = await Chat.create({ sender: currentSender._id, recipient: recipient._id, text });
        await message.populate([
          { path: 'sender', select: 'name' },
          { path: 'recipient', select: 'name' },
        ]);
        const result = publicMessage(message);
        io.to(`user:${currentSender.id}`).to(`user:${recipient.id}`).emit('receive_message', result);
        reply({ message: result });
      } catch (error) {
        console.error('Chat message send error:', error);
        reply({ error: 'Message could not be sent. Please try again.' });
      }
    });
  });
}

module.exports = registerChatSocket;
