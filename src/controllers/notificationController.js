const Player = require('../models/Player');
const Notification = require('../models/Notification');
const logger = require('../utils/logger');

/**
 * Menampilkan notifikasi yang belum dibaca
 * @param {String} userId - ID pengguna WhatsApp
 * @returns {Object} - Status dan pesan respons
 */
const viewNotifications = async (userId) => {
  try {
    // Cari pemain dalam database
    const player = await Player.findByUserId(userId);
    
    if (!player) {
      return {
        status: false,
        message: 'Anda belum terdaftar sebagai pemain. Gunakan !daftar [nama] untuk mendaftar.'
      };
    }
    
    // Update lastActivity
    player.lastActivity = Date.now();
    await player.save();
    
    // Cari notifikasi yang belum dibaca
    const notifications = await Notification.findUnreadForPlayer(player._id);
    
    if (notifications.length === 0) {
      return {
        status: true,
        message: '🔔 NOTIFIKASI 🔔\n\nAnda tidak memiliki notifikasi yang belum dibaca.'
      };
    }
    
    // Buat daftar notifikasi
    let notificationsList = '';
    notifications.forEach((notif, index) => {
      const date = new Date(notif.createdAt);
      const dateStr = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
      
      // Tambahkan emoji berdasarkan tipe notifikasi
      let emoji = '';
      switch (notif.type) {
        case 'system':
          emoji = '🛠️';
          break;
        case 'combat':
          emoji = '⚔️';
          break;
        case 'transaction':
          emoji = '💰';
          break;
        case 'guild':
          emoji = '🏰';
          break;
        case 'quest':
          emoji = '📜';
          break;
        case 'achievement':
          emoji = '🏆';
          break;
        default:
          emoji = '📢';
      }
      
      notificationsList += `${index + 1}. ${emoji} ${notif.title} (${dateStr})\n`;
      notificationsList += `   ${notif.message}\n\n`;
    });
    
    // Tandai semua notifikasi sebagai sudah dibaca
    await Notification.markAllAsRead(player._id);
    
    return {
      status: true,
      message: `🔔 NOTIFIKASI (${notifications.length}) 🔔\n\n${notificationsList}`
    };
  } catch (error) {
    logger.error(`Error viewing notifications: ${error.message}`);
    return {
      status: false,
      message: `Terjadi kesalahan saat melihat notifikasi: ${error.message}`
    };
  }
};

/**
 * Membuat notifikasi baru untuk pemain
 * @param {String|ObjectId} playerId - ID pemain atau objek pemain
 * @param {String} type - Tipe notifikasi
 * @param {String} title - Judul notifikasi
 * @param {String} message - Isi notifikasi
 * @param {Object} related - Objek terkait (opsional)
 * @returns {Promise<Boolean>} - Status berhasil/gagal
 */
const createNotification = async (playerId, type, title, message, related = null) => {
  try {
    // Validasi tipe notifikasi
    const validTypes = ['system', 'combat', 'transaction', 'guild', 'quest', 'achievement'];
    if (!validTypes.includes(type)) {
      logger.error(`Invalid notification type: ${type}`);
      return false;
    }
    
    // Buat notifikasi baru
    const notification = new Notification({
      player: playerId,
      type,
      title,
      message
    });
    
    // Tambahkan data terkait jika ada
    if (related && related.id && related.model) {
      notification.relatedId = related.id;
      notification.relatedModel = related.model;
    }
    
    // Simpan notifikasi
    await notification.save();
    
    logger.info(`Notification created for player ${playerId}: ${title}`);
    return true;
  } catch (error) {
    logger.error(`Error creating notification: ${error.message}`);
    return false;
  }
};

module.exports = {
  viewNotifications,
  createNotification
}; 