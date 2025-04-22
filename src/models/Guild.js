const mongoose = require('mongoose');

// Schema untuk anggota guild
const MemberSchema = new mongoose.Schema({
  playerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Player',
    required: true
  },
  rank: {
    type: String,
    enum: ['member', 'officer', 'leader'],
    default: 'member'
  },
  joinedAt: {
    type: Date,
    default: Date.now
  },
  contribution: {
    gmoney: {
      type: Number,
      default: 0
    },
    resources: {
      type: Number,
      default: 0
    }
  }
}, { _id: false });

// Schema utama guild
const GuildSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 20
  },
  description: {
    type: String,
    trim: true,
    maxlength: 200,
    default: ''
  },
  leader: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Player',
    required: true
  },
  members: {
    type: [MemberSchema],
    default: []
  },
  level: {
    type: Number,
    default: 1,
    min: 1,
    max: 10
  },
  treasury: {
    gmoney: {
      type: Number,
      default: 0
    },
    resources: {
      wood: {
        type: Number,
        default: 0
      },
      ore: {
        type: Number,
        default: 0
      },
      stone: {
        type: Number,
        default: 0
      },
      fiber: {
        type: Number,
        default: 0
      },
      hide: {
        type: Number,
        default: 0
      }
    }
  },
  territory: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Method untuk menambah anggota
GuildSchema.methods.addMember = function(playerId, rank = 'member') {
  if (this.members.some(m => m.playerId.toString() === playerId.toString())) {
    return false;
  }
  
  this.members.push({
    playerId,
    rank,
    joinedAt: Date.now(),
    contribution: { gmoney: 0, resources: 0 }
  });
  
  return true;
};

// Method untuk menghapus anggota
GuildSchema.methods.removeMember = function(playerId) {
  const initialLength = this.members.length;
  this.members = this.members.filter(m => m.playerId.toString() !== playerId.toString());
  
  return initialLength !== this.members.length;
};

// Method untuk mempromosikan anggota
GuildSchema.methods.promoteMembers = function(playerId, newRank) {
  const member = this.members.find(m => m.playerId.toString() === playerId.toString());
  
  if (!member) {
    return false;
  }
  
  member.rank = newRank;
  return true;
};

// Method untuk menambah kontribusi anggota
GuildSchema.methods.addContribution = function(playerId, type, amount) {
  const member = this.members.find(m => m.playerId.toString() === playerId.toString());
  
  if (!member) {
    return false;
  }
  
  if (type === 'gmoney') {
    member.contribution.gmoney += amount;
    this.treasury.gmoney += amount;
  } else if (type === 'resources') {
    member.contribution.resources += amount;
  }
  
  return true;
};

// Virtual untuk mendapatkan jumlah anggota
GuildSchema.virtual('memberCount').get(function() {
  return this.members.length;
});

// Method untuk mendapatkan level guild selanjutnya
GuildSchema.methods.getNextLevelRequirement = function() {
  return this.level * 50000; // 50k for level 1, 100k for level 2, etc.
};

// Static method untuk mencari guild berdasarkan nama
GuildSchema.statics.findByName = function(name) {
  return this.findOne({ name: new RegExp(name, 'i') });
};

const Guild = mongoose.model('Guild', GuildSchema);

module.exports = Guild; 