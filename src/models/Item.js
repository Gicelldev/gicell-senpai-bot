const mongoose = require('mongoose');

// Schema untuk item
const ItemSchema = new mongoose.Schema({
  itemId: {
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
    default: ''
  },
  type: {
    type: String,
    enum: ['weapon', 'armor', 'resource', 'consumable'],
    required: true
  },
  subType: {
    type: String,
    default: null
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
  },
  requiredLevel: {
    type: Number,
    default: 1
  },
  value: {
    type: Number,
    default: 10
  },
  craftingRequirements: {
    type: [{
      itemId: String,
      quantity: Number
    }],
    default: []
  },
  dropRate: {
    type: Number,
    default: 1.0
  },
  imageUrl: {
    type: String,
    default: null
  }
});

// Static method untuk mencari item berdasarkan name atau id
ItemSchema.statics.findByNameOrId = function(query) {
  return this.findOne({
    $or: [
      { itemId: query },
      { name: new RegExp(query, 'i') }
    ]
  });
};

// Static method untuk mendapatkan semua item berdasarkan tier
ItemSchema.statics.findByTier = function(tier) {
  return this.find({ tier });
};

// Static method untuk mendapatkan weapon berdasarkan tier
ItemSchema.statics.getWeaponsByTier = function(tier) {
  return this.find({ type: 'weapon', tier });
};

// Static method untuk mendapatkan armor berdasarkan tier
ItemSchema.statics.getArmorsByTier = function(tier) {
  return this.find({ type: 'armor', tier });
};

// Method untuk mendapatkan harga jual
ItemSchema.methods.getSellingPrice = function() {
  return Math.floor(this.value * 0.7); // 70% dari nilai asli
};

const Item = mongoose.model('Item', ItemSchema);

module.exports = Item; 