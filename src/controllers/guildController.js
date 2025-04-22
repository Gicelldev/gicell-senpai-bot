const Player = require('../models/Player');
const Guild = require('../models/Guild');
const logger = require('../utils/logger');

/**
 * Menangani semua perintah terkait guild
 * @param {String} userId - ID pengguna WhatsApp
 * @param {Array} args - Argumen perintah
 * @returns {Object} - Status dan pesan respons
 */
const handleGuild = async (userId, args) => {
  try {
    // Cari pemain dalam database
    const player = await Player.findByUserId(userId);
    
    // Jika pemain tidak ditemukan
    if (!player) {
      return {
        status: false,
        message: 'Anda belum terdaftar sebagai pemain. Gunakan !daftar [nama] untuk mendaftar.'
      };
    }
    
    // Jika tidak ada subcommand, tampilkan info guild saat ini
    if (!args.length) {
      return getGuildInfo(player);
    }
    
    // Proses subcommand
    const subCommand = args.shift().toLowerCase();
    
    switch (subCommand) {
      case 'buat':
      case 'create':
        return createGuild(player, args.join(' '));
      
      case 'gabung':
      case 'join':
        return joinGuild(player, args.join(' '));
      
      case 'keluar':
      case 'leave':
        return leaveGuild(player);
      
      case 'kick':
      case 'keluarkan':
        return kickMember(player, args.join(' '));
      
      case 'promote':
      case 'promosi':
        return promoteMember(player, args[0], args[1]);
      
      case 'sumbang':
      case 'donate':
        return donateToGuild(player, args[0], args[1]);
      
      case 'info':
        return getGuildInfoByName(args.join(' '));
      
      default:
        return {
          status: false,
          message: 'Perintah guild tidak valid. Gunakan !help guild untuk melihat daftar perintah guild.'
        };
    }
  } catch (error) {
    logger.error(`Error handling guild command: ${error.message}`);
    return {
      status: false,
      message: 'Terjadi kesalahan saat memproses perintah guild.'
    };
  }
};

/**
 * Mendapatkan informasi guild pemain saat ini
 * @param {Object} player - Object pemain
 * @returns {Object} - Status dan pesan respons
 */
const getGuildInfo = async (player) => {
  try {
    // Jika pemain tidak memiliki guild
    if (!player.guild) {
      return {
        status: false,
        message: 'Anda belum bergabung dengan guild manapun. Gunakan !guild gabung [nama] untuk bergabung, atau !guild buat [nama] untuk membuat guild baru.'
      };
    }
    
    // Dapatkan data guild
    const guild = await Guild.findById(player.guild).populate('leader', 'name');
    
    if (!guild) {
      // Ini seharusnya tidak terjadi, tapi jaga-jaga jika ada bug
      player.guild = null;
      await player.save();
      
      return {
        status: false,
        message: 'Guild Anda tidak ditemukan. Data telah diperbaiki.'
      };
    }
    
    // Dapatkan status keanggotaan
    const memberStatus = guild.members.find(m => 
      m.playerId.toString() === player._id.toString()
    );
    
    // Format anggota
    const memberCount = guild.members.length;
    const officerCount = guild.members.filter(m => m.rank === 'officer').length;
    
    // Format level dan persyaratan
    const nextLevelReq = guild.getNextLevelRequirement();
    const levelProgress = Math.floor((guild.treasury.gmoney / nextLevelReq) * 100);
    
    // Buat pesan respons
    const message = 
`🏰 *${guild.name} (Level ${guild.level})* 🏰
${guild.description || 'Tidak ada deskripsi.'}

👑 *Pemimpin:* ${guild.leader.name}
👥 *Anggota:* ${memberCount} (${officerCount} Officer)
💼 *Status Anda:* ${memberStatus ? memberStatus.rank : 'member'}

💰 *Guild Treasury:*
- ${guild.treasury.gmoney} Gmoney
- ${guild.treasury.resources.wood} Kayu
- ${guild.treasury.resources.stone} Batu
- ${guild.treasury.resources.ore} Ore
- ${guild.treasury.resources.fiber} Fiber
- ${guild.treasury.resources.hide} Hide

📊 *Progress Level Selanjutnya:* ${levelProgress}% (${guild.treasury.gmoney}/${nextLevelReq})

🏆 *Kontribusi Anda:*
- ${memberStatus ? memberStatus.contribution.gmoney : 0} Gmoney
- ${memberStatus ? memberStatus.contribution.resources : 0} Resources

${guild.territory ? `🗺️ *Wilayah:* ${guild.territory}` : ''}
`;

    return {
      status: true,
      message
    };
  } catch (error) {
    logger.error(`Error getting guild info: ${error.message}`);
    return {
      status: false,
      message: 'Terjadi kesalahan saat mendapatkan informasi guild.'
    };
  }
};

/**
 * Membuat guild baru
 * @param {Object} player - Object pemain
 * @param {String} guildName - Nama guild yang akan dibuat
 * @returns {Object} - Status dan pesan respons
 */
const createGuild = async (player, guildName) => {
  try {
    // Validasi nama guild
    if (!guildName || guildName.length < 3 || guildName.length > 20) {
      return {
        status: false,
        message: 'Nama guild harus antara 3-20 karakter.'
      };
    }
    
    // Periksa apakah pemain sudah memiliki guild
    if (player.guild) {
      return {
        status: false,
        message: 'Anda sudah bergabung dengan guild. Silakan keluar dari guild saat ini terlebih dahulu.'
      };
    }
    
    // Periksa biaya pembuatan guild
    const guildCreationCost = 50000;
    if (player.gmoney < guildCreationCost) {
      return {
        status: false,
        message: `Anda tidak memiliki cukup Gmoney untuk membuat guild. Dibutuhkan ${guildCreationCost} Gmoney.`
      };
    }
    
    // Periksa apakah nama guild sudah digunakan
    const existingGuild = await Guild.findByName(guildName);
    if (existingGuild) {
      return {
        status: false,
        message: `Guild dengan nama "${guildName}" sudah ada. Silakan pilih nama lain.`
      };
    }
    
    // Kurangi Gmoney pemain
    player.gmoney -= guildCreationCost;
    
    // Buat guild baru
    const newGuild = new Guild({
      name: guildName,
      leader: player._id,
      members: [
        {
          playerId: player._id,
          rank: 'leader',
          joinedAt: Date.now(),
          contribution: {
            gmoney: guildCreationCost,
            resources: 0
          }
        }
      ],
      treasury: {
        gmoney: guildCreationCost
      }
    });
    
    // Simpan guild baru
    await newGuild.save();
    
    // Update data pemain
    player.guild = newGuild._id;
    await player.save();
    
    return {
      status: true,
      message: `🎉 Selamat! Guild "${guildName}" berhasil dibuat. Anda adalah pemimpin guild. Gunakan !guild untuk melihat informasi guild.`
    };
  } catch (error) {
    logger.error(`Error creating guild: ${error.message}`);
    return {
      status: false,
      message: 'Terjadi kesalahan saat membuat guild baru.'
    };
  }
};

/**
 * Bergabung dengan guild
 * @param {Object} player - Object pemain
 * @param {String} guildName - Nama guild yang akan dimasuki
 * @returns {Object} - Status dan pesan respons
 */
const joinGuild = async (player, guildName) => {
  try {
    // Validasi nama guild
    if (!guildName) {
      return {
        status: false,
        message: 'Anda harus menentukan nama guild yang ingin dimasuki.'
      };
    }
    
    // Periksa apakah pemain sudah memiliki guild
    if (player.guild) {
      return {
        status: false,
        message: 'Anda sudah bergabung dengan guild. Silakan keluar dari guild saat ini terlebih dahulu.'
      };
    }
    
    // Cari guild berdasarkan nama
    const guild = await Guild.findByName(guildName);
    
    if (!guild) {
      return {
        status: false,
        message: `Guild dengan nama "${guildName}" tidak ditemukan.`
      };
    }
    
    // Tambahkan pemain ke guild
    const addResult = guild.addMember(player._id);
    
    if (!addResult) {
      return {
        status: false,
        message: 'Anda sudah menjadi anggota guild ini.'
      };
    }
    
    // Simpan perubahan
    await guild.save();
    
    // Update data pemain
    player.guild = guild._id;
    await player.save();
    
    return {
      status: true,
      message: `Anda telah bergabung dengan guild "${guild.name}". Gunakan !guild untuk melihat informasi guild.`
    };
  } catch (error) {
    logger.error(`Error joining guild: ${error.message}`);
    return {
      status: false,
      message: 'Terjadi kesalahan saat bergabung dengan guild.'
    };
  }
};

/**
 * Keluar dari guild
 * @param {Object} player - Object pemain
 * @returns {Object} - Status dan pesan respons
 */
const leaveGuild = async (player) => {
  try {
    // Periksa apakah pemain memiliki guild
    if (!player.guild) {
      return {
        status: false,
        message: 'Anda belum bergabung dengan guild manapun.'
      };
    }
    
    // Dapatkan data guild
    const guild = await Guild.findById(player.guild);
    
    if (!guild) {
      // Jika guild tidak ditemukan, perbaiki data pemain
      player.guild = null;
      await player.save();
      
      return {
        status: false,
        message: 'Guild tidak ditemukan. Data Anda telah diperbaiki.'
      };
    }
    
    // Cek apakah pemain adalah leader
    const memberData = guild.members.find(m => m.playerId.toString() === player._id.toString());
    
    if (memberData && memberData.rank === 'leader') {
      // Pemimpin tidak bisa keluar, harus mentransfer kepemimpinan dulu
      return {
        status: false,
        message: 'Anda adalah pemimpin guild. Promosikan anggota lain menjadi pemimpin terlebih dahulu sebelum keluar.'
      };
    }
    
    // Hapus pemain dari guild
    guild.removeMember(player._id);
    await guild.save();
    
    // Update data pemain
    player.guild = null;
    await player.save();
    
    return {
      status: true,
      message: `Anda telah keluar dari guild "${guild.name}".`
    };
  } catch (error) {
    logger.error(`Error leaving guild: ${error.message}`);
    return {
      status: false,
      message: 'Terjadi kesalahan saat keluar dari guild.'
    };
  }
};

/**
 * Keluarkan anggota dari guild
 * @param {Object} player - Object pemain
 * @param {String} targetName - Nama pemain yang akan dikeluarkan
 * @returns {Object} - Status dan pesan respons
 */
const kickMember = async (player, targetName) => {
  try {
    // Validasi nama target
    if (!targetName) {
      return {
        status: false,
        message: 'Anda harus menentukan nama pemain yang ingin dikeluarkan.'
      };
    }
    
    // Periksa apakah pemain memiliki guild
    if (!player.guild) {
      return {
        status: false,
        message: 'Anda belum bergabung dengan guild manapun.'
      };
    }
    
    // Dapatkan data guild
    const guild = await Guild.findById(player.guild);
    
    if (!guild) {
      // Jika guild tidak ditemukan, perbaiki data pemain
      player.guild = null;
      await player.save();
      
      return {
        status: false,
        message: 'Guild tidak ditemukan. Data Anda telah diperbaiki.'
      };
    }
    
    // Cek apakah pemain adalah leader atau officer
    const memberData = guild.members.find(m => m.playerId.toString() === player._id.toString());
    
    if (!memberData || (memberData.rank !== 'leader' && memberData.rank !== 'officer')) {
      return {
        status: false,
        message: 'Hanya pemimpin dan officer yang dapat mengeluarkan anggota.'
      };
    }
    
    // Cari target pemain
    const targetPlayer = await Player.findOne({ name: new RegExp(`^${targetName}$`, 'i') });
    
    if (!targetPlayer) {
      return {
        status: false,
        message: `Pemain dengan nama "${targetName}" tidak ditemukan.`
      };
    }
    
    // Cek apakah target adalah anggota guild
    const targetMemberData = guild.members.find(m => m.playerId.toString() === targetPlayer._id.toString());
    
    if (!targetMemberData) {
      return {
        status: false,
        message: `${targetName} bukan anggota guild Anda.`
      };
    }
    
    // Officer tidak bisa kick leader atau officer lain
    if (memberData.rank === 'officer' && (targetMemberData.rank === 'leader' || targetMemberData.rank === 'officer')) {
      return {
        status: false,
        message: 'Anda tidak memiliki izin untuk mengeluarkan pemimpin atau officer lain.'
      };
    }
    
    // Hapus pemain dari guild
    guild.removeMember(targetPlayer._id);
    await guild.save();
    
    // Update data target
    targetPlayer.guild = null;
    await targetPlayer.save();
    
    return {
      status: true,
      message: `${targetName} telah dikeluarkan dari guild.`
    };
  } catch (error) {
    logger.error(`Error kicking member: ${error.message}`);
    return {
      status: false,
      message: 'Terjadi kesalahan saat mengeluarkan anggota dari guild.'
    };
  }
};

/**
 * Mempromosikan anggota guild
 * @param {Object} player - Object pemain
 * @param {String} targetName - Nama pemain yang akan dipromosikan
 * @param {String} newRank - Rank baru (officer/leader)
 * @returns {Object} - Status dan pesan respons
 */
const promoteMember = async (player, targetName, newRank) => {
  try {
    // Validasi input
    if (!targetName) {
      return {
        status: false,
        message: 'Anda harus menentukan nama pemain yang ingin dipromosikan.'
      };
    }
    
    if (!newRank || !['officer', 'leader'].includes(newRank.toLowerCase())) {
      return {
        status: false,
        message: 'Rank harus berupa "officer" atau "leader".'
      };
    }
    
    newRank = newRank.toLowerCase();
    
    // Periksa apakah pemain memiliki guild
    if (!player.guild) {
      return {
        status: false,
        message: 'Anda belum bergabung dengan guild manapun.'
      };
    }
    
    // Dapatkan data guild
    const guild = await Guild.findById(player.guild);
    
    if (!guild) {
      // Jika guild tidak ditemukan, perbaiki data pemain
      player.guild = null;
      await player.save();
      
      return {
        status: false,
        message: 'Guild tidak ditemukan. Data Anda telah diperbaiki.'
      };
    }
    
    // Cek apakah pemain adalah leader
    const memberData = guild.members.find(m => m.playerId.toString() === player._id.toString());
    
    if (!memberData || memberData.rank !== 'leader') {
      return {
        status: false,
        message: 'Hanya pemimpin yang dapat mempromosikan anggota.'
      };
    }
    
    // Cari target pemain
    const targetPlayer = await Player.findOne({ name: new RegExp(`^${targetName}$`, 'i') });
    
    if (!targetPlayer) {
      return {
        status: false,
        message: `Pemain dengan nama "${targetName}" tidak ditemukan.`
      };
    }
    
    // Cek apakah target adalah anggota guild
    const targetMemberData = guild.members.find(m => m.playerId.toString() === targetPlayer._id.toString());
    
    if (!targetMemberData) {
      return {
        status: false,
        message: `${targetName} bukan anggota guild Anda.`
      };
    }
    
    // Jika mempromosikan ke leader, maka leader lama menjadi officer
    if (newRank === 'leader') {
      // Ubah rank pemain saat ini menjadi officer
      guild.promoteMembers(player._id, 'officer');
      
      // Update leader guild
      guild.leader = targetPlayer._id;
    }
    
    // Promosikan target
    guild.promoteMembers(targetPlayer._id, newRank);
    
    // Simpan perubahan
    await guild.save();
    
    return {
      status: true,
      message: `${targetName} telah dipromosikan menjadi ${newRank === 'leader' ? 'pemimpin' : 'officer'} guild.`
    };
  } catch (error) {
    logger.error(`Error promoting member: ${error.message}`);
    return {
      status: false,
      message: 'Terjadi kesalahan saat mempromosikan anggota guild.'
    };
  }
};

/**
 * Menyumbang ke guild
 * @param {Object} player - Object pemain
 * @param {String} type - Jenis sumbangan (gmoney/resources)
 * @param {Number} amount - Jumlah sumbangan
 * @returns {Object} - Status dan pesan respons
 */
const donateToGuild = async (player, type, amount) => {
  try {
    // Validasi input
    if (!type || !['gmoney', 'wood', 'stone', 'ore', 'fiber', 'hide'].includes(type.toLowerCase())) {
      return {
        status: false,
        message: 'Jenis sumbangan tidak valid. Gunakan gmoney, wood, stone, ore, fiber, atau hide.'
      };
    }
    
    type = type.toLowerCase();
    amount = parseInt(amount);
    
    if (!amount || isNaN(amount) || amount <= 0) {
      return {
        status: false,
        message: 'Jumlah sumbangan harus berupa angka positif.'
      };
    }
    
    // Periksa apakah pemain memiliki guild
    if (!player.guild) {
      return {
        status: false,
        message: 'Anda belum bergabung dengan guild manapun.'
      };
    }
    
    // Dapatkan data guild
    const guild = await Guild.findById(player.guild);
    
    if (!guild) {
      // Jika guild tidak ditemukan, perbaiki data pemain
      player.guild = null;
      await player.save();
      
      return {
        status: false,
        message: 'Guild tidak ditemukan. Data Anda telah diperbaiki.'
      };
    }
    
    // Cek apakah pemain memiliki sumber daya yang cukup
    if (type === 'gmoney') {
      if (player.gmoney < amount) {
        return {
          status: false,
          message: `Anda tidak memiliki cukup Gmoney. Saldo Anda: ${player.gmoney}`
        };
      }
      
      // Kurangi Gmoney pemain
      player.gmoney -= amount;
      
      // Tambahkan ke treasury guild
      guild.treasury.gmoney += amount;
      
      // Tambahkan kontribusi pemain
      guild.addContribution(player._id, 'gmoney', amount);
    } else {
      // Cek resource pemain
      const resourceItem = player.inventory.find(item => 
        item.type === 'resource' && item.name.toLowerCase() === type
      );
      
      if (!resourceItem || resourceItem.quantity < amount) {
        return {
          status: false,
          message: `Anda tidak memiliki cukup ${type}. Jumlah yang Anda miliki: ${resourceItem ? resourceItem.quantity : 0}`
        };
      }
      
      // Kurangi resource pemain
      resourceItem.quantity -= amount;
      
      // Hapus item jika quantity 0
      if (resourceItem.quantity <= 0) {
        player.inventory = player.inventory.filter(item => 
          !(item.type === 'resource' && item.name.toLowerCase() === type)
        );
      }
      
      // Tambahkan ke treasury guild
      guild.treasury.resources[type] += amount;
      
      // Tambahkan kontribusi pemain
      guild.addContribution(player._id, 'resources', amount);
    }
    
    // Cek apakah level guild naik
    const nextLevelReq = guild.getNextLevelRequirement();
    if (guild.treasury.gmoney >= nextLevelReq && guild.level < 10) {
      guild.level += 1;
    }
    
    // Simpan perubahan
    await guild.save();
    await player.save();
    
    return {
      status: true,
      message: `Anda telah menyumbang ${amount} ${type} ke guild. Terima kasih atas kontribusi Anda!`
    };
  } catch (error) {
    logger.error(`Error donating to guild: ${error.message}`);
    return {
      status: false,
      message: 'Terjadi kesalahan saat menyumbang ke guild.'
    };
  }
};

/**
 * Mendapatkan informasi guild berdasarkan nama
 * @param {String} guildName - Nama guild yang dicari
 * @returns {Object} - Status dan pesan respons
 */
const getGuildInfoByName = async (guildName) => {
  try {
    // Validasi nama guild
    if (!guildName) {
      return {
        status: false,
        message: 'Anda harus menentukan nama guild yang ingin dilihat.'
      };
    }
    
    // Cari guild berdasarkan nama
    const guild = await Guild.findByName(guildName).populate('leader', 'name');
    
    if (!guild) {
      return {
        status: false,
        message: `Guild dengan nama "${guildName}" tidak ditemukan.`
      };
    }
    
    // Format anggota
    const memberCount = guild.members.length;
    const officerCount = guild.members.filter(m => m.rank === 'officer').length;
    
    // Format level dan persyaratan
    const nextLevelReq = guild.getNextLevelRequirement();
    const levelProgress = Math.floor((guild.treasury.gmoney / nextLevelReq) * 100);
    
    // Buat pesan respons
    const message = 
`🏰 *${guild.name} (Level ${guild.level})* 🏰
${guild.description || 'Tidak ada deskripsi.'}

👑 *Pemimpin:* ${guild.leader.name}
👥 *Anggota:* ${memberCount} (${officerCount} Officer)

💰 *Guild Treasury:*
- ${guild.treasury.gmoney} Gmoney

📊 *Progress Level Selanjutnya:* ${levelProgress}% (${guild.treasury.gmoney}/${nextLevelReq})

${guild.territory ? `🗺️ *Wilayah:* ${guild.territory}` : ''}
`;

    return {
      status: true,
      message
    };
  } catch (error) {
    logger.error(`Error getting guild info by name: ${error.message}`);
    return {
      status: false,
      message: 'Terjadi kesalahan saat mendapatkan informasi guild.'
    };
  }
};

module.exports = {
  handleGuild
}; 