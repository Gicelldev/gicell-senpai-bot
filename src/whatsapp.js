const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const logger = require('./utils/logger');
const { processMessage } = require('./controllers/messageHandler');

// Pastikan direktori session ada
const sessionPath = './session';
if (!fs.existsSync(sessionPath)) {
  fs.mkdirSync(sessionPath, { recursive: true });
}

let sock = null;

const connectToWhatsApp = async () => {
  // Gunakan auth state dari file
  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
  
  // Membuat koneksi WhatsApp
  sock = makeWASocket({
    printQRInTerminal: true,
    auth: state,
    logger: logger,
    browser: ['Gicell Senpai Bot', 'Chrome', '1.0.0'],
  });
  
  // Menyimpan session credentials ketika update
  sock.ev.on('creds.update', saveCreds);
  
  // Handle koneksi berubah
  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;
    
    // Jika ada QR code, tampilkan untuk di-scan
    if (qr) {
      qrcode.generate(qr, { small: true });
      logger.info('QR Code generated. Scan to connect.');
    }
    
    // Jika koneksi close, coba reconnect
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      
      if (shouldReconnect) {
        logger.warn('Connection closed. Reconnecting...');
        connectToWhatsApp();
      } else {
        logger.error('Connection closed. You are logged out.');
      }
    }
    
    // Jika koneksi sudah terbuka
    if (connection === 'open') {
      logger.info('WhatsApp connection opened!');
    }
  });
  
  // Handle pesan masuk
  sock.ev.on('messages.upsert', async (m) => {
    if (m.type === 'notify') {
      for (const msg of m.messages) {
        if (!msg.key.fromMe) {
          // Proses pesan dengan message handler
          await processMessage(sock, msg);
        }
      }
    }
  });
  
  return sock;
};

// Fungsi untuk mengirim pesan
const sendMessage = async (jid, content, options = {}) => {
  try {
    if (!sock) {
      throw new Error('WhatsApp connection not initialized');
    }
    
    await sock.sendMessage(jid, content, options);
    logger.info(`Message sent to ${jid}`);
    return true;
  } catch (error) {
    logger.error(`Error sending message: ${error.message}`);
    return false;
  }
};

module.exports = {
  connectToWhatsApp,
  sendMessage,
}; 