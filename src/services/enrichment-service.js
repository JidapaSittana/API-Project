// services/enrichment-service.js
const { fetchWithRetry } = require("./external-api");

async function getBookEnrichment(isbn) {
  const cleanIsbn = isbn.replace(/-/g, "");
  // ใช้ Open Library API เป็น Public API ของโดเมนหนังสือ
  const url = `https://openlibrary.org/api/books?bibkeys=ISBN:${cleanIsbn}&format=json&jscmd=data`;

  try {
    const data = await fetchWithRetry(url, 3000, 2);
    const bookData = data[`ISBN:${cleanIsbn}`];

    return {
      source: "external",
      available: true,
      note: bookData ? bookData.title : "ไม่พบข้อมูลเสริม",
    };
  } catch (error) {
    console.error(
      `[enrichment-service] external API unavailable after retries: ${error.message}`,
    );
    // Fallback ตอบกลับผู้ใช้ไม่ให้ระบบพัง
    return {
      source: "fallback",
      available: false,
      note: "ไม่สามารถดึงข้อมูลเสริมจากบริการภายนอกได้ในขณะนี้ กรุณาลองใหม่ภายหลัง",
    };
  }
}

module.exports = { getBookEnrichment };
