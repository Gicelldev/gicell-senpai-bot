const Player = require('../models/Player');
const Message = require('../models/Message');
const Guild = require('../models/Guild');
const logger = require('../utils/logger');
const { createBackup, restoreBackup } = require('../utils/databaseBackup');
const fs = require('fs');
const path = require('path');

// Daftar ID admin
const ADMIN_IDS = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',') : [];
const ADMIN_NUMBER = process.env.ADMIN_NUMBER;

/**
 * Memeriksa apakah pengguna adalah admin
 * @param {String} userId - ID pengguna WhatsApp
 * @returns {Boolean} - true jika admin, false jika bukan
 */
const isAdmin = (userId) => {
  // Menangani format nomor WhatsApp: "nomor@s.whatsapp.net"
  const cleanNumber = userId.split('@')[0];
  
  // Periksa apakah ada di daftar ADMIN_IDS atau cocok dengan ADMIN_NUMBER
  const adminCheck = 
    ADMIN_IDS.includes(userId) || 
    ADMIN_IDS.includes(cleanNumber) || 
    userId === ADMIN_NUMBER || 
    cleanNumber === ADMIN_NUMBER;
  
  logger.debug(`[REPORT_ADMIN] Pengecekan role admin | User: ${userId} | Clean: ${cleanNumber} | ADMIN_NUMBER: ${ADMIN_NUMBER} | Is Admin: ${adminCheck}`);
  return adminCheck;
};

/**
 * Menampilkan informasi server dan jumlah pemain aktif
 * @param {String} userId - ID pengguna WhatsApp
 * @returns {Object} - Status dan pesan respons
 */
const getServerInfo = async (userId) => {
  try {
    // Cek apakah pengguna adalah admin
    if (!isAdmin(userId)) {
      return {
        status: false,
        message: 'Anda tidak memiliki izin untuk mengakses fitur ini.'
      };
    }

    // Hitung total pemain terdaftar
    const totalPlayers = await Player.countDocuments();
    
    // Hitung pemain aktif dalam 24 jam terakhir
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const activePlayers = await Player.countDocuments({
      lastActivity: { $gte: oneDayAgo }
    });
    
    // Hitung total guild
    const totalGuilds = await Guild.countDocuments();
    
    // Ambil info memori
    const memoryUsage = process.memoryUsage();
    const memoryUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024 * 100) / 100;
    const memoryTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024 * 100) / 100;
    
    // Format pesan respons
    const message = 
`🛠️ *SERVER INFO* 🛠️

*Pemain & Guild:*
- Total Pemain: ${totalPlayers}
- Pemain Aktif (24j): ${activePlayers}
- Total Guild: ${totalGuilds}

*Server Resources:*
- Memory Usage: ${memoryUsedMB}MB / ${memoryTotalMB}MB
- Uptime: ${Math.floor(process.uptime() / 3600)} jam ${Math.floor((process.uptime() % 3600) / 60)} menit

*Node.js Info:*
- Version: ${process.version}
- Platform: ${process.platform}
`;

    return {
      status: true,
      message
    };
  } catch (error) {
    logger.error(`Error getting server info: ${error.message}`);
    return {
      status: false,
      message: `Terjadi kesalahan saat mengambil informasi server: ${error.message}`
    };
  }
};

/**
 * Membuat backup database
 * @param {String} userId - ID pengguna WhatsApp
 * @returns {Object} - Status dan pesan respons
 */
const backupDatabase = async (userId) => {
  try {
    // Cek apakah pengguna adalah admin
    if (!isAdmin(userId)) {
      return {
        status: false,
        message: 'Anda tidak memiliki izin untuk mengakses fitur ini.'
      };
    }

    // Buat backup
    const backupDir = path.join(process.cwd(), 'backups');
    const backupPath = await createBackup(backupDir);
    
    // Format pesan respons
    const message = 
`✅ *DATABASE BACKUP* ✅

Backup database berhasil dibuat.
File: ${path.basename(backupPath)}
Path: ${backupPath}
Ukuran: ${(fs.statSync(backupPath).size / (1024 * 1024)).toFixed(2)} MB
`;

    return {
      status: true,
      message
    };
  } catch (error) {
    logger.error(`Error backup database: ${error.message}`);
    return {
      status: false,
      message: `Terjadi kesalahan saat backup database: ${error.message}`
    };
  }
};

/**
 * Memulihkan database dari file backup
 * @param {String} userId - ID pengguna WhatsApp
 * @param {String} fileName - Nama file backup
 * @returns {Object} - Status dan pesan respons
 */
const restoreFromBackup = async (userId, fileName) => {
  try {
    // Cek apakah pengguna adalah admin
    if (!isAdmin(userId)) {
      return {
        status: false,
        message: 'Anda tidak memiliki izin untuk mengakses fitur ini.'
      };
    }

    // Validasi input
    if (!fileName) {
      return {
        status: false,
        message: 'Silakan tentukan nama file backup. Contoh: !admin restore game_2023-01-01.gz'
      };
    }
    
    // Cari file backup
    const backupDir = path.join(process.cwd(), 'backups');
    const backupPath = path.join(backupDir, fileName);
    
    // Pulihkan database
    await restoreBackup(backupPath);
    
    // Format pesan respons
    const message = 
`✅ *DATABASE RESTORE* ✅

Database berhasil dipulihkan dari backup:
File: ${fileName}
`;

    return {
      status: true,
      message
    };
  } catch (error) {
    logger.error(`Error restore database: ${error.message}`);
    return {
      status: false,
      message: `Terjadi kesalahan saat memulihkan database: ${error.message}`
    };
  }
};

/**
 * Menampilkan daftar file backup
 * @param {String} userId - ID pengguna WhatsApp
 * @returns {Object} - Status dan pesan respons
 */
const listBackups = async (userId) => {
  try {
    // Cek apakah pengguna adalah admin
    if (!isAdmin(userId)) {
      return {
        status: false,
        message: 'Anda tidak memiliki izin untuk mengakses fitur ini.'
      };
    }

    // Cari file backup
    const backupDir = path.join(process.cwd(), 'backups');
    
    // Pastikan direktori ada
    if (!fs.existsSync(backupDir)) {
      return {
        status: true,
        message: 'Direktori backup belum ada. Tidak ada file backup.'
      };
    }
    
    // Ambil daftar file
    const files = fs.readdirSync(backupDir)
      .filter(file => file.endsWith('.gz'))
      .map(file => ({
        name: file,
        created: fs.statSync(path.join(backupDir, file)).birthtime,
        size: (fs.statSync(path.join(backupDir, file)).size / (1024 * 1024)).toFixed(2) // Size in MB
      }))
      .sort((a, b) => b.created - a.created);
    
    if (files.length === 0) {
      return {
        status: true,
        message: 'Tidak ada file backup yang ditemukan.'
      };
    }
    
    // Format pesan respons
    let fileList = '';
    files.forEach((file, index) => {
      const date = file.created.toLocaleDateString();
      const time = file.created.toLocaleTimeString();
      fileList += `${index + 1}. ${file.name}\n   - Dibuat: ${date} ${time}\n   - Ukuran: ${file.size} MB\n\n`;
    });
    
    const message = 
`📁 *DAFTAR BACKUP* 📁

${fileList}
Untuk memulihkan database, gunakan:
!admin restore [nama_file]
`;

    return {
      status: true,
      message
    };
  } catch (error) {
    logger.error(`Error listing backups: ${error.message}`);
    return {
      status: false,
      message: `Terjadi kesalahan saat menampilkan daftar backup: ${error.message}`
    };
  }
};

/**
 * Ban pemain
 * @param {String} userId - ID pengguna admin
 * @param {String} targetName - Nama pemain yang akan di-ban
 * @param {String} reason - Alasan ban
 * @returns {Object} - Status dan pesan respons
 */
const banPlayer = async (userId, targetName, reason) => {
  try {
    // Cek apakah pengguna adalah admin
    if (!isAdmin(userId)) {
      return {
        status: false,
        message: 'Anda tidak memiliki izin untuk mengakses fitur ini.'
      };
    }

    // Validasi input
    if (!targetName) {
      return {
        status: false,
        message: 'Silakan tentukan nama pemain yang akan di-ban. Contoh: !admin ban PlayerName Alasan ban'
      };
    }
    
    // Cari pemain
    const player = await Player.findOne({ name: new RegExp(`^${targetName}$`, 'i') });
    
    if (!player) {
      return {
        status: false,
        message: `Pemain dengan nama "${targetName}" tidak ditemukan.`
      };
    }
    
    // Ban pemain
    player.isBanned = true;
    player.banReason = reason || 'Melanggar peraturan game';
    player.bannedAt = new Date();
    
    // Simpan perubahan
    await player.save();
    
    logger.info(`Player ${player.name} banned by admin ${userId}. Reason: ${player.banReason}`);
    
    // Format pesan respons
    const message = 
`🔒 *PLAYER BANNED* 🔒

Pemain berikut telah di-ban:
- Nama: ${player.name}
- Alasan: ${player.banReason}
- Waktu: ${player.bannedAt.toLocaleString()}
`;

    return {
      status: true,
      message
    };
  } catch (error) {
    logger.error(`Error banning player: ${error.message}`);
    return {
      status: false,
      message: `Terjadi kesalahan saat mem-ban pemain: ${error.message}`
    };
  }
};

/**
 * Unban pemain
 * @param {String} userId - ID pengguna admin
 * @param {String} targetName - Nama pemain yang akan di-unban
 * @returns {Object} - Status dan pesan respons
 */
const unbanPlayer = async (userId, targetName) => {
  try {
    // Cek apakah pengguna adalah admin
    if (!isAdmin(userId)) {
      return {
        status: false,
        message: 'Anda tidak memiliki izin untuk mengakses fitur ini.'
      };
    }

    // Validasi input
    if (!targetName) {
      return {
        status: false,
        message: 'Silakan tentukan nama pemain yang akan di-unban. Contoh: !admin unban PlayerName'
      };
    }
    
    // Cari pemain
    const player = await Player.findOne({ name: new RegExp(`^${targetName}$`, 'i') });
    
    if (!player) {
      return {
        status: false,
        message: `Pemain dengan nama "${targetName}" tidak ditemukan.`
      };
    }
    
    // Cek apakah pemain di-ban
    if (!player.isBanned) {
      return {
        status: false,
        message: `Pemain ${player.name} tidak sedang dalam status banned.`
      };
    }
    
    // Unban pemain
    player.isBanned = false;
    player.banReason = null;
    player.bannedAt = null;
    
    // Simpan perubahan
    await player.save();
    
    logger.info(`Player ${player.name} unbanned by admin ${userId}`);
    
    // Format pesan respons
    const message = 
`🔓 *PLAYER UNBANNED* 🔓

Pemain berikut telah di-unban:
- Nama: ${player.name}
- Status: Aktif
`;

    return {
      status: true,
      message
    };
  } catch (error) {
    logger.error(`Error unbanning player: ${error.message}`);
    return {
      status: false,
      message: `Terjadi kesalahan saat meng-unban pemain: ${error.message}`
    };
  }
};

/**
 * Menampilkan daftar laporan dari pemain
 * @param {String} userId - ID pengguna admin
 * @returns {Object} - Status dan pesan respons
 */
const viewReports = async (userId) => {
  try {
    logger.info(`[REPORT_ADMIN] Admin mencoba melihat daftar laporan | Admin: ${userId}`);
    
    // Cek apakah pengguna adalah admin
    if (!isAdmin(userId)) {
      logger.warn(`[REPORT_ADMIN] Akses ditolak untuk melihat laporan | User: ${userId}`);
      return {
        status: false,
        message: 'Anda tidak memiliki izin untuk mengakses fitur ini.'
      };
    }

    // Cari laporan yang belum ditangani
    const reports = await Report.find({ status: { $ne: 'resolved' } })
      .sort({ createdAt: -1 })
      .populate('reporter', 'name')
      .populate('reportedPlayer', 'name');
    
    logger.info(`[REPORT_ADMIN] Ditemukan ${reports.length} laporan yang belum diselesaikan`);
    
    if (reports.length === 0) {
      return {
        status: true,
        message: 'Tidak ada laporan yang perlu ditangani.'
      };
    }
    
    // Format pesan respons
    let reportList = '';
    reports.forEach((report, index) => {
      const date = report.createdAt.toLocaleDateString();
      const time = report.createdAt.toLocaleTimeString();
      reportList += `${index + 1}. ID: ${report._id}\n`;
      reportList += `   - Pelapor: ${report.reporter.name}\n`;
      reportList += `   - Dilaporkan: ${report.reportedPlayer.name}\n`;
      reportList += `   - Kategori: ${report.category}\n`;
      reportList += `   - Status: ${getReportStatusInIndonesian(report.status)}\n`;
      reportList += `   - Alasan: ${report.reason}\n`;
      reportList += `   - Waktu: ${date} ${time}\n\n`;
    });
    
    const message = 
`📢 *DAFTAR LAPORAN* 📢

${reportList}
Untuk menangani laporan, gunakan:
!admin resolve [id_laporan] [resolve/reject/investigate] [komentar]
`;

    return {
      status: true,
      message
    };
  } catch (error) {
    logger.error(`[REPORT_ADMIN] Error saat melihat daftar laporan: ${error.message}`, { stack: error.stack });
    return {
      status: false,
      message: `Terjadi kesalahan saat melihat laporan: ${error.message}`
    };
  }
};

/**
 * Menyelesaikan laporan
 * @param {String} userId - ID pengguna admin
 * @param {String} reportId - ID laporan
 * @param {String} action - Tindakan (resolve/reject/investigate)
 * @param {String} comment - Komentar admin
 * @returns {Object} - Status dan pesan respons
 */
const resolveReport = async (userId, reportId, action, comment) => {
  try {
    // Cek apakah pengguna adalah admin
    if (!isAdmin(userId)) {
      logger.warn(`[REPORT_ADMIN] Akses ditolak untuk menyelesaikan laporan | User: ${userId} | Laporan: ${reportId}`);
      return {
        status: false,
        message: 'Anda tidak memiliki izin untuk mengakses fitur ini.'
      };
    }

    // Validasi input
    if (!reportId) {
      logger.warn(`[REPORT_ADMIN] Validasi input gagal | User: ${userId} | Laporan: tidak ada`);
      return {
        status: false,
        message: 'Silakan tentukan ID laporan yang akan ditangani. Contoh: !admin resolve 5f7b1c3d4e2a1b0e8f9d0c2a resolve Pemain telah diperingatkan'
      };
    }
    
    // Validasi tindakan
    if (!action || !['resolve', 'reject', 'investigate'].includes(action.toLowerCase())) {
      logger.warn(`[REPORT_ADMIN] Tindakan tidak valid | User: ${userId} | Tindakan: ${action || 'tidak ada'}`);
      return {
        status: false,
        message: 'Tindakan harus berupa "resolve", "reject", atau "investigate"'
      };
    }
    
    logger.info(`[REPORT_ADMIN] Mencoba menyelesaikan laporan | Admin: ${userId} | Laporan: ${reportId} | Tindakan: ${action}`);
    
    // Cari laporan
    const report = await Report.findById(reportId)
      .populate('reporter', 'name')
      .populate('reportedPlayer', 'name');
    
    if (!report) {
      logger.warn(`[REPORT_ADMIN] Laporan tidak ditemukan | Admin: ${userId} | Laporan: ${reportId}`);
      return {
        status: false,
        message: `Laporan dengan ID "${reportId}" tidak ditemukan.`
      };
    }
    
    logger.debug(`[REPORT_ADMIN] Laporan ditemukan | ID: ${reportId} | Pelapor: ${report.reporter.name} | Dilaporkan: ${report.reportedPlayer.name} | Status: ${report.status}`);
    
    // Cek apakah laporan sudah diselesaikan
    if (report.status === 'resolved') {
      logger.warn(`[REPORT_ADMIN] Laporan sudah diselesaikan sebelumnya | ID: ${reportId}`);
      return {
        status: false,
        message: `Laporan ini sudah diselesaikan sebelumnya.`
      };
    }
    
    // Selesaikan laporan
    const oldStatus = report.status;
    report.status = action.toLowerCase();
    report.adminComment = comment || '';
    
    if (action === 'resolve' || action === 'reject') {
      report.resolvedBy = userId;
      report.resolvedAt = new Date();
    }
    
    // Simpan perubahan
    await report.save();
    
    logger.info(`[REPORT_ADMIN] Laporan berhasil ditangani | ID: ${reportId} | Status: ${oldStatus} => ${report.status} | Admin: ${userId} | Komentar: ${comment ? 'Ada' : 'Tidak ada'}`);
    
    // Format pesan respons
    const actionMsg = action === 'resolve' ? 'diselesaikan' : 
                     (action === 'reject' ? 'ditolak' : 'sedang diinvestigasi');
    
    const message = 
`✅ *LAPORAN DITANGANI* ✅

Laporan berikut telah ${actionMsg}:
- ID: ${report._id}
- Pelapor: ${report.reporter.name}
- Dilaporkan: ${report.reportedPlayer.name}
- Kategori: ${report.category}
`;

    // Kirim notifikasi ke pemain pelapor jika modul Notification tersedia
    try {
      const { createNotification } = require('./notificationController');
      if (createNotification) {
        const notificationTitle = `Laporan ${actionMsg}`;
        const notificationMessage = `Laporan Anda terhadap ${report.reportedPlayer.name} telah ${actionMsg}${comment ? `: ${comment}` : '.'}`;
        
        logger.debug(`[REPORT_ADMIN] Mengirim notifikasi ke pelapor | Pelapor: ${report.reporter.name}`);
        
        createNotification(report.reporter._id, 'report', notificationTitle, notificationMessage)
          .catch(err => logger.error(`[REPORT_ADMIN] Error saat mengirim notifikasi: ${err.message}`, { stack: err.stack }));
      }
    } catch (err) {
      // Jika modul tidak tersedia, abaikan
      logger.warn(`[REPORT_ADMIN] Modul notifikasi tidak tersedia: ${err.message}`);
    }

    return {
      status: true,
      message
    };
  } catch (error) {
    logger.error(`[REPORT_ADMIN] Error saat menyelesaikan laporan: ${error.message}`, { stack: error.stack });
    return {
      status: false,
      message: `Terjadi kesalahan saat menyelesaikan laporan: ${error.message}`
    };
  }
};

/**
 * Menerjemahkan status laporan ke dalam bahasa Indonesia
 * @param {String} status - Status dalam bahasa Inggris
 * @returns {String} - Status dalam bahasa Indonesia
 */
const getReportStatusInIndonesian = (status) => {
  const statusMap = {
    'pending': 'Menunggu',
    'investigating': 'Sedang Diinvestigasi',
    'resolved': 'Diselesaikan',
    'rejected': 'Ditolak'
  };
  
  const translatedStatus = statusMap[status] || status;
  logger.debug(`[REPORT_ADMIN] Terjemahan status | Asli: ${status} | Terjemahan: ${translatedStatus}`);
  return translatedStatus;
};

/**
 * Menyimpan laporan dari pemain
 * @param {String} userId - ID pengguna pelapor
 * @param {String} targetName - Nama pemain yang dilaporkan
 * @param {String} reason - Alasan pelaporan
 * @returns {Object} - Status dan pesan respons
 */
const reportPlayer = async (userId, targetName, reason) => {
  try {
    // Validasi input
    if (!targetName) {
      logger.warn(`[REPORT_ADMIN] Validasi input gagal | Pelapor: ${userId} | Target: tidak ada`);
      return {
        status: false,
        message: 'Silakan tentukan nama pemain yang akan dilaporkan. Contoh: !lapor PlayerName chat kasar'
      };
    }
    
    if (!reason) {
      logger.warn(`[REPORT_ADMIN] Validasi input gagal | Pelapor: ${userId} | Target: ${targetName} | Alasan: tidak ada`);
      return {
        status: false,
        message: 'Silakan berikan alasan pelaporan.'
      };
    }
    
    logger.info(`[REPORT_ADMIN] Mencoba melaporkan pemain | Pelapor: ${userId} | Target: ${targetName}`);
    
    // Cari pemain pelapor
    const reporter = await Player.findByUserId(userId);
    
    if (!reporter) {
      logger.warn(`[REPORT_ADMIN] Pelapor tidak terdaftar | User: ${userId}`);
      return {
        status: false,
        message: 'Anda belum terdaftar sebagai pemain. Gunakan !daftar [nama] untuk mendaftar.'
      };
    }
    
    logger.debug(`[REPORT_ADMIN] Pelapor ditemukan | ID: ${reporter._id} | Nama: ${reporter.name}`);
    
    // Update lastActivity
    reporter.lastActivity = Date.now();
    
    // Cari pemain yang dilaporkan
    const reportedPlayer = await Player.findOne({ name: new RegExp(`^${targetName}$`, 'i') });
    
    if (!reportedPlayer) {
      logger.warn(`[REPORT_ADMIN] Pemain yang dilaporkan tidak ditemukan | Target: ${targetName}`);
      return {
        status: false,
        message: `Pemain dengan nama "${targetName}" tidak ditemukan.`
      };
    }
    
    logger.debug(`[REPORT_ADMIN] Pemain yang dilaporkan ditemukan | ID: ${reportedPlayer._id} | Nama: ${reportedPlayer.name}`);
    
    // Tidak bisa melaporkan diri sendiri
    if (reporter._id.toString() === reportedPlayer._id.toString()) {
      logger.warn(`[REPORT_ADMIN] Pemain mencoba melaporkan diri sendiri | ID: ${reporter._id} | Nama: ${reporter.name}`);
      return {
        status: false,
        message: 'Anda tidak dapat melaporkan diri sendiri.'
      };
    }
    
    // Cek apakah sudah pernah melapor pemain yang sama dalam 24 jam
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const existingReport = await Report.findOne({
      reporter: reporter._id,
      reportedPlayer: reportedPlayer._id,
      createdAt: { $gte: oneDayAgo }
    });
    
    if (existingReport) {
      logger.warn(`[REPORT_ADMIN] Duplikasi laporan terdeteksi | ID Laporan: ${existingReport._id} | Status: ${existingReport.status}`);
      return {
        status: false,
        message: `Anda sudah melaporkan pemain ${reportedPlayer.name} dalam 24 jam terakhir. Silakan tunggu admin menangani laporan sebelumnya.`
      };
    }
    
    // Tentukan kategori pelaporan berdasarkan kata kunci
    let category = 'other';
    
    if (reason.toLowerCase().includes('spam') || reason.toLowerCase().includes('promosi')) {
      category = 'spam';
    } else if (reason.toLowerCase().includes('kasar') || reason.toLowerCase().includes('toxic') || reason.toLowerCase().includes('bully')) {
      category = 'harassment';
    } else if (reason.toLowerCase().includes('cheat') || reason.toLowerCase().includes('hack') || reason.toLowerCase().includes('curang')) {
      category = 'cheating';
    }
    
    logger.debug(`[REPORT_ADMIN] Kategori terdeteksi: ${category} berdasarkan alasan`);
    
    // Buat laporan baru
    const newReport = new Report({
      reporter: reporter._id,
      reportedPlayer: reportedPlayer._id,
      reason,
      category
    });
    
    // Simpan laporan
    await newReport.save();
    await reporter.save();
    
    logger.info(`[REPORT_ADMIN] Laporan berhasil dibuat | ID: ${newReport._id} | Pelapor: ${reporter.name} | Dilaporkan: ${reportedPlayer.name} | Kategori: ${category}`);
    
    // Format pesan respons
    const message = 
`✅ *LAPORAN DITERIMA* ✅

Laporan terhadap ${reportedPlayer.name} telah diterima.
Kategori: ${category}

Admin akan segera meninjau laporan Anda. Terima kasih atas bantuannya untuk menjaga komunitas game tetap sehat.
`;

    // Notifikasi ke admin
    const adminMessage = 
`🚨 *LAPORAN BARU* 🚨

Ada laporan baru dari pemain:
- Pelapor: ${reporter.name}
- Dilaporkan: ${reportedPlayer.name}
- Kategori: ${category}
- Alasan: ${reason}

Gunakan !admin viewreports untuk melihat semua laporan.
`;

    // Kirim notifikasi ke semua admin (tidak diimplementasikan di sini)
    logger.debug(`[REPORT_ADMIN] Pemberitahuan ke admin akan dikirim`);
    
    return {
      status: true,
      message
    };
  } catch (error) {
    logger.error(`[REPORT_ADMIN] Error saat melaporkan pemain: ${error.message}`, { stack: error.stack });
    return {
      status: false,
      message: `Terjadi kesalahan saat melaporkan pemain: ${error.message}`
    };
  }
};

// Export model untuk schema Report jika tidak ada
const mongoose = require('mongoose');
let Report;

try {
  Report = mongoose.model('Report');
} catch (error) {
  // Buat model Report jika belum ada
  const ReportSchema = new mongoose.Schema({
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Player',
      required: true
    },
    reportedPlayer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Player',
      required: true
    },
    reason: {
      type: String,
      required: true
    },
    category: {
      type: String,
      enum: ['spam', 'harassment', 'cheating', 'scamming', 'other'],
      default: 'other'
    },
    status: {
      type: String,
      enum: ['pending', 'investigating', 'resolved', 'rejected'],
      default: 'pending'
    },
    adminComment: {
      type: String,
      default: null
    },
    resolvedBy: {
      type: String,
      default: null
    },
    resolvedAt: {
      type: Date,
      default: null
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  });
  
  Report = mongoose.model('Report', ReportSchema);
}

/**
 * Menangani semua perintah admin
 * @param {String} userId - ID pengguna WhatsApp
 * @param {Array} args - Argumen perintah
 * @returns {Object} - Status dan pesan respons
 */
const handleAdminCommand = async (userId, args) => {
  try {
    // Jika tidak ada subcommand, tampilkan bantuan admin
    if (!args.length) {
      return getAdminHelp(userId);
    }
    
    // Proses subcommand
    const subCommand = args.shift().toLowerCase();
    
    switch (subCommand) {
      case 'info':
      case 'server':
        return getServerInfo(userId);
      
      case 'backup':
        return backupDatabase(userId);
      
      case 'backuplist':
      case 'listbackups':
        return listBackups(userId);
      
      case 'restore':
        return restoreFromBackup(userId, args[0]);
      
      case 'ban':
        return banPlayer(userId, args[0], args.slice(1).join(' '));
      
      case 'unban':
        return unbanPlayer(userId, args[0]);
      
      case 'viewreports':
      case 'reports':
        return viewReports(userId);
      
      case 'reportstats':
      case 'reportstatistics':
        try {
          logger.info(`[REPORT_ADMIN] Mencoba mendapatkan statistik laporan | Admin: ${userId}`);
          const { getReportStatistics } = require('./reportController');
          if (getReportStatistics) {
            return await getReportStatistics(userId);
          } else {
            logger.warn(`[REPORT_ADMIN] Fungsi getReportStatistics tidak tersedia`);
            return {
              status: false,
              message: 'Fitur statistik laporan tidak tersedia.'
            };
          }
        } catch (err) {
          logger.error(`[REPORT_ADMIN] Error saat mengakses statistik laporan: ${err.message}`, { stack: err.stack });
          return {
            status: false,
            message: 'Terjadi kesalahan saat mengakses statistik laporan.'
          };
        }
      
      case 'resolve':
      case 'tanganilaporon':
        if (args.length < 2) {
          return {
            status: false,
            message: 'Format: !admin resolve [id_laporan] [resolve/reject/investigate] [komentar]'
          };
        }
        return resolveReport(userId, args[0], args[1], args.slice(2).join(' '));
      
      default:
        return {
          status: false,
          message: 'Perintah admin tidak valid. Gunakan !admin untuk melihat daftar perintah admin.'
        };
    }
  } catch (error) {
    logger.error(`[ADMIN] Error menangani perintah admin: ${error.message}`, { stack: error.stack });
    return {
      status: false,
      message: 'Terjadi kesalahan saat memproses perintah admin.'
    };
  }
};

/**
 * Menampilkan bantuan admin
 * @param {String} userId - ID pengguna WhatsApp
 * @returns {Object} - Status dan pesan respons
 */
const getAdminHelp = (userId) => {
  // Cek apakah pengguna adalah admin
  if (!isAdmin(userId)) {
    return {
      status: false,
      message: 'Anda tidak memiliki izin untuk mengakses fitur ini.'
    };
  }
  
  // Format pesan respons
  const message = 
`🛠️ *ADMIN COMMANDS* 🛠️

*Information:*
!admin info - Menampilkan informasi server

*Database Management:*
!admin backup - Buat backup database
!admin listbackups - Lihat daftar backup
!admin restore [file] - Pulihkan dari backup

*Player Moderation:*
!admin ban [nama] [alasan] - Ban pemain
!admin unban [nama] - Unban pemain
!admin viewreports - Lihat laporan pemain
!admin reportstats - Lihat statistik laporan
!admin resolve [id] [resolve/reject/investigate] [komentar] - Menangani laporan

*Untuk semua pengguna:*
!lapor [nama] [alasan] - Melaporkan pemain
!laporanku - Lihat laporan yang telah dibuat
`;

  return {
    status: true,
    message
  };
};

module.exports = {
  handleAdminCommand,
  reportPlayer,
  isAdmin
}; 