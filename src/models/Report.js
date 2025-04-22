const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ReportSchema = new Schema({
  reporter: {
    type: Schema.Types.ObjectId,
    ref: 'Player',
    required: true
  },
  reportedPlayer: {
    type: Schema.Types.ObjectId,
    ref: 'Player',
    required: true
  },
  reason: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    enum: ['harassment', 'cheating', 'scamming', 'other'],
    default: 'other'
  },
  status: {
    type: String,
    enum: ['pending', 'investigating', 'resolved', 'rejected'],
    default: 'pending'
  },
  adminComment: {
    type: String,
    trim: true
  },
  resolvedBy: {
    type: String,
    trim: true
  },
  resolvedAt: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Metode statis untuk menemukan laporan yang belum diselesaikan
ReportSchema.statics.findPendingReports = function() {
  return this.find({ status: { $ne: 'resolved' } })
    .populate('reporter', 'name phoneNumber')
    .populate('reportedPlayer', 'name phoneNumber')
    .sort({ createdAt: -1 });
};

// Metode statis untuk menemukan laporan berdasarkan ID
ReportSchema.statics.findReportById = function(reportId) {
  return this.findById(reportId)
    .populate('reporter', 'name phoneNumber')
    .populate('reportedPlayer', 'name phoneNumber');
};

// Metode statis untuk menemukan laporan dari pemain tertentu
ReportSchema.statics.findReportsByReporter = function(playerId) {
  return this.find({ reporter: playerId })
    .populate('reportedPlayer', 'name')
    .sort({ createdAt: -1 });
};

// Metode statis untuk menemukan laporan terhadap pemain tertentu
ReportSchema.statics.findReportsAgainstPlayer = function(playerId) {
  return this.find({ reportedPlayer: playerId })
    .populate('reporter', 'name')
    .sort({ createdAt: -1 });
};

const Report = mongoose.model('Report', ReportSchema);

module.exports = Report; 