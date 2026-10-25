// กำหนด URL ของ Backend API
const API_BASE = "http://localhost:3000/api/v1";

const statusEl = document.getElementById("status");
const listEl = document.getElementById("book-list");
const form = document.getElementById("add-book-form");
const alertBox = document.getElementById("alert-box");

// Modal Elements
const editModal = document.getElementById("edit-modal");
const editForm = document.getElementById("edit-book-form");

function showAlert(message, type = "success") {
  alertBox.className = `alert alert-${type}`;
  alertBox.innerText = message;
  alertBox.style.display = "block";
  setTimeout(() => {
    alertBox.style.display = "none";
  }, 4000);
}

// 1. GET: ดึงข้อมูลสำนักพิมพ์มาใส่ใน Dropdown
async function loadPublishers() {
  try {
    const res = await fetch(`${API_BASE}/publishers`);
    const result = await res.json();
    const publishers = result.data || [];

    const selectAdd = document.getElementById("publisherId");
    const selectEdit = document.getElementById("edit-publisherId");

    selectAdd.innerHTML =
      '<option value="">-- กรุณาเลือกสำนักพิมพ์ --</option>';
    selectEdit.innerHTML =
      '<option value="">-- กรุณาเลือกสำนักพิมพ์ --</option>';

    publishers.forEach((pub) => {
      const option1 = new Option(`${pub.publisherName}`, pub.id);
      const option2 = new Option(`${pub.publisherName}`, pub.id);
      selectAdd.add(option1);
      selectEdit.add(option2);
    });
  } catch (err) {
    console.error("โหลดข้อมูลสำนักพิมพ์ไม่สำเร็จ:", err);
  }
}

// 2. GET: ดึงข้อมูลหมวดหมู่มาใส่ใน Dropdown
async function loadCategories() {
  try {
    const res = await fetch(`${API_BASE}/categories`);
    const result = await res.json();
    const categories = result.data || [];

    const selectAdd = document.getElementById("categoryId");
    const selectEdit = document.getElementById("edit-categoryId");

    selectAdd.innerHTML = '<option value="">-- กรุณาเลือกหมวดหมู่ --</option>';
    selectEdit.innerHTML = '<option value="">-- กรุณาเลือกหมวดหมู่ --</option>';

    categories.forEach((cat) => {
      const option1 = new Option(
        `${cat.categoryName} (${cat.categoryCode})`,
        cat.id,
      );
      const option2 = new Option(
        `${cat.categoryName} (${cat.categoryCode})`,
        cat.id,
      );
      selectAdd.add(option1);
      selectEdit.add(option2);
    });
  } catch (err) {
    console.error("โหลดข้อมูลหมวดหมู่ไม่สำเร็จ:", err);
  }
}

// 3. GET: ดึงรายการหนังสือทั้งหมด (GET /api/v1/books)
async function loadBooks() {
  statusEl.textContent = "กำลังโหลดข้อมูล...";
  listEl.innerHTML = "";

  try {
    const res = await fetch(`${API_BASE}/books`);
    if (!res.ok) {
      throw new Error(`เซิร์ฟเวอร์ตอบกลับผิดพลาด: ${res.status}`);
    }
    const result = await res.json();
    const books = result.data || [];

    statusEl.textContent = "";
    if (books.length === 0) {
      listEl.innerHTML = `<tr><td colspan="6" style="text-align:center;">ไม่พบข้อมูลหนังสือ</td></tr>`;
      return;
    }

    books.forEach((book, index) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${index + 1}</td>
        <td><strong>${book.title}</strong></td>
        <td>${book.author}</td>
        <td>${book.isbn}</td>
        <td>${Number(book.price).toFixed(2)} ฿</td>
        <td class="text-center"></td>
      `;

      const actionTd = tr.querySelector("td:last-child");

      // ปุ่มแก้ไข
      const editBtn = document.createElement("button");
      editBtn.className = "btn-warning";
      editBtn.textContent = "แก้ไข";
      editBtn.onclick = () => openEditModal(book.id);

      // ปุ่มลบ
      const deleteBtn = document.createElement("button");
      deleteBtn.className = "btn-danger";
      deleteBtn.textContent = "ลบ";
      deleteBtn.onclick = () => deleteBook(book.id);

      actionTd.appendChild(editBtn);
      actionTd.appendChild(deleteBtn);
      listEl.appendChild(tr);
    });
  } catch (err) {
    statusEl.textContent = `โหลดข้อมูลไม่สำเร็จ: ${err.message}`;
  }
}

// 4. POST: เพิ่มหนังสือใหม่ (POST /api/v1/books)
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const title = document.getElementById("title").value.trim();
  const author = document.getElementById("author").value.trim();
  const isbn = document.getElementById("isbn").value.trim();
  const price = parseFloat(document.getElementById("price").value);
  const publisherId = parseInt(document.getElementById("publisherId").value);
  const categoryId = parseInt(document.getElementById("categoryId").value);

  if (
    !title ||
    !author ||
    !isbn ||
    isNaN(price) ||
    isNaN(publisherId) ||
    isNaN(categoryId)
  ) {
    showAlert("กรุณากรอกข้อมูลให้ครบถ้วนทุกช่อง", "error");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/books`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        author,
        isbn,
        price,
        publisherId,
        categoryIds: [categoryId],
      }),
    });

    const resData = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errorMessage =
        resData.error?.message ||
        resData.message ||
        `เซิร์ฟเวอร์ตอบกลับผิดพลาด: ${res.status}`;
      throw new Error(errorMessage);
    }

    showAlert("เพิ่มหนังสือใหม่เข้าสู่ระบบสำเร็จ!", "success");
    form.reset();
    loadBooks();
  } catch (err) {
    showAlert(`บันทึกไม่สำเร็จ: ${err.message}`, "error");
  }
});

// 5. GET Single Book & Open Modal: ดึงข้อมูลเล่มที่จะแก้มาใส่ในฟอร์ม Modal
async function openEditModal(id) {
  try {
    const res = await fetch(`${API_BASE}/books/${id}`);
    const result = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errorMsg =
        result.error?.message ||
        result.message ||
        `เซิร์ฟเวอร์ตอบกลับผิดพลาด: ${res.status}`;
      throw new Error(errorMsg);
    }

    const book = result.data;
    if (!book) {
      throw new Error("ไม่พบข้อมูลหนังสือ");
    }

    // เติมข้อมูลลงในฟอร์ม Modal
    document.getElementById("edit-id").value = book.id;
    document.getElementById("edit-title").value = book.title || "";
    document.getElementById("edit-author").value = book.author || "";
    document.getElementById("edit-isbn").value = book.isbn || "";
    document.getElementById("edit-price").value = book.price || 0;
    document.getElementById("edit-publisherId").value = book.publisherId || "";

    // ตั้งค่า categoryId ถ้ามีข้อมูล categories ส่งกลับมา
    if (book.categories && book.categories.length > 0) {
      document.getElementById("edit-categoryId").value = book.categories[0].id;
    }

    // เปิด Pop-up Modal
    editModal.style.display = "flex";
  } catch (err) {
    showAlert(`เกิดข้อผิดพลาด: ${err.message}`, "error");
  }
}

function closeEditModal() {
  editModal.style.display = "none";
}

// 6. PUT: บันทึกการแก้ไขหนังสือ (PUT /api/v1/books/:id)
editForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const id = document.getElementById("edit-id").value;
  const title = document.getElementById("edit-title").value.trim();
  const author = document.getElementById("edit-author").value.trim();
  const isbn = document.getElementById("edit-isbn").value.trim();
  const price = parseFloat(document.getElementById("edit-price").value);
  const publisherId = parseInt(
    document.getElementById("edit-publisherId").value,
  );
  const categoryId = parseInt(document.getElementById("edit-categoryId").value);

  try {
    const res = await fetch(`${API_BASE}/books/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        author,
        isbn,
        price,
        publisherId,
        categoryIds: [categoryId],
      }),
    });

    const resData = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errorMessage =
        resData.error?.message ||
        resData.message ||
        `แก้ไขไม่สำเร็จ: ${res.status}`;
      throw new Error(errorMessage);
    }

    showAlert("แก้ไขข้อมูลหนังสือเรียบร้อยแล้ว!", "success");
    closeEditModal();
    loadBooks();
  } catch (err) {
    showAlert(`แก้ไขไม่สำเร็จ: ${err.message}`, "error");
  }
});

// 7. DELETE: ลบข้อมูลหนังสือ (DELETE /api/v1/books/:id)
async function deleteBook(id) {
  if (!confirm("ยืนยันการลบหนังสือเล่มนี้?")) return;

  try {
    const res = await fetch(`${API_BASE}/books/${id}`, { method: "DELETE" });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.error?.message || `ลบไม่สำเร็จ: ${res.status}`);
    }

    showAlert("ลบข้อมูลหนังสือเรียบร้อยแล้ว", "success");
    loadBooks();
  } catch (err) {
    showAlert(`ลบไม่สำเร็จ: ${err.message}`, "error");
  }
}

// เรียกดึงข้อมูลทั้งหมดเมื่อเริ่มโหลดหน้าเว็บ
loadPublishers();
loadCategories();
loadBooks();
