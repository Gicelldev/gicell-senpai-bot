// Script untuk memperbarui messageHandler.js untuk handler craftlist

// Perubahan yang perlu dilakukan di messageHandler.js

/*
Perubahan 1: Pada bagian case 'craftlist' di handleCommand:

Dari:
case 'craftlist':
  response = await viewCraftableItems(senderId);
  break;

Menjadi:
case 'craftlist':
  if (args.length === 0) {
    response = await viewCraftableItems(senderId);
  } else {
    response = await viewCraftableItems(senderId, args[0]);
  }
  break;
*/

console.log(`
PETUNJUK PERUBAHAN PADA messageHandler.js
=========================================

Lokasi file: src/controllers/messageHandler.js

1. Cari kode berikut:

case 'craftlist':
  response = await viewCraftableItems(senderId);
  break;

2. Ganti dengan kode berikut:

case 'craftlist':
  if (args.length === 0) {
    response = await viewCraftableItems(senderId);
  } else {
    response = await viewCraftableItems(senderId, args[0]);
  }
  break;

3. Pastikan juga fungsi viewCraftableItems di craftController.js sudah diperbarui untuk menerima parameter filter.
`);

// Petunjuk untuk pembaruan craftController.js
console.log(`
PETUNJUK PERUBAHAN PADA craftController.js
=========================================

Lokasi file: src/controllers/craftController.js

1. Perbarui definisi fungsi viewCraftableItems:

// Dari:
const viewCraftableItems = async (userId) => {

// Menjadi:
const viewCraftableItems = async (userId, filter = null) => {

2. Tambahkan kode untuk menangani filter. Anda dapat melihat implementasi lengkapnya pada file updateCraftHandler.js

Setelah update, perintah berikut akan tersedia:
- !craftlist - menampilkan semua item yang dapat di-craft
- !craftlist weapon - menampilkan hanya senjata
- !craftlist armor - menampilkan hanya armor
- !craftlist consumable - menampilkan hanya consumable
- !craftlist resource - menampilkan hanya resource
- !craftlist tier1 - menampilkan hanya item tier 1
- ... dst
`); 