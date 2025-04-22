const mongoose = require('mongoose');

/**
 * Schema untuk definisi achievement
 */
const AchievementSchema = new mongoose.Schema({
  achievementId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['combat', 'crafting', 'gathering', 'exploration', 'social', 'economy', 'misc'],
    required: true
  },
  type: {
    type: String,
    enum: ['single', 'tiered'],
    default: 'single'
  },
  tiers: [{
    tier: Number,
    requirement: Number,
    reward: {
      type: {
        type: String,
        enum: ['gmoney', 'experience', 'item', 'title']
      },
      value: mongoose.Schema.Types.Mixed
    }
  }],
  requirement: {
    type: {
      type: String,
      enum: ['monsters_killed', 'quests_completed', 'items_crafted', 'resources_gathered', 
             'zones_explored', 'level_reached', 'gmoney_earned', 'players_defeated']
    },
    target: String,
    quantity: Number
  },
  reward: {
    type: {
      type: String,
      enum: ['gmoney', 'experience', 'item', 'title']
    },
    value: mongoose.Schema.Types.Mixed
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

/**
 * Schema untuk progress achievement pemain
 */
const PlayerAchievementSchema = new mongoose.Schema({
  player: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Player',
    required: true
  },
  achievement: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Achievement',
    required: true
  },
  currentTier: {
    type: Number,
    default: 0
  },
  progress: {
    type: Number,
    default: 0
  },
  completed: {
    type: Boolean,
    default: false
  },
  completedAt: {
    type: Date
  },
  claimed: {
    type: Boolean,
    default: false
  },
  claimedAt: {
    type: Date
  }
});

// Indeks untuk mempercepat pencarian
AchievementSchema.index({ achievementId: 1 });
AchievementSchema.index({ category: 1, isActive: 1 });
AchievementSchema.index({ 'requirement.type': 1 });

PlayerAchievementSchema.index({ player: 1, achievement: 1 }, { unique: true });
PlayerAchievementSchema.index({ player: 1, completed: 1 });
PlayerAchievementSchema.index({ player: 1, completed: 1, claimed: 1 });

// Metode statis untuk mendapatkan achievement aktif
AchievementSchema.statics.findActive = function() {
  return this.find({ isActive: true });
};

// Metode statis untuk mendapatkan achievement berdasarkan kategori
AchievementSchema.statics.findByCategory = function(category) {
  return this.find({ category, isActive: true });
};

// Metode statis untuk mendapatkan achievement berdasarkan requirement type
AchievementSchema.statics.findByRequirementType = function(requirementType) {
  return this.find({ 'requirement.type': requirementType, isActive: true });
};

// Metode statis untuk mendapatkan progress achievement pemain
PlayerAchievementSchema.statics.findForPlayer = function(playerId) {
  return this.find({ player: playerId })
    .populate('achievement')
    .sort({ 'achievement.category': 1, 'achievement.name': 1 });
};

// Metode statis untuk mendapatkan achievement yang diselesaikan tapi belum diklaim
PlayerAchievementSchema.statics.findCompletedNotClaimed = function(playerId) {
  return this.find({
    player: playerId,
    completed: true,
    claimed: false
  })
    .populate('achievement')
    .sort({ completedAt: -1 });
};

// Metode untuk mengupdate progress achievement
PlayerAchievementSchema.statics.updateProgress = async function(playerId, requirementType, targetId, quantity) {
  // Dapatkan achievement yang sesuai dengan requirement
  const achievements = await mongoose.model('Achievement').findByRequirementType(requirementType);
  
  // Filter achievement yang memiliki target yang sesuai atau tanpa target spesifik
  const relevantAchievements = achievements.filter(a => 
    !a.requirement.target || a.requirement.target === targetId
  );
  
  if (relevantAchievements.length === 0) {
    return [];
  }
  
  const updated = [];
  
  // Update progress untuk setiap achievement yang relevan
  for (const achievement of relevantAchievements) {
    let playerAchievement = await this.findOne({
      player: playerId,
      achievement: achievement._id
    });
    
    // Jika belum ada, buat baru
    if (!playerAchievement) {
      playerAchievement = new this({
        player: playerId,
        achievement: achievement._id,
        progress: 0,
        completed: false
      });
    }
    
    // Jika sudah selesai, lewati
    if (playerAchievement.completed) {
      continue;
    }
    
    // Update progress
    playerAchievement.progress += quantity;
    
    // Cek apakah achievement selesai
    if (achievement.type === 'tiered') {
      // Untuk achievement bertingkat
      const currentTierIndex = achievement.tiers.findIndex(t => t.tier === playerAchievement.currentTier + 1);
      if (currentTierIndex !== -1) {
        const currentTier = achievement.tiers[currentTierIndex];
        
        if (playerAchievement.progress >= currentTier.requirement) {
          playerAchievement.currentTier += 1;
          updated.push({
            achievement,
            tier: playerAchievement.currentTier,
            reward: currentTier.reward
          });
          
          // Cek apakah ini tier terakhir
          if (playerAchievement.currentTier === achievement.tiers.length) {
            playerAchievement.completed = true;
            playerAchievement.completedAt = new Date();
          }
        }
      }
    } else {
      // Untuk achievement tunggal
      if (playerAchievement.progress >= achievement.requirement.quantity) {
        playerAchievement.completed = true;
        playerAchievement.completedAt = new Date();
        updated.push({
          achievement,
          reward: achievement.reward
        });
      }
    }
    
    // Simpan perubahan
    await playerAchievement.save();
  }
  
  return updated;
};

const Achievement = mongoose.model('Achievement', AchievementSchema);
const PlayerAchievement = mongoose.model('PlayerAchievement', PlayerAchievementSchema);

module.exports = { Achievement, PlayerAchievement }; 