/**
 * Monster Manager
 * Modul untuk mengelola data monster dalam game
 */
const fs = require('fs');
const path = require('path');
const logger = require('./logger');

// Cache data monster
let monstersCache = null;

/**
 * Memuat data monster dari file JSON
 * @returns {Array} Array berisi data monster
 */
const loadMonsters = () => {
  try {
    if (monstersCache) {
      return monstersCache;
    }

    const monstersPath = path.join(__dirname, '../data/monsters/monsters.json');
    const monstersData = JSON.parse(fs.readFileSync(monstersPath, 'utf8'));
    
    monstersCache = monstersData;
    logger.info(`Loaded ${monstersData.length} monsters from database`);
    
    return monstersData;
  } catch (error) {
    logger.error(`Error loading monsters data: ${error.message}`);
    return [];
  }
};

/**
 * Mendapatkan semua monster
 * @returns {Array} Array berisi semua monster
 */
const getAllMonsters = () => {
  return loadMonsters();
};

/**
 * Mendapatkan monster berdasarkan zona
 * @param {String} zone - Nama zona (safe, yellow, red, black)
 * @returns {Array} Array berisi monster di zona tersebut
 */
const getMonstersByZone = (zone) => {
  const monsters = loadMonsters();
  return monsters.filter(monster => monster.zone === zone);
};

/**
 * Mendapatkan monster berdasarkan ID
 * @param {String} monsterId - ID monster
 * @returns {Object|null} Data monster atau null jika tidak ditemukan
 */
const getMonsterById = (monsterId) => {
  const monsters = loadMonsters();
  return monsters.find(monster => 
    monster.id.toLowerCase() === monsterId.toLowerCase() ||
    monster.name.toLowerCase() === monsterId.toLowerCase()
  ) || null;
};

/**
 * Mendapatkan monster berdasarkan level pemain
 * @param {Number} playerLevel - Level pemain
 * @returns {Array} Array berisi monster yang sesuai dengan level pemain
 */
const getMonstersByLevel = (playerLevel) => {
  const monsters = loadMonsters();
  
  if (playerLevel <= 5) {
    return monsters.filter(monster => monster.zone === 'safe');
  } else if (playerLevel <= 15) {
    return monsters.filter(monster => monster.zone === 'safe' || monster.zone === 'yellow');
  } else if (playerLevel <= 25) {
    return monsters.filter(monster => monster.zone === 'yellow' || monster.zone === 'red');
  } else {
    return monsters.filter(monster => monster.zone === 'red' || monster.zone === 'black');
  }
};

/**
 * Mendapatkan daftar semua monster yang ada dalam game
 * dengan format yang bagus untuk ditampilkan ke pemain
 * @returns {String} String berisi daftar monster
 */
const getMonsterList = () => {
  const monsters = loadMonsters();
  
  // Kelompokkan monster berdasarkan zona
  const monstersByZone = {
    safe: monsters.filter(m => m.zone === 'safe'),
    yellow: monsters.filter(m => m.zone === 'yellow'),
    red: monsters.filter(m => m.zone === 'red'),
    black: monsters.filter(m => m.zone === 'black')
  };
  
  // Buat daftar monster
  let monsterList = '🦄 DAFTAR MONSTER 🦄\n\n';
  
  // Tambahkan monster per zona
  monsterList += '🟢 *ZONA AMAN*\n';
  monstersByZone.safe.forEach(monster => {
    monsterList += `- ${monster.name} (${monster.id})\n`;
    monsterList += `  HP: ${monster.hp}, ATK: ${monster.attack}, DEF: ${monster.defense}\n`;
    monsterList += `  Exp: ${monster.exp}, GMoney: ${monster.minGmoney}-${monster.maxGmoney}\n\n`;
  });
  
  monsterList += '🟡 *ZONA KUNING*\n';
  monstersByZone.yellow.forEach(monster => {
    monsterList += `- ${monster.name} (${monster.id})\n`;
    monsterList += `  HP: ${monster.hp}, ATK: ${monster.attack}, DEF: ${monster.defense}\n`;
    monsterList += `  Exp: ${monster.exp}, GMoney: ${monster.minGmoney}-${monster.maxGmoney}\n\n`;
  });
  
  monsterList += '🔴 *ZONA MERAH*\n';
  monstersByZone.red.forEach(monster => {
    monsterList += `- ${monster.name} (${monster.id})\n`;
    monsterList += `  HP: ${monster.hp}, ATK: ${monster.attack}, DEF: ${monster.defense}\n`;
    monsterList += `  Exp: ${monster.exp}, GMoney: ${monster.minGmoney}-${monster.maxGmoney}\n\n`;
  });
  
  monsterList += '⚫ *ZONA HITAM*\n';
  monstersByZone.black.forEach(monster => {
    monsterList += `- ${monster.name} (${monster.id})\n`;
    monsterList += `  HP: ${monster.hp}, ATK: ${monster.attack}, DEF: ${monster.defense}\n`;
    monsterList += `  Exp: ${monster.exp}, GMoney: ${monster.minGmoney}-${monster.maxGmoney}\n\n`;
  });
  
  monsterList += 'Gunakan !serang [monster_id] untuk menyerang monster.';
  
  return monsterList;
};

module.exports = {
  getAllMonsters,
  getMonstersByZone,
  getMonsterById,
  getMonstersByLevel,
  getMonsterList
};
