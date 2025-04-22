const mongoose = require('mongoose');
const Player = require('../models/Player');
const logger = require('./logger');
const { extractPhoneNumber } = require('./phoneUtil');
const { generateStarterEquipment } = require('./itemGenerator');

/**
 * Mendaftarkan akun admin jika belum ada
 * @returns {Promise<boolean>} - true jika berhasil
 */
async function registerAdminIfNotExist() {
  try {
    const adminNumber = process.env.ADMIN_NUMBER;
    if (!adminNumber) {
      logger.warn('[ADMIN_REGISTER] ADMIN_NUMBER tidak ditemukan di environment');
      return false;
    }
    
    // Cek apakah admin sudah terdaftar
    const cleanAdminNumber = extractPhoneNumber(adminNumber);
    let adminPlayer = await Player.findOne({ 
      $or: [
        { userId: adminNumber },
        { userId: `${adminNumber}@s.whatsapp.net` },
        { phoneNumber: adminNumber },
        { phoneNumber: cleanAdminNumber }
      ]
    });
    
    // Jika admin sudah terdaftar, pastikan rolenya adalah admin
    if (adminPlayer) {
      if (adminPlayer.role !== 'admin') {
        logger.info(`[ADMIN_REGISTER] Mengupdate role pemain ${adminPlayer.name} menjadi admin`);
        adminPlayer.role = 'admin';
        await adminPlayer.save();
      }
      logger.info(`[ADMIN_REGISTER] Admin sudah terdaftar dengan nama: ${adminPlayer.name}`);
      return true;
    }
    
    // Jika admin belum terdaftar, buat akun baru
    logger.info(`[ADMIN_REGISTER] Membuat akun admin baru untuk nomor: ${adminNumber}`);
    
    // Generate equipment starter
    const starterWeapon = process.env.DEFAULT_WEAPON || 'wooden_sword';
    const starterArmor = process.env.DEFAULT_ARMOR || 'cloth_robe';
    const starterItems = generateStarterEquipment(starterWeapon, starterArmor);
    
    // Buat pemain baru
    const newAdmin = new Player({
      userId: adminNumber,
      phoneNumber: cleanAdminNumber,
      name: 'AdminGicell', // Default name
      role: 'admin',
      gmoney: parseInt(process.env.INITIAL_GMONEY || 1000) * 2, // Admin mendapat 2x gmoney
      // Default settings lainnya akan diisi oleh mongoose
    });
    
    // Tambahkan equipment starter
    starterItems.forEach(item => {
      newAdmin.addItem(item);
    });
    
    // Simpan pemain
    await newAdmin.save();
    logger.info(`[ADMIN_REGISTER] Akun admin berhasil dibuat dengan nama: AdminGicell`);
    
    return true;
  } catch (error) {
    logger.error(`[ADMIN_REGISTER] Error saat mendaftarkan admin: ${error.message}`, { stack: error.stack });
    return false;
  }
}

/**
 * Fungsi untuk migrasi model Player
 * @returns {Promise<void>}
 */
async function migratePlayerModel() {
  try {
    logger.info('[MIGRATION] Memulai migrasi model Player');
    
    // Pastikan admin terdaftar
    await registerAdminIfNotExist();
    
    // 1. Temukan semua player tanpa phoneNumber
    const playersWithoutPhone = await Player.find({ phoneNumber: { $exists: false } });
    logger.info(`[MIGRATION] Ditemukan ${playersWithoutPhone.length} player tanpa phoneNumber`);
    
    // 2. Update masing-masing player
    let updatedCount = 0;
    for (const player of playersWithoutPhone) {
      // Tambahkan phoneNumber = userId sebagai default
      player.phoneNumber = extractPhoneNumber(player.userId);
      await player.save();
      updatedCount++;
    }
    
    logger.info(`[MIGRATION] Berhasil memperbarui ${updatedCount} player dengan phoneNumber`);
    
    // 3. Periksa keberadaan method statis yang diperlukan
    if (typeof Player.findPlayerByPhoneNumber !== 'function') {
      logger.error('[MIGRATION] Method findPlayerByPhoneNumber tidak ditemukan pada model Player!');
    } else {
      logger.info('[MIGRATION] Method findPlayerByPhoneNumber tersedia');
    }
    
    if (typeof Player.findByUserId !== 'function') {
      logger.error('[MIGRATION] Method findByUserId tidak ditemukan pada model Player!');
    } else {
      logger.info('[MIGRATION] Method findByUserId tersedia');
    }
    
    logger.info('[MIGRATION] Migrasi model Player selesai');
    return true;
  } catch (error) {
    logger.error(`[MIGRATION] Error saat migrasi model Player: ${error.message}`, { stack: error.stack });
    return false;
  }
}

module.exports = { migratePlayerModel, registerAdminIfNotExist }; 