const logger = require('./logger');

/**
 * Generate starter equipment for new players
 * @returns {Object} Object berisi equipment dan inventory awal
 */
const generateStarterEquipment = () => {
  // Default weapon berdasarkan env variable atau wooden_sword
  const defaultWeaponId = process.env.DEFAULT_WEAPON || 'wooden_sword';
  const defaultArmorId = process.env.DEFAULT_ARMOR || 'cloth_robe';
  
  // Buat starter weapon
  const starterWeapon = {
    itemId: defaultWeaponId,
    name: formatItemName(defaultWeaponId),
    type: 'weapon',
    tier: 1,
    stats: {
      damage: 5,
      attackSpeed: 1.2
    }
  };
  
  // Buat starter armor
  const starterArmor = {
    itemId: defaultArmorId,
    name: formatItemName(defaultArmorId),
    type: 'armor',
    subType: 'chest',
    tier: 1,
    stats: {
      defense: 3,
      healthBonus: 10
    }
  };
  
  // Buat beberapa resource awal
  const starterResources = [
    {
      itemId: 'rough_logs',
      name: 'Rough Logs',
      type: 'resource',
      quantity: 10,
      tier: 1
    },
    {
      itemId: 'rough_stone',
      name: 'Rough Stone',
      type: 'resource',
      quantity: 10,
      tier: 1
    },
    {
      itemId: 'rough_hide',
      name: 'Rough Hide',
      type: 'resource',
      quantity: 5,
      tier: 1
    }
  ];
  
  // Buat beberapa consumable awal
  const starterConsumables = [
    {
      itemId: 'minor_healing_potion',
      name: 'Minor Healing Potion',
      type: 'consumable',
      quantity: 3,
      tier: 1,
      stats: {
        healthRestore: 50
      }
    }
  ];
  
  // Combine semua item starter ke inventory
  const inventory = [...starterResources, ...starterConsumables];
  
  // Definisikan equipment awal
  const equipment = {
    weapon: starterWeapon,
    head: null,
    chest: starterArmor,
    legs: null,
    boots: null
  };
  
  logger.info(`Generated starter equipment: ${starterWeapon.name} and ${starterArmor.name}`);
  
  return { equipment, inventory };
};

/**
 * Format item ID menjadi nama yang terbaca
 * @param {String} itemId - ID item
 * @returns {String} Nama item yang diformat
 */
const formatItemName = (itemId) => {
  return itemId
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

/**
 * Generate random item berdasarkan tier dan jenis
 * @param {String} type - Jenis item (weapon, armor, resource, consumable)
 * @param {Number} tier - Tier item (1-8)
 * @returns {Object} Item yang digenerate
 */
const generateRandomItem = (type, tier = 1) => {
  const tierPrefix = getTierPrefix(tier);
  
  switch (type) {
    case 'weapon':
      return generateRandomWeapon(tier, tierPrefix);
    case 'armor':
      return generateRandomArmor(tier, tierPrefix);
    case 'resource':
      return generateRandomResource(tier, tierPrefix);
    case 'consumable':
      return generateRandomConsumable(tier, tierPrefix);
    default:
      logger.warn(`Unrecognized item type: ${type}`);
      return null;
  }
};

/**
 * Mendapatkan prefix tier
 * @param {Number} tier - Tier item (1-8)
 * @returns {String} Prefix tier
 */
const getTierPrefix = (tier) => {
  const prefixes = [
    'Rough',      // T1
    'Simple',     // T2
    'Journeyman', // T3
    'Adept',      // T4
    'Expert',     // T5
    'Master',     // T6
    'Grandmaster',// T7
    'Elder'       // T8
  ];
  
  return prefixes[tier - 1] || 'Rough';
};

/**
 * Generate random weapon berdasarkan tier
 * @param {Number} tier - Tier weapon (1-8)
 * @param {String} tierPrefix - Prefix tier
 * @returns {Object} Weapon yang digenerate
 */
const generateRandomWeapon = (tier, tierPrefix) => {
  const weaponTypes = ['sword', 'axe', 'mace', 'dagger', 'spear', 'bow', 'staff'];
  const selectedType = weaponTypes[Math.floor(Math.random() * weaponTypes.length)];
  
  const itemId = `${tierPrefix.toLowerCase()}_${selectedType}`;
  const name = `${tierPrefix} ${formatItemName(selectedType)}`;
  
  // Base damage berdasarkan tier
  const baseDamage = 5 + (tier - 1) * 5;
  
  return {
    itemId,
    name,
    type: 'weapon',
    subType: selectedType,
    tier,
    stats: {
      damage: baseDamage,
      attackSpeed: 1.0 + (Math.random() * 0.5) // Random attack speed antara 1.0 - 1.5
    }
  };
};

/**
 * Generate random armor berdasarkan tier
 * @param {Number} tier - Tier armor (1-8)
 * @param {String} tierPrefix - Prefix tier
 * @returns {Object} Armor yang digenerate
 */
const generateRandomArmor = (tier, tierPrefix) => {
  const armorTypes = ['plate', 'leather', 'cloth'];
  const armorSlots = ['head', 'chest', 'legs', 'boots'];
  
  const selectedType = armorTypes[Math.floor(Math.random() * armorTypes.length)];
  const selectedSlot = armorSlots[Math.floor(Math.random() * armorSlots.length)];
  
  const itemId = `${tierPrefix.toLowerCase()}_${selectedType}_${selectedSlot}`;
  const name = `${tierPrefix} ${formatItemName(selectedType)} ${formatItemName(selectedSlot)}`;
  
  // Base defense berdasarkan tier dan jenis armor
  let baseDefense = 3 + (tier - 1) * 3;
  
  if (selectedType === 'plate') {
    baseDefense += 2;
  } else if (selectedType === 'leather') {
    baseDefense += 1;
  }
  
  return {
    itemId,
    name,
    type: 'armor',
    subType: selectedSlot,
    tier,
    stats: {
      defense: baseDefense,
      healthBonus: 5 + (tier - 1) * 5
    }
  };
};

/**
 * Generate random resource berdasarkan tier
 * @param {Number} tier - Tier resource (1-8)
 * @param {String} tierPrefix - Prefix tier
 * @returns {Object} Resource yang digenerate
 */
const generateRandomResource = (tier, tierPrefix) => {
  const resourceTypes = ['logs', 'ore', 'stone', 'hide', 'fiber'];
  const selectedType = resourceTypes[Math.floor(Math.random() * resourceTypes.length)];
  
  const itemId = `${tierPrefix.toLowerCase()}_${selectedType}`;
  const name = `${tierPrefix} ${formatItemName(selectedType)}`;
  
  // Random quantity berdasarkan tier
  const quantity = Math.max(1, Math.floor(Math.random() * 5) - (tier - 1));
  
  return {
    itemId,
    name,
    type: 'resource',
    tier,
    quantity
  };
};

/**
 * Generate random consumable berdasarkan tier
 * @param {Number} tier - Tier consumable (1-8)
 * @param {String} tierPrefix - Prefix tier
 * @returns {Object} Consumable yang digenerate
 */
const generateRandomConsumable = (tier, tierPrefix) => {
  const consumableTypes = ['healing_potion', 'energy_potion', 'resistance_potion'];
  const selectedType = consumableTypes[Math.floor(Math.random() * consumableTypes.length)];
  
  const itemId = `${tierPrefix.toLowerCase()}_${selectedType}`;
  const name = `${tierPrefix} ${formatItemName(selectedType)}`;
  
  // Stats berdasarkan jenis consumable
  let stats = {};
  
  if (selectedType === 'healing_potion') {
    stats.healthRestore = 50 * tier;
  } else if (selectedType === 'energy_potion') {
    stats.energyRestore = 30 * tier;
  } else if (selectedType === 'resistance_potion') {
    stats.resistanceBoost = 10 * tier;
    stats.duration = 300; // seconds
  }
  
  return {
    itemId,
    name,
    type: 'consumable',
    tier,
    quantity: 1,
    stats
  };
};

module.exports = {
  generateStarterEquipment,
  generateRandomItem,
  formatItemName
}; 