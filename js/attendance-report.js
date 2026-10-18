/**
 * attendance-report.js
 * Fetches attendance sessions and attendance records to generate live attendance rates,
 * present/absent counts, and session breakdowns.
 */

document.addEventListener("DOMContentLoaded", async () => {
  const authCtx = await ReportsCommon.initAuth();
  if (!authCtx) return;

  const client = window.supabaseClient || supabaseClient;

  // DOM Elements
  const filterYear = document.getElementById("filterYear");
  const filterTerm = document.getElementById("filterTerm");
  const filterClass = document.getElementById("filterClass");
  const filterMonth = document.getElementById("filterMonth");
  const summaryBody = document.getElementById("attendanceSummaryBody");
  const detailBody = document.getElementById("attendanceDetailBody");
  const detailCount = document.getElementById("detailRecordCount");

  let allAttendanceData = [];

  // Populate filter dropdowns
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
  [filterYear, filterTerm, filterClass, filterMonth].forEach((el) => {
    if (el) el.addEventListener("change", fetchAndRenderData);
  });

  // Initial Fetch
  await fetchAndRenderData();

  async function fetchAndRenderData() {
    ReportsCommon.renderLoading(summaryBody, 5, "Loading attendance statistics...");
    ReportsCommon.renderLoading(detailBody, 8, "Loading session details...");

    try {
      let query = client
        .from("attendance")
        .select(
          `
          id,
          date,
          status,
          class_id,
          subject_id,
          academic_year_id,
          term_id,
          classes ( id, name ),
          subjects ( id, name ),
          terms ( id, name ),
          academic_years ( id, year_label )
        `,
        )
        .order("date", { ascending: false });

      const selectedYear = filterYear?.value;
      const selectedTerm = filterTerm?.value;
      const selectedClass = filterClass?.value;
      const selectedMonth = filterMonth?.value;

      if (selectedYear) query = query.eq("academic_year_id", selectedYear);
      if (selectedTerm) query = query.eq("term_id", selectedTerm);
      if (selectedClass) query = query.eq("class_id", selectedClass);

      const { data: attendanceList, error } = await query;
      if (error) throw error;

      let filteredList = attendanceList || [];

      // Filter by Month if specified (date is YYYY-MM-DD)
      if (selectedMonth) {
        filteredList = filteredList.filter((att) => {
          if (!att.date) return false;
          const monthPart = att.date.split("-")[1];
          return monthPart === selectedMonth;
        });
      }

      if (filteredList.length === 0) {
        renderSummary([]);
        renderDetails([]);
        return;
      }

      // Fetch attendance_records for these sessions
      const attendanceIds = filteredList.map((a) => a.id);
      const { data: records, error: recError } = await client
        .from("attendance_records")
        .select("id, attendance_id, student_id, status")
        .in("attendance_id", attendanceIds);

      if (recError) {
        console.warn("Could not fetch attendance records:", recError);
      }

      // Group records by attendance_id
      const recordsBySession = new Map();
      (records || []).forEach((r) => {
        if (!recordsBySession.has(r.attendance_id)) {
          recordsBySession.set(r.attendance_id, []);
        }
        recordsBySession.get(r.attendance_id).push(r);
      });

      // Combine session stats
      allAttendanceData = filteredList.map((session) => {
        const sessionRecords = recordsBySession.get(session.id) || [];
        let present = 0;
        let absent = 0;
        let late = 0;
        let excused = 0;

        sessionRecords.forEach((r) => {
          const st = (r.status || "").toLowerCase();
          if (st === "present") present++;
          else if (st === "absent") absent++;
          else if (st === "late") late++;
          else if (st === "excused") excused++;
        });

        const totalEnrolled = sessionRecords.length;
        const rate =
          totalEnrolled > 0
            ? ((present + late) / totalEnrolled) * 100
            : 0;

        return {
          ...session,
          totalEnrolled,
          present,
          absent,
          late,
          excused,
          rate,
        };
      });

      renderSummary(allAttendanceData);
      renderDetails(allAttendanceData);
    } catch (err) {
      console.error("Error fetching attendance report:", err);
      if (summaryBody) {
        summaryBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #dc2626; padding: 20px;">Failed to load attendance data.</td></tr>`;
      }
      if (detailBody) {
        detailBody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #dc2626; padding: 20px;">Failed to load session details.</td></tr>`;
      }
    }
  }

  function renderSummary(sessions) {
    if (!summaryBody) return;

    if (!sessions || sessions.length === 0) {
      summaryBody.innerHTML = `
        <tr>
          <td>No Records</td>
          <td>0 (0%)</td>
          <td>0 (0%)</td>
          <td>0%</td>
          <td>
            <button class="attendances-report-actions-btn btn-print" onclick="ReportsCommon.printReport()">
              <i class="fa-solid fa-print"></i> Print
            </button>
            <button class="attendances-report-actions-btn btn-excel" onclick="window.exportAttendanceReport()">
              <i class="fa-solid fa-file-excel"></i> Export Excel
            </button>
          </td>
        </tr>
      `;
      return;
    }

    let totalEnrolled = 0;
    let totalPresent = 0;
    let totalAbsent = 0;

    sessions.forEach((s) => {
      totalEnrolled += s.totalEnrolled;
      totalPresent += s.present + s.late;
      totalAbsent += s.absent + s.excused;
    });

    const overallRate =
      totalEnrolled > 0 ? (totalPresent / totalEnrolled) * 100 : 0;
    const presentPercent =
      totalEnrolled > 0 ? (totalPresent / totalEnrolled) * 100 : 0;
    const absentPercent =
      totalEnrolled > 0 ? (totalAbsent / totalEnrolled) * 100 : 0;

    let descriptor = "Good";
    let badgeClass = "medium";
    if (overallRate >= 90) {
      descriptor = "Excellent";
      badgeClass = "high";
    } else if (overallRate >= 75) {
      descriptor = "Good";
      badgeClass = "high";
    } else if (overallRate >= 60) {
      descriptor = "Fair";
      badgeClass = "medium";
    } else {
      descriptor = "Needs Attention";
      badgeClass = "low";
    }

    summaryBody.innerHTML = `
      <tr>
        <td>
          <strong>${descriptor}</strong> 
          <small style="color: #64748b;">(${ReportsCommon.formatNumber(totalEnrolled)} records)</small>
        </td>
        <td>
          <span style="color: #16a34a; font-weight: 600;">
            ${ReportsCommon.formatNumber(totalPresent)} (${ReportsCommon.formatPercent(presentPercent)})
          </span>
        </td>
        <td>
          <span style="color: #dc2626; font-weight: 600;">
            ${ReportsCommon.formatNumber(totalAbsent)} (${ReportsCommon.formatPercent(absentPercent)})
          </span>
        </td>
        <td>
          <span class="rate-badge ${badgeClass}">${ReportsCommon.formatPercent(overallRate)}</span>
        </td>
        <td>
          <button class="attendances-report-actions-btn btn-print" title="Print Report" onclick="ReportsCommon.printReport()">
            <i class="fa-solid fa-print"></i> Print
          </button>
          <button class="attendances-report-actions-btn btn-pdf" title="Export PDF" onclick="ReportsCommon.printReport()">
            <i class="fa-solid fa-file-pdf"></i> PDF
          </button>
          <button class="attendances-report-actions-btn btn-excel" title="Export Excel" onclick="window.exportAttendanceReport()">
            <i class="fa-solid fa-file-excel"></i> Excel
          </button>
        </td>
      </tr>
    `;
  }

  function renderDetails(sessions) {
    if (!detailBody) return;

    if (detailCount) {
      detailCount.textContent = `${sessions.length} ${sessions.length === 1 ? "session" : "sessions"}`;
    }

    if (!sessions || sessions.length === 0) {
      ReportsCommon.renderEmpty(detailBody, 8, "No attendance sessions found matching the filters.");
      return;
    }

    detailBody.innerHTML = sessions
      .map((s) => {
        const className = s.classes?.name || "N/A";
        const subjectName = s.subjects?.name || "General";
        const termName = s.terms?.name || "N/A";
        const dateFormatted = s.date || "N/A";
        const rateBadge =
          s.rate >= 80 ? "high" : s.rate >= 60 ? "medium" : "low";

        return `
          <tr>
            <td><strong>${ReportsCommon.escapeHTML(dateFormatted)}</strong></td>
            <td>${ReportsCommon.escapeHTML(className)}</td>
            <td>${ReportsCommon.escapeHTML(subjectName)}</td>
            <td>${ReportsCommon.escapeHTML(termName)}</td>
            <td>${ReportsCommon.formatNumber(s.totalEnrolled)}</td>
            <td style="color: #16a34a; font-weight: 500;">${ReportsCommon.formatNumber(s.present)}</td>
            <td style="color: #dc2626; font-weight: 500;">${ReportsCommon.formatNumber(s.absent)}</td>
            <td><span class="rate-badge ${rateBadge}">${ReportsCommon.formatPercent(s.rate)}</span></td>
          </tr>
        `;
      })
      .join("");
  }

  // Global Excel Export
  window.exportAttendanceReport = function () {
    const headers = [
      "Session Date",
      "Class",
      "Subject",
      "Term",
      "Academic Year",
      "Total Enrolled",
      "Present",
      "Absent",
      "Attendance Rate (%)",
    ];

    const rows = allAttendanceData.map((s) => [
      s.date || "N/A",
      s.classes?.name || "N/A",
      s.subjects?.name || "General",
      s.terms?.name || "N/A",
      s.academic_years?.year_label || "N/A",
      s.totalEnrolled || 0,
      s.present || 0,
      s.absent || 0,
      (s.rate || 0).toFixed(1),
    ]);

    ReportsCommon.exportToCSV("Attendance_Report", headers, rows);
  };
});
