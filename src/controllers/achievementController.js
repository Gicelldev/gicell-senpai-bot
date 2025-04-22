const Player = require('../models/Player');
const { Achievement, PlayerAchievement } = require('../models/Achievement');
const { createNotification } = require('./notificationController');
const logger = require('../utils/logger');

/**
 * Mendapatkan daftar achievement pemain
 * @param {String} userId - ID pengguna WhatsApp
 * @returns {Object} - Status dan pesan respons
 */
const viewAchievements = async (userId) => {
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
    
    // Dapatkan progress achievement pemain
    const playerAchievements = await PlayerAchievement.findForPlayer(player._id);
    
    if (playerAchievements.length === 0) {
      return {
        status: true,
        message: '🏆 ACHIEVEMENT 🏆\n\nAnda belum memiliki progress achievement. Teruskan petualangan Anda!'
      };
    }
    
    // Kelompokkan berdasarkan kategori
    const achievementsByCategory = {};
    for (const playerAchievement of playerAchievements) {
      const category = playerAchievement.achievement.category;
      if (!achievementsByCategory[category]) {
        achievementsByCategory[category] = [];
      }
      achievementsByCategory[category].push(playerAchievement);
    }
    
    // Buat daftar achievement
    let message = '🏆 ACHIEVEMENT 🏆\n\n';
    
    const categoryEmojis = {
      'combat': '⚔️',
      'crafting': '🔨',
      'gathering': '🧰',
      'exploration': '🗺️',
      'social': '👥',
      'economy': '💰',
      'misc': '🎮'
    };
    
    // Hitung achievement yang sudah selesai/belum
    const completedCount = playerAchievements.filter(pa => pa.completed).length;
    const totalCount = playerAchievements.length;
    
    message += `Progress Total: ${completedCount}/${totalCount} (${Math.round(completedCount/totalCount*100)}%)\n\n`;
    
    // Tampilkan achievement per kategori
    for (const [category, achievements] of Object.entries(achievementsByCategory)) {
      const emoji = categoryEmojis[category] || '🎖️';
      message += `${emoji} *${capitalizeFirstLetter(category)}*\n`;
      
      for (const pa of achievements) {
        const achievement = pa.achievement;
        const progressSymbol = pa.completed ? '✅' : '⬜';
        
        if (achievement.type === 'tiered') {
          const currentTier = pa.currentTier;
          const maxTier = achievement.tiers.length;
          message += `${progressSymbol} ${achievement.name} (Tier ${currentTier}/${maxTier})\n`;
          
          // Tampilkan progress tier berikutnya jika belum selesai
          if (!pa.completed && currentTier < maxTier) {
            const nextTier = achievement.tiers.find(t => t.tier === currentTier + 1);
            if (nextTier) {
              const progressPercent = Math.round(pa.progress / nextTier.requirement * 100);
              message += `   ${pa.progress}/${nextTier.requirement} (${progressPercent}%)\n`;
            }
          }
        } else {
          message += `${progressSymbol} ${achievement.name}\n`;
          
          // Tampilkan progress jika belum selesai
          if (!pa.completed) {
            const progressPercent = Math.round(pa.progress / achievement.requirement.quantity * 100);
            message += `   ${pa.progress}/${achievement.requirement.quantity} (${progressPercent}%)\n`;
          }
        }
      }
      
      message += '\n';
    }
    
    return {
      status: true,
      message
    };
  } catch (error) {
    logger.error(`Error viewing achievements: ${error.message}`);
    return {
      status: false,
      message: `Terjadi kesalahan saat melihat achievement: ${error.message}`
    };
  }
};

/**
 * Melihat achievement yang belum diklaim
 * @param {String} userId - ID pengguna WhatsApp
 * @returns {Object} - Status dan pesan respons
 */
const viewUnclaimedAchievements = async (userId) => {
  try {
    // Cari pemain dalam database
    const player = await Player.findByUserId(userId);
    
    if (!player) {
      return {
        status: false,
        message: 'Anda belum terdaftar sebagai pemain. Gunakan !daftar [nama] untuk mendaftar.'
      };
    }
    
    // Dapatkan achievement yang belum diklaim
    const unclaimedAchievements = await PlayerAchievement.findCompletedNotClaimed(player._id);
    
    if (unclaimedAchievements.length === 0) {
      return {
        status: true,
        message: '🏆 ACHIEVEMENT 🏆\n\nTidak ada achievement yang belum diklaim.'
      };
    }
    
    // Buat daftar achievement yang belum diklaim
    let message = '🏆 ACHIEVEMENT BELUM DIKLAIM 🏆\n\n';
    
    unclaimedAchievements.forEach((pa, index) => {
      const achievement = pa.achievement;
      message += `${index + 1}. ${achievement.name}\n`;
      message += `   ${achievement.description}\n`;
      
      // Tampilkan reward
      if (achievement.type === 'tiered') {
        const tier = achievement.tiers.find(t => t.tier === pa.currentTier);
        if (tier) {
          message += `   Reward: ${formatReward(tier.reward)}\n`;
        }
      } else {
        message += `   Reward: ${formatReward(achievement.reward)}\n`;
      }
      
      message += `   ID: ${achievement.achievementId}\n\n`;
    });
    
    message += 'Gunakan !claimachievement [ID] untuk mengklaim hadiah.';
    
    return {
      status: true,
      message
    };
  } catch (error) {
    logger.error(`Error viewing unclaimed achievements: ${error.message}`);
    return {
      status: false,
      message: `Terjadi kesalahan saat melihat achievement yang belum diklaim: ${error.message}`
    };
  }
};

/**
 * Mengklaim hadiah achievement
 * @param {String} userId - ID pengguna WhatsApp
 * @param {String} achievementId - ID achievement
 * @returns {Object} - Status dan pesan respons
 */
const claimAchievementReward = async (userId, achievementId) => {
  try {
    // Cari pemain dalam database
    const player = await Player.findByUserId(userId);
    
    if (!player) {
      return {
        status: false,
        message: 'Anda belum terdaftar sebagai pemain. Gunakan !daftar [nama] untuk mendaftar.'
      };
    }
    
    // Cari achievement
    const achievement = await Achievement.findOne({ achievementId });
    
    if (!achievement) {
      return {
        status: false,
        message: 'Achievement tidak ditemukan. Periksa kembali ID achievement.'
      };
    }
    
    // Cari progress pemain untuk achievement ini
    const playerAchievement = await PlayerAchievement.findOne({
      player: player._id,
      achievement: achievement._id
    });
    
    if (!playerAchievement) {
      return {
        status: false,
        message: 'Anda belum memiliki progress untuk achievement ini.'
      };
    }
    
    if (!playerAchievement.completed) {
      return {
        status: false,
        message: 'Achievement belum selesai. Selesaikan terlebih dahulu achievement ini.'
      };
    }
    
    if (playerAchievement.claimed) {
      return {
        status: false,
        message: 'Anda sudah mengklaim hadiah untuk achievement ini.'
      };
    }
    
    // Berikan hadiah
    let reward;
    if (achievement.type === 'tiered') {
      const tier = achievement.tiers.find(t => t.tier === playerAchievement.currentTier);
      reward = tier ? tier.reward : null;
    } else {
      reward = achievement.reward;
    }
    
    if (!reward) {
      return {
        status: false,
        message: 'Tidak ada hadiah untuk achievement ini.'
      };
    }
    
    // Proses hadiah berdasarkan tipe
    let rewardMessage = '';
    switch (reward.type) {
      case 'gmoney':
        player.gmoney += reward.value;
        rewardMessage = `${reward.value} Gmoney`;
        break;
      case 'experience':
        player.addExperience(reward.value);
        rewardMessage = `${reward.value} Experience`;
        break;
      case 'item':
        // TODO: Implementasi pemberian item
        rewardMessage = `Item: ${reward.value}`;
        break;
      case 'title':
        // TODO: Implementasi pemberian title
        rewardMessage = `Title: ${reward.value}`;
        break;
    }
    
    // Tandai achievement sebagai sudah diklaim
    playerAchievement.claimed = true;
    playerAchievement.claimedAt = new Date();
    
    // Simpan perubahan
    await playerAchievement.save();
    await player.save();
    
    return {
      status: true,
      message: `🏆 ACHIEVEMENT DIKLAIM 🏆\n\n` +
        `Anda telah mengklaim hadiah untuk achievement "${achievement.name}".\n\n` +
        `Hadiah yang diterima: ${rewardMessage}`
    };
  } catch (error) {
    logger.error(`Error claiming achievement reward: ${error.message}`);
    return {
      status: false,
      message: `Terjadi kesalahan saat mengklaim hadiah achievement: ${error.message}`
    };
  }
};

/**
 * Menangani komando achievement
 * @param {Object} msg - Objek pesan dari WhatsApp
 * @param {String} sender - ID pengirim pesan
 * @returns {Promise<String>} - Pesan balasan
 */
const handleAchievementCommand = async (msg, sender) => {
  const message = msg.body.trim().toLowerCase();
  
  if (message === '!achievement' || message === '!achievements') {
    // Tampilkan daftar achievement
    const response = await viewAchievements(sender);
    return response.message;
  } else if (message === '!unclaimedachievement' || message === '!unclaimedachievements') {
    // Tampilkan achievement yang belum diklaim
    const response = await viewUnclaimedAchievements(sender);
    return response.message;
  } else if (message.startsWith('!claimachievement ')) {
    // Klaim hadiah achievement
    const achievementId = message.split(' ')[1];
    const response = await claimAchievementReward(sender, achievementId);
    return response.message;
  }
  
  return null;
};

/**
 * Update progress achievement
 * @param {String} userId - ID pengguna WhatsApp
 * @param {String} requirementType - Tipe requirement achievement
 * @param {String} targetId - ID target (opsional)
 * @param {Number} quantity - Jumlah progress
 * @returns {Promise<Array>} - Array achievement yang diupdate
 */
const updateAchievementProgress = async (userId, requirementType, targetId = null, quantity = 1) => {
  try {
    // Cari pemain dalam database
    const player = await Player.findByUserId(userId);
    
    if (!player) {
      logger.error(`Player not found for userId: ${userId}`);
      return [];
    }
    
    // Update progress achievement
    const updatedAchievements = await PlayerAchievement.updateProgress(
      player._id,
      requirementType,
      targetId,
      quantity
    );
    
    // Buat notifikasi untuk achievement yang baru selesai
    for (const updated of updatedAchievements) {
      const achievement = updated.achievement;
      
      // Buat notifikasi
      createNotification(
        player._id,
        'achievement',
        'Achievement Selesai',
        `Anda telah menyelesaikan achievement "${achievement.name}". Gunakan !claimachievement ${achievement.achievementId} untuk mengklaim hadiah.`
      );
    }
    
    return updatedAchievements;
  } catch (error) {
    logger.error(`Error updating achievement progress: ${error.message}`);
    return [];
  }
};

// Fungsi helper
function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

function formatReward(reward) {
  switch (reward.type) {
    case 'gmoney':
      return `${reward.value} Gmoney`;
    case 'experience':
      return `${reward.value} Experience`;
    case 'item':
      return `Item: ${reward.value}`;
    case 'title':
      return `Title: ${reward.value}`;
    default:
      return 'Unknown reward';
  }
}

module.exports = {
  viewAchievements,
  viewUnclaimedAchievements,
  claimAchievementReward,
  handleAchievementCommand,
  updateAchievementProgress
}; 