const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  player: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Player',
    required: true
  },
  type: {
    type: String,
    enum: ['system', 'combat', 'transaction', 'guild', 'quest', 'achievement'],
    default: 'system'
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  isRead: {
    type: Boolean,
    default: false
  },
  relatedId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'relatedModel',
    default: null
  },
  relatedModel: {
    type: String,
    enum: ['Guild', 'Player', 'MarketListing', 'Quest', null],
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Indeks untuk pencarian lebih cepat
NotificationSchema.index({ player: 1, isRead: 1, createdAt: -1 });

// Static method untuk mencari notifikasi belum dibaca untuk pemain
NotificationSchema.statics.findUnreadForPlayer = function(playerId) {
  return this.find({ player: playerId, isRead: false })
    .sort({ createdAt: -1 })
    .limit(10);
};

// Static method untuk menandai semua notifikasi sebagai telah dibaca
NotificationSchema.statics.markAllAsRead = function(playerId) {
  return this.updateMany(
    { player: playerId, isRead: false },
    { $set: { isRead: true } }
  );
};

const Notification = mongoose.model('Notification', NotificationSchema);

module.exports = Notification; 