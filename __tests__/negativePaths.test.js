jest.mock('mongoose', () => {
  const actualMongoose = jest.requireActual('mongoose');
  return {
    ...actualMongoose,
    startSession: jest.fn()
  };
});

jest.mock('../src/models/Player', () => ({
  findByUserId: jest.fn(),
  findOne: jest.fn(),
  findById: jest.fn()
}));

jest.mock('../src/models/MarketListing', () => {
  const MockMarketListing = jest.fn(function MockMarketListing(data) {
    Object.assign(this, data);
    this.save = jest.fn().mockResolvedValue(this);
  });

  MockMarketListing.findById = jest.fn();
  MockMarketListing.findByIdAndDelete = jest.fn();
  MockMarketListing.find = jest.fn();

  return MockMarketListing;
});

jest.mock('../src/models/Quest', () => ({
  Quest: {
    findActiveByLevel: jest.fn()
  },
  PlayerQuest: jest.fn(function MockPlayerQuest(data) {
    Object.assign(this, data);
    this.save = jest.fn().mockResolvedValue(this);
  })
}));

jest.mock('../src/controllers/notificationController', () => ({
  createNotification: jest.fn().mockResolvedValue(true)
}));

const mongoose = require('mongoose');
const PlayerModel = require('../src/models/Player');
const MarketListing = require('../src/models/MarketListing');
const { PlayerQuest } = require('../src/models/Quest');
const ActualPlayer = jest.requireActual('../src/models/Player');
const Guild = require('../src/models/Guild');
const { sellItem, buyItem, cancelListing } = require('../src/controllers/marketController');
const { claimQuestReward } = require('../src/controllers/questController');
const { handleGuild } = require('../src/controllers/guildController');

const createSessionMock = () => ({
  withTransaction: jest.fn(async (callback) => callback()),
  endSession: jest.fn().mockResolvedValue(undefined)
});

describe('Negative-path tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const session = createSessionMock();
    mongoose.startSession.mockResolvedValue(session);
  });

  // ─── MARKET ───────────────────────────────────────────────

  describe('Market negative paths', () => {
    test('sellItem rejects price below minimum floor', async () => {
      const player = new ActualPlayer({
        userId: 'neg-seller',
        name: 'NegSeller',
        gmoney: 1000,
        inventory: [
          { itemId: 'simple_ore', name: 'Simple Ore', type: 'resource', tier: 2, quantity: 10 }
        ]
      });
      player.save = jest.fn().mockResolvedValue(player);

      PlayerModel.findOne.mockReturnValue({
        session: jest.fn().mockResolvedValue(player)
      });

      // price 1 for 5 tier-2 items → minimum is ceil(2*5) = 10
      const response = await sellItem('neg-seller', 'simple_ore', 1, 5);

      expect(response.status).toBe(false);
      expect(response.message).toContain('Harga terlalu rendah');
    });

    test('sellItem rejects when seller lacks listing fee', async () => {
      const player = new ActualPlayer({
        userId: 'broke-seller',
        name: 'BrokeSeller',
        gmoney: 0,
        inventory: [
          { itemId: 'rough_logs', name: 'Rough Logs', type: 'resource', tier: 1, quantity: 10 }
        ]
      });
      player.save = jest.fn().mockResolvedValue(player);

      PlayerModel.findOne.mockReturnValue({
        session: jest.fn().mockResolvedValue(player)
      });

      const response = await sellItem('broke-seller', 'rough_logs', 100, 5);

      expect(response.status).toBe(false);
      expect(response.message).toContain('biaya listing');
    });

    test('sellItem rejects when item not in inventory', async () => {
      const player = new ActualPlayer({
        userId: 'noitem-seller',
        name: 'NoItemSeller',
        gmoney: 1000,
        inventory: []
      });
      player.save = jest.fn().mockResolvedValue(player);

      PlayerModel.findOne.mockReturnValue({
        session: jest.fn().mockResolvedValue(player)
      });

      const response = await sellItem('noitem-seller', 'nonexistent_item', 50, 1);

      expect(response.status).toBe(false);
      expect(response.message).toContain('tidak ditemukan dalam inventory');
    });

    test('buyItem rejects when buyer has insufficient Gmoney', async () => {
      const buyer = new ActualPlayer({
        userId: 'broke-buyer',
        name: 'BrokeBuyer',
        gmoney: 10,
        inventory: []
      });
      buyer.save = jest.fn().mockResolvedValue(buyer);

      const seller = new ActualPlayer({
        userId: 'rich-seller',
        name: 'RichSeller',
        gmoney: 5000,
        inventory: []
      });

      const listing = {
        _id: 'listing-expensive',
        seller: seller._id,
        itemId: 'diamond_sword',
        name: 'Diamond Sword',
        type: 'weapon',
        tier: 4,
        stats: {},
        quantity: 1,
        price: 5000,
        save: jest.fn()
      };

      PlayerModel.findOne.mockReturnValue({
        session: jest.fn().mockResolvedValue(buyer)
      });
      PlayerModel.findById.mockReturnValue({
        session: jest.fn().mockResolvedValue(seller)
      });
      MarketListing.findById.mockReturnValue({
        session: jest.fn().mockResolvedValue(listing)
      });

      const response = await buyItem('broke-buyer', 'listing-expensive');

      expect(response.status).toBe(false);
      expect(response.message).toContain('tidak cukup');
    });

    test('buyItem rejects self-purchase', async () => {
      const player = new ActualPlayer({
        userId: 'self-buyer',
        name: 'SelfBuyer',
        gmoney: 10000,
        inventory: []
      });
      player.save = jest.fn().mockResolvedValue(player);

      const listing = {
        _id: 'listing-self',
        seller: player._id,
        itemId: 'rough_logs',
        name: 'Rough Logs',
        type: 'resource',
        tier: 1,
        stats: {},
        quantity: 5,
        price: 50,
        save: jest.fn()
      };

      PlayerModel.findOne.mockReturnValue({
        session: jest.fn().mockResolvedValue(player)
      });
      PlayerModel.findById.mockReturnValue({
        session: jest.fn().mockResolvedValue(player)
      });
      MarketListing.findById.mockReturnValue({
        session: jest.fn().mockResolvedValue(listing)
      });

      const response = await buyItem('self-buyer', 'listing-self');

      expect(response.status).toBe(false);
      expect(response.message).toContain('Anda buat sendiri');
    });

    test('cancelListing rejects when listing belongs to another player', async () => {
      const player = new ActualPlayer({
        userId: 'wrong-canceler',
        name: 'WrongCanceler',
        inventory: []
      });
      player.save = jest.fn().mockResolvedValue(player);

      const otherPlayer = new ActualPlayer({
        userId: 'real-owner',
        name: 'RealOwner'
      });

      const listing = {
        _id: 'listing-other',
        seller: otherPlayer._id,
        itemId: 'simple_ore',
        name: 'Simple Ore',
        type: 'resource',
        tier: 2,
        stats: {},
        quantity: 3
      };

      PlayerModel.findOne.mockReturnValue({
        session: jest.fn().mockResolvedValue(player)
      });
      MarketListing.findById.mockReturnValue({
        session: jest.fn().mockResolvedValue(listing)
      });

      const response = await cancelListing('wrong-canceler', 'listing-other');

      expect(response.status).toBe(false);
      expect(response.message).toContain('bukan milik Anda');
    });

    test('cancelListing rejects when listing not found', async () => {
      const player = new ActualPlayer({
        userId: 'cancel-notfound',
        name: 'CancelNotFound',
        inventory: []
      });
      player.save = jest.fn().mockResolvedValue(player);

      PlayerModel.findOne.mockReturnValue({
        session: jest.fn().mockResolvedValue(player)
      });
      MarketListing.findById.mockReturnValue({
        session: jest.fn().mockResolvedValue(null)
      });

      const response = await cancelListing('cancel-notfound', 'nonexistent');

      expect(response.status).toBe(false);
      expect(response.message).toContain('tidak ditemukan');
    });
  });

  // ─── GUILD DONATION ───────────────────────────────────────

  describe('Guild donation negative paths', () => {
    test('rejects donation when player has no guild', async () => {
      const guildId = new mongoose.Types.ObjectId();
      const basePlayer = { _id: 'p1', guild: guildId };

      const freshPlayer = new ActualPlayer({
        userId: 'no-guild',
        name: 'NoGuild',
        gmoney: 1000,
        guild: null
      });
      freshPlayer.save = jest.fn().mockResolvedValue(freshPlayer);

      PlayerModel.findByUserId.mockResolvedValue(basePlayer);
      PlayerModel.findById.mockReturnValue({
        session: jest.fn().mockResolvedValue(freshPlayer)
      });

      const response = await handleGuild('no-guild', ['sumbang', 'gmoney', '100']);

      expect(response.status).toBe(false);
      expect(response.message).toContain('belum bergabung');
    });

    test('rejects gmoney donation when balance insufficient', async () => {
      const guildId = new mongoose.Types.ObjectId();
      const basePlayer = { _id: 'p2', guild: guildId };

      const freshPlayer = new ActualPlayer({
        userId: 'broke-guild',
        name: 'BrokeGuild',
        gmoney: 10,
        guild: guildId
      });
      freshPlayer.save = jest.fn().mockResolvedValue(freshPlayer);

      const guild = new Guild({
        name: 'TestGuild',
        leader: freshPlayer._id,
        members: [{
          playerId: freshPlayer._id,
          rank: 'leader',
          contribution: { gmoney: 0, resources: 0 }
        }]
      });
      guild.save = jest.fn().mockResolvedValue(guild);

      PlayerModel.findByUserId.mockResolvedValue(basePlayer);
      PlayerModel.findById.mockReturnValue({
        session: jest.fn().mockResolvedValue(freshPlayer)
      });
      jest.spyOn(Guild, 'findById').mockReturnValue({
        session: jest.fn().mockResolvedValue(guild)
      });

      const response = await handleGuild('broke-guild', ['sumbang', 'gmoney', '500']);

      expect(response.status).toBe(false);
      expect(response.message).toContain('tidak memiliki cukup Gmoney');
    });

    test('rejects resource donation when insufficient resource', async () => {
      const guildId = new mongoose.Types.ObjectId();
      const basePlayer = { _id: 'p3', guild: guildId };

      const freshPlayer = new ActualPlayer({
        userId: 'no-wood',
        name: 'NoWood',
        gmoney: 1000,
        guild: guildId,
        inventory: []
      });
      freshPlayer.save = jest.fn().mockResolvedValue(freshPlayer);

      const guild = new Guild({
        name: 'WoodGuild',
        leader: freshPlayer._id,
        members: [{
          playerId: freshPlayer._id,
          rank: 'leader',
          contribution: { gmoney: 0, resources: 0 }
        }]
      });
      guild.save = jest.fn().mockResolvedValue(guild);

      PlayerModel.findByUserId.mockResolvedValue(basePlayer);
      PlayerModel.findById.mockReturnValue({
        session: jest.fn().mockResolvedValue(freshPlayer)
      });
      jest.spyOn(Guild, 'findById').mockReturnValue({
        session: jest.fn().mockResolvedValue(guild)
      });

      const response = await handleGuild('no-wood', ['sumbang', 'wood', '50']);

      expect(response.status).toBe(false);
      expect(response.message).toContain('tidak memiliki cukup wood');
    });

    test('rejects invalid donation type', async () => {
      const guildId = new mongoose.Types.ObjectId();
      const basePlayer = { _id: 'p4', guild: guildId };

      const freshPlayer = new ActualPlayer({
        userId: 'bad-type',
        name: 'BadType',
        gmoney: 1000,
        guild: guildId
      });
      freshPlayer.save = jest.fn().mockResolvedValue(freshPlayer);

      PlayerModel.findByUserId.mockResolvedValue(basePlayer);
      PlayerModel.findById.mockReturnValue({
        session: jest.fn().mockResolvedValue(freshPlayer)
      });

      const response = await handleGuild('bad-type', ['sumbang', 'diamond', '100']);

      expect(response.status).toBe(false);
      expect(response.message).toContain('tidak valid');
    });
  });

  // ─── QUEST ────────────────────────────────────────────────

  describe('Quest negative paths', () => {
    test('claimQuestReward rejects when quest is not completed', async () => {
      const player = new ActualPlayer({
        userId: 'not-done',
        name: 'NotDone',
        gmoney: 100
      });

      const playerQuest = {
        quest: {
          _id: 'quest-incomplete',
          title: 'Unfinished Quest',
          rewards: []
        },
        isCompleted: false,
        isRewarded: false,
        save: jest.fn()
      };

      PlayerModel.findByUserId.mockResolvedValue(player);
      PlayerQuest.findOne = jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue(playerQuest)
      });

      const response = await claimQuestReward('not-done', 'quest-incomplete');

      expect(response.status).toBe(false);
      expect(response.message).toContain('belum selesai');
    });

    test('claimQuestReward rejects when already rewarded', async () => {
      const player = new ActualPlayer({
        userId: 'already-claimed',
        name: 'AlreadyClaimed',
        gmoney: 100
      });

      const playerQuest = {
        quest: {
          _id: 'quest-claimed',
          title: 'Claimed Quest',
          rewards: []
        },
        isCompleted: true,
        isRewarded: true,
        save: jest.fn()
      };

      PlayerModel.findByUserId.mockResolvedValue(player);
      PlayerQuest.findOne = jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue(playerQuest)
      });

      const response = await claimQuestReward('already-claimed', 'quest-claimed');

      expect(response.status).toBe(false);
      expect(response.message).toContain('sudah pernah diklaim');
    });

    test('claimQuestReward rejects when quest not found', async () => {
      const player = new ActualPlayer({
        userId: 'quest-missing',
        name: 'QuestMissing',
        gmoney: 100
      });

      PlayerModel.findByUserId.mockResolvedValue(player);
      PlayerQuest.findOne = jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue(null)
      });

      const response = await claimQuestReward('quest-missing', 'nonexistent-quest');

      expect(response.status).toBe(false);
      expect(response.message).toContain('tidak ditemukan');
    });

    test('claimQuestReward rejects when no questId provided', async () => {
      const player = new ActualPlayer({
        userId: 'no-id',
        name: 'NoId',
        gmoney: 100
      });

      PlayerModel.findByUserId.mockResolvedValue(player);

      const response = await claimQuestReward('no-id', null);

      expect(response.status).toBe(false);
      expect(response.message).toContain('ID quest diperlukan');
    });
  });
});
