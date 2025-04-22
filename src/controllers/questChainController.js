const Player = require('../models/Player');
const { Quest, PlayerQuest } = require('../models/Quest');
const { QuestChain, PlayerQuestChain } = require('../models/QuestChain');
const { createNotification } = require('./notificationController');
const logger = require('../utils/logger');

/**
 * Mendapatkan daftar quest chain yang tersedia untuk pemain
 * @param {String} userId - ID pengguna WhatsApp
 * @returns {Object} - Status dan pesan respons
 */
const viewAvailableQuestChains = async (userId) => {
  try {
    // Cari pemain dalam database
    const player = await Player.findByUserId(userId)
      .populate('questChains.questChain');
    
    if (!player) {
      return {
        status: false,
        message: 'Anda belum terdaftar sebagai pemain. Gunakan !daftar [nama] untuk mendaftar.'
      };
    }
    
    // Update lastActivity
    player.lastActivity = Date.now();
    await player.save();
    
    // Dapatkan quest chain yang tersedia untuk pemain
    const availableChains = await QuestChain.findAvailableForPlayer(player);
    
    // Dapatkan quest chain yang sudah aktif
    const activeChains = await PlayerQuestChain.findActiveForPlayer(player._id);
    
    if (availableChains.length === 0 && activeChains.length === 0) {
      return {
        status: true,
        message: '📖 QUEST STORYLINE 📖\n\nTidak ada storyline quest yang tersedia untuk level Anda saat ini. Tingkatkan level Anda atau selesaikan quest lainnya terlebih dahulu.'
      };
    }
    
    // Buat pesan respons
    let message = '📖 QUEST STORYLINE 📖\n\n';
    
    // Tampilkan quest chain yang aktif
    if (activeChains.length > 0) {
      message += '*STORYLINE AKTIF:*\n\n';
      
      for (const activeChain of activeChains) {
        const questChain = activeChain.questChain;
        const currentStep = activeChain.currentStep;
        const totalSteps = questChain.steps.length;
        
        message += `${questChain.title} (Langkah ${currentStep}/${totalSteps})\n`;
        message += `Level yang direkomendasikan: ${questChain.recommendedLevel}\n`;
        message += `${questChain.description}\n\n`;
        
        if (activeChain.currentQuest) {
          message += `Quest saat ini: ${activeChain.currentQuest.title}\n`;
          message += `Gunakan !quest untuk melihat detail quest.\n\n`;
        }
      }
    }
    
    // Tampilkan quest chain yang tersedia
    if (availableChains.length > 0) {
      message += '*STORYLINE TERSEDIA:*\n\n';
      
      for (const chain of availableChains) {
        message += `${chain.title} (${chain.category})\n`;
        message += `Level yang direkomendasikan: ${chain.recommendedLevel}\n`;
        message += `${chain.description}\n`;
        message += `ID: ${chain.chainId}\n\n`;
      }
      
      message += 'Untuk memulai storyline, gunakan perintah !startstory [ID]';
    }
    
    return {
      status: true,
      message
    };
  } catch (error) {
    logger.error(`Error viewing available quest chains: ${error.message}`);
    return {
      status: false,
      message: `Terjadi kesalahan saat melihat storyline quest: ${error.message}`
    };
  }
};

/**
 * Memulai quest chain baru
 * @param {String} userId - ID pengguna WhatsApp
 * @param {String} chainId - ID quest chain
 * @returns {Object} - Status dan pesan respons
 */
const startQuestChain = async (userId, chainId) => {
  try {
    // Cari pemain dalam database
    const player = await Player.findByUserId(userId);
    
    if (!player) {
      return {
        status: false,
        message: 'Anda belum terdaftar sebagai pemain. Gunakan !daftar [nama] untuk mendaftar.'
      };
    }
    
    // Cari quest chain
    const questChain = await QuestChain.findOne({ chainId })
      .populate('steps.quest prerequisites.chains prerequisites.quests');
    
    if (!questChain) {
      return {
        status: false,
        message: 'Storyline quest tidak ditemukan. Periksa kembali ID storyline.'
      };
    }
    
    // Cek apakah pemain sudah memulai quest chain ini
    const existingChain = await PlayerQuestChain.findOne({
      player: player._id,
      questChain: questChain._id,
      status: { $in: ['active', 'on_hold'] }
    });
    
    if (existingChain) {
      return {
        status: false,
        message: 'Anda sudah memulai storyline quest ini. Gunakan !storyline untuk melihat progress Anda.'
      };
    }
    
    // Cek prasyarat
    if (player.level < questChain.prerequisites.level) {
      return {
        status: false,
        message: `Level Anda (${player.level}) tidak mencukupi untuk memulai storyline ini. Level minimum: ${questChain.prerequisites.level}`
      };
    }
    
    if (questChain.prerequisites.skills && questChain.prerequisites.skills.length > 0) {
      for (const skillReq of questChain.prerequisites.skills) {
        const playerSkill = player.skills ? player.skills.find(s => s.name === skillReq.skill) : null;
        if (!playerSkill || playerSkill.level < skillReq.level) {
          return {
            status: false,
            message: `Anda membutuhkan skill ${skillReq.skill} level ${skillReq.level} untuk memulai storyline ini.`
          };
        }
      }
    }
    
    if (questChain.prerequisites.chains && questChain.prerequisites.chains.length > 0) {
      for (const prereqChain of questChain.prerequisites.chains) {
        const completed = player.questChains.some(
          pqc => pqc.questChain.equals(prereqChain._id) && pqc.status === 'completed'
        );
        if (!completed) {
          return {
            status: false,
            message: `Anda harus menyelesaikan storyline "${prereqChain.title}" terlebih dahulu.`
          };
        }
      }
    }
    
    if (questChain.prerequisites.quests && questChain.prerequisites.quests.length > 0) {
      for (const prereqQuest of questChain.prerequisites.quests) {
        const completed = player.quests.some(
          pq => pq.quest.equals(prereqQuest._id) && pq.isCompleted
        );
        if (!completed) {
          return {
            status: false,
            message: `Anda harus menyelesaikan quest "${prereqQuest.title}" terlebih dahulu.`
          };
        }
      }
    }
    
    // Dapatkan quest pertama dalam chain
    const firstStep = questChain.steps.find(s => s.step === 1);
    if (!firstStep) {
      return {
        status: false,
        message: 'Terjadi kesalahan: Storyline tidak memiliki langkah pertama.'
      };
    }
    
    // Buat progress quest chain baru
    const playerQuestChain = new PlayerQuestChain({
      player: player._id,
      questChain: questChain._id,
      currentStep: 1,
      currentQuest: firstStep.quest._id,
      status: 'active'
    });
    
    await playerQuestChain.save();
    
    // Tambahkan quest pertama ke daftar quest pemain jika belum ada
    let playerQuest = await PlayerQuest.findOne({
      player: player._id,
      quest: firstStep.quest._id
    });
    
    if (!playerQuest) {
      playerQuest = new PlayerQuest({
        player: player._id,
        quest: firstStep.quest._id,
        progress: []
      });
      
      // Inisialisasi progress untuk setiap requirement
      firstStep.quest.requirements.forEach((_, index) => {
        playerQuest.progress.push({
          requirementIndex: index,
          current: 0,
          completed: false
        });
      });
      
      await playerQuest.save();
    }
    
    // Buat notifikasi
    createNotification(
      player._id,
      'quest',
      'Storyline Baru Dimulai',
      `Anda telah memulai storyline quest "${questChain.title}".`
    );
    
    return {
      status: true,
      message: `📖 STORYLINE DIMULAI 📖\n\n` +
        `Anda telah memulai storyline quest "${questChain.title}".\n\n` +
        `${questChain.description}\n\n` +
        `Quest pertama: ${firstStep.quest.title}\n` +
        `Gunakan !quest untuk melihat detail quest.`
    };
  } catch (error) {
    logger.error(`Error starting quest chain: ${error.message}`);
    return {
      status: false,
      message: `Terjadi kesalahan saat memulai storyline quest: ${error.message}`
    };
  }
};

/**
 * Update progress quest chain ketika quest selesai
 * @param {String} userId - ID pengguna WhatsApp
 * @param {String} questId - ID quest yang selesai
 * @returns {Object} - Status dan informasi langkah berikutnya
 */
const updateQuestChainProgress = async (userId, questId) => {
  try {
    // Cari pemain dalam database
    const player = await Player.findByUserId(userId);
    
    if (!player) {
      return { status: false };
    }
    
    // Cari quest chain yang mengandung quest ini
    const playerQuestChain = await PlayerQuestChain.findOne({
      player: player._id,
      currentQuest: questId,
      status: 'active'
    }).populate({
      path: 'questChain',
      populate: { path: 'steps.quest' }
    });
    
    if (!playerQuestChain) {
      return { status: false };
    }
    
    // Cek jika quest chain memiliki percabangan pada langkah ini
    const questChain = playerQuestChain.questChain;
    const branch = questChain.branches.find(b => b.stepAfter === playerQuestChain.currentStep);
    
    // Jika ada percabangan, kita perlu meminta pemain untuk memilih
    if (branch) {
      return {
        status: true,
        requiresChoice: true,
        branch,
        chainId: questChain.chainId
      };
    }
    
    // Jika tidak ada percabangan, langsung lanjut ke langkah berikutnya
    await playerQuestChain.advanceToNextStep();
    
    // Cek apakah quest chain selesai
    if (playerQuestChain.status === 'completed') {
      createNotification(
        player._id,
        'quest',
        'Storyline Selesai',
        `Anda telah menyelesaikan storyline quest "${questChain.title}". Gunakan !claimstory ${questChain.chainId} untuk mengklaim hadiah.`
      );
      
      return {
        status: true,
        completed: true,
        chainId: questChain.chainId,
        chainTitle: questChain.title
      };
    }
    
    // Jika belum selesai, dapatkan quest berikutnya
    const nextQuest = await Quest.findById(playerQuestChain.currentQuest);
    
    if (!nextQuest) {
      return { status: false };
    }
    
    // Tambahkan quest berikutnya ke daftar quest pemain jika belum ada
    let playerQuest = await PlayerQuest.findOne({
      player: player._id,
      quest: nextQuest._id
    });
    
    if (!playerQuest) {
      playerQuest = new PlayerQuest({
        player: player._id,
        quest: nextQuest._id,
        progress: []
      });
      
      // Inisialisasi progress untuk setiap requirement
      nextQuest.requirements.forEach((_, index) => {
        playerQuest.progress.push({
          requirementIndex: index,
          current: 0,
          completed: false
        });
      });
      
      await playerQuest.save();
    }
    
    createNotification(
      player._id,
      'quest',
      'Storyline Update',
      `Langkah berikutnya dalam storyline "${questChain.title}" telah tersedia.`
    );
    
    return {
      status: true,
      completed: false,
      nextQuest,
      currentStep: playerQuestChain.currentStep,
      totalSteps: questChain.steps.length
    };
  } catch (error) {
    logger.error(`Error updating quest chain progress: ${error.message}`);
    return { status: false };
  }
};

/**
 * Membuat pilihan pada quest chain yang bercabang
 * @param {String} userId - ID pengguna WhatsApp
 * @param {String} chainId - ID quest chain
 * @param {String} choice - Pilihan yang dibuat
 * @returns {Object} - Status dan pesan respons
 */
const makeQuestChainChoice = async (userId, chainId, choice) => {
  try {
    // Cari pemain dalam database
    const player = await Player.findByUserId(userId);
    
    if (!player) {
      return {
        status: false,
        message: 'Anda belum terdaftar sebagai pemain. Gunakan !daftar [nama] untuk mendaftar.'
      };
    }
    
    // Cari quest chain
    const questChain = await QuestChain.findOne({ chainId });
    
    if (!questChain) {
      return {
        status: false,
        message: 'Storyline quest tidak ditemukan. Periksa kembali ID storyline.'
      };
    }
    
    // Cari progress quest chain pemain
    const playerQuestChain = await PlayerQuestChain.findOne({
      player: player._id,
      questChain: questChain._id,
      status: 'active'
    });
    
    if (!playerQuestChain) {
      return {
        status: false,
        message: 'Anda tidak memiliki storyline aktif dengan ID ini.'
      };
    }
    
    // Cari branch yang sesuai dengan langkah saat ini
    const branch = questChain.branches.find(b => b.stepAfter === playerQuestChain.currentStep);
    
    if (!branch) {
      return {
        status: false,
        message: 'Tidak ada percabangan yang perlu dipilih pada langkah ini.'
      };
    }
    
    // Cek apakah pilihan valid
    const branchChoice = branch.branches.find(b => b.choice.toLowerCase() === choice.toLowerCase());
    
    if (!branchChoice) {
      // Buat daftar pilihan yang valid
      const validChoices = branch.branches.map(b => b.choice).join(', ');
      
      return {
        status: false,
        message: `Pilihan tidak valid. Pilihan yang tersedia: ${validChoices}`
      };
    }
    
    // Lanjutkan ke langkah berikutnya berdasarkan pilihan
    await playerQuestChain.advanceToNextStep(branchChoice.choice);
    
    // Cek apakah quest chain selesai
    if (playerQuestChain.status === 'completed') {
      createNotification(
        player._id,
        'quest',
        'Storyline Selesai',
        `Anda telah menyelesaikan storyline quest "${questChain.title}". Gunakan !claimstory ${questChain.chainId} untuk mengklaim hadiah.`
      );
      
      return {
        status: true,
        message: `📖 STORYLINE SELESAI 📖\n\n` +
          `Anda telah menyelesaikan storyline quest "${questChain.title}" dengan pilihan "${branchChoice.choice}".\n\n` +
          `Gunakan !claimstory ${questChain.chainId} untuk mengklaim hadiah.`
      };
    }
    
    // Jika belum selesai, dapatkan quest berikutnya
    const nextQuest = await Quest.findById(playerQuestChain.currentQuest);
    
    if (!nextQuest) {
      return {
        status: false,
        message: 'Terjadi kesalahan saat mengambil quest berikutnya.'
      };
    }
    
    // Tambahkan quest berikutnya ke daftar quest pemain jika belum ada
    let playerQuest = await PlayerQuest.findOne({
      player: player._id,
      quest: nextQuest._id
    });
    
    if (!playerQuest) {
      playerQuest = new PlayerQuest({
        player: player._id,
        quest: nextQuest._id,
        progress: []
      });
      
      // Inisialisasi progress untuk setiap requirement
      nextQuest.requirements.forEach((_, index) => {
        playerQuest.progress.push({
          requirementIndex: index,
          current: 0,
          completed: false
        });
      });
      
      await playerQuest.save();
    }
    
    return {
      status: true,
      message: `📖 PILIHAN DIBUAT 📖\n\n` +
        `Anda telah memilih "${branchChoice.choice}" dalam storyline "${questChain.title}".\n\n` +
        `Quest berikutnya: ${nextQuest.title}\n` +
        `Langkah ${playerQuestChain.currentStep}/${questChain.steps.length}\n\n` +
        `Gunakan !quest untuk melihat detail quest.`
    };
  } catch (error) {
    logger.error(`Error making quest chain choice: ${error.message}`);
    return {
      status: false,
      message: `Terjadi kesalahan saat membuat pilihan: ${error.message}`
    };
  }
};

/**
 * Mengklaim hadiah quest chain yang sudah selesai
 * @param {String} userId - ID pengguna WhatsApp
 * @param {String} chainId - ID quest chain
 * @returns {Object} - Status dan pesan respons
 */
const claimQuestChainReward = async (userId, chainId) => {
  try {
    // Cari pemain dalam database
    const player = await Player.findByUserId(userId);
    
    if (!player) {
      return {
        status: false,
        message: 'Anda belum terdaftar sebagai pemain. Gunakan !daftar [nama] untuk mendaftar.'
      };
    }
    
    // Cari quest chain
    const questChain = await QuestChain.findOne({ chainId });
    
    if (!questChain) {
      return {
        status: false,
        message: 'Storyline quest tidak ditemukan. Periksa kembali ID storyline.'
      };
    }
    
    // Cari progress quest chain pemain
    const playerQuestChain = await PlayerQuestChain.findOne({
      player: player._id,
      questChain: questChain._id,
      status: 'completed',
      isRewarded: false
    });
    
    if (!playerQuestChain) {
      return {
        status: false,
        message: 'Anda tidak memiliki storyline yang sudah selesai dan belum diklaim dengan ID ini.'
      };
    }
    
    // Berikan reward
    const rewards = await playerQuestChain.giveReward(player);
    
    // Buat pesan hadiah
    let rewardMessage = '';
    
    if (rewards.experience) {
      rewardMessage += `- ${rewards.experience} Experience\n`;
    }
    
    if (rewards.gmoney) {
      rewardMessage += `- ${rewards.gmoney} Gmoney\n`;
    }
    
    if (rewards.items && rewards.items.length > 0) {
      rewardMessage += '- Items:\n';
      for (const item of rewards.items) {
        rewardMessage += `  • ${item.name} x${item.quantity}\n`;
      }
    }
    
    if (rewards.unlocks && rewards.unlocks.length > 0) {
      rewardMessage += '- Unlocks:\n';
      for (const unlock of rewards.unlocks) {
        switch (unlock.type) {
          case 'zone':
            rewardMessage += `  • Zona baru: ${unlock.value}\n`;
            break;
          case 'quest':
            rewardMessage += `  • Quest baru tersedia\n`;
            break;
          case 'feature':
            rewardMessage += `  • Fitur baru: ${unlock.value}\n`;
            break;
          case 'title':
            rewardMessage += `  • Title baru: ${unlock.value}\n`;
            break;
        }
      }
    }
    
    return {
      status: true,
      message: `📖 STORYLINE REWARD 📖\n\n` +
        `Anda telah mengklaim hadiah untuk storyline "${questChain.title}".\n\n` +
        `Hadiah yang diterima:\n` +
        `${rewardMessage}`
    };
  } catch (error) {
    logger.error(`Error claiming quest chain reward: ${error.message}`);
    return {
      status: false,
      message: `Terjadi kesalahan saat mengklaim hadiah storyline: ${error.message}`
    };
  }
};

/**
 * Menangani komando quest chain
 * @param {Object} msg - Objek pesan dari WhatsApp
 * @param {String} sender - ID pengirim pesan
 * @returns {Promise<String>} - Pesan balasan
 */
const handleQuestChainCommand = async (msg, sender) => {
  const message = msg.body.trim().toLowerCase();
  
  if (message === '!storyline' || message === '!story') {
    // Tampilkan daftar quest chain
    const response = await viewAvailableQuestChains(sender);
    return response.message;
  } else if (message.startsWith('!startstory ')) {
    // Mulai quest chain baru
    const chainId = message.split(' ')[1];
    const response = await startQuestChain(sender, chainId);
    return response.message;
  } else if (message.startsWith('!choice ')) {
    // Format perintah: !choice [chainId] [choice]
    const parts = message.split(' ');
    if (parts.length < 3) {
      return 'Format yang benar: !choice [ID storyline] [pilihan]';
    }
    
    const chainId = parts[1];
    const choice = parts.slice(2).join(' ');
    
    const response = await makeQuestChainChoice(sender, chainId, choice);
    return response.message;
  } else if (message.startsWith('!claimstory ')) {
    // Klaim hadiah quest chain
    const chainId = message.split(' ')[1];
    const response = await claimQuestChainReward(sender, chainId);
    return response.message;
  }
  
  return null;
};

module.exports = {
  viewAvailableQuestChains,
  startQuestChain,
  updateQuestChainProgress,
  makeQuestChainChoice,
  claimQuestChainReward,
  handleQuestChainCommand
}; 