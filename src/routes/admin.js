const express = require('express');
const router = express.Router();
const Player = require('../models/Player');
const Guild = require('../models/Guild');
const MarketListing = require('../models/MarketListing');
const logger = require('../utils/logger');

// Middleware untuk basic authentication
const basicAuth = (req, res, next) => {
  // Ambil info admin dari env
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  
  // Ambil header auth
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    res.setHeader('WWW-Authenticate', 'Basic');
    return res.status(401).json({ message: 'Authentication required' });
  }
  
  // Decode auth header
  const auth = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':');
  const username = auth[0];
  const password = auth[1];
  
  // Cek kredensial
  if (username === adminUsername && password === adminPassword) {
    next();
  } else {
    res.setHeader('WWW-Authenticate', 'Basic');
    return res.status(401).json({ message: 'Invalid credentials' });
  }
};

// Middleware untuk semua route admin
router.use(basicAuth);

// Route dashboard
router.get('/', async (req, res) => {
  try {
    // Ambil statistik dasar
    const playerCount = await Player.countDocuments();
    const guildCount = await Guild.countDocuments();
    const marketListingCount = await MarketListing.countDocuments();
    
    // Ambil player terakhir mendaftar
    const latestPlayers = await Player.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name level gmoney createdAt');
    
    // Ambil guild terakhir dibuat
    const latestGuilds = await Guild.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('leader', 'name')
      .select('name level memberCount createdAt');
    
    // Kirim data dashboard
    res.json({
      stats: {
        playerCount,
        guildCount,
        marketListingCount
      },
      latestPlayers,
      latestGuilds
    });
  } catch (error) {
    logger.error(`Admin dashboard error: ${error.message}`);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Route untuk data pemain
router.get('/players', async (req, res) => {
  try {
    const { limit = 20, page = 1, sort = 'createdAt', order = 'desc' } = req.query;
    
    // Buat query options
    const options = {
      skip: (parseInt(page) - 1) * parseInt(limit),
      limit: parseInt(limit)
    };
    
    // Buat sort options
    const sortOptions = {};
    sortOptions[sort] = order === 'desc' ? -1 : 1;
    
    // Ambil data pemain
    const players = await Player.find({}, null, options)
      .sort(sortOptions)
      .select('name level gmoney currentZone lastActivity createdAt');
    
    // Ambil total jumlah pemain
    const total = await Player.countDocuments();
    
    res.json({
      players,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error(`Admin players error: ${error.message}`);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Route untuk detail pemain
router.get('/players/:id', async (req, res) => {
  try {
    // Ambil data pemain berdasarkan ID atau nama
    const player = await Player.findOne({
      $or: [
        { _id: req.params.id },
        { name: req.params.id }
      ]
    }).populate('guild');
    
    if (!player) {
      return res.status(404).json({ message: 'Pemain tidak ditemukan' });
    }
    
    res.json(player);
  } catch (error) {
    logger.error(`Admin player detail error: ${error.message}`);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Route untuk data guild
router.get('/guilds', async (req, res) => {
  try {
    const { limit = 20, page = 1 } = req.query;
    
    // Buat query options
    const options = {
      skip: (parseInt(page) - 1) * parseInt(limit),
      limit: parseInt(limit)
    };
    
    // Ambil data guild
    const guilds = await Guild.find({}, null, options)
      .sort({ level: -1, createdAt: -1 })
      .populate('leader', 'name')
      .select('name level members territory createdAt');
    
    // Ambil total jumlah guild
    const total = await Guild.countDocuments();
    
    res.json({
      guilds,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error(`Admin guilds error: ${error.message}`);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Route untuk data marketplace
router.get('/market', async (req, res) => {
  try {
    const { limit = 20, page = 1, type } = req.query;
    
    // Buat query
    const query = {};
    if (type) {
      query.type = type;
    }
    
    // Buat query options
    const options = {
      skip: (parseInt(page) - 1) * parseInt(limit),
      limit: parseInt(limit)
    };
    
    // Ambil data marketplace
    const listings = await MarketListing.find(query, null, options)
      .sort({ createdAt: -1 })
      .populate('seller', 'name');
    
    // Ambil total jumlah listing
    const total = await MarketListing.countDocuments(query);
    
    res.json({
      listings,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error(`Admin market error: ${error.message}`);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Route untuk statistik
router.get('/stats', async (req, res) => {
  try {
    // Statistik pemain
    const playerCount = await Player.countDocuments();
    const activeToday = await Player.countDocuments({
      lastActivity: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    });
    
    // Statistik resource
    const highestTierWeapon = await Player.aggregate([
      { $unwind: '$inventory' },
      { $match: { 'inventory.type': 'weapon' } },
      { $sort: { 'inventory.tier': -1 } },
      { $limit: 1 },
      { $project: { _id: 0, item: '$inventory', player: '$name' } }
    ]);
    
    // Statistik gmoney
    const totalGmoney = await Player.aggregate([
      { $group: { _id: null, total: { $sum: '$gmoney' } } }
    ]);
    
    // Statistik guild
    const guildCount = await Guild.countDocuments();
    const guildsWithTerritory = await Guild.countDocuments({ territory: { $ne: null } });
    
    res.json({
      playerStats: {
        total: playerCount,
        activeToday,
        inactivePercent: Math.round((playerCount - activeToday) / playerCount * 100)
      },
      itemStats: {
        highestTierWeapon: highestTierWeapon.length > 0 ? highestTierWeapon[0] : null
      },
      economyStats: {
        totalGmoney: totalGmoney.length > 0 ? totalGmoney[0].total : 0,
        averageGmoneyPerPlayer: totalGmoney.length > 0 ? Math.round(totalGmoney[0].total / playerCount) : 0
      },
      guildStats: {
        totalGuilds: guildCount,
        guildsWithTerritory,
        territoryPercentage: Math.round(guildsWithTerritory / guildCount * 100)
      }
    });
  } catch (error) {
    logger.error(`Admin stats error: ${error.message}`);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router; 