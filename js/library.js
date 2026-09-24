const addBorrow = document.getElementById("addBorrow");
const addBorrowModal = document.getElementById("addBorrowModal");
const closeAddBorrowModal = document.getElementById("closeAddBorrowModal");
const cancelAddBorrowModal = document.getElementById("cancelAddBorrowModal");

cancelAddBorrowModal?.addEventListener("click", () => {
  if (addBorrowModal) addBorrowModal.style.display = "none";
});

closeAddBorrowModal?.addEventListener("click", () => {
  if (addBorrowModal) addBorrowModal.style.display = "none";
});

window.addEventListener("click", (e) => {
  if (addBorrowModal && e.target === addBorrowModal) {
    addBorrowModal.style.display = "none";
  }
});

const returnBorrowModal = document.getElementById("returnBorrowModal");

window.addEventListener("click", (e) => {
  if (returnBorrowModal && e.target === returnBorrowModal) {
    returnBorrowModal.style.display = "none";
  }
});

const bookModal = document.getElementById("bookModal");
const cancelBookModal = document.getElementById("cancelBookModal");
const openBookModal = document.getElementById("addBook");
const closeBookModal = document.getElementById("closeBookModal");

openBookModal?.addEventListener("click", async () => {
  if (bookModal) bookModal.style.display = "flex";
  if (typeof lockBodyScroll === "function") lockBodyScroll();
  if (typeof loadDepartmentDropdown === "function")
    await loadDepartmentDropdown();
});

closeBookModal?.addEventListener("click", () => {
  if (bookModal) bookModal.style.display = "none";
  if (typeof unLockBodyScroll === "function") unLockBodyScroll();
});

cancelBookModal?.addEventListener("click", () => {
  if (bookModal) bookModal.style.display = "none";
  if (typeof unLockBodyScroll === "function") unLockBodyScroll();
});

window.addEventListener("click", (e) => {
  if (bookModal && e.target === bookModal) {
    bookModal.style.display = "none";
    if (typeof unLockBodyScroll === "function") unLockBodyScroll();
  }
});

const viewBookModal = document.getElementById("viewBookModal");
const closeViewBookModal = document.getElementById("closeViewBookModal");
const closeViewBtn = document.getElementById("closeViewBtn");

closeViewBookModal?.addEventListener("click", () => {
  if (viewBookModal) viewBookModal.style.display = "none";
  if (typeof unLockBodyScroll === "function") unLockBodyScroll();
});

closeViewBtn?.addEventListener("click", () => {
  if (viewBookModal) viewBookModal.style.display = "none";
  if (typeof unLockBodyScroll === "function") unLockBodyScroll();
});

window.addEventListener("click", (e) => {
  if (viewBookModal && e.target === viewBookModal) {
    viewBookModal.style.display = "none";
    if (typeof unLockBodyScroll === "function") unLockBodyScroll();
  }
});

const closeEditBookModal = document.getElementById("closeEditBookModal");
const cancelEditBookModal = document.getElementById("cancelEditBookModal");
const editBookModal = document.getElementById("editBookModal");
const editButtons = document.querySelectorAll(".edit");

editButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (editBookModal) editBookModal.style.display = "flex";
    if (typeof lockBodyScroll === "function") lockBodyScroll();
  });
});

closeEditBookModal?.addEventListener("click", () => {
  if (editBookModal) editBookModal.style.display = "none";
  if (typeof unLockBodyScroll === "function") unLockBodyScroll();
});

cancelEditBookModal?.addEventListener("click", () => {
  if (editBookModal) editBookModal.style.display = "none";
  if (typeof unLockBodyScroll === "function") unLockBodyScroll();
});

window.addEventListener("click", (e) => {
  if (editBookModal && e.target === editBookModal) {
    editBookModal.style.display = "none";
    if (typeof unLockBodyScroll === "function") unLockBodyScroll();
  }
});

function compressImageToBlob(file, maxWidth = 800, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;

      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error("Canvas encoding failed."));
            }
          },
          "image/jpeg",
          quality,
        );
      };

      img.onerror = (err) => reject(err);
    };

    reader.onerror = (err) => reject(err);
  });
}

const addFileInput = document.getElementById("addAvatarInput");
const addFileNameText = document.getElementById("addFileNameDisplay");
const addPreviewImg = document.getElementById("addAvatarPreview");

if (addFileInput) {
  addFileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      if (addFileNameText) addFileNameText.textContent = file.name;

      const reader = new FileReader();
      reader.onload = (event) => {
        if (addPreviewImg) addPreviewImg.src = event.target.result;
      };
      reader.readAsDataURL(file);
    }
  });
}

function resetAddUserPreview() {
  const addPreviewImg = document.getElementById("addAvatarPreview");
  const addFileNameText = document.getElementById("addFileNameDisplay");

  if (addPreviewImg) addPreviewImg.src = "assets/default-avatar.png";
  if (addFileNameText) addFileNameText.textContent = "No file chosen";
}

const bookForm = document.getElementById("BookForm");
const saveBookBtn = document.getElementById("saveBook");

if (bookForm) {
  bookForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    await handleSaveBook();
  });
}

if (saveBookBtn) {
  saveBookBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    await handleSaveBook();
  });
}

async function handleSaveBook() {
  const saveButton = document.getElementById("saveBook");

  // Extract values from your modal inputs
  const book_code = document.getElementById("bookCode").value.trim();
  const title = document.getElementById("bookTitle").value.trim();
  const author = document.getElementById("bookAuthor").value.trim();
  const department_id = document.getElementById("bookDepartment").value;
  const copies_total = document
    .getElementById("bookNumberOfCopies")
    .value.trim();
  const shelf_location = document
    .getElementById("bookShelfLocation")
    .value.trim();
  const description = document.getElementById("bookDescription").value.trim();
  const statusInput = document.getElementById("bookStatus");
  const status = statusInput
    ? statusInput.value.trim().toLowerCase()
    : "active";

  // Basic validation
  if (
    !book_code ||
    !title ||
    !author ||
    !department_id ||
    !copies_total ||
    !status
  ) {
    showToast("Please fill in all required fields marked with *", "error");
    return;
  }

  if (department_id === "Select Category" || !department_id) {
    showToast("Please select a valid department category.", "error");
    return;
  }

  if (
    !status ||
    status === "select status" ||
    status === "select" ||
    (status !== "active" && status !== "inactive")
  ) {
    showToast("Please select a valid status (Active or Inactive).", "error");
    return;
  }

  saveButton.disabled = true;
  saveButton.textContent = "Saving Book...";

  try {
    const photoInput = document.getElementById("addAvatarInput");
    let coverBase64 = null;

    if (photoInput && photoInput.files[0]) {
      saveButton.textContent = "Compressing cover...";
      const compressedBlob = await compressImageToBlob(
        photoInput.files[0],
        800,
        0.7,
      );
      coverBase64 = await blobToBase64(compressedBlob);
    }

    saveButton.textContent = "Inserting into database...";

    const {
      data: { user },
      error: authError,
    } = await window.supabaseClient.auth.getUser();
    if (authError) throw authError;

    const { data: profile, error: profileError } = await window.supabaseClient
      .from("profiles")
      .select("school_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile)
      throw new Error("Could not determine user school.");

    const schoolId = profile.school_id;

    const { data, error } = await window.supabaseClient.from("books").insert([
      {
        school_id: schoolId,
        book_code: book_code,
        title: title,
        author: author,
        department_id: department_id,
        total_copies: parseInt(copies_total, 10),
        available_copies: parseInt(copies_total, 10),
        shelf_location: shelf_location || null,
        description: description || null,
        cover_image_url: coverBase64,
        status: status,
      },
    ]);

    if (error) throw error;

    await logActivity(schoolId, `New Book Added: ${title}`, "green");

    showToast("Book added successfully!", "success");

    subscribeToRecentActivities(schoolId);

    bookForm.reset();

    const avatarPreview = document.getElementById("addAvatarPreview");
    if (avatarPreview) {
      avatarPreview.src = "https://cdn-icons-png.flaticon.com/512/29/29302.png";
    }
    const fileNameText = document.getElementById("addFileNameDisplay");
    if (fileNameText) {
      fileNameText.textContent = "No new file chosen";
    }

    await loadBooksTable();
  } catch (err) {
    console.error("Error saving book:", err);
    showToast(err.message || "Failed to save book.", "error");
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = "Save Book";
  }
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function loadDepartmentDropdown() {
  const departmentSelect = document.getElementById("bookDepartment");
  if (!departmentSelect) return;

  try {
    const { data: departments, error } = await supabaseClient
      .from("departments")
      .select("id, name")
      .order("name", { ascending: true })
      .eq("status", "active");

    if (error) throw error;

    departmentSelect.innerHTML = '<option value="">Select Department</option>';

    if (departments && departments.length > 0) {
      departments.forEach((dept) => {
        const option = document.createElement("option");
        option.value = dept.id; // Usually the UUID or primary key
        option.textContent = dept.name; // The display name
        departmentSelect.appendChild(option);
      });
    } else {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "No departments found";
      departmentSelect.appendChild(option);
    }
  } catch (err) {
    console.error("Error loading departments:", err);
    showToast("Failed to load departments.", "error");
  }
}

function renderTableLoading() {
  const tableBody = document.querySelector("#booksTableBody");
  if (!tableBody) return;

  tableBody.innerHTML = `
    <tr>
      <td colspan="9" style="text-align: center; padding: 2rem; color: #64748b;">
        <i class="fa-solid fa-spinner fa-spin" style="margin-right: 0.5rem;"></i>
        Loading books...
      </td>
    </tr>
  `;
}

async function loadBooksTable() {
  renderTableLoading();
  const tableBody = document.getElementById("booksTableBody");
  if (!tableBody) return;

  try {
    // 1. Fetch books and departments
    const { data: books, error } = await window.supabaseClient
      .from("books")
      .select(
        `
        *,
        departments (
          name
        )
      `,
      )
      .order("created_at", { ascending: false });

    if (error) throw error;

    // 2. Fetch all active borrowings to calculate availability dynamically
    const { data: allBorrowings, error: borrowError } =
      await window.supabaseClient
        .from("book_borrowings")
        .select("book_id, status")
        .eq("status", "borrowed");

    if (borrowError) throw borrowError;

    tableBody.innerHTML = "";

    if (!books || books.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align: center; padding: 20px; color: #666;">
            No books found in the library inventory.
          </td>
        </tr>
      `;
      return;
    }

    books.forEach((book) => {
      const tr = document.createElement("tr");

      const coverSrc =
        book.cover_image_url ||
        "https://cdn-icons-png.flaticon.com/512/29/29302.png";
      const departmentName = book.departments ? book.departments.name : "-";

      // 3. Calculate how many copies are currently borrowed for this specific book
      const activeBorrowedCount = allBorrowings
        ? allBorrowings.filter((b) => b.book_id === book.id).length
        : 0;

      const totalCopies = book.total_copies || 0;
      // 4. Compute true available copies
      const availableCopies = Math.max(0, totalCopies - activeBorrowedCount);

      tr.innerHTML = `
        <td>
          <img
            src="${coverSrc}"
            alt="Book Cover"
            onerror="
              this.onerror = null;
              this.src = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
            "
            class="book-photo"
          />
        </td>
        <td>${escapeHtml(book.book_code)}</td>
        <td>${escapeHtml(book.title)}</td>
        <td>${escapeHtml(book.author)}</td>
        <td>${escapeHtml(departmentName)}</td>
        <td>${totalCopies}</td>
        <td>${availableCopies}</td>
        <td><span class="books-status-${(book.status || "inactive").toLowerCase()}">
          ${book.status || "Inactive"}
        </span></td>
        <td>
         <button class="books-actions-btn edit" data-id="${book.id}">
            <i class="fa-solid fa-pen"></i>
          </button>

          <button class="books-actions-btn view" data-id="${book.id}">
            <i class="fa-solid fa-eye"></i>
          </button>
        </td>
      `;

      tableBody.appendChild(tr);
    });

    attachBookActionListeners();
  } catch (err) {
    console.error("Error loading books table:", err);
    showToast("Failed to load library inventory.", "error");
  }
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function attachBookActionListeners() {
  const viewButtons = document.querySelectorAll("#booksTableBody .view");
  const editButtons = document.querySelectorAll("#booksTableBody .edit");

  editButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const bookId = button.getAttribute("data-id");
      if (bookId) {
        openEditBookModal(bookId);
      }
    });
  });

  viewButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const bookId = button.getAttribute("data-id");
      if (bookId) {
        openViewBookModal(bookId);
      }
    });
  });
}

const editFileInput = document.getElementById("editAvatarInput");
const editFileNameText = document.getElementById("fileNameDisplay");
const editPreviewImg = document.getElementById("editAvatarPreview");

if (editFileInput) {
  editFileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      if (editFileNameText) editFileNameText.textContent = file.name;

      const reader = new FileReader();
      reader.onload = (event) => {
        if (editPreviewImg) editPreviewImg.src = event.target.result;
      };
      reader.readAsDataURL(file);
    }
  });
}

let currentOriginalBookData = null;

async function openEditBookModal(bookId) {
  const editBookModal = document.getElementById("editBookModal");
  if (!editBookModal) return;

  editBookModal.style.display = "flex";
  lockBodyScroll();

  try {
    await loadEditDepartmentDropdown();

    const { data: book, error } = await window.supabaseClient
      .from("books")
      .select("*")
      .eq("id", bookId)
      .single();

    if (error) throw error;
    if (!book) throw new Error("Book not found.");

    currentOriginalBookData = book;

    document.getElementById("editBookId").value = book.id;
    document.getElementById("editBookCode").textContent = book.book_code || "-";
    document.getElementById("editBookTitle").value = book.title || "";
    document.getElementById("editBookAuthor").value = book.author || "";
    document.getElementById("editBookDepartment").value =
      book.department_id || "";
    document.getElementById("editBookNumberOfCopies").value =
      book.total_copies || 0;
    document.getElementById("editBookShelfLocation").value =
      book.shelf_location || "";
    document.getElementById("editBookDescription").value =
      book.description || "";
    document.getElementById("editBookStatus").value = book.status || "active";

    const previewImg = document.getElementById("editAvatarPreview");
    if (previewImg) {
      previewImg.src =
        book.cover_image_url ||
        "https://cdn-icons-png.flaticon.com/512/29/29302.png";
    }

    if (editFileNameText) {
      editFileNameText.textContent = "No new file chosen";
    }
  } catch (err) {
    console.error("Error loading book for editing:", err);
    showToast(err.message || "Failed to load book data.", "error");
  }
}

async function loadEditDepartmentDropdown() {
  const deptSelect = document.getElementById("editBookDepartment");
  if (!deptSelect) return;

  try {
    const { data: departments, error } = await window.supabaseClient
      .from("departments")
      .select("id, name")
      .order("name", { ascending: true })
      .eq("status", "active");

    if (error) throw error;

    deptSelect.innerHTML = '<option value="">Select Department</option>';

    if (departments && departments.length > 0) {
      departments.forEach((dept) => {
        const option = document.createElement("option");
        option.value = dept.id;
        option.textContent = dept.name;
        deptSelect.appendChild(option);
      });
    }
  } catch (err) {
    console.error("Error fetching departments for edit:", err);
  }
}

const updateBookBtn = document.getElementById("editBook");

if (updateBookBtn) {
  updateBookBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    await handleUpdateBook();
  });
}

async function handleUpdateBook() {
  const saveBtn = document.getElementById("editBook");
  const bookId = document.getElementById("editBookId").value;

  if (!bookId) {
    showToast("Invalid book ID.", "error");
    return;
  }

  const title = document.getElementById("editBookTitle").value.trim();
  const author = document.getElementById("editBookAuthor").value.trim();
  const department_id = document.getElementById("editBookDepartment").value;
  const copies_total = document
    .getElementById("editBookNumberOfCopies")
    .value.trim();
  const shelf_location = document
    .getElementById("editBookShelfLocation")
    .value.trim();
  const description = document
    .getElementById("editBookDescription")
    .value.trim();
  const status = document.getElementById("editBookStatus").value.toLowerCase();

  if (!title || !author || !department_id || !copies_total) {
    showToast("Please fill in all required fields marked with *", "error");
    return;
  }

  if (department_id === "Select Department" || !department_id) {
    showToast("Please select a valid department.", "error");
    return;
  }

  if (
    !status ||
    status === "select status" ||
    (status !== "active" && status !== "inactive")
  ) {
    showToast("Please select a valid status (Active or Inactive).", "error");
    return;
  }

  const photoInput = document.getElementById("editAvatarInput");
  const hasNewImage = photoInput && photoInput.files[0];

  if (currentOriginalBookData) {
    const isUnchanged =
      title === (currentOriginalBookData.title || "") &&
      author === (currentOriginalBookData.author || "") &&
      department_id === (currentOriginalBookData.department_id || "") &&
      parseInt(copies_total, 10) ===
        (currentOriginalBookData.total_copies || 0) &&
      shelf_location === (currentOriginalBookData.shelf_location || "") &&
      description === (currentOriginalBookData.description || "") &&
      status === (currentOriginalBookData.status || "active").toLowerCase() &&
      !hasNewImage;

    if (isUnchanged) {
      showToast("No changes detected.", "info");
      return;
    }
  }

  saveBtn.disabled = true;
  saveBtn.textContent = "Updating...";

  try {
    const photoInput = document.getElementById("editAvatarInput");
    let coverBase64 = null;

    // Compress new cover if user uploaded one
    if (photoInput && photoInput.files[0]) {
      saveBtn.textContent = "Compressing cover...";
      const compressedBlob = await compressImageToBlob(
        photoInput.files[0],
        800,
        0.7,
      );
      coverBase64 = await blobToBase64(compressedBlob);
    }

    // If your modal already displays the borrowed count or you have it in an object, grab it here:
    const currentBorrowed =
      currentOriginalBookData && currentOriginalBookData.active_borrowed_count
        ? currentOriginalBookData.active_borrowed_count
        : 0;

    const newTotal = parseInt(copies_total, 10);

    // Calculate available copies dynamically
    const newAvailable = Math.max(0, newTotal - currentBorrowed);

    const updateData = {
      title: title,
      author: author,
      department_id: department_id,
      total_copies: parseInt(copies_total, 10),
      available_copies: newAvailable,
      shelf_location: shelf_location || null,
      description: description || null,
      status: status,
    };

    if (coverBase64) {
      updateData.cover_image_url = coverBase64;
    }

    saveBtn.textContent = "Saving to database...";

    const { error } = await window.supabaseClient
      .from("books")
      .update(updateData)
      .eq("id", bookId);

    if (error) throw error;

    showToast("Book updated successfully!", "success");

    const editBookModal = document.getElementById("editBookModal");
    if (editBookModal) {
      editBookModal.style.display = "none";
      unLockBodyScroll();
    }

    if (typeof loadBooksTable === "function") {
      await loadBooksTable();
    }
  } catch (err) {
    console.error("Error updating book:", err);
    showToast(err.message || "Failed to update book.", "error");
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "Update Book";
  }
}

let currentViewBookId = null;

async function openViewBookModal(bookId) {
  currentViewBookId = bookId;
  const modal = document.getElementById("viewBookModal");
  if (!modal) return;

  modal.style.display = "flex";
  if (typeof lockBodyScroll === "function") lockBodyScroll();

  try {
    const { data: book, error: bookError } = await window.supabaseClient
      .from("books")
      .select(
        `
        *,
        departments ( name )
      `,
      )
      .eq("id", bookId)
      .single();

    if (bookError) throw bookError;

    const coverImgElement = document.getElementById("viewBookCover");
    if (coverImgElement) {
      coverImgElement.src =
        book.cover_image_url ||
        "https://cdn-icons-png.flaticon.com/512/29/29302.png";
    }

    const statusBadge = document.getElementById("viewBookStatus");
    if (statusBadge) {
      const bookStatus = (book.status || "active").toLowerCase();
      statusBadge.textContent =
        bookStatus.charAt(0).toUpperCase() + bookStatus.slice(1);

      statusBadge.className = `view-book-status books-status-${bookStatus}`;
    }
    document.getElementById("viewBookCode").textContent = book.book_code || "-";
    document.getElementById("viewBookTitle").textContent = book.title || "-";
    document.getElementById("viewBookAuthor").textContent = book.author || "-";
    document.getElementById("viewBookCategory").textContent = book.departments
      ? book.departments.name
      : "-";
    document.getElementById("viewBookShelf").textContent =
      book.shelf_location || "-";
    document.getElementById("viewBookDescription").textContent =
      book.description || "-";

    // 1. Fetch borrowings first (move this block up before calculating copies)
    const { data: borrowings, error: borrowError } = await window.supabaseClient
      .from("book_borrowings")
      .select(`*, profiles ( full_name )`)
      .eq("book_id", bookId)
      .order("created_at", { ascending: false });

    if (borrowError) throw borrowError;

    // 2. Count active borrowings dynamically from the fetched records
    const currentlyBorrowed = borrowings
      ? borrowings.filter((r) => r.status === "borrowed").length
      : 0;

    const total = book.total_copies || 0;
    // 3. Calculate available copies dynamically so it is always accurate
    const available = Math.max(0, total - currentlyBorrowed);

    document.getElementById("viewTotalCopies").textContent = total;
    document.getElementById("viewAvailableCopies").textContent = available;
    document.getElementById("viewBorrowedCopies").textContent =
      currentlyBorrowed;

    const historyBody = document.getElementById("viewBorrowHistoryBody");
    historyBody.innerHTML = "";

    if (!borrowings || borrowings.length === 0) {
      historyBody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; padding: 15px; color: #666;">
            No borrowing history found for this book.
          </td>
        </tr>
      `;
      return;
    }

    borrowings.forEach((record) => {
      const tr = document.createElement("tr");

      const borrowerName = record.profiles
        ? record.profiles.full_name
        : "Unknown User";
      const returnDateText = record.return_date ? record.return_date : "-";

      const statusClass =
        record.status === "borrowed" ? "status-borrowed" : "status-returned";

      tr.innerHTML = `
        <td>${escapeHtml(borrowerName)}</td>
        <td>${record.borrow_date}</td>
        <td>${record.due_date}</td>
        <td>${returnDateText}</td>
        <td><span class="${statusClass}">${escapeHtml(record.status)}</span></td>
      `;
      historyBody.appendChild(tr);
    });
  } catch (err) {
    console.error("Error loading view modal data:", err);
    if (typeof showToast === "function") {
      showToast("Failed to load full book details.", "error");
    }
  }
}

document
  .getElementById("borrowFromViewBtn")
  .addEventListener("click", async () => {
    if (!currentViewBookId) return;

    document.getElementById("viewBookModal").style.display = "none";

    const borrowModal = document.getElementById("addBorrowModal");
    if (borrowModal) borrowModal.style.display = "flex";

    const hiddenBookIdInput = document.getElementById("borrowBookId");
    if (hiddenBookIdInput) {
      hiddenBookIdInput.value = currentViewBookId;
    }

    await loadStudentsDropdown();
  });

async function loadStudentsDropdown(searchTerm = "") {
  const select = document.getElementById("borrowStudentSelect");
  if (!select) return;

  try {
    let query = window.supabaseClient
      .from("students")
      .select(
        `
        id, 
        student_id, 
        profiles ( id, full_name )
      `,
      )
      .order("student_id", { ascending: true });

    const { data: students, error } = await query;

    select.innerHTML = '<option value="">Select Student</option>';

    if (!students || students.length === 0) {
      showToast("No Users found", "error");
      return;
    }

    students.forEach((student) => {
      const profileData = Array.isArray(student.profiles)
        ? student.profiles[0]
        : student.profiles;

      const studentName = profileData ? profileData.full_name : "-";
      const studentCode = student.student_id || "-";
      const userId = student.id;

      if (searchTerm) {
        const matchName = studentName
          .toLowerCase()
          .includes(searchTerm.toLowerCase());
        const matchCode = studentCode
          .toLowerCase()
          .includes(searchTerm.toLowerCase());
        if (!matchName && !matchCode) return;
      }

      const opt = document.createElement("option");
      opt.value = userId;
      opt.textContent = `${studentName} (${studentCode})`;
      select.appendChild(opt);
    });
  } catch (err) {
    console.error("Error loading students list:", err);
  }
}

document
  .getElementById("studentSearchInput")
  ?.addEventListener("input", (e) => {
    loadStudentsDropdown(e.target.value.trim());
  });

const borrowForm = document.getElementById("borrowForm");
const saveBorrowBtn = document.getElementById("saveBorrowBtn");
if (borrowForm) {
  borrowForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    await handleSaveBorrow();
  });
}

async function handleSaveBorrow() {
  const saveBtn = document.getElementById("saveBorrowBtn");
  const bookId = document.getElementById("borrowBookId").value;
  const borrowerId = document.getElementById("borrowStudentSelect").value;
  const dueDate = document.getElementById("borrowDueDate").value;

  if (!bookId || !borrowerId || !dueDate) {
    if (typeof showToast === "function") {
      showToast("Please fill in all required fields.", "error");
    }
    return;
  }

  const today = new Date().toLocaleDateString("en-CA");
  if (dueDate < today) {
    if (typeof showToast === "function") {
      showToast("Due date cannot be in the past.", "error");
    }
    return;
  }

  saveBtn.disabled = true;
  saveBtn.textContent = "Saving...";

  try {
    const { data: authData, error: authError } =
      await window.supabaseClient.auth.getUser();
    if (authError || !authData.user) throw new Error("User not authenticated.");

    const currentAuthId = authData.user.id;

    const { data: userProfile, error: profileError } =
      await window.supabaseClient
        .from("profiles")
        .select("school_id")
        .eq("id", currentAuthId)
        .single();

    if (profileError) throw profileError;

    const insertPayload = {
      book_id: bookId,
      borrower_id: borrowerId,
      due_date: dueDate,
      status: "borrowed",
    };

    if (userProfile && userProfile.school_id) {
      insertPayload.school_id = userProfile.school_id;
    }

    const { error: insertError } = await window.supabaseClient
      .from("book_borrowings")
      .insert(insertPayload);

    if (insertError) throw insertError;

    if (typeof showToast === "function") {
      showToast("Book successfully checked out!", "success");
    }

    const modal = document.getElementById("addBorrowModal");
    if (modal) modal.style.display = "none";

    unLockBodyScroll();

    if (typeof loadBooksTable === "function") {
      loadBooksTable();
    }
  } catch (err) {
    console.error("Error saving borrow record:", err);
    if (typeof showToast === "function") {
      showToast(err.message || "Failed to borrow book.", "error");
    }
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "Save";
  }
}

let currentActiveBorrowings = [];

async function openReturnModal(bookId) {
  const modal = document.getElementById("returnBorrowModal");
  if (!modal) return;

  modal.style.display = "flex";

  const searchInput = document.getElementById("returnStudentSearchInput");
  if (searchInput) searchInput.value = "";

  const select = document.getElementById("returnBorrowStudentSelect");
  const borrowDateDisplay = document.getElementById("displayBorrowDate");
  const returnDateDisplay = document.getElementById("displayReturnDate");
  const recordIdInput = document.getElementById("activeBorrowRecordId");

  const todayStr = new Date().toLocaleDateString("en-CA");
  if (returnDateDisplay) returnDateDisplay.textContent = todayStr;
  if (borrowDateDisplay) borrowDateDisplay.textContent = "-";
  if (recordIdInput) recordIdInput.value = "";

  try {
    const { data: activeBorrowings, error } = await window.supabaseClient
      .from("book_borrowings")
      .select(
        `
        id,
        borrow_date,
        due_date,
        borrower_id,
        profiles ( 
          id, 
          full_name,
          students ( student_id )
        )
      `,
      )
      .eq("book_id", bookId)
      .eq("status", "borrowed");

    if (error) throw error;

    currentActiveBorrowings = activeBorrowings || [];

    if (currentActiveBorrowings.length === 0) {
      if (typeof showToast === "function") {
        showToast("No active borrowings found for this book.", "error");
      }
      modal.style.display = "none";
      return;
    }

    renderStudentDropdown(currentActiveBorrowings);
  } catch (err) {
    console.error("Error opening return modal:", err);
    if (typeof showToast === "function") {
      showToast("Failed to load return details.", "error");
    }
  }
}

function renderStudentDropdown(borrowings) {
  const select = document.getElementById("returnBorrowStudentSelect");
  const borrowDateDisplay = document.getElementById("displayBorrowDate");
  const recordIdInput = document.getElementById("activeBorrowRecordId");

  if (!select) return;

  select.innerHTML = '<option value="">Select student</option>';

  borrowings.forEach((record) => {
    const studentProfile = record.profiles || {};

    const studentName = studentProfile.full_name || "-";
    const studentIdNum =
      record.profiles?.students?.student_id || record.profiles?.id || "-";

    const opt = document.createElement("option");
    opt.value = record.id;
    opt.textContent = `${studentName} (${studentIdNum})`;
    select.appendChild(opt);
  });

  select.onchange = (e) => {
    const selectedRecordId = e.target.value;
    if (recordIdInput) recordIdInput.value = selectedRecordId;

    const found = borrowings.find((r) => r.id === selectedRecordId);
    if (found && borrowDateDisplay) {
      borrowDateDisplay.textContent = found.borrow_date || "-";
    } else if (borrowDateDisplay) {
      borrowDateDisplay.textContent = "-";
    }
  };

  if (borrowings.length === 1) {
    select.value = borrowings[0].id;
    if (recordIdInput) recordIdInput.value = borrowings[0].id;
    if (borrowDateDisplay) {
      borrowDateDisplay.textContent = borrowings[0].borrow_date || "-";
    }
  }
}

const studentSearchInput = document.getElementById("returnStudentSearchInput");
if (studentSearchInput) {
  studentSearchInput.addEventListener("input", (e) => {
    const query = e.target.value.toLowerCase().trim();

    const filtered = currentActiveBorrowings.filter((record) => {
      const studentProfile = record.profiles || {};

      const studentRecord = studentProfile.students || {};

      const name = (studentProfile.full_name || "").toLowerCase();
      const studentId = (
        studentRecord.student_id ||
        studentRecord.id ||
        ""
      ).toLowerCase();

      return name.includes(query) || studentId.includes(query);
    });

    renderStudentDropdown(filtered);
  });
}

const returnForm = document.getElementById("returnBorrowForm");
if (returnForm) {
  returnForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const confirmBtn = document.getElementById("confirmReturnBtn");
    const recordId = document.getElementById("activeBorrowRecordId").value;

    if (!recordId) {
      if (typeof showToast === "function")
        showToast("No active record selected.", "error");
      return;
    }

    confirmBtn.disabled = true;
    confirmBtn.textContent = "Processing...";

    try {
      const todayStr = new Date().toLocaleDateString("en-CA");

      const { error: updateError } = await window.supabaseClient
        .from("book_borrowings")
        .update({
          status: "returned",
          return_date: todayStr,
        })
        .eq("id", recordId);

      if (updateError) throw updateError;

      if (typeof showToast === "function") {
        showToast("Book successfully returned!", "success");
      }

      document.getElementById("returnBorrowModal").style.display = "none";
      unLockBodyScroll();
      if (typeof loadBooksTable === "function") loadBooksTable();
    } catch (err) {
      console.error("Error processing return:", err);
      if (typeof showToast === "function") {
        showToast(err.message || "Failed to return book.", "error");
      }
    } finally {
      confirmBtn.disabled = false;
      confirmBtn.textContent = "Confirm Return";
    }
  });
}

// Close button listeners
document
  .getElementById("closeReturnBorrowModal")
  ?.addEventListener("click", () => {
    document.getElementById("returnBorrowModal").style.display = "none";
  });
document
  .getElementById("cancelReturnBorrowModal")
  ?.addEventListener("click", () => {
    document.getElementById("returnBorrowModal").style.display = "none";
  });

document
  .getElementById("returnBookFromViewBtn")
  ?.addEventListener("click", () => {
    if (!currentViewBookId) return;

    document.getElementById("viewBookModal").style.display = "none";

    // Open return modal
    openReturnModal(currentViewBookId);
  });

if (studentSearchInput) {
  studentSearchInput.addEventListener("input", (e) => {
    const query = e.target.value.toLowerCase().trim();

    const filtered = currentActiveBorrowings.filter((record) => {
      const studentProfile = record.profiles || {};
      const studentIdNum =
        studentProfile.students?.student_id ||
        studentProfile.students?.id ||
        "";
      const name = (studentProfile.full_name || "").toLowerCase();
      const studentId = String(studentIdNum).toLowerCase();

      return name.includes(query) || studentId.includes(query);
    });

    renderStudentDropdown(filtered);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  loadBooksTable();
});
