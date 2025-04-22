const Report = require('../models/Report');
const Player = require('../models/Player');
const logger = require('../utils/logger');
const { extractPhoneNumber, formatToWhatsAppId, isSamePhoneNumber } = require('../utils/phoneUtil');
const { registerAdminIfNotExist } = require('../utils/migratePlayerModel');

/**
 * Fungsi untuk memastikan pemain yang akan dilaporkan terdaftar
 * @param {String} phoneNumber - Nomor telepon pemain
 * @returns {Promise<object|null>} - Pemain atau null jika tidak ditemukan
 */
async function ensurePlayerExists(phoneNumber) {
  if (!phoneNumber) return null;
  
  try {
    // 1. Coba temukan pemain dengan metode normal
    let player = null;
    const cleanNumber = extractPhoneNumber(phoneNumber);
    
    // Coba dengan findPlayerByPhoneNumber
    if (typeof Player.findPlayerByPhoneNumber === 'function') {
      player = await Player.findPlayerByPhoneNumber(phoneNumber);
    }
    
    // Fallback ke query langsung
    if (!player) {
      player = await Player.findOne({ 
        $or: [
          { userId: phoneNumber },
          { userId: formatToWhatsAppId(phoneNumber) },
          { phoneNumber: phoneNumber },
          { phoneNumber: cleanNumber }
        ]
      });
    }
    
    // 2. Jika tidak ditemukan, cek apakah ini adalah nomor admin
    if (!player && isSamePhoneNumber(phoneNumber, process.env.ADMIN_NUMBER)) {
      logger.info(`[REPORT] Nomor admin terdeteksi (${phoneNumber}), memastikan terdaftar`);
      await registerAdminIfNotExist();
      
      // Coba lagi setelah registrasi
      player = await Player.findOne({ 
        $or: [
          { userId: process.env.ADMIN_NUMBER },
          { userId: formatToWhatsAppId(process.env.ADMIN_NUMBER) },
          { phoneNumber: process.env.ADMIN_NUMBER },
          { phoneNumber: extractPhoneNumber(process.env.ADMIN_NUMBER) }
        ]
      });
    }
    
    return player;
  } catch (error) {
    logger.error(`[REPORT] Error saat memastikan pemain terdaftar: ${error.message}`, { stack: error.stack });
    return null;
  }
}

/**
 * Fungsi untuk membuat laporan pemain
 * @param {Object} options - Opsi laporan
 * @param {String} options.reporterPhoneNumber - Nomor telepon pelapor
 * @param {String} options.reportedPhoneNumber - Nomor telepon pemain yang dilaporkan
 * @param {String} options.reason - Alasan melaporkan
 * @param {String} options.category - Kategori pelaporan
 * @returns {Object} - Pesan sukses/error
 */
async function reportPlayer(options) {
  try {
    const { reporterPhoneNumber, reportedPhoneNumber, reason, category } = options;
    
    logger.info(`[REPORT] Proses pelaporan dimulai | Pelapor: ${reporterPhoneNumber} | Dilaporkan: ${reportedPhoneNumber}`);

    // Validasi input
    if (!reporterPhoneNumber || !reportedPhoneNumber || !reason) {
      logger.warn(`[REPORT] Validasi input gagal | Pelapor: ${reporterPhoneNumber || 'tidak ada'} | Dilaporkan: ${reportedPhoneNumber || 'tidak ada'} | Alasan: ${reason ? 'ada' : 'tidak ada'}`);
      return {
        status: false,
        message: 'Nomor telepon pelapor, nomor telepon yang dilaporkan, dan alasan diperlukan'
      };
    }

    // Validasi kategori
    const validCategories = ['harassment', 'cheating', 'scamming', 'other'];
    const validCategory = category && validCategories.includes(category.toLowerCase()) 
      ? category.toLowerCase() 
      : 'other';
    
    logger.debug(`[REPORT] Kategori tervalidasi: ${validCategory}`);

    // Cek pelapor dan pemain yang dilaporkan
    const reporter = await ensurePlayerExists(reporterPhoneNumber);
    
    if (!reporter) {
      logger.warn(`[REPORT] Pelapor tidak terdaftar | Nomor: ${reporterPhoneNumber}`);
      return {
        status: false,
        message: 'Kamu belum terdaftar sebagai pemain. Gunakan !daftar terlebih dahulu'
      };
    }
    
    logger.debug(`[REPORT] Pelapor ditemukan | ID: ${reporter._id} | Nama: ${reporter.name}`);

    const reportedPlayer = await ensurePlayerExists(reportedPhoneNumber);
    
    if (!reportedPlayer) {
      logger.warn(`[REPORT] Pemain yang dilaporkan tidak ditemukan | Nomor: ${reportedPhoneNumber}`);
      return {
        status: false,
        message: 'Pemain yang kamu laporkan tidak ditemukan'
      };
    }
    
    logger.debug(`[REPORT] Pemain yang dilaporkan ditemukan | ID: ${reportedPlayer._id} | Nama: ${reportedPlayer.name}`);

    // Cek jika melaporkan diri sendiri
    if (reporter._id.toString() === reportedPlayer._id.toString()) {
      logger.warn(`[REPORT] Pemain mencoba melaporkan diri sendiri | ID: ${reporter._id} | Nama: ${reporter.name}`);
      return {
        status: false,
        message: 'Kamu tidak dapat melaporkan diri sendiri'
      };
    }

    // Cek apakah sudah pernah melaporkan pemain yang sama
    const existingReport = await Report.findOne({
      reporter: reporter._id,
      reportedPlayer: reportedPlayer._id,
      status: { $in: ['pending', 'investigating'] }
    });

    if (existingReport) {
      logger.warn(`[REPORT] Duplikasi laporan terdeteksi | ID Laporan: ${existingReport._id} | Status: ${existingReport.status}`);
      return {
        status: false,
        message: 'Kamu sudah melaporkan pemain ini dan laporan masih dalam proses'
      };
    }

    // Buat laporan baru
    const newReport = new Report({
      reporter: reporter._id,
      reportedPlayer: reportedPlayer._id,
      reason,
      category: validCategory
    });

    await newReport.save();
    
    logger.info(`[REPORT] Laporan berhasil dibuat | ID: ${newReport._id} | Pelapor: ${reporter.name} | Dilaporkan: ${reportedPlayer.name} | Kategori: ${validCategory}`);

    return {
      status: true,
      message: `Laporan terhadap ${reportedPlayer.name} telah dikirim. Admin akan meninjau laporan ini segera.`
    };
  } catch (error) {
    logger.error(`[REPORT] Error saat membuat laporan: ${error.message}`, { stack: error.stack });
    return {
      status: false,
      message: 'Terjadi kesalahan saat melaporkan pemain'
    };
  }
}

/**
 * Fungsi untuk melihat laporan yang dibuat pemain
 * @param {String} phoneNumber - Nomor telepon pemain
 * @returns {Object} - Daftar laporan atau pesan error
 */
async function viewMyReports(phoneNumber) {
  try {
    logger.info(`[REPORT] Melihat laporan milik pemain | Nomor: ${phoneNumber}`);
    
    if (!phoneNumber) {
      logger.warn(`[REPORT] Tidak ada nomor telepon untuk melihat laporan`);
      return {
        status: false,
        message: 'Nomor telepon diperlukan'
      };
    }

    // Cari player dengan utilitas ensurePlayerExists
    const player = await ensurePlayerExists(phoneNumber);
    
    if (!player) {
      logger.warn(`[REPORT] Pemain tidak terdaftar untuk melihat laporan | Nomor: ${phoneNumber}`);
      return {
        status: false,
        message: 'Kamu belum terdaftar sebagai pemain. Gunakan !daftar terlebih dahulu'
      };
    }
    
    logger.debug(`[REPORT] Pemain ditemukan untuk melihat laporan | ID: ${player._id} | Nama: ${player.name}`);

    const reports = await Report.findReportsByReporter(player._id);
    
    logger.info(`[REPORT] Ditemukan ${reports.length} laporan milik pemain | ID: ${player._id} | Nama: ${player.name}`);

    if (reports.length === 0) {
      return {
        status: true,
        message: 'Kamu belum membuat laporan apapun'
      };
    }

    let reportsList = 'Daftar Laporan yang Kamu Buat:\n\n';
    reports.forEach((report, index) => {
      reportsList += `${index + 1}. Laporan terhadap: ${report.reportedPlayer.name}\n`;
      reportsList += `   Alasan: ${report.reason}\n`;
      reportsList += `   Kategori: ${report.category}\n`;
      reportsList += `   Status: ${getStatusInIndonesian(report.status)}\n`;
      reportsList += `   Tanggal: ${new Date(report.createdAt).toLocaleDateString('id-ID')}\n`;
      
      if (report.status === 'resolved' || report.status === 'rejected') {
        reportsList += `   Komentar admin: ${report.adminComment || '-'}\n`;
      }
      
      if (index < reports.length - 1) {
        reportsList += '\n';
      }
    });

    return {
      status: true,
      message: reportsList
    };
  } catch (error) {
    logger.error(`[REPORT] Error saat melihat daftar laporan: ${error.message}`, { stack: error.stack });
    return {
      status: false,
      message: 'Terjadi kesalahan saat melihat daftar laporan'
    };
  }
}

/**
 * Fungsi untuk admin melihat semua laporan yang belum diselesaikan
 * @param {String} adminPhoneNumber - Nomor telepon admin
 * @returns {Object} - Daftar laporan atau pesan error
 */
async function viewPendingReports(adminPhoneNumber) {
  try {
    logger.info(`[REPORT] Admin mencoba melihat laporan yang belum diselesaikan | Admin: ${adminPhoneNumber}`);
    
    if (!adminPhoneNumber) {
      logger.warn(`[REPORT] Tidak ada nomor telepon admin untuk melihat laporan pending`);
      return {
        status: false,
        message: 'Nomor telepon admin diperlukan'
      };
    }

    // Pastikan admin terdaftar
    const admin = await ensurePlayerExists(adminPhoneNumber);
    
    if (!admin || admin.role !== 'admin') {
      logger.warn(`[REPORT] Akses ditolak untuk melihat laporan pending | Nomor: ${adminPhoneNumber} | Role: ${admin ? admin.role : 'tidak ditemukan'}`);
      return {
        status: false,
        message: 'Kamu tidak memiliki akses ke fungsi ini'
      };
    }
    
    logger.debug(`[REPORT] Admin terverifikasi | ID: ${admin._id} | Nama: ${admin.name}`);

    const pendingReports = await Report.findPendingReports();
    
    logger.info(`[REPORT] Ditemukan ${pendingReports.length} laporan pending`);

    if (pendingReports.length === 0) {
      return {
        status: true,
        message: 'Tidak ada laporan yang menunggu untuk ditinjau'
      };
    }

    let reportsList = 'Daftar Laporan yang Menunggu:\n\n';
    pendingReports.forEach((report, index) => {
      reportsList += `${index + 1}. ID: ${report._id}\n`;
      reportsList += `   Pelapor: ${report.reporter.name} (${report.reporter.phoneNumber})\n`;
      reportsList += `   Dilaporkan: ${report.reportedPlayer.name} (${report.reportedPlayer.phoneNumber})\n`;
      reportsList += `   Alasan: ${report.reason}\n`;
      reportsList += `   Kategori: ${report.category}\n`;
      reportsList += `   Status: ${getStatusInIndonesian(report.status)}\n`;
      reportsList += `   Tanggal: ${new Date(report.createdAt).toLocaleDateString('id-ID')}\n`;
      
      if (index < pendingReports.length - 1) {
        reportsList += '\n';
      }
    });

    return {
      status: true,
      message: reportsList
    };
  } catch (error) {
    logger.error(`[REPORT] Error saat melihat daftar laporan pending: ${error.message}`, { stack: error.stack });
    return {
      status: false,
      message: 'Terjadi kesalahan saat melihat daftar laporan'
    };
  }
}

/**
 * Fungsi untuk admin menangani laporan (menerima/menolak)
 * @param {String} adminPhoneNumber - Nomor telepon admin
 * @param {String} reportId - ID laporan
 * @param {String} action - Tindakan (resolve/reject)
 * @param {String} comment - Komentar admin
 * @returns {Object} - Status dan pesan
 */
async function handleReport(adminPhoneNumber, reportId, action, comment) {
  try {
    logger.info(`[REPORT] Admin mencoba menangani laporan | Admin: ${adminPhoneNumber} | ReportID: ${reportId} | Action: ${action}`);
    
    if (!adminPhoneNumber || !reportId || !action) {
      logger.warn(`[REPORT] Data tidak lengkap untuk menangani laporan`);
      return {
        status: false,
        message: 'Data tidak lengkap untuk menangani laporan'
      };
    }

    if (action !== 'resolve' && action !== 'reject') {
      logger.warn(`[REPORT] Tindakan tidak valid: ${action}`);
      return {
        status: false,
        message: 'Tindakan harus berupa "resolve" atau "reject"'
      };
    }

    // Pastikan admin terdaftar dan memiliki role admin
    const admin = await ensurePlayerExists(adminPhoneNumber);
    
    if (!admin || admin.role !== 'admin') {
      logger.warn(`[REPORT] Akses ditolak untuk menangani laporan | Nomor: ${adminPhoneNumber} | Role: ${admin ? admin.role : 'tidak ditemukan'}`);
      return {
        status: false,
        message: 'Kamu tidak memiliki akses ke fungsi ini'
      };
    }
    
    logger.debug(`[REPORT] Admin terverifikasi | ID: ${admin._id} | Nama: ${admin.name}`);

    // Cari laporan dengan ID
    const report = await Report.findById(reportId);
    
    if (!report) {
      logger.warn(`[REPORT] Laporan tidak ditemukan dengan ID: ${reportId}`);
      return {
        status: false,
        message: 'Laporan tidak ditemukan'
      };
    }
    
    if (report.status !== 'pending') {
      logger.warn(`[REPORT] Laporan sudah diselesaikan | ID: ${reportId} | Status: ${report.status}`);
      return {
        status: false,
        message: `Laporan ini sudah ${getStatusInIndonesian(report.status)}`
      };
    }
    
    logger.debug(`[REPORT] Laporan ditemukan | ID: ${reportId} | Pelapor: ${report.reporter.name} | Dilaporkan: ${report.reportedPlayer.name}`);

    // Update status laporan
    report.status = action === 'resolve' ? 'resolved' : 'rejected';
    report.adminComment = comment || '';
    report.resolvedBy = admin._id;
    report.resolvedAt = new Date();
    
    await report.save();
    
    logger.info(`[REPORT] Laporan berhasil ditangani | ID: ${reportId} | Status: ${report.status} | Admin: ${admin.name}`);

    let actionText = action === 'resolve' ? 'diterima' : 'ditolak';
    
    return {
      status: true,
      message: `Laporan berhasil ${actionText}${comment ? ` dengan komentar: ${comment}` : ''}`
    };
  } catch (error) {
    logger.error(`[REPORT] Error saat menangani laporan: ${error.message}`, { stack: error.stack });
    return {
      status: false,
      message: 'Terjadi kesalahan saat menangani laporan'
    };
  }
}

/**
 * Fungsi untuk menerjemahkan status ke dalam bahasa Indonesia
 * @param {String} status - Status dalam bahasa Inggris
 * @returns {String} - Status dalam bahasa Indonesia
 */
function getStatusInIndonesian(status) {
  const statusMap = {
    'pending': 'Menunggu',
    'investigating': 'Sedang Diinvestigasi',
    'resolved': 'Diselesaikan',
    'rejected': 'Ditolak'
  };
  
  return statusMap[status] || status;
}

/**
 * Fungsi untuk mendapatkan statistik laporan
 * @param {String} adminPhoneNumber - Nomor telepon admin
 * @returns {Object} - Statistik laporan atau pesan error
 */
async function getReportStatistics(adminPhoneNumber) {
  try {
    logger.info(`[REPORT] Admin meminta statistik laporan | Admin: ${adminPhoneNumber}`);
    
    if (!adminPhoneNumber) {
      logger.warn(`[REPORT] Tidak ada nomor telepon admin untuk statistik laporan`);
      return {
        status: false,
        message: 'Nomor telepon admin diperlukan'
      };
    }

    // Cek apakah admin
    const admin = await Player.findPlayerByPhoneNumber(adminPhoneNumber);
    if (!admin || admin.role !== 'admin') {
      logger.warn(`[REPORT] Akses ditolak untuk statistik laporan | Nomor: ${adminPhoneNumber} | Role: ${admin ? admin.role : 'tidak ditemukan'}`);
      return {
        status: false,
        message: 'Kamu tidak memiliki akses ke fungsi ini'
      };
    }
    
    logger.debug(`[REPORT] Admin terverifikasi untuk statistik | ID: ${admin._id} | Nama: ${admin.name}`);

    // Hitung statistik
    const totalReports = await Report.countDocuments();
    const pendingReports = await Report.countDocuments({ status: 'pending' });
    const investigatingReports = await Report.countDocuments({ status: 'investigating' });
    const resolvedReports = await Report.countDocuments({ status: 'resolved' });
    const rejectedReports = await Report.countDocuments({ status: 'rejected' });
    
    // Statistik kategori
    const harassmentReports = await Report.countDocuments({ category: 'harassment' });
    const cheatingReports = await Report.countDocuments({ category: 'cheating' });
    const scammingReports = await Report.countDocuments({ category: 'scamming' });
    const otherReports = await Report.countDocuments({ category: 'other' });
    
    // Statistik waktu
    const lastWeekDate = new Date();
    lastWeekDate.setDate(lastWeekDate.getDate() - 7);
    
    const reportsLastWeek = await Report.countDocuments({
      createdAt: { $gte: lastWeekDate }
    });
    
    // Statistik pemain
    const distinctReporters = await Report.distinct('reporter');
    const distinctReportedPlayers = await Report.distinct('reportedPlayer');
    
    // Hitung rata-rata waktu penyelesaian laporan
    const resolvedReportsWithTime = await Report.find({
      status: 'resolved',
      resolvedAt: { $exists: true, $ne: null }
    });
    
    let avgResolutionTimeHours = 0;
    
    if (resolvedReportsWithTime.length > 0) {
      let totalResolutionTime = 0;
      
      resolvedReportsWithTime.forEach(report => {
        const createdTime = new Date(report.createdAt).getTime();
        const resolvedTime = new Date(report.resolvedAt).getTime();
        const resolutionTimeHours = (resolvedTime - createdTime) / (1000 * 60 * 60);
        totalResolutionTime += resolutionTimeHours;
      });
      
      avgResolutionTimeHours = totalResolutionTime / resolvedReportsWithTime.length;
    }
    
    logger.info(`[REPORT] Statistik laporan berhasil dihitung | Total: ${totalReports} | Pending: ${pendingReports} | Diselesaikan: ${resolvedReports}`);

    // Format pesan respons
    const message = 
`📊 *STATISTIK LAPORAN* 📊

*Status Laporan:*
- Total Laporan: ${totalReports}
- Menunggu: ${pendingReports}
- Diinvestigasi: ${investigatingReports}
- Diselesaikan: ${resolvedReports}
- Ditolak: ${rejectedReports}

*Kategori Laporan:*
- Pelecehan/Bullying: ${harassmentReports}
- Kecurangan: ${cheatingReports}
- Penipuan: ${scammingReports}
- Lainnya: ${otherReports}

*Aktivitas Pelaporan:*
- Laporan 7 Hari Terakhir: ${reportsLastWeek}
- Jumlah Pelapor Unik: ${distinctReporters.length}
- Jumlah Pemain Dilaporkan: ${distinctReportedPlayers.length}
- Rata-rata Waktu Penyelesaian: ${avgResolutionTimeHours.toFixed(1)} jam

Gunakan !admin viewreports untuk melihat laporan yang perlu ditangani.
`;

    return {
      status: true,
      message
    };
  } catch (error) {
    logger.error(`[REPORT] Error saat mendapatkan statistik laporan: ${error.message}`, { stack: error.stack });
    return {
      status: false,
      message: 'Terjadi kesalahan saat mendapatkan statistik laporan'
    };
  }
}

module.exports = {
  reportPlayer,
  viewMyReports,
  viewPendingReports,
  handleReport,
  getReportStatistics
}; 