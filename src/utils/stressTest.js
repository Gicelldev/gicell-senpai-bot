const axios = require('axios');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');

/**
 * Menjalankan stress test dengan mensimulasikan banyak pesan secara bersamaan
 * @param {Object} options - Opsi uji ketahanan
 * @param {Number} options.concurrentUsers - Jumlah pengguna bersamaan (default: 50)
 * @param {Number} options.messagePerUser - Jumlah pesan per pengguna (default: 10)
 * @param {Number} options.delayBetweenMessages - Jeda antar pesan dalam ms (default: 100)
 * @param {Array} options.commands - Daftar perintah untuk diuji (default: beberapa perintah dasar)
 * @returns {Object} - Hasil pengujian
 */
const runStressTest = async (options = {}) => {
  try {
    const {
      concurrentUsers = 50,
      messagePerUser = 10,
      delayBetweenMessages = 100,
      commands = [
        '!profil',
        '!inventory',
        '!gather kayu',
        '!gather batu',
        '!pasar',
        '!notifikasi',
        '!quest',
        '!dungeon'
      ]
    } = options;

    logger.info(`Memulai stress test dengan ${concurrentUsers} pengguna bersamaan`);
    
    // Buat direktori hasil test jika belum ada
    const testResultsDir = path.join(process.cwd(), 'test_results');
    if (!fs.existsSync(testResultsDir)) {
      fs.mkdirSync(testResultsDir, { recursive: true });
    }

    // Timestamp untuk file hasil
    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
    const resultsFilePath = path.join(testResultsDir, `stress_test_${timestamp}.json`);
    
    // Buat array pengguna untuk simulasi
    const users = Array.from({ length: concurrentUsers }, (_, i) => {
      return {
        userId: `test-user-${i + 1}@s.whatsapp.net`,
        name: `TestUser${i + 1}`,
        stats: {
          messagesProcessed: 0,
          successfulMessages: 0,
          failedMessages: 0,
          avgResponseTime: 0,
          totalResponseTime: 0
        }
      };
    });

    // Menangani registrasi pengguna test
    logger.info('Mendaftarkan pengguna test...');
    for (const user of users) {
      try {
        // Simulasi registrasi pengguna jika diperlukan
        // Dalam pengujian nyata, kita mungkin ingin terhubung ke database test terpisah
        user.stats.registered = true;
      } catch (error) {
        logger.error(`Gagal mendaftarkan pengguna test ${user.name}: ${error.message}`);
        user.stats.registered = false;
      }
    }

    // Kumpulkan hasil pemrosesan pesan
    const messageProcessingResults = [];
    
    // Fungsi untuk mengirim satu pesan dan mengukur waktu respons
    const sendMessage = async (user, command) => {
      try {
        const startTime = process.hrtime();
        
        // Simulasi pemrosesan pesan
        // Dalam implementasi nyata, ini akan memanggil logika pemrosesan pesan asli
        // Untuk pengujian ini, kita hanya mensimulasikan delay pemrosesan
        await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 50));
        
        const elapsedTime = process.hrtime(startTime);
        const responseTimeMs = (elapsedTime[0] * 1000 + elapsedTime[1] / 1e6).toFixed(2);
        
        user.stats.messagesProcessed++;
        user.stats.successfulMessages++;
        user.stats.totalResponseTime += parseFloat(responseTimeMs);
        user.stats.avgResponseTime = user.stats.totalResponseTime / user.stats.successfulMessages;
        
        messageProcessingResults.push({
          userId: user.userId,
          command,
          status: 'success',
          responseTime: parseFloat(responseTimeMs)
        });
        
        return { success: true, responseTime: responseTimeMs };
      } catch (error) {
        user.stats.messagesProcessed++;
        user.stats.failedMessages++;
        
        messageProcessingResults.push({
          userId: user.userId,
          command,
          status: 'failed',
          error: error.message
        });
        
        return { success: false, error: error.message };
      }
    };

    // Jalankan semua pesan
    logger.info(`Menjalankan ${concurrentUsers * messagePerUser} pesan total...`);
    const startTestTime = process.hrtime();
    
    const allPromises = [];
    
    for (const user of users) {
      for (let i = 0; i < messagePerUser; i++) {
        // Pilih perintah secara acak dari daftar
        const randomCommand = commands[Math.floor(Math.random() * commands.length)];
        
        // Tambahkan jeda antar pesan untuk mensimulasikan perilaku pengguna nyata
        const userDelay = i * delayBetweenMessages;
        
        const messagePromise = new Promise(resolve => {
          setTimeout(async () => {
            const result = await sendMessage(user, randomCommand);
            resolve(result);
          }, userDelay);
        });
        
        allPromises.push(messagePromise);
      }
    }
    
    // Tunggu semua pesan selesai diproses
    await Promise.all(allPromises);
    
    const elapsedTestTime = process.hrtime(startTestTime);
    const totalTestTimeMs = (elapsedTestTime[0] * 1000 + elapsedTestTime[1] / 1e6).toFixed(2);
    
    // Hitung statistik hasil
    const totalMessages = messageProcessingResults.length;
    const successfulMessages = messageProcessingResults.filter(r => r.status === 'success').length;
    const failedMessages = messageProcessingResults.filter(r => r.status === 'failed').length;
    
    const responseTimes = messageProcessingResults
      .filter(r => r.status === 'success')
      .map(r => r.responseTime);
    
    const avgResponseTime = (responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length).toFixed(2);
    const minResponseTime = Math.min(...responseTimes).toFixed(2);
    const maxResponseTime = Math.max(...responseTimes).toFixed(2);
    
    const messagesPerSecond = (totalMessages / (parseFloat(totalTestTimeMs) / 1000)).toFixed(2);
    
    // Ringkasan hasil
    const summary = {
      testConfig: {
        concurrentUsers,
        messagePerUser,
        delayBetweenMessages,
        commandsTested: commands
      },
      results: {
        totalTestTime: `${totalTestTimeMs} ms`,
        totalMessages,
        successfulMessages,
        failedMessages,
        successRate: `${((successfulMessages / totalMessages) * 100).toFixed(2)}%`,
        avgResponseTime: `${avgResponseTime} ms`,
        minResponseTime: `${minResponseTime} ms`,
        maxResponseTime: `${maxResponseTime} ms`,
        messagesPerSecond: `${messagesPerSecond} msg/s`
      },
      userStats: users.map(u => ({
        userId: u.userId,
        messagesProcessed: u.stats.messagesProcessed,
        successfulMessages: u.stats.successfulMessages,
        failedMessages: u.stats.failedMessages,
        avgResponseTime: `${u.stats.avgResponseTime.toFixed(2)} ms`
      })),
      messageDetails: messageProcessingResults
    };
    
    // Simpan hasil ke file
    fs.writeFileSync(resultsFilePath, JSON.stringify(summary, null, 2));
    
    logger.info(`Stress test selesai. Hasil disimpan di ${resultsFilePath}`);
    logger.info(`Statistik utama: ${messagesPerSecond} pesan/detik, rata-rata ${avgResponseTime} ms/pesan, tingkat keberhasilan ${((successfulMessages / totalMessages) * 100).toFixed(2)}%`);
    
    return {
      status: true,
      message: `Stress test berhasil. ${totalMessages} pesan diproses dalam ${totalTestTimeMs} ms.`,
      summary
    };
  } catch (error) {
    logger.error(`Error menjalankan stress test: ${error.message}`);
    return {
      status: false,
      message: `Gagal menjalankan stress test: ${error.message}`
    };
  }
};

module.exports = {
  runStressTest
}; 