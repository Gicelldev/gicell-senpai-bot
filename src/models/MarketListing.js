const mongoose = require('mongoose');

// Schema untuk market listing
const MarketListingSchema = new mongoose.Schema({
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Player',
    required: true
  },
  itemId: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
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
  },
  quantity: {
    type: Number,
    min: 1,
    default: 1
  },
  price: {
    type: Number,
    required: true,
    min: 1
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 604800 // Auto delete after 7 days (60*60*24*7 seconds)
  }
});

// Virtual untuk harga per unit
MarketListingSchema.virtual('pricePerUnit').get(function() {
  return Math.round(this.price / this.quantity);
});

// Static method untuk menemukan listing berdasarkan tipe
MarketListingSchema.statics.findByType = function(type) {
  return this.find({ type }).sort({ tier: 1, price: 1 });
};

// Static method untuk menemukan listing pemain
MarketListingSchema.statics.findBySeller = function(sellerId) {
  return this.find({ seller: sellerId }).sort({ createdAt: -1 });
};

// Static method untuk menemukan listing berdasarkan item
MarketListingSchema.statics.findByItemId = function(itemId) {
  return this.find({ itemId }).sort({ price: 1 });
};

// Method untuk mendapatkan harga untuk kuantitas tertentu
MarketListingSchema.methods.getPriceForQuantity = function(quantity) {
  const requestedQuantity = Math.min(quantity, this.quantity);
  return Math.round((this.price / this.quantity) * requestedQuantity);
};

const MarketListing = mongoose.model('MarketListing', MarketListingSchema);

module.exports = MarketListing; 