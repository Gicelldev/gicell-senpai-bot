const mongoose = require('mongoose');
const logger = require('./utils/logger');

const connectToDatabase = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gicell-senpai';
    
    // Opsi koneksi
    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    };
    
    // Koneksi ke MongoDB
    await mongoose.connect(mongoURI, options);
    
    // Log koneksi berhasil
    logger.info(`MongoDB connected: ${mongoURI}`);
    
    // Log error jika terjadi
    mongoose.connection.on('error', (err) => {
      logger.error(`MongoDB connection error: ${err}`);
    });
    
    // Log jika koneksi terputus
    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });
    
    // Log jika koneksi tersambung kembali
    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
    });
    
    // Handle jika proses aplikasi berhenti
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      logger.info('MongoDB connection closed due to app termination');
      process.exit(0);
    });
    
    return mongoose.connection;
  } catch (error) {
    logger.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

module.exports = { 
  connectToDatabase,
  mongoose
}; 