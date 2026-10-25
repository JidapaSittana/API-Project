CREATE DATABASE IF NOT EXISTS books_db;
USE books_db;

-- ตารางสำนักพิมพ์ (Publishers)
CREATE TABLE publishers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  publisher_name VARCHAR(150) NOT NULL,
  contact_email VARCHAR(100) NOT NULL
);

-- ตารางหมวดหมู่หนังสือ (Categories)
CREATE TABLE categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  category_code VARCHAR(50) NOT NULL UNIQUE,
  category_name VARCHAR(100) NOT NULL
);

-- ตารางหนังสือ (Books:Resource หลัก)
CREATE TABLE books (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  author VARCHAR(150) NOT NULL,
  isbn VARCHAR(50) NOT NULL UNIQUE,
  price DECIMAL(10, 2) NOT NULL,
  publisher_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (publisher_id) REFERENCES publishers(id) ON DELETE CASCADE
);

-- ตารางตารางกลางเชื่อมความสัมพันธ์ N:M ระหว่างหนังสือกับหมวดหมู่ (Book Categories Mapping)
CREATE TABLE book_categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  book_id INT NOT NULL,
  category_id INT NOT NULL,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
  UNIQUE KEY unique_book_category (book_id, category_id)
);