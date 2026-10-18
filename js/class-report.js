/**
 * class-report.js
 * Generates aggregated class counts, active/inactive distribution,
 * and capacity utilization metrics.
 */

document.addEventListener("DOMContentLoaded", async () => {
  const authCtx = await ReportsCommon.initAuth();
  if (!authCtx) return;

  const client = window.supabaseClient || supabaseClient;

  // DOM Elements
  const filterStatus = document.getElementById("filterStatus");
  const filterYear = document.getElementById("filterYear");
  const summaryBody = document.getElementById("classSummaryBody");
  const detailBody = document.getElementById("classDetailBody");
  const detailCount = document.getElementById("detailRecordCount");

  let allClassesData = [];

  // Populate lookups
  const lookups = await ReportsCommon.getLookups();
  ReportsCommon.populateSelect(filterYear, lookups.academicYears, {
    placeholder: "All Academic Years",
    valueKey: "id",
    labelKey: "year_label",
  });

  // Attach change listeners
  [filterStatus, filterYear].forEach((el) => {
    if (el) el.addEventListener("change", fetchAndRenderData);
  });

  // Initial Fetch
  await fetchAndRenderData();

  async function fetchAndRenderData() {
    ReportsCommon.renderLoading(summaryBody, 4, "Loading class metrics...");
    ReportsCommon.renderLoading(detailBody, 6, "Loading class capacities...");

    try {
      let query = client
        .from("classes")
        .select("id, name, school_level, capacity, status, created_at")
        .order("name", { ascending: true });

      const selectedStatus = filterStatus?.value;
      const selectedYear = filterYear?.value;

      if (selectedStatus) query = query.eq("status", selectedStatus);

      const { data: classes, error } = await query;
      if (error) throw error;

      if (!classes || classes.length === 0) {
        allClassesData = [];
        renderSummary([]);
        renderDetails([]);
        return;
      }

      // Query student enrollment counts per class
      let studentQuery = client
        .from("students")
        .select("id, class_id, academic_year_id");

      if (selectedYear) {
        studentQuery = studentQuery.eq("academic_year_id", selectedYear);
      }

      const { data: students } = await studentQuery;

      const studentCountByClass = new Map();
      (students || []).forEach((s) => {
        if (s.class_id) {
          studentCountByClass.set(
            s.class_id,
            (studentCountByClass.get(s.class_id) || 0) + 1,
          );
        }
      });

      // Combine class info
      allClassesData = classes.map((c) => {
        const enrolled = studentCountByClass.get(c.id) || 0;
        const capacity = Number(c.capacity) || 0;
        const utilization =
          capacity > 0 ? (enrolled / capacity) * 100 : 0;

        return {
          ...c,
          enrolled,
          utilization,
        };
      });

      renderSummary(allClassesData);
      renderDetails(allClassesData);
    } catch (err) {
      console.error("Error fetching class report:", err);
      if (summaryBody) {
        summaryBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #dc2626; padding: 20px;">Failed to load class metrics.</td></tr>`;
      }
      if (detailBody) {
        detailBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #dc2626; padding: 20px;">Failed to load class roster.</td></tr>`;
      }
    }
  }

  function renderSummary(classes) {
    if (!summaryBody) return;

    if (!classes || classes.length === 0) {
      summaryBody.innerHTML = `
        <tr>
          <td>0</td>
          <td>0</td>
          <td>0</td>
          <td>
            <button class="classes-report-actions-btn btn-print" onclick="ReportsCommon.printReport()">
              <i class="fa-solid fa-print"></i> Print
            </button>
            <button class="classes-report-actions-btn btn-excel" onclick="window.exportClassReport()">
              <i class="fa-solid fa-file-excel"></i> Export Excel
            </button>
          </td>
        </tr>
      `;
      return;
    }

    const totalClasses = classes.length;
    let activeClasses = 0;
    let inactiveClasses = 0;

    classes.forEach((c) => {
      const st = (c.status || "active").toLowerCase();
      if (st === "active") activeClasses++;
      else inactiveClasses++;
    });

    summaryBody.innerHTML = `
      <tr>
        <td><strong>${ReportsCommon.formatNumber(totalClasses)}</strong></td>
        <td><strong style="color: #16a34a;">${ReportsCommon.formatNumber(activeClasses)}</strong></td>
        <td><strong style="color: #dc2626;">${ReportsCommon.formatNumber(inactiveClasses)}</strong></td>
        <td>
          <button class="classes-report-actions-btn btn-print" title="Print Report" onclick="ReportsCommon.printReport()">
            <i class="fa-solid fa-print"></i> Print
          </button>
          <button class="classes-report-actions-btn btn-pdf" title="Export PDF" onclick="ReportsCommon.printReport()">
            <i class="fa-solid fa-file-pdf"></i> PDF
          </button>
          <button class="classes-report-actions-btn btn-excel" title="Export Excel" onclick="window.exportClassReport()">
            <i class="fa-solid fa-file-excel"></i> Excel
          </button>
        </td>
      </tr>
    `;
  }

  function renderDetails(classes) {
    if (!detailBody) return;

    if (detailCount) {
      detailCount.textContent = `${classes.length} ${classes.length === 1 ? "class" : "classes"}`;
    }

    if (!classes || classes.length === 0) {
      ReportsCommon.renderEmpty(detailBody, 6, "No classes match the selected filters.");
      return;
    }

    detailBody.innerHTML = classes
      .map((item) => {
        const className = item.name || "N/A";
        const level = item.school_level || "-";
        const capacity = item.capacity || 0;
        const enrolled = item.enrolled || 0;
        const status = (item.status || "active").toLowerCase();
        const util = Math.min(100, Math.round(item.utilization));

        let progressClass = "";
        if (util >= 95) progressClass = "danger";
        else if (util >= 80) progressClass = "warning";

        return `
          <tr>
            <td><strong>${ReportsCommon.escapeHTML(className)}</strong></td>
            <td style="text-transform: capitalize;">${ReportsCommon.escapeHTML(level)}</td>
            <td>${ReportsCommon.formatNumber(capacity)}</td>
            <td><strong>${ReportsCommon.formatNumber(enrolled)}</strong></td>
            <td>
              <div class="progress-bar-container">
                <div class="progress-bar-fill ${progressClass}" style="width: ${util}%;"></div>
              </div>
              <small>${item.utilization.toFixed(1)}%</small>
            </td>
            <td><span class="status-badge ${status}">${ReportsCommon.escapeHTML(status)}</span></td>
          </tr>
        `;
      })
      .join("");
  }

  // Global Excel Export
  window.exportClassReport = function () {
    const headers = [
      "Class Name",
      "School Level",
      "Capacity",
      "Enrolled Students",
      "Capacity Utilization (%)",
      "Status",
    ];

    const rows = allClassesData.map((c) => [
      c.name || "N/A",
      c.school_level || "N/A",
      c.capacity || 0,
      c.enrolled || 0,
      (c.utilization || 0).toFixed(1),
      c.status || "active",
    ]);

    ReportsCommon.exportToCSV("Class_Report", headers, rows);
  };
});
