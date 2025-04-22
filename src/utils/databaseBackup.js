const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const logger = require('./logger');
const mongoose = require('mongoose');

/**
 * Membuat backup database MongoDB
 * @param {String} backupDir - Direktori untuk menyimpan file backup
 * @returns {Promise<String>} - Path file backup yang dibuat
 */
const createBackup = async (backupDir) => {
  try {
    // Pastikan direktori backup ada
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // Mendapatkan konfigurasi database dari environment variables
    const { 
      MONGODB_URI = 'mongodb://localhost:27017/wabot_rpg',
      MONGODB_HOST = 'localhost',
      MONGODB_PORT = '27017',
      MONGODB_DB = 'wabot_rpg',
      MONGODB_USER,
      MONGODB_PASSWORD
    } = process.env;

    // Format nama file dengan timestamp
    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
    const backupFileName = `${MONGODB_DB}_${timestamp}.gz`;
    const backupPath = path.join(backupDir, backupFileName);

    // Buat command untuk mongodump
    let command = '';
    
    // Jika menggunakan URI lengkap
    if (MONGODB_URI && MONGODB_URI !== 'mongodb://localhost:27017/wabot_rpg') {
      command = `mongodump --uri="${MONGODB_URI}" --gzip --archive="${backupPath}"`;
    } 
    // Jika menggunakan kredensial terpisah
    else {
      command = `mongodump --host=${MONGODB_HOST} --port=${MONGODB_PORT} --db=${MONGODB_DB}`;
      
      if (MONGODB_USER && MONGODB_PASSWORD) {
        command += ` --username=${MONGODB_USER} --password=${MONGODB_PASSWORD} --authenticationDatabase=admin`;
      }
      
      command += ` --gzip --archive="${backupPath}"`;
    }

    // Jalankan command backup
    const { stdout, stderr } = await execPromise(command);
    
    if (stderr && !stderr.includes('done dumping')) {
      throw new Error(`mongodump error: ${stderr}`);
    }

    logger.info(`Database backup created: ${backupPath}`);
    return backupPath;
  } catch (error) {
    logger.error(`Error creating database backup: ${error.message}`);
    throw error;
  }
};

/**
 * Memulihkan database dari file backup
 * @param {String} backupPath - Path ke file backup
 * @returns {Promise<void>}
 */
const restoreBackup = async (backupPath) => {
  try {
    // Cek apakah file backup ada
    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup file not found: ${backupPath}`);
    }

    // Mendapatkan konfigurasi database dari environment variables
    const { 
      MONGODB_URI = 'mongodb://localhost:27017/wabot_rpg',
      MONGODB_HOST = 'localhost',
      MONGODB_PORT = '27017',
      MONGODB_DB = 'wabot_rpg',
      MONGODB_USER,
      MONGODB_PASSWORD
    } = process.env;

    // Buat command untuk mongorestore
    let command = '';
    
    // Jika menggunakan URI lengkap
    if (MONGODB_URI && MONGODB_URI !== 'mongodb://localhost:27017/wabot_rpg') {
      command = `mongorestore --uri="${MONGODB_URI}" --gzip --archive="${backupPath}" --drop`;
    } 
    // Jika menggunakan kredensial terpisah
    else {
      command = `mongorestore --host=${MONGODB_HOST} --port=${MONGODB_PORT} --db=${MONGODB_DB}`;
      
      if (MONGODB_USER && MONGODB_PASSWORD) {
        command += ` --username=${MONGODB_USER} --password=${MONGODB_PASSWORD} --authenticationDatabase=admin`;
      }
      
      command += ` --gzip --archive="${backupPath}" --drop`;
    }

    // Jalankan command restore
    const { stdout, stderr } = await execPromise(command);
    
    if (stderr && !stderr.includes('done') && !stderr.includes('finished')) {
      throw new Error(`mongorestore error: ${stderr}`);
    }

    logger.info(`Database restored from backup: ${backupPath}`);
  } catch (error) {
    logger.error(`Error restoring database: ${error.message}`);
    throw error;
  }
};

/**
 * Menjadwalkan backup otomatis setiap interval waktu tertentu
 * @param {Number} interval - Interval dalam milidetik
 * @param {String} outputDir - Direktori untuk menyimpan backup
 * @param {Number} maxBackups - Jumlah maksimal backup yang disimpan
 * @returns {Object} - Interval timer
 */
const scheduleBackup = (interval = 24 * 60 * 60 * 1000, outputDir = './backups', maxBackups = 7) => {
  // Jalankan backup pertama
  createBackup(outputDir).catch(err => {
    logger.error(`Initial backup failed: ${err.message}`);
  });

  // Jadwalkan backup selanjutnya
  const timer = setInterval(async () => {
    try {
      await createBackup(outputDir);
      
      // Hapus backup lama jika melebihi maxBackups
      const files = fs.readdirSync(outputDir)
        .filter(file => file.endsWith('.gz'))
        .map(file => ({
          name: file,
          path: path.join(outputDir, file),
          created: fs.statSync(path.join(outputDir, file)).birthtime
        }))
        .sort((a, b) => b.created - a.created);
      
      if (files.length > maxBackups) {
        const filesToDelete = files.slice(maxBackups);
        filesToDelete.forEach(file => {
          fs.unlinkSync(file.path);
          logger.info(`Deleted old backup: ${file.name}`);
        });
      }
    } catch (error) {
      logger.error(`Scheduled backup failed: ${error.message}`);
    }
  }, interval);

  return timer;
};

module.exports = {
  createBackup,
  restoreBackup,
  scheduleBackup
}; 