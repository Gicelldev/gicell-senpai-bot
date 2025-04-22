// Script untuk menambahkan item baru ke database dari file template
require('dotenv').config({ path: '../.env' });
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Item = require('../src/models/Item');

// Hubungkan ke database MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('Terhubung ke MongoDB'))
.catch(err => {
  console.error('Gagal terhubung ke MongoDB:', err);
  process.exit(1);
});

async function addNewItems() {
  try {
    // Baca file template item baru
    const templatePath = path.join(__dirname, '../src/data/new_items_template.json');
    const itemsData = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
    
    console.log(`Ditemukan ${itemsData.length} item untuk ditambahkan.`);
    
    // Array untuk melacak hasil
    const results = {
      added: [],
      existed: [],
      failed: []
    };
    
    // Proses setiap item
    for (const itemData of itemsData) {
      try {
        // Periksa apakah item sudah ada di database
        const existingItem = await Item.findOne({ itemId: itemData.itemId });
        
        if (existingItem) {
          console.log(`Item dengan ID ${itemData.itemId} sudah ada di database.`);
          results.existed.push(itemData.itemId);
          continue;
        }
        
        // Buat item baru
        const newItem = new Item(itemData);
        await newItem.save();
        
        console.log(`Item baru berhasil ditambahkan: ${itemData.name} (${itemData.itemId})`);
        results.added.push(itemData.itemId);
      } catch (itemError) {
        console.error(`Gagal menambahkan item ${itemData.itemId}:`, itemError.message);
        results.failed.push({
          itemId: itemData.itemId,
          error: itemError.message
        });
      }
    }
    
    // Tampilkan ringkasan hasil
    console.log('\nRingkasan Hasil:');
    console.log(`- Item berhasil ditambahkan: ${results.added.length}`);
    console.log(`- Item sudah ada di database: ${results.existed.length}`);
    console.log(`- Item gagal ditambahkan: ${results.failed.length}`);
    
    if (results.failed.length > 0) {
      console.log('\nDetail item yang gagal ditambahkan:');
      results.failed.forEach(item => {
        console.log(`- ${item.itemId}: ${item.error}`);
      });
    }
  } catch (error) {
    console.error('Terjadi kesalahan:', error);
  } finally {
    // Tutup koneksi database
    mongoose.connection.close();
    console.log('Koneksi database ditutup.');
  }
}

// Jalankan fungsi
addNewItems();
