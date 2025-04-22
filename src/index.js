require('dotenv').config();
const { connectToWhatsApp } = require('./whatsapp');
const { connectToDatabase } = require('./database');
const logger = require('./utils/logger');
const express = require('express');
const adminRoutes = require('./routes/admin');
const { seedDatabase } = require('./utils/seedDatabase');

// Inisialisasi Express untuk admin dashboard
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/admin', adminRoutes);

// Home route
app.get('/', (req, res) => {
  res.send('Gicell Senpai Bot Server Running');
});

// Koneksi ke database
connectToDatabase()
  .then(async () => {
    logger.info('Connected to MongoDB database');
    
    // Seed database jika diperlukan
    try {
      await seedDatabase();
    } catch (err) {
      logger.error('Error seeding database:', err);
    }
    
    // Jalankan server Express
    app.listen(PORT, () => {
      logger.info(`Admin dashboard running on port ${PORT}`);
    });
    
    // Koneksi ke WhatsApp
    connectToWhatsApp()
      .then(() => {
        logger.info('WhatsApp connection initialized');
      })
      .catch(err => {
        logger.error('Error connecting to WhatsApp:', err);
      });
  })
  .catch(err => {
    logger.error('Error connecting to database:', err);
    process.exit(1);
  });

// Handle process termination
process.on('SIGINT', async () => {
  logger.info('Shutting down server...');
  process.exit(0);
});

// Handle unhandled errors
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Rejection:', err);
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
}); 