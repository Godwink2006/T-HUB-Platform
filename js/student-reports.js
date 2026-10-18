/**
 * student-reports.js
 * Generates aggregated student demographics, average attendance rates,
 * grade averages, and pass/fail distributions.
 */

document.addEventListener("DOMContentLoaded", async () => {
  const authCtx = await ReportsCommon.initAuth();
  if (!authCtx) return;

  const client = window.supabaseClient || supabaseClient;

  // DOM Elements
  const filterYear = document.getElementById("filterYear");
  const filterClass = document.getElementById("filterClass");
  const filterGender = document.getElementById("filterGender");
  const summaryBody = document.getElementById("studentSummaryBody");
  const detailBody = document.getElementById("studentDetailBody");
  const detailCount = document.getElementById("detailRecordCount");

  let allStudentsData = [];

  // Populate lookups
  const lookups = await ReportsCommon.getLookups();
  ReportsCommon.populateSelect(filterYear, lookups.academicYears, {
    placeholder: "All Academic Years",
    valueKey: "id",
    labelKey: "year_label",
  });
  ReportsCommon.populateSelect(filterClass, lookups.classes, {
    placeholder: "All Classes",
    valueKey: "id",
    labelKey: "name",
  });

  // Attach change listeners
  [filterYear, filterClass, filterGender].forEach((el) => {
    if (el) el.addEventListener("change", fetchAndRenderData);
  });

  // Initial Fetch
  await fetchAndRenderData();

  async function fetchAndRenderData() {
    ReportsCommon.renderLoading(summaryBody, 8, "Loading student statistics...");
    ReportsCommon.renderLoading(detailBody, 7, "Loading student roster...");

    try {
      let query = client
        .from("students")
        .select(
          `
          id,
          student_id,
          gender,
          class_id,
          academic_year_id,
          profiles (
            id,
            full_name,
            status,
            photo_url
          ),
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

      const selectedYear = filterYear?.value;
      const selectedClass = filterClass?.value;
      const selectedGender = filterGender?.value;

      if (selectedYear) query = query.eq("academic_year_id", selectedYear);
      if (selectedClass) query = query.eq("class_id", selectedClass);
      if (selectedGender) query = query.ilike("gender", selectedGender);

      const { data: students, error } = await query;
      if (error) throw error;

      if (!students || students.length === 0) {
        allStudentsData = [];
        renderSummary([]);
        renderDetails([]);
        return;
      }

      const studentIds = students.map((s) => s.id);

      // Fetch attendance records for these students
      const { data: attRecords } = await client
        .from("attendance_records")
        .select("student_id, status")
        .in("student_id", studentIds);

      const studentAttMap = new Map();
      (attRecords || []).forEach((r) => {
        if (!studentAttMap.has(r.student_id)) {
          studentAttMap.set(r.student_id, { total: 0, present: 0 });
        }
        const st = studentAttMap.get(r.student_id);
        st.total++;
        const s = (r.status || "").toLowerCase();
        if (s === "present" || s === "late") st.present++;
      });

      // Fetch grades for these students
      const { data: grRecords } = await client
        .from("grade_records")
        .select("student_id, score")
        .in("student_id", studentIds);

      const studentGradeMap = new Map();
      (grRecords || []).forEach((r) => {
        if (r.score !== null && r.score !== undefined && !isNaN(r.score)) {
          if (!studentGradeMap.has(r.student_id)) {
            studentGradeMap.set(r.student_id, []);
          }
          studentGradeMap.get(r.student_id).push(Number(r.score));
        }
      });

      // Combine student performance
      allStudentsData = students.map((student) => {
        const att = studentAttMap.get(student.id);
        const attRate =
          att && att.total > 0 ? (att.present / att.total) * 100 : null;

        const scores = studentGradeMap.get(student.id) || [];
        const avgScore =
          scores.length > 0
            ? scores.reduce((sum, v) => sum + v, 0) / scores.length
            : null;

        return {
          ...student,
          attendanceRate: attRate,
          averageScore: avgScore,
          isPass: avgScore !== null ? avgScore >= 50 : null,
        };
      });

      renderSummary(allStudentsData);
      renderDetails(allStudentsData);
    } catch (err) {
      console.error("Error fetching student reports:", err);
      if (summaryBody) {
        summaryBody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #dc2626; padding: 20px;">Failed to load student statistics.</td></tr>`;
      }
      if (detailBody) {
        detailBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #dc2626; padding: 20px;">Failed to load student roster.</td></tr>`;
      }
    }
  }

  function renderSummary(students) {
    if (!summaryBody) return;

    if (!students || students.length === 0) {
      summaryBody.innerHTML = `
        <tr>
          <td>0</td>
          <td>0</td>
          <td>0</td>
          <td>0%</td>
          <td>0</td>
          <td>0%</td>
          <td>0%</td>
          <td>
            <button class="students-report-actions-btn btn-print" onclick="ReportsCommon.printReport()">
              <i class="fa-solid fa-print"></i> Print
            </button>
            <button class="students-report-actions-btn btn-excel" onclick="window.exportStudentReport()">
              <i class="fa-solid fa-file-excel"></i> Export Excel
            </button>
          </td>
        </tr>
      `;
      return;
    }

    const totalStudents = students.length;
    let maleCount = 0;
    let femaleCount = 0;
    let attSum = 0;
    let attCount = 0;
    let scoreSum = 0;
    let scoreCount = 0;
    let passCount = 0;
    let failCount = 0;

    students.forEach((s) => {
      const g = (s.gender || "").toLowerCase();
      if (g === "male") maleCount++;
      else if (g === "female") femaleCount++;

      if (s.attendanceRate !== null) {
        attSum += s.attendanceRate;
        attCount++;
      }

      if (s.averageScore !== null) {
        scoreSum += s.averageScore;
        scoreCount++;
        if (s.isPass) passCount++;
        else failCount++;
      }
    });

    const avgAttendance = attCount > 0 ? attSum / attCount : 0;
    const avgGrade = scoreCount > 0 ? scoreSum / scoreCount : 0;
    const totalGraded = passCount + failCount;
    const passRate = totalGraded > 0 ? (passCount / totalGraded) * 100 : 0;
    const failRate = totalGraded > 0 ? (failCount / totalGraded) * 100 : 0;

    summaryBody.innerHTML = `
      <tr>
        <td><strong>${ReportsCommon.formatNumber(totalStudents)}</strong></td>
        <td>${ReportsCommon.formatNumber(maleCount)}</td>
        <td>${ReportsCommon.formatNumber(femaleCount)}</td>
        <td><strong>${ReportsCommon.formatPercent(avgAttendance)}</strong></td>
        <td><strong>${avgGrade.toFixed(1)}</strong></td>
        <td><span style="color: #16a34a; font-weight: 600;">${ReportsCommon.formatPercent(passRate)}</span></td>
        <td><span style="color: #dc2626; font-weight: 600;">${ReportsCommon.formatPercent(failRate)}</span></td>
        <td>
          <button class="students-report-actions-btn btn-print" title="Print Report" onclick="ReportsCommon.printReport()">
            <i class="fa-solid fa-print"></i> Print
          </button>
          <button class="students-report-actions-btn btn-pdf" title="Export PDF" onclick="ReportsCommon.printReport()">
            <i class="fa-solid fa-file-pdf"></i> PDF
          </button>
          <button class="students-report-actions-btn btn-excel" title="Export Excel" onclick="window.exportStudentReport()">
            <i class="fa-solid fa-file-excel"></i> Excel
          </button>
        </td>
      </tr>
    `;
  }

  function renderDetails(students) {
    if (!detailBody) return;

    if (detailCount) {
      detailCount.textContent = `${students.length} ${students.length === 1 ? "student" : "students"}`;
    }

    if (!students || students.length === 0) {
      ReportsCommon.renderEmpty(detailBody, 7, "No students match the selected filters.");
      return;
    }

    detailBody.innerHTML = students
      .map((item) => {
        const studentCode = item.student_id || "N/A";
        const studentName = item.profiles?.full_name || "Unknown Student";
        const gender = item.gender || "N/A";
        const className = item.classes?.name || "N/A";
        const attText =
          item.attendanceRate !== null
            ? ReportsCommon.formatPercent(item.attendanceRate)
            : "-";
        const gradeText =
          item.averageScore !== null ? item.averageScore.toFixed(1) : "-";

        let statusBadge = `<span style="color: #94a3b8;">Pending</span>`;
        if (item.isPass !== null) {
          statusBadge = item.isPass
            ? `<span class="result-badge pass">Pass</span>`
            : `<span class="result-badge fail">Fail</span>`;
        }

        return `
          <tr>
            <td><code>${ReportsCommon.escapeHTML(studentCode)}</code></td>
            <td><strong>${ReportsCommon.escapeHTML(studentName)}</strong></td>
            <td style="text-transform: capitalize;">${ReportsCommon.escapeHTML(gender)}</td>
            <td>${ReportsCommon.escapeHTML(className)}</td>
            <td>${attText}</td>
            <td><strong>${gradeText}</strong></td>
            <td>${statusBadge}</td>
          </tr>
        `;
      })
      .join("");
  }

  // Global Excel Export
  window.exportStudentReport = function () {
    const headers = [
      "Student ID",
      "Student Name",
      "Gender",
      "Class",
      "Academic Year",
      "Attendance Rate (%)",
      "Average Score",
      "Pass/Fail Status",
    ];

    const rows = allStudentsData.map((s) => [
      s.student_id || "N/A",
      s.profiles?.full_name || "Unknown",
      s.gender || "N/A",
      s.classes?.name || "N/A",
      s.academic_years?.year_label || "N/A",
      s.attendanceRate !== null ? s.attendanceRate.toFixed(1) : "N/A",
      s.averageScore !== null ? s.averageScore.toFixed(1) : "N/A",
      s.isPass !== null ? (s.isPass ? "Pass" : "Fail") : "Pending",
    ]);

    ReportsCommon.exportToCSV("Student_Report", headers, rows);
  };
});
