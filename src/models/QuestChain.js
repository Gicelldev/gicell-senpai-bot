const mongoose = require('mongoose');

/**
 * Schema untuk quest chain (rantai quest)
 */
const QuestChainSchema = new mongoose.Schema({
  chainId: {
    type: String,
    required: true,
    unique: true
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['main', 'side', 'special', 'event', 'guild'],
    default: 'side'
  },
  recommendedLevel: {
    type: Number,
    default: 1
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isRepeatable: {
    type: Boolean,
    default: false
  },
  prerequisites: {
    chains: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'QuestChain'
    }],
    quests: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Quest'
    }],
    level: {
      type: Number,
      default: 1
    },
    skills: [{
      skill: String,
      level: Number
    }]
  },
  steps: [{
    step: {
      type: Number,
      required: true
    },
    quest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Quest',
      required: true
    },
    isRequired: {
      type: Boolean,
      default: true
    }
  }],
  branches: [{
    stepAfter: {
      type: Number,
      required: true
    },
    condition: {
      type: String,
      enum: ['choice', 'skill_check', 'item_check', 'guild'],
      required: true
    },
    conditionDetails: {
      type: mongoose.Schema.Types.Mixed
    },
    branches: [{
      choice: String,
      nextStep: Number
    }]
  }],
  rewards: {
    experience: {
      type: Number,
      default: 0
    },
    gmoney: {
      type: Number,
      default: 0
    },
    items: [{
      itemId: String,
      name: String,
      quantity: Number
    }],
    unlocks: [{
      type: String,
      enum: ['zone', 'quest', 'feature', 'title'],
      value: String
    }]
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

/**
 * Schema untuk progress quest chain pemain
 */
const PlayerQuestChainSchema = new mongoose.Schema({
  player: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Player',
    required: true
  },
  questChain: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'QuestChain',
    required: true
  },
  currentStep: {
    type: Number,
    default: 1
  },
  currentQuest: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quest'
  },
  completedSteps: [{
    step: Number,
    completedAt: Date,
    choices: [{
      branchPoint: Number,
      choiceMade: String
    }]
  }],
  status: {
    type: String,
    enum: ['active', 'completed', 'failed', 'on_hold'],
    default: 'active'
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
    type: Date
  },
  notes: {
    type: String
  }
});

// Indeks untuk mempercepat pencarian
QuestChainSchema.index({ chainId: 1 });
QuestChainSchema.index({ category: 1, isActive: 1 });
QuestChainSchema.index({ recommendedLevel: 1 });

PlayerQuestChainSchema.index({ player: 1, questChain: 1 }, { unique: true });
PlayerQuestChainSchema.index({ player: 1, status: 1 });
PlayerQuestChainSchema.index({ player: 1, currentQuest: 1 });

// Metode statis untuk menemukan quest chain yang tersedia
QuestChainSchema.statics.findAvailableForPlayer = async function(player) {
  // Dapatkan semua quest chain aktif
  const allChains = await this.find({ isActive: true }).populate('prerequisites.chains prerequisites.quests');
  
  // Filter quest chain yang memenuhi prasyarat
  const availableChains = allChains.filter(chain => {
    // Cek prasyarat level
    if (player.level < chain.prerequisites.level) {
      return false;
    }
    
    // Cek prasyarat skill (jika ada)
    if (chain.prerequisites.skills && chain.prerequisites.skills.length > 0) {
      for (const skillReq of chain.prerequisites.skills) {
        const playerSkill = player.skills.find(s => s.name === skillReq.skill);
        if (!playerSkill || playerSkill.level < skillReq.level) {
          return false;
        }
      }
    }
    
    // Cek prasyarat quest chain sebelumnya
    if (chain.prerequisites.chains && chain.prerequisites.chains.length > 0) {
      for (const prereqChain of chain.prerequisites.chains) {
        const completed = player.questChains.some(
          pqc => pqc.questChain.equals(prereqChain._id) && pqc.status === 'completed'
        );
        if (!completed) {
          return false;
        }
      }
    }
    
    // Cek prasyarat quest individu
    if (chain.prerequisites.quests && chain.prerequisites.quests.length > 0) {
      for (const prereqQuest of chain.prerequisites.quests) {
        const completed = player.quests.some(
          pq => pq.quest.equals(prereqQuest._id) && pq.isCompleted
        );
        if (!completed) {
          return false;
        }
      }
    }
    
    return true;
  });
  
  return availableChains;
};

// Metode statis untuk mengambil quest chain aktif pemain
PlayerQuestChainSchema.statics.findActiveForPlayer = function(playerId) {
  return this.find({
    player: playerId,
    status: 'active'
  })
    .populate({
      path: 'questChain',
      populate: {
        path: 'steps.quest'
      }
    })
    .populate('currentQuest')
    .sort({ startedAt: -1 });
};

// Metode statis untuk menemukan progress quest chain berdasarkan quest
PlayerQuestChainSchema.statics.findByCurrentQuest = function(playerId, questId) {
  return this.findOne({
    player: playerId,
    currentQuest: questId,
    status: 'active'
  }).populate('questChain');
};

// Metode untuk kemajuan ke langkah berikutnya dalam quest chain
PlayerQuestChainSchema.methods.advanceToNextStep = async function(choice = null) {
  const questChain = await mongoose.model('QuestChain').findById(this.questChain)
    .populate('steps.quest');
  
  if (!questChain) {
    throw new Error('Quest chain not found');
  }
  
  // Tandai langkah saat ini sebagai selesai
  this.completedSteps.push({
    step: this.currentStep,
    completedAt: new Date(),
    choices: choice ? [{ branchPoint: this.currentStep, choiceMade: choice }] : []
  });
  
  // Cek apakah ada percabangan setelah langkah ini
  const branch = questChain.branches.find(b => b.stepAfter === this.currentStep);
  
  let nextStep;
  if (branch && choice) {
    // Jika ada percabangan dan pilihan dibuat, ikuti percabangan
    const branchChoice = branch.branches.find(b => b.choice === choice);
    if (branchChoice) {
      nextStep = branchChoice.nextStep;
    } else {
      // Jika pilihan tidak valid, ambil cabang pertama sebagai default
      nextStep = branch.branches[0].nextStep;
    }
  } else {
    // Jika tidak ada percabangan, lanjut ke langkah berikutnya
    nextStep = this.currentStep + 1;
  }
  
  // Cek apakah ini langkah terakhir
  const isLastStep = !questChain.steps.some(s => s.step === nextStep);
  
  if (isLastStep) {
    // Jika ini langkah terakhir, selesaikan quest chain
    this.status = 'completed';
    this.completedAt = new Date();
    this.currentQuest = null;
  } else {
    // Dapatkan quest untuk langkah berikutnya
    const nextStepData = questChain.steps.find(s => s.step === nextStep);
    if (nextStepData) {
      this.currentStep = nextStep;
      this.currentQuest = nextStepData.quest;
    } else {
      throw new Error(`Step ${nextStep} not found in quest chain`);
    }
  }
  
  await this.save();
  return this;
};

// Metode untuk memberikan reward quest chain
PlayerQuestChainSchema.methods.giveReward = async function(player) {
  if (this.status !== 'completed' || this.isRewarded) {
    throw new Error('Cannot give reward - quest chain is not completed or reward already given');
  }
  
  const questChain = await mongoose.model('QuestChain').findById(this.questChain);
  
  if (!questChain) {
    throw new Error('Quest chain not found');
  }
  
  // Berikan reward
  if (questChain.rewards.experience) {
    player.addExperience(questChain.rewards.experience);
  }
  
  if (questChain.rewards.gmoney) {
    player.gmoney += questChain.rewards.gmoney;
  }
  
  // Tambahkan item reward jika ada
  if (questChain.rewards.items && questChain.rewards.items.length > 0) {
    for (const item of questChain.rewards.items) {
      player.addItem(item);
    }
  }
  
  // Buka fitur baru jika ada
  if (questChain.rewards.unlocks && questChain.rewards.unlocks.length > 0) {
    // TODO: Implementasi pembukaan fitur/zone baru
  }
  
  this.isRewarded = true;
  await this.save();
  await player.save();
  
  return {
    experience: questChain.rewards.experience,
    gmoney: questChain.rewards.gmoney,
    items: questChain.rewards.items,
    unlocks: questChain.rewards.unlocks
  };
};

const QuestChain = mongoose.model('QuestChain', QuestChainSchema);
const PlayerQuestChain = mongoose.model('PlayerQuestChain', PlayerQuestChainSchema);

module.exports = { QuestChain, PlayerQuestChain }; 