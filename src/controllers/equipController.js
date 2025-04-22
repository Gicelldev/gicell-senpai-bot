const Player = require('../models/Player');
const logger = require('../utils/logger');

/**
 * Menggunakan item equipment
 * @param {String} userId - ID pengguna WhatsApp
 * @param {String} itemId - ID item yang akan digunakan
 * @returns {Object} - Status dan pesan respons
 */
const equipItem = async (userId, itemId) => {
  try {
    // Validasi input
    if (!itemId) {
      return {
        status: false,
        message: 'Silakan tentukan item yang ingin digunakan. Contoh: !equip wooden_sword'
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
    
    // Cari item di inventory pemain
    const inventoryItem = player.inventory.find(item => 
      item.itemId.toLowerCase() === itemId.toLowerCase()
    );
    
    if (!inventoryItem) {
      return {
        status: false,
        message: `Item '${itemId}' tidak ditemukan di inventory Anda.`
      };
    }
    
    // Verifikasi jika item adalah equipment
    if (!['weapon', 'armor'].includes(inventoryItem.type)) {
      return {
        status: false,
        message: `Item '${inventoryItem.name}' bukan merupakan equipment yang bisa digunakan.`
      };
    }
    
    // Tentukan slot berdasarkan metadata atau type item
    let slot = 'weapon'; // Default untuk weapon
    
    // Jika item adalah armor, tentukan slot berdasarkan metadata atau nama
    if (inventoryItem.type === 'armor') {
      // Cek metadata
      if (inventoryItem.stats && inventoryItem.stats.slot) {
        slot = inventoryItem.stats.slot;
      } 
      // Coba deteksi dari nama
      else if (inventoryItem.name.toLowerCase().includes('helmet') || 
               inventoryItem.name.toLowerCase().includes('hood')) {
        slot = 'head';
      } 
      else if (inventoryItem.name.toLowerCase().includes('chest') || 
               inventoryItem.name.toLowerCase().includes('robe') || 
               inventoryItem.name.toLowerCase().includes('tunic')) {
        slot = 'chest';
      } 
      else if (inventoryItem.name.toLowerCase().includes('pants') || 
               inventoryItem.name.toLowerCase().includes('leggings')) {
        slot = 'legs';
      } 
      else if (inventoryItem.name.toLowerCase().includes('boots') || 
               inventoryItem.name.toLowerCase().includes('shoes')) {
        slot = 'boots';
      }
      // Jika tidak terdeteksi, default ke chest
      else {
        slot = 'chest';
      }
    }
    
    // Cek item yang sekarang dipakai di slot tersebut
    const currentEquipment = player.equipment[slot];
    
    // Jika ada item terpasang, pindahkan ke inventory
    if (currentEquipment) {
      player.addItem(currentEquipment);
      logger.info(`Player ${player.name} unequipped ${currentEquipment.name} from ${slot}`);
    }
    
    // Pasang item baru
    player.equipment[slot] = {
      itemId: inventoryItem.itemId,
      name: inventoryItem.name,
      type: inventoryItem.type,
      tier: inventoryItem.tier,
      stats: inventoryItem.stats || {}
    };
    
    // Hapus item dari inventory
    player.removeItem(itemId);
    
    // Simpan perubahan
    await player.save();
    
    logger.info(`Player ${player.name} equipped ${inventoryItem.name} in ${slot}`);
    
    // Format pesan respons
    let message = `⚔️ EQUIPMENT BERHASIL DIPASANG ⚔️\n\n`;
    message += `Anda telah memasang ${inventoryItem.name} di slot ${slot}.\n`;
    
    if (currentEquipment) {
      message += `\n${currentEquipment.name} telah dipindahkan ke inventory.\n`;
    }
    
    // Tampilkan stats yang diperoleh
    if (inventoryItem.stats) {
      message += `\nStats item:`;
      
      if (inventoryItem.type === 'weapon' && inventoryItem.stats.damage) {
        message += `\n🗡️ Damage: +${inventoryItem.stats.damage}`;
      }
      
      if (inventoryItem.type === 'armor' && inventoryItem.stats.defense) {
        message += `\n🛡️ Defense: +${inventoryItem.stats.defense}`;
      }
      
      // Tambahkan stats lainnya jika ada
      Object.entries(inventoryItem.stats).forEach(([key, value]) => {
        if (key !== 'damage' && key !== 'defense' && key !== 'slot') {
          message += `\n➕ ${key}: ${value}`;
        }
      });
    }

    return {
      status: true,
      message
    };
  } catch (error) {
    logger.error(`Error equipping item: ${error.message}`, { stack: error.stack });
    return {
      status: false,
      message: 'Terjadi kesalahan saat menggunakan equipment.'
    };
  }
};

/**
 * Melepas item equipment
 * @param {String} userId - ID pengguna WhatsApp
 * @param {String} slot - Slot equipment yang akan dilepas
 * @returns {Object} - Status dan pesan respons
 */
const unequipItem = async (userId, slot) => {
  try {
    // Validasi input
    if (!slot) {
      return {
        status: false,
        message: 'Silakan tentukan slot equipment yang ingin dilepas. Contoh: !unequip weapon'
      };
    }
    
    // Normalisasi slot
    slot = slot.toLowerCase();
    
    // Verifikasi slot yang valid
    const validSlots = ['weapon', 'head', 'chest', 'legs', 'boots'];
    if (!validSlots.includes(slot)) {
      return {
        status: false,
        message: `Slot '${slot}' tidak valid. Slot yang tersedia: weapon, head, chest, legs, boots.`
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
    
    // Cek apakah ada equipment di slot tersebut
    if (!player.equipment[slot]) {
      return {
        status: false,
        message: `Anda tidak memiliki equipment yang terpasang di slot ${slot}.`
      };
    }
    
    // Simpan referensi ke equipment yang akan dilepas
    const unequippedItem = player.equipment[slot];
    
    // Tambahkan ke inventory
    player.addItem(unequippedItem);
    
    // Hapus dari equipment
    player.equipment[slot] = null;
    
    // Simpan perubahan
    await player.save();
    
    logger.info(`Player ${player.name} unequipped ${unequippedItem.name} from ${slot}`);
    
    // Format pesan respons
    let message = `🛡️ EQUIPMENT BERHASIL DILEPAS 🛡️\n\n`;
    message += `Anda telah melepas ${unequippedItem.name} dari slot ${slot}.\n`;
    message += `Item telah dipindahkan ke inventory.`;

    return {
      status: true,
      message
    };
  } catch (error) {
    logger.error(`Error unequipping item: ${error.message}`, { stack: error.stack });
    return {
      status: false,
      message: 'Terjadi kesalahan saat melepas equipment.'
    };
  }
};

module.exports = {
  equipItem,
  unequipItem
}; 