const mongoose = require('mongoose');

// Schema untuk inventory pemain
const InventoryItemSchema = new mongoose.Schema({
  itemId: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    default: 1
  },
  type: {
    type: String,
    enum: ['weapon', 'armor', 'resource', 'consumable'],
    required: true
  },
  tier: {
    type: Number,
    min: 1,
    max: 8,
    default: 1
  },
  stats: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, { _id: false });

// Schema untuk equipment pemain
const EquipmentSchema = new mongoose.Schema({
  weapon: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  head: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  chest: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  legs: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  boots: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  }
}, { _id: false });

// Schema untuk stats pemain
const StatsSchema = new mongoose.Schema({
  health: {
    type: Number,
    default: 100
  },
  maxHealth: {
    type: Number,
    default: 100
  },
  attack: {
    type: Number,
    default: 10
  },
  defense: {
    type: Number,
    default: 5
  },
  gathering: {
    wood: {
      type: Number,
      default: 1
    },
    ore: {
      type: Number,
      default: 1
    },
    stone: {
      type: Number,
      default: 1
    },
    fiber: {
      type: Number,
      default: 1
    },
    hide: {
      type: Number,
      default: 1
    }
  },
  crafting: {
    type: Number,
    default: 1
  }
}, { _id: false });

// Schema utama pemain
const PlayerSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true
  },
  phoneNumber: {
    type: String,
    required: false,
    unique: true,
    sparse: true
  },
  name: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['player', 'admin'],
    default: 'player'
  },
  level: {
    type: Number,
    default: 1
  },
  experience: {
    type: Number,
    default: 0
  },
  gmoney: {
    type: Number,
    default: 1000
  },
  chips: {
    type: Number,
    default: 0
  },
  inventory: {
    type: [InventoryItemSchema],
    default: []
  },
  equipment: {
    type: EquipmentSchema,
    default: () => ({})
  },
  stats: {
    type: StatsSchema,
    default: () => ({})
  },
  currentZone: {
    type: String,
    enum: ['safe', 'yellow', 'red', 'black'],
    default: 'safe'
  },
  guild: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Guild',
    default: null
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updated: {
    type: Boolean,
    default: true
  }
});

// Method untuk mendapatkan level berikutnya
PlayerSchema.methods.getNextLevelExp = function() {
  return this.level * 100;
};

// Method untuk menambah experience
PlayerSchema.methods.addExperience = function(amount) {
  this.experience += amount;
  const nextLevelExp = this.getNextLevelExp();
  
  // Check jika naik level
  while (this.experience >= nextLevelExp) {
    this.experience -= nextLevelExp;
    this.level += 1;
    
    // Tingkatkan stats ketika naik level
    this.stats.maxHealth += 10;
    this.stats.health = this.stats.maxHealth;
    this.stats.attack += 2;
    this.stats.defense += 1;
  }
  
  return this.level;
};

// Method untuk menambah item ke inventory
PlayerSchema.methods.addItem = function(item) {
  const existingItem = this.inventory.find(i => 
    i.itemId === item.itemId && 
    i.type === item.type &&
    (!item.stats || JSON.stringify(i.stats) === JSON.stringify(item.stats))
  );
  
  if (existingItem && ['resource', 'consumable'].includes(item.type)) {
    existingItem.quantity += item.quantity || 1;
  } else {
    this.inventory.push(item);
  }
};

// Method untuk menghapus item dari inventory
PlayerSchema.methods.removeItem = function(itemId, quantity = 1) {
  const itemIndex = this.inventory.findIndex(i => i.itemId === itemId);
  
  if (itemIndex === -1) {
    return false;
  }
  
  const item = this.inventory[itemIndex];
  
  if (item.quantity > quantity) {
    item.quantity -= quantity;
  } else {
    this.inventory.splice(itemIndex, 1);
  }
  
  return true;
};

// Tambahkan hook pre-save untuk memastikan format phoneNumber konsisten
PlayerSchema.pre('save', function(next) {
  // Jika phoneNumber memiliki format @s.whatsapp.net, bersihkan
  if (this.phoneNumber && this.phoneNumber.includes('@')) {
    this.phoneNumber = this.phoneNumber.split('@')[0];
  }
  
  next();
});

// Static method untuk menemukan player berdasarkan nomor telepon
PlayerSchema.statics.findPlayerByPhoneNumber = function(phoneNumber) {
  // Jika phoneNumber kosong, kembalikan null langsung
  if (!phoneNumber) {
    return Promise.resolve(null);
  }
  
  // Bersihkan phoneNumber jika dalam format WhatsApp
  let cleanPhoneNumber = phoneNumber;
  if (phoneNumber.includes('@')) {
    cleanPhoneNumber = phoneNumber.split('@')[0];
  }
  
  // Coba cari berdasarkan phoneNumber, jika gagal coba cari berdasarkan userId
  // (karena beberapa kasus phoneNumber = userId)
  return this.findOne({ $or: [
    { phoneNumber: cleanPhoneNumber },
    { phoneNumber: phoneNumber },
    { userId: cleanPhoneNumber },
    { userId: phoneNumber }
  ]});
};

// Static method untuk menemukan player berdasarkan ID pengguna
PlayerSchema.statics.findByUserId = function(userId) {
  return this.findOne({ userId: userId });
};

const Player = mongoose.model('Player', PlayerSchema);

module.exports = Player; 