const Player = require('../models/Player');
const Item = require('../models/Item');
const MarketListing = require('../models/MarketListing');
const logger = require('../utils/logger');

/**
 * Melihat semua listing di marketplace
 * @param {String} userId - ID pengguna WhatsApp
 * @returns {Object} - Status dan pesan respons
 */
const viewMarket = async (userId) => {
  try {
    // Cari pemain dalam database
    const player = await Player.findByUserId(userId);
    
    if (!player) {
      return {
        status: false,
        message: 'Anda belum terdaftar sebagai pemain. Gunakan !daftar [nama] untuk mendaftar.'
      };
    }

    // Update lastActivity
    player.lastActivity = Date.now();
    
    // Ambil semua listing dari marketplace, dikelompokkan berdasarkan tipe
    const weaponListings = await MarketListing.find({ type: 'weapon' }).sort({ tier: 1, price: 1 }).limit(5);
    const armorListings = await MarketListing.find({ type: 'armor' }).sort({ tier: 1, price: 1 }).limit(5);
    const resourceListings = await MarketListing.find({ type: 'resource' }).sort({ tier: 1, price: 1 }).limit(7);
    const consumableListings = await MarketListing.find({ type: 'consumable' }).sort({ tier: 1, price: 1 }).limit(3);
    
    // Ambil listing yang dibuat oleh pemain ini
    const ownListings = await MarketListing.find({ seller: player._id }).sort({ createdAt: -1 });
    
    // Buat pesan respons
    let message = `🏪 MARKETPLACE 🏪\n\n`;
    
    // Tambahkan info listing
    if (weaponListings.length === 0 && armorListings.length === 0 && 
        resourceListings.length === 0 && consumableListings.length === 0) {
      message += `Tidak ada item yang dijual saat ini.\n\n`;
    } else {
      // Format weapon listings
      if (weaponListings.length > 0) {
        message += `⚔️ SENJATA ⚔️\n`;
        weaponListings.forEach((listing, index) => {
          message += `${index + 1}. ${listing.name} (T${listing.tier}) - ${listing.price} Gmoney\n`;
        });
        message += `\n`;
      }
      
      // Format armor listings
      if (armorListings.length > 0) {
        message += `🛡️ ARMOR 🛡️\n`;
        armorListings.forEach((listing, index) => {
          message += `${index + 1}. ${listing.name} (T${listing.tier}) - ${listing.price} Gmoney\n`;
        });
        message += `\n`;
      }
      
      // Format resource listings
      if (resourceListings.length > 0) {
        message += `🌲 RESOURCE 🌲\n`;
        resourceListings.forEach((listing, index) => {
          message += `${index + 1}. ${listing.name} x${listing.quantity} - ${listing.price} Gmoney (${Math.round(listing.price/listing.quantity)} per unit)\n`;
        });
        message += `\n`;
      }
      
      // Format consumable listings
      if (consumableListings.length > 0) {
        message += `🧪 CONSUMABLE 🧪\n`;
        consumableListings.forEach((listing, index) => {
          message += `${index + 1}. ${listing.name} x${listing.quantity} - ${listing.price} Gmoney\n`;
        });
        message += `\n`;
      }
    }
    
    // Tambahkan info listing pemain sendiri
    message += `📦 LISTING ANDA 📦\n`;
    if (ownListings.length === 0) {
      message += `Anda belum menjual item apapun.\n\n`;
    } else {
      ownListings.forEach((listing, index) => {
        message += `${index + 1}. ${listing.name} x${listing.quantity} - ${listing.price} Gmoney\n`;
      });
      message += `\n`;
    }
    
    // Tambahkan petunjuk penggunaan
    message += `PETUNJUK:\n`;
    message += `!jual [itemId] [harga] - Jual item ke marketplace\n`;
    message += `!beli [id] - Beli item dari marketplace\n`;
    message += `!pasar [kategori] - Lihat listing berdasarkan kategori (weapon/armor/resource/consumable)\n`;
    message += `!pasar batal [id] - Batalkan listing Anda\n`;
    
    return {
      status: true,
      message
    };
  } catch (error) {
    logger.error(`Error viewing market: ${error.message}`);
    return {
      status: false,
      message: `Terjadi kesalahan saat melihat marketplace: ${error.message}`
    };
  }
};

/**
 * Menjual item ke marketplace
 * @param {String} userId - ID pengguna WhatsApp
 * @param {String} itemId - ID item yang akan dijual
 * @param {Number} price - Harga item
 * @param {Number} quantity - Jumlah item yang dijual (optional)
 * @returns {Object} - Status dan pesan respons
 */
const sellItem = async (userId, itemId, price, quantity = 1) => {
  try {
    // Validasi input
    if (!itemId || !price) {
      return {
        status: false,
        message: 'Format perintah tidak valid. Contoh: !jual rough_logs 100 5'
      };
    }
    
    // Validasi harga
    const priceNum = parseInt(price);
    if (isNaN(priceNum) || priceNum <= 0) {
      return {
        status: false,
        message: 'Harga harus berupa angka positif.'
      };
    }
    
    // Validasi jumlah
    const quantityNum = parseInt(quantity);
    if (isNaN(quantityNum) || quantityNum <= 0) {
      return {
        status: false,
        message: 'Jumlah harus berupa angka positif.'
      };
    }
    
    // Cari pemain dalam database
    const player = await Player.findByUserId(userId);
    
    if (!player) {
      return {
        status: false,
        message: 'Anda belum terdaftar sebagai pemain. Gunakan !daftar [nama] untuk mendaftar.'
      };
    }
    
    // Update lastActivity
    player.lastActivity = Date.now();
    
    // Cari item di inventory pemain
    const inventoryItem = player.inventory.find(i => 
      i.itemId === itemId || 
      i.name.toLowerCase() === itemId.toLowerCase()
    );
    
    if (!inventoryItem) {
      return {
        status: false,
        message: `Item "${itemId}" tidak ditemukan dalam inventory Anda.`
      };
    }
    
    // Validasi jumlah
    if (inventoryItem.quantity < quantityNum) {
      return {
        status: false,
        message: `Anda hanya memiliki ${inventoryItem.quantity} ${inventoryItem.name}, tidak cukup untuk menjual ${quantityNum} unit.`
      };
    }
    
    // Buat listing baru
    const newListing = new MarketListing({
      seller: player._id,
      itemId: inventoryItem.itemId,
      name: inventoryItem.name,
      type: inventoryItem.type,
      tier: inventoryItem.tier,
      quantity: quantityNum,
      price: priceNum,
      stats: inventoryItem.stats || {}
    });
    
    // Simpan listing
    await newListing.save();
    
    // Kurangi item dari inventory pemain
    player.removeItem(inventoryItem.itemId, quantityNum);
    await player.save();
    
    logger.info(`Player ${player.name} listed ${quantityNum} ${inventoryItem.name} for ${priceNum} Gmoney`);
    
    return {
      status: true,
      message: `✅ Berhasil mendaftarkan ${inventoryItem.name} x${quantityNum} ke marketplace dengan harga ${priceNum} Gmoney.`
    };
  } catch (error) {
    logger.error(`Error selling item: ${error.message}`);
    return {
      status: false,
      message: `Terjadi kesalahan saat menjual item: ${error.message}`
    };
  }
};

/**
 * Membeli item dari marketplace
 * @param {String} userId - ID pengguna WhatsApp
 * @param {String} listingId - ID listing yang akan dibeli
 * @param {Number} quantity - Jumlah item yang dibeli (optional)
 * @returns {Object} - Status dan pesan respons
 */
const buyItem = async (userId, listingId, quantity = null) => {
  try {
    // Validasi input
    if (!listingId) {
      return {
        status: false,
        message: 'Silakan tentukan ID listing yang ingin dibeli. Contoh: !beli 5f7b1c3d4e2a1b0e8f9d0c2a'
      };
    }
    
    // Cari pemain dalam database
    const player = await Player.findByUserId(userId);
    
    if (!player) {
      return {
        status: false,
        message: 'Anda belum terdaftar sebagai pemain. Gunakan !daftar [nama] untuk mendaftar.'
      };
    }
    
    // Update lastActivity
    player.lastActivity = Date.now();
    
    // Cari listing berdasarkan ID
    const listing = await MarketListing.findById(listingId).populate('seller', 'name');
    
    if (!listing) {
      return {
        status: false,
        message: 'Listing tidak ditemukan. Mungkin sudah terjual atau dihapus.'
      };
    }
    
    // Cek apakah pemain membeli listing miliknya sendiri
    if (listing.seller._id.toString() === player._id.toString()) {
      return {
        status: false,
        message: 'Anda tidak bisa membeli listing yang Anda buat sendiri.'
      };
    }
    
    // Tentukan jumlah yang dibeli
    const quantityToBuy = quantity ? parseInt(quantity) : listing.quantity;
    
    if (isNaN(quantityToBuy) || quantityToBuy <= 0 || quantityToBuy > listing.quantity) {
      return {
        status: false,
        message: `Jumlah tidak valid. Harus antara 1 dan ${listing.quantity}.`
      };
    }
    
    // Hitung total harga
    const totalPrice = Math.round((listing.price / listing.quantity) * quantityToBuy);
    
    // Cek apakah pemain memiliki cukup Gmoney
    if (player.gmoney < totalPrice) {
      return {
        status: false,
        message: `Gmoney Anda (${player.gmoney}) tidak cukup untuk membeli item ini (${totalPrice}).`
      };
    }
    
    // Proses pembelian
    // Kurangi Gmoney pemain
    player.gmoney -= totalPrice;
    
    // Tambahkan item ke inventory pemain
    const boughtItem = {
      itemId: listing.itemId,
      name: listing.name,
      type: listing.type,
      tier: listing.tier,
      stats: listing.stats,
      quantity: quantityToBuy
    };
    
    player.addItem(boughtItem);
    
    // Simpan perubahan pada pemain
    await player.save();
    
    // Update atau hapus listing
    if (quantityToBuy === listing.quantity) {
      // Hapus listing jika seluruh kuantitas dibeli
      await MarketListing.findByIdAndDelete(listingId);
      
      // Tambahkan Gmoney ke penjual
      const seller = await Player.findById(listing.seller._id);
      if (seller) {
        seller.gmoney += totalPrice;
        await seller.save();
      }
    } else {
      // Update listing jika hanya sebagian yang dibeli
      listing.quantity -= quantityToBuy;
      listing.price -= totalPrice;
      await listing.save();
      
      // Tambahkan Gmoney ke penjual
      const seller = await Player.findById(listing.seller._id);
      if (seller) {
        seller.gmoney += totalPrice;
        await seller.save();
      }
    }
    
    logger.info(`Player ${player.name} bought ${quantityToBuy} ${listing.name} for ${totalPrice} Gmoney from ${listing.seller.name}`);
    
    return {
      status: true,
      message: `✅ Berhasil membeli ${listing.name} x${quantityToBuy} seharga ${totalPrice} Gmoney dari ${listing.seller.name}.`
    };
  } catch (error) {
    logger.error(`Error buying item: ${error.message}`);
    return {
      status: false,
      message: `Terjadi kesalahan saat membeli item: ${error.message}`
    };
  }
};

/**
 * Membatalkan listing di marketplace
 * @param {String} userId - ID pengguna WhatsApp
 * @param {String} listingId - ID listing yang akan dibatalkan
 * @returns {Object} - Status dan pesan respons
 */
const cancelListing = async (userId, listingId) => {
  try {
    // Validasi input
    if (!listingId) {
      return {
        status: false,
        message: 'Silakan tentukan ID listing yang ingin dibatalkan. Contoh: !pasar batal 5f7b1c3d4e2a1b0e8f9d0c2a'
      };
    }
    
    // Cari pemain dalam database
    const player = await Player.findByUserId(userId);
    
    if (!player) {
      return {
        status: false,
        message: 'Anda belum terdaftar sebagai pemain. Gunakan !daftar [nama] untuk mendaftar.'
      };
    }
    
    // Update lastActivity
    player.lastActivity = Date.now();
    
    // Cari listing berdasarkan ID
    const listing = await MarketListing.findById(listingId);
    
    if (!listing) {
      return {
        status: false,
        message: 'Listing tidak ditemukan. Mungkin sudah terjual atau dihapus.'
      };
    }
    
    // Cek apakah pemain adalah pemilik listing
    if (listing.seller.toString() !== player._id.toString()) {
      return {
        status: false,
        message: 'Anda tidak bisa membatalkan listing yang bukan milik Anda.'
      };
    }
    
    // Kembalikan item ke inventory pemain
    const returnedItem = {
      itemId: listing.itemId,
      name: listing.name,
      type: listing.type,
      tier: listing.tier,
      stats: listing.stats,
      quantity: listing.quantity
    };
    
    player.addItem(returnedItem);
    
    // Hapus listing
    await MarketListing.findByIdAndDelete(listingId);
    
    // Simpan perubahan pada pemain
    await player.save();
    
    logger.info(`Player ${player.name} canceled listing for ${listing.quantity} ${listing.name}`);
    
    return {
      status: true,
      message: `✅ Berhasil membatalkan listing ${listing.name} x${listing.quantity}. Item telah dikembalikan ke inventory Anda.`
    };
  } catch (error) {
    logger.error(`Error canceling listing: ${error.message}`);
    return {
      status: false,
      message: `Terjadi kesalahan saat membatalkan listing: ${error.message}`
    };
  }
};

/**
 * Melihat listing berdasarkan kategori
 * @param {String} userId - ID pengguna WhatsApp
 * @param {String} category - Kategori yang ingin dilihat (weapon, armor, resource, consumable)
 * @returns {Object} - Status dan pesan respons
 */
const viewMarketByCategory = async (userId, category) => {
  try {
    // Validasi input
    const validCategories = ['weapon', 'armor', 'resource', 'consumable', 'senjata', 'baju', 'resource', 'konsumable'];
    
    if (!category || !validCategories.includes(category.toLowerCase())) {
      return {
        status: false,
        message: 'Kategori tidak valid. Gunakan: weapon/senjata, armor/baju, resource, consumable/konsumable'
      };
    }
    
    // Normalisasi kategori
    let normalizedCategory = category.toLowerCase();
    if (normalizedCategory === 'senjata') normalizedCategory = 'weapon';
    if (normalizedCategory === 'baju') normalizedCategory = 'armor';
    if (normalizedCategory === 'konsumable') normalizedCategory = 'consumable';
    
    // Cari pemain dalam database
    const player = await Player.findByUserId(userId);
    
    if (!player) {
      return {
        status: false,
        message: 'Anda belum terdaftar sebagai pemain. Gunakan !daftar [nama] untuk mendaftar.'
      };
    }
    
    // Update lastActivity
    player.lastActivity = Date.now();
    
    // Ambil listing berdasarkan kategori
    const listings = await MarketListing.find({ type: normalizedCategory })
      .sort({ tier: 1, price: 1 })
      .limit(20)
      .populate('seller', 'name');
    
    // Buat pesan respons
    let message = `🏪 MARKETPLACE - ${normalizedCategory.toUpperCase()} 🏪\n\n`;
    
    if (listings.length === 0) {
      message += `Tidak ada item ${normalizedCategory} yang dijual saat ini.\n\n`;
    } else {
      listings.forEach((listing, index) => {
        const pricePerUnit = Math.round(listing.price / listing.quantity);
        
        message += `${index + 1}. ${listing.name}`;
        if (listing.quantity > 1) {
          message += ` x${listing.quantity}`;
        }
        
        message += ` (T${listing.tier}) - ${listing.price} Gmoney`;
        
        if (listing.quantity > 1) {
          message += ` (${pricePerUnit}/unit)`;
        }
        
        message += `\nID: ${listing._id}\nPenjual: ${listing.seller.name}\n\n`;
      });
    }
    
    message += `Untuk membeli: !beli [listing_id] [jumlah]\nKembali ke menu utama: !pasar`;
    
    return {
      status: true,
      message
    };
  } catch (error) {
    logger.error(`Error viewing market by category: ${error.message}`);
    return {
      status: false,
      message: `Terjadi kesalahan saat melihat marketplace: ${error.message}`
    };
  }
};

module.exports = {
  viewMarket,
  sellItem,
  buyItem,
  cancelListing,
  viewMarketByCategory
}; 