USE books_db;

-- เพิ่มข้อมูลสำนักพิมพ์
INSERT INTO publishers (publisher_name, contact_email) VALUES
  ('SE-ED Publishing', 'contact@se-ed.com'),
  ('Chula Press', 'press@chula.ac.th');

-- เพิ่มข้อมูลหมวดหมู่หนังสือ
INSERT INTO categories (category_code, category_name) VALUES
  ('TECH', 'เทคโนโลยี'),
  ('NOVEL', 'นวนิยาย');

-- เพิ่มข้อมูลหนังสือ
INSERT INTO books (title, author, isbn, price, publisher_id) VALUES
  ('Node.js REST API Design', 'สมชาย ใจดี', '978-1-123456-01-0', 350.00, 1),
  ('Basic Database & SQL', 'สมหญิง รักเรียน', '978-1-123456-02-7', 280.00, 2);

-- เพิ่มข้อมูลการจัดหมวดหมู่หนังสือ (Many-to-Many)
INSERT INTO book_categories (book_id, category_id) VALUES
  (1, 1), -- เล่มที่ 1 อยู่หมวดหมู่เทคโนโลยี
  (1, 2), -- เล่มที่ 1 อยู่หมวดหมู่นวนิยายด้วย
  (2, 1); -- เล่มที่ 2 อยู่หมวดหมู่เทคโนโลยี