const Player = require('../models/Player');
const { Dungeon, DungeonInstance, PlayerDungeon } = require('../models/Dungeon');
const { generateRandomItem } = require('../utils/itemGenerator');
const { createNotification } = require('./notificationController');
const logger = require('../utils/logger');

/**
 * Melihat daftar dungeon yang tersedia
 * @param {String} userId - ID pengguna WhatsApp
 * @returns {Object} - Status dan pesan respons
 */
const viewDungeons = async (userId) => {
  try {
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
    await player.save();
    
    // Cari dungeon yang tersedia berdasarkan level pemain
    const dungeons = await Dungeon.findByPlayerLevel(player.level);
    
    if (dungeons.length === 0) {
      return {
        status: true,
        message: '🧩 DUNGEON 🧩\n\nTidak ada dungeon yang tersedia untuk level Anda. Tingkatkan level untuk membuka dungeon.'
      };
    }
    
    // Buat daftar dungeon
    let dungeonsList = '';
    for (const dungeon of dungeons) {
      // Cek cooldown
      const cooldownInfo = await PlayerDungeon.checkCooldown(player._id, dungeon._id);
      
      // Tampilkan informasi cooldown
      let cooldownText = '';
      if (cooldownInfo.onCooldown) {
        cooldownText = ` (Cooldown: ${Math.ceil(cooldownInfo.remainingTime)} menit)`;
      }
      
      dungeonsList += `${dungeon.name} (Tier ${dungeon.tier}) - Level ${dungeon.minLevel}+${cooldownText}\n`;
      dungeonsList += `  ${dungeon.description}\n`;
      dungeonsList += `  Monster: ${dungeon.monsters.length} | Waktu: ${dungeon.timeLimit} menit\n\n`;
    }
    
    return {
      status: true,
      message: `🧩 DUNGEON 🧩\n\n${dungeonsList}\nUntuk memasuki dungeon, gunakan !dungeon masuk [nama_dungeon]`
    };
  } catch (error) {
    logger.error(`Error viewing dungeons: ${error.message}`);
    return {
      status: false,
      message: `Terjadi kesalahan saat melihat dungeon: ${error.message}`
    };
  }
};

/**
 * Masuk ke dalam dungeon
 * @param {String} userId - ID pengguna WhatsApp
 * @param {String} dungeonName - Nama dungeon yang ingin dimasuki
 * @returns {Object} - Status dan pesan respons
 */
const enterDungeon = async (userId, dungeonName) => {
  try {
    // Validasi input
    if (!dungeonName) {
      return {
        status: false,
        message: 'Silakan tentukan nama dungeon yang ingin dimasuki. Contoh: !dungeon masuk Gua Goblin'
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
    
    // Cek apakah player HP cukup
    if (player.stats.health < player.stats.maxHealth * 0.5) {
      return {
        status: false,
        message: `HP Anda terlalu rendah (${player.stats.health}/${player.stats.maxHealth}). Minimal 50% dari max HP untuk memasuki dungeon. Gunakan potion untuk menyembuhkan.`
      };
    }
    
    // Cek apakah pemain sudah berada dalam dungeon lain
    const activeDungeon = await DungeonInstance.findOne({
      players: player._id,
      status: 'in_progress'
    });
    
    if (activeDungeon) {
      return {
        status: false,
        message: `Anda sudah berada dalam dungeon "${activeDungeon.dungeon.name}". Selesaikan atau batalkan dungeon tersebut terlebih dahulu.`
      };
    }
    
    // Cari dungeon berdasarkan nama
    const dungeon = await Dungeon.findOne({
      name: new RegExp(`^${dungeonName}$`, 'i'),
      isActive: true
    });
    
    if (!dungeon) {
      return {
        status: false,
        message: `Dungeon "${dungeonName}" tidak ditemukan.`
      };
    }
    
    // Cek level minimum
    if (player.level < dungeon.minLevel) {
      return {
        status: false,
        message: `Level Anda (${player.level}) tidak mencukupi untuk memasuki dungeon "${dungeon.name}". Minimal level ${dungeon.minLevel}.`
      };
    }
    
    // Cek cooldown
    const cooldownInfo = await PlayerDungeon.checkCooldown(player._id, dungeon._id);
    if (cooldownInfo.onCooldown) {
      return {
        status: false,
        message: `Dungeon "${dungeon.name}" masih dalam cooldown. Silakan coba lagi dalam ${Math.ceil(cooldownInfo.remainingTime)} menit.`
      };
    }
    
    // Tentukan jumlah ruangan dalam dungeon
    const totalRooms = dungeon.monsters.length;
    
    // Buat instance dungeon baru
    const dungeonInstance = new DungeonInstance({
      dungeon: dungeon._id,
      players: [player._id],
      totalRooms: totalRooms,
      battleLog: [`${player.name} memasuki ${dungeon.name}.`]
    });
    
    // Simpan instance dungeon
    await dungeonInstance.save();
    await dungeonInstance.populate('dungeon');
    
    logger.info(`Player ${player.name} entered dungeon ${dungeon.name}`);
    
    return {
      status: true,
      message: `🧩 DUNGEON: ${dungeon.name} 🧩\n\n` +
        `Anda memasuki ${dungeon.name} (Tier ${dungeon.tier}).\n\n` +
        `${dungeon.description}\n\n` +
        `Total ruangan: ${totalRooms}\n` +
        `Batas waktu: ${dungeon.timeLimit} menit\n\n` +
        `Untuk melanjutkan eksplorasi, gunakan !dungeon lanjut.\n` +
        `Untuk keluar dari dungeon, gunakan !dungeon keluar.`
    };
  } catch (error) {
    logger.error(`Error entering dungeon: ${error.message}`);
    return {
      status: false,
      message: `Terjadi kesalahan saat memasuki dungeon: ${error.message}`
    };
  }
};

/**
 * Melanjutkan eksplorasi dungeon
 * @param {String} userId - ID pengguna WhatsApp
 * @returns {Object} - Status dan pesan respons
 */
const continueDungeon = async (userId) => {
  try {
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
    
    // Cek apakah pemain berada dalam dungeon
    const dungeonInstance = await DungeonInstance.findOne({
      players: player._id,
      status: 'in_progress'
    }).populate('dungeon');
    
    if (!dungeonInstance) {
      return {
        status: false,
        message: `Anda tidak sedang berada dalam dungeon. Gunakan !dungeon masuk [nama_dungeon] untuk memasuki dungeon.`
      };
    }
    
    // Cek apakah HP cukup
    if (player.stats.health <= 0) {
      // Update status dungeon menjadi gagal
      dungeonInstance.status = 'failed';
      dungeonInstance.completedAt = new Date();
      dungeonInstance.battleLog.push(`${player.name} gugur dalam pertarungan.`);
      await dungeonInstance.save();
      
      // Reset HP pemain menjadi 1
      player.stats.health = 1;
      await player.save();
      
      return {
        status: true,
        message: `🧩 DUNGEON GAGAL 🧩\n\n` +
          `Anda gugur dalam pertarungan di ${dungeonInstance.dungeon.name}.\n\n` +
          `HP Anda telah diatur menjadi 1. Gunakan potion untuk menyembuhkan diri sebelum petualangan selanjutnya.`
      };
    }
    
    // Cek apakah dungeon sudah selesai
    if (dungeonInstance.currentRoom >= dungeonInstance.totalRooms) {
      // Berikan hadiah dungeon
      const rewards = await completeDungeon(player, dungeonInstance);
      
      return {
        status: true,
        message: `🎉 DUNGEON SELESAI 🎉\n\n` +
          `Anda telah menyelesaikan ${dungeonInstance.dungeon.name}!\n\n` +
          `${rewards.message}`
      };
    }
    
    // Lakukan pertarungan dengan monster di ruangan saat ini
    const currentRoom = dungeonInstance.currentRoom;
    const monster = dungeonInstance.dungeon.monsters[currentRoom];
    
    // Inisialisasi stats monster
    const monsterStats = {
      name: monster.name,
      health: monster.health,
      attack: monster.attack,
      defense: monster.defense
    };
    
    // Pertarungan berlangsung dalam ronde
    let playerWin = false;
    let battleLog = [];
    let expGained = 0;
    let gmoneyGained = 0;
    let drops = [];
    
    // Mulai pertarungan
    for (let round = 1; round <= 10; round++) {
      // Hitung damage pemain ke monster
      const playerDamage = Math.max(1, player.stats.attack - (monsterStats.defense / 2));
      
      // Hitung damage monster ke pemain
      const monsterDamage = Math.max(1, monsterStats.attack - (player.stats.defense / 2));
      
      // Kurangi HP monster
      monsterStats.health = Math.max(0, monsterStats.health - playerDamage);
      
      // Log serangan pemain
      battleLog.push(`Ronde ${round}: ${player.name} menyerang ${monster.name} sebesar ${Math.round(playerDamage)} damage.`);
      
      // Cek apakah monster mati
      if (monsterStats.health <= 0) {
        battleLog.push(`${monster.name} telah dikalahkan!`);
        playerWin = true;
        break;
      }
      
      // Kurangi HP pemain
      player.stats.health = Math.max(0, player.stats.health - monsterDamage);
      
      // Log serangan monster
      battleLog.push(`Ronde ${round}: ${monster.name} menyerang ${player.name} sebesar ${Math.round(monsterDamage)} damage.`);
      
      // Cek apakah pemain mati
      if (player.stats.health <= 0) {
        battleLog.push(`${player.name} telah dikalahkan!`);
        break;
      }
    }
    
    // Tambahkan log pertarungan ke dungeon instance
    dungeonInstance.battleLog.push(...battleLog);
    
    if (playerWin) {
      // Pemain menang
      // Dapatkan experience
      expGained = monster.experience;
      player.addExperience(expGained);
      
      // Dapatkan Gmoney
      gmoneyGained = Math.floor(monster.level * 10 * (1 + Math.random() * 0.5));
      player.gmoney += gmoneyGained;
      
      // Cek apakah mendapat drop
      if (Math.random() < monster.dropChance) {
        // Generate random item sesuai tier monster
        const item = generateRandomItem(monster.dropTier);
        player.addItem(item);
        drops.push(`${item.name} (T${item.tier})`);
      }
      
      // Naikkan ruangan saat ini
      dungeonInstance.currentRoom += 1;
      dungeonInstance.monstersDefeated += 1;
      
      // Simpan perubahan
      await player.save();
      await dungeonInstance.save();
      
      // Buat pesan respons
      let message = `🧩 PERTARUNGAN MENANG 🧩\n\n`;
      message += `Ruangan ${currentRoom + 1}/${dungeonInstance.totalRooms}: Anda mengalahkan ${monster.name}!\n\n`;
      message += battleLog.join('\n') + '\n\n';
      message += `HP Anda: ${Math.round(player.stats.health)}/${player.stats.maxHealth}\n`;
      message += `EXP didapat: ${expGained}\n`;
      message += `Gmoney didapat: ${gmoneyGained}\n\n`;
      
      if (drops.length > 0) {
        message += `Item yang didapat:\n- ${drops.join('\n- ')}\n\n`;
      }
      
      // Cek apakah sudah di ruangan terakhir
      if (dungeonInstance.currentRoom >= dungeonInstance.totalRooms) {
        message += `Anda telah mencapai ruangan terakhir! Gunakan !dungeon lanjut untuk menyelesaikan dungeon.`;
      } else {
        message += `Gunakan !dungeon lanjut untuk melanjutkan ke ruangan berikutnya.`;
      }
      
      return {
        status: true,
        message
      };
    } else {
      // Pemain kalah
      // Update status dungeon menjadi gagal
      dungeonInstance.status = 'failed';
      dungeonInstance.completedAt = new Date();
      dungeonInstance.battleLog.push(`${player.name} gugur dalam pertarungan melawan ${monster.name}.`);
      
      // Reset HP pemain menjadi 1
      player.stats.health = 1;
      
      // Simpan perubahan
      await player.save();
      await dungeonInstance.save();
      
      // Buat pesan respons
      let message = `🧩 PERTARUNGAN KALAH 🧩\n\n`;
      message += `Ruangan ${currentRoom + 1}/${dungeonInstance.totalRooms}: Anda dikalahkan oleh ${monster.name}!\n\n`;
      message += battleLog.join('\n') + '\n\n';
      message += `HP Anda: ${player.stats.health}/${player.stats.maxHealth}\n\n`;
      message += `Anda gagal menyelesaikan dungeon. Gunakan potion untuk menyembuhkan diri sebelum petualangan selanjutnya.`;
      
      return {
        status: true,
        message
      };
    }
  } catch (error) {
    logger.error(`Error continuing dungeon: ${error.message}`);
    return {
      status: false,
      message: `Terjadi kesalahan saat melanjutkan eksplorasi dungeon: ${error.message}`
    };
  }
};

/**
 * Keluar dari dungeon
 * @param {String} userId - ID pengguna WhatsApp
 * @returns {Object} - Status dan pesan respons
 */
const exitDungeon = async (userId) => {
  try {
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
    
    // Cek apakah pemain berada dalam dungeon
    const dungeonInstance = await DungeonInstance.findOne({
      players: player._id,
      status: 'in_progress'
    }).populate('dungeon');
    
    if (!dungeonInstance) {
      return {
        status: false,
        message: `Anda tidak sedang berada dalam dungeon.`
      };
    }
    
    // Update status dungeon menjadi abandoned
    dungeonInstance.status = 'abandoned';
    dungeonInstance.completedAt = new Date();
    dungeonInstance.battleLog.push(`${player.name} memilih untuk keluar dari dungeon.`);
    await dungeonInstance.save();
    
    return {
      status: true,
      message: `🧩 DUNGEON DITINGGALKAN 🧩\n\n` +
        `Anda telah keluar dari ${dungeonInstance.dungeon.name}.\n\n` +
        `Progress eksplorasi: ${dungeonInstance.currentRoom}/${dungeonInstance.totalRooms} ruangan\n` +
        `Monster dikalahkan: ${dungeonInstance.monstersDefeated}`
    };
  } catch (error) {
    logger.error(`Error exiting dungeon: ${error.message}`);
    return {
      status: false,
      message: `Terjadi kesalahan saat keluar dari dungeon: ${error.message}`
    };
  }
};

/**
 * Helper function untuk menyelesaikan dungeon
 * @param {Object} player - Objek pemain
 * @param {Object} dungeonInstance - Objek instance dungeon
 * @returns {Object} - Informasi hadiah
 */
const completeDungeon = async (player, dungeonInstance) => {
  try {
    // Update status dungeon menjadi completed
    dungeonInstance.status = 'completed';
    dungeonInstance.completedAt = new Date();
    dungeonInstance.battleLog.push(`${player.name} berhasil menyelesaikan dungeon.`);
    
    // Simpan atau update cooldown pemain
    let playerDungeon = await PlayerDungeon.findOne({
      player: player._id,
      dungeon: dungeonInstance.dungeon._id
    });
    
    if (playerDungeon) {
      playerDungeon.lastCompleted = new Date();
      playerDungeon.timesCompleted += 1;
      await playerDungeon.save();
    } else {
      playerDungeon = new PlayerDungeon({
        player: player._id,
        dungeon: dungeonInstance.dungeon._id,
        lastCompleted: new Date(),
        timesCompleted: 1
      });
      await playerDungeon.save();
    }
    
    // Berikan hadiah dungeon
    let rewardMessage = '';
    let totalGmoney = 0;
    let totalExp = 0;
    let rewardItems = [];
    
    // Hitung base rewards
    totalGmoney = Math.floor(dungeonInstance.dungeon.tier * 100 * (1 + Math.random() * 0.5));
    totalExp = Math.floor(dungeonInstance.dungeon.tier * 50 * (1 + Math.random() * 0.2));
    
    // Tambahkan rewards dari definisi dungeon
    for (const reward of dungeonInstance.dungeon.rewards) {
      const roll = Math.random();
      
      if (roll < reward.chance || reward.guaranteedReward) {
        switch (reward.type) {
          case 'gmoney':
            totalGmoney += reward.quantity;
            break;
          case 'experience':
            totalExp += reward.quantity;
            break;
          case 'item':
            if (reward.itemId) {
              // TODO: Implementasi pemberian item spesifik
              // Untuk sekarang, generate random item sesuai tier dungeon
              const item = generateRandomItem(dungeonInstance.dungeon.tier);
              player.addItem(item);
              rewardItems.push(`${item.name} (T${item.tier})`);
            }
            break;
        }
      }
    }
    
    // Update pemain
    player.gmoney += totalGmoney;
    player.addExperience(totalExp);
    await player.save();
    
    // Update notifikasi
    createNotification(
      player._id,
      'achievement',
      'Dungeon Selesai',
      `Anda telah berhasil menyelesaikan dungeon ${dungeonInstance.dungeon.name}.`
    );
    
    // Simpan instance dungeon
    await dungeonInstance.save();
    
    // Buat pesan hadiah
    rewardMessage = `Hadiah:\n` +
      `- ${totalGmoney} Gmoney\n` +
      `- ${totalExp} Experience\n`;
    
    if (rewardItems.length > 0) {
      rewardMessage += `- Items: ${rewardItems.join(', ')}\n`;
    }
    
    return {
      success: true,
      message: rewardMessage
    };
  } catch (error) {
    logger.error(`Error completing dungeon: ${error.message}`);
    return {
      success: false,
      message: 'Terjadi kesalahan saat menyelesaikan dungeon.'
    };
  }
};

module.exports = {
  viewDungeons,
  enterDungeon,
  continueDungeon,
  exitDungeon
}; 