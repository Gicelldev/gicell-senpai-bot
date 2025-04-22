const Player = require('../models/Player');
const { Quest, PlayerQuest } = require('../models/Quest');
const { createNotification } = require('./notificationController');
const logger = require('../utils/logger');
const mongoose = require('mongoose');
const Item = require('../models/Item');
const questGenerator = require('../data/quest_system_template');

/**
 * Menampilkan daftar quest yang tersedia
 * @param {String} userId - ID pengguna WhatsApp
 * @param {String} type - Tipe quest (daily, weekly, all)
 * @returns {Object} - Status dan pesan respons
 */
const viewQuests = async (userId, type = 'all') => {
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
    
    // Cari quest aktif pemain
    const playerQuests = await PlayerQuest.findActiveForPlayer(player._id);
    
    if (playerQuests.length === 0) {
      // Ambil quest baru sesuai level pemain
      await generateNewQuests(player);
      
      return {
        status: true,
        message: `📜 QUEST 📜\n\nQuest baru telah tersedia. Silakan gunakan !quest lagi untuk melihat daftar quest.`
      };
    }
    
    // Filter quest berdasarkan tipe
    let filteredQuests = playerQuests;
    if (type !== 'all') {
      filteredQuests = playerQuests.filter(q => q.quest.type === type);
    }
    
    if (filteredQuests.length === 0) {
      return {
        status: true,
        message: `📜 QUEST ${type.toUpperCase()} 📜\n\nAnda tidak memiliki quest ${type} yang aktif saat ini.`
      };
    }
    
    // Buat pesan daftar quest
    let questList = '';
    for (const playerQuest of filteredQuests) {
      const quest = playerQuest.quest;
      
      // Hitung progress
      let progressText = '';
      let isCompleted = true;
      
      for (let i = 0; i < quest.requirements.length; i++) {
        const req = quest.requirements[i];
        const progress = playerQuest.progress.find(p => p.requirementIndex === i) || { current: 0, completed: false };
        
        progressText += `  - ${req.description}: ${progress.current}/${req.quantity} ${progress.completed ? '✅' : '⬜'}\n`;
        
        if (!progress.completed) {
          isCompleted = false;
        }
      }
      
      // Format quest
      questList += `${quest.title} (${quest.type}) ${isCompleted ? '✅' : '⬜'}\n`;
      questList += `${quest.description}\n`;
      questList += `Progress:\n${progressText}\n`;
      
      // Tampilkan hadiah
      questList += `Hadiah:\n`;
      quest.rewards.forEach(reward => {
        questList += `  - ${reward.description}\n`;
      });
      
      // Tampilkan status klaim hadiah
      if (playerQuest.isCompleted && !playerQuest.isRewarded) {
        questList += `\nQuest telah selesai! Gunakan !quest klaim ${quest._id} untuk mengklaim hadiah.\n`;
      } else if (playerQuest.isRewarded) {
        questList += `\nHadiah telah diklaim.\n`;
      }
      
      questList += `\n`;
    }
    
    return {
      status: true,
      message: `📜 QUEST ${type.toUpperCase()} 📜\n\n${questList}`
    };
  } catch (error) {
    logger.error(`Error viewing quests: ${error.message}`);
    return {
      status: false,
      message: `Terjadi kesalahan saat melihat quest: ${error.message}`
    };
  }
};

/**
 * Klaim reward dari quest yang sudah selesai
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
const claimQuestReward = async (req, res) => {
  try {
    const userId = req.player.userId;
    const { questId } = req.body;

    if (!questId) {
      return res.status(400).json({ success: false, message: 'ID quest diperlukan' });
    }

    // Validasi player
    const player = await Player.findOne({ userId });
    if (!player) {
      return res.status(404).json({ success: false, message: 'Player tidak ditemukan' });
    }

    // Cari quest yang akan diklaim
    const questIndex = player.quests.findIndex(
      q => q.id.toString() === questId && q.completed && !q.claimed
    );

    if (questIndex === -1) {
      return res.status(404).json({ 
        success: false, 
        message: 'Quest tidak ditemukan atau belum selesai atau sudah diklaim' 
      });
    }

    const quest = player.quests[questIndex];

    // Berikan reward
    player.exp += quest.rewards.exp;
    player.gmoney += quest.rewards.gmoney;

    // Tambahkan item reward jika ada
    for (const itemReward of quest.rewards.items) {
      const existingItem = player.inventory.find(i => i.itemId === itemReward.itemId);
      
      if (existingItem) {
        existingItem.quantity += itemReward.quantity;
      } else {
        player.inventory.push({
          itemId: itemReward.itemId,
          name: itemReward.name,
          quantity: itemReward.quantity
        });
      }
    }

    // Update level jika exp mencukupi
    if (player.exp >= player.maxExp) {
      player.level += 1;
      player.exp -= player.maxExp;
      player.maxExp = Math.floor(player.maxExp * 1.5); // Tingkatkan exp yang dibutuhkan
      
      // Tambahkan notifikasi level up
      player.notifications.push({
        title: 'Level Up!',
        content: `Selamat! Kamu telah naik ke level ${player.level}`,
        timestamp: new Date(),
        read: false
      });
    }

    // Tandai quest sebagai sudah diklaim
    player.quests[questIndex].claimed = true;

    await player.save();

    return res.status(200).json({
      success: true,
      message: 'Reward quest berhasil diklaim',
      rewards: quest.rewards
    });
  } catch (error) {
    logger.error(`Error claiming quest reward: ${error.message}`);
    return res.status(500).json({ 
      success: false, 
      message: 'Terjadi kesalahan saat mengklaim reward quest' 
    });
  }
};

/**
 * Mengupdate progress quest
 * @param {String} userId - ID pengguna WhatsApp
 * @param {String} type - Tipe aktivitas
 * @param {String} target - Target aktivitas
 * @param {Number} quantity - Jumlah aktivitas
 * @returns {Promise<Boolean>} - Status berhasil/gagal
 */
const updateQuestProgress = async (userId, type, target, quantity = 1) => {
  try {
    // Cari pemain dalam database
    const player = await Player.findByUserId(userId);
    
    if (!player) {
      return false;
    }
    
    // Update progress quest
    const updated = await PlayerQuest.updateQuestProgress(player._id, type, target, quantity);
    
    if (updated) {
      // Cek apakah ada quest yang selesai
      const completedQuests = await PlayerQuest.find({
        player: player._id,
        isCompleted: true,
        isRewarded: false
      }).populate('quest');
      
      if (completedQuests.length > 0) {
        // Buat notifikasi untuk setiap quest yang selesai
        for (const quest of completedQuests) {
          createNotification(
            player._id,
            'quest',
            'Quest Selesai',
            `Quest "${quest.quest.title}" telah selesai. Klaim hadiahmu dengan !quest klaim ${quest.quest._id}`
          );
        }
      }
    }
    
    return updated;
  } catch (error) {
    logger.error(`Error updating quest progress: ${error.message}`);
    return false;
  }
};

/**
 * Helper function untuk generate quest baru untuk pemain
 * @param {Object} player - Objek pemain
 * @returns {Promise<Boolean>} - Status berhasil/gagal
 */
const generateNewQuests = async (player) => {
  try {
    // Hapus quest harian lama yang belum selesai
    await PlayerQuest.deleteMany({
      player: player._id,
      isCompleted: false,
      'quest.type': 'daily'
    });
    
    // Cari quest harian yang sesuai level
    const dailyQuests = await Quest.findActiveByLevel(player.level, 'daily', 3);
    
    // Cari quest mingguan jika belum ada
    const hasWeeklyQuest = await PlayerQuest.exists({
      player: player._id,
      'quest.type': 'weekly'
    });
    
    let weeklyQuests = [];
    if (!hasWeeklyQuest) {
      weeklyQuests = await Quest.findActiveByLevel(player.level, 'weekly', 1);
    }
    
    // Gabung semua quest
    const allQuests = [...dailyQuests, ...weeklyQuests];
    
    // Buat progress quest baru untuk pemain
    for (const quest of allQuests) {
      // Cek apakah quest sudah ada
      const exists = await PlayerQuest.exists({
        player: player._id,
        quest: quest._id
      });
      
      if (!exists) {
        // Buat progress quest baru
        const playerQuest = new PlayerQuest({
          player: player._id,
          quest: quest._id,
          progress: []
        });
        
        // Inisialisasi progress setiap requirement
        quest.requirements.forEach((_, index) => {
          playerQuest.progress.push({
            requirementIndex: index,
            current: 0,
            completed: false
          });
        });
        
        await playerQuest.save();
      }
    }
    
    // Buat notifikasi quest baru
    createNotification(
      player._id,
      'quest',
      'Quest Baru Tersedia',
      `${dailyQuests.length} quest harian baru telah tersedia. Gunakan !quest untuk melihat daftar quest.`
    );
    
    logger.info(`Generated ${allQuests.length} new quests for player ${player.name}`);
    
    return true;
  } catch (error) {
    logger.error(`Error generating new quests: ${error.message}`);
    return false;
  }
};

/**
 * Mendapatkan semua quest aktif untuk pemain
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
const getActiveQuests = async (req, res) => {
  try {
    const userId = req.player.userId;
    
    // Validasi player
    const player = await Player.findOne({ userId });
    if (!player) {
      return res.status(404).json({ success: false, message: 'Player tidak ditemukan' });
    }

    // Filter quest yang aktif (belum kadaluwarsa dan belum diklaim)
    const now = new Date();
    const activeQuests = player.quests.filter(quest => 
      !quest.claimed && quest.expiry > now
    );

    return res.status(200).json({
      success: true,
      activeQuests
    });
  } catch (error) {
    logger.error(`Error getting active quests: ${error.message}`);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan saat mengambil quest' });
  }
};

/**
 * Generate quest harian baru untuk pemain
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
const generateDailyQuests = async (req, res) => {
  try {
    const userId = req.player.userId;
    
    // Validasi player
    const player = await Player.findOne({ userId });
    if (!player) {
      return res.status(404).json({ success: false, message: 'Player tidak ditemukan' });
    }

    // Cek apakah sudah pernah generate quest hari ini
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Filter quest yang dibuat hari ini
    const todayQuests = player.quests.filter(quest => 
      quest.questType === 'daily' && 
      new Date(quest.expiry) > now && 
      !quest.claimed
    );

    if (todayQuests.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Kamu sudah mendapatkan quest harian untuk hari ini. Coba lagi besok!' 
      });
    }

    // Generate quest baru
    const newQuests = await questGenerator.generateDailyQuests(player);
    
    // Tambahkan quest baru ke data pemain
    player.quests.push(...newQuests);
    await player.save();

    return res.status(200).json({
      success: true,
      message: 'Quest harian baru telah dibuat',
      quests: newQuests
    });
  } catch (error) {
    logger.error(`Error generating daily quests: ${error.message}`);
    return res.status(500).json({ 
      success: false, 
      message: 'Terjadi kesalahan saat membuat quest harian'
    });
  }
};

/**
 * Menangani perintah quest dari WhatsApp
 * @param {Object} msg - Pesan WhatsApp
 * @param {String} sender - ID pengirim
 * @param {Player} player - Data pemain
 * @returns {String} Pesan balasan
 */
const handleQuestCommand = async (msg, sender, player) => {
  const command = msg.body.trim().toLowerCase();

  // Daftar perintah quest
  if (command === '!quest' || command === '!quests') {
    // Tampilkan semua quest aktif
    return await showActiveQuests(player);
  } else if (command === '!dailyquest' || command === '!dailyquests') {
    // Generate quest harian baru
    return await generateNewDailyQuests(player);
  } else if (command.startsWith('!claimquest ')) {
    // Klaim reward quest
    const questId = command.split(' ')[1];
    return await claimQuest(player, questId);
  }

  return null; // Bukan perintah quest
};

/**
 * Menampilkan quest aktif pemain
 * @param {Player} player - Data pemain
 * @returns {String} Pesan balasan
 */
const showActiveQuests = async (player) => {
  try {
    // Filter quest yang aktif
    const now = new Date();
    const activeQuests = player.quests.filter(quest => 
      !quest.claimed && quest.expiry > now
    );

    if (activeQuests.length === 0) {
      return '🎯 *QUEST*\n\nKamu tidak memiliki quest aktif. Gunakan perintah !dailyquest untuk mendapatkan quest baru.';
    }

    let response = '🎯 *QUEST AKTIF*\n\n';
    
    activeQuests.forEach((quest, index) => {
      const progress = quest.progress >= quest.requirements.amount 
        ? '✅ SELESAI' 
        : `Progress: ${quest.progress}/${quest.requirements.amount}`;
      
      response += `*${index + 1}. ${quest.title}* (${quest.difficulty})\n`;
      response += `${quest.description}\n`;
      response += `${progress}\n`;
      
      if (quest.completed) {
        response += '💰 Reward:\n';
        response += `   EXP: ${quest.rewards.exp}\n`;
        response += `   GMoney: ${quest.rewards.gmoney}\n`;
        
        if (quest.rewards.items.length > 0) {
          response += '   Items:\n';
          quest.rewards.items.forEach(item => {
            response += `   - ${item.name} x${item.quantity}\n`;
          });
        }
        
        response += `Klaim dengan: !claimquest ${quest.id}\n`;
      }
      
      response += '\n';
    });

    return response;
  } catch (error) {
    logger.error(`Error showing active quests: ${error.message}`);
    return 'Terjadi kesalahan saat menampilkan quest.';
  }
};

/**
 * Generate quest harian baru
 * @param {Player} player - Data pemain
 * @returns {String} Pesan balasan
 */
const generateNewDailyQuests = async (player) => {
  try {
    // Cek apakah sudah pernah generate quest hari ini
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Filter quest yang dibuat hari ini
    const todayQuests = player.quests.filter(quest => 
      quest.questType === 'daily' && 
      new Date(quest.expiry) > now && 
      !quest.claimed
    );

    if (todayQuests.length > 0) {
      return '🎯 *DAILY QUEST*\n\nKamu sudah mendapatkan quest harian untuk hari ini. Coba lagi besok!';
    }

    // Generate quest baru
    const newQuests = await questGenerator.generateDailyQuests(player);
    
    // Tambahkan quest baru ke data pemain
    player.quests.push(...newQuests);
    await player.save();

    let response = '🎯 *DAILY QUEST BARU*\n\nKamu mendapatkan quest harian baru:\n\n';
    
    newQuests.forEach((quest, index) => {
      response += `*${index + 1}. ${quest.title}* (${quest.difficulty})\n`;
      response += `${quest.description}\n`;
      response += '\n';
    });

    response += '🔍 Gunakan perintah !quest untuk melihat detail lengkap quest.\n';
    response += '⏰ Quest berlaku hingga tengah malam.';

    return response;
  } catch (error) {
    logger.error(`Error generating daily quests: ${error.message}`);
    return 'Terjadi kesalahan saat membuat quest harian.';
  }
};

/**
 * Klaim reward quest
 * @param {Player} player - Data pemain
 * @param {String} questId - ID quest yang akan diklaim
 * @returns {String} Pesan balasan
 */
const claimQuest = async (player, questId) => {
  try {
    if (!questId) {
      return '❌ Mohon berikan ID quest yang akan diklaim. Contoh: !claimquest abcdef123456';
    }

    // Cari quest yang akan diklaim
    const questIndex = player.quests.findIndex(
      q => q.id.toString() === questId && q.completed && !q.claimed
    );

    if (questIndex === -1) {
      return '❌ Quest tidak ditemukan atau belum selesai atau sudah diklaim.';
    }

    const quest = player.quests[questIndex];

    // Berikan reward
    player.exp += quest.rewards.exp;
    player.gmoney += quest.rewards.gmoney;
    let levelUp = false;

    // Tambahkan item reward jika ada
    for (const itemReward of quest.rewards.items) {
      const existingItem = player.inventory.find(i => i.itemId === itemReward.itemId);
      
      if (existingItem) {
        existingItem.quantity += itemReward.quantity;
      } else {
        player.inventory.push({
          itemId: itemReward.itemId,
          name: itemReward.name,
          quantity: itemReward.quantity
        });
      }
    }

    // Update level jika exp mencukupi
    if (player.exp >= player.maxExp) {
      player.level += 1;
      player.exp -= player.maxExp;
      player.maxExp = Math.floor(player.maxExp * 1.5); // Tingkatkan exp yang dibutuhkan
      levelUp = true;
      
      // Tambahkan notifikasi level up
      player.notifications.push({
        title: 'Level Up!',
        content: `Selamat! Kamu telah naik ke level ${player.level}`,
        timestamp: new Date(),
        read: false
      });
    }

    // Tandai quest sebagai sudah diklaim
    player.quests[questIndex].claimed = true;

    await player.save();

    // Buat pesan balasan
    let response = '💰 *QUEST REWARD*\n\n';
    response += `Quest *${quest.title}* telah diklaim.\n\n`;
    response += 'Kamu mendapatkan:\n';
    response += `✨ EXP: ${quest.rewards.exp}\n`;
    response += `💵 GMoney: ${quest.rewards.gmoney}\n`;
    
    if (quest.rewards.items.length > 0) {
      response += '📦 Items:\n';
      quest.rewards.items.forEach(item => {
        response += `  - ${item.name} x${item.quantity}\n`;
      });
    }
    
    if (levelUp) {
      response += `\n🎉 *LEVEL UP!* Kamu naik ke level ${player.level}!`;
    }

    return response;
  } catch (error) {
    logger.error(`Error claiming quest reward: ${error.message}`);
    return 'Terjadi kesalahan saat mengklaim reward quest.';
  }
};

module.exports = {
  viewQuests,
  claimQuestReward,
  updateQuestProgress,
  getActiveQuests,
  generateDailyQuests,
  handleQuestCommand,
  claimQuest
}; 