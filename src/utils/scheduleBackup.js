const { scheduleBackup } = require('./databaseBackup');
const logger = require('./logger');

/**
 * Menjadwalkan backup otomatis database
 * @param {Object} options - Opsi konfigurasi
 * @param {Number} options.intervalHours - Interval backup dalam jam (default: 24)
 * @param {String} options.backupDir - Direktori untuk menyimpan backup (default: './backups')
 * @param {Number} options.maxBackups - Jumlah maksimal file backup yang disimpan (default: 7)
 * @returns {Object} - Timer interval yang dijadwalkan
 */
const setupAutomaticBackup = (options = {}) => {
  try {
    const {
      intervalHours = 24,
      backupDir = './backups',
      maxBackups = 7
    } = options;

    // Konversi jam ke milidetik
    const intervalMs = intervalHours * 60 * 60 * 1000;

    logger.info(`Menjadwalkan backup otomatis setiap ${intervalHours} jam, menyimpan maksimal ${maxBackups} file di ${backupDir}`);
    
    // Jadwalkan backup dengan interval yang ditentukan
    const timer = scheduleBackup(intervalMs, backupDir, maxBackups);
    
    return timer;
  } catch (error) {
    logger.error(`Error setting up automatic backup: ${error.message}`);
    throw error;
  }
};

module.exports = {
  setupAutomaticBackup
}; 