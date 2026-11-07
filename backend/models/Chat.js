const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  text: { type: String, required: true, trim: true, maxlength: 4000 },
}, { timestamps: true });

chatSchema.index({ sender: 1, recipient: 1, createdAt: 1 });
chatSchema.index({ recipient: 1, sender: 1, createdAt: 1 });

module.exports = mongoose.models.Chat || mongoose.model('Chat', chatSchema);
