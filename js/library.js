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
  bookForm?.reset();
  const addCoverInput = document.getElementById("addAvatarInput");
  if (addCoverInput) addCoverInput.value = "";
  const addCoverPreview = document.getElementById("addAvatarPreview");
  if (addCoverPreview) {
    addCoverPreview.src = "https://cdn-icons-png.flaticon.com/512/29/29302.png";
  }
  const addFileName = document.getElementById("addFileNameDisplay");
  if (addFileName) addFileName.textContent = "No new file chosen";
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
        option.value = dept.id;
        option.textContent = dept.name;
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

function matchesLibraryBookFilters(book, query = "", department = "", status = "") {
  const normalizedQuery = String(query).trim().toLocaleLowerCase();
  const normalizedDepartment = String(department).toLocaleLowerCase();
  const normalizedStatus = String(status).toLocaleLowerCase();

  return (
    (!normalizedQuery ||
      String(book.search || "").toLocaleLowerCase().includes(normalizedQuery)) &&
    (!normalizedDepartment ||
      String(book.department || "").toLocaleLowerCase() === normalizedDepartment) &&
    (!normalizedStatus ||
      String(book.status || "").toLocaleLowerCase() === normalizedStatus)
  );
}

function applyLibraryBookFilters() {
  const tableBody = document.getElementById("booksTableBody");
  if (!tableBody) return;

  const query = String(
    document.getElementById("libraryBookSearch")?.value || "",
  )
    .trim()
    .toLocaleLowerCase();
  const department = String(
    document.getElementById("libraryDepartmentFilter")?.value || "",
  ).toLocaleLowerCase();
  const status = String(
    document.getElementById("libraryStatusFilter")?.value || "",
  ).toLocaleLowerCase();
  const rows = Array.from(
    tableBody.querySelectorAll("tr[data-library-book-row]"),
  );

  let visibleCount = 0;
  rows.forEach((row) => {
    const isVisible = matchesLibraryBookFilters(
      {
        search: row.dataset.search,
        department: row.dataset.department,
        status: row.dataset.status,
      },
      query,
      department,
      status,
    );
    row.hidden = !isVisible;
    if (isVisible) visibleCount += 1;
  });

  let noMatchesRow = document.getElementById("libraryNoMatchesRow");
  if (rows.length > 0 && visibleCount === 0) {
    if (!noMatchesRow) {
      noMatchesRow = document.createElement("tr");
      noMatchesRow.id = "libraryNoMatchesRow";
      noMatchesRow.innerHTML =
        '<td colspan="9" class="library-empty-result">No books match these filters.</td>';
      tableBody.appendChild(noMatchesRow);
    }
    noMatchesRow.hidden = false;
  } else if (noMatchesRow) {
    noMatchesRow.hidden = true;
  }
}

document
  .getElementById("libraryBookSearch")
  ?.addEventListener("input", applyLibraryBookFilters);
document
  .getElementById("libraryDepartmentFilter")
  ?.addEventListener("change", applyLibraryBookFilters);
document
  .getElementById("libraryStatusFilter")
  ?.addEventListener("change", applyLibraryBookFilters);

const LIBRARY_BOOKS_PAGE_SIZE = 30;
let libraryBooksOffset = 0;
let libraryBooksHasMore = false;
let libraryBooksLoading = false;
let loadedLibraryBooks = [];
let canDeleteLibraryBooks = false;
let pendingLibraryBookDelete = null;

async function loadLibraryDeletePermission() {
  try {
    const {
      data: { user },
      error: authError,
    } = await window.supabaseClient.auth.getUser();
    if (authError) throw authError;
    if (!user) return;

    const { data: profile, error } = await window.supabaseClient
      .from("profiles")
      .select("role, status")
      .eq("id", user.id)
      .maybeSingle();

    if (error) throw error;
    canDeleteLibraryBooks =
      String(profile?.role || "").toLowerCase() === "admin" &&
      String(profile?.status || "").toLowerCase() === "active";
  } catch (error) {
    canDeleteLibraryBooks = false;
    console.error("Could not check library delete permission:", error);
  }
}

async function loadBooksTable(options = {}) {
  const tableBody = document.getElementById("booksTableBody");
  if (!tableBody) return;
  const append = options.append === true;
  const nextButton = document.getElementById("nextLibraryBooksPage");

  if (libraryBooksLoading || (append && !libraryBooksHasMore)) return;
  libraryBooksLoading = true;

  if (!append) {
    libraryBooksOffset = 0;
    libraryBooksHasMore = false;
    loadedLibraryBooks = [];
    if (nextButton) {
      nextButton.hidden = true;
      nextButton.disabled = false;
      nextButton.textContent = "Next";
    }
    renderTableLoading();
  } else if (nextButton) {
    nextButton.disabled = true;
    nextButton.textContent = "Loading...";
  }

  try {
    const { data: page, error } = await window.supabaseClient
      .from("books")
      .select(
        `
        *,
        departments (
          name
        )
      `,
      )
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(libraryBooksOffset, libraryBooksOffset + LIBRARY_BOOKS_PAGE_SIZE);

    if (error) throw error;

    const books = page || [];
    const visibleBooks = books.slice(0, LIBRARY_BOOKS_PAGE_SIZE);
    libraryBooksHasMore = books.length > LIBRARY_BOOKS_PAGE_SIZE;

    if (!append && visibleBooks.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align: center; padding: 20px; color: #666;">
            No books found in the library inventory.
          </td>
        </tr>
      `;
      return;
    }

    const { data: allBorrowings, error: borrowError } = await window.supabaseClient
        .from("book_borrowings")
        .select("book_id, status")
        .eq("status", "borrowed")
        .in("book_id", visibleBooks.map((book) => book.id));

    if (borrowError) throw borrowError;

    libraryBooksOffset += visibleBooks.length;
    loadedLibraryBooks = append
      ? loadedLibraryBooks.concat(visibleBooks)
      : visibleBooks;

    const departmentFilter = document.getElementById("libraryDepartmentFilter");
    const selectedDepartment = departmentFilter?.value || "";
    if (departmentFilter) {
      const departmentNames = [
        ...new Set(
          loadedLibraryBooks
            .map((book) => book.departments?.name)
            .filter((name) => typeof name === "string" && name.trim()),
        ),
      ].sort((a, b) => a.localeCompare(b));

      departmentFilter.replaceChildren(new Option("All Departments", ""));
      departmentNames.forEach((name) => {
        departmentFilter.appendChild(new Option(name, name));
      });
      if (departmentNames.includes(selectedDepartment)) {
        departmentFilter.value = selectedDepartment;
      }
    }

    // The initial load replaced the body with a loading row. Remove that row
    // before inserting the first real page; append loads must keep prior rows.
    if (!append) tableBody.replaceChildren();

    visibleBooks.forEach((book) => {
      const tr = document.createElement("tr");

      const coverSrc =
        book.cover_image_url ||
        "https://cdn-icons-png.flaticon.com/512/29/29302.png";
      const departmentName = book.departments ? book.departments.name : "-";

      const activeBorrowedCount = allBorrowings
        ? allBorrowings.filter((b) => b.book_id === book.id).length
        : 0;

      const totalCopies = book.total_copies || 0;

      const availableCopies = Math.max(0, totalCopies - activeBorrowedCount);
      const bookStatus =
        String(book.status || "inactive").toLocaleLowerCase() === "active"
          ? "active"
          : "inactive";

      tr.dataset.libraryBookRow = "true";
      tr.dataset.search = [
        book.book_code,
        book.title,
        book.author,
        departmentName,
        book.shelf_location,
        book.description,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase();
      tr.dataset.department = departmentName;
      tr.dataset.status = bookStatus;

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
        <td><span class="books-status-${bookStatus}">
          ${escapeHTML(book.status || "Inactive")}
        </span></td>
        <td>
         <button class="books-actions-btn edit" data-id="${book.id}">
            <i class="fa-solid fa-pen"></i>
          </button>

          <button class="books-actions-btn view" data-id="${book.id}">
            <i class="fa-solid fa-eye"></i>
          </button>
          ${
            canDeleteLibraryBooks
              ? `<button class="books-actions-btn library-delete-btn" data-id="${book.id}" data-title="${escapeHtml(book.title)}" data-code="${escapeHtml(book.book_code)}" aria-label="Delete ${escapeHtml(book.title)}" title="Delete book">
                  <i class="fa-solid fa-trash"></i>
                </button>`
              : ""
          }
        </td>
      `;

      tableBody.appendChild(tr);
    });

    applyLibraryBookFilters();
    attachBookActionListeners();
  } catch (err) {
    console.error("Error loading books table:", err);
    if (!append) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align: center; padding: 20px; color: #b91c1c;">
            Failed to load library inventory: ${escapeHtml(err?.message || "Unknown error")}
          </td>
        </tr>
      `;
    }
    if (typeof showToast === "function") {
      showToast(
        append ? "Could not load more books." : "Failed to load library inventory.",
        "error",
      );
    }
  } finally {
    libraryBooksLoading = false;
    if (nextButton) {
      nextButton.hidden = !libraryBooksHasMore;
      nextButton.disabled = false;
      nextButton.textContent = "Next";
    }
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
  const deleteButtons = document.querySelectorAll(
    "#booksTableBody .library-delete-btn",
  );

  editButtons.forEach((button) => {
    if (button.dataset.listenerAttached === "true") return;
    button.dataset.listenerAttached = "true";
    button.addEventListener("click", () => {
      const bookId = button.getAttribute("data-id");
      if (bookId) {
        openEditBookModal(bookId);
      }
    });
  });

  viewButtons.forEach((button) => {
    if (button.dataset.listenerAttached === "true") return;
    button.dataset.listenerAttached = "true";
    button.addEventListener("click", () => {
      const bookId = button.getAttribute("data-id");
      if (bookId) {
        openViewBookModal(bookId);
      }
    });
  });

  deleteButtons.forEach((button) => {
    if (button.dataset.listenerAttached === "true") return;
    button.dataset.listenerAttached = "true";
    button.addEventListener("click", () => {
      openLibraryBookDeleteModal({
        id: button.dataset.id,
        title: button.dataset.title || "this book",
        code: button.dataset.code || "",
      });
    });
  });
}

function openLibraryBookDeleteModal(book) {
  if (!canDeleteLibraryBooks || !book?.id) return;
  const modal = document.getElementById("deleteLibraryBookModal");
  const label = document.getElementById("deleteLibraryBookLabel");
  if (!modal || !label) return;

  pendingLibraryBookDelete = book;
  label.textContent = book.code
    ? `${book.title} (${book.code})`
    : book.title;
  modal.style.display = "flex";
  if (typeof lockBodyScroll === "function") lockBodyScroll();
  document.getElementById("confirmDeleteLibraryBook")?.focus();
}

function closeLibraryBookDeleteModal() {
  const modal = document.getElementById("deleteLibraryBookModal");
  if (modal) modal.style.display = "none";
  pendingLibraryBookDelete = null;
  if (typeof unLockBodyScroll === "function") unLockBodyScroll();
}

async function deleteLibraryBook() {
  const book = pendingLibraryBookDelete;
  const confirmButton = document.getElementById("confirmDeleteLibraryBook");
  if (!book?.id || !confirmButton || !canDeleteLibraryBooks) return;

  confirmButton.disabled = true;
  confirmButton.textContent = "Deleting...";
  try {
    const { error } = await window.supabaseClient.rpc(
      "admin_delete_unborrowed_book",
      { p_book_id: book.id },
    );
    if (error) throw error;

    closeLibraryBookDeleteModal();
    if (typeof showToast === "function") {
      showToast("Book deleted.", "success");
    }
    await loadBooksTable();
  } catch (error) {
    console.error("Could not delete library book:", error);
    if (typeof showToast === "function") {
      showToast(error?.message || "Could not delete this book.", "error");
    }
  } finally {
    confirmButton.disabled = false;
    confirmButton.innerHTML = '<i class="fa-solid fa-trash"></i> Delete book';
  }
}

document
  .getElementById("cancelDeleteLibraryBook")
  ?.addEventListener("click", closeLibraryBookDeleteModal);
document
  .getElementById("closeDeleteLibraryBook")
  ?.addEventListener("click", closeLibraryBookDeleteModal);
document
  .getElementById("confirmDeleteLibraryBook")
  ?.addEventListener("click", deleteLibraryBook);
document
  .getElementById("deleteLibraryBookModal")
  ?.addEventListener("click", (event) => {
    if (event.target.id === "deleteLibraryBookModal") {
      closeLibraryBookDeleteModal();
    }
  });

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
let editBookRequestId = 0;

async function openEditBookModal(bookId) {
  const editBookModal = document.getElementById("editBookModal");
  if (!editBookModal) return;

  const requestId = ++editBookRequestId;
  currentOriginalBookData = null;
  document.getElementById("editBookId").value = "";
  document.getElementById("editBookCode").textContent = "Loading…";
  document.getElementById("editBookTitle").value = "";
  document.getElementById("editBookAuthor").value = "";
  document.getElementById("editBookDepartment").replaceChildren(
    new Option("Loading departments…", ""),
  );
  document.getElementById("editBookNumberOfCopies").value = "";
  document.getElementById("editBookShelfLocation").value = "";
  document.getElementById("editBookDescription").value = "";
  document.getElementById("editBookStatus").value = "";
  const editCoverPreview = document.getElementById("editAvatarPreview");
  if (editCoverPreview) {
    editCoverPreview.src = "https://cdn-icons-png.flaticon.com/512/29/29302.png";
  }
  const editCoverInput = document.getElementById("editAvatarInput");
  if (editCoverInput) editCoverInput.value = "";
  if (editFileNameText) editFileNameText.textContent = "No new file chosen";
  const editSaveButton = document.getElementById("editBook");
  if (editSaveButton) editSaveButton.disabled = true;

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

    const { data: activeBorrowings, error: borrowingsError } =
      await window.supabaseClient
        .from("book_borrowings")
        .select("id")
        .eq("book_id", bookId)
        .eq("status", "borrowed");
    if (borrowingsError) throw borrowingsError;

    if (requestId !== editBookRequestId) return;

    currentOriginalBookData = {
      ...book,
      active_borrowed_count: (activeBorrowings || []).length,
    };

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
    if (editSaveButton) editSaveButton.disabled = false;
  } catch (err) {
    if (requestId !== editBookRequestId) return;
    document.getElementById("editBookCode").textContent = "Book details unavailable";
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

    if (photoInput && photoInput.files[0]) {
      saveBtn.textContent = "Compressing cover...";
      const compressedBlob = await compressImageToBlob(
        photoInput.files[0],
        800,
        0.7,
      );
      coverBase64 = await blobToBase64(compressedBlob);
    }

    const currentBorrowed =
      Number(currentOriginalBookData?.active_borrowed_count) || 0;

    const newTotal = parseInt(copies_total, 10);

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
let viewBookRequestId = 0;

async function openViewBookModal(bookId) {
  const requestId = ++viewBookRequestId;
  currentViewBookId = bookId;
  const modal = document.getElementById("viewBookModal");
  if (!modal) return;

  const loadingImage = "https://cdn-icons-png.flaticon.com/512/29/29302.png";
  const coverImgElement = document.getElementById("viewBookCover");
  if (coverImgElement) coverImgElement.src = loadingImage;
  const statusBadge = document.getElementById("viewBookStatus");
  if (statusBadge) {
    statusBadge.textContent = "Loading…";
    statusBadge.className = "view-book-status";
  }
  ["viewBookCode", "viewBookTitle", "viewBookAuthor", "viewBookCategory", "viewBookShelf", "viewBookDescription"]
    .forEach((id) => { document.getElementById(id).textContent = "Loading…"; });
  ["viewTotalCopies", "viewAvailableCopies", "viewBorrowedCopies"]
    .forEach((id) => { document.getElementById(id).textContent = "—"; });
  document.getElementById("viewBorrowHistoryBody").innerHTML =
    '<tr><td colspan="5" style="text-align:center; padding:15px; color:#666">Loading borrowing history…</td></tr>';
  document.getElementById("borrowFromViewBtn").disabled = true;
  document.getElementById("returnBookFromViewBtn").disabled = true;

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
    if (requestId !== viewBookRequestId) return;

    if (coverImgElement) {
      coverImgElement.src =
        book.cover_image_url ||
        "https://cdn-icons-png.flaticon.com/512/29/29302.png";
    }

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

    const { data: borrowings, error: borrowError } = await window.supabaseClient
      .from("book_borrowings")
      .select(`*, profiles ( full_name, role, photo_url, students ( student_id ) )`)
      .eq("book_id", bookId)
      .order("created_at", { ascending: false });

    if (borrowError) throw borrowError;
    if (requestId !== viewBookRequestId) return;

    const identitySnapshots =
      await window.loadTransferredStudentIdentitySnapshots(
        (borrowings || []).map((record) => record.borrower_id),
      );
    if (requestId !== viewBookRequestId) return;

    const currentlyBorrowed = borrowings
      ? borrowings.filter((r) => r.status === "borrowed").length
      : 0;

    const total = book.total_copies || 0;

    const available = Math.max(0, total - currentlyBorrowed);

    document.getElementById("viewTotalCopies").textContent = total;
    document.getElementById("viewAvailableCopies").textContent = available;
    document.getElementById("viewBorrowedCopies").textContent =
      currentlyBorrowed;
    document.getElementById("borrowFromViewBtn").disabled = false;
    document.getElementById("returnBookFromViewBtn").disabled = currentlyBorrowed === 0;

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

      const identitySnapshot = identitySnapshots.get(record.borrower_id);
      const borrowerName =
        record.profiles?.full_name ||
        identitySnapshot?.student_name_snapshot ||
        "Unknown User";
      const borrowerRole = record.profiles?.role || "";
      const borrowerId =
        record.profiles?.students?.student_id ||
        identitySnapshot?.student_code_snapshot ||
        "";
      const borrowerPhoto = getBorrowerPhotoUrl(record.profiles?.photo_url);
      const returnDateText = record.return_date ? record.return_date : "-";

      const statusClass =
        record.status === "borrowed" ? "status-borrowed" : "status-returned";

      tr.innerHTML = `
        <td>
          <span class="app-person-cell">
            <img class="app-person-avatar" src="${escapeHtml(borrowerPhoto)}" alt="" aria-hidden="true" loading="lazy" onerror="this.onerror=null;this.src='${escapeHtml(window.DEFAULT_PROFILE_AVATAR || "")}'" />
            <span class="app-person-meta">
              <span>${escapeHtml(borrowerName)}</span>
              ${borrowerRole ? `<small>${escapeHtml(borrowerRole)}</small>` : ""}
              ${borrowerId ? `<small class="app-person-id">Student ID: ${escapeHtml(borrowerId)}</small>` : ""}
            </span>
          </span>
        </td>
        <td>${escapeHTML(record.borrow_date || "-")}</td>
        <td>${escapeHTML(record.due_date || "-")}</td>
        <td>${returnDateText}</td>
        <td><span class="${statusClass}">${escapeHtml(record.status)}</span></td>
      `;
      historyBody.appendChild(tr);
    });
  } catch (err) {
    if (requestId !== viewBookRequestId) return;
    ["viewBookCode", "viewBookTitle", "viewBookAuthor", "viewBookCategory", "viewBookShelf", "viewBookDescription"]
      .forEach((id) => { document.getElementById(id).textContent = "Details unavailable"; });
    if (statusBadge) {
      statusBadge.textContent = "Unavailable";
      statusBadge.className = "view-book-status";
    }
    ["viewTotalCopies", "viewAvailableCopies", "viewBorrowedCopies"]
      .forEach((id) => { document.getElementById(id).textContent = "—"; });
    document.getElementById("viewBorrowHistoryBody").innerHTML =
      '<tr><td colspan="5" style="text-align:center; padding:15px; color:#666">Borrowing history could not be loaded.</td></tr>';
    console.error("Error loading view modal data:", err);
    if (typeof showToast === "function") {
      showToast("Failed to load full book details.", "error");
    }
  }
}

function getBorrowerPhotoUrl(photoUrl) {
  if (!photoUrl) return window.DEFAULT_PROFILE_AVATAR || "";
  try {
    const parsedPhotoUrl = new URL(photoUrl, window.location.href);
    if (["https:", "http:"].includes(parsedPhotoUrl.protocol)) {
      return parsedPhotoUrl.href;
    }
  } catch (error) {
    console.warn("Ignoring invalid borrower photo URL:", error);
  }
  return window.DEFAULT_PROFILE_AVATAR || "";
}

document
  .getElementById("borrowFromViewBtn")
  .addEventListener("click", async () => {
    if (!currentViewBookId) return;

    document.getElementById("viewBookModal").style.display = "none";

    const borrowModal = document.getElementById("addBorrowModal");
    if (borrowModal) borrowModal.style.display = "flex";

    const requestId = ++borrowerDropdownRequestId;
    allBorrowerProfiles = [];
    document.getElementById("borrowForm")?.reset();
    const borrowerSearch = document.getElementById("studentSearchInput");
    if (borrowerSearch) borrowerSearch.value = "";
    const borrowerSelect = document.getElementById("borrowStudentSelect");
    if (borrowerSelect) {
      borrowerSelect.replaceChildren(new Option("Loading borrowers…", ""));
    }
    const borrowDateDisplay = document.getElementById("borrowDateDisplay");
    if (borrowDateDisplay) {
      borrowDateDisplay.textContent = new Date().toLocaleDateString("en-CA");
    }
    const saveBorrowButton = document.getElementById("saveBorrowBtn");
    if (saveBorrowButton) saveBorrowButton.disabled = true;

    const hiddenBookIdInput = document.getElementById("borrowBookId");
    if (hiddenBookIdInput) {
      hiddenBookIdInput.value = currentViewBookId;
    }

    await loadBorrowersDropdown(requestId);
  });

let allBorrowerProfiles = [];
let borrowerDropdownRequestId = 0;

async function loadBorrowersDropdown(requestId = ++borrowerDropdownRequestId) {
  const select = document.getElementById("borrowStudentSelect");
  if (!select) return;

  try {
    const {
      data: { user },
      error: authError,
    } = await window.supabaseClient.auth.getUser();
    if (authError) throw authError;
    if (!user) throw new Error("User not authenticated.");

    const { data: userProfile, error: profileError } =
      await window.supabaseClient
        .from("profiles")
        .select("school_id")
        .eq("id", user.id)
        .single();
    if (profileError) throw profileError;
    if (!userProfile?.school_id) {
      throw new Error("Your profile is not linked to a school.");
    }

    const { data: profiles, error } = await window.supabaseClient
      .from("profiles")
      .select("id, full_name, email, role, status, students(student_id)")
      .eq("school_id", userProfile.school_id)
      .order("full_name", { ascending: true });
    if (error) throw error;

    if (requestId !== borrowerDropdownRequestId) return;

    allBorrowerProfiles = profiles || [];
    if (saveBorrowBtn) saveBorrowBtn.disabled = allBorrowerProfiles.length === 0;
    renderBorrowerOptions(
      document.getElementById("studentSearchInput")?.value || "",
    );
  } catch (err) {
    if (requestId !== borrowerDropdownRequestId) return;
    select.replaceChildren(new Option("Borrowers could not be loaded", ""));
    console.error("Error loading borrower profiles:", err);
    if (typeof showToast === "function") {
      showToast(err.message || "Could not load borrowers.", "error");
    }
  }
}

function filterBorrowerProfiles(profiles, searchTerm = "") {
  const query = String(searchTerm).trim().toLocaleLowerCase();
  return profiles.filter((profile) => {
    if (
      String(profile.role || "").toLowerCase() === "parent" ||
      String(profile.status || "").toLowerCase() !== "active"
    ) {
      return false;
    }

    if (!query) return true;

    const student = Array.isArray(profile.students)
      ? profile.students[0]
      : profile.students;
    return [
      profile.full_name,
      profile.email,
      profile.role,
      profile.id,
      student?.student_id,
    ].some((value) =>
      String(value || "")
        .toLocaleLowerCase()
        .includes(query),
    );
  });
}

function renderBorrowerOptions(searchTerm = "") {
  const select = document.getElementById("borrowStudentSelect");
  if (!select) return;

  select.replaceChildren(new Option("Select borrower", ""));
  const profiles = filterBorrowerProfiles(allBorrowerProfiles, searchTerm);
  if (saveBorrowBtn) saveBorrowBtn.disabled = profiles.length === 0;
  profiles.forEach((profile) => {
    const student = Array.isArray(profile.students)
      ? profile.students[0]
      : profile.students;
    const name = profile.full_name || profile.email || "User";
    const role = String(profile.role || "user");
    const studentCode = student?.student_id;
    select.appendChild(
      new Option(
        `${name} (${role}${studentCode ? ` · ${studentCode}` : ""})`,
        profile.id,
      ),
    );
  });

  if (!profiles.length) {
    select.appendChild(
      new Option(
        searchTerm ? "No matching borrowers" : "No active borrowers available",
        "",
      ),
    );
  }
}

document
  .getElementById("studentSearchInput")
  ?.addEventListener("input", (e) => {
    renderBorrowerOptions(e.target.value.trim());
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
let returnModalRequestId = 0;

async function openReturnModal(bookId) {
  const modal = document.getElementById("returnBorrowModal");
  if (!modal) return;

  const requestId = ++returnModalRequestId;
  currentActiveBorrowings = [];
  modal.style.display = "flex";

  const searchInput = document.getElementById("returnStudentSearchInput");
  if (searchInput) searchInput.value = "";

  const select = document.getElementById("returnBorrowStudentSelect");
  const borrowDateDisplay = document.getElementById("displayBorrowDate");
  const returnDateDisplay = document.getElementById("displayReturnDate");
  const recordIdInput = document.getElementById("activeBorrowRecordId");
  const returnButton = document.getElementById("confirmReturnBtn");
  if (select) select.replaceChildren(new Option("Loading borrowers…", ""));
  if (returnButton) returnButton.disabled = true;

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
          email,
          role,
          students ( student_id )
        )
      `,
      )
      .eq("book_id", bookId)
      .eq("status", "borrowed");

    if (error) throw error;

    if (requestId !== returnModalRequestId) return;

    currentActiveBorrowings = activeBorrowings || [];

    if (currentActiveBorrowings.length === 0) {
      if (select) select.replaceChildren(new Option("No active borrowers", ""));
      if (typeof showToast === "function") {
        showToast("No active borrowings found for this book.", "error");
      }
      modal.style.display = "none";
      return;
    }

    renderBorrowerDropdown(currentActiveBorrowings);
  } catch (err) {
    if (requestId !== returnModalRequestId) return;
    if (select) select.replaceChildren(new Option("Borrowers could not be loaded", ""));
    console.error("Error opening return modal:", err);
    if (typeof showToast === "function") {
      showToast("Failed to load return details.", "error");
    }
  }
}

function renderBorrowerDropdown(borrowings) {
  const select = document.getElementById("returnBorrowStudentSelect");
  const borrowDateDisplay = document.getElementById("displayBorrowDate");
  const recordIdInput = document.getElementById("activeBorrowRecordId");

  if (!select) return;

  const returnButton = document.getElementById("confirmReturnBtn");
  if (returnButton) returnButton.disabled = borrowings.length === 0;

  select.innerHTML = '<option value="">Select borrower</option>';

  borrowings.forEach((record) => {
    const borrowerProfile = record.profiles || {};

    const borrowerName =
      borrowerProfile.full_name ||
      borrowerProfile.email ||
      "-";
    const borrowerRole = borrowerProfile.role || "user";
    const studentCode = record.profiles?.students?.student_id;

    const opt = document.createElement("option");
    opt.value = record.id;
    opt.textContent = `${borrowerName} (${borrowerRole}${studentCode ? ` · ${studentCode}` : ""})`;
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

const borrowerSearchInput = document.getElementById("returnStudentSearchInput");
if (borrowerSearchInput) {
  borrowerSearchInput.addEventListener("input", (e) => {
    const query = e.target.value.toLowerCase().trim();

    const filtered = currentActiveBorrowings.filter((record) => {
      const borrowerProfile = record.profiles || {};

      const studentRecord = borrowerProfile.students || {};

      const name = (
        borrowerProfile.full_name ||
        borrowerProfile.email ||
        ""
      ).toLowerCase();
      const studentId = (
        studentRecord.student_id ||
        borrowerProfile.id ||
        ""
      ).toLowerCase();
      const role = String(borrowerProfile.role || "").toLowerCase();

      return name.includes(query) || studentId.includes(query) || role.includes(query);
    });

    renderBorrowerDropdown(filtered);
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

    openReturnModal(currentViewBookId);
  });

document.addEventListener("DOMContentLoaded", () => {
  document
    .getElementById("nextLibraryBooksPage")
    ?.addEventListener("click", () => loadBooksTable({ append: true }));
  loadLibraryDeletePermission().finally(() => loadBooksTable());
});
