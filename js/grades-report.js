/**
 * grades-report.js
 * Loads assessments and grade records to calculate live highest, lowest,
 * average scores, and student assessment breakdowns.
 */

document.addEventListener("DOMContentLoaded", async () => {
  const authCtx = await ReportsCommon.initAuth();
  if (!authCtx) return;

  const client = window.supabaseClient || supabaseClient;

  // DOM Elements
  const filterYear = document.getElementById("filterYear");
  const filterTerm = document.getElementById("filterTerm");
  const filterClass = document.getElementById("filterClass");
  const filterSubject = document.getElementById("filterSubject");
  const summaryBody = document.getElementById("gradeSummaryBody");
  const detailBody = document.getElementById("gradeDetailBody");
  const detailCount = document.getElementById("detailRecordCount");

  let allGradeData = [];

  // Populate lookups
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
  ReportsCommon.populateSelect(filterSubject, lookups.subjects, {
    placeholder: "All Subjects",
    valueKey: "id",
    labelKey: "name",
  });

  // Attach change listeners
  [filterYear, filterTerm, filterClass, filterSubject].forEach((el) => {
    if (el) el.addEventListener("change", fetchAndRenderData);
  });

  // Initial Fetch
  await fetchAndRenderData();

  async function fetchAndRenderData() {
    ReportsCommon.renderLoading(summaryBody, 5, "Loading grade metrics...");
    ReportsCommon.renderLoading(detailBody, 8, "Loading student records...");

    try {
      let query = client
        .from("grade_records")
        .select(
          `
          id,
          score,
          remarks,
          student_id,
          grades!inner (
            id,
            status,
            class_id,
            subject_id,
            academic_year_id,
            term_id,
            classes ( id, name ),
            subjects ( id, name ),
            terms ( id, name ),
            academic_years ( id, year_label ),
            assessments ( id, name, maximum_marks ),
            assessment_categories ( id, name, marks )
          )
        `,
        )
        .order("created_at", { ascending: false });

      const selectedYear = filterYear?.value;
      const selectedTerm = filterTerm?.value;
      const selectedClass = filterClass?.value;
      const selectedSubject = filterSubject?.value;

      if (selectedYear) query = query.eq("grades.academic_year_id", selectedYear);
      if (selectedTerm) query = query.eq("grades.term_id", selectedTerm);
      if (selectedClass) query = query.eq("grades.class_id", selectedClass);
      if (selectedSubject) query = query.eq("grades.subject_id", selectedSubject);

      const { data: records, error } = await query;
      if (error) throw error;

      const rawRecords = records || [];

      // Fetch student names separately to prevent ambiguous PostgREST joins
      const studentIds = [
        ...new Set(rawRecords.map((r) => r.student_id).filter(Boolean)),
      ];

      const studentNameMap = new Map();
      if (studentIds.length > 0) {
        const { data: studentList, error: sErr } = await client
          .from("students")
          .select("id, student_id, profiles ( full_name )")
          .in("id", studentIds);

        if (!sErr && studentList) {
          studentList.forEach((s) => {
            studentNameMap.set(
              s.id,
              s.profiles?.full_name || s.student_id || "Unknown Student",
            );
          });
        }
      }

      // Merge student name into records
      allGradeData = rawRecords.map((r) => ({
        ...r,
        studentName: studentNameMap.get(r.student_id) || "Student",
      }));

      renderSummary(allGradeData);
      renderDetails(allGradeData);
    } catch (err) {
      console.error("Error fetching grade report:", err);
      if (summaryBody) {
        summaryBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #dc2626; padding: 20px;">Failed to load grade data: ${ReportsCommon.escapeHTML(err.message)}</td></tr>`;
      }
      if (detailBody) {
        detailBody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #dc2626; padding: 20px;">Failed to load performance roster.</td></tr>`;
      }
    }
  }

  function renderSummary(records) {
    if (!summaryBody) return;

    if (!records || records.length === 0) {
      summaryBody.innerHTML = `
        <tr>
          <td>0</td>
          <td>0</td>
          <td>0</td>
          <td>0</td>
          <td>
            <button class="grades-report-actions-btn btn-print" onclick="ReportsCommon.printReport()">
              <i class="fa-solid fa-print"></i> Print
            </button>
            <button class="grades-report-actions-btn btn-excel" onclick="window.exportGradeReport()">
              <i class="fa-solid fa-file-excel"></i> Export Excel
            </button>
          </td>
        </tr>
      `;
      return;
    }

    // Distinct assessments
    const distinctAssessments = new Set();
    const scores = [];

    records.forEach((r) => {
      if (r.grades?.id) distinctAssessments.add(r.grades.id);
      if (r.score !== null && r.score !== undefined && !isNaN(r.score)) {
        scores.push(Number(r.score));
      }
    });

    const totalAssessments = distinctAssessments.size;
    const highestScore = scores.length > 0 ? Math.max(...scores) : 0;
    const lowestScore = scores.length > 0 ? Math.min(...scores) : 0;
    const averageScore =
      scores.length > 0
        ? scores.reduce((sum, val) => sum + val, 0) / scores.length
        : 0;

    summaryBody.innerHTML = `
      <tr>
        <td><strong>${ReportsCommon.formatNumber(totalAssessments)}</strong> <small style="color: #64748b;">(${ReportsCommon.formatNumber(records.length)} student entries)</small></td>
        <td><strong style="color: #16a34a;">${highestScore}</strong></td>
        <td><strong style="color: #dc2626;">${lowestScore}</strong></td>
        <td><strong style="color: #2563eb;">${averageScore.toFixed(1)}</strong></td>
        <td>
          <button class="grades-report-actions-btn btn-print" title="Print Report" onclick="ReportsCommon.printReport()">
            <i class="fa-solid fa-print"></i> Print
          </button>
          <button class="grades-report-actions-btn btn-pdf" title="Export PDF" onclick="ReportsCommon.printReport()">
            <i class="fa-solid fa-file-pdf"></i> PDF
          </button>
          <button class="grades-report-actions-btn btn-excel" title="Export Excel" onclick="window.exportGradeReport()">
            <i class="fa-solid fa-file-excel"></i> Excel
          </button>
        </td>
      </tr>
    `;
  }

  function renderDetails(records) {
    if (!detailBody) return;

    if (detailCount) {
      detailCount.textContent = `${records.length} ${records.length === 1 ? "record" : "records"}`;
    }

    if (!records || records.length === 0) {
      ReportsCommon.renderEmpty(detailBody, 8, "No grade records found matching the filters.");
      return;
    }

    detailBody.innerHTML = records
      .map((item) => {
        const studentName = item.studentName || "Unknown Student";
        const gradeInfo = item.grades || {};
        const className = gradeInfo.classes?.name || "N/A";
        const subjectName = gradeInfo.subjects?.name || "N/A";
        const assessmentName =
          gradeInfo.assessments?.name ||
          gradeInfo.assessment_categories?.name ||
          "Assessment";
        const maxMarks =
          gradeInfo.assessments?.maximum_marks ||
          gradeInfo.assessment_categories?.marks ||
          100;

        const score = Number(item.score) || 0;
        const percentage = maxMarks > 0 ? (score / maxMarks) * 100 : score;

        let badgeClass = "fail";
        let badgeLabel = "Below Average";
        if (percentage >= 80) {
          badgeClass = "distinction";
          badgeLabel = "Distinction";
        } else if (percentage >= 60) {
          badgeClass = "credit";
          badgeLabel = "Credit";
        } else if (percentage >= 50) {
          badgeClass = "pass";
          badgeLabel = "Pass";
        }

        return `
          <tr>
            <td><strong>${ReportsCommon.escapeHTML(studentName)}</strong></td>
            <td>${ReportsCommon.escapeHTML(className)}</td>
            <td>${ReportsCommon.escapeHTML(subjectName)}</td>
            <td>${ReportsCommon.escapeHTML(assessmentName)}</td>
            <td><strong>${score}</strong></td>
            <td>${maxMarks}</td>
            <td>${percentage.toFixed(1)}%</td>
            <td><span class="grade-badge ${badgeClass}">${badgeLabel}</span></td>
          </tr>
        `;
      })
      .join("");
  }

  // Global Excel Export
  window.exportGradeReport = function () {
    const headers = [
      "Student Name",
      "Class",
      "Subject",
      "Assessment",
      "Score",
      "Maximum Marks",
      "Percentage (%)",
      "Term",
      "Academic Year",
    ];

    const rows = allGradeData.map((item) => {
      const gradeInfo = item.grades || {};
      const maxMarks =
        gradeInfo.assessments?.maximum_marks ||
        gradeInfo.assessment_categories?.marks ||
        100;
      const score = Number(item.score) || 0;
      const percentage = maxMarks > 0 ? ((score / maxMarks) * 100).toFixed(1) : score;

      return [
        item.studentName || "Unknown",
        gradeInfo.classes?.name || "N/A",
        gradeInfo.subjects?.name || "N/A",
        gradeInfo.assessments?.name || gradeInfo.assessment_categories?.name || "N/A",
        score,
        maxMarks,
        percentage,
        gradeInfo.terms?.name || "N/A",
        gradeInfo.academic_years?.year_label || "N/A",
      ];
    });

    ReportsCommon.exportToCSV("Grade_Report", headers, rows);
  };
});
