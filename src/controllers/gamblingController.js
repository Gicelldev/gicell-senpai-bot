const Player = require('../models/Player');
const logger = require('../utils/logger');

/**
 * Membeli chip untuk judi
 * @param {String} userId - ID pengguna WhatsApp
 * @param {Number} amount - Jumlah chip yang ingin dibeli
 * @returns {Object} - Status dan pesan respons
 */
const buyChips = async (userId, amount) => {
  try {
    if (!amount || isNaN(amount) || amount <= 0) {
      return {
        status: false,
        message: 'Jumlah chip harus berupa angka positif.\nContoh: !belichip 100'
      };
    }

    // Konversi amount ke number
    amount = parseInt(amount);
    
    // Rate konversi Gmoney ke chip (1 Gmoney = 1 chip)
    const conversionRate = 1;
    const gmoneyNeeded = amount * conversionRate;
    
    const player = await Player.findByUserId(userId);
    
    if (!player) {
      return {
        status: false,
        message: 'Anda belum terdaftar sebagai pemain. Gunakan !daftar [nama] untuk mendaftar.'
      };
    }
    
    // Cek apakah pemain memiliki cukup Gmoney
    if (player.gmoney < gmoneyNeeded) {
      return {
        status: false,
        message: `Gmoney tidak cukup. Anda membutuhkan ${gmoneyNeeded} Gmoney untuk membeli ${amount} chip.`
      };
    }
    
    // Kurangi Gmoney dan tambahkan chip
    player.gmoney -= gmoneyNeeded;
    player.chips += amount;
    
    await player.save();
    
    logger.info(`Player ${player.name} bought ${amount} chips for ${gmoneyNeeded} Gmoney`);
    
    return {
      status: true,
      message: `Berhasil membeli ${amount} chip dengan ${gmoneyNeeded} Gmoney.\nTotal chip Anda sekarang: ${player.chips}`
    };
  } catch (error) {
    logger.error(`Error buying chips: ${error.message}`);
    return {
      status: false,
      message: `Terjadi kesalahan saat membeli chip: ${error.message}`
    };
  }
};

/**
 * Menjual chip kembali menjadi Gmoney
 * @param {String} userId - ID pengguna WhatsApp
 * @param {Number} amount - Jumlah chip yang ingin dijual
 * @returns {Object} - Status dan pesan respons
 */
const sellChips = async (userId, amount) => {
  try {
    if (!amount || isNaN(amount) || amount <= 0) {
      return {
        status: false,
        message: 'Jumlah chip harus berupa angka positif.\nContoh: !jualchip 100'
      };
    }

    // Konversi amount ke number
    amount = parseInt(amount);
    
    // Rate konversi chip ke Gmoney (1 chip = 0.9 Gmoney, ada fee 10%)
    const conversionRate = 0.9;
    const gmoneyReceived = Math.floor(amount * conversionRate);
    
    const player = await Player.findByUserId(userId);
    
    if (!player) {
      return {
        status: false,
        message: 'Anda belum terdaftar sebagai pemain. Gunakan !daftar [nama] untuk mendaftar.'
      };
    }
    
    // Cek apakah pemain memiliki cukup chip
    if (player.chips < amount) {
      return {
        status: false,
        message: `Chip tidak cukup. Anda hanya memiliki ${player.chips} chip.`
      };
    }
    
    // Kurangi chip dan tambahkan Gmoney
    player.chips -= amount;
    player.gmoney += gmoneyReceived;
    
    await player.save();
    
    logger.info(`Player ${player.name} sold ${amount} chips for ${gmoneyReceived} Gmoney`);
    
    return {
      status: true,
      message: `Berhasil menjual ${amount} chip dengan ${gmoneyReceived} Gmoney (fee: 10%).\nTotal chip Anda sekarang: ${player.chips}`
    };
  } catch (error) {
    logger.error(`Error selling chips: ${error.message}`);
    return {
      status: false,
      message: `Terjadi kesalahan saat menjual chip: ${error.message}`
    };
  }
};

/**
 * Menjalankan game dadu (dice)
 * @param {String} userId - ID pengguna WhatsApp
 * @param {Number} bet - Jumlah chip yang dipertaruhkan
 * @param {String} choice - Pilihan pemain (ganjil/genap atau angka 1-6)
 * @returns {Object} - Status dan pesan respons
 */
const playDice = async (userId, bet, choice) => {
  try {
    if (!bet || isNaN(bet) || bet <= 0) {
      return {
        status: false,
        message: 'Jumlah taruhan harus berupa angka positif.\nContoh: !dadu 100 ganjil'
      };
    }

    if (!choice) {
      return {
        status: false,
        message: 'Anda harus menentukan pilihan (ganjil/genap atau angka 1-6).\nContoh: !dadu 100 ganjil'
      };
    }

    // Konversi bet ke number
    bet = parseInt(bet);
    choice = choice.toLowerCase();
    
    // Validasi pilihan
    const validChoices = ['ganjil', 'genap', '1', '2', '3', '4', '5', '6'];
    if (!validChoices.includes(choice)) {
      return {
        status: false,
        message: 'Pilihan tidak valid. Pilihan yang tersedia: ganjil, genap, atau angka 1-6'
      };
    }
    
    const player = await Player.findByUserId(userId);
    
    if (!player) {
      return {
        status: false,
        message: 'Anda belum terdaftar sebagai pemain. Gunakan !daftar [nama] untuk mendaftar.'
      };
    }
    
    // Cek apakah pemain memiliki cukup chip
    if (player.chips < bet) {
      return {
        status: false,
        message: `Chip tidak cukup. Anda membutuhkan ${bet} chip untuk bermain.`
      };
    }
    
    // Jalankan dadu
    const diceResult = Math.floor(Math.random() * 6) + 1;
    let isWin = false;
    let multiplier = 0;
    
    // Cek hasil
    if (choice === 'ganjil' && diceResult % 2 === 1) {
      // Menang dengan pilihan ganjil
      isWin = true;
      multiplier = 2;
    } else if (choice === 'genap' && diceResult % 2 === 0) {
      // Menang dengan pilihan genap
      isWin = true;
      multiplier = 2;
    } else if (choice === diceResult.toString()) {
      // Menang dengan pilihan angka spesifik
      isWin = true;
      multiplier = 6;
    }
    
    // Hitung hasil
    let chipResult = 0;
    
    if (isWin) {
      chipResult = bet * (multiplier - 1); // Menang: dapatkan (multiplier-1) kali taruhan
      player.chips += chipResult;
    } else {
      chipResult = -bet; // Kalah: kehilangan semua taruhan
      player.chips -= bet;
    }
    
    await player.save();
    
    // Buat pesan respons
    let responseMessage = `🎲 HASIL DADU: ${diceResult} 🎲\n\n`;
    
    if (isWin) {
      responseMessage += `Selamat! Anda menang ${chipResult} chip.\n`;
    } else {
      responseMessage += `Maaf, Anda kalah ${Math.abs(chipResult)} chip.\n`;
    }
    
    responseMessage += `Total chip Anda sekarang: ${player.chips}`;
    
    logger.info(`Player ${player.name} played dice, bet: ${bet}, choice: ${choice}, result: ${diceResult}, chips change: ${chipResult}`);
    
    return {
      status: true,
      message: responseMessage
    };
  } catch (error) {
    logger.error(`Error playing dice: ${error.message}`);
    return {
      status: false,
      message: `Terjadi kesalahan saat bermain dadu: ${error.message}`
    };
  }
};

/**
 * Menjalankan game slot
 * @param {String} userId - ID pengguna WhatsApp
 * @param {Number} bet - Jumlah chip yang dipertaruhkan
 * @returns {Object} - Status dan pesan respons
 */
const playSlot = async (userId, bet) => {
  try {
    if (!bet || isNaN(bet) || bet <= 0) {
      return {
        status: false,
        message: 'Jumlah taruhan harus berupa angka positif.\nContoh: !slot 100'
      };
    }

    // Konversi bet ke number
    bet = parseInt(bet);
    
    const player = await Player.findByUserId(userId);
    
    if (!player) {
      return {
        status: false,
        message: 'Anda belum terdaftar sebagai pemain. Gunakan !daftar [nama] untuk mendaftar.'
      };
    }
    
    // Cek apakah pemain memiliki cukup chip
    if (player.chips < bet) {
      return {
        status: false,
        message: `Chip tidak cukup. Anda membutuhkan ${bet} chip untuk bermain.`
      };
    }
    
    // Simbol slot
    const symbols = ['🍒', '🍊', '🍋', '🍇', '💎', '7️⃣'];
    
    // Generasi hasil slot
    const slotResults = [
      symbols[Math.floor(Math.random() * symbols.length)],
      symbols[Math.floor(Math.random() * symbols.length)],
      symbols[Math.floor(Math.random() * symbols.length)]
    ];
    
    // Cek kemenangan
    let multiplier = 0;
    
    if (slotResults[0] === slotResults[1] && slotResults[1] === slotResults[2]) {
      // Semua simbol sama
      if (slotResults[0] === '💎') {
        multiplier = 10; // Jackpot
      } else if (slotResults[0] === '7️⃣') {
        multiplier = 7; // Lucky seven
      } else {
        multiplier = 5; // Simbol lain
      }
    } else if (slotResults[0] === slotResults[1] || slotResults[1] === slotResults[2]) {
      // Dua simbol sama
      multiplier = 2;
    }
    
    // Hitung hasil
    let chipResult = 0;
    
    if (multiplier > 0) {
      chipResult = bet * (multiplier - 1); // Menang
      player.chips += chipResult;
    } else {
      chipResult = -bet; // Kalah
      player.chips -= bet;
    }
    
    await player.save();
    
    // Buat pesan respons
    let responseMessage = `🎰 HASIL SLOT 🎰\n\n`;
    responseMessage += `[ ${slotResults.join(' | ')} ]\n\n`;
    
    if (multiplier > 0) {
      responseMessage += `Selamat! Anda menang ${chipResult} chip (${multiplier}x).\n`;
    } else {
      responseMessage += `Maaf, Anda kalah ${Math.abs(chipResult)} chip.\n`;
    }
    
    responseMessage += `Total chip Anda sekarang: ${player.chips}`;
    
    logger.info(`Player ${player.name} played slot, bet: ${bet}, result: ${slotResults.join('|')}, chips change: ${chipResult}`);
    
    return {
      status: true,
      message: responseMessage
    };
  } catch (error) {
    logger.error(`Error playing slot: ${error.message}`);
    return {
      status: false,
      message: `Terjadi kesalahan saat bermain slot: ${error.message}`
    };
  }
};

module.exports = {
  buyChips,
  sellChips,
  playDice,
  playSlot
}; 