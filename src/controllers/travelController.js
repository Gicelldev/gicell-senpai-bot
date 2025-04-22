const Player = require('../models/Player');
const logger = require('../utils/logger');

/**
 * Berpindah zona dalam game
 * @param {String} userId - ID pengguna WhatsApp
 * @param {String} zoneTarget - Zona tujuan
 * @returns {Object} - Status dan pesan respons
 */
const travelToZone = async (userId, zoneTarget) => {
  try {
    // Validasi input
    if (!zoneTarget) {
      return {
        status: false,
        message: 'Silakan tentukan zona tujuan. Contoh: !travel safe'
      };
    }

    // Normalisasi input zona
    const normalizedZone = normalizeZoneName(zoneTarget);
    
    // Validasi zona
    const validZones = ['safe', 'yellow', 'red', 'black'];
    if (!validZones.includes(normalizedZone)) {
      return {
        status: false,
        message: `Zona '${zoneTarget}' tidak valid. Zona yang tersedia: safe, yellow, red, black.`
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
    
    // Cek apakah pemain sudah berada di zona tersebut
    if (player.currentZone === normalizedZone) {
      return {
        status: false,
        message: `Anda sudah berada di zona ${getZoneDisplayName(normalizedZone)}.`
      };
    }
    
    // Cek persyaratan level untuk zona berbahaya
    const levelRequirements = {
      safe: 1,
      yellow: 5,
      red: 15,
      black: 30
    };
    
    if (player.level < levelRequirements[normalizedZone]) {
      return {
        status: false,
        message: `Anda membutuhkan level ${levelRequirements[normalizedZone]} untuk memasuki zona ${getZoneDisplayName(normalizedZone)}. Level Anda saat ini: ${player.level}.`
      };
    }
    
    // Simpan zona asal untuk laporan
    const previousZone = player.currentZone;
    
    // Perubahan zona
    player.currentZone = normalizedZone;
    
    // Simpan perubahan
    await player.save();
    
    logger.info(`Player ${player.name} traveled from ${previousZone} zone to ${normalizedZone} zone`);
    
    // Format pesan respons
    let message = `🧭 PERJALANAN BERHASIL 🧭\n\n`;
    message += `Anda telah berpindah dari zona ${getZoneDisplayName(previousZone)} ke zona ${getZoneDisplayName(normalizedZone)}.\n\n`;
    
    // Informasi zona berdasarkan tingkat bahaya
    switch (normalizedZone) {
      case 'safe':
        message += `Zona Aman (Safe Zone) adalah area di mana pemain tidak dapat menyerang satu sama lain. Zona ini sangat cocok untuk pemain baru dan mengumpulkan resource dasar.\n\n` +
                 `Apa yang bisa Anda lakukan di sini:\n` +
                 `- Mengumpulkan resource tier 1-2\n` +
                 `- Melakukan crafting tanpa gangguan\n` +
                 `- Interaksi dengan pemain lain secara damai`;
        break;
      case 'yellow':
        message += `Zona Kuning (Yellow Zone) adalah area dengan resiko sedang. Pertarungan PvP diizinkan, tetapi ada penalti bagi penyerang.\n\n` +
                 `Apa yang bisa Anda lakukan di sini:\n` +
                 `- Mengumpulkan resource tier 2-4\n` +
                 `- Kehadiran monster yang lebih kuat\n` +
                 `- PvP dengan penalti untuk penyerang\n` +
                 `- Dungeon tier menengah`;
        break;
      case 'red':
        message += `Zona Merah (Red Zone) adalah area berbahaya. PvP bebas tanpa penalti dan monster yang jauh lebih berbahaya.\n\n` +
                 `Apa yang bisa Anda lakukan di sini:\n` +
                 `- Mengumpulkan resource tier 4-6\n` +
                 `- PvP tanpa penalti\n` +
                 `- Monster yang lebih mematikan\n` +
                 `- Hadiah yang lebih besar\n` +
                 `- Akses ke dungeon tingkat tinggi`;
        break;
      case 'black':
        message += `Zona Hitam (Black Zone) adalah area paling berbahaya dalam game. Hanya pemain tingkat tinggi yang dapat bertahan di sini.\n\n` +
                 `Apa yang bisa Anda lakukan di sini:\n` +
                 `- Mengumpulkan resource tier 6-8\n` +
                 `- PvP tanpa penalti dengan hadiah loot dari pemain lain\n` +
                 `- Monster legendaris\n` +
                 `- Resource dan item langka\n` +
                 `- Dungeon legendary`;
        break;
    }
    
    message += `\n\nGunakan !zone untuk informasi lebih lanjut tentang zona saat ini.`;

    return {
      status: true,
      message
    };
  } catch (error) {
    logger.error(`Error traveling to zone: ${error.message}`, { stack: error.stack });
    return {
      status: false,
      message: 'Terjadi kesalahan saat berpindah zona.'
    };
  }
};

/**
 * Mendapatkan informasi tentang zona saat ini
 * @param {String} userId - ID pengguna WhatsApp
 * @returns {Object} - Status dan pesan respons
 */
const getZoneInfo = async (userId) => {
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
    
    const currentZone = player.currentZone;
    
    // Format pesan respons
    let message = `🗺️ INFORMASI ZONA 🗺️\n\n`;
    message += `Anda saat ini berada di ${getZoneDisplayName(currentZone)}.\n\n`;
    
    // Detail zona dan informasi resource
    switch (currentZone) {
      case 'safe':
        message += `Zona Aman (Safe Zone) adalah area perlindungan bagi semua pemain.\n\n` +
                 `Informasi Zona:\n` +
                 `- Tingkat bahaya: Tidak ada (PvP dinonaktifkan)\n` +
                 `- Resource tersedia: Tier 1-2\n` +
                 `- Monster: Tier 1-2\n` +
                 `- Exp bonus: Standar (1x)\n\n` +
                 `Informasi Resource:\n` +
                 `- Kayu: Common Logs, Rough Logs\n` +
                 `- Batu: Common Stone, Rough Stone\n` +
                 `- Ore: Copper Ore, Tin Ore\n` +
                 `- Fiber: Cotton, Raw Flax\n` +
                 `- Hide: Thin Hide, Rough Hide`;
        break;
      case 'yellow':
        message += `Zona Kuning (Yellow Zone) memiliki tingkat bahaya sedang.\n\n` +
                 `Informasi Zona:\n` +
                 `- Tingkat bahaya: Sedang (PvP dengan penalti)\n` +
                 `- Resource tersedia: Tier 2-4\n` +
                 `- Monster: Tier 2-4\n` +
                 `- Exp bonus: 1.5x\n\n` +
                 `Informasi Resource:\n` +
                 `- Kayu: Rough Logs, Aged Wood, Maple Logs\n` +
                 `- Batu: Rough Stone, Granite, Limestone\n` +
                 `- Ore: Tin Ore, Iron Ore, Titanium Traces\n` +
                 `- Fiber: Raw Flax, Hemp, Silk Threads\n` +
                 `- Hide: Rough Hide, Thick Hide, Rugged Leather`;
        break;
      case 'red':
        message += `Zona Merah (Red Zone) sangat berbahaya dengan PvP bebas.\n\n` +
                 `Informasi Zona:\n` +
                 `- Tingkat bahaya: Tinggi (PvP tanpa penalti)\n` +
                 `- Resource tersedia: Tier 4-6\n` +
                 `- Monster: Tier 4-6\n` +
                 `- Exp bonus: 2x\n\n` +
                 `Informasi Resource:\n` +
                 `- Kayu: Maple Logs, Ancient Wood, Bloodoak\n` +
                 `- Batu: Limestone, Marble, Slate\n` +
                 `- Ore: Iron Ore, Titanium, Mithril Ore\n` +
                 `- Fiber: Silk Threads, Ghostweave, Shimmerweave\n` +
                 `- Hide: Rugged Leather, Cured Hide, Primal Leather`;
        break;
      case 'black':
        message += `Zona Hitam (Black Zone) adalah area paling mematikan dalam game.\n\n` +
                 `Informasi Zona:\n` +
                 `- Tingkat bahaya: Ekstrem (PvP dengan loot pemain)\n` +
                 `- Resource tersedia: Tier 6-8\n` +
                 `- Monster: Tier 6-8 dan Legendary\n` +
                 `- Exp bonus: 3x\n\n` +
                 `Informasi Resource:\n` +
                 `- Kayu: Bloodoak, Heartwood, Ancient Treant Wood\n` +
                 `- Batu: Slate, Obsidian, Dragon Crystal\n` +
                 `- Ore: Mithril Ore, Adamantite, Void Essence\n` +
                 `- Fiber: Shimmerweave, Phoenix Feather, Celestial Thread\n` +
                 `- Hide: Primal Leather, Dragon Hide, Abyssal Skin`;
        break;
    }
    
    message += `\n\nGunakan !travel [zona] untuk berpindah ke zona lain.`;

    return {
      status: true,
      message
    };
  } catch (error) {
    logger.error(`Error getting zone info: ${error.message}`, { stack: error.stack });
    return {
      status: false,
      message: 'Terjadi kesalahan saat mendapatkan informasi zona.'
    };
  }
};

/**
 * Normalisasi nama zona
 * @param {String} zoneName - Nama zona input
 * @returns {String} - Nama zona ternormalisasi
 */
function normalizeZoneName(zoneName) {
  if (!zoneName) return 'safe';
  
  const input = zoneName.toLowerCase().trim();
  
  // Normalisasi berdasarkan kata kunci
  if (input === 'safe' || input === 'aman' || input === 'kota') {
    return 'safe';
  } else if (input === 'yellow' || input === 'kuning' || input === 'sedang') {
    return 'yellow';
  } else if (input === 'red' || input === 'merah' || input === 'bahaya') {
    return 'red';
  } else if (input === 'black' || input === 'hitam' || input === 'sangat bahaya' || input === 'extreme') {
    return 'black';
  }
  
  // Default ke safe jika tidak dikenali
  return 'safe';
}

/**
 * Mendapatkan nama tampilan zona
 * @param {String} zoneName - Nama zona internal
 * @returns {String} - Nama tampilan zona
 */
function getZoneDisplayName(zoneName) {
  const zoneMap = {
    'safe': 'Zona Aman (Safe Zone)',
    'yellow': 'Zona Kuning (Yellow Zone)',
    'red': 'Zona Merah (Red Zone)',
    'black': 'Zona Hitam (Black Zone)'
  };
  
  return zoneMap[zoneName] || 'Zona Tidak Dikenal';
}

module.exports = {
  travelToZone,
  getZoneInfo
}; 