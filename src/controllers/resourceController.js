const Player = require('../models/Player');
const logger = require('../utils/logger');
const { generateRandomItem } = require('../utils/itemGenerator');
const { updateQuestProgress } = require('./questController');

/**
 * Memproses pengumpulan resource oleh pemain
 * @param {String} userId - ID pengguna WhatsApp
 * @param {String} resourceType - Jenis resource yang dikumpulkan
 * @returns {Object} - Status dan pesan respons
 */
const gatherResource = async (userId, resourceType) => {
  try {
    // Validasi jenis resource
    const validResources = ['kayu', 'wood', 'batu', 'stone', 'ore', 'fiber', 'hide'];
    
    if (!resourceType || !validResources.includes(resourceType.toLowerCase())) {
      return {
        status: false,
        message: `Jenis resource tidak valid. Gunakan salah satu dari: kayu/wood, batu/stone, ore, fiber, hide.\n\nContoh: !gather kayu`
      };
    }
    
    // Standardisasi nama resource
    const normalizedType = normalizeResourceType(resourceType);
    
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
    
    // Dapatkan skill gathering pemain untuk resource tersebut
    const gatheringSkill = player.stats.gathering[normalizedType];
    
    // Dapatkan prefix tier berdasarkan skill
    const tier = Math.min(Math.ceil(gatheringSkill / 20), 8); // Max tier 8
    
    // Generate resource berdasarkan tier
    const gatheredResources = generateGatheredResources(normalizedType, tier, gatheringSkill);
    
    // Tambahkan resource ke inventory pemain
    gatheredResources.items.forEach(item => {
      player.addItem(item);
    });
    
    // Tambahkan pengalaman
    const expGained = 5 + tier * 2;
    player.addExperience(expGained);
    
    // Tingkatkan skill gathering
    const skillIncrease = Math.random() < 0.3 ? 1 : 0; // 30% chance to increase skill
    if (skillIncrease > 0) {
      player.stats.gathering[normalizedType] += skillIncrease;
    }
    
    // Simpan perubahan pemain
    await player.save();
    
    // Update quest progress untuk resource yang dikumpulkan
    await updateQuestProgress(player.userId, 'gather', gatheredResources.items[0].itemId, gatheredResources.items[0].quantity);
    
    logger.info(`Player ${player.name} gathered ${normalizedType} resources: ${gatheredResources.totalQuantity}`);
    
    // Buat pesan respons
    let responseMessage = `🌲 GATHERING ${normalizedType.toUpperCase()} 🌲\n\n`;
    
    // Tambahkan informasi resource yang didapat
    responseMessage += `Resource yang didapat:\n`;
    gatheredResources.items.forEach(item => {
      responseMessage += `- ${item.name} x${item.quantity}\n`;
    });
    
    // Tambahkan informasi exp dan skill
    responseMessage += `\nEXP didapat: ${expGained}\n`;
    
    if (skillIncrease > 0) {
      responseMessage += `Skill ${normalizedType} meningkat: ${player.stats.gathering[normalizedType]-skillIncrease} → ${player.stats.gathering[normalizedType]}\n`;
    }
    
    // Tambahkan chance untuk rare drop jika di zona berbahaya
    if (player.currentZone !== 'safe' && Math.random() < 0.05) {
      const rareItem = generateRandomItem(Math.random() < 0.5 ? 'weapon' : 'armor', tier + 1);
      player.addItem(rareItem);
      await player.save();
      
      responseMessage += `\n💎 RARE DROP! 💎\nAnda menemukan ${rareItem.name}!\n`;
    }
    
    return {
      status: true,
      message: responseMessage
    };
  } catch (error) {
    logger.error(`Error gathering resources: ${error.message}`);
    return {
      status: false,
      message: `Terjadi kesalahan saat mengumpulkan resource: ${error.message}`
    };
  }
};

/**
 * Standardisasi nama resource
 * @param {String} resourceType - Nama resource yang diinput user
 * @returns {String} - Nama resource yang distandarisasi
 */
const normalizeResourceType = (resourceType) => {
  const type = resourceType.toLowerCase();
  
  if (type === 'kayu' || type === 'wood') {
    return 'wood';
  }
  
  if (type === 'batu' || type === 'stone') {
    return 'stone';
  }
  
  return type; // ore, fiber, hide sudah sesuai
};

/**
 * Generate resource yang didapat berdasarkan tier dan skill
 * @param {String} type - Jenis resource
 * @param {Number} tier - Tier resource
 * @param {Number} skill - Skill gathering pemain
 * @returns {Object} - Object berisi array item dan total kuantitas
 */
const generateGatheredResources = (type, tier, skill) => {
  // Prefix tier untuk nama item
  const tierPrefixes = [
    'Rough',      // T1
    'Simple',     // T2
    'Journeyman', // T3
    'Adept',      // T4
    'Expert',     // T5
    'Master',     // T6
    'Grandmaster',// T7
    'Elder'       // T8
  ];
  
  // Resource mapping untuk ID item
  const resourceMapping = {
    'wood': 'logs',
    'stone': 'stone',
    'ore': 'ore',
    'fiber': 'fiber',
    'hide': 'hide'
  };
  
  // Base quantity berdasarkan skill
  const baseQuantity = Math.floor(5 + (skill * 0.5));
  
  // Generate random quantity dengan variasi
  const quantity = Math.max(1, Math.floor(baseQuantity * (0.8 + (Math.random() * 0.4))));
  
  // Membuat item resource
  const tierPrefix = tierPrefixes[tier - 1];
  const resourceName = resourceMapping[type];
  
  const mainResource = {
    itemId: `${tierPrefix.toLowerCase()}_${resourceName}`,
    name: `${tierPrefix} ${resourceName.charAt(0).toUpperCase() + resourceName.slice(1)}`,
    type: 'resource',
    tier: tier,
    quantity: quantity
  };
  
  // Terkadang mendapatkan resource dari tier yang lebih rendah
  const items = [mainResource];
  let totalQuantity = quantity;
  
  // 30% chance untuk mendapatkan resource tier di bawahnya juga
  if (tier > 1 && Math.random() < 0.3) {
    const lowerTierPrefix = tierPrefixes[tier - 2];
    const lowerTierQuantity = Math.floor(quantity * 0.5);
    
    if (lowerTierQuantity > 0) {
      items.push({
        itemId: `${lowerTierPrefix.toLowerCase()}_${resourceName}`,
        name: `${lowerTierPrefix} ${resourceName.charAt(0).toUpperCase() + resourceName.slice(1)}`,
        type: 'resource',
        tier: tier - 1,
        quantity: lowerTierQuantity
      });
      
      totalQuantity += lowerTierQuantity;
    }
  }
  
  return { items, totalQuantity };
};

module.exports = {
  gatherResource
}; 