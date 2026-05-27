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
const { Quest, PlayerQuest } = require('../src/models/Quest');
const { createNotification } = require('../src/controllers/notificationController');
const ActualPlayer = jest.requireActual('../src/models/Player');
const Guild = require('../src/models/Guild');
const { buyChips, playDice, playSlot } = require('../src/controllers/gamblingController');
const { sellItem, buyItem, cancelListing } = require('../src/controllers/marketController');
const { claimQuestReward, updateQuestProgress } = require('../src/controllers/questController');
const { handleGuild } = require('../src/controllers/guildController');

const createSessionMock = () => ({
  withTransaction: jest.fn(async (callback) => callback()),
  endSession: jest.fn().mockResolvedValue(undefined)
});

describe('RPG stabilization baseline', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Player model helpers', () => {
    test('addExperience handles multi-level gains correctly', () => {
      const player = new ActualPlayer({
        userId: 'u1',
        name: 'Tester',
        level: 1,
        experience: 0
      });

      const result = player.addExperience(250);

      expect(result.level).toBe(2);
      expect(result.levelsGained).toBe(1);
      expect(result.experience).toBe(150);
      expect(player.level).toBe(2);
      expect(player.stats.maxHealth).toBe(110);
      expect(player.stats.health).toBe(110);
      expect(player.stats.attack).toBe(12);
      expect(player.stats.defense).toBe(6);
    });

    test('consumeResource uses canonical resource aliases across tiered items', () => {
      const player = new ActualPlayer({
        userId: 'u2',
        name: 'Gatherer',
        inventory: [
          { itemId: 'rough_logs', name: 'Rough Logs', type: 'resource', tier: 1, quantity: 3 },
          { itemId: 'simple_logs', name: 'Simple Logs', type: 'resource', tier: 2, quantity: 4 },
          { itemId: 'simple_ore', name: 'Simple Ore', type: 'resource', tier: 2, quantity: 2 }
        ]
      });

      expect(player.getTotalResourceQuantity('wood')).toBe(7);

      const consumed = player.consumeResource('wood', 5);

      expect(consumed).toBe(true);
      expect(player.getTotalResourceQuantity('wood')).toBe(2);
      expect(player.inventory.find(item => item.itemId === 'rough_logs')).toBeUndefined();
      expect(player.inventory.find(item => item.itemId === 'simple_logs').quantity).toBe(2);
      expect(player.getTotalResourceQuantity('ore')).toBe(2);
    });
  });

  describe('Guild model safeguards', () => {
    test('addContribution updates gmoney treasury only for gmoney donations', () => {
      const leaderId = new ActualPlayer({ userId: 'leader-id', name: 'Leader' })._id;
      const memberId = new ActualPlayer({ userId: 'member-id', name: 'Member' })._id;
      const guild = new Guild({
        name: 'Sentinel',
        leader: leaderId,
        members: [
          {
            playerId: memberId,
            rank: 'member',
            contribution: { gmoney: 0, resources: 0 }
          }
        ]
      });

      guild.addContribution(memberId, 'gmoney', 500);
      guild.treasury.resources.wood += 8;
      guild.addContribution(memberId, 'resources', 8);

      expect(guild.treasury.gmoney).toBe(500);
      expect(guild.members[0].contribution.gmoney).toBe(500);
      expect(guild.members[0].contribution.resources).toBe(8);
      expect(guild.treasury.resources.wood).toBe(8);
    });
  });

  describe('Gambling economy safeguards', () => {
    test('buyChips charges the configured premium rate', async () => {
      const save = jest.fn().mockResolvedValue(undefined);
      PlayerModel.findByUserId.mockResolvedValue({
        userId: 'user-chip',
        name: 'ChipBuyer',
        gmoney: 1000,
        chips: 0,
        save
      });

      const response = await buyChips('user-chip', 100);

      expect(response.status).toBe(true);
      expect(response.message).toContain('111 Gmoney');
      expect(response.message).toContain('1.1 Gmoney');
    });

    test('playDice rejects bets above the capped ratio', async () => {
      PlayerModel.findByUserId.mockResolvedValue({
        userId: 'dice-user',
        name: 'DiceUser',
        chips: 1000,
        save: jest.fn()
      });

      const response = await playDice('dice-user', 300, 'ganjil');

      expect(response.status).toBe(false);
      expect(response.message).toContain('Maksimal taruhan sekali main adalah 250 chip');
    });

    test('playSlot rejects bets above the capped ratio', async () => {
      PlayerModel.findByUserId.mockResolvedValue({
        userId: 'slot-user',
        name: 'SlotUser',
        chips: 1000,
        save: jest.fn()
      });

      const response = await playSlot('slot-user', 300);

      expect(response.status).toBe(false);
      expect(response.message).toContain('Maksimal taruhan sekali main adalah 250 chip');
    });
  });

  describe('Marketplace transaction safeguards', () => {
    test('sellItem charges listing fee and removes inventory atomically', async () => {
      const session = createSessionMock();
      mongoose.startSession.mockResolvedValue(session);

      const player = new ActualPlayer({
        userId: 'seller-user',
        name: 'Seller',
        gmoney: 100,
        inventory: [
          { itemId: 'rough_logs', name: 'Rough Logs', type: 'resource', tier: 1, quantity: 10 }
        ]
      });
      player.save = jest.fn().mockResolvedValue(player);

      PlayerModel.findOne.mockReturnValue({
        session: jest.fn().mockResolvedValue(player)
      });

      const response = await sellItem('seller-user', 'rough_logs', 50, 5);

      expect(response.status).toBe(true);
      expect(response.message).toContain('Biaya listing: 1 Gmoney');
      expect(player.gmoney).toBe(99);
      expect(player.getInventoryItem('rough_logs').quantity).toBe(5);
      expect(MarketListing).toHaveBeenCalledWith(expect.objectContaining({
        itemId: 'rough_logs',
        quantity: 5,
        price: 50
      }));
      expect(session.withTransaction).toHaveBeenCalled();
      expect(session.endSession).toHaveBeenCalled();
    });

    test('buyItem transfers item to buyer and taxes seller proceeds', async () => {
      const session = createSessionMock();
      mongoose.startSession.mockResolvedValue(session);

      const buyer = new ActualPlayer({
        userId: 'buyer-user',
        name: 'Buyer',
        gmoney: 1000,
        inventory: []
      });
      buyer.save = jest.fn().mockResolvedValue(buyer);

      const seller = new ActualPlayer({
        userId: 'seller-user',
        name: 'Seller',
        gmoney: 100,
        inventory: []
      });
      seller.save = jest.fn().mockResolvedValue(seller);

      const listing = {
        _id: 'listing-1',
        seller: seller._id,
        itemId: 'simple_ore',
        name: 'Simple Ore',
        type: 'resource',
        tier: 1,
        stats: {},
        quantity: 4,
        price: 200,
        save: jest.fn().mockResolvedValue(true)
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

      const response = await buyItem('buyer-user', 'listing-1', 2);

      expect(response.status).toBe(true);
      expect(response.message).toContain('Pajak pasar: 5 Gmoney');
      expect(buyer.gmoney).toBe(900);
      expect(buyer.getInventoryItem('simple_ore').quantity).toBe(2);
      expect(seller.gmoney).toBe(195);
      expect(listing.quantity).toBe(2);
      expect(listing.price).toBe(100);
      expect(listing.save).toHaveBeenCalled();
      expect(session.endSession).toHaveBeenCalled();
    });

    test('cancelListing restores listed items to seller inventory', async () => {
      const session = createSessionMock();
      mongoose.startSession.mockResolvedValue(session);

      const player = new ActualPlayer({
        userId: 'seller-user',
        name: 'Seller',
        inventory: []
      });
      player.save = jest.fn().mockResolvedValue(player);

      const listing = {
        _id: 'listing-2',
        seller: player._id,
        itemId: 'simple_logs',
        name: 'Simple Logs',
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
      MarketListing.findByIdAndDelete.mockReturnValue({
        session: jest.fn().mockResolvedValue(true)
      });

      const response = await cancelListing('seller-user', 'listing-2');

      expect(response.status).toBe(true);
      expect(player.getInventoryItem('simple_logs').quantity).toBe(3);
      expect(MarketListing.findByIdAndDelete).toHaveBeenCalledWith('listing-2');
      expect(session.endSession).toHaveBeenCalled();
    });
  });

  describe('Quest controller flows', () => {
    test('claimQuestReward grants rewards and marks quest rewarded', async () => {
      const player = new ActualPlayer({
        userId: 'quest-user',
        name: 'Quester',
        level: 1,
        experience: 0,
        gmoney: 100,
        inventory: []
      });
      player.save = jest.fn().mockResolvedValue(player);

      const playerQuest = {
        quest: {
          _id: 'quest-1',
          title: 'Gather Logs',
          rewards: [
            { type: 'experience', quantity: 120, description: 'EXP 120' },
            { type: 'gmoney', quantity: 50, description: 'Gmoney 50' },
            { type: 'item', itemId: 'rough_logs', quantity: 2, description: 'Item: Rough Logs' }
          ]
        },
        isCompleted: true,
        isRewarded: false,
        save: jest.fn().mockResolvedValue(true)
      };

      PlayerModel.findByUserId.mockResolvedValue(player);
      PlayerQuest.findOne = jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue(playerQuest)
      });

      const response = await claimQuestReward('quest-user', 'quest-1');

      expect(response.status).toBe(true);
      expect(response.message).toContain('EXP: 120');
      expect(response.message).toContain('Gmoney: 50');
      expect(response.message).toContain('Rough Logs x2');
      expect(player.level).toBe(2);
      expect(player.gmoney).toBe(150);
      expect(player.getInventoryItem('rough_logs').quantity).toBe(2);
      expect(playerQuest.isRewarded).toBe(true);
      expect(playerQuest.save).toHaveBeenCalled();
      expect(createNotification).toHaveBeenCalled();
    });

    test('updateQuestProgress creates completion notifications when progress updates', async () => {
      const player = new ActualPlayer({
        userId: 'quest-progress-user',
        name: 'Progressor'
      });

      PlayerModel.findByUserId.mockResolvedValue(player);
      PlayerQuest.updateQuestProgress = jest.fn().mockResolvedValue(true);
      PlayerQuest.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue([
          {
            quest: { _id: 'quest-99', title: 'Mine Ore' }
          }
        ])
      });

      const updated = await updateQuestProgress('quest-progress-user', 'gather', 'simple_ore', 1);

      expect(updated).toBe(true);
      expect(PlayerQuest.updateQuestProgress).toHaveBeenCalledWith(player._id, 'gather', 'simple_ore', 1);
      expect(createNotification).toHaveBeenCalledWith(
        player._id,
        'quest',
        'Quest Selesai',
        expect.stringContaining('Mine Ore')
      );
    });
  });

  describe('Guild controller command flow', () => {
    test('handleGuild routes donation command and updates guild/player atomically', async () => {
      const session = createSessionMock();
      mongoose.startSession.mockResolvedValue(session);

      const guildId = new mongoose.Types.ObjectId();
      const basePlayer = { _id: 'player-1', guild: guildId };
      const freshPlayer = new ActualPlayer({
        userId: 'guild-user',
        name: 'Guildie',
        gmoney: 1000,
        guild: guildId
      });
      freshPlayer.save = jest.fn().mockResolvedValue(freshPlayer);

      const guild = new Guild({
        name: 'Sentinel',
        leader: freshPlayer._id,
        members: [
          {
            playerId: freshPlayer._id,
            rank: 'leader',
            contribution: { gmoney: 0, resources: 0 }
          }
        ],
        treasury: {
          gmoney: 0,
          resources: { wood: 0, stone: 0, ore: 0, fiber: 0, hide: 0 }
        }
      });
      guild.save = jest.fn().mockResolvedValue(guild);

      PlayerModel.findByUserId.mockResolvedValue(basePlayer);
      PlayerModel.findById.mockReturnValue({
        session: jest.fn().mockResolvedValue(freshPlayer)
      });
      jest.spyOn(Guild, 'findById').mockReturnValue({
        session: jest.fn().mockResolvedValue(guild)
      });

      const response = await handleGuild('guild-user', ['sumbang', 'gmoney', '200']);

      expect(response.status).toBe(true);
      expect(response.message).toContain('menyumbang 200 gmoney');
      expect(freshPlayer.gmoney).toBe(800);
      expect(guild.treasury.gmoney).toBe(200);
      expect(guild.members[0].contribution.gmoney).toBe(200);
      expect(guild.save).toHaveBeenCalled();
      expect(freshPlayer.save).toHaveBeenCalled();
      expect(session.endSession).toHaveBeenCalled();
    });
  });
});
