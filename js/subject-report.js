/**
 * subject-report.js
 * Generates aggregated subject metrics, department offerings,
 * and teacher/classroom assignment coverage.
 */

document.addEventListener("DOMContentLoaded", async () => {
  const authCtx = await ReportsCommon.initAuth();
  if (!authCtx) return;

  const client = window.supabaseClient || supabaseClient;

  // DOM Elements
  const filterDepartment = document.getElementById("filterDepartment");
  const filterClass = document.getElementById("filterClass");
  const filterYear = document.getElementById("filterYear");
  const summaryBody = document.getElementById("subjectSummaryBody");
  const detailBody = document.getElementById("subjectDetailBody");
  const detailCount = document.getElementById("detailRecordCount");

  let allSubjectsData = [];

  // Populate lookups
  const lookups = await ReportsCommon.getLookups();
  ReportsCommon.populateSelect(filterDepartment, lookups.departments, {
    placeholder: "All Departments",
    valueKey: "id",
    labelKey: "name",
  });
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
  [filterDepartment, filterClass, filterYear].forEach((el) => {
    if (el) el.addEventListener("change", fetchAndRenderData);
  });

  // Initial Fetch
  await fetchAndRenderData();

  async function fetchAndRenderData() {
    ReportsCommon.renderLoading(summaryBody, 4, "Loading subject metrics...");
    ReportsCommon.renderLoading(detailBody, 5, "Loading curriculum allocations...");

    try {
      let query = client
        .from("subjects")
        .select(
          `
          id,
          name,
          description,
          status,
          department_id,
          departments (
            id,
            name
          )
        `,
        )
        .order("name", { ascending: true });

      const selectedDepartment = filterDepartment?.value;
      const selectedClass = filterClass?.value;
      const selectedYear = filterYear?.value;

      if (selectedDepartment) query = query.eq("department_id", selectedDepartment);

      const { data: subjects, error } = await query;
      if (error) throw error;

      if (!subjects || subjects.length === 0) {
        allSubjectsData = [];
        renderSummary([]);
        renderDetails([]);
        return;
      }

      // Query teacher assignments to check which subjects are assigned
      let assignQuery = client
        .from("teacher_assignments")
        .select(
          `
          id,
          subject_id,
          class_id,
          academic_year_id,
          profiles!teacher_id (
            full_name
          ),
          classes (
            name
          )
        `,
        );

      if (selectedYear) assignQuery = assignQuery.eq("academic_year_id", selectedYear);
      if (selectedClass) assignQuery = assignQuery.eq("class_id", selectedClass);

      const { data: assignments } = await assignQuery;

      // Group assignments by subject_id
      const subjectAssignMap = new Map();
      (assignments || []).forEach((a) => {
        if (!subjectAssignMap.has(a.subject_id)) {
          subjectAssignMap.set(a.subject_id, {
            teachers: new Set(),
            classes: new Set(),
          });
        }
        const entry = subjectAssignMap.get(a.subject_id);
        if (a.profiles?.full_name) entry.teachers.add(a.profiles.full_name);
        if (a.classes?.name) entry.classes.add(a.classes.name);
      });

      // Combine subject data
      allSubjectsData = subjects.map((sub) => {
        const assign = subjectAssignMap.get(sub.id);
        const teachersList = assign ? Array.from(assign.teachers) : [];
        const classesList = assign ? Array.from(assign.classes) : [];
        const isAssigned = teachersList.length > 0;

        return {
          ...sub,
          teachersList,
          classesList,
          isAssigned,
        };
      });

      // If user filtered by class, we can prioritize subjects assigned to that class
      let displaySubjects = allSubjectsData;
      if (selectedClass) {
        displaySubjects = allSubjectsData.filter((s) => s.classesList.length > 0);
      }

      renderSummary(displaySubjects);
      renderDetails(displaySubjects);
    } catch (err) {
      console.error("Error fetching subject report:", err);
      if (summaryBody) {
        summaryBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #dc2626; padding: 20px;">Failed to load subject metrics.</td></tr>`;
      }
      if (detailBody) {
        detailBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #dc2626; padding: 20px;">Failed to load curriculum allocations.</td></tr>`;
      }
    }
  }

  function renderSummary(subjects) {
    if (!summaryBody) return;

    if (!subjects || subjects.length === 0) {
      summaryBody.innerHTML = `
        <tr>
          <td>0</td>
          <td>0</td>
          <td>0</td>
          <td>
            <button class="subjects-report-actions-btn btn-print" onclick="ReportsCommon.printReport()">
              <i class="fa-solid fa-print"></i> Print
            </button>
            <button class="subjects-report-actions-btn btn-excel" onclick="window.exportSubjectReport()">
              <i class="fa-solid fa-file-excel"></i> Export Excel
            </button>
          </td>
        </tr>
      `;
      return;
    }

    const totalSubjects = subjects.length;
    let assignedCount = 0;
    let unassignedCount = 0;

    subjects.forEach((s) => {
      if (s.isAssigned) assignedCount++;
      else unassignedCount++;
    });

    summaryBody.innerHTML = `
      <tr>
        <td><strong>${ReportsCommon.formatNumber(totalSubjects)}</strong></td>
        <td><strong style="color: #16a34a;">${ReportsCommon.formatNumber(assignedCount)}</strong></td>
        <td><strong style="color: #dc2626;">${ReportsCommon.formatNumber(unassignedCount)}</strong></td>
        <td>
          <button class="subjects-report-actions-btn btn-print" title="Print Report" onclick="ReportsCommon.printReport()">
            <i class="fa-solid fa-print"></i> Print
          </button>
          <button class="subjects-report-actions-btn btn-pdf" title="Export PDF" onclick="ReportsCommon.printReport()">
            <i class="fa-solid fa-file-pdf"></i> PDF
          </button>
          <button class="subjects-report-actions-btn btn-excel" title="Export Excel" onclick="window.exportSubjectReport()">
            <i class="fa-solid fa-file-excel"></i> Excel
          </button>
        </td>
      </tr>
    `;
  }

  function renderDetails(subjects) {
    if (!detailBody) return;

    if (detailCount) {
      detailCount.textContent = `${subjects.length} ${subjects.length === 1 ? "subject" : "subjects"}`;
    }

    if (!subjects || subjects.length === 0) {
      ReportsCommon.renderEmpty(detailBody, 5, "No subjects found matching the filters.");
      return;
    }

    detailBody.innerHTML = subjects
      .map((item) => {
        const subjectName = item.name || "N/A";
        const department = item.departments?.name || "General";
        const teachersText =
          item.teachersList.length > 0 ? item.teachersList.join(", ") : "-";
        const classesText =
          item.classesList.length > 0 ? item.classesList.join(", ") : "-";

        const badgeClass = item.isAssigned ? "assigned" : "unassigned";
        const badgeLabel = item.isAssigned ? "Assigned" : "Unassigned";

        return `
          <tr>
            <td><strong>${ReportsCommon.escapeHTML(subjectName)}</strong></td>
            <td>${ReportsCommon.escapeHTML(department)}</td>
            <td>${ReportsCommon.escapeHTML(teachersText)}</td>
            <td>${ReportsCommon.escapeHTML(classesText)}</td>
            <td><span class="coverage-badge ${badgeClass}">${badgeLabel}</span></td>
          </tr>
        `;
      })
      .join("");
  }

  // Global Excel Export
  window.exportSubjectReport = function () {
    const headers = [
      "Subject Name",
      "Department",
      "Assigned Teachers",
      "Assigned Classes",
      "Coverage Status",
    ];

    const rows = allSubjectsData.map((s) => [
      s.name || "N/A",
      s.departments?.name || "General",
      s.teachersList.join(", ") || "None",
      s.classesList.join(", ") || "None",
      s.isAssigned ? "Assigned" : "Unassigned",
    ]);

    ReportsCommon.exportToCSV("Subject_Report", headers, rows);
  };
});
