let allCatalogBooks = [];

async function loadBookCatalog() {
  const gridContainer = document.getElementById("bookCardGrid");
  if (!gridContainer) return;


  gridContainer.innerHTML = `
    <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: #64748b;">
      <i class="fa-solid fa-spinner fa-spin" style="margin-right: 0.5rem; font-size: 1.2rem;"></i>
      Loading library catalog...
    </div>
  `;

  try {
    const { data: books, error } = await window.supabaseClient
      .from("books")
      .select(
        `
        *,
        departments ( name )
      `,
      )
      .eq("status", "active")
      .order("title", { ascending: true });

    if (error) throw error;

    const { data: borrowings, error: borrowingsError } =
      await window.supabaseClient
        .from("book_borrowings")
        .select("book_id")
        .eq("status", "borrowed");

    if (borrowingsError) throw borrowingsError;

    allCatalogBooks = (books || []).map((book) => ({
      ...book,
      available_copies: getAvailableBookCopies(book, borrowings || []),
    }));
    renderBookCards(allCatalogBooks);
  } catch (err) {
    console.error("Error loading catalog:", err);
    if (typeof showToast === "function") {
      showToast("Failed to load book catalog.", "error");
    }
  }
}

function getAvailableBookCopies(book, activeBorrowings) {
  const totalCopies = Number(book.total_copies) || 0;
  const borrowedCopies = activeBorrowings.filter(
    (borrowing) => borrowing.book_id === book.id,
  ).length;
  return Math.max(0, totalCopies - borrowedCopies);
}

function renderBookCards(booksToRender) {
  const gridContainer = document.getElementById("bookCardGrid");
  if (!gridContainer) return;

  gridContainer.innerHTML = "";

  if (!booksToRender || booksToRender.length === 0) {
    gridContainer.innerHTML = `
     <div style="grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 5rem 2rem; min-height: 250px; text-align: center; color: #64748b;">
  <i class="fa-solid fa-book-open" style="font-size: 10rem; margin-bottom: 1rem; color: #cbd5e1; display: block;"></i>
  <span style="font-size: 1.1rem; font-weight: 800; color: #334155;">No books available.</span>
</div>
    `;
    return;
  }

  booksToRender.forEach((book) => {
    const card = document.createElement("div");
    card.className = "book-card";

    const coverSrc =
      book.cover_image_url ||
      "https://cdn-icons-png.flaticon.com/512/29/29302.png";
    const departmentName = book.departments ? book.departments.name : "-";
    const availableCopies = Number(book.available_copies) || 0;

    const isAvailable = availableCopies > 0;
    const badgeClass = isAvailable ? "badge-available" : "badge-unavailable";
    const badgeText = isAvailable
      ? `${availableCopies} Available`
      : "Out of Stock";

    card.innerHTML = `
      <div class="book-card-img-wrapper">
        <span class="book-card-badge ${badgeClass}">${badgeText}</span>
        <img
          src="${escapeHtml(coverSrc)}"
          alt="${escapeHtml(book.title)}"
          onerror="this.onerror=null; this.src='https://cdn-icons-png.flaticon.com/512/149/149071.png';"
        />
      </div>
      <div class="book-card-body">
        <span class="book-card-category">${escapeHtml(departmentName)}</span>
        <h3 class="book-card-title">${escapeHtml(book.title)}</h3>
        <p class="book-card-author">By ${escapeHtml(book.author || "Unknown")}</p>
        <div class="book-card-footer">
          <span class="book-copies-text">Shelf: <strong>${escapeHtml(book.shelf_location || "N/A")}</strong></span>
<button class="book-view-details-btn" onclick="openStudentBookHistoryModal('${book.id}')">
  View
</button>
        </div>
      </div>
    `;

    gridContainer.appendChild(card);
  });
}


const catalogSearchInput = document.getElementById("catalogSearchInput");
if (catalogSearchInput) {
  catalogSearchInput.addEventListener("input", (e) => {
    const query = e.target.value.toLowerCase().trim();

    const filtered = allCatalogBooks.filter((book) => {
      const title = (book.title || "").toLowerCase();
      const author = (book.author || "").toLowerCase();
      const dept = (book.departments?.name || "").toLowerCase();
      const code = (book.book_code || "").toLowerCase();

      return (
        title.includes(query) ||
        author.includes(query) ||
        dept.includes(query) ||
        code.includes(query)
      );
    });

    renderBookCards(filtered);
  });
}


document.addEventListener("DOMContentLoaded", () => {
  loadBookCatalog();
});

async function openStudentBookHistoryModal(bookId) {
  const studentModal = document.getElementById("studentHistoryModal");
  if (!studentModal) {
    if (typeof showToast === "function") {
      showToast("Modal element not found.", "error");
    }
    return;
  }

  studentModal.style.display = "flex";
  if (typeof lockBodyScroll === "function") lockBodyScroll();

  const historyContainer = document.getElementById("studentHistoryContent");
  if (historyContainer) {
    historyContainer.innerHTML = `
      <div style="text-align: center; padding: 2rem; color: #64748b;">
        <i class="fa-solid fa-spinner fa-spin" style="margin-right: 0.5rem;"></i> Loading your history...
      </div>
    `;
  }

  try {
    const {
      data: { user },
      error: authError,
    } = await window.supabaseClient.auth.getUser();
    if (authError || !user) throw new Error("Not authenticated");

    const { data: profile, error: profileError } = await window.supabaseClient
      .from("profiles")
      .select("id, full_name, email, photo_url, role, students(student_id), teachers(staff_id)")
      .eq("id", user.id)
      .single();
    if (profileError) throw profileError;

    const { data: history, error } = await window.supabaseClient
      .from("book_borrowings")
      .select(`*, books ( title, book_code, description )`)
      .eq("book_id", bookId)
      .eq("borrower_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    if (!historyContainer) return;

    const book =
      allCatalogBooks.find((item) => item.id === bookId) ||
      history?.[0]?.books ||
      {};
    const student = Array.isArray(profile.students)
      ? profile.students[0]
      : profile.students;
    const borrowerIdentity = getBorrowerIdentity(profile, student);
    const borrowerName = profile.full_name || profile.email || "User";
    const photoUrl = getSafeProfilePhotoUrl(profile.photo_url);
    const bookDetails = `
      <section class="book-history-book">
        <h4>${escapeHtml(book.title || "Book details")}</h4>
        ${book?.book_code ? `<p><strong>Book ID:</strong> ${escapeHtml(book.book_code)}</p>` : ""}
        <p><strong>Description:</strong> ${escapeHtml(book.description || "No description available.")}</p>
      </section>
      <section class="book-history-borrower" aria-label="Borrower profile">
        <img class="app-person-avatar" src="${escapeHtml(photoUrl)}" alt="" aria-hidden="true" onerror="this.onerror=null;this.src='${escapeHtml(window.DEFAULT_PROFILE_AVATAR || "")}'" />
        <span class="app-person-meta">
          <strong>${escapeHtml(borrowerName)}</strong>
          <small>${escapeHtml(profile.role || "User")}</small>
          ${borrowerIdentity ? `<small>${escapeHtml(borrowerIdentity.label)}: ${escapeHtml(borrowerIdentity.value)}</small>` : ""}
        </span>
      </section>
      <h4 class="book-history-section-title">Borrowing History</h4>
    `;

    if (!history || history.length === 0) {
      historyContainer.innerHTML = `${bookDetails}
        <div class="empty-state-card">
          <i class="fa-solid fa-book-open-reader empty-icon"></i>
          <p>You have no borrowing history for this book yet.</p>
        </div>`;
      return;
    }

    historyContainer.innerHTML = `${bookDetails}${history
      .map((record) => `
     <div class="small-card" style="background: #f8fafc; padding: 1rem; margin-bottom: 0.75rem; border: 2px solid rgb(219, 215, 215);">
        <p style="margin: 0 0 0.5rem 0;"><strong>Borrowed Date:</strong> ${formatDate(record.borrow_date)}</p>
        <p style="margin: 0 0 0.5rem 0;"><strong>Due Date:</strong> ${formatDate(record.due_date)}</p>
        <p style="margin: 0 0 0.5rem 0;"><strong>Return Date:</strong> ${record.return_date ? formatDate(record.return_date) : "Not returned yet"}</p>
        <p style="margin: 0;"><strong>Status:</strong> <span class="status-${escapeHtml(record.status)}">${escapeHtml(record.status)}</span></p>
      </div>
    `).join("")}`;
  } catch (err) {
    console.error("Error loading student history:", err);
    if (historyContainer) {
      historyContainer.innerHTML = `<p style="text-align: center; color: #dc2626; padding: 2rem;">Failed to load your borrowing history.</p>`;
    }
    if (typeof showToast === "function") {
      showToast("Failed to load history.", "error");
    }
  }
}

function getBorrowerIdentity(profile, student = null) {
  const role = String(profile?.role || "").toLowerCase();
  const teacher = Array.isArray(profile?.teachers)
    ? profile.teachers[0]
    : profile?.teachers;

  if (role === "student" && student?.student_id) {
    return { label: "Student ID", value: student.student_id };
  }
  if (role === "teacher" && teacher?.staff_id) {
    return { label: "Staff ID", value: teacher.staff_id };
  }
  return null;
}

function getSafeProfilePhotoUrl(photoUrl) {
  if (!photoUrl) return window.DEFAULT_PROFILE_AVATAR || "";
  try {
    const parsedPhotoUrl = new URL(photoUrl, window.location.href);
    if (
      ["https:", "http:"].includes(parsedPhotoUrl.protocol) ||
      photoUrl === window.DEFAULT_PROFILE_AVATAR
    ) {
      return parsedPhotoUrl.href;
    }
  } catch (error) {
    console.warn("Ignoring invalid profile photo URL:", error);
  }
  return window.DEFAULT_PROFILE_AVATAR || "";
}


function formatDate(dateString) {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return escapeHtml(dateString);

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
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


function closeStudentHistoryModal() {
  const studentModal = document.getElementById("studentHistoryModal");
  if (studentModal) {
    studentModal.style.display = "none";
  }
  if (typeof unLockBodyScroll === "function") {
    unLockBodyScroll();
  }
}


window.addEventListener("click", (e) => {
  const studentModal = document.getElementById("studentHistoryModal");
  if (studentModal && e.target === studentModal) {
    closeStudentHistoryModal();
  }
});
