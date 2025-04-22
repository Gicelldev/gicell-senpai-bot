const mongoose = require('mongoose');
const fs = require('fs').promises;
const path = require('path');
const Item = require('../models/Item');
const logger = require('./logger');

/**
 * Seed database dengan data awal
 * @returns {Promise<void>}
 */
const seedDatabase = async () => {
  try {
    if (process.env.SEED_DATABASE !== 'true') {
      logger.info('Database seeding skipped (SEED_DATABASE != true)');
      return;
    }
    
    logger.info('Starting database seeding...');
    
    // Seed items
    await seedItems();
    
    // TODO: Implement seedMonsters, seedZones, etc.
    
    logger.info('Database seeding completed successfully');
  } catch (error) {
    logger.error(`Error seeding database: ${error.message}`);
    throw error;
  }
};

/**
 * Seed item collection
 * @returns {Promise<void>}
 */
const seedItems = async () => {
  try {
    // Cek apakah items sudah ada di database
    const itemCount = await Item.countDocuments();
    
    if (itemCount > 0) {
      logger.info(`Items collection already has ${itemCount} documents, skipping seeding`);
      return;
    }
    
    // Baca file items.json
    const itemsFile = path.join(__dirname, '../data/items.json');
    const itemsData = await fs.readFile(itemsFile, 'utf8');
    const items = JSON.parse(itemsData);
    
    // Insert items ke database
    await Item.insertMany(items);
    
    logger.info(`Seeded items collection with ${items.length} documents`);
  } catch (error) {
    logger.error(`Error seeding items: ${error.message}`);
    throw error;
  }
};

/**
 * Reset database (hanya untuk development)
 * @returns {Promise<void>}
 */
const resetDatabase = async () => {
  try {
    if (process.env.NODE_ENV !== 'development') {
      logger.error('Cannot reset database in non-development environment');
      return;
    }
    
    if (process.env.RESET_DATABASE !== 'true') {
      logger.info('Database reset skipped (RESET_DATABASE != true)');
      return;
    }
    
    logger.warn('Resetting database...');
    
    // Hapus semua collection
    const collections = mongoose.connection.collections;
    
    for (const key in collections) {
      await collections[key].deleteMany({});
      logger.info(`Collection ${key} cleared`);
    }
    
    logger.warn('Database reset completed');
    
    // Seed database dengan data awal
    await seedDatabase();
  } catch (error) {
    logger.error(`Error resetting database: ${error.message}`);
    throw error;
  }
};

module.exports = {
  seedDatabase,
  resetDatabase
}; 