require("dotenv").config();

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const helmet = require("helmet");
const swaggerUi = require("swagger-ui-express");
const YAML = require("yamljs");
const path = require("path");

// อิมพอร์ต pool จาก db.js
const pool = require("./db");

// บริการเสริมภายนอก
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

// Swagger UI
const swaggerDocument = YAML.load(path.join(__dirname, "../openapi.yaml"));
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Helper function จัดการ Error Response
function sendError(res, statusCode, code, message) {
  return res.status(statusCode).json({ error: { code, message } });
}

// REST Routes: Books Resource (MySQL)

// 1. GET ดึงหนังสือทั้งหมดจาก MySQL
app.get("/api/v1/books", async (req, res, next) => {
  try {
    const { category } = req.query;
    let sql =
      "SELECT id, title, author, isbn, price, publisher_id AS publisherId FROM books";
    let params = [];

    if (category) {
      sql = `
        SELECT b.id, b.title, b.author, b.isbn, b.price, b.publisher_id AS publisherId 
        FROM books b
        JOIN book_categories bc ON b.id = bc.book_id
        JOIN categories c ON bc.category_id = c.id
        WHERE LOWER(c.category_code) = LOWER(?) OR c.category_name = ?
      `;
      params = [category, category];
    }

    const [rows] = await pool.query(sql, params);
    res.status(200).json({ message: "สำเร็จ", data: rows });
  } catch (err) {
    next(err);
  }
});

// 2. GET ดึงหนังสือตาม ID (แก้ไขตัดส่วนดึงรูปปกออกแล้ว)
app.get("/api/v1/books/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [rows] = await pool.query(
      "SELECT id, title, author, isbn, price, publisher_id AS publisherId FROM books WHERE id = ?",
      [id],
    );

    if (rows.length === 0) {
      return sendError(res, 404, "NOT_FOUND", "ไม่พบข้อมูลหนังสือ");
    }

    let resultData = { ...rows[0] };
    const includes = req.query.include ? req.query.include.split(",") : [];

    if (includes.includes("publisher")) {
      const [pub] = await pool.query(
        "SELECT id, publisher_name AS publisherName, contact_email AS contactEmail FROM publishers WHERE id = ?",
        [resultData.publisherId],
      );
      resultData.publisher = pub[0] || null;
    }

    if (includes.includes("categories")) {
      const [cats] = await pool.query(
        `SELECT c.id, c.category_code AS categoryCode, c.category_name AS categoryName 
         FROM categories c 
         JOIN book_categories bc ON c.id = bc.category_id 
         WHERE bc.book_id = ?`,
        [id],
      );
      resultData.categories = cats;
    }

    res.status(200).json({ message: "สำเร็จ", data: resultData });
  } catch (err) {
    next(err);
  }
});

// 3. POST เพิ่มหนังสือใหม่ลง MySQL
app.post("/api/v1/books", async (req, res, next) => {
  try {
    const { title, author, isbn, price, publisherId, categoryIds } = req.body;

    if (!title || !author || !isbn || price === undefined || !publisherId) {
      return sendError(
        res,
        400,
        "VALIDATION_ERROR",
        "กรุณาระบุ title, author, isbn, price และ publisherId ให้ครบถ้วน",
      );
    }

    // ตรวจสอบ ISBN ซ้ำ
    const [duplicated] = await pool.query(
      "SELECT id FROM books WHERE isbn = ?",
      [isbn],
    );
    if (duplicated.length > 0) {
      return sendError(
        res,
        409,
        "DUPLICATE_ISBN",
        "รหัส ISBN นี้มีอยู่ในระบบแล้ว",
      );
    }

    // บันทึกลงตาราง books
    const [result] = await pool.query(
      "INSERT INTO books (title, author, isbn, price, publisher_id) VALUES (?, ?, ?, ?, ?)",
      [title, author, isbn, Number(price), Number(publisherId)],
    );

    const newBookId = result.insertId;

    // บันทึกตารางเชื่อม book_categories
    if (Array.isArray(categoryIds) && categoryIds.length > 0) {
      for (const catId of categoryIds) {
        const [catCheck] = await pool.query(
          "SELECT id FROM categories WHERE id = ?",
          [catId],
        );
        if (catCheck.length > 0) {
          await pool.query(
            "INSERT INTO book_categories (book_id, category_id) VALUES (?, ?)",
            [newBookId, catId],
          );
        }
      }
    }

    res.status(201).json({
      message: "เพิ่มข้อมูลสำเร็จ",
      data: {
        id: newBookId,
        title,
        author,
        isbn,
        price: Number(price),
        publisherId: Number(publisherId),
        categoryIds: Array.isArray(categoryIds) ? categoryIds : [],
      },
    });
  } catch (err) {
    next(err);
  }
});

// 4. PUT แก้ไขข้อมูลหนังสือทั้งระเบียน
app.put("/api/v1/books/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { title, author, isbn, price, publisherId, categoryIds } = req.body;

    if (!title || !author || !isbn || price === undefined || !publisherId) {
      return sendError(
        res,
        400,
        "VALIDATION_ERROR",
        "กรุณาระบุ title, author, isbn, price และ publisherId ให้ครบถ้วน",
      );
    }

    const [result] = await pool.query(
      "UPDATE books SET title = ?, author = ?, isbn = ?, price = ?, publisher_id = ? WHERE id = ?",
      [title, author, isbn, Number(price), Number(publisherId), id],
    );

    if (result.affectedRows === 0) {
      return sendError(res, 404, "NOT_FOUND", "ไม่พบข้อมูลหนังสือ");
    }

    if (Array.isArray(categoryIds)) {
      await pool.query("DELETE FROM book_categories WHERE book_id = ?", [id]);
      for (const catId of categoryIds) {
        const [catCheck] = await pool.query(
          "SELECT id FROM categories WHERE id = ?",
          [catId],
        );
        if (catCheck.length > 0) {
          await pool.query(
            "INSERT INTO book_categories (book_id, category_id) VALUES (?, ?)",
            [id, catId],
          );
        }
      }
    }

    res.status(200).json({
      message: "แก้ไขข้อมูลสำเร็จ",
      data: {
        id,
        title,
        author,
        isbn,
        price: Number(price),
        publisherId: Number(publisherId),
        categoryIds,
      },
    });
  } catch (err) {
    next(err);
  }
});

// 5. PATCH แก้ไขข้อมูลหนังสือเฉพาะบางส่วน
app.patch("/api/v1/books/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { title, author, isbn, price, publisherId, categoryIds } = req.body;

    const [existing] = await pool.query("SELECT * FROM books WHERE id = ?", [
      id,
    ]);
    if (existing.length === 0) {
      return sendError(res, 404, "NOT_FOUND", "ไม่พบข้อมูลหนังสือ");
    }

    let updates = [];
    let params = [];

    if (title !== undefined) {
      updates.push("title = ?");
      params.push(title);
    }
    if (author !== undefined) {
      updates.push("author = ?");
      params.push(author);
    }
    if (isbn !== undefined) {
      updates.push("isbn = ?");
      params.push(isbn);
    }
    if (price !== undefined) {
      updates.push("price = ?");
      params.push(Number(price));
    }
    if (publisherId !== undefined) {
      updates.push("publisher_id = ?");
      params.push(Number(publisherId));
    }

    if (updates.length > 0) {
      params.push(id);
      await pool.query(
        `UPDATE books SET ${updates.join(", ")} WHERE id = ?`,
        params,
      );
    }

    if (categoryIds !== undefined && Array.isArray(categoryIds)) {
      await pool.query("DELETE FROM book_categories WHERE book_id = ?", [id]);
      for (const catId of categoryIds) {
        const [catCheck] = await pool.query(
          "SELECT id FROM categories WHERE id = ?",
          [catId],
        );
        if (catCheck.length > 0) {
          await pool.query(
            "INSERT INTO book_categories (book_id, category_id) VALUES (?, ?)",
            [id, catId],
          );
        }
      }
    }

    const [updatedRows] = await pool.query(
      "SELECT id, title, author, isbn, price, publisher_id AS publisherId FROM books WHERE id = ?",
      [id],
    );

    res
      .status(200)
      .json({ message: "แก้ไขข้อมูลสำเร็จ", data: updatedRows[0] });
  } catch (err) {
    next(err);
  }
});

// 6. DELETE ลบหนังสือออกจาก MySQL
app.delete("/api/v1/books/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    // ลบความสัมพันธ์ในตาราง book_categories ก่อนลบหนังสือ เพื่อป้องกัน Foreign Key Error
    await pool.query("DELETE FROM book_categories WHERE book_id = ?", [id]);

    const [result] = await pool.query("DELETE FROM books WHERE id = ?", [id]);

    if (result.affectedRows === 0) {
      return sendError(res, 404, "NOT_FOUND", "ไม่พบข้อมูลหนังสือ");
    }

    res.status(200).json({ message: "ลบข้อมูลสำเร็จ" });
  } catch (err) {
    next(err);
  }
});

// 7. GET Enrichment
app.get("/api/v1/books/:id/enrichment", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [rows] = await pool.query("SELECT isbn FROM books WHERE id = ?", [
      id,
    ]);

    if (rows.length === 0) {
      return sendError(res, 404, "NOT_FOUND", "ไม่พบข้อมูลหนังสือ");
    }

    const enrichment = await getBookEnrichment(rows[0].isbn);

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

// REST Routes: Categories & Publishers
app.get("/api/v1/categories", async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, category_code AS categoryCode, category_name AS categoryName FROM categories",
    );
    res.status(200).json({ message: "สำเร็จ", data: rows });
  } catch (err) {
    next(err);
  }
});

app.get("/api/v1/publishers", async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, publisher_name AS publisherName, contact_email AS contactEmail FROM publishers",
    );
    res.status(200).json({ message: "สำเร็จ", data: rows });
  } catch (err) {
    next(err);
  }
});

// 404 Not Found
app.use((req, res) => {
  res.status(404).json({
    error: { code: "ROUTE_NOT_FOUND", message: "ไม่พบเส้นทางที่ร้องขอ" },
  });
});

// Centralized Error Handler
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
  console.log(`API Docs พร้อมใช้งานที่ http://localhost:${PORT}/api-docs`);
});
