const Player = require('../models/Player');
const logger = require('../utils/logger');
const { generateStarterEquipment } = require('../utils/itemGenerator');

/**
 * Mendaftarkan pemain baru
 * @param {String} userId - ID pengguna WhatsApp
 * @param {Array} args - Argumen dari perintah (nama)
 * @returns {Object} - Status dan pesan respons
 */
const registerPlayer = async (userId, args) => {
  try {
    // Cek apakah pemain sudah terdaftar
    const existingPlayer = await Player.findOne({ userId });
    
    if (existingPlayer) {
      return {
        status: false,
        message: `Anda sudah terdaftar sebagai ${existingPlayer.name}. Gunakan !profil untuk melihat profil Anda.`
      };
    }
    
    // Validasi nama pemain
    if (!args || !args[0]) {
      return {
        status: false,
        message: 'Silakan tentukan nama karakter Anda. Contoh: !daftar Warrior123'
      };
    }
    
    const playerName = args[0];
    
    if (playerName.length < 3 || playerName.length > 20) {
      return {
        status: false,
        message: 'Nama karakter harus antara 3-20 karakter.'
      };
    }
    
    // Cek apakah nama sudah digunakan
    const existingName = await Player.findOne({ name: new RegExp(`^${playerName}$`, 'i') });
    
    if (existingName) {
      return {
        status: false,
        message: 'Nama karakter sudah digunakan. Silakan pilih nama lain.'
      };
    }
    
    // Tentukan role (admin atau player) berdasarkan nomor telepon
    const cleanUserId = userId.split('@')[0];
    const isAdminNumber = 
      userId === process.env.ADMIN_NUMBER || 
      cleanUserId === process.env.ADMIN_NUMBER ||
      (process.env.ADMIN_IDS && (
        process.env.ADMIN_IDS.split(',').includes(userId) || 
        process.env.ADMIN_IDS.split(',').includes(cleanUserId)
      ));
      
    const role = isAdminNumber ? 'admin' : 'player';
    
    if (isAdminNumber) {
      console.log(`Admin number detected: ${userId} (clean: ${cleanUserId}). Registering as admin.`);
      logger.info(`[ADMIN] Mendaftarkan nomor admin: ${userId} (clean: ${cleanUserId})`);
    }
    
    // Buat pemain baru
    const newPlayer = new Player({
      userId,
      phoneNumber: userId, // Simpan nomor telepon
      name: playerName,
      role, // Atur role berdasarkan pengecekan
      gmoney: parseInt(process.env.INITIAL_GMONEY || 1000)
    });
    
    // Dapatkan starter equipment dan inventory
    const { equipment, inventory } = generateStarterEquipment();
    
    // Tambahkan equipment ke pemain
    newPlayer.equipment = equipment;
    
    // Tambahkan item starter ke inventory
    inventory.forEach(item => {
      newPlayer.addItem(item);
    });
    
    // Simpan pemain
    await newPlayer.save();
    
    return {
      status: true,
      message: `✅ Pendaftaran berhasil!\nSelamat datang, ${playerName}!\n\nGunakan !help untuk melihat daftar perintah.`
    };
  } catch (error) {
    logger.error(`Error registering player: ${error.message}`, { stack: error.stack });
    return {
      status: false,
      message: 'Terjadi kesalahan saat mendaftarkan pemain.'
    };
  }
};

module.exports = {
  registerPlayer
}; 