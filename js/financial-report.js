/**
 * financial-report.js
 * Generates live executive summary and detailed roster of student fees and school revenues.
 */

document.addEventListener("DOMContentLoaded", async () => {
  const authCtx = await ReportsCommon.initAuth();
  if (!authCtx) return;

  const client = window.supabaseClient || supabaseClient;

  // DOM Elements
  const filterYear = document.getElementById("filterYear");
  const filterTerm = document.getElementById("filterTerm");
  const filterClass = document.getElementById("filterClass");
  const filterStatus = document.getElementById("filterStatus");
  const summaryBody = document.getElementById("financialSummaryBody");
  const detailBody = document.getElementById("financialDetailBody");
  const detailCount = document.getElementById("detailRecordCount");

  let allFeesData = [];

  // Initialize filter dropdowns
  const lookups = await ReportsCommon.getLookups();
  ReportsCommon.populateSelect(filterYear, lookups.academicYears, {
    placeholder: "All Academic Years",
    valueKey: "id",
    labelKey: "year_label",
  });
  ReportsCommon.populateSelect(filterTerm, lookups.terms, {
    placeholder: "All Terms",
    valueKey: "id",
    labelKey: "name",
  });
  ReportsCommon.populateSelect(filterClass, lookups.classes, {
    placeholder: "All Classes",
    valueKey: "id",
    labelKey: "name",
  });

  // Attach change listeners
  [filterYear, filterTerm, filterClass, filterStatus].forEach((el) => {
    if (el) el.addEventListener("change", fetchAndRenderData);
  });

  // Initial Fetch
  await fetchAndRenderData();

  async function fetchAndRenderData() {
    ReportsCommon.renderLoading(summaryBody, 7, "Loading revenue data...");
    ReportsCommon.renderLoading(detailBody, 8, "Loading fee records...");

    try {
      let query = client
        .from("student_fees")
        .select(
          `
          id,
          total_fees,
          total_paid,
          balance,
          currency_code,
          status,
          student_id,
          class_id,
          academic_year_id,
          term_id,
          classes:class_id ( id, name ),
          terms:term_id ( id, name ),
          academic_years:academic_year_id ( id, year_label )
        `,
        )
        .order("created_at", { ascending: false });

      const selectedYear = filterYear?.value;
      const selectedTerm = filterTerm?.value;
      const selectedClass = filterClass?.value;
      const selectedStatus = filterStatus?.value;

      if (selectedYear) query = query.eq("academic_year_id", selectedYear);
      if (selectedTerm) query = query.eq("term_id", selectedTerm);
      if (selectedClass) query = query.eq("class_id", selectedClass);
      if (selectedStatus) query = query.eq("status", selectedStatus);

      const { data: fees, error } = await query;
      if (error) throw error;

      const rawFees = fees || [];

      // Fetch student details in separate query to avoid schema foreign key requirement
      const studentIds = [
        ...new Set(rawFees.map((fee) => fee.student_id).filter(Boolean)),
      ];

      const studentMap = new Map();
      if (studentIds.length > 0) {
        const { data: studentRecords, error: sErr } = await client
          .from("students")
          .select("id, student_id, profiles ( full_name )")
          .in("id", studentIds);

        if (!sErr && studentRecords) {
          studentRecords.forEach((s) => {
            studentMap.set(s.id, {
              code: s.student_id || "N/A",
              name: s.profiles?.full_name || "Unknown Student",
            });
          });
        }
      }

      // Merge student details into fee objects
      allFeesData = rawFees.map((f) => {
        const studentInfo = studentMap.get(f.student_id) || {
          code: "N/A",
          name: "Student",
        };
        return {
          ...f,
          studentCode: studentInfo.code,
          studentName: studentInfo.name,
        };
      });

      renderSummary(allFeesData);
      renderDetails(allFeesData);
    } catch (err) {
      console.error("Error fetching financial report:", err);
      if (summaryBody) {
        summaryBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #dc2626; padding: 20px;">Failed to load financial data: ${ReportsCommon.escapeHTML(err.message)}</td></tr>`;
      }
      if (detailBody) {
        detailBody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #dc2626; padding: 20px;">Failed to load detail records.</td></tr>`;
      }
    }
  }

  function renderSummary(fees) {
    if (!summaryBody) return;

    if (!fees || fees.length === 0) {
      summaryBody.innerHTML = `
        <tr>
          <td>—</td>
          <td>—</td>
          <td>—</td>
          <td>0</td>
          <td>0</td>
          <td>0</td>
          <td>
            <button class="financials-record-actions-btn btn-print" onclick="ReportsCommon.printReport()">
              <i class="fa-solid fa-print"></i> Print
            </button>
            <button class="financials-record-actions-btn btn-excel" onclick="window.exportFinancialReport()">
              <i class="fa-solid fa-file-excel"></i> Export Excel
            </button>
          </td>
        </tr>
      `;
      return;
    }

    const totalsByCurrency = new Map();

    fees.forEach((f) => {
      const currencyCode = String(f.currency_code || "").trim().toUpperCase();
      if (!totalsByCurrency.has(currencyCode)) {
        totalsByCurrency.set(currencyCode, {
          expectedRevenue: 0,
          collectedRevenue: 0,
          outstandingBalance: 0,
          paidCount: 0,
          partialCount: 0,
          unpaidCount: 0,
        });
      }
      const totals = totalsByCurrency.get(currencyCode);
      totals.expectedRevenue += Number(f.total_fees) || 0;
      totals.collectedRevenue += Number(f.total_paid) || 0;
      totals.outstandingBalance += Number(f.balance) || 0;

      const st = (f.status || "").toLowerCase();
      if (st === "paid") totals.paidCount++;
      else if (st === "partial") totals.partialCount++;
      else totals.unpaidCount++;
    });

    summaryBody.innerHTML = [...totalsByCurrency.entries()]
      .map(([currencyCode, totals], index) => `
      <tr>
        <td><strong>${ReportsCommon.formatCurrency(totals.expectedRevenue, currencyCode)}</strong></td>
        <td><strong style="color: #16a34a;">${ReportsCommon.formatCurrency(totals.collectedRevenue, currencyCode)}</strong></td>
        <td><strong style="color: #dc2626;">${ReportsCommon.formatCurrency(totals.outstandingBalance, currencyCode)}</strong></td>
        <td><span class="status-badge paid">${ReportsCommon.formatNumber(totals.paidCount)}</span></td>
        <td><span class="status-badge partial">${ReportsCommon.formatNumber(totals.partialCount)}</span></td>
        <td><span class="status-badge unpaid">${ReportsCommon.formatNumber(totals.unpaidCount)}</span></td>
        <td>${index === 0 ? `
          <button class="financials-record-actions-btn btn-print" title="Print Report" onclick="ReportsCommon.printReport()">
            <i class="fa-solid fa-print"></i> Print
          </button>
          <button class="financials-record-actions-btn btn-pdf" title="Export PDF" onclick="ReportsCommon.printReport()">
            <i class="fa-solid fa-file-pdf"></i> PDF
          </button>
          <button class="financials-record-actions-btn btn-excel" title="Export Excel" onclick="window.exportFinancialReport()">
            <i class="fa-solid fa-file-excel"></i> Excel
          </button>
        ` : ""}</td>
      </tr>`)
      .join("");
  }

  function renderDetails(fees) {
    if (!detailBody) return;

    if (detailCount) {
      detailCount.textContent = `${fees.length} ${fees.length === 1 ? "record" : "records"}`;
    }

    if (!fees || fees.length === 0) {
      ReportsCommon.renderEmpty(detailBody, 8, "No fee records match the selected filters.");
      return;
    }

    detailBody.innerHTML = fees
      .map((item) => {
        const studentCode = item.studentCode || "N/A";
        const studentName = item.studentName || "Unknown Student";
        const className = item.classes?.name || "N/A";
        const termName = item.terms?.name || "N/A";
        const totalFee = ReportsCommon.formatCurrency(item.total_fees, item.currency_code);
        const totalPaid = ReportsCommon.formatCurrency(item.total_paid, item.currency_code);
        const balance = ReportsCommon.formatCurrency(item.balance, item.currency_code);
        const status = (item.status || "unpaid").toLowerCase();

        return `
          <tr>
            <td><code>${ReportsCommon.escapeHTML(studentCode)}</code></td>
            <td><strong>${ReportsCommon.escapeHTML(studentName)}</strong></td>
            <td>${ReportsCommon.escapeHTML(className)}</td>
            <td>${ReportsCommon.escapeHTML(termName)}</td>
            <td>${totalFee}</td>
            <td style="color: #16a34a; font-weight: 500;">${totalPaid}</td>
            <td style="color: #dc2626; font-weight: 500;">${balance}</td>
            <td><span class="status-badge ${status}">${ReportsCommon.escapeHTML(status)}</span></td>
          </tr>
        `;
      })
      .join("");
  }

  // Global Excel Export
  window.exportFinancialReport = function () {
    const headers = [
      "Student ID",
      "Student Name",
      "Class",
      "Term",
      "Academic Year",
      "Currency",
      "Expected Fee",
      "Amount Paid",
      "Balance",
      "Status",
    ];

    const rows = allFeesData.map((f) => [
      f.studentCode || "N/A",
      f.studentName || "Unknown",
      f.classes?.name || "N/A",
      f.terms?.name || "N/A",
      f.academic_years?.year_label || "N/A",
      f.currency_code || "",
      f.total_fees || 0,
      f.total_paid || 0,
      f.balance || 0,
      f.status || "unpaid",
    ]);

    ReportsCommon.exportToCSV("Financial_Report", headers, rows);
  };
});
