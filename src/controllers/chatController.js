const Player = require('../models/Player');
const Message = require('../models/Message');
const logger = require('../utils/logger');

/**
 * Mengirim pesan ke pemain lain
 * @param {String} userId - ID pengguna WhatsApp pengirim
 * @param {String} targetName - Nama pemain tujuan
 * @param {String} content - Isi pesan
 * @returns {Object} - Status dan pesan respons
 */
const sendMessage = async (userId, targetName, content) => {
  try {
    // Validasi input
    if (!targetName) {
      return {
        status: false,
        message: 'Silakan tentukan nama pemain tujuan. Contoh: !kirim NamaPemain Halo, apa kabar?'
      };
    }
    
    if (!content) {
      return {
        status: false,
        message: 'Pesan tidak boleh kosong.'
      };
    }
    
    // Cek panjang pesan
    if (content.length > 500) {
      return {
        status: false,
        message: 'Pesan terlalu panjang. Maksimal 500 karakter.'
      };
    }
    
    // Cari pemain pengirim dalam database
    const sender = await Player.findByUserId(userId);
    
    if (!sender) {
      return {
        status: false,
        message: 'Anda belum terdaftar sebagai pemain. Gunakan !daftar [nama] untuk mendaftar.'
      };
    }
    
    // Update lastActivity
    sender.lastActivity = Date.now();
    await sender.save();
    
    // Cari pemain tujuan dalam database
    const receiver = await Player.findOne({ name: new RegExp(`^${targetName}$`, 'i') });
    
    if (!receiver) {
      return {
        status: false,
        message: `Pemain dengan nama "${targetName}" tidak ditemukan.`
      };
    }
    
    // Tidak bisa mengirim pesan ke diri sendiri
    if (sender._id.toString() === receiver._id.toString()) {
      return {
        status: false,
        message: 'Anda tidak dapat mengirim pesan ke diri sendiri.'
      };
    }
    
    // Buat pesan baru
    const newMessage = new Message({
      sender: sender._id,
      receiver: receiver._id,
      content: content
    });
    
    // Simpan pesan
    await newMessage.save();
    
    logger.info(`Message sent from ${sender.name} to ${receiver.name}: ${content.substring(0, 30)}...`);
    
    return {
      status: true,
      message: `✅ Pesan berhasil dikirim ke ${receiver.name}.`
    };
  } catch (error) {
    logger.error(`Error sending message: ${error.message}`);
    return {
      status: false,
      message: `Terjadi kesalahan saat mengirim pesan: ${error.message}`
    };
  }
};

/**
 * Menampilkan pesan yang belum dibaca
 * @param {String} userId - ID pengguna WhatsApp
 * @returns {Object} - Status dan pesan respons
 */
const viewUnreadMessages = async (userId) => {
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
    
    // Cari pesan yang belum dibaca
    const unreadMessages = await Message.findUnreadForPlayer(player._id);
    
    if (unreadMessages.length === 0) {
      return {
        status: true,
        message: '📬 PESAN MASUK 📬\n\nAnda tidak memiliki pesan yang belum dibaca.'
      };
    }
    
    // Buat daftar pesan
    let messagesList = '';
    unreadMessages.forEach((msg, index) => {
      const date = new Date(msg.createdAt);
      const dateStr = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
      messagesList += `${index + 1}. Dari: ${msg.sender.name} (${dateStr})\n`;
      messagesList += `   ${msg.content.length > 30 ? msg.content.substring(0, 30) + '...' : msg.content}\n\n`;
    });
    
    // Tandai semua pesan sebagai sudah dibaca
    await Message.updateMany(
      { receiver: player._id, isRead: false },
      { $set: { isRead: true } }
    );
    
    return {
      status: true,
      message: `📬 PESAN MASUK (${unreadMessages.length}) 📬\n\n${messagesList}\nGunakan !baca [nama_pengirim] untuk melihat riwayat chat.`
    };
  } catch (error) {
    logger.error(`Error viewing unread messages: ${error.message}`);
    return {
      status: false,
      message: `Terjadi kesalahan saat melihat pesan: ${error.message}`
    };
  }
};

/**
 * Menampilkan riwayat chat dengan pemain lain
 * @param {String} userId - ID pengguna WhatsApp
 * @param {String} targetName - Nama pemain lain
 * @returns {Object} - Status dan pesan respons
 */
const viewChatHistory = async (userId, targetName) => {
  try {
    // Validasi input
    if (!targetName) {
      return {
        status: false,
        message: 'Silakan tentukan nama pemain. Contoh: !baca NamaPemain'
      };
    }
    
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
    
    // Cari pemain lain dalam database
    const otherPlayer = await Player.findOne({ name: new RegExp(`^${targetName}$`, 'i') });
    
    if (!otherPlayer) {
      return {
        status: false,
        message: `Pemain dengan nama "${targetName}" tidak ditemukan.`
      };
    }
    
    // Cari riwayat chat
    const chatHistory = await Message.findChatHistory(player._id, otherPlayer._id, 10);
    
    if (chatHistory.length === 0) {
      return {
        status: true,
        message: `📝 CHAT DENGAN ${otherPlayer.name.toUpperCase()} 📝\n\nBelum ada riwayat chat dengan pemain ini.`
      };
    }
    
    // Buat daftar pesan
    let chatList = '';
    chatHistory.reverse().forEach((msg) => {
      const date = new Date(msg.createdAt);
      const timeStr = date.toLocaleTimeString();
      
      if (msg.sender._id.toString() === player._id.toString()) {
        chatList += `Anda (${timeStr}):\n${msg.content}\n\n`;
      } else {
        chatList += `${otherPlayer.name} (${timeStr}):\n${msg.content}\n\n`;
      }
    });
    
    // Tandai semua pesan dari pemain lain sebagai sudah dibaca
    await Message.updateMany(
      { sender: otherPlayer._id, receiver: player._id, isRead: false },
      { $set: { isRead: true } }
    );
    
    return {
      status: true,
      message: `📝 CHAT DENGAN ${otherPlayer.name.toUpperCase()} 📝\n\n${chatList}\nGunakan !kirim ${otherPlayer.name} [pesan] untuk membalas.`
    };
  } catch (error) {
    logger.error(`Error viewing chat history: ${error.message}`);
    return {
      status: false,
      message: `Terjadi kesalahan saat melihat riwayat chat: ${error.message}`
    };
  }
};

module.exports = {
  sendMessage,
  viewUnreadMessages,
  viewChatHistory
}; 