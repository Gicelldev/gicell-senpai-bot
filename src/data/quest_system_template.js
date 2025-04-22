/**
 * Quest Generator - Template untuk sistem quest dinamis
 * Modul ini menyediakan fungsi untuk generate quest secara dinamis berdasarkan level pemain,
 * tracking progress otomatis, dan pemberian reward yang sesuai.
 */

const mongoose = require('mongoose');
const Player = require('../models/Player');
const Item = require('../models/Item');
const logger = require('../utils/logger');

/**
 * Jenis-jenis quest yang tersedia
 */
const QUEST_TYPES = {
  GATHER: 'gather',    // Mengumpulkan resource
  HUNT: 'hunt',        // Membunuh monster
  CRAFT: 'craft',      // Membuat item
  EXPLORE: 'explore',  // Jelajahi zona
  DUNGEON: 'dungeon',  // Selesaikan dungeon
  MARKET: 'market',    // Jual/beli di market
  LEVEL: 'level',      // Naik level
  SKILLUP: 'skillup'   // Naikkan skill
};

/**
 * Quest difficulties beserta multipier exp dan reward
 */
const QUEST_DIFFICULTIES = {
  EASY: { name: 'Mudah', xpMultiplier: 1.0, rewardMultiplier: 1.0 },
  MEDIUM: { name: 'Sedang', xpMultiplier: 1.5, rewardMultiplier: 1.5 },
  HARD: { name: 'Sulit', xpMultiplier: 2.0, rewardMultiplier: 2.0 },
  CHALLENGING: { name: 'Menantang', xpMultiplier: 3.0, rewardMultiplier: 3.0 },
  EPIC: { name: 'Epik', xpMultiplier: 5.0, rewardMultiplier: 5.0 }
};

/**
 * Generate quest harian acak untuk pemain
 * @param {Player} player - Objek player
 * @param {Number} count - Jumlah quest yang akan digenerate
 * @returns {Array} Array berisi quest yang digenerate
 */
const generateDailyQuests = async (player, count = 5) => {
  const playerLevel = player.level;
  const quests = [];
  
  // Generate quest unik (tidak ada duplikat tipe yang sama)
  const usedTypes = new Set();
  
  for (let i = 0; i < count; i++) {
    // Pilih tipe quest secara acak yang belum dipilih
    let availableTypes = Object.values(QUEST_TYPES).filter(type => !usedTypes.has(type));
    
    // Jika semua tipe sudah digunakan, reset
    if (availableTypes.length === 0) {
      usedTypes.clear();
      availableTypes = Object.values(QUEST_TYPES);
    }
    
    const questType = availableTypes[Math.floor(Math.random() * availableTypes.length)];
    usedTypes.add(questType);
    
    // Generate quest berdasarkan tipe
    let quest;
    switch (questType) {
      case QUEST_TYPES.GATHER:
        quest = await generateGatherQuest(player);
        break;
      case QUEST_TYPES.HUNT:
        quest = await generateHuntQuest(player);
        break;
      case QUEST_TYPES.CRAFT:
        quest = await generateCraftQuest(player);
        break;
      case QUEST_TYPES.EXPLORE:
        quest = await generateExploreQuest(player);
        break;
      case QUEST_TYPES.DUNGEON:
        quest = await generateDungeonQuest(player);
        break;
      case QUEST_TYPES.MARKET:
        quest = await generateMarketQuest(player);
        break;
      case QUEST_TYPES.LEVEL:
        quest = await generateLevelQuest(player);
        break;
      case QUEST_TYPES.SKILLUP:
        quest = await generateSkillupQuest(player);
        break;
      default:
        quest = await generateGatherQuest(player);
    }
    
    quests.push(quest);
  }
  
  return quests;
};

/**
 * Generate quest gather resource
 * @param {Player} player - Objek player
 * @returns {Object} Quest object
 */
const generateGatherQuest = async (player) => {
  const playerLevel = player.level;
  const currentZone = player.currentZone;
  
  // Tentukan tier resource berdasarkan level pemain
  let resourceTier = 1;
  if (playerLevel >= 20) resourceTier = 4;
  else if (playerLevel >= 10) resourceTier = 3;
  else if (playerLevel >= 5) resourceTier = 2;
  
  // Ambil resource acak dari tier yang sesuai
  const resources = await Item.find({
    type: 'resource',
    tier: { $lte: resourceTier }
  });
  
  if (!resources || resources.length === 0) {
    logger.error('No resources found for gathering quest');
    return generateDefaultQuest(player, QUEST_TYPES.GATHER);
  }
  
  // Pilih resource acak
  const resource = resources[Math.floor(Math.random() * resources.length)];
  
  // Hitung jumlah berdasarkan tier dan level
  const baseAmount = 10;
  const tierMultiplier = resource.tier;
  const amount = Math.floor(baseAmount * tierMultiplier * (0.8 + Math.random() * 0.4));
  
  // Tentukan difficulty berdasarkan resource tier dan jumlah
  let difficulty;
  if (resource.tier > playerLevel / 5 + 1) {
    difficulty = QUEST_DIFFICULTIES.HARD;
  } else if (amount > baseAmount * tierMultiplier * 1.1) {
    difficulty = QUEST_DIFFICULTIES.MEDIUM;
  } else {
    difficulty = QUEST_DIFFICULTIES.EASY;
  }
  
  // Hitung reward
  const baseExp = 50 * tierMultiplier;
  const baseGmoney = 30 * tierMultiplier;
  
  const exp = Math.floor(baseExp * difficulty.xpMultiplier);
  const gmoney = Math.floor(baseGmoney * difficulty.rewardMultiplier);
  
  // Generate quest object
  return {
    id: mongoose.Types.ObjectId(),
    title: `Kumpulkan ${resource.name}`,
    description: `Kumpulkan ${amount} ${resource.name} dari ${getZoneName(currentZone)}.`,
    type: QUEST_TYPES.GATHER,
    difficulty: difficulty.name,
    requirements: {
      resourceId: resource.itemId,
      amount: amount
    },
    progress: 0,
    rewards: {
      exp: exp,
      gmoney: gmoney,
      items: []
    },
    completed: false,
    claimed: false,
    expiry: getTomorrowMidnight(),
    questType: 'daily'
  };
};

/**
 * Generate quest berburu monster
 * @param {Player} player - Objek player
 * @returns {Object} Quest object
 */
const generateHuntQuest = async (player) => {
  const playerLevel = player.level;
  
  // Daftar monster berdasarkan zona dan level
  const monsters = getMonstersByLevel(playerLevel);
  
  // Pilih monster acak
  const monster = monsters[Math.floor(Math.random() * monsters.length)];
  
  // Hitung jumlah berdasarkan tier monster
  const baseAmount = 5;
  const tierMultiplier = monster.tier;
  const amount = Math.floor(baseAmount * (0.8 + Math.random() * 0.4));
  
  // Tentukan difficulty berdasarkan tier monster dan level pemain
  let difficulty;
  if (monster.tier > playerLevel / 5 + 1) {
    difficulty = QUEST_DIFFICULTIES.HARD;
  } else if (monster.tier === playerLevel / 5 + 1) {
    difficulty = QUEST_DIFFICULTIES.MEDIUM;
  } else {
    difficulty = QUEST_DIFFICULTIES.EASY;
  }
  
  // Hitung reward
  const baseExp = 100 * tierMultiplier;
  const baseGmoney = 50 * tierMultiplier;
  
  const exp = Math.floor(baseExp * difficulty.xpMultiplier);
  const gmoney = Math.floor(baseGmoney * difficulty.rewardMultiplier);
  
  // Kemungkinan tambahan item reward
  const itemRewards = [];
  if (Math.random() < 0.3) {
    // 30% kemungkinan mendapat item sebagai reward
    const possibleItems = await Item.find({
      tier: { $lte: monster.tier },
      type: { $in: ['weapon', 'armor', 'consumable'] }
    }).limit(10);
    
    if (possibleItems && possibleItems.length > 0) {
      const rewardItem = possibleItems[Math.floor(Math.random() * possibleItems.length)];
      itemRewards.push({
        itemId: rewardItem.itemId,
        name: rewardItem.name,
        quantity: 1
      });
    }
  }
  
  // Generate quest object
  return {
    id: mongoose.Types.ObjectId(),
    title: `Berburu ${monster.name}`,
    description: `Kalahkan ${amount} ${monster.name} di ${monster.zone}.`,
    type: QUEST_TYPES.HUNT,
    difficulty: difficulty.name,
    requirements: {
      monsterId: monster.id,
      monsterName: monster.name,
      amount: amount
    },
    progress: 0,
    rewards: {
      exp: exp,
      gmoney: gmoney,
      items: itemRewards
    },
    completed: false,
    claimed: false,
    expiry: getTomorrowMidnight(),
    questType: 'daily'
  };
};

/**
 * Generate quest craft item
 * @param {Player} player - Objek player
 * @returns {Object} Quest object
 */
const generateCraftQuest = async (player) => {
  const playerLevel = player.level;
  const craftingSkill = player.stats.crafting;
  
  // Ambil item yang bisa di-craft berdasarkan level pemain
  const craftableItems = await Item.find({
    craftingRequirements: { $exists: true, $ne: [] },
    requiredLevel: { $lte: playerLevel }
  });
  
  if (!craftableItems || craftableItems.length === 0) {
    logger.error('No craftable items found for crafting quest');
    return generateDefaultQuest(player, QUEST_TYPES.CRAFT);
  }
  
  // Filter item berdasarkan skill crafting player
  const eligibleItems = craftableItems.filter(item => {
    return item.tier === 1 || craftingSkill >= item.tier * 8;
  });
  
  if (eligibleItems.length === 0) {
    // Jika tidak ada item yang sesuai skill crafting, ambil item tier 1
    const tier1Items = craftableItems.filter(item => item.tier === 1);
    if (tier1Items.length > 0) {
      eligibleItems.push(...tier1Items);
    } else {
      return generateDefaultQuest(player, QUEST_TYPES.CRAFT);
    }
  }
  
  // Pilih item acak
  const item = eligibleItems[Math.floor(Math.random() * eligibleItems.length)];
  
  // Hitung jumlah berdasarkan tier item
  const baseAmount = 2;
  const amount = Math.max(1, Math.floor(baseAmount / item.tier));
  
  // Tentukan difficulty berdasarkan tier item
  let difficulty;
  if (item.tier >= 3) {
    difficulty = QUEST_DIFFICULTIES.HARD;
  } else if (item.tier === 2) {
    difficulty = QUEST_DIFFICULTIES.MEDIUM;
  } else {
    difficulty = QUEST_DIFFICULTIES.EASY;
  }
  
  // Hitung reward
  const baseExp = 100 * item.tier;
  const baseGmoney = 60 * item.tier;
  
  const exp = Math.floor(baseExp * difficulty.xpMultiplier);
  const gmoney = Math.floor(baseGmoney * difficulty.rewardMultiplier);
  
  // Generate quest object
  return {
    id: mongoose.Types.ObjectId(),
    title: `Craft ${item.name}`,
    description: `Buat ${amount} ${item.name} menggunakan keterampilan crafting Anda.`,
    type: QUEST_TYPES.CRAFT,
    difficulty: difficulty.name,
    requirements: {
      itemId: item.itemId,
      itemName: item.name,
      amount: amount
    },
    progress: 0,
    rewards: {
      exp: exp,
      gmoney: gmoney,
      items: []
    },
    completed: false,
    claimed: false,
    expiry: getTomorrowMidnight(),
    questType: 'daily'
  };
};

/**
 * Generate quest jelajah zona
 * @param {Player} player - Objek player
 * @returns {Object} Quest object
 */
const generateExploreQuest = async (player) => {
  const playerLevel = player.level;
  
  // Daftar zona yang bisa dijelajahi berdasarkan level
  const zones = getExploreZonesByLevel(playerLevel);
  
  // Pilih zona acak
  const zone = zones[Math.floor(Math.random() * zones.length)];
  
  // Tentukan difficulty berdasarkan zona
  let difficulty;
  switch (zone.id) {
    case 'black':
      difficulty = QUEST_DIFFICULTIES.CHALLENGING;
      break;
    case 'red':
      difficulty = QUEST_DIFFICULTIES.HARD;
      break;
    case 'yellow':
      difficulty = QUEST_DIFFICULTIES.MEDIUM;
      break;
    default:
      difficulty = QUEST_DIFFICULTIES.EASY;
  }
  
  // Hitung reward
  const baseExp = 80;
  const baseGmoney = 40;
  
  const exp = Math.floor(baseExp * difficulty.xpMultiplier);
  const gmoney = Math.floor(baseGmoney * difficulty.rewardMultiplier);
  
  // Generate quest object
  return {
    id: mongoose.Types.ObjectId(),
    title: `Jelajahi ${zone.name}`,
    description: `Jelajahi ${zone.name} dan kembali dengan selamat.`,
    type: QUEST_TYPES.EXPLORE,
    difficulty: difficulty.name,
    requirements: {
      zoneId: zone.id,
      visitCount: 1
    },
    progress: 0,
    rewards: {
      exp: exp,
      gmoney: gmoney,
      items: []
    },
    completed: false,
    claimed: false,
    expiry: getTomorrowMidnight(),
    questType: 'daily'
  };
};

// Helper functions
const getTomorrowMidnight = () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow;
};

const getZoneName = (zoneId) => {
  const zones = {
    'safe': 'Safe Zone',
    'yellow': 'Yellow Zone',
    'red': 'Red Zone',
    'black': 'Black Zone'
  };
  return zones[zoneId] || 'Unknown Zone';
};

const getMonstersByLevel = (level) => {
  const monsters = [
    // Safe Zone Monsters (Tier 1)
    { id: 'wolf', name: 'Wolf', tier: 1, zone: 'Safe Zone', minLevel: 1 },
    { id: 'boar', name: 'Boar', tier: 1, zone: 'Safe Zone', minLevel: 1 },
    { id: 'bandit', name: 'Bandit', tier: 1, zone: 'Safe Zone', minLevel: 1 },
    
    // Yellow Zone Monsters (Tier 2)
    { id: 'dire_wolf', name: 'Dire Wolf', tier: 2, zone: 'Yellow Zone', minLevel: 5 },
    { id: 'rogue', name: 'Rogue', tier: 2, zone: 'Yellow Zone', minLevel: 5 },
    { id: 'skeleton', name: 'Skeleton', tier: 2, zone: 'Yellow Zone', minLevel: 5 },
    
    // Red Zone Monsters (Tier 3)
    { id: 'troll', name: 'Troll', tier: 3, zone: 'Red Zone', minLevel: 10 },
    { id: 'golem', name: 'Golem', tier: 3, zone: 'Red Zone', minLevel: 10 },
    { id: 'harpy', name: 'Harpy', tier: 3, zone: 'Red Zone', minLevel: 10 },
    
    // Black Zone Monsters (Tier 4+)
    { id: 'dragon', name: 'Dragon', tier: 4, zone: 'Black Zone', minLevel: 20 },
    { id: 'necromancer', name: 'Necromancer', tier: 4, zone: 'Black Zone', minLevel: 20 },
    { id: 'demonic_knight', name: 'Demonic Knight', tier: 4, zone: 'Black Zone', minLevel: 20 }
  ];
  
  return monsters.filter(monster => monster.minLevel <= level);
};

const getExploreZonesByLevel = (level) => {
  const zones = [
    { id: 'safe', name: 'Safe Zone', minLevel: 1 },
    { id: 'yellow', name: 'Yellow Zone', minLevel: 5 },
    { id: 'red', name: 'Red Zone', minLevel: 10 },
    { id: 'black', name: 'Black Zone', minLevel: 20 }
  ];
  
  return zones.filter(zone => zone.minLevel <= level);
};

const generateDefaultQuest = (player, type) => {
  // Generate quest default jika tidak ada data yang sesuai
  return {
    id: mongoose.Types.ObjectId(),
    title: `Quest ${type}`,
    description: `Sebuah quest ${type} sederhana.`,
    type: type,
    difficulty: QUEST_DIFFICULTIES.EASY.name,
    requirements: {
      amount: 5
    },
    progress: 0,
    rewards: {
      exp: 50,
      gmoney: 30,
      items: []
    },
    completed: false,
    claimed: false,
    expiry: getTomorrowMidnight(),
    questType: 'daily'
  };
};

/**
 * Update progress quest secara otomatis berdasarkan aktivitas player
 * @param {String} userId - ID pemain
 * @param {String} activityType - Tipe aktivitas (gather, hunt, dll)
 * @param {Object} data - Data terkait aktivitas
 * @returns {Promise<Array>} - Daftar quest yang telah diupdate
 */
const updateQuestProgress = async (userId, activityType, data) => {
  try {
    // Cari pemain
    const player = await Player.findByUserId(userId);
    
    if (!player) {
      logger.error(`Player not found for userId: ${userId}`);
      return [];
    }
    
    // Ambil quest aktif pemain
    const activeQuests = player.quests ? player.quests.filter(q => !q.completed && !q.claimed) : [];
    
    if (!activeQuests || activeQuests.length === 0) {
      return [];
    }
    
    // Filter quest yang relevan dengan aktivitas
    const updatedQuests = [];
    
    for (const quest of activeQuests) {
      let updated = false;
      
      switch (activityType) {
        case 'gather':
          if (quest.type === QUEST_TYPES.GATHER && 
              quest.requirements.resourceId === data.resourceId) {
            quest.progress += data.amount || 1;
            updated = true;
          }
          break;
          
        case 'hunt':
          if (quest.type === QUEST_TYPES.HUNT && 
              quest.requirements.monsterId === data.monsterId) {
            quest.progress += data.amount || 1;
            updated = true;
          }
          break;
          
        case 'craft':
          if (quest.type === QUEST_TYPES.CRAFT && 
              quest.requirements.itemId === data.itemId) {
            quest.progress += data.amount || 1;
            updated = true;
          }
          break;
          
        case 'explore':
          if (quest.type === QUEST_TYPES.EXPLORE && 
              quest.requirements.zoneId === data.zoneId) {
            quest.progress += 1;
            updated = true;
          }
          break;
          
        // Tambahkan case lain sesuai jenis quest
      }
      
      // Cek apakah quest sudah selesai
      if (updated) {
        if (quest.progress >= quest.requirements.amount || 
            (quest.type === QUEST_TYPES.EXPLORE && quest.progress >= quest.requirements.visitCount)) {
          quest.completed = true;
          
          // Tambahkan notifikasi
          player.notifications.push({
            title: 'Quest Selesai',
            content: `Quest "${quest.title}" telah selesai. Klaim hadiahmu!`,
            timestamp: new Date(),
            read: false
          });
        }
        
        updatedQuests.push(quest);
      }
    }
    
    // Simpan perubahan jika ada
    if (updatedQuests.length > 0) {
      await player.save();
    }
    
    return updatedQuests;
  } catch (error) {
    logger.error(`Error updating quest progress: ${error.message}`);
    return [];
  }
};

module.exports = {
  QUEST_TYPES,
  QUEST_DIFFICULTIES,
  generateDailyQuests,
  generateGatherQuest,
  generateHuntQuest,
  generateCraftQuest,
  generateExploreQuest,
  updateQuestProgress
}; 