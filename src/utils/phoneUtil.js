/**
 * Fungsi utilitas untuk mengelola nomor telepon WhatsApp
 */

/**
 * Mengekstrak nomor telepon dari ID WhatsApp
 * @param {String} whatsappId - ID WhatsApp (format: "nomor@s.whatsapp.net")
 * @returns {String} - Nomor telepon tanpa domain
 */
function extractPhoneNumber(whatsappId) {
  if (!whatsappId) return '';
  
  // Jika dalam format nomor@s.whatsapp.net
  if (whatsappId.includes('@')) {
    return whatsappId.split('@')[0];
  }
  
  return whatsappId;
}

/**
 * Mengubah nomor telepon menjadi format ID WhatsApp
 * @param {String} phoneNumber - Nomor telepon
 * @returns {String} - ID WhatsApp
 */
function formatToWhatsAppId(phoneNumber) {
  if (!phoneNumber) return '';
  
  // Jika sudah dalam format nomor@s.whatsapp.net
  if (phoneNumber.includes('@s.whatsapp.net')) {
    return phoneNumber;
  }
  
  return `${phoneNumber}@s.whatsapp.net`;
}

/**
 * Cek apakah nomor telepon sama (terlepas dari format WhatsApp)
 * @param {String} number1 - Nomor telepon pertama
 * @param {String} number2 - Nomor telepon kedua
 * @returns {Boolean} - true jika sama
 */
function isSamePhoneNumber(number1, number2) {
  if (!number1 || !number2) return false;
  
  const clean1 = extractPhoneNumber(number1);
  const clean2 = extractPhoneNumber(number2);
  
  return clean1 === clean2;
}

module.exports = {
  extractPhoneNumber,
  formatToWhatsAppId,
  isSamePhoneNumber
}; 