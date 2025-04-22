const Player = require('../models/Player');
const Guild = require('../models/Guild');
const logger = require('../utils/logger');

/**
 * Mendapatkan informasi profil pemain
 * @param {String} userId - ID pengguna WhatsApp
 * @returns {Object} - Status dan pesan respons
 */
const getProfile = async (userId) => {
  try {
    // Cari pemain dalam database
    const player = await Player.findByUserId(userId);
    
    // Jika pemain tidak ditemukan
    if (!player) {
      return {
        status: false,
        message: 'Anda belum terdaftar sebagai pemain. Gunakan !daftar [nama] untuk mendaftar.'
      };
    }
    
    // Update lastActivity
    player.lastActivity = Date.now();
    await player.save();
    
    // Dapatkan informasi guild jika ada
    let guildInfo = 'Tidak ada';
    if (player.guild) {
      const guild = await Guild.findById(player.guild).populate('leader', 'name');
      if (guild) {
        const memberStatus = guild.members.find(m => 
          m.playerId.toString() === player._id.toString()
        );
        
        guildInfo = `${guild.name} (${memberStatus ? memberStatus.rank : 'member'})`;
      }
    }
    
    // Hitung jumlah resource di inventory
    const resources = player.inventory.filter(item => item.type === 'resource')
      .reduce((acc, resource) => acc + resource.quantity, 0);
    
    // Dapatkan senjata aktif
    const activeWeapon = player.equipment.weapon 
      ? `${player.equipment.weapon.name} (DMG: ${player.equipment.weapon.stats.damage})` 
      : 'Tidak ada';
    
    // Dapatkan armor aktif
    const activeArmor = [];
    ['head', 'chest', 'legs', 'boots'].forEach(slot => {
      if (player.equipment[slot]) {
        activeArmor.push(`${player.equipment[slot].name} (DEF: ${player.equipment[slot].stats.defense})`);
      }
    });
    
    // Format level dan experience
    const nextLevelExp = player.getNextLevelExp();
    
    // Buat respons profil
    return {
      status: true,
      message: `📝 PROFIL KARAKTER 📝\n\n` +
        `Nama: ${player.name}\n` +
        `Level: ${player.level} (${player.experience}/${nextLevelExp} EXP)\n` +
        `Gmoney: ${player.gmoney}\n\n` +
        
        `🗺️ Zona Saat Ini: ${formatZone(player.currentZone)}\n\n` +
        
        `⚔️ STATISTIK ⚔️\n` +
        `HP: ${player.stats.health}/${player.stats.maxHealth}\n` +
        `Attack: ${player.stats.attack}\n` +
        `Defense: ${player.stats.defense}\n\n` +
        
        `🔧 GATHERING SKILL 🔧\n` +
        `Kayu: ${player.stats.gathering.wood}\n` +
        `Batu: ${player.stats.gathering.stone}\n` +
        `Ore: ${player.stats.gathering.ore}\n` +
        `Fiber: ${player.stats.gathering.fiber}\n` +
        `Hide: ${player.stats.gathering.hide}\n\n` +
        
        `🛠️ EQUIPMENT 🛠️\n` +
        `Senjata: ${activeWeapon}\n` +
        `Armor: ${activeArmor.length > 0 ? activeArmor.join('\n       ') : 'Tidak ada'}\n\n` +
        
        `🎒 INVENTORY 🎒\n` +
        `Item: ${player.inventory.length}\n` +
        `Resource: ${resources}\n\n` +
        
        `🏰 GUILD 🏰\n` +
        `${guildInfo}\n\n` +
        
        `Terakhir aktif: ${formatDate(player.lastActivity)}`
    };
  } catch (error) {
    logger.error(`Error getting player profile: ${error.message}`);
    return {
      status: false,
      message: `Terjadi kesalahan saat mendapatkan profil: ${error.message}`
    };
  }
};

/**
 * Menampilkan inventory pemain secara detail
 * @param {String} userId - ID pengguna WhatsApp
 * @returns {Object} - Status dan pesan respons
 */
const viewInventory = async (userId) => {
  try {
    // Cari pemain dalam database
    const player = await Player.findByUserId(userId);
    
    // Jika pemain tidak ditemukan
    if (!player) {
      return {
        status: false,
        message: 'Anda belum terdaftar sebagai pemain. Gunakan !daftar [nama] untuk mendaftar.'
      };
    }
    
    // Update lastActivity
    player.lastActivity = Date.now();
    await player.save();
    
    // Jika inventory kosong
    if (player.inventory.length === 0) {
      return {
        status: true,
        message: `🎒 INVENTORY ANDA 🎒\n\nInventory Anda kosong. Kumpulkan resource dengan perintah !gather atau beli item dari pasar (!pasar).`
      };
    }
    
    // Kelompokkan item berdasarkan tipe
    const weaponItems = player.inventory.filter(item => item.type === 'weapon');
    const armorItems = player.inventory.filter(item => item.type === 'armor');
    const resourceItems = player.inventory.filter(item => item.type === 'resource');
    const consumableItems = player.inventory.filter(item => item.type === 'consumable');
    
    // Buat pesan respons
    let message = `🎒 INVENTORY ${player.name} 🎒\n\n`;
    
    // Format item senjata
    if (weaponItems.length > 0) {
      message += `⚔️ SENJATA ⚔️\n`;
      weaponItems.forEach((item, index) => {
        message += `${index + 1}. ${item.name} (T${item.tier}) - DMG: ${item.stats.damage}\n`;
      });
      message += `\n`;
    }
    
    // Format item armor
    if (armorItems.length > 0) {
      message += `🛡️ ARMOR 🛡️\n`;
      armorItems.forEach((item, index) => {
        message += `${index + 1}. ${item.name} (T${item.tier}) - DEF: ${item.stats.defense}\n`;
      });
      message += `\n`;
    }
    
    // Format item resource
    if (resourceItems.length > 0) {
      message += `🌲 RESOURCE 🌲\n`;
      resourceItems.forEach((item, index) => {
        message += `${index + 1}. ${item.name} x${item.quantity}\n`;
      });
      message += `\n`;
    }
    
    // Format item consumable
    if (consumableItems.length > 0) {
      message += `🧪 CONSUMABLE 🧪\n`;
      consumableItems.forEach((item, index) => {
        const effect = item.stats.healthRestore 
          ? `HP+${item.stats.healthRestore}` 
          : 'No effect';
        message += `${index + 1}. ${item.name} x${item.quantity} (${effect})\n`;
      });
      message += `\n`;
    }
    
    // Tambahkan petunjuk penggunaan
    message += `PETUNJUK:\n`;
    message += `!equip [item] - Menggunakan equipment\n`;
    message += `!heal [item] - Menyembuhkan dengan consumable\n`;
    message += `!jual [item] [harga] [jumlah] - Jual item ke pasar\n`;
    
    return {
      status: true,
      message
    };
  } catch (error) {
    logger.error(`Error viewing inventory: ${error.message}`);
    return {
      status: false,
      message: `Terjadi kesalahan saat melihat inventory: ${error.message}`
    };
  }
};

/**
 * Format nama zona menjadi lebih terbaca
 * @param {String} zone - Nama zona
 * @returns {String} Nama zona yang diformat
 */
const formatZone = (zone) => {
  const zoneMap = {
    'safe': '🟢 Safe Zone',
    'yellow': '🟡 Yellow Zone',
    'red': '🔴 Red Zone',
    'black': '⚫ Black Zone'
  };
  
  return zoneMap[zone] || zone;
};

/**
 * Format tanggal menjadi string terbaca
 * @param {Date} date - Objek tanggal
 * @returns {String} Tanggal dalam format terbaca
 */
const formatDate = (date) => {
  if (!date) return 'Tidak pernah';
  
  const now = new Date();
  const diff = now - date;
  
  // Kurang dari 1 menit
  if (diff < 60000) {
    return 'Baru saja';
  }
  
  // Kurang dari 1 jam
  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000);
    return `${minutes} menit yang lalu`;
  }
  
  // Kurang dari 1 hari
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours} jam yang lalu`;
  }
  
  // Lebih dari 1 hari
  const days = Math.floor(diff / 86400000);
  return `${days} hari yang lalu`;
};

module.exports = {
  getProfile,
  viewInventory
}; 