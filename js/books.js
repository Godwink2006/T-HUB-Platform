let allCatalogBooks = [];

async function loadBookCatalog() {
  const gridContainer = document.getElementById("bookCardGrid");
  if (!gridContainer) return;

  // Show loading state
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

    allCatalogBooks = books || [];
    renderBookCards(allCatalogBooks);
  } catch (err) {
    console.error("Error loading catalog:", err);
    if (typeof showToast === "function") {
      showToast("Failed to load book catalog.", "error");
    }
  }
}

function renderBookCards(booksToRender) {
  const gridContainer = document.getElementById("bookCardGrid");
  if (!gridContainer) return;

  gridContainer.innerHTML = "";

  if (!booksToRender || booksToRender.length === 0) {
    gridContainer.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: #64748b;">
        <i class="fa-solid fa-book-open" style="font-size: 2rem; margin-bottom: 0.5rem; display: block;"></i>
        No books available matching your search.
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
    const availableCopies = book.available_copies || 0;

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

// Live Search Filter Listener for Students
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

// Initial trigger on page load
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

    const { data: history, error } = await window.supabaseClient
      .from("book_borrowings")
      .select(`*, books ( title, book_code )`)
      .eq("book_id", bookId)
      .eq("borrower_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    if (!historyContainer) return;

    if (!history || history.length === 0) {
      historyContainer.innerHTML = `
        <p style="text-align: center; color: #64748b; padding: 2rem;">
          You have no borrowing history for this book.
        </p>
      `;
      return;
    }

    historyContainer.innerHTML = history
      .map(
        (record) => `
     <div class="small-card" style="background: #f8fafc; padding: 1rem; margin-bottom: 0.75rem; border: 2px solid rgb(219, 215, 215);">
        <p style="margin: 0 0 0.5rem 0;"><strong>Borrowed Date:</strong> ${formatDate(record.borrow_date)}</p>
        <p style="margin: 0 0 0.5rem 0;"><strong>Due Date:</strong> ${formatDate(record.due_date)}</p>
        <p style="margin: 0 0 0.5rem 0;"><strong>Return Date:</strong> ${record.return_date ? formatDate(record.return_date) : "Not returned yet"}</p>
        <p style="margin: 0;"><strong>Status:</strong> <span class="status-${escapeHtml(record.status)}">${escapeHtml(record.status)}</span></p>
      </div>
    `,
      )
      .join("");
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

// Helper function to format dates into readable strings (e.g., "August 24, 2026")
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

// Shared HTML sanitizer to prevent XSS errors across scripts
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Close function for the student history modal
function closeStudentHistoryModal() {
  const studentModal = document.getElementById("studentHistoryModal");
  if (studentModal) {
    studentModal.style.display = "none";
  }
  if (typeof unLockBodyScroll === "function") {
    unLockBodyScroll();
  }
}

// Global window listener to close the modal when clicking the dark backdrop outside of it
window.addEventListener("click", (e) => {
  const studentModal = document.getElementById("studentHistoryModal");
  if (studentModal && e.target === studentModal) {
    closeStudentHistoryModal();
  }
});
