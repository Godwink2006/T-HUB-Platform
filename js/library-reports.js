/**
 * library-reports.js
 * Generates aggregated library inventory counts, borrowings, returns,
 * overdue items, and detailed book status tracking.
 */

document.addEventListener("DOMContentLoaded", async () => {
  const authCtx = await ReportsCommon.initAuth();
  if (!authCtx) return;

  const client = window.supabaseClient || supabaseClient;

  // DOM Elements
  const filterDepartment = document.getElementById("filterDepartment");
  const filterStatus = document.getElementById("filterStatus");
  const summaryBody = document.getElementById("librarySummaryBody");
  const detailBody = document.getElementById("libraryDetailBody");
  const detailCount = document.getElementById("detailRecordCount");

  let allBooksData = [];

  // Populate lookups
  const lookups = await ReportsCommon.getLookups();
  ReportsCommon.populateSelect(filterDepartment, lookups.departments, {
    placeholder: "All Departments",
    valueKey: "id",
    labelKey: "name",
  });

  // Attach change listeners
  [filterDepartment, filterStatus].forEach((el) => {
    if (el) el.addEventListener("change", fetchAndRenderData);
  });

  // Initial Fetch
  await fetchAndRenderData();

  async function fetchAndRenderData() {
    ReportsCommon.renderLoading(summaryBody, 7, "Loading library metrics...");
    ReportsCommon.renderLoading(detailBody, 7, "Loading book catalog...");

    try {
      let query = client
        .from("books")
        .select(
          `
          id,
          title,
          author,
          book_code,
          total_copies,
          shelf_location,
          status,
          department_id,
          departments (
            id,
            name
          )
        `,
        )
        .order("title", { ascending: true });

      const selectedDepartment = filterDepartment?.value;
      const selectedStatus = filterStatus?.value;

      if (selectedDepartment) query = query.eq("department_id", selectedDepartment);

      const { data: books, error } = await query;
      if (error) throw error;

      if (!books || books.length === 0) {
        allBooksData = [];
        renderSummary([]);
        renderDetails([]);
        return;
      }

      // Fetch book borrowings
      const bookIds = books.map((b) => b.id);
      const { data: borrowings } = await client
        .from("book_borrowings")
        .select("id, book_id, borrower_id, borrow_date, due_date, return_date, status")
        .in("book_id", bookIds);

      const today = new Date().toISOString().split("T")[0];

      // Group borrowings by book_id
      const bookBorrowMap = new Map();
      let totalReturnedAll = 0;
      let totalOverdueAll = 0;
      let totalLostAll = 0;

      (borrowings || []).forEach((b) => {
        if (!bookBorrowMap.has(b.book_id)) {
          bookBorrowMap.set(b.book_id, {
            borrowed: 0,
            returned: 0,
            overdue: 0,
            lost: 0,
          });
        }
        const counts = bookBorrowMap.get(b.book_id);
        const st = (b.status || "").toLowerCase();

        if (st === "returned") {
          counts.returned++;
          totalReturnedAll++;
        } else if (st === "lost") {
          counts.lost++;
          totalLostAll++;
        } else if (st === "overdue" || (st === "borrowed" && b.due_date && b.due_date < today)) {
          counts.overdue++;
          counts.borrowed++;
          totalOverdueAll++;
        } else if (st === "borrowed") {
          counts.borrowed++;
        }
      });

      // Combine book stats
      allBooksData = books.map((b) => {
        const counts = bookBorrowMap.get(b.id) || {
          borrowed: 0,
          returned: 0,
          overdue: 0,
          lost: 0,
        };
        const totalCopies = Number(b.total_copies) || 0;
        const availableCopies = Math.max(0, totalCopies - counts.borrowed);

        let derivedStatus = "available";
        if (availableCopies === 0 && totalCopies > 0) derivedStatus = "borrowed";
        if (counts.overdue > 0) derivedStatus = "overdue";
        if (counts.lost > 0 && totalCopies === 0) derivedStatus = "lost";

        return {
          ...b,
          totalCopies,
          availableCopies,
          borrowedCopies: counts.borrowed,
          returnedCopies: counts.returned,
          overdueCopies: counts.overdue,
          lostCopies: counts.lost,
          derivedStatus,
        };
      });

      // Filter by inventory status if selected
      let displayBooks = allBooksData;
      if (selectedStatus) {
        displayBooks = allBooksData.filter((b) => {
          if (selectedStatus === "available") return b.availableCopies > 0;
          if (selectedStatus === "borrowed") return b.borrowedCopies > 0;
          if (selectedStatus === "overdue") return b.overdueCopies > 0;
          if (selectedStatus === "lost") return b.lostCopies > 0;
          return true;
        });
      }

      renderSummary(displayBooks, {
        totalReturnedAll,
        totalOverdueAll,
        totalLostAll,
      });
      renderDetails(displayBooks);
    } catch (err) {
      console.error("Error fetching library reports:", err);
      if (summaryBody) {
        summaryBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #dc2626; padding: 20px;">Failed to load library metrics: ${ReportsCommon.escapeHTML(err.message)}</td></tr>`;
      }
      if (detailBody) {
        detailBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #dc2626; padding: 20px;">Failed to load catalog inventory.</td></tr>`;
      }
    }
  }

  function renderSummary(books, globals = {}) {
    if (!summaryBody) return;

    if (!books || books.length === 0) {
      summaryBody.innerHTML = `
        <tr>
          <td>0</td>
          <td>0</td>
          <td>0</td>
          <td>0</td>
          <td>0</td>
          <td>0</td>
          <td>
            <button class="librarys-report-actions-btn btn-print" onclick="ReportsCommon.printReport()">
              <i class="fa-solid fa-print"></i> Print
            </button>
            <button class="librarys-report-actions-btn btn-excel" onclick="window.exportLibraryReport()">
              <i class="fa-solid fa-file-excel"></i> Export Excel
            </button>
          </td>
        </tr>
      `;
      return;
    }

    let totalCopiesSum = 0;
    let totalBorrowedSum = 0;
    let totalReturnedSum = 0;
    let totalOverdueSum = 0;
    let totalLostSum = 0;
    let totalAvailableSum = 0;

    books.forEach((b) => {
      totalCopiesSum += b.totalCopies;
      totalBorrowedSum += b.borrowedCopies;
      totalReturnedSum += b.returnedCopies;
      totalOverdueSum += b.overdueCopies;
      totalLostSum += b.lostCopies;
      totalAvailableSum += b.availableCopies;
    });

    summaryBody.innerHTML = `
      <tr>
        <td><strong>${ReportsCommon.formatNumber(totalCopiesSum)}</strong> <small style="color: #64748b;">(${books.length} titles)</small></td>
        <td><strong style="color: #854d0e;">${ReportsCommon.formatNumber(totalBorrowedSum)}</strong></td>
        <td><strong style="color: #16a34a;">${ReportsCommon.formatNumber(totalReturnedSum)}</strong></td>
        <td><strong style="color: #dc2626;">${ReportsCommon.formatNumber(totalOverdueSum)}</strong></td>
        <td><span style="color: #64748b; font-weight: 500;">${ReportsCommon.formatNumber(totalLostSum)}</span></td>
        <td><span class="status-badge available">${ReportsCommon.formatNumber(totalAvailableSum)}</span></td>
        <td>
          <button class="librarys-report-actions-btn btn-print" title="Print Report" onclick="ReportsCommon.printReport()">
            <i class="fa-solid fa-print"></i> Print
          </button>
          <button class="librarys-report-actions-btn btn-pdf" title="Export PDF" onclick="ReportsCommon.printReport()">
            <i class="fa-solid fa-file-pdf"></i> PDF
          </button>
          <button class="librarys-report-actions-btn btn-excel" title="Export Excel" onclick="window.exportLibraryReport()">
            <i class="fa-solid fa-file-excel"></i> Excel
          </button>
        </td>
      </tr>
    `;
  }

  function renderDetails(books) {
    if (!detailBody) return;

    if (detailCount) {
      detailCount.textContent = `${books.length} ${books.length === 1 ? "title" : "titles"}`;
    }

    if (!books || books.length === 0) {
      ReportsCommon.renderEmpty(detailBody, 7, "No books found matching the selected filters.");
      return;
    }

    detailBody.innerHTML = books
      .map((item) => {
        const title = item.title || "Untitled";
        const author = item.author || "Unknown";
        const department = item.departments?.name || "General";
        const status = item.derivedStatus || "available";

        return `
          <tr>
            <td><strong>${ReportsCommon.escapeHTML(title)}</strong></td>
            <td>${ReportsCommon.escapeHTML(author)}</td>
            <td>${ReportsCommon.escapeHTML(department)}</td>
            <td>${ReportsCommon.formatNumber(item.totalCopies)}</td>
            <td><strong style="color: #16a34a;">${ReportsCommon.formatNumber(item.availableCopies)}</strong></td>
            <td><strong style="color: #854d0e;">${ReportsCommon.formatNumber(item.borrowedCopies)}</strong></td>
            <td><span class="status-badge ${status}">${ReportsCommon.escapeHTML(status)}</span></td>
          </tr>
        `;
      })
      .join("");
  }

  // Global Excel Export
  window.exportLibraryReport = function () {
    const headers = [
      "Book Title",
      "Author",
      "Department",
      "Shelf Location",
      "Total Copies",
      "Available Copies",
      "Currently Borrowed",
      "Returned Copies",
      "Overdue Copies",
      "Lost Copies",
      "Status",
    ];

    const rows = allBooksData.map((b) => [
      b.title || "Untitled",
      b.author || "Unknown",
      b.departments?.name || "General",
      b.shelf_location || "N/A",
      b.totalCopies,
      b.availableCopies,
      b.borrowedCopies,
      b.returnedCopies,
      b.overdueCopies,
      b.lostCopies,
      b.derivedStatus,
    ]);

    ReportsCommon.exportToCSV("Library_Report", headers, rows);
  };
});
