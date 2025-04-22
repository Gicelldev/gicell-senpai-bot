const Player = require('../models/Player');
const Item = require('../models/Item');
const logger = require('../utils/logger');
const { updateQuestProgress } = require('./questController');

/**
 * Membuat item dari resource
 * @param {String} userId - ID pengguna WhatsApp
 * @param {String} itemId - ID item yang akan dibuat
 * @returns {Object} - Status dan pesan respons
 */
const craftItem = async (userId, itemId) => {
  try {
    // Validasi input
    if (!itemId) {
      return {
        status: false,
        message: 'Silakan tentukan item yang ingin dibuat. Contoh: !craft wooden_sword'
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
    
    // Cari item yang ingin dibuat
    const item = await Item.findByNameOrId(itemId);
    
    if (!item) {
      // Tampilkan beberapa item yang dapat dibuat jika item tidak ditemukan
      const craftableItems = await Item.find({ 
        craftingRequirements: { $exists: true, $ne: [] }
      }).limit(5);
      
      let suggestionMessage = '';
      if (craftableItems && craftableItems.length > 0) {
        suggestionMessage = '\n\nBeberapa item yang dapat dibuat:\n';
        craftableItems.forEach(item => {
          suggestionMessage += `- ${item.name} (${item.itemId})\n`;
        });
      }
      
      return {
        status: false,
        message: `Item dengan nama "${itemId}" tidak ditemukan.${suggestionMessage}`
      };
    }
    
    // Cek apakah item memiliki crafting requirements
    if (!item.craftingRequirements || item.craftingRequirements.length === 0) {
      return {
        status: false,
        message: `Item "${item.name}" tidak dapat dibuat.`
      };
    }
    
    // Cek level pemain
    if (player.level < item.requiredLevel) {
      return {
        status: false,
        message: `Level Anda (${player.level}) tidak cukup untuk membuat "${item.name}". Diperlukan level ${item.requiredLevel}.`
      };
    }

    // Cek crafting skill pemain jika itemnya tier tinggi
    if (item.tier > 1 && player.stats.crafting < item.tier * 10) {
      return {
        status: false,
        message: `Skill crafting Anda (${player.stats.crafting}) tidak cukup untuk membuat item tier ${item.tier}. Diperlukan skill ${item.tier * 10}.`
      };
    }
    
    // Cek resource yang diperlukan
    const missingResources = [];
    const resourceDetails = [];
    
    for (const requirement of item.craftingRequirements) {
      const requiredItemId = requirement.itemId;
      const requiredQuantity = requirement.quantity;
      
      // Cari resource di inventory pemain
      const playerResource = player.inventory.find(i => i.itemId === requiredItemId);
      
      // Cari detail resource dari database untuk tampilan nama yang lebih baik
      let resourceItem;
      try {
        resourceItem = await Item.findByNameOrId(requiredItemId);
      } catch (err) {
        logger.error(`Error finding resource item: ${err.message}`);
      }
      
      const resourceName = resourceItem ? resourceItem.name : requiredItemId;
      const currentQuantity = playerResource ? playerResource.quantity : 0;
      
      resourceDetails.push({
        name: resourceName,
        current: currentQuantity,
        required: requiredQuantity
      });
      
      if (!playerResource || playerResource.quantity < requiredQuantity) {
        missingResources.push({
          name: resourceName,
          current: currentQuantity,
          required: requiredQuantity
        });
      }
    }
    
    // Jika ada resource yang kurang
    if (missingResources.length > 0) {
      let message = `Resource tidak cukup untuk membuat "${item.name}":\n\n`;
      
      resourceDetails.forEach(resource => {
        const isMissing = missingResources.some(r => r.name === resource.name);
        const statusEmoji = isMissing ? '❌' : '✅';
        message += `${statusEmoji} ${resource.name}: ${resource.current}/${resource.required}\n`;
      });
      
      // Tampilkan info zona untuk mendapatkan resource yang kurang
      if (missingResources.length > 0) {
        message += '\nTips: Gunakan !gather [resource] untuk mengumpulkan resource.';
      }
      
      return {
        status: false,
        message
      };
    }
    
    // Kurangi resource dari inventory
    for (const requirement of item.craftingRequirements) {
      if (!player.removeItem(requirement.itemId, requirement.quantity)) {
        logger.error(`Failed to remove item ${requirement.itemId} from player inventory`);
        return {
          status: false,
          message: 'Terjadi kesalahan saat mencoba mengurangi resource dari inventory.'
        };
      }
    }
    
    // Generate item baru dan tambahkan ke inventory
    const craftedItem = {
      itemId: item.itemId,
      name: item.name,
      type: item.type,
      tier: item.tier,
      stats: { ...item.stats },
      quantity: 1
    };
    
    player.addItem(craftedItem);
    
    // Tingkatkan skill crafting
    const skillIncrease = Math.random() < 0.4 ? 1 : 0; // 40% chance
    if (skillIncrease > 0) {
      player.stats.crafting += skillIncrease;
    }
    
    // Tambah pengalaman
    const expGained = item.tier * 10;
    player.addExperience(expGained);
    
    // Simpan perubahan
    await player.save();
    
    logger.info(`Player ${player.name} crafted ${item.name}`);
    
    // Update quest progress untuk crafting
    await updateQuestProgress(player.userId, 'craft', craftedItem.itemId, 1);
    
    // Buat pesan respons
    let message = `🛠️ CRAFTING BERHASIL 🛠️\n\n`;
    message += `Anda berhasil membuat ${item.name}!\n\n`;
    
    // Tambahkan info item jika weapon atau armor
    if (item.type === 'weapon' || item.type === 'armor') {
      const statInfo = item.type === 'weapon' 
        ? `Damage: ${item.stats.damage}` 
        : `Defense: ${item.stats.defense}`;
        
      message += `Tier: ${item.tier}\n`;
      message += `${statInfo}\n\n`;
    }
    
    message += `EXP didapat: ${expGained}\n`;
    
    if (skillIncrease > 0) {
      message += `Skill crafting meningkat: ${player.stats.crafting-skillIncrease} → ${player.stats.crafting}\n`;
    }
    
    return {
      status: true,
      message
    };
  } catch (error) {
    logger.error(`Error crafting item: ${error.message}`);
    return {
      status: false,
      message: `Terjadi kesalahan saat membuat item: ${error.message}`
    };
  }
};

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

/**
 * Menampilkan info crafting untuk item tertentu
 * @param {String} userId - ID pengguna WhatsApp
 * @param {String} itemId - ID item yang akan dilihat
 * @returns {Object} - Status dan pesan respons
 */
const viewCraftingInfo = async (userId, itemId) => {
  try {
    if (!itemId) {
      return {
        status: false,
        message: 'Silakan tentukan item yang ingin dilihat. Contoh: !craftinfo wooden_sword'
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
    
    // Cari item dalam database
    const item = await Item.findByNameOrId(itemId);
    
    if (!item) {
      return {
        status: false,
        message: `Item dengan nama "${itemId}" tidak ditemukan.`
      };
    }
    
    // Cek apakah item dapat di-craft
    if (!item.craftingRequirements || item.craftingRequirements.length === 0) {
      return {
        status: false,
        message: `Item "${item.name}" tidak dapat di-craft.`
      };
    }
    
    // Ambil detail resource yang dibutuhkan
    const resources = [];
    
    for (const requirement of item.craftingRequirements) {
      const requiredItemId = requirement.itemId;
      const requiredQuantity = requirement.quantity;
      
      // Cari resource di inventory pemain
      const playerResource = player.inventory.find(i => i.itemId === requiredItemId);
      
      // Cari detail resource dari database
      const resourceItem = await Item.findByNameOrId(requiredItemId);
      const resourceName = resourceItem ? resourceItem.name : requiredItemId;
      const currentQuantity = playerResource ? playerResource.quantity : 0;
      
      resources.push({
        name: resourceName,
        current: currentQuantity,
        required: requiredQuantity,
        sufficient: currentQuantity >= requiredQuantity
      });
    }
    
    // Buat pesan respons
    let message = `🛠️ INFO CRAFTING: ${item.name} 🛠️\n\n`;
    
    // Tambahkan info item
    message += `Tier: ${item.tier}\n`;
    message += `Required Level: ${item.requiredLevel}\n`;
    
    if (item.type === 'weapon') {
      message += `Damage: ${item.stats.damage || 0}\n`;
    } else if (item.type === 'armor') {
      message += `Defense: ${item.stats.defense || 0}\n`;
    }
    
    if (item.description) {
      message += `\nDeskripsi: ${item.description}\n`;
    }
    
    // Tambahkan resource requirements
    message += `\nMaterial yang dibutuhkan:\n`;
    
    resources.forEach(resource => {
      const statusEmoji = resource.sufficient ? '✅' : '❌';
      message += `${statusEmoji} ${resource.name}: ${resource.current}/${resource.required}\n`;
    });
    
    // Cek apakah player memenuhi requirements
    const allResourcesSufficient = resources.every(r => r.sufficient);
    const levelSufficient = player.level >= item.requiredLevel;
    const craftingSkillSufficient = 
      item.tier === 1 || player.stats.crafting >= item.tier * 10;
    
    message += `\nStatus:\n`;
    message += `${levelSufficient ? '✅' : '❌'} Level pemain: ${player.level}/${item.requiredLevel}\n`;
    
    if (item.tier > 1) {
      message += `${craftingSkillSufficient ? '✅' : '❌'} Skill crafting: ${player.stats.crafting}/${item.tier * 10}\n`;
    }
    
    message += `${allResourcesSufficient ? '✅' : '❌'} Material: ${allResourcesSufficient ? 'Cukup' : 'Tidak cukup'}\n\n`;
    
    if (levelSufficient && craftingSkillSufficient && allResourcesSufficient) {
      message += `Anda dapat membuat item ini! Gunakan: !craft ${item.itemId}`;
    } else {
      message += `Anda belum dapat membuat item ini. Penuhi semua persyaratan terlebih dahulu.`;
    }
    
    return {
      status: true,
      message
    };
  } catch (error) {
    logger.error(`Error viewing crafting info: ${error.message}`);
    return {
      status: false,
      message: `Terjadi kesalahan saat melihat info crafting: ${error.message}`
    };
  }
};

module.exports = {
  craftItem,
  viewCraftableItems,
  viewCraftingInfo
}; 