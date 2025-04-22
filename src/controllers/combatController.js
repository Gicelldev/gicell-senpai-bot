const Player = require('../models/Player');
const Item = require('../models/Item');
const logger = require('../utils/logger');
const { generateRandomItem } = require('../utils/itemGenerator');
const { updateQuestProgress } = require('./questController');
const monsterManager = require('../utils/monsterManager');

/**
 * Menyerang target (monster atau pemain)
 * @param {String} userId - ID pengguna WhatsApp
 * @param {String} target - Target yang diserang
 * @returns {Object} - Status dan pesan respons
 */
const attack = async (userId, target) => {
  try {
    // Validasi input
    if (!target) {
      return {
        status: false,
        message: 'Silakan tentukan target yang ingin diserang. Contoh: !serang wolf atau !serang @pemain'
      };
    }
    
    // Cari pemain dalam database
    const player = await Player.findByUserId(userId);
    
    if (!player) {
      return {
        status: false,
        message: 'Anda belum terdaftar sebagai pemain. Gunakan !daftar [nama] untuk mendaftar.'
      };
    }
    
    // Update lastActivity
    player.lastActivity = Date.now();
    
    // Cek status HP pemain
    if (player.stats.health <= 0) {
      return {
        status: false,
        message: 'Anda telah mati dan tidak dapat menyerang. Gunakan potion untuk menyembuhkan diri.'
      };
    }
    
    // Tentukan jenis target (monster atau pemain)
    const isPlayer = target.startsWith('@');
    
    if (isPlayer) {
      // Serang pemain lain
      return attackPlayer(player, target.substring(1));
    } else {
      // Serang monster
      return attackMonster(player, target);
    }
  } catch (error) {
    logger.error(`Error attacking: ${error.message}`);
    return {
      status: false,
      message: `Terjadi kesalahan saat menyerang: ${error.message}`
    };
  }
};

/**
 * Menyerang monster
 * @param {Object} player - Pemain yang menyerang
 * @param {String} monsterName - Nama monster yang diserang
 * @returns {Object} - Status dan pesan respons
 */
const attackMonster = async (player, monsterName) => {
  // Dapatkan monster dari monster manager
  const monster = monsterManager.getMonsterById(monsterName);
  
  if (!monster) {
    // Tidak ditemukan, tampilkan monster yang tersedia di zona
    const availableMonsters = monsterManager.getMonstersByZone(player.currentZone);
    
    if (!availableMonsters || availableMonsters.length === 0) {
      return {
        status: false,
        message: `Tidak ada monster di zona ${player.currentZone}.`
      };
    }
    
    return {
      status: false,
      message: `Monster "${monsterName}" tidak ditemukan di zona ${player.currentZone}. Monster yang tersedia: ${availableMonsters.map(m => m.name).join(', ')}.`
    };
  }
  
  // Pastikan monster ada di zona saat ini
  if (monster.zone !== player.currentZone) {
    return {
      status: false,
      message: `Monster "${monster.name}" tidak ada di zona ${player.currentZone}. Anda perlu berpindah ke zona ${monster.zone}.`
    };
  }
  
  // Hitung damage serangan pemain
  const playerDamage = calculatePlayerDamage(player);
  
  // Hitung damage monster ke pemain
  const monsterDamageToPlayer = Math.max(1, monster.attack - (player.stats.defense / 2));
  
  // Hitung damage pemain ke monster
  const playerDamageToMonster = Math.max(1, playerDamage - (monster.defense / 2));
  
  // Simulasi pertarungan (simplified)
  const initialMonsterHP = monster.hp;
  let monsterHP = initialMonsterHP;
  let battleLog = [];
  let roundCount = 0;
  
  while (monsterHP > 0 && player.stats.health > 0 && roundCount < 10) {
    roundCount++;
    
    // Pemain menyerang monster
    monsterHP -= playerDamageToMonster;
    battleLog.push(`⚔️ Anda menyerang ${monster.name} sebesar ${playerDamageToMonster} damage.`);
    
    if (monsterHP <= 0) {
      battleLog.push(`🎯 Anda mengalahkan ${monster.name}!`);
      break;
    }
    
    // Monster menyerang pemain
    player.stats.health -= monsterDamageToPlayer;
    battleLog.push(`🗡️ ${monster.name} menyerang Anda sebesar ${monsterDamageToPlayer} damage.`);
    
    if (player.stats.health <= 0) {
      battleLog.push(`💀 Anda dikalahkan oleh ${monster.name}!`);
      break;
    }
  }
  
  // Cek hasil pertarungan
  if (monsterHP <= 0) {
    // Pemain menang
    // Dapatkan experience
    player.addExperience(monster.exp);
    
    // Dapatkan Gmoney
    const gmoneyReward = Math.floor(Math.random() * (monster.maxGmoney - monster.minGmoney + 1)) + monster.minGmoney;
    player.gmoney += gmoneyReward;
    
    // Dapatkan loot
    const drops = [];
    
    // Chance untuk mendapatkan resource dari monster
    if (monster.loot && monster.loot.length > 0 && Math.random() < (monster.lootChance || 0.7)) {
      const lootItem = monster.loot[Math.floor(Math.random() * monster.loot.length)];
      const lootQuantity = Math.floor(Math.random() * 3) + 1;
      
      // Cari data item
      const lootItemData = await Item.findByNameOrId(lootItem);
      
      if (lootItemData) {
        const loot = {
          itemId: lootItemData.itemId,
          name: lootItemData.name,
          type: lootItemData.type,
          tier: lootItemData.tier,
          quantity: lootQuantity
        };
        
        player.addItem(loot);
        drops.push(`${loot.name} x${loot.quantity}`);
      }
    }
    
    // Chance untuk mendapatkan rare drop
    if (Math.random() < 0.1) { // 10% chance
      const rareItemType = Math.random() < 0.5 ? 'weapon' : 'armor';
      const rareItemTier = Math.min(Math.ceil(Math.random() * 2) + monster.id.length % 3, 8);
      
      const rareItem = generateRandomItem(rareItemType, rareItemTier);
      player.addItem(rareItem);
      drops.push(`${rareItem.name} (Rare!)`);
    }
    
    // Simpan perubahan pemain
    await player.save();
    
    // Update quest progress untuk monster yang dikalahkan
    await updateQuestProgress(player.userId, 'combat', monster.id, 1);
    
    logger.info(`Player ${player.name} defeated ${monster.name} and gained ${monster.exp} exp and ${gmoneyReward} Gmoney`);
    
    // Buat pesan respons
    let message = `🏆 PERTARUNGAN MENANG 🏆\n\n`;
    message += battleLog.join('\n') + '\n\n';
    message += `HP Anda: ${player.stats.health}/${player.stats.maxHealth}\n`;
    message += `EXP didapat: ${monster.exp}\n`;
    message += `Gmoney didapat: ${gmoneyReward}\n`;
    
    if (drops.length > 0) {
      message += `Item yang didapat:\n- ${drops.join('\n- ')}\n`;
    }
    
    return {
      status: true,
      message
    };
  } else if (player.stats.health <= 0) {
    // Pemain kalah
    // Kurangi Gmoney sebagai penalty
    const gmoneyLoss = Math.floor(player.gmoney * 0.1); // 10% dari Gmoney
    player.gmoney = Math.max(0, player.gmoney - gmoneyLoss);
    
    // Reset HP menjadi 1
    player.stats.health = 1;
    
    // Simpan perubahan pemain
    await player.save();
    
    logger.info(`Player ${player.name} was defeated by ${monster.name} and lost ${gmoneyLoss} Gmoney`);
    
    // Buat pesan respons
    let message = `☠️ PERTARUNGAN KALAH ☠️\n\n`;
    message += battleLog.join('\n') + '\n\n';
    message += `HP Anda: ${player.stats.health}/${player.stats.maxHealth}\n`;
    message += `Gmoney hilang: ${gmoneyLoss}\n\n`;
    message += `Gunakan potion untuk menyembuhkan diri!`;
    
    return {
      status: true,
      message
    };
  } else {
    // Pertarungan berakhir karena batas ronde
    // Kurangi sedikit Gmoney
    const gmoneyLoss = Math.floor(player.gmoney * 0.05); // 5% dari Gmoney
    player.gmoney = Math.max(0, player.gmoney - gmoneyLoss);
    
    // Simpan perubahan pemain
    await player.save();
    
    logger.info(`Player ${player.name} tied with ${monster.name} and lost ${gmoneyLoss} Gmoney`);
    
    // Buat pesan respons
    let message = `🏳️ PERTARUNGAN SERI 🏳️\n\n`;
    message += battleLog.join('\n') + '\n\n';
    message += `HP Anda: ${player.stats.health}/${player.stats.maxHealth}\n`;
    message += `Gmoney hilang: ${gmoneyLoss}\n\n`;
    message += `Anda dan ${monster.name} sama-sama kelelahan dan mundur.`;
    
    return {
      status: true,
      message
    };
  }
};

/**
 * Menyerang pemain lain
 * @param {Object} attacker - Pemain yang menyerang
 * @param {String} targetName - Nama pemain yang diserang
 * @returns {Object} - Status dan pesan respons
 */
const attackPlayer = async (attacker, targetName) => {
  // Cek zona
  if (attacker.currentZone === 'safe') {
    return {
      status: false,
      message: 'Anda tidak dapat menyerang pemain lain di Safe Zone.'
    };
  }
  
  // Cari target dalam database
  const target = await Player.findOne({ name: new RegExp(`^${targetName}$`, 'i') });
  
  if (!target) {
    return {
      status: false,
      message: `Pemain "${targetName}" tidak ditemukan.`
    };
  }
  
  // Cek apakah menyerang diri sendiri
  if (target._id.toString() === attacker._id.toString()) {
    return {
      status: false,
      message: 'Anda tidak dapat menyerang diri sendiri.'
    };
  }
  
  // Cek apakah target di Safe Zone
  if (target.currentZone === 'safe') {
    return {
      status: false,
      message: `${target.name} berada di Safe Zone dan tidak dapat diserang.`
    };
  }
  
  // Cek apakah pemain dalam guild yang sama
  if (attacker.guild && target.guild && attacker.guild.toString() === target.guild.toString()) {
    return {
      status: false,
      message: `${target.name} adalah anggota guild yang sama dengan Anda.`
    };
  }
  
  // Cek apakah target HP-nya 0
  if (target.stats.health <= 0) {
    return {
      status: false,
      message: `${target.name} sudah mati dan tidak dapat diserang lagi.`
    };
  }
  
  // Hitung damage serangan pemain
  const attackerDamage = calculatePlayerDamage(attacker);
  
  // Hitung damage target ke pemain
  const targetDamage = calculatePlayerDamage(target);
  
  // Hitung damage pemain ke target
  const damageToTarget = Math.max(1, attackerDamage - (target.stats.defense / 2));
  
  // Hitung damage target ke pemain
  const damageToAttacker = Math.max(1, targetDamage - (attacker.stats.defense / 2));
  
  // Kurangi HP target
  target.stats.health = Math.max(0, target.stats.health - damageToTarget);
  
  // Kurangi HP pemain
  attacker.stats.health = Math.max(0, attacker.stats.health - damageToAttacker);
  
  // Tentukan pemenang
  let winnerName = null;
  let loserName = null;
  
  if (target.stats.health <= 0 && attacker.stats.health > 0) {
    // Attacker menang
    winnerName = attacker.name;
    loserName = target.name;
    
    // Dapatkan experience
    const expGained = Math.floor(target.level * 5);
    attacker.addExperience(expGained);
    
    // Dapatkan Gmoney
    const gmoneyStolen = Math.min(
      Math.floor(target.gmoney * 0.1), // 10% dari Gmoney target
      Math.floor(Math.random() * 100) + 50 // 50-150 Gmoney
    );
    
    target.gmoney = Math.max(0, target.gmoney - gmoneyStolen);
    attacker.gmoney += gmoneyStolen;
    
    // Simpan perubahan
    await Promise.all([attacker.save(), target.save()]);
    
    logger.info(`Player ${attacker.name} defeated ${target.name} in PvP and gained ${expGained} exp and ${gmoneyStolen} Gmoney`);
    
    // Buat pesan respons
    let message = `⚔️ PVP MENANG ⚔️\n\n`;
    message += `Anda menyerang ${target.name} sebesar ${damageToTarget} damage.\n`;
    message += `${target.name} menyerang Anda sebesar ${damageToAttacker} damage.\n\n`;
    message += `Anda mengalahkan ${target.name}!\n\n`;
    message += `HP Anda: ${attacker.stats.health}/${attacker.stats.maxHealth}\n`;
    message += `EXP didapat: ${expGained}\n`;
    message += `Gmoney dicuri: ${gmoneyStolen}\n`;
    
    return {
      status: true,
      message
    };
  } else if (attacker.stats.health <= 0 && target.stats.health > 0) {
    // Target menang
    winnerName = target.name;
    loserName = attacker.name;
    
    // Kurangi Gmoney sebagai penalty
    const gmoneyLoss = Math.floor(attacker.gmoney * 0.05); // 5% dari Gmoney
    attacker.gmoney = Math.max(0, attacker.gmoney - gmoneyLoss);
    
    // Reset HP attacker menjadi 1
    attacker.stats.health = 1;
    
    // Simpan perubahan
    await Promise.all([attacker.save(), target.save()]);
    
    logger.info(`Player ${attacker.name} was defeated by ${target.name} in PvP and lost ${gmoneyLoss} Gmoney`);
    
    // Buat pesan respons
    let message = `⚔️ PVP KALAH ⚔️\n\n`;
    message += `Anda menyerang ${target.name} sebesar ${damageToTarget} damage.\n`;
    message += `${target.name} menyerang Anda sebesar ${damageToAttacker} damage.\n\n`;
    message += `Anda dikalahkan oleh ${target.name}!\n\n`;
    message += `HP Anda: ${attacker.stats.health}/${attacker.stats.maxHealth}\n`;
    message += `Gmoney hilang: ${gmoneyLoss}\n`;
    
    return {
      status: true,
      message
    };
  } else {
    // Draw
    // Kurangi sedikit Gmoney dari keduanya
    const attackerGmoneyLoss = Math.floor(attacker.gmoney * 0.02); // 2% dari Gmoney
    const targetGmoneyLoss = Math.floor(target.gmoney * 0.02); // 2% dari Gmoney
    
    attacker.gmoney = Math.max(0, attacker.gmoney - attackerGmoneyLoss);
    target.gmoney = Math.max(0, target.gmoney - targetGmoneyLoss);
    
    // Simpan perubahan
    await Promise.all([attacker.save(), target.save()]);
    
    logger.info(`PvP between ${attacker.name} and ${target.name} ended in a draw`);
    
    // Buat pesan respons
    let message = `⚔️ PVP SERI ⚔️\n\n`;
    message += `Anda menyerang ${target.name} sebesar ${damageToTarget} damage.\n`;
    message += `${target.name} menyerang Anda sebesar ${damageToAttacker} damage.\n\n`;
    message += `Pertarungan berakhir seri!\n\n`;
    message += `HP Anda: ${attacker.stats.health}/${attacker.stats.maxHealth}\n`;
    message += `Gmoney hilang: ${attackerGmoneyLoss}\n`;
    
    return {
      status: true,
      message
    };
  }
};

/**
 * Menghitung damage serangan pemain
 * @param {Object} player - Pemain
 * @returns {Number} - Damage serangan
 */
const calculatePlayerDamage = (player) => {
  // Base damage
  let damage = player.stats.attack;
  
  // Tambahkan damage dari weapon jika ada
  if (player.equipment.weapon && player.equipment.weapon.stats && player.equipment.weapon.stats.damage) {
    damage += player.equipment.weapon.stats.damage;
  }
  
  // Tambahkan variasi acak (±10%)
  const variation = damage * 0.1;
  damage = damage - variation + (Math.random() * variation * 2);
  
  return Math.floor(damage);
};

/**
 * Menggunakan item penyembuhan
 * @param {String} userId - ID pengguna WhatsApp
 * @param {String} itemId - ID item yang digunakan
 * @returns {Object} - Status dan pesan respons
 */
const useHealingItem = async (userId, itemId) => {
  try {
    // Validasi input
    if (!itemId) {
      return {
        status: false,
        message: 'Silakan tentukan item yang ingin digunakan. Contoh: !heal minor_healing_potion'
      };
    }
    
    // Cari pemain dalam database
    const player = await Player.findByUserId(userId);
    
    if (!player) {
      return {
        status: false,
        message: 'Anda belum terdaftar sebagai pemain. Gunakan !daftar [nama] untuk mendaftar.'
      };
    }
    
    // Update lastActivity
    player.lastActivity = Date.now();
    
    // Cari item di inventory pemain
    const inventoryItem = player.inventory.find(i => 
      i.itemId === itemId || 
      i.name.toLowerCase() === itemId.toLowerCase()
    );
    
    if (!inventoryItem) {
      return {
        status: false,
        message: `Item "${itemId}" tidak ditemukan dalam inventory Anda.`
      };
    }
    
    // Cek apakah item adalah consumable
    if (inventoryItem.type !== 'consumable') {
      return {
        status: false,
        message: `Item "${inventoryItem.name}" bukan item konsumable.`
      };
    }
    
    // Cek apakah item memiliki efek penyembuhan
    if (!inventoryItem.stats || !inventoryItem.stats.healthRestore) {
      return {
        status: false,
        message: `Item "${inventoryItem.name}" tidak memiliki efek penyembuhan.`
      };
    }
    
    // Jika HP sudah penuh
    if (player.stats.health >= player.stats.maxHealth) {
      return {
        status: false,
        message: `HP Anda sudah penuh (${player.stats.health}/${player.stats.maxHealth}).`
      };
    }
    
    // Simpan HP lama
    const oldHealth = player.stats.health;
    
    // Tambahkan HP
    player.stats.health = Math.min(player.stats.maxHealth, player.stats.health + inventoryItem.stats.healthRestore);
    
    // Kurangi item dari inventory
    player.removeItem(inventoryItem.itemId, 1);
    
    // Simpan perubahan pemain
    await player.save();
    
    logger.info(`Player ${player.name} used ${inventoryItem.name} and healed for ${player.stats.health - oldHealth} HP`);
    
    // Buat pesan respons
    let message = `💉 PENYEMBUHAN 💉\n\n`;
    message += `Anda menggunakan ${inventoryItem.name}.\n`;
    message += `HP pulih: ${player.stats.health - oldHealth}\n`;
    message += `HP saat ini: ${player.stats.health}/${player.stats.maxHealth}\n`;
    
    return {
      status: true,
      message
    };
  } catch (error) {
    logger.error(`Error using healing item: ${error.message}`);
    return {
      status: false,
      message: `Terjadi kesalahan saat menggunakan item penyembuhan: ${error.message}`
    };
  }
};

module.exports = {
  attack,
  useHealingItem
}; 