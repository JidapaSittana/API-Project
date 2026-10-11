require("dotenv").config();

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const helmet = require("helmet");

// ---> ส่วนที่ 1: นำเข้าไลบรารีสำหรับทำ Swagger <---
const swaggerUi = require("swagger-ui-express");
const YAML = require("yamljs");
const path = require("path");
// ---------------------------------------------

const { fetchBookCoverWithResilience } = require("./services/external-api");
const { getBookEnrichment } = require("./services/enrichment-service");

const app = express();
const PORT = process.env.PORT || 3000;

// Security & Utility Middlewares
app.use(helmet());
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGIN || "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  }),
);
app.use(morgan("dev"));
app.use(express.json({ limit: "10kb" }));

// ---> ส่วนที่ 2: ตั้งค่า Endpoint สำหรับดู Docs <---
// สมมติว่าไฟล์ openapi.yaml อยู่โฟลเดอร์นอกสุด (ข้างนอกโฟลเดอร์ src)
const swaggerDocument = YAML.load(path.join(__dirname, "./openapi.yaml"));
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
// ---------------------------------------------

// Helper function จัดการ Error Response
function sendError(res, statusCode, code, message) {
  return res.status(statusCode).json({ error: { code, message } });
}
app.get("/api/v1/books/:id/enrichment", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const book = books.find((b) => b.id === id);

    if (!book) {
      return sendError(res, 404, "NOT_FOUND", "ไม่พบข้อมูลหนังสือ");
    }

    // ดึงข้อมูลเสริมโดยใช้ ISBN
    const enrichment = await getBookEnrichment(book.isbn);

    return res.status(200).json({
      data: {
        bookId: id,
        enrichment,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Mock Data จำลองฐานข้อมูล
let publishers = [
  {
    id: 1,
    publisherName: "SE-ED Publishing",
    contactEmail: "contact@se-ed.com",
  },
  { id: 2, publisherName: "Chula Press", contactEmail: "press@chula.ac.th" },
];

let categories = [
  { id: 101, categoryCode: "TECH", categoryName: "เทคโนโลยี" },
  { id: 102, categoryCode: "NOVEL", categoryName: "นวนิยาย" },
];

let books = [
  {
    id: 1,
    title: "Clean Code",
    author: "Robert C. Martin",
    isbn: "9780132350884",
    price: 350.0,
    publisherId: 1,
    categoryIds: [101, 102],
  },
  {
    id: 2,
    title: "Basic Database & SQL",
    author: "สมหญิง รักเรียน",
    isbn: "978-1-123456-02-7",
    price: 280.0,
    publisherId: 2,
    categoryIds: [101],
  },
];

let nextBookId = 3;

// REST Routes:Books Resource หลัก
// 1.GET ดึงรายชื่อหนังสือทั้งหมด
app.get("/api/v1/books", (req, res) => {
  const { category } = req.query;
  if (category) {
    const matchedCategory = categories.find(
      (c) =>
        c.categoryCode.toLowerCase() === category.toLowerCase() ||
        c.categoryName === category,
    );
    if (matchedCategory) {
      const filtered = books.filter((b) =>
        b.categoryIds.includes(matchedCategory.id),
      );
      return res.status(200).json({ message: "สำเร็จ", data: filtered });
    }
    return res.status(200).json({ message: "สำเร็จ", data: [] });
  }
  res.status(200).json({ message: "สำเร็จ", data: books });
});

// 2.GET ดึงข้อมูลหนังสือตาม ID
app.get("/api/v1/books/:id", async (req, res) => {
  const id = Number(req.params.id);
  const book = books.find((b) => b.id === id);

  if (!book) {
    return sendError(res, 404, "NOT_FOUND", "ไม่พบข้อมูลหนังสือ");
  }

  let resultData = { ...book };
  const includes = req.query.include ? req.query.include.split(",") : [];

  if (includes.includes("publisher")) {
    resultData.publisher =
      publishers.find((p) => p.id === book.publisherId) || null;
  }
  if (includes.includes("categories")) {
    resultData.categories = categories.filter((c) =>
      book.categoryIds.includes(c.id),
    );
  }

  const coverUrl = await fetchBookCoverWithResilience(book.isbn);
  resultData.coverImage = coverUrl;

  res.status(200).json({ message: "สำเร็จ", data: resultData });
});

// 3.POST เพิ่มหนังสือใหม่
app.post("/api/v1/books", (req, res) => {
  const { title, author, isbn, price, publisherId, categoryIds } = req.body;

  if (!title || !author || !isbn || price === undefined || !publisherId) {
    return sendError(
      res,
      400,
      "VALIDATION_ERROR",
      "กรุณาระบุ title, author, isbn, price และ publisherId ให้ครบถ้วน",
    );
  }

  const duplicated = books.find((b) => b.isbn === isbn);
  if (duplicated) {
    return sendError(
      res,
      409,
      "DUPLICATE_ISBN",
      "รหัส ISBN นี้มีอยู่ในระบบแล้ว",
    );
  }

  const newBook = {
    id: nextBookId++,
    title,
    author,
    isbn,
    price: Number(price),
    publisherId: Number(publisherId),
    categoryIds: Array.isArray(categoryIds) ? categoryIds : [],
  };

  books.push(newBook);
  res.status(201).json({ message: "เพิ่มข้อมูลสำเร็จ", data: newBook });
});

// 4.PUT แก้ไขข้อมูลหนังสือทั้งระเบียน
app.put("/api/v1/books/:id", (req, res) => {
  const id = Number(req.params.id);
  const { title, author, isbn, price, publisherId, categoryIds } = req.body;
  const book = books.find((b) => b.id === id);

  if (!book) {
    return sendError(res, 404, "NOT_FOUND", "ไม่พบข้อมูลหนังสือ");
  }

  if (!title || !author || !isbn || price === undefined || !publisherId) {
    return sendError(
      res,
      400,
      "VALIDATION_ERROR",
      "กรุณาระบุ title, author, isbn, price และ publisherId ให้ครบถ้วน",
    );
  }

  book.title = title;
  book.author = author;
  book.isbn = isbn;
  book.price = Number(price);
  book.publisherId = Number(publisherId);
  book.categoryIds = Array.isArray(categoryIds) ? categoryIds : [];

  res.status(200).json({ message: "แก้ไขข้อมูลสำเร็จ", data: book });
});

// 5.PATCH แก้ไขข้อมูลหนังสือเฉพาะบางส่วน
app.patch("/api/v1/books/:id", (req, res) => {
  const id = Number(req.params.id);
  const book = books.find((b) => b.id === id);

  if (!book) {
    return sendError(res, 404, "NOT_FOUND", "ไม่พบข้อมูลหนังสือ");
  }

  const { title, author, isbn, price, publisherId, categoryIds } = req.body;

  if (title !== undefined) book.title = title;
  if (author !== undefined) book.author = author;
  if (isbn !== undefined) book.isbn = isbn;
  if (price !== undefined) book.price = Number(price);
  if (publisherId !== undefined) book.publisherId = Number(publisherId);
  if (categoryIds !== undefined && Array.isArray(categoryIds))
    book.categoryIds = categoryIds;

  res.status(200).json({ message: "แก้ไขข้อมูลสำเร็จ", data: book });
});

// 6.DELETE ลบข้อมูลหนังสือ
app.delete("/api/v1/books/:id", (req, res) => {
  const id = Number(req.params.id);
  const index = books.findIndex((b) => b.id === id);

  if (index === -1) {
    return sendError(res, 404, "NOT_FOUND", "ไม่พบข้อมูลหนังสือ");
  }

  books.splice(index, 1);
  res.status(200).json({ message: "ลบข้อมูลสำเร็จ" });
});

// REST Routes:Categories&Publishers
app.get("/api/v1/categories", (req, res) => {
  res.status(200).json({ message: "สำเร็จ", data: categories });
});

app.get("/api/v1/publishers", (req, res) => {
  res.status(200).json({ message: "สำเร็จ", data: publishers });
});

// Error
// 404:ไม่พบเส้นทางที่ร้องขอ
app.use((req, res) => {
  res.status(404).json({
    error: { code: "ROUTE_NOT_FOUND", message: "ไม่พบเส้นทางที่ร้องขอ" },
  });
});

// ตัวจัดการข้อผิดพลาดกลาง
app.use((err, req, res, next) => {
  console.error(err.stack);
  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({
    error: {
      code: statusCode === 500 ? "INTERNAL_SERVER_ERROR" : err.type || "ERROR",
      message:
        statusCode === 500
          ? "เกิดข้อผิดพลาดที่ไม่คาดคิดภายในระบบ"
          : err.message,
    },
  });
});

app.listen(PORT, () => {
  console.log(
    `Server กำลังทำงานที่ http://localhost:${PORT} (${process.env.NODE_ENV || "development"})`,
  );
  // ---> ส่วนที่ 3: เพิ่ม Log แจ้งเตือน URL ของ Swagger <---
  console.log(`API Docs พร้อมใช้งานที่ http://localhost:${PORT}/api-docs`);
});
