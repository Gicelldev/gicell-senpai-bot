const logger = require('../utils/logger');

/**
 * Mendapatkan informasi bantuan
 * @param {String} command - Command yang ingin dilihat (opsional)
 * @returns {Object} - Status dan pesan respons
 */
const getHelp = async (command) => {
  try {
    // Jika ada command spesifik, tampilkan bantuan untuk command tersebut
    if (command) {
      return getCommandHelp(command);
    }
    
    // Daftar perintah yang tersedia
    const helpMessage = 
`📖 *GICELL SENPAI BOT - BANTUAN* 📖

*⚔️ PERINTAH DASAR ⚔️*
!daftar [nama]     - Daftar sebagai pemain baru
!profil            - Lihat profil karakter
!inventory         - Lihat inventory lengkap
!help / !bantuan   - Menampilkan bantuan ini

*🌲 GATHERING & CRAFTING 🌲*
!gather [resource] - Kumpulkan resource (kayu, batu, ore, fiber, hide)
!craft [item]      - Buat item dari resource
!craftlist         - Lihat daftar item yang dapat di-craft
!craftinfo [item]  - Lihat detail crafting untuk item
!equip [item]      - Gunakan equipment
!unequip [slot]    - Lepaskan equipment (weapon, head, chest, legs, boots)

*⚔️ PERTARUNGAN ⚔️*
!serang [target]   - Serang monster atau pemain
!dungeon           - Lihat daftar dungeon tersedia
!dungeon masuk [nama] - Masuk ke dungeon
!heal [item]       - Gunakan potion untuk menyembuhkan

*🏙️ ZONA & PERJALANAN 🏙️*
!zone              - Informasi zona saat ini
!travel [zona]     - Berpindah zona (safe, yellow, red, black)

*💰 EKONOMI 💰*
!pasar             - Lihat marketplace
!jual [item] [harga] [jumlah] - Jual item di pasar
!beli [id] [jumlah] - Beli item dari pasar
!pasar batal [id]  - Batalkan listing anda

*🎮 JUDI & KASINO 🎮*
!belichip [jumlah] - Beli chip untuk judi
!jualchip [jumlah] - Jual chip untuk Gmoney
!dadu [chip] [pilihan] - Main judi dadu (ganjil/genap/1-6)
!slot [chip]       - Main judi slot

*🏰 GUILD SYSTEM 🏰*
!guild             - Informasi guild
!guild buat [nama] - Buat guild baru (biaya: 50000 Gmoney)
!guild gabung [nama] - Gabung dengan guild
!guild keluar      - Keluar dari guild

*📜 QUEST & AKTIVITAS 📜*
!quest             - Lihat quest aktif
!quest harian      - Lihat quest harian
!quest mingguan    - Lihat quest mingguan
!quest klaim [id]  - Klaim hadiah quest

*💬 CHAT & NOTIFIKASI 💬*
!kirim [pemain] [pesan] - Kirim pesan ke pemain lain
!pesan             - Lihat pesan yang belum dibaca
!baca [pemain]     - Baca riwayat chat dengan pemain
!notifikasi        - Lihat notifikasi

*🚨 PELAPORAN PEMAIN 🚨*
!lapor [nomor] [alasan] - Laporkan pemain yang melanggar aturan
!laporanku         - Lihat laporan yang telah Anda buat
!admin viewreports - Lihat laporan menunggu (admin)
!admin resolve [id] [aksi] [komentar] - Tangani laporan (admin)


*🎮 GAME INFO 🎮*
Bot WhatsApp berbasis game Gicell Senpai ini dibuat oleh Gicell Senpai Developer.
`;

    return {
      status: true,
      message: helpMessage
    };
  } catch (error) {
    logger.error(`Error getting help: ${error.message}`);
    return {
      status: false,
      message: 'Terjadi kesalahan saat mendapatkan bantuan.'
    };
  }
};

/**
 * Mendapatkan bantuan spesifik untuk satu perintah
 * @param {String} command - Perintah yang ingin dilihat bantuannya
 * @returns {Object} - Status dan pesan respons
 */
const getCommandHelp = async (command) => {
  try {
    let helpMessage = '';
    
    // Bantuan untuk setiap perintah
    switch (command.toLowerCase()) {
      case 'daftar':
        helpMessage = 
`📖 *BANTUAN: !daftar* 📖

Perintah ini digunakan untuk mendaftarkan akun baru di game.

*Penggunaan:*
!daftar [nama_karakter]

*Contoh:*
!daftar WarriorKeren

*Catatan:*
- Nama karakter harus antara 3-20 karakter
- Nama karakter harus unik
- Anda akan mendapatkan equipment starter dan ${process.env.INITIAL_GMONEY || 1000} Gmoney
`;
        break;
        
      case 'gather':
      case 'kumpul':
        helpMessage = 
`📖 *BANTUAN: !gather* 📖

Perintah ini digunakan untuk mengumpulkan resource di dunia game.

*Penggunaan:*
!gather [jenis_resource]

*Jenis Resource:*
- kayu / wood
- batu / stone
- ore
- fiber
- hide

*Contoh:*
!gather kayu
!gather ore

*Catatan:*
- Skill gathering meningkat saat mengumpulkan resource
- Tier resource bergantung pada level skill gathering
- Zona berbahaya memiliki kesempatan mendapatkan rare drop
`;
        break;
        
      case 'craft':
      case 'buat':
        helpMessage = 
`📖 *BANTUAN: !craft* 📖

Perintah ini digunakan untuk membuat item dari resource.

*Penggunaan:*
!craft [nama_item]

*Contoh:*
!craft wooden_sword
!craft leather_boots

*Catatan:*
- Anda harus memiliki resource yang cukup
- Skill crafting meningkat saat membuat item
- Item dengan tier lebih tinggi membutuhkan skill yang lebih tinggi
- Gunakan !craftlist untuk melihat daftar item yang dapat di-craft
- Gunakan !craftinfo [item] untuk melihat detail crafting
`;
        break;
        
      case 'craftlist':
        helpMessage = 
`📖 *BANTUAN: !craftlist* 📖

Perintah ini digunakan untuk melihat daftar item yang dapat di-craft pada level Anda.

*Penggunaan:*
!craftlist

*Catatan:*
- Hanya menampilkan item sesuai level Anda
- Item dikelompokkan berdasarkan kategori (weapon, armor, consumable)
- Menampilkan tier dan level yang dibutuhkan untuk setiap item
- Gunakan !craftinfo [item] untuk melihat detail crafting dan resource yang dibutuhkan
`;
        break;
        
      case 'craftinfo':
        helpMessage = 
`📖 *BANTUAN: !craftinfo* 📖

Perintah ini digunakan untuk melihat detail crafting untuk item tertentu.

*Penggunaan:*
!craftinfo [nama_item]

*Contoh:*
!craftinfo wooden_sword
!craftinfo leather_boots

*Catatan:*
- Menampilkan tier dan level yang dibutuhkan
- Menampilkan statistik item (damage/defense)
- Menampilkan daftar resource yang dibutuhkan dan jumlah yang Anda miliki
- Menampilkan status apakah Anda dapat membuat item tersebut atau tidak
`;
        break;
        
      case 'pasar':
      case 'market':
        helpMessage = 
`📖 *BANTUAN: !pasar* 📖

Perintah ini digunakan untuk mengakses marketplace.

*Penggunaan:*
!pasar - Melihat semua listing
!pasar [kategori] - Melihat listing berdasarkan kategori
!pasar batal [id] - Membatalkan listing milik Anda

*Kategori yang tersedia:*
- weapon/senjata
- armor/baju
- resource
- consumable/konsumable

*Contoh:*
!pasar
!pasar weapon
!pasar batal 5f7b1c3d4e2a1b0e8f9d0c2a

*Catatan:*
- Anda dapat melihat listing milik Anda di menu utama pasar
- Harga per unit ditampilkan untuk memudahkan perbandingan
- ID listing diperlukan saat membeli atau membatalkan listing
`;
        break;
        
      case 'jual':
      case 'sell':
        helpMessage = 
`📖 *BANTUAN: !jual* 📖

Perintah ini digunakan untuk menjual item di marketplace.

*Penggunaan:*
!jual [item_id] [harga] [jumlah]

*Contoh:*
!jual wooden_sword 100 1
!jual rough_logs 5 50

*Catatan:*
- Jumlah opsional, default: 1
- Item akan tetap di inventory sampai terjual
- Anda dapat membatalkan listing dengan !pasar batal [id]
`;
        break;
        
      case 'beli':
      case 'buy':
        helpMessage = 
`📖 *BANTUAN: !beli* 📖

Perintah ini digunakan untuk membeli item dari marketplace.

*Penggunaan:*
!beli [id_listing] [jumlah]

*Contoh:*
!beli 5f7b1c3d4e2a1b0e8f9d0c2a 3
!beli 5f7b1c3d4e2a1b0e8f9d0c2a

*Catatan:*
- Jumlah adalah opsional (default: semua)
- Anda perlu melihat ID listing dengan !pasar atau !pasar [kategori]
- Anda tidak dapat membeli listing milik Anda sendiri
- Gmoney akan dikurangi dari akun Anda dan ditambahkan ke penjual
`;
        break;
        
      case 'serang':
      case 'attack':
        helpMessage = 
`📖 *BANTUAN: !serang* 📖

Perintah ini digunakan untuk menyerang monster atau pemain lain.

*Penggunaan:*
!serang [monster]
!serang @[nama_pemain]

*Contoh:*
!serang wolf
!serang @EnemyPlayer

*Monster berdasarkan zona:*
- Safe: wolf, boar, bandit
- Yellow: dire_wolf, rogue, skeleton
- Red: troll, golem
- Black: dragon, necromancer

*Catatan:*
- Damage bergantung pada stats dan equipment Anda
- PvP hanya dapat dilakukan di zona non-safe
- Jika menang mendapatkan EXP, Gmoney, dan item
- Jika kalah kehilangan HP dan sedikit Gmoney
`;
        break;
        
      case 'heal':
      case 'sembuh':
        helpMessage = 
`📖 *BANTUAN: !heal* 📖

Perintah ini digunakan untuk menyembuhkan HP dengan potion.

*Penggunaan:*
!heal [item]

*Contoh:*
!heal minor_healing_potion

*Catatan:*
- Item harus berupa consumable dengan efek penyembuhan
- Item akan dihapus dari inventory saat digunakan
- HP tidak dapat melebihi max HP
- HP yang kurang diperlukan untuk bertarung
`;
        break;
        
      case 'guild':
        helpMessage = 
`📖 *BANTUAN: !guild* 📖

Perintah ini digunakan untuk mengelola guild.

*Penggunaan:*
!guild - Melihat informasi guild
!guild buat [nama] - Membuat guild baru (biaya: 50000 Gmoney)
!guild gabung [nama] - Bergabung dengan guild
!guild keluar - Keluar dari guild
!guild invite [pemain] - Mengundang pemain (officer/leader only)
!guild kick [pemain] - Mengeluarkan pemain (officer/leader only)
!guild promote [pemain] - Mempromosikan anggota (leader only)

*Contoh:*
!guild buat EliteWarriors
!guild gabung EliteWarriors

*Catatan:*
- Guild memiliki treasury untuk menyimpan resource bersama
- Guild dapat memiliki territory di zona berbahaya
- Guild memungkinkan pemain untuk bekerja sama dalam PvP
`;
        break;

      case 'kirim':
        helpMessage = 
`📖 *BANTUAN: !kirim* 📖

Perintah ini digunakan untuk mengirim pesan kepada pemain lain.

*Penggunaan:*
!kirim [nama_pemain] [pesan]

*Contoh:*
!kirim WarriorKeren Halo, apa kabar?

*Catatan:*
- Pesan tidak boleh kosong
- Maksimal 500 karakter
- Pemain akan menerima notifikasi pesan baru
- Gunakan !pesan untuk melihat pesan masuk
`;
        break;

      case 'pesan':
        helpMessage = 
`📖 *BANTUAN: !pesan* 📖

Perintah ini digunakan untuk melihat pesan yang belum dibaca.

*Penggunaan:*
!pesan

*Catatan:*
- Menampilkan semua pesan yang belum dibaca
- Pesan akan ditandai sebagai sudah dibaca
- Gunakan !baca [nama_pemain] untuk melihat riwayat chat dengan pemain tertentu
`;
        break;

      case 'baca':
        helpMessage = 
`📖 *BANTUAN: !baca* 📖

Perintah ini digunakan untuk melihat riwayat chat dengan pemain tertentu.

*Penggunaan:*
!baca [nama_pemain]

*Contoh:*
!baca WarriorKeren

*Catatan:*
- Menampilkan 10 pesan terakhir dengan pemain tersebut
- Pesan akan diurutkan dari yang terlama hingga terbaru
- Pesan dari pemain tersebut akan ditandai sebagai sudah dibaca
`;
        break;

      case 'notifikasi':
      case 'notif':
        helpMessage = 
`📖 *BANTUAN: !notifikasi* 📖

Perintah ini digunakan untuk melihat notifikasi yang belum dibaca.

*Penggunaan:*
!notifikasi
!notif

*Catatan:*
- Menampilkan semua notifikasi yang belum dibaca
- Notifikasi akan ditandai sebagai sudah dibaca
- Notifikasi mencakup aktivitas game, quest, guild, dll.
`;
        break;

      case 'lapor':
        helpMessage = 
`📖 *BANTUAN: !lapor* 📖

Perintah ini digunakan untuk melaporkan pemain yang melanggar aturan.

*Penggunaan:*
!lapor [nomor_telepon] [alasan]

*Contoh:*
!lapor 628123456789 Menggunakan kata-kata kasar

*Catatan:*
- Nomor telepon harus valid
- Berikan alasan yang jelas
- Laporan akan ditinjau oleh tim admin
- Penyalahgunaan sistem pelaporan dapat dikenakan sanksi
`;
        break;

      case 'laporanku':
        helpMessage = 
`📖 *BANTUAN: !laporanku* 📖

Perintah ini digunakan untuk melihat laporan yang telah Anda buat.

*Penggunaan:*
!laporanku

*Catatan:*
- Menampilkan semua laporan yang pernah Anda buat
- Termasuk status laporan (pending, investigating, resolved, rejected)
- Berguna untuk mengecek update dari laporan Anda
`;
        break;

      case 'laporanpending':
        helpMessage = 
`📖 *BANTUAN: !laporanpending* 📖

Perintah ini digunakan untuk melihat laporan yang menunggu untuk ditangani.

*Penggunaan:*
!laporanpending

*Catatan:*
- Hanya dapat diakses oleh admin
- Menampilkan laporan dengan status pending
- Termasuk informasi pelapor, dilaporkan, alasan, dan waktu laporan

*Alternatif:*
!admin viewreports - Perintah admin yang resmi untuk melihat laporan pending
`;
        break;

      case 'tanganilaporon':
        helpMessage = 
`📖 *BANTUAN: !tanganilaporon* 📖

Perintah ini digunakan untuk menangani laporan pemain.

*Penggunaan:*
!tanganilaporon [id_laporan] [resolve/reject/investigate] [komentar]

*Contoh:*
!tanganilaporon 60f1a5b3e254a62b4c9a1234 resolve Pemain telah diperingatkan
!tanganilaporon 60f1a5b3e254a62b4c9a1234 reject Tidak cukup bukti

*Catatan:*
- Hanya dapat diakses oleh admin
- Tindakan yang tersedia:
  - resolve: Menyelesaikan laporan (pemain telah ditangani)
  - reject: Menolak laporan (tidak valid atau tidak cukup bukti)
  - investigate: Menandai sedang diselidiki
- Komentar akan ditambahkan ke laporan dan terlihat oleh pelapor

*Alternatif:*
!admin resolve [id_laporan] [resolve/reject/investigate] [komentar] - Perintah admin yang resmi untuk menangani laporan
`;
        break;

      case 'dungeon':
        helpMessage = 
`📖 *BANTUAN: !dungeon* 📖

Perintah ini digunakan untuk mengakses dungeon.

*Penggunaan:*
!dungeon - Melihat daftar dungeon
!dungeon masuk [nama_dungeon] - Masuk ke dungeon
!dungeon lanjut - Melanjutkan eksplorasi dungeon
!dungeon keluar - Keluar dari dungeon

*Contoh:*
!dungeon
!dungeon masuk Gua Goblin

*Catatan:*
- Dungeon memiliki tier dan level minimum
- HP minimal 50% dari max HP untuk memasuki dungeon
- Tiap dungeon memiliki cooldown setelah selesai
- Hadiah dungeon berupa Gmoney, experience, dan item
`;
        break;

      case 'quest':
      case 'misi':
        helpMessage = 
`📖 *BANTUAN: !quest* 📖

Perintah ini digunakan untuk mengakses quest.

*Penggunaan:*
!quest - Melihat semua quest aktif
!quest harian - Melihat quest harian
!quest mingguan - Melihat quest mingguan
!quest klaim [id] - Klaim hadiah quest yang telah selesai

*Contoh:*
!quest
!quest klaim 5f7b1c3d4e2a1b0e8f9d0c2a

*Catatan:*
- Quest harian di-reset setiap hari
- Quest mingguan di-reset setiap minggu
- Progress quest diupdate otomatis saat aktivitas terkait dilakukan
- Hadiah quest berupa Gmoney, experience, dan item
`;
        break;

      case 'inventory':
      case 'inventaris':
        helpMessage = 
`📖 *BANTUAN: !inventory* 📖

Perintah ini digunakan untuk melihat inventaris lengkap pemain.

*Penggunaan:*
!inventory
!inventaris

*Catatan:*
- Menampilkan semua item dalam inventori dikelompokkan berdasarkan tipe
- Senjata dan armor menampilkan tier dan damage/defense
- Resource menampilkan jumlah yang dimiliki
- Consumable menampilkan efek dan jumlah yang dimiliki
`;
        break;

      case 'belichip':
      case 'buychip':
        helpMessage = 
`📖 *BANTUAN: !belichip* 📖

Perintah ini digunakan untuk membeli chip untuk bermain judi.

*Penggunaan:*
!belichip [jumlah]

*Contoh:*
!belichip 1000

*Catatan:*
- Rate konversi: 1 Gmoney = 1 chip
- Chip hanya dapat digunakan untuk judi
- Chip tidak dapat ditransfer ke pemain lain
`;
        break;

      case 'jualchip':
      case 'sellchip':
        helpMessage = 
`📖 *BANTUAN: !jualchip* 📖

Perintah ini digunakan untuk menjual kembali chip menjadi Gmoney.

*Penggunaan:*
!jualchip [jumlah]

*Contoh:*
!jualchip 500

*Catatan:*
- Rate konversi: 1 chip = 0.9 Gmoney (ada fee 10%)
- Jual chip hanya jika Anda membutuhkan Gmoney
`;
        break;

      case 'dadu':
      case 'dice':
        helpMessage = 
`📖 *BANTUAN: !dadu* 📖

Perintah ini digunakan untuk bermain judi dadu.

*Penggunaan:*
!dadu [jumlah_chip] [pilihan]

*Pilihan yang tersedia:*
- ganjil/genap: Menebak hasil dadu ganjil atau genap
- 1-6: Menebak angka dadu spesifik

*Contoh:*
!dadu 100 ganjil
!dadu 50 3

*Pembayaran:*
- Pilihan ganjil/genap: 2x (menang 1x taruhan)
- Pilihan angka spesifik: 6x (menang 5x taruhan)

*Catatan:*
- Minimum bet: 1 chip
- Pastikan Anda memiliki cukup chip
`;
        break;

      case 'slot':
        helpMessage = 
`📖 *BANTUAN: !slot* 📖

Perintah ini digunakan untuk bermain judi slot.

*Penggunaan:*
!slot [jumlah_chip]

*Contoh:*
!slot 100

*Pembayaran:*
- Tiga simbol sama: 5x taruhan (menang 4x taruhan)
- Tiga simbol 7️⃣: 7x taruhan (menang 6x taruhan)
- Tiga simbol 💎: 10x taruhan (menang 9x taruhan)
- Dua simbol sama: 2x taruhan (menang 1x taruhan)

*Catatan:*
- Minimum bet: 1 chip
- Pastikan Anda memiliki cukup chip
`;
        break;
        
      default:
        helpMessage = `Perintah "${command}" tidak ditemukan atau belum memiliki bantuan spesifik. Gunakan !help untuk melihat semua perintah.`;
    }
    
    return {
      status: true,
      message: helpMessage
    };
  } catch (error) {
    logger.error(`Error getting command help: ${error.message}`);
    return {
      status: false,
      message: `Terjadi kesalahan saat mendapatkan bantuan untuk perintah "${command}".`
    };
  }
};

module.exports = {
  getHelp,
  getCommandHelp
}; 