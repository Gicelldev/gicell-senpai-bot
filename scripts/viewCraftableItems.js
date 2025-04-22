// Script untuk menampilkan daftar item yang bisa di-craft dari file new_items_template.json
require('dotenv').config({ path: '../.env' });
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

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

async function viewCraftableItems() {
  try {
    // Baca file template item baru
    const templatePath = path.join(__dirname, '../src/data/new_items_template.json');
    const itemsData = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
    
    console.log(`Ditemukan ${itemsData.length} item dalam file template.`);
    
    // Filter item yang bisa di-craft (memiliki craftingRequirements)
    const craftableItems = itemsData.filter(item => 
      item.craftingRequirements && item.craftingRequirements.length > 0
    );
    
    console.log(`\nJumlah item yang bisa di-craft: ${craftableItems.length}`);
    
    // Kategorikan berdasarkan tipe
    const categorizedItems = {
      weapon: [],
      armor: [],
      consumable: [],
      resource: []
    };
    
    craftableItems.forEach(item => {
      if (item.type in categorizedItems) {
        categorizedItems[item.type].push(item);
      }
    });
    
    // Tampilkan item berdasarkan kategori
    console.log('\n=== CRAFTABLE ITEMS ===');
    
    for (const [category, items] of Object.entries(categorizedItems)) {
      if (items.length > 0) {
        console.log(`\n--- ${category.toUpperCase()} (${items.length}) ---`);
        
        // Urutkan berdasarkan tier dan level
        items.sort((a, b) => {
          if (a.tier !== b.tier) return a.tier - b.tier;
          return a.requiredLevel - b.requiredLevel;
        });
        
        items.forEach(item => {
          console.log(`${item.name} (${item.itemId})`);
          console.log(`  Tier: ${item.tier}, Required Level: ${item.requiredLevel}`);
          
          // Tampilkan info stats
          if (item.stats) {
            const statsInfo = Object.entries(item.stats)
              .map(([key, value]) => `${key}: ${value}`)
              .join(', ');
            
            if (statsInfo) {
              console.log(`  Stats: ${statsInfo}`);
            }
          }
          
          // Tampilkan requirements
          console.log('  Requirements:');
          item.craftingRequirements.forEach(req => {
            console.log(`    - ${req.itemId}: ${req.quantity}`);
          });
          
          console.log(); // Baris kosong untuk memisahkan item
        });
      }
    }
    
    // Tampilkan ringkasan
    console.log('\n=== RINGKASAN ===');
    console.log(`Total item yang bisa di-craft: ${craftableItems.length}`);
    for (const [category, items] of Object.entries(categorizedItems)) {
      console.log(`- ${category}: ${items.length} item`);
    }
    
  } catch (error) {
    console.error('Terjadi kesalahan:', error);
  } finally {
    // Tutup koneksi database
    mongoose.connection.close();
    console.log('\nKoneksi database ditutup.');
  }
}

// Jalankan fungsi
viewCraftableItems();
