// Script untuk menambahkan quest dasar ke database
require('dotenv').config({ path: `${__dirname}/../.env` });
const mongoose = require('mongoose');
const { Quest } = require('../src/models/Quest');
const logger = require('../src/utils/logger');

console.log('MongoDB URI:', process.env.MONGODB_URI);

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

// Data quest dasar yang akan ditambahkan
const basicQuests = [
  // Daily Quests Level 1
  {
    title: 'Pengumpul Kayu',
    description: 'Kumpulkan kayu untuk kebutuhan desa',
    type: 'daily',
    level: 1,
    requirements: [
      {
        type: 'gather',
        target: 'simple_logs',
        quantity: 10,
        description: 'Kumpulkan 10 Simple Logs'
      }
    ],
    rewards: [
      {
        type: 'experience',
        quantity: 50,
        description: '50 EXP'
      },
      {
        type: 'gmoney',
        quantity: 25,
        description: '25 GMoney'
      }
    ],
    timeLimit: 24,
    isActive: true
  },
  {
    title: 'Latihan Berburu',
    description: 'Kalahkan monster lemah untuk melatih kemampuan bertarung',
    type: 'daily',
    level: 1,
    requirements: [
      {
        type: 'combat',
        target: 'slime',
        quantity: 5,
        description: 'Kalahkan 5 Slime'
      }
    ],
    rewards: [
      {
        type: 'experience',
        quantity: 75,
        description: '75 EXP'
      },
      {
        type: 'gmoney',
        quantity: 30,
        description: '30 GMoney'
      }
    ],
    timeLimit: 24,
    isActive: true
  },
  
  // Daily Quests Level 5
  {
    title: 'Permintaan Batu',
    description: 'Kumpulkan batu untuk perbaikan bangunan desa',
    type: 'daily',
    level: 5,
    requirements: [
      {
        type: 'gather',
        target: 'simple_ore',
        quantity: 15,
        description: 'Kumpulkan 15 Simple Ore'
      }
    ],
    rewards: [
      {
        type: 'experience',
        quantity: 100,
        description: '100 EXP'
      },
      {
        type: 'gmoney',
        quantity: 50,
        description: '50 GMoney'
      }
    ],
    timeLimit: 24,
    isActive: true
  },
  {
    title: 'Pemburu Goblin',
    description: 'Kalahkan goblin yang mengganggu para petani',
    type: 'daily',
    level: 5,
    requirements: [
      {
        type: 'combat',
        target: 'goblin',
        quantity: 7,
        description: 'Kalahkan 7 Goblin'
      }
    ],
    rewards: [
      {
        type: 'experience',
        quantity: 150,
        description: '150 EXP'
      },
      {
        type: 'gmoney',
        quantity: 75,
        description: '75 GMoney'
      }
    ],
    timeLimit: 24,
    isActive: true
  },
  
  // Weekly Quests
  {
    title: 'Pembersihan Dungeon',
    description: 'Bersihkan dungeon hutan dari monster yang mengancam',
    type: 'weekly',
    level: 3,
    requirements: [
      {
        type: 'combat',
        target: 'any',
        quantity: 20,
        description: 'Kalahkan 20 monster apa saja'
      }
    ],
    rewards: [
      {
        type: 'experience',
        quantity: 300,
        description: '300 EXP'
      },
      {
        type: 'gmoney',
        quantity: 150,
        description: '150 GMoney'
      },
      {
        type: 'item',
        itemId: 'health_potion',
        quantity: 3,
        description: '3 Health Potion'
      }
    ],
    timeLimit: 168, // 7 hari dalam jam
    isActive: true
  },
  {
    title: 'Pengrajin Pedang',
    description: 'Buktikan keahlianmu dalam menempa senjata',
    type: 'weekly',
    level: 10,
    requirements: [
      {
        type: 'craft',
        target: 'any_weapon',
        quantity: 3,
        description: 'Buat 3 senjata apa saja'
      }
    ],
    rewards: [
      {
        type: 'experience',
        quantity: 400,
        description: '400 EXP'
      },
      {
        type: 'gmoney',
        quantity: 200,
        description: '200 GMoney'
      },
      {
        type: 'item',
        itemId: 'journeyman_ore',
        quantity: 5,
        description: '5 Journeyman Ore'
      }
    ],
    timeLimit: 168, // 7 hari dalam jam
    isActive: true
  }
];

// Fungsi untuk menambahkan quest ke database
async function populateQuests() {
  try {
    // Cek jumlah quest yang sudah ada
    const existingCount = await Quest.countDocuments();
    console.log(`Jumlah quest yang sudah ada dalam database: ${existingCount}`);
    
    if (existingCount > 0) {
      const proceed = await promptYesNo('Quest sudah ada dalam database. Tetap lanjutkan?');
      if (!proceed) {
        console.log('Operasi dibatalkan.');
        process.exit(0);
      }
    }
    
    // Tambahkan quest ke database
    let addedCount = 0;
    for (const questData of basicQuests) {
      try {
        // Periksa apakah quest serupa sudah ada
        const existingQuest = await Quest.findOne({
          title: questData.title,
          type: questData.type,
          level: questData.level
        });
        
        if (existingQuest) {
          console.log(`Quest "${questData.title}" sudah ada, melewati...`);
          continue;
        }
        
        const quest = new Quest(questData);
        await quest.save();
        console.log(`Berhasil menambahkan quest: ${questData.title}`);
        addedCount++;
      } catch (error) {
        console.error(`Gagal menambahkan quest "${questData.title}":`, error.message);
      }
    }
    
    console.log(`\nProses selesai. ${addedCount} quest berhasil ditambahkan.`);
  } catch (error) {
    console.error('Terjadi kesalahan:', error);
  } finally {
    // Tutup koneksi database
    mongoose.connection.close();
    console.log('Koneksi database ditutup.');
    process.exit(0);
  }
}

// Fungsi untuk prompt yes/no
function promptYesNo(question) {
  return new Promise((resolve) => {
    console.log(`${question} (y/n)`);
    process.stdin.once('data', (data) => {
      const answer = data.toString().trim().toLowerCase();
      resolve(answer === 'y' || answer === 'yes');
    });
  });
}

// Jalankan fungsi
console.log('Menambahkan quest dasar ke database...');
populateQuests();
