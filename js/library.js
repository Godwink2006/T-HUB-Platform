const addBorrow = document.getElementById("addBorrow");
const addBorrowModal = document.getElementById("addBorrowModal");
const closeAddBorrowModal = document.getElementById("closeAddBorrowModal");

const cancelAddBorrowModal = document.getElementById("cancelAddBorrowModal");

addBorrow.addEventListener("click", async () => {
  addBorrowModal.style.display = "flex";
  await loadDepartmentDropdown();
});

cancelAddBorrowModal.addEventListener("click", () => {
  addBorrowModal.style.display = "none";
});

closeAddBorrowModal.addEventListener("click", () => {
  addBorrowModal.style.display = "none";
});

window.addEventListener("click", (e) => {
  if (e.target === addBorrowModal) {
    addBorrowModal.style.display = "none";
  }
});

const addReturnBorrow = document.getElementById("addReturnBorrow");
const returnBorrowModal = document.getElementById("returnBorrowModal");
const closeReturnBorrowModal = document.getElementById(
  "closeReturnBorrowModal",
);

const cancelReturnBorrowModal = document.getElementById(
  "cancelReturnBorrowModal",
);

addReturnBorrow.addEventListener("click", () => {
  returnBorrowModal.style.display = "flex";
});

cancelReturnBorrowModal.addEventListener("click", () => {
  returnBorrowModal.style.display = "none";
});

closeReturnBorrowModal.addEventListener("click", () => {
  returnBorrowModal.style.display = "none";
});

window.addEventListener("click", (e) => {
  if (e.target === returnBorrowModal) {
    returnBorrowModal.style.display = "none";
  }
});

const bookModal = document.getElementById("bookModal");

const cancelBookModal = document.getElementById("cancelBookModal");

const openBookModal = document.getElementById("addBook");

const closeBookModal = document.getElementById("closeBookModal");

openBookModal.addEventListener("click", async () => {
  bookModal.style.display = "flex";

  lockBodyScroll();
  await loadDepartmentDropdown();
});

closeBookModal.addEventListener("click", () => {
  bookModal.style.display = "none";

  unLockBodyScroll();
});

cancelBookModal.addEventListener("click", () => {
  bookModal.style.display = "none";

  unLockBodyScroll();
});

window.addEventListener("click", (e) => {
  if (e.target === bookModal) {
    bookModal.style.display = "none";

    unLockBodyScroll();
  }
});

const viewBookModal = document.getElementById("viewBookModal");
const viewButtons = document.querySelectorAll(".view");
const closeViewBookModal = document.getElementById("closeViewBookModal");

const closeViewBtn = document.getElementById("closeViewBtn");

viewButtons.forEach((button) => {
  button.addEventListener("click", () => {
    viewBookModal.style.display = "flex";

    lockBodyScroll();
  });
});

closeViewBookModal.addEventListener("click", () => {
  viewBookModal.style.display = "none";

  unLockBodyScroll();
});

closeViewBtn.addEventListener("click", () => {
  viewBookModal.style.display = "none";

  unLockBodyScroll();
});

window.addEventListener("click", (e) => {
  if (e.target === viewBookModal) {
    viewBookModal.style.display = "none";

    unLockBodyScroll();
  }
});

const closeEditBookModal = document.getElementById("closeEditBookModal");
const cancelEditBookModal = document.getElementById("cancelEditBookModal");
const editBookModal = document.getElementById("editBookModal");
const editButtons = document.querySelectorAll(".edit");

editButtons.forEach((button) => {
  button.addEventListener("click", () => {
    editBookModal.style.display = "flex";

    lockBodyScroll();
  });
});

closeEditBookModal.addEventListener("click", () => {
  editBookModal.style.display = "none";

  unLockBodyScroll();
});

cancelEditBookModal.addEventListener("click", () => {
  editBookModal.style.display = "none";

  unLockBodyScroll();
});

window.addEventListener("click", (e) => {
  if (e.target === editBookModal) {
    editBookModal.style.display = "none";

    unLockBodyScroll();
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

// Also hook up the explicit save button if it's outside the submit flow or acts as the trigger
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

    // Compress image if uploaded, matching your system utility pattern
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

    // Direct insertion into the books table (school_id is auto-injected by your trigger!)
    const { data, error } = await window.supabaseClient.from("books").insert([
      {
        book_code: book_code,
        title: title,
        author: author,
        department_id: department_id,
        total_copies: parseInt(copies_total, 10),
        available_copies: parseInt(copies_total, 10), // Initially, available equals total
        shelf_location: shelf_location || null,
        description: description || null,
        cover_image_url: coverBase64, // Ensure your column exists or map it accordingly
        status: status,
      },
    ]);

    if (error) throw error;

    showToast("Book added successfully!", "success");

    // Reset form and UI states
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
    // Fetch departments from Supabase (tenant filtering happens automatically via RLS / triggers if configured)
    const { data: departments, error } = await supabaseClient
      .from("departments")
      .select("id, name")
      .order("name", { ascending: true })
      .eq("status", "active");

    if (error) throw error;

    // Reset the dropdown with a clean default option
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

      // Use uploaded cover image if available, otherwise default book icon
      const coverSrc =
        book.cover_image_url ||
        "https://cdn-icons-png.flaticon.com/512/29/29302.png";
      const departmentName = book.departments ? book.departments.name : "-";

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
        <td>${book.total_copies}</td>
        <td>${book.available_copies}</td>
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

    // Re-bind your view and edit button event listeners for the newly generated rows
    attachBookActionListeners();
  } catch (err) {
    console.error("Error loading books table:", err);
    showToast("Failed to load library inventory.", "error");
  }
}

// Helper to prevent XSS injection in dynamic text
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Re-attach listeners for dynamically created action buttons
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

async function openEditBookModal(bookId) {
  const editBookModal = document.getElementById("editBookModal");
  if (!editBookModal) return;

  // Open modal and lock scroll
  editBookModal.style.display = "flex";
  lockBodyScroll();

  try {
    // 1. Ensure departments dropdown in edit modal is dynamically loaded
    await loadEditDepartmentDropdown();

    // 2. Fetch specific book record from Supabase
    const { data: book, error } = await window.supabaseClient
      .from("books")
      .select("*")
      .eq("id", bookId)
      .single();

    if (error) throw error;
    if (!book) throw new Error("Book not found.");

    // 3. Populate form controls
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

    // Set cover preview image
    const previewImg = document.getElementById("editAvatarPreview");
    if (previewImg) {
      previewImg.src =
        book.cover_image_url ||
        "https://cdn-icons-png.flaticon.com/512/29/29302.png";
    }

    // Reset file input text indicator
    if (editFileNameText) {
      editFileNameText.textContent = "No new file chosen";
    }
  } catch (err) {
    console.error("Error loading book for editing:", err);
    showToast(err.message || "Failed to load book data.", "error");
  }
}

// Populate the edit modal's department dropdown
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
const editBookForm = document.getElementById("EditBookForm");

if (editBookForm) {
  editBookForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    await handleUpdateBook();
  });
}

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

  // Extract form values
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

  // Basic Validation
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

    // Build update object
    const updateData = {
      title: title,
      author: author,
      department_id: department_id,
      total_copies: parseInt(copies_total, 10),
      shelf_location: shelf_location || null,
      description: description || null,
      status: status,
    };

    // Only update cover image if a new file was actually picked
    if (coverBase64) {
      updateData.cover_image_url = coverBase64;
    }

    saveBtn.textContent = "Saving to database...";

    // Direct update query
    const { error } = await window.supabaseClient
      .from("books")
      .update(updateData)
      .eq("id", bookId);

    if (error) throw error;

    showToast("Book updated successfully!", "success");

    // Close Modal
    const editBookModal = document.getElementById("editBookModal");
    if (editBookModal) {
      editBookModal.style.display = "none";
      unLockBodyScroll();
    }

    // Refresh table inventory
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

async function openViewBookModal(bookId) {
  const modal = document.getElementById("viewBookModal");
  if (!modal) return;

  // Show modal and lock scroll
  modal.style.display = "flex";
  if (typeof lockBodyScroll === "function") lockBodyScroll();

  try {
    // 1. Fetch Book Details + Department Name
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

    // 1. Populate book cover image (falls back to placeholder if empty)
    const coverImgElement = document.getElementById("viewBookCover");
    if (coverImgElement) {
      coverImgElement.src =
        book.cover_image_url ||
        "https://cdn-icons-png.flaticon.com/512/29/29302.png";
    }

    // 2. Populate and style the status badge
    const statusBadge = document.getElementById("viewBookStatus");
    if (statusBadge) {
      const bookStatus = (book.status || "active").toLowerCase();
      statusBadge.textContent =
        bookStatus.charAt(0).toUpperCase() + bookStatus.slice(1);

      // Update class name so your CSS handles active vs inactive coloring correctly
      statusBadge.className = `view-book-status ${bookStatus}`; // results in 'view-book-status active' or 'view-book-status inactive'
    }
    document.getElementById("viewBookCode").textContent = book.book_code || "-";
    document.getElementById("viewBookTitle").textContent = book.title || "-";
    document.getElementById("viewBookAuthor").textContent = book.author || "-";
    document.getElementById("viewBookCategory").textContent = book.departments
      ? book.departments.name
      : "N/A";
    document.getElementById("viewBookShelf").textContent =
      book.shelf_location || "N/A";
    document.getElementById("viewBookDescription").textContent =
      book.description || "No description provided.";

    // Populate inventory counts
    const total = book.total_copies || 0;
    const available = book.available_copies || 0;
    const currentlyBorrowed = total - available;

    document.getElementById("viewTotalCopies").textContent = total;
    document.getElementById("viewAvailableCopies").textContent = available;
    document.getElementById("viewBorrowedCopies").textContent =
      currentlyBorrowed;

    // 2. Fetch Borrow History for this book
    const { data: borrowings, error: borrowError } = await window.supabaseClient
      .from("book_borrowings")
      .select(
        `
        *,
        profiles ( full_name )
      `,
      )
      .eq("book_id", bookId)
      .order("created_at", { ascending: false });

    if (borrowError) throw borrowError;

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

    // Populate history rows dynamically
    borrowings.forEach((record) => {
      const tr = document.createElement("tr");

      const borrowerName = record.profiles
        ? record.profiles.full_name
        : "Unknown User";
      const returnDateText = record.return_date ? record.return_date : "-";

      // Capitalize status badge format
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

loadBooksTable();
