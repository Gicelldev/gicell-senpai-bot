const Player = require('../models/Player');
const { Quest, PlayerQuest } = require('../models/Quest');
const { createNotification } = require('./notificationController');
const logger = require('../utils/logger');

const QUEST_TYPE_ALIASES = {
  harian: 'daily',
  daily: 'daily',
  mingguan: 'weekly',
  weekly: 'weekly',
  semua: 'all',
  all: 'all'
};

const applyQuestRewards = async (player, quest) => {
  const rewardSummary = {
    experience: 0,
    gmoney: 0,
    items: []
  };

  for (const reward of quest.rewards) {
    if (reward.type === 'experience') {
      rewardSummary.experience += reward.quantity;
      player.addExperience(reward.quantity);
    } else if (reward.type === 'gmoney') {
      rewardSummary.gmoney += reward.quantity;
      player.gmoney += reward.quantity;
    } else if (reward.type === 'item' && reward.itemId) {
      const itemReward = {
        itemId: reward.itemId,
        name: reward.description.replace(/^Item: /i, '') || reward.itemId,
        type: 'resource',
        quantity: reward.quantity,
        tier: 1,
        stats: {}
      };

      player.addItem(itemReward);
      rewardSummary.items.push(itemReward);
    }
  }

  await player.save();
  return rewardSummary;
};

const ensurePlayerQuest = async (playerId, quest) => {
  let playerQuest = await PlayerQuest.findOne({
    player: playerId,
    quest: quest._id
  });

  if (!playerQuest) {
    playerQuest = new PlayerQuest({
      player: playerId,
      quest: quest._id,
      progress: quest.requirements.map((_, index) => ({
        requirementIndex: index,
        current: 0,
        completed: false
      }))
    });

    await playerQuest.save();
  }

  return playerQuest;
};

const generateNewQuests = async (player) => {
  try {
    const activeQuestRows = await PlayerQuest.find({
      player: player._id,
      isRewarded: false
    }).populate('quest');

    const activeDailyQuestIds = activeQuestRows
      .filter(row => row.quest && row.quest.type === 'daily')
      .map(row => row.quest._id.toString());

    const activeWeeklyQuestIds = activeQuestRows
      .filter(row => row.quest && row.quest.type === 'weekly')
      .map(row => row.quest._id.toString());

    const dailyCandidates = await Quest.findActiveByLevel(player.level, 'daily', 10);
    const weeklyCandidates = await Quest.findActiveByLevel(player.level, 'weekly', 10);

    const dailyToAssign = dailyCandidates
      .filter(quest => !activeDailyQuestIds.includes(quest._id.toString()))
      .slice(0, Math.max(0, 3 - activeDailyQuestIds.length));

    const weeklyToAssign = weeklyCandidates
      .filter(quest => !activeWeeklyQuestIds.includes(quest._id.toString()))
      .slice(0, Math.max(0, 1 - activeWeeklyQuestIds.length));

    const assigned = [...dailyToAssign, ...weeklyToAssign];
    for (const quest of assigned) {
      await ensurePlayerQuest(player._id, quest);
    }

    if (assigned.length > 0) {
      await createNotification(
        player._id,
        'quest',
        'Quest Baru Tersedia',
        `${assigned.length} quest baru telah tersedia. Gunakan !quest untuk melihat daftar quest.`
      );
    }

    return assigned;
  } catch (error) {
    logger.error(`Error generating new quests: ${error.message}`);
    return [];
  }
};

const formatQuestList = (playerQuests, title) => {
  let questList = '';

  for (const playerQuest of playerQuests) {
    const quest = playerQuest.quest;
    if (!quest) {
      continue;
    }

    let progressText = '';
    for (let i = 0; i < quest.requirements.length; i++) {
      const req = quest.requirements[i];
      const progress = playerQuest.progress.find(p => p.requirementIndex === i) || {
        current: 0,
        completed: false
      };

      progressText += `  - ${req.description}: ${progress.current}/${req.quantity} ${progress.completed ? '✅' : '⬜'}\n`;
    }

    let rewardsText = '';
    for (const reward of quest.rewards) {
      rewardsText += `  - ${reward.description}\n`;
    }

    questList += `${quest.title} (${quest.type}) ${playerQuest.isCompleted ? '✅' : '⬜'}\n`;
    questList += `${quest.description}\n`;
    questList += `ID: ${quest._id}\n`;
    questList += `Progress:\n${progressText}`;
    questList += `Hadiah:\n${rewardsText}`;

    if (playerQuest.isCompleted && !playerQuest.isRewarded) {
      questList += `Quest telah selesai! Gunakan !quest klaim ${quest._id} untuk mengklaim hadiah.\n`;
    } else if (playerQuest.isRewarded) {
      questList += 'Hadiah telah diklaim.\n';
    }

    questList += '\n';
  }

  return {
    status: true,
    message: `📜 QUEST ${title.toUpperCase()} 📜\n\n${questList || 'Tidak ada quest aktif saat ini.'}`
  };
};

const viewQuests = async (userId, type = 'all') => {
  try {
    const player = await Player.findByUserId(userId);

    if (!player) {
      return {
        status: false,
        message: 'Anda belum terdaftar sebagai pemain. Gunakan !daftar [nama] untuk mendaftar.'
      };
    }

    player.lastActivity = Date.now();
    await player.save();

    const normalizedType = QUEST_TYPE_ALIASES[type] || 'all';

    let playerQuests = await PlayerQuest.find({
      player: player._id,
      isRewarded: false
    })
      .populate('quest')
      .sort({ startedAt: -1 });

    playerQuests = playerQuests.filter(row => row.quest && row.quest.isActive);

    if (playerQuests.length === 0) {
      const generated = await generateNewQuests(player);
      if (generated.length === 0) {
        return {
          status: true,
          message: '📜 QUEST 📜\n\nBelum ada quest yang tersedia untuk level Anda saat ini.'
        };
      }

      playerQuests = await PlayerQuest.find({
        player: player._id,
        isRewarded: false
      })
        .populate('quest')
        .sort({ startedAt: -1 });
    }

    const filteredQuests = normalizedType === 'all'
      ? playerQuests
      : playerQuests.filter(row => row.quest && row.quest.type === normalizedType);

    if (filteredQuests.length === 0) {
      return {
        status: true,
        message: `📜 QUEST ${normalizedType.toUpperCase()} 📜\n\nAnda tidak memiliki quest ${normalizedType} yang aktif saat ini.`
      };
    }

    return formatQuestList(filteredQuests, normalizedType);
  } catch (error) {
    logger.error(`Error viewing quests: ${error.message}`);
    return {
      status: false,
      message: `Terjadi kesalahan saat melihat quest: ${error.message}`
    };
  }
};

const claimQuestReward = async (userId, questId) => {
  try {
    if (!questId) {
      return {
        status: false,
        message: 'ID quest diperlukan. Contoh: !quest klaim [id_quest]'
      };
    }

    const player = await Player.findByUserId(userId);
    if (!player) {
      return {
        status: false,
        message: 'Anda belum terdaftar sebagai pemain. Gunakan !daftar [nama] untuk mendaftar.'
      };
    }

    const playerQuest = await PlayerQuest.findOne({
      player: player._id,
      quest: questId
    }).populate('quest');

    if (!playerQuest || !playerQuest.quest) {
      return {
        status: false,
        message: 'Quest tidak ditemukan.'
      };
    }

    if (!playerQuest.isCompleted) {
      return {
        status: false,
        message: 'Quest ini belum selesai.'
      };
    }

    if (playerQuest.isRewarded) {
      return {
        status: false,
        message: 'Hadiah quest ini sudah pernah diklaim.'
      };
    }

    const rewardSummary = await applyQuestRewards(player, playerQuest.quest);
    playerQuest.isRewarded = true;
    await playerQuest.save();

    const rewardLines = [];
    if (rewardSummary.experience > 0) {
      rewardLines.push(`✨ EXP: ${rewardSummary.experience}`);
    }
    if (rewardSummary.gmoney > 0) {
      rewardLines.push(`💵 Gmoney: ${rewardSummary.gmoney}`);
    }
    if (rewardSummary.items.length > 0) {
      rewardSummary.items.forEach(item => {
        rewardLines.push(`📦 ${item.name} x${item.quantity}`);
      });
    }

    await createNotification(
      player._id,
      'quest',
      'Hadiah Quest Diklaim',
      `Anda telah mengklaim hadiah dari quest "${playerQuest.quest.title}".`
    );

    return {
      status: true,
      message: `💰 QUEST REWARD 💰\n\nQuest *${playerQuest.quest.title}* telah diklaim.\n\n${rewardLines.join('\n') || 'Tidak ada hadiah.'}`
    };
  } catch (error) {
    logger.error(`Error claiming quest reward: ${error.message}`);
    return {
      status: false,
      message: 'Terjadi kesalahan saat mengklaim reward quest.'
    };
  }
};

const updateQuestProgress = async (userId, type, target, quantity = 1) => {
  try {
    const player = await Player.findByUserId(userId);
    if (!player) {
      return false;
    }

    const updated = await PlayerQuest.updateQuestProgress(player._id, type, target, quantity);

    if (updated) {
      const completedQuests = await PlayerQuest.find({
        player: player._id,
        isCompleted: true,
        isRewarded: false
      }).populate('quest');

      for (const questRow of completedQuests) {
        if (!questRow.quest) {
          continue;
        }

        await createNotification(
          player._id,
          'quest',
          'Quest Selesai',
          `Quest "${questRow.quest.title}" telah selesai. Klaim hadiahmu dengan !quest klaim ${questRow.quest._id}`
        );
      }
    }

    return updated;
  } catch (error) {
    logger.error(`Error updating quest progress: ${error.message}`);
    return false;
  }
};

module.exports = {
  viewQuests,
  claimQuestReward,
  updateQuestProgress,
  generateNewQuests
};