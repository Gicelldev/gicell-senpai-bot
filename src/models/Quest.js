const mongoose = require('mongoose');

// Schema untuk persyaratan misi
const QuestRequirementSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['gather', 'combat', 'craft', 'market', 'guild'],
    required: true
  },
  target: {
    type: String, // ID atau nama target (monster, resource, item)
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  description: {
    type: String,
    required: true
  }
}, { _id: false });

// Schema untuk hadiah misi
const QuestRewardSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['gmoney', 'item', 'experience'],
    required: true
  },
  itemId: {
    type: String,
    default: null
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  description: {
    type: String,
    required: true
  }
}, { _id: false });

const QuestSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['daily', 'weekly', 'story', 'event'],
    default: 'daily'
  },
  level: {
    type: Number,
    required: true,
    min: 1
  },
  requirements: {
    type: [QuestRequirementSchema],
    required: true,
    validate: [
      {
        validator: function(array) {
          return array.length > 0;
        },
        message: 'Quest harus memiliki minimal 1 persyaratan'
      }
    ]
  },
  rewards: {
    type: [QuestRewardSchema],
    required: true,
    validate: [
      {
        validator: function(array) {
          return array.length > 0;
        },
        message: 'Quest harus memiliki minimal 1 hadiah'
      }
    ]
  },
  timeLimit: {
    type: Number, // Dalam jam, 0 berarti tidak ada batas waktu
    default: 24
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

// Schema untuk progress quest pemain
const PlayerQuestSchema = new mongoose.Schema({
  player: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Player',
    required: true
  },
  quest: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quest',
    required: true
  },
  progress: [
    {
      requirementIndex: {
        type: Number,
        required: true
      },
      current: {
        type: Number,
        default: 0
      },
      completed: {
        type: Boolean,
        default: false
      }
    }
  ],
  isCompleted: {
    type: Boolean,
    default: false
  },
  isRewarded: {
    type: Boolean,
    default: false
  },
  startedAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date,
    default: null
  }
});

// Indeks untuk pencarian lebih cepat
QuestSchema.index({ type: 1, level: 1, isActive: 1 });
PlayerQuestSchema.index({ player: 1, isCompleted: 1 });

// Static method untuk mendapatkan quest aktif sesuai level
QuestSchema.statics.findActiveByLevel = function(level, type = 'daily', limit = 3) {
  return this.find({
    level: { $lte: level },
    type: type,
    isActive: true
  })
    .sort({ level: -1, createdAt: -1 })
    .limit(limit);
};

// Static method untuk mendapatkan progress quest pemain
PlayerQuestSchema.statics.findActiveForPlayer = function(playerId) {
  return this.find({
    player: playerId,
    isCompleted: false
  })
    .populate('quest')
    .sort({ startedAt: -1 });
};

// Static method untuk memperbarui progress quest pemain
PlayerQuestSchema.statics.updateQuestProgress = async function(playerId, type, target, quantity = 1) {
  // Cari semua quest aktif pemain
  const playerQuests = await this.find({
    player: playerId,
    isCompleted: false
  }).populate('quest');
  
  let updated = false;
  
  // Update progress untuk setiap quest yang cocok
  for (const playerQuest of playerQuests) {
    let questUpdated = false;
    
    // Cek setiap requirement
    playerQuest.quest.requirements.forEach((req, index) => {
      if (req.type === type && req.target === target && !playerQuest.progress[index]?.completed) {
        // Pastikan elemen progress ada
        if (!playerQuest.progress[index]) {
          playerQuest.progress.push({
            requirementIndex: index,
            current: 0,
            completed: false
          });
        }
        
        // Update progress
        playerQuest.progress[index].current += quantity;
        
        // Cek apakah requirement selesai
        if (playerQuest.progress[index].current >= req.quantity) {
          playerQuest.progress[index].completed = true;
          playerQuest.progress[index].current = req.quantity; // Kunci di nilai maksimum
        }
        
        questUpdated = true;
        updated = true;
      }
    });
    
    // Cek apakah semua requirement selesai
    if (questUpdated) {
      const allCompleted = playerQuest.progress.every(p => p.completed);
      if (allCompleted) {
        playerQuest.isCompleted = true;
        playerQuest.completedAt = new Date();
      }
      
      await playerQuest.save();
    }
  }
  
  return updated;
};

const Quest = mongoose.model('Quest', QuestSchema);
const PlayerQuest = mongoose.model('PlayerQuest', PlayerQuestSchema);

module.exports = { Quest, PlayerQuest }; 