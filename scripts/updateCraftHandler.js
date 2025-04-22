// Script untuk memperbarui fungsi craftlist di messageHandler
// File ini menunjukkan implementasi yang disarankan untuk controller craftController.js

/**
 * Menampilkan daftar item yang dapat di-craft
 * @param {String} userId - ID pengguna WhatsApp
 * @param {String} filter - Filter berdasarkan tier atau kategori (opsional)
 * @returns {Object} - Status dan pesan respons
 */
const viewCraftableItems = async (userId, filter = null) => {
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
    
    // Ambil query awal untuk item craftable
    let query = {
      craftingRequirements: { $exists: true, $ne: [] },
      requiredLevel: { $lte: player.level }
    };
    
    // Terapkan filter jika ada
    let filterMessage = '';
    if (filter) {
      // Filter berdasarkan tier (contoh: !craftlist tier3)
      if (filter.startsWith('tier')) {
        const tier = parseInt(filter.substring(4));
        if (!isNaN(tier) && tier >= 1 && tier <= 8) {
          query.tier = tier;
          filterMessage = ` (Tier ${tier})`;
        }
      } 
      // Filter berdasarkan kategori (contoh: !craftlist weapon)
      else if (['weapon', 'armor', 'consumable', 'resource'].includes(filter)) {
        query.type = filter;
        filterMessage = ` (Kategori: ${filter})`;
      }
    }
    
    // Ambil semua item yang dapat di-craft sesuai filter
    const craftableItems = await Item.find(query).sort({ tier: 1, requiredLevel: 1 });
    
    if (!craftableItems || craftableItems.length === 0) {
      return {
        status: false,
        message: `Tidak ada item yang dapat di-craft${filterMessage} pada level Anda saat ini.`
      };
    }
    
    // Kategorikan item berdasarkan tipe
    const categorizedItems = {
      weapon: [],
      armor: [],
      consumable: [],
      resource: []
    };
    
    for (const item of craftableItems) {
      if (item.type in categorizedItems) {
        categorizedItems[item.type].push(item);
      }
    }
    
    // Buat pesan respons
    let message = `🛠️ DAFTAR ITEM YANG DAPAT DI-CRAFT${filterMessage} 🛠️\n\n`;
    
    // Tambahkan info pemain
    message += `Level: ${player.level}\n`;
    message += `Skill Crafting: ${player.stats.crafting}\n\n`;
    
    // Tambahkan item per kategori
    if (filter === 'weapon' || !filter) {
      if (categorizedItems.weapon.length > 0) {
        message += `⚔️ *SENJATA* (${categorizedItems.weapon.length}) ⚔️\n`;
        categorizedItems.weapon.forEach(item => {
          message += `- ${item.name} (${item.itemId})\n`;
          message += `  Tier: ${item.tier}, Level: ${item.requiredLevel}\n`;
        });
        message += `\n`;
      }
    }
    
    if (filter === 'armor' || !filter) {
      if (categorizedItems.armor.length > 0) {
        message += `🛡️ *ARMOR* (${categorizedItems.armor.length}) 🛡️\n`;
        categorizedItems.armor.forEach(item => {
          message += `- ${item.name} (${item.itemId})\n`;
          message += `  Tier: ${item.tier}, Level: ${item.requiredLevel}\n`;
        });
        message += `\n`;
      }
    }
    
    if (filter === 'consumable' || !filter) {
      if (categorizedItems.consumable.length > 0) {
        message += `🧪 *CONSUMABLE* (${categorizedItems.consumable.length}) 🧪\n`;
        categorizedItems.consumable.forEach(item => {
          message += `- ${item.name} (${item.itemId})\n`;
          message += `  Tier: ${item.tier}, Level: ${item.requiredLevel}\n`;
        });
        message += `\n`;
      }
    }
    
    if (filter === 'resource' || !filter) {
      if (categorizedItems.resource.length > 0) {
        message += `📦 *RESOURCE* (${categorizedItems.resource.length}) 📦\n`;
        categorizedItems.resource.forEach(item => {
          message += `- ${item.name} (${item.itemId})\n`;
          message += `  Tier: ${item.tier}, Level: ${item.requiredLevel}\n`;
        });
        message += `\n`;
      }
    }
    
    // Tambahkan tips penggunaan filter
    message += `Filter yang tersedia:\n`;
    message += `- !craftlist weapon - hanya tampilkan senjata\n`;
    message += `- !craftlist armor - hanya tampilkan armor\n`;
    message += `- !craftlist consumable - hanya tampilkan consumable\n`;
    message += `- !craftlist tier1 - hanya tampilkan item tier 1\n\n`;
    message += `Untuk melihat detail crafting, gunakan: !craftinfo [item_id]`;
    
    return {
      status: true,
      message
    };
  } catch (error) {
    logger.error(`Error viewing craftable items: ${error.message}`);
    return {
      status: false,
      message: `Terjadi kesalahan saat melihat daftar item: ${error.message}`
    };
  }
};

// Di messageHandler.js, implementasi yang disarankan:
/*
case 'craftlist':
  if (args.length === 0) {
    response = await viewCraftableItems(senderId);
  } else {
    response = await viewCraftableItems(senderId, args[0]);
  }
  break;
*/

// Tampilkan implementasi untuk kejelasan pengembang
console.log(`
Implementasi yang direkomendasikan untuk messageHandler.js:

case 'craftlist':
  if (args.length === 0) {
    response = await viewCraftableItems(senderId);
  } else {
    response = await viewCraftableItems(senderId, args[0]);
  }
  break;
`);

console.log(`
Untuk mengimplementasikan perubahan ini:
1. Update fungsi viewCraftableItems di src/controllers/craftController.js dengan kode yang ada di file ini
2. Perbarui case 'craftlist' di src/controllers/messageHandler.js untuk meneruskan parameter filter
`);
