const logger = require('../utils/logger');
const { registerPlayer } = require('./playerController');
const { getProfile, viewInventory } = require('./profileController');
const { gatherResource } = require('./resourceController');
const { craftItem, viewCraftableItems, viewCraftingInfo } = require('./craftController');
const { equipItem, unequipItem } = require('./equipController');
const { travelToZone, getZoneInfo } = require('./travelController');
const { attack, useHealingItem } = require('./combatController');
const { viewMarket, sellItem, buyItem, cancelListing, viewMarketByCategory } = require('./marketController');
const { handleGuild } = require('./guildController');
const { getHelp } = require('./helpController');
const { sendMessage, viewUnreadMessages, viewChatHistory } = require('./chatController');
const { viewNotifications } = require('./notificationController');
const { viewDungeons, enterDungeon, continueDungeon, exitDungeon } = require('./dungeonController');
const { viewQuests, claimQuestReward } = require('./questController');
const { buyChips, sellChips, playDice, playSlot } = require('./gamblingController');
const reportController = require('./reportController');
const monsterManager = require('../utils/monsterManager');

/**
 * Memproses pesan yang masuk dan mengarahkan ke handler yang sesuai
 * @param {Object} sock - Socket koneksi WhatsApp
 * @param {Object} msg - Pesan yang diterima
 */
const processMessage = async (sock, msg) => {
  try {
    // Ekstrak data penting dari pesan
    const messageContent = msg.message?.conversation || 
                           msg.message?.extendedTextMessage?.text || 
                           '';
    
    // Jika pesan kosong, abaikan
    if (!messageContent) return;
    
    // Ambil jid (id) pengirim pesan
    const senderJid = msg.key.remoteJid;
    const senderId = msg.key.participant || senderJid;
    
    // Log pesan yang diterima
    logger.info(`Message from ${senderId}: ${messageContent}`);
    
    // Periksa apakah pesan merupakan perintah (dimulai dengan !)
    if (messageContent.startsWith('!')) {
      const args = messageContent.slice(1).trim().split(/ +/); // Split argumen berdasarkan spasi
      const command = args.shift().toLowerCase(); // Ambil perintah dan ubah ke lowercase
      
      // Arahkan perintah ke handler yang sesuai
      await handleCommand(sock, senderJid, senderId, command, args);
    }
  } catch (error) {
    logger.error(`Error processing message: ${error.message}`);
  }
};

/**
 * Menangani perintah dan mengarahkan ke controller yang sesuai
 * @param {Object} sock - Socket koneksi WhatsApp
 * @param {String} jid - Jid chat untuk membalas pesan
 * @param {String} senderId - ID pengirim pesan
 * @param {String} command - Perintah yang diterima
 * @param {Array} args - Argumen perintah
 */
const handleCommand = async (sock, jid, senderId, command, args) => {
  try {
    let response = null;
    
    // Match perintah ke handler yang sesuai
    switch (command) {
      case 'daftar':
        response = await registerPlayer(senderId, args);
        break;
      
      case 'profil':
      case 'profile':
        response = await getProfile(senderId);
        break;
      
      case 'inventory':
      case 'inventaris':
        response = await viewInventory(senderId);
        break;
      
      case 'gather':
      case 'kumpul':
        response = await gatherResource(senderId, args[0]);
        break;
      
      case 'craft':
      case 'buat':
        response = await craftItem(senderId, args[0]);
        break;
      
      case 'serang':
      case 'attack':
        response = await attack(senderId, args.join(' '));
        break;
      
      case 'heal':
      case 'sembuh':
        response = await useHealingItem(senderId, args[0]);
        break;
      
      // Handler untuk equip item
      case 'equip':
      case 'pasang':
        response = await equipItem(senderId, args[0]);
        break;
        
      // Handler untuk unequip item
      case 'unequip':
      case 'lepas':
        response = await unequipItem(senderId, args[0]);
        break;

      // Handler untuk travel ke zona lain
      case 'travel':
      case 'pergi':
        response = await travelToZone(senderId, args[0]);
        break;
      
      // Handler untuk melihat informasi zona saat ini
      case 'zone':
      case 'zona':
        response = await getZoneInfo(senderId);
        break;
      
      case 'pasar':
      case 'market':
        // Periksa subcommand untuk pasar
        if (args.length === 0) {
          response = await viewMarket(senderId);
        } else if (args[0] === 'batal' && args[1]) {
          response = await cancelListing(senderId, args[1]);
        } else {
          response = await viewMarketByCategory(senderId, args[0]);
        }
        break;
      
      case 'jual':
      case 'sell':
        if (args.length < 2) {
          response = {
            status: false,
            message: 'Format: !jual [item] [harga] [jumlah(opsional)]'
          };
        } else {
          const itemId = args[0];
          const price = parseInt(args[1]);
          const quantity = args.length > 2 ? parseInt(args[2]) : 1;
          response = await sellItem(senderId, itemId, price, quantity);
        }
        break;
      
      case 'beli':
      case 'buy':
        if (args.length < 1) {
          response = {
            status: false,
            message: 'Format: !beli [id_listing] [jumlah(opsional)]'
          };
        } else {
          const listingId = args[0];
          const quantity = args.length > 1 ? parseInt(args[1]) : null;
          response = await buyItem(senderId, listingId, quantity);
        }
        break;
      
      case 'guild':
      case 'clan':
        response = await handleGuild(senderId, args);
        break;
      
      case 'help':
      case 'bantuan':
        response = await getHelp(args[0]);
        break;
      
      // Chat commands
      case 'kirim':
        if (args.length < 2) {
          response = {
            status: false,
            message: 'Format: !kirim [nama_pemain] [pesan]'
          };
        } else {
          const targetName = args[0];
          const content = args.slice(1).join(' ');
          response = await sendMessage(senderId, targetName, content);
        }
        break;
      
      case 'pesan':
        response = await viewUnreadMessages(senderId);
        break;
      
      case 'baca':
        if (args.length < 1) {
          response = {
            status: false,
            message: 'Format: !baca [nama_pemain]'
          };
        } else {
          const targetName = args[0];
          response = await viewChatHistory(senderId, targetName);
        }
        break;
      
      // Notification commands
      case 'notif':
      case 'notifikasi':
        response = await viewNotifications(senderId);
        break;
      
      // Dungeon commands
      case 'dungeon':
        if (args.length === 0) {
          response = await viewDungeons(senderId);
        } else {
          const subCommand = args.shift().toLowerCase();
          
          switch (subCommand) {
            case 'masuk':
              response = await enterDungeon(senderId, args.join(' '));
              break;
            case 'lanjut':
              response = await continueDungeon(senderId);
              break;
            case 'keluar':
              response = await exitDungeon(senderId);
              break;
            default:
              response = {
                status: false,
                message: 'Perintah dungeon tidak valid. Gunakan !help dungeon untuk melihat daftar perintah dungeon.'
              };
          }
        }
        break;
      
      // Quest commands
      case 'quest':
      case 'misi':
        if (args.length === 0) {
          response = await viewQuests(senderId);
        } else {
          const subCommand = args.shift().toLowerCase();
          
          switch (subCommand) {
            case 'daily':
            case 'harian':
              response = await viewQuests(senderId, 'daily');
              break;
            case 'weekly':
            case 'mingguan':
              response = await viewQuests(senderId, 'weekly');
              break;
            case 'klaim':
            case 'claim':
              response = await claimQuestReward(senderId, args[0]);
              break;
            default:
              response = {
                status: false,
                message: 'Perintah quest tidak valid. Gunakan !help quest untuk melihat daftar perintah quest.'
              };
          }
        }
        break;
      
      case 'lapor':
        if (args.length < 2) {
          logger.warn(`[REPORT_CMD] Format perintah tidak valid | User: ${senderId}`);
          response = {
            status: false,
            message: 'Format: !lapor [nomor_telepon] [alasan]'
          };
        } else {
          const reportedPhoneNumber = args[0];
          const reason = args.slice(1).join(' ');
          logger.info(`[REPORT_CMD] Mencoba melaporkan pemain | Pelapor: ${senderId} | Target: ${reportedPhoneNumber}`);
          response = await reportController.reportPlayer({
            reporterPhoneNumber: senderId,
            reportedPhoneNumber,
            reason,
            category: 'other'
          });
        }
        break;
      
      // Menangani perintah Quest Chain / Storyline
      case 'storyline':
      case 'story':
        logger.info(`[QUESTCHAIN_CMD] Melihat storyline | User: ${senderId}`);
        const { viewAvailableQuestChains } = require('./questChainController');
        response = await viewAvailableQuestChains(senderId);
        break;
      
      case 'startstory':
        if (args.length < 1) {
          logger.warn(`[QUESTCHAIN_CMD] Format perintah tidak valid | User: ${senderId}`);
          response = {
            status: false,
            message: 'Format: !startstory [ID_storyline]'
          };
        } else {
          logger.info(`[QUESTCHAIN_CMD] Memulai storyline | User: ${senderId} | ChainID: ${args[0]}`);
          const { startQuestChain } = require('./questChainController');
          response = await startQuestChain(senderId, args[0]);
        }
        break;
      
      case 'choice':
        if (args.length < 2) {
          logger.warn(`[QUESTCHAIN_CMD] Format perintah tidak valid | User: ${senderId}`);
          response = {
            status: false,
            message: 'Format: !choice [ID_storyline] [pilihan]'
          };
        } else {
          logger.info(`[QUESTCHAIN_CMD] Membuat pilihan storyline | User: ${senderId} | ChainID: ${args[0]}`);
          const { makeQuestChainChoice } = require('./questChainController');
          const chainId = args[0];
          const choice = args.slice(1).join(' ');
          response = await makeQuestChainChoice(senderId, chainId, choice);
        }
        break;
      
      case 'claimstory':
        if (args.length < 1) {
          logger.warn(`[QUESTCHAIN_CMD] Format perintah tidak valid | User: ${senderId}`);
          response = {
            status: false,
            message: 'Format: !claimstory [ID_storyline]'
          };
        } else {
          logger.info(`[QUESTCHAIN_CMD] Mengklaim hadiah storyline | User: ${senderId} | ChainID: ${args[0]}`);
          const { claimQuestChainReward } = require('./questChainController');
          response = await claimQuestChainReward(senderId, args[0]);
        }
        break;
      
      case 'laporanku':
        logger.info(`[REPORT_CMD] Melihat laporan sendiri | User: ${senderId}`);
        response = await reportController.viewMyReports(senderId);
        break;
      
      case 'laporanpending':
        logger.info(`[REPORT_CMD] Melihat laporan pending | User: ${senderId}`);
        response = await reportController.viewPendingReports(senderId);
        break;
      
      case 'tanganilaporon':
        if (args.length < 2) {
          logger.warn(`[REPORT_CMD] Format perintah tidak valid | User: ${senderId}`);
          response = {
            status: false,
            message: 'Format: !tanganilaporon [id_laporan] [resolve/reject/investigate] [komentar_opsional]'
          };
        } else {
          const reportId = args[0];
          const action = args[1].toLowerCase();
          const comment = args.length > 2 ? args.slice(2).join(' ') : '';
          logger.info(`[REPORT_CMD] Mencoba menangani laporan | Admin: ${senderId} | Laporan: ${reportId} | Tindakan: ${action}`);
          response = await reportController.handleReport({
            adminPhoneNumber: senderId,
            reportId,
            action,
            comment
          });
        }
        break;
      
      // Untuk kompatibilitas dengan kedua format perintah
      case 'admin':
        logger.info(`[ADMIN_CMD] Menjalankan perintah admin | User: ${senderId} | ADMIN_NUMBER: ${process.env.ADMIN_NUMBER} | Args: ${args.join(' ')}`);
        const { handleAdminCommand } = require('./adminController');
        if (handleAdminCommand) {
          response = await handleAdminCommand(senderId, args);
        } else {
          logger.warn(`[ADMIN_CMD] Modul admin tidak tersedia | User: ${senderId}`);
          response = {
            status: false,
            message: 'Modul admin tidak tersedia.'
          };
        }
        break;
      
      // Handler untuk judi
      case 'belichip':
      case 'buychip':
        if (args.length < 1) {
          response = {
            status: false,
            message: 'Format: !belichip [jumlah]'
          };
        } else {
          response = await buyChips(senderId, args[0]);
        }
        break;
      
      case 'jualchip':
      case 'sellchip':
        if (args.length < 1) {
          response = {
            status: false,
            message: 'Format: !jualchip [jumlah]'
          };
        } else {
          response = await sellChips(senderId, args[0]);
        }
        break;
      
      case 'dadu':
      case 'dice':
        if (args.length < 2) {
          response = {
            status: false,
            message: 'Format: !dadu [jumlah_chip] [ganjil/genap/1-6]'
          };
        } else {
          response = await playDice(senderId, args[0], args[1]);
        }
        break;
      
      case 'slot':
        if (args.length < 1) {
          response = {
            status: false,
            message: 'Format: !slot [jumlah_chip]'
          };
        } else {
          response = await playSlot(senderId, args[0]);
        }
        break;
      
      case 'craftlist':
        if (args.length === 0) {
          response = await viewCraftableItems(senderId);
        } else {
          response = await viewCraftableItems(senderId, args[0]);
        }
        break;
      
      case 'craftinfo':
        if (args.length < 1) {
          response = {
            status: false,
            message: 'Format: !craftinfo [item_id]'
          };
        } else {
          response = await viewCraftingInfo(senderId, args[0]);
        }
        break;
      
      case 'monsters':
      case 'monster':
        response = {
          status: true,
          message: monsterManager.getMonsterList()
        };
        break;
      
      default:
        response = {
          status: false,
          message: `Perintah tidak dikenal: !${command}. Ketik !help untuk melihat daftar perintah.`
        };
    }
    
    // Kirim respons ke pengguna
    if (response) {
      await sock.sendMessage(jid, { text: response.message });
    }
  } catch (error) {
    logger.error(`[CMD_ERROR] Error saat menangani perintah: ${error.message}`, { 
      command,
      args: JSON.stringify(args),
      user: senderId,
      stack: error.stack
    });
    await sock.sendMessage(jid, { text: 'Maaf, terjadi kesalahan. Silakan coba lagi nanti.' });
  }
};

module.exports = { processMessage }; 