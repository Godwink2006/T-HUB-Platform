/**
 * grades-report.js
 * Loads category grade records and combines them into assessment-period
 * results before calculating summary scores or rendering the roster.
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
            assessment_id,
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

      // Merge student names, then combine category rows into one whole-period
      // result per student, class, subject, and assessment.
      const namedRecords = rawRecords.map((r) => ({
        ...r,
        studentName: studentNameMap.get(r.student_id) || "Student",
      }));
      allGradeData = buildAssessmentPeriodResults(namedRecords);

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
          <td>-</td>
          <td>-</td>
          <td>-</td>
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

    const percentages = records
      .map((record) => record.percentage)
      .filter((percentage) => Number.isFinite(percentage));
    const highestScore = percentages.length ? Math.max(...percentages) : null;
    const lowestScore = percentages.length ? Math.min(...percentages) : null;
    const averageScore = percentages.length
      ? percentages.reduce((sum, percentage) => sum + percentage, 0) / percentages.length
      : null;

    summaryBody.innerHTML = `
      <tr>
        <td><strong>${ReportsCommon.formatNumber(records.length)}</strong></td>
        <td><strong style="color: #16a34a;">${highestScore === null ? "-" : `${highestScore.toFixed(1)}%`}</strong></td>
        <td><strong style="color: #dc2626;">${lowestScore === null ? "-" : `${lowestScore.toFixed(1)}%`}</strong></td>
        <td><strong style="color: #2563eb;">${averageScore === null ? "-" : `${averageScore.toFixed(1)}%`}</strong></td>
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
      detailCount.textContent = `${records.length} ${records.length === 1 ? "period result" : "period results"}`;
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
        const assessmentName = item.assessmentName || "Assessment";
        const maxMarks = item.maxMarks;
        const score = item.score;
        const percentage = item.percentage;

        let badgeClass = Number.isFinite(percentage) ? "fail" : "";
        let badgeLabel = Number.isFinite(percentage) ? "Below Average" : "No score";
        if (percentage >= 80) {
          badgeClass = "excellent";
          badgeLabel = "Excellent";
        } else if (percentage >= 70) {
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
            <td>${Number.isFinite(percentage) ? `${percentage.toFixed(1)}%` : "-"}</td>
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
      const percentage = Number.isFinite(item.percentage) ? item.percentage.toFixed(1) : "";
      return [
        item.studentName || "Unknown",
        gradeInfo.classes?.name || "N/A",
        gradeInfo.subjects?.name || "N/A",
        item.assessmentName || "N/A",
        item.score,
        item.maxMarks ?? "",
        percentage,
        gradeInfo.terms?.name || "N/A",
        gradeInfo.academic_years?.year_label || "N/A",
      ];
    });

    ReportsCommon.exportToCSV("Grade_Report", headers, rows);
  };

  function buildAssessmentPeriodResults(records) {
    const groups = new Map();

    records.forEach((record) => {
      const grade = record.grades || {};
      const assessment = grade.assessments || {};
      const category = grade.assessment_categories || {};
      const assessmentId = grade.assessment_id || assessment.id || grade.id;
      const key = [record.student_id, grade.class_id, grade.subject_id, assessmentId]
        .map((value) => String(value ?? ""))
        .join(":");

      if (!groups.has(key)) {
        groups.set(key, {
          student_id: record.student_id,
          studentName: record.studentName,
          grades: grade,
          assessmentName: assessment.name || "Assessment",
          score: 0,
          categoryMaxTotal: 0,
          periodMax: Number(assessment.maximum_marks),
          hasScore: false,
        });
      }

      const result = groups.get(key);
      const score = Number(record.score);
      const categoryMax = Number(category.marks);
      if (Number.isFinite(score)) {
        result.score += score;
        result.hasScore = true;
      }
      if (Number.isFinite(categoryMax) && categoryMax > 0) {
        result.categoryMaxTotal += categoryMax;
      }
    });

    return [...groups.values()].map((result) => {
      // Each grade row is one category. Add category scores for the period,
      // then divide by the assessment's period-wide maximum marks. Use the
      // summed category maximum only for older periods without that value.
      result.maxMarks =
        Number.isFinite(result.periodMax) && result.periodMax > 0
          ? result.periodMax
          : result.categoryMaxTotal;
      result.percentage =
        result.hasScore && result.maxMarks > 0
          ? (result.score / result.maxMarks) * 100
          : null;
      return result;
    });
  }
});
