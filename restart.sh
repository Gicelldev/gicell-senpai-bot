#!/bin/bash

# Script untuk me-restart aplikasi WhatsApp Bot

echo "Memulai proses restart Gicell Senpai WhatsApp Bot..."

# Periksa apakah bot berjalan dengan PM2
if pm2 list | grep -q "whatsapp-bot"; then
  echo "Menghentikan aplikasi yang sedang berjalan..."
  pm2 stop whatsapp-bot
else
  echo "Bot tidak ditemukan dalam daftar PM2, akan memulai baru..."
fi

# Install dependencies jika ada perubahan
echo "Memastikan dependencies terpasang..."
npm install

# Mulai atau restart aplikasi
echo "Memulai aplikasi..."
if pm2 list | grep -q "whatsapp-bot"; then
  pm2 restart whatsapp-bot
else
  pm2 start src/index.js --name whatsapp-bot
fi

echo "Menampilkan log terbaru..."
pm2 logs whatsapp-bot --lines 20

echo "Proses restart selesai!" 