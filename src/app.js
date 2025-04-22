// Tambahkan import untuk sistem backup dan stress test
const { setupAutomaticBackup } = require('./utils/scheduleBackup');
// Hanya impor stress test jika dalam mode development
const stressTest = process.env.NODE_ENV === 'development' ? require('./utils/stressTest') : null;
// Import modul migrasi model
const { migratePlayerModel } = require('./utils/migratePlayerModel');

// Inisialisasi WhatsApp client dan koneksi database ...

// Jalankan migrasi model Player pada startup
migratePlayerModel()
  .then(success => {
    if (success) {
      logger.info('Migrasi model Player berhasil');
    } else {
      logger.warn('Migrasi model Player gagal atau tidak diperlukan');
    }
  })
  .catch(err => {
    logger.error(`Error saat menjalankan migrasi model Player: ${err.message}`, { stack: err.stack });
  });

// Jadwalkan backup otomatis database
try {
  if (process.env.ENABLE_AUTO_BACKUP === 'true') {
    setupAutomaticBackup({
      intervalHours: parseInt(process.env.BACKUP_INTERVAL_HOURS || '24'),
      backupDir: process.env.BACKUP_DIR || './backups',
      maxBackups: parseInt(process.env.MAX_BACKUPS || '7')
    });
    logger.info('Backup otomatis database dijadwalkan');
  } else {
    logger.info('Backup otomatis database tidak diaktifkan. Aktifkan dengan mengatur ENABLE_AUTO_BACKUP=true');
  }
} catch (error) {
  logger.error(`Gagal menjadwalkan backup otomatis: ${error.message}`);
}

// Jalankan stress test jika dalam mode development
if (process.env.NODE_ENV === 'development' && process.env.RUN_STRESS_TEST === 'true') {
  setTimeout(async () => {
    try {
      logger.info('Menjalankan stress test...');
      const result = await stressTest.runStressTest({
        concurrentUsers: parseInt(process.env.STRESS_TEST_USERS || '10'),
        messagePerUser: parseInt(process.env.STRESS_TEST_MESSAGES || '5')
      });
      
      if (result.status) {
        logger.info(`Stress test berhasil: ${result.message}`);
      } else {
        logger.error(`Stress test gagal: ${result.message}`);
      }
    } catch (error) {
      logger.error(`Error menjalankan stress test: ${error.message}`);
    }
  }, 10000); // Tunggu 10 detik untuk memastikan aplikasi sudah berjalan dengan baik
} 