const mongoose = require('mongoose');

// Schema untuk monster dalam dungeon
const DungeonMonsterSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  level: {
    type: Number,
    required: true,
    min: 1
  },
  health: {
    type: Number,
    required: true,
    min: 1
  },
  attack: {
    type: Number,
    required: true,
    min: 1
  },
  defense: {
    type: Number,
    required: true,
    min: 0
  },
  experience: {
    type: Number,
    required: true,
    min: 1
  },
  dropChance: {
    type: Number,
    required: true,
    min: 0,
    max: 1
  },
  dropTier: {
    type: Number,
    required: true,
    min: 1,
    max: 8
  },
  bossMonster: {
    type: Boolean,
    default: false
  }
}, { _id: false });

// Schema untuk hadiah dungeon (setelah menyelesaikan seluruh dungeon)
const DungeonRewardSchema = new mongoose.Schema({
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
  chance: {
    type: Number,
    required: true,
    min: 0,
    max: 1
  },
  guaranteedReward: {
    type: Boolean,
    default: false
  }
}, { _id: false });

const DungeonSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  description: {
    type: String,
    required: true
  },
  tier: {
    type: Number,
    required: true,
    min: 1,
    max: 8
  },
  minLevel: {
    type: Number,
    required: true,
    min: 1
  },
  maxPlayers: {
    type: Number,
    default: 1,
    min: 1,
    max: 5
  },
  monsters: {
    type: [DungeonMonsterSchema],
    required: true,
    validate: [
      {
        validator: function(array) {
          return array.length > 0;
        },
        message: 'Dungeon harus memiliki minimal 1 monster'
      }
    ]
  },
  rewards: {
    type: [DungeonRewardSchema],
    required: true
  },
  cooldown: {
    type: Number, // Dalam menit
    default: 60
  },
  timeLimit: {
    type: Number, // Dalam menit, 0 berarti tidak ada batas waktu
    default: 30
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

// Schema untuk instance dungeon (ketika pemain masuk ke dungeon)
const DungeonInstanceSchema = new mongoose.Schema({
  dungeon: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Dungeon',
    required: true
  },
  players: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Player'
  }],
  currentRoom: {
    type: Number,
    default: 0
  },
  totalRooms: {
    type: Number,
    required: true,
    min: 1
  },
  monstersDefeated: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['in_progress', 'completed', 'failed', 'abandoned'],
    default: 'in_progress'
  },
  startedAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date,
    default: null
  },
  battleLog: {
    type: [String],
    default: []
  }
});

// Schema untuk menyimpan cooldown dungeon pemain
const PlayerDungeonSchema = new mongoose.Schema({
  player: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Player',
    required: true
  },
  dungeon: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Dungeon',
    required: true
  },
  lastCompleted: {
    type: Date,
    default: Date.now
  },
  timesCompleted: {
    type: Number,
    default: 1
  }
});

// Indeks untuk pencarian lebih cepat
DungeonSchema.index({ tier: 1, minLevel: 1, isActive: 1 });
DungeonInstanceSchema.index({ status: 1, startedAt: -1 });
PlayerDungeonSchema.index({ player: 1, dungeon: 1 });

// Static method untuk mendapatkan dungeon berdasarkan level
DungeonSchema.statics.findByPlayerLevel = function(level) {
  return this.find({
    minLevel: { $lte: level },
    isActive: true
  }).sort({ tier: 1, minLevel: 1 });
};

// Static method untuk memeriksa cooldown pemain
PlayerDungeonSchema.statics.checkCooldown = async function(playerId, dungeonId) {
  const record = await this.findOne({
    player: playerId,
    dungeon: dungeonId
  });
  
  if (!record) return { onCooldown: false };
  
  const dungeon = await mongoose.model('Dungeon').findById(dungeonId);
  if (!dungeon) return { onCooldown: false };
  
  const now = new Date();
  const cooldownTime = new Date(record.lastCompleted.getTime() + (dungeon.cooldown * 60000));
  
  return {
    onCooldown: cooldownTime > now,
    remainingTime: Math.max(0, cooldownTime - now) / 60000, // Dalam menit
    record
  };
};

const Dungeon = mongoose.model('Dungeon', DungeonSchema);
const DungeonInstance = mongoose.model('DungeonInstance', DungeonInstanceSchema);
const PlayerDungeon = mongoose.model('PlayerDungeon', PlayerDungeonSchema);

module.exports = { Dungeon, DungeonInstance, PlayerDungeon }; 