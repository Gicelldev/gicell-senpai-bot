# Gicell Senpai Bot

Bot WhatsApp RPG berbasis Node.js + Baileys untuk memainkan sistem karakter, gathering, combat, guild, market, dan quest langsung dari WhatsApp.

## Status Proyek

Repo ini sedang melalui fase stabilisasi arsitektur.
Fokus refactor terbaru adalah:

- menyatukan progres pemain ke **satu source of truth** di model `Player`
- memindahkan sistem quest ke kombinasi **`Quest` + `PlayerQuest`**
- memperbaiki integrasi **guild donation**, **marketplace**, dan **storyline/quest chain**
- menambahkan **economic sink** dasar agar sirkulasi Gmoney lebih sehat
- mengurangi risiko partial-save lewat **Mongoose transaction session** pada mutasi penting

## Fitur yang Saat Ini Stabil

- **Sistem Karakter**
  - registrasi pemain
  - profil dasar
  - equipment, inventory, level, experience, gmoney, chips
- **Gathering & Crafting**
  - gather resource canonical: `wood`, `stone`, `ore`, `fiber`, `hide`
  - resource hasil gather terhubung ke inventory dan guild donation
  - crafting berbasis item seed
- **Combat & Progression**
  - PvE combat
  - drop item dan reward Gmoney
  - progression level memakai helper `addExperience()` yang sudah diperbaiki
- **Quest System**
  - quest harian / mingguan melalui `Quest` + `PlayerQuest`
  - klaim reward quest via command WhatsApp
  - update progress quest dari aktivitas terkait
- **Quest Chain / Storyline**
  - prerequisite quest chain sekarang mengikuti data aktif di collection, bukan field player legacy
- **Guild System**
  - join / leave / info guild
  - donation gmoney dan resource
  - bug double-count treasury sudah diperbaiki
- **Marketplace**
  - jual, beli, batal listing
  - listing fee, sale tax, price floor dasar
  - mutasi listing dan inventory sudah dibungkus transaction session
- **Gambling**
  - beli / jual chip
  - dice dan slot
  - chip buy fee + max bet cap dasar untuk menahan inflasi

## Fitur yang Masih Perlu Hardening Lanjutan

- balancing ekonomi lanjutan untuk faucet combat/gather
- validasi transaction fallback bila MongoDB berjalan tanpa replica set
- test automation dan smoke test end-to-end
- sinkronisasi dokumentasi command dengan seluruh controller aktual
- cleanup tambahan untuk fitur draft yang belum terintegrasi penuh

## Instalasi

### Lokal

1. Clone repository
   ```bash
   git clone https://github.com/Gicelldev/gicell-senpai-bot.git
   ```

2. Install dependency
   ```bash
   npm install
   ```

3. Siapkan file `.env`

4. Jalankan bot
   ```bash
   npm run dev
   ```

5. Scan QR WhatsApp yang muncul di terminal

### Docker

1. Clone repository
2. Siapkan `.env`
3. Jalankan:
   ```bash
   docker-compose up -d
   ```

## Command Utama

| Perintah | Deskripsi |
|----------|-----------|
| `!daftar [nama]` | Mendaftar pemain baru |
| `!profil` | Lihat profil karakter |
| `!inventory` | Lihat inventory |
| `!gather [resource]` | Gather resource |
| `!craft [item]` | Craft item |
| `!serang [target]` | Combat monster / target |
| `!pasar` | Lihat marketplace |
| `!jual [item] [harga] [jumlah]` | Buat listing market |
| `!beli [listingId] [jumlah]` | Beli item market |
| `!guild` | Lihat / kelola guild |
| `!guild sumbang [tipe] [jumlah]` | Donasi guild |
| `!quest` | Lihat quest aktif |
| `!quest harian` | Lihat quest harian |
| `!quest mingguan` | Lihat quest mingguan |
| `!quest klaim [id]` | Klaim reward quest |
| `!storyline` | Lihat quest chain / storyline |
| `!help` | Bantuan command |

## Catatan Arsitektur Penting

### Player Progression

Progress pemain yang aktif sekarang mengandalkan field berikut di model `Player`:

- `level`
- `experience`
- `gmoney`
- `chips`
- `inventory`
- `equipment`
- `stats`

Field legacy seperti `player.exp`, `player.quests`, `player.skills`, dan field serupa **bukan acuan aktif** untuk flow refactor terbaru.

### Quest Model

Quest aktif sekarang mengikuti pola:

- `Quest` untuk definisi quest
- `PlayerQuest` untuk progress pemain
- `QuestChain` + `PlayerQuestChain` untuk storyline

### Resource Naming

Penamaan resource sudah distandarisasi ke bentuk canonical:

- `wood`
- `stone`
- `ore`
- `fiber`
- `hide`

Item inventory resource bisa tetap berupa tiered item seperti:

- `rough_logs`
- `simple_ore`
- `journeyman_fiber`

Helper model pemain akan melakukan mapping canonical saat dibutuhkan.

## Struktur Folder

```text
gicell-senpai-bot/
├── src/
│   ├── controllers/
│   ├── models/
│   ├── routes/
│   ├── utils/
│   ├── data/
│   ├── index.js
│   ├── database.js
│   └── whatsapp.js
├── logs/
├── session/
├── package.json
├── Dockerfile
└── docker-compose.yml
```

## Teknologi

- Node.js
- `@whiskeysockets/baileys`
- MongoDB + Mongoose
- Express.js
- Winston
- Jest

## Verifikasi Lokal

Perintah yang diharapkan tersedia:

```bash
npm test
```

Namun verifikasi hanya akan berjalan jika dependency benar-benar sudah terinstall.
Jika environment belum menjalankan `npm install`, maka module seperti `mongoose` atau binary seperti `jest` akan gagal dimuat.

## Kontribusi

Jika ingin lanjut refactor, prioritas yang direkomendasikan:

1. tambah smoke/integration test untuk market, guild, quest
2. audit fitur draft yang belum terhubung penuh
3. evaluasi balancing combat/gather terhadap inflasi Gmoney
4. perketat fallback untuk transaction saat MongoDB non-replica

## Lisensi

MIT

## Author

Gicell Senpai Developer
