/**
 * timetable-report.js
 * Generates aggregated timetable completion metrics and class scheduling rosters.
 */

document.addEventListener("DOMContentLoaded", async () => {
  const authCtx = await ReportsCommon.initAuth();
  if (!authCtx) return;

  const client = window.supabaseClient || supabaseClient;

  // DOM Elements
  const filterClass = document.getElementById("filterClass");
  const filterYear = document.getElementById("filterYear");
  const filterStatus = document.getElementById("filterStatus");
  const summaryBody = document.getElementById("timetableSummaryBody");
  const detailBody = document.getElementById("timetableDetailBody");
  const detailCount = document.getElementById("detailRecordCount");

  let allTimetablesData = [];

  // Populate lookups
  const lookups = await ReportsCommon.getLookups();
  ReportsCommon.populateSelect(filterClass, lookups.classes, {
    placeholder: "All Classes",
    valueKey: "id",
    labelKey: "name",
  });
  ReportsCommon.populateSelect(filterYear, lookups.academicYears, {
    placeholder: "All Academic Years",
    valueKey: "id",
    labelKey: "year_label",
  });

  // Attach change listeners
  [filterClass, filterYear, filterStatus].forEach((el) => {
    if (el) el.addEventListener("change", fetchAndRenderData);
  });

  // Initial Fetch
  await fetchAndRenderData();

  async function fetchAndRenderData() {
    ReportsCommon.renderLoading(summaryBody, 4, "Loading timetable metrics...");
    ReportsCommon.renderLoading(detailBody, 4, "Loading schedule details...");

    try {
      let query = client
        .from("timetables")
        .select(
          `
          id,
          status,
          class_id,
          academic_year_id,
          classes (
            id,
            name
          ),
          academic_years (
            id,
            year_label
          )
        `,
        )
        .order("created_at", { ascending: false });

      const selectedClass = filterClass?.value;
      const selectedYear = filterYear?.value;
      const selectedStatus = filterStatus?.value;

      if (selectedClass) query = query.eq("class_id", selectedClass);
      if (selectedYear) query = query.eq("academic_year_id", selectedYear);
      if (selectedStatus) query = query.ilike("status", selectedStatus);

      const { data: timetables, error } = await query;
      if (error) throw error;

      if (!timetables || timetables.length === 0) {
        allTimetablesData = [];
        renderSummary([]);
        renderDetails([]);
        return;
      }

      // Fetch timetable lessons
      const timetableIds = timetables.map((t) => t.id);
      const { data: lessons } = await client
        .from("timetable_lessons")
        .select("id, timetable_id, day_of_week, period_id")
        .in("timetable_id", timetableIds);

      const lessonCountMap = new Map();
      (lessons || []).forEach((l) => {
        lessonCountMap.set(
          l.timetable_id,
          (lessonCountMap.get(l.timetable_id) || 0) + 1,
        );
      });

      // Combine timetable info
      allTimetablesData = timetables.map((t) => {
        const periodCount = lessonCountMap.get(t.id) || 0;
        const normalizedStatus = (t.status || "").toLowerCase();
        // A timetable is considered complete if active/completed or has >= 10 periods scheduled
        const isComplete =
          normalizedStatus === "active" ||
          normalizedStatus === "completed" ||
          periodCount >= 10;

        return {
          ...t,
          periodCount,
          isComplete,
        };
      });

      renderSummary(allTimetablesData);
      renderDetails(allTimetablesData);
    } catch (err) {
      console.error("Error fetching timetable reports:", err);
      if (summaryBody) {
        summaryBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #dc2626; padding: 20px;">Failed to load timetable metrics: ${ReportsCommon.escapeHTML(err.message)}</td></tr>`;
      }
      if (detailBody) {
        detailBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #dc2626; padding: 20px;">Failed to load schedule roster.</td></tr>`;
      }
    }
  }

  function renderSummary(timetables) {
    if (!summaryBody) return;

    if (!timetables || timetables.length === 0) {
      summaryBody.innerHTML = `
        <tr>
          <td>0</td>
          <td>0</td>
          <td>0</td>
          <td>
            <button class="timetables-report-actions-btn btn-print" onclick="ReportsCommon.printReport()">
              <i class="fa-solid fa-print"></i> Print
            </button>
            <button class="timetables-report-actions-btn btn-excel" onclick="window.exportTimetableReport()">
              <i class="fa-solid fa-file-excel"></i> Export Excel
            </button>
          </td>
        </tr>
      `;
      return;
    }

    const totalTimetables = timetables.length;
    let completedCount = 0;
    let pendingCount = 0;

    timetables.forEach((t) => {
      if (t.isComplete) completedCount++;
      else pendingCount++;
    });

    summaryBody.innerHTML = `
      <tr>
        <td><strong>${ReportsCommon.formatNumber(totalTimetables)}</strong></td>
        <td><strong style="color: #16a34a;">${ReportsCommon.formatNumber(completedCount)}</strong></td>
        <td><strong style="color: #dc2626;">${ReportsCommon.formatNumber(pendingCount)}</strong></td>
        <td>
          <button class="timetables-report-actions-btn btn-print" title="Print Report" onclick="ReportsCommon.printReport()">
            <i class="fa-solid fa-print"></i> Print
          </button>
          <button class="timetables-report-actions-btn btn-pdf" title="Export PDF" onclick="ReportsCommon.printReport()">
            <i class="fa-solid fa-file-pdf"></i> PDF
          </button>
          <button class="timetables-report-actions-btn btn-excel" title="Export Excel" onclick="window.exportTimetableReport()">
            <i class="fa-solid fa-file-excel"></i> Excel
          </button>
        </td>
      </tr>
    `;
  }

  function renderDetails(timetables) {
    if (!detailBody) return;

    if (detailCount) {
      detailCount.textContent = `${timetables.length} ${timetables.length === 1 ? "timetable" : "timetables"}`;
    }

    if (!timetables || timetables.length === 0) {
      ReportsCommon.renderEmpty(detailBody, 4, "No timetables found matching the filters.");
      return;
    }

    detailBody.innerHTML = timetables
      .map((item) => {
        const className = item.classes?.name || "N/A";
        const yearLabel = item.academic_years?.year_label || "N/A";
        const badgeClass = item.isComplete ? "completed" : "pending";
        const badgeText = item.isComplete ? "Completed" : "Pending";

        return `
          <tr>
            <td><strong>${ReportsCommon.escapeHTML(className)}</strong></td>
            <td>${ReportsCommon.escapeHTML(yearLabel)}</td>
            <td><strong>${item.periodCount}</strong> periods</td>
            <td><span class="status-badge ${badgeClass}">${badgeText}</span></td>
          </tr>
        `;
      })
      .join("");
  }

  // Global Excel Export
  window.exportTimetableReport = function () {
    const headers = [
      "Class Name",
      "Academic Year",
      "Scheduled Periods",
      "Status",
    ];

    const rows = allTimetablesData.map((t) => [
      t.classes?.name || "N/A",
      t.academic_years?.year_label || "N/A",
      t.periodCount || 0,
      t.isComplete ? "Completed" : "Pending",
    ]);

    ReportsCommon.exportToCSV("Timetable_Report", headers, rows);
  };
});
