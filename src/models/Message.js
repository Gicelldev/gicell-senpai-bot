const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Player',
    required: true
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Player',
    required: true
  },
  content: {
    type: String,
    required: true,
    maxlength: 500
  },
  isRead: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Static method untuk mencari pesan belum dibaca untuk pemain
MessageSchema.statics.findUnreadForPlayer = function(playerId) {
  return this.find({ receiver: playerId, isRead: false })
    .populate('sender', 'name')
    .sort({ createdAt: -1 });
};

// Static method untuk mencari riwayat pesan antar dua pemain
MessageSchema.statics.findChatHistory = function(player1Id, player2Id, limit = 20) {
  return this.find({
    $or: [
      { sender: player1Id, receiver: player2Id },
      { sender: player2Id, receiver: player1Id }
    ]
  })
    .populate('sender', 'name')
    .populate('receiver', 'name')
    .sort({ createdAt: -1 })
    .limit(limit);
};

const Message = mongoose.model('Message', MessageSchema);

module.exports = Message; 