/**
 * teacher-reports.js
 * Generates aggregated faculty metrics, active/inactive ratios,
 * subjects/classes assigned, and weekly timetable lesson workloads.
 */

document.addEventListener("DOMContentLoaded", async () => {
  const authCtx = await ReportsCommon.initAuth();
  if (!authCtx) return;

  const client = window.supabaseClient || supabaseClient;

  // DOM Elements
  const filterDepartment = document.getElementById("filterDepartment");
  const filterStatus = document.getElementById("filterStatus");
  const filterYear = document.getElementById("filterYear");
  const summaryBody = document.getElementById("teacherSummaryBody");
  const detailBody = document.getElementById("teacherDetailBody");
  const detailCount = document.getElementById("detailRecordCount");

  let allTeachersData = [];

  // Populate lookups
  const lookups = await ReportsCommon.getLookups();
  ReportsCommon.populateSelect(filterDepartment, lookups.departments, {
    placeholder: "All Departments",
    valueKey: "id",
    labelKey: "name",
  });
  ReportsCommon.populateSelect(filterYear, lookups.academicYears, {
    placeholder: "All Academic Years",
    valueKey: "id",
    labelKey: "year_label",
  });

  // Attach change listeners
  [filterDepartment, filterStatus, filterYear].forEach((el) => {
    if (el) el.addEventListener("change", fetchAndRenderData);
  });

  // Initial Fetch
  await fetchAndRenderData();

  async function fetchAndRenderData() {
    ReportsCommon.renderLoading(summaryBody, 7, "Loading teacher metrics...");
    ReportsCommon.renderLoading(detailBody, 7, "Loading faculty workload roster...");

    try {
      let query = client
        .from("teachers")
        .select(
          `
          id,
          staff_id,
          gender,
          qualification,
          department_id,
          departments (
            id,
            name
          ),
          profiles:id (
            id,
            full_name,
            email,
            phone_number,
            status,
            photo_url
          )
        `,
        )
        .order("created_at", { ascending: false });

      const selectedDepartment = filterDepartment?.value;
      const selectedStatus = filterStatus?.value;
      const selectedYear = filterYear?.value;

      if (selectedDepartment) query = query.eq("department_id", selectedDepartment);

      const { data: teachers, error } = await query;
      if (error) throw error;

      let filteredTeachers = teachers || [];

      // Filter by profile status if selected
      if (selectedStatus) {
        filteredTeachers = filteredTeachers.filter((t) => {
          const st = (t.profiles?.status || "active").toLowerCase();
          return st === selectedStatus.toLowerCase();
        });
      }

      if (filteredTeachers.length === 0) {
        allTeachersData = [];
        renderSummary([]);
        renderDetails([]);
        return;
      }

      // Fetch teacher assignments
      let assignQuery = client
        .from("teacher_assignments")
        .select("id, teacher_id, subject_id, class_id, academic_year_id, status");

      if (selectedYear) {
        assignQuery = assignQuery.eq("academic_year_id", selectedYear);
      }

      const { data: assignments } = await assignQuery;

      // Group assignments by teacher_id
      const teacherAssignMap = new Map();
      (assignments || []).forEach((a) => {
        if (!teacherAssignMap.has(a.teacher_id)) {
          teacherAssignMap.set(a.teacher_id, {
            subjects: new Set(),
            classes: new Set(),
          });
        }
        const entry = teacherAssignMap.get(a.teacher_id);
        if (a.subject_id) entry.subjects.add(a.subject_id);
        if (a.class_id) entry.classes.add(a.class_id);
      });

      // Fetch timetable periods taught by teacher
      const { data: lessons } = await client
        .from("timetable_lessons")
        .select("id, teacher_id, period_id");

      const teacherPeriodsMap = new Map();
      (lessons || []).forEach((l) => {
        if (l.teacher_id) {
          teacherPeriodsMap.set(
            l.teacher_id,
            (teacherPeriodsMap.get(l.teacher_id) || 0) + 1,
          );
        }
      });

      // Build consolidated teacher data
      allTeachersData = filteredTeachers.map((teacher) => {
        const assign = teacherAssignMap.get(teacher.id) || {
          subjects: new Set(),
          classes: new Set(),
        };
        const periodsCount = teacherPeriodsMap.get(teacher.id) || 0;

        return {
          ...teacher,
          subjectsAssignedCount: assign.subjects.size,
          classesAssignedCount: assign.classes.size,
          timetablePeriodsCount: periodsCount,
        };
      });

      renderSummary(allTeachersData);
      renderDetails(allTeachersData);
    } catch (err) {
      console.error("Error fetching teacher reports:", err);
      if (summaryBody) {
        summaryBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #dc2626; padding: 20px;">Failed to load teacher metrics.</td></tr>`;
      }
      if (detailBody) {
        detailBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #dc2626; padding: 20px;">Failed to load faculty roster.</td></tr>`;
      }
    }
  }

  function renderSummary(teachers) {
    if (!summaryBody) return;

    if (!teachers || teachers.length === 0) {
      summaryBody.innerHTML = `
        <tr>
          <td>0</td>
          <td>0</td>
          <td>0</td>
          <td>0</td>
          <td>0</td>
          <td>0</td>
          <td>
            <button class="teachers-report-actions-btn btn-print" onclick="ReportsCommon.printReport()">
              <i class="fa-solid fa-print"></i> Print
            </button>
            <button class="teachers-report-actions-btn btn-excel" onclick="window.exportTeacherReport()">
              <i class="fa-solid fa-file-excel"></i> Export Excel
            </button>
          </td>
        </tr>
      `;
      return;
    }

    const totalTeachers = teachers.length;
    let activeTeachers = 0;
    let inactiveTeachers = 0;
    let totalSubjectsAssigned = 0;
    let totalClassesAssigned = 0;
    let totalPeriods = 0;

    teachers.forEach((t) => {
      const st = (t.profiles?.status || "active").toLowerCase();
      if (st === "active") activeTeachers++;
      else inactiveTeachers++;

      totalSubjectsAssigned += t.subjectsAssignedCount;
      totalClassesAssigned += t.classesAssignedCount;
      totalPeriods += t.timetablePeriodsCount;
    });

    summaryBody.innerHTML = `
      <tr>
        <td><strong>${ReportsCommon.formatNumber(totalTeachers)}</strong></td>
        <td><span style="color: #16a34a; font-weight: 600;">${ReportsCommon.formatNumber(activeTeachers)}</span></td>
        <td><span style="color: #dc2626; font-weight: 600;">${ReportsCommon.formatNumber(inactiveTeachers)}</span></td>
        <td><strong>${ReportsCommon.formatNumber(totalSubjectsAssigned)}</strong></td>
        <td><strong>${ReportsCommon.formatNumber(totalClassesAssigned)}</strong></td>
        <td><strong style="color: #2563eb;">${ReportsCommon.formatNumber(totalPeriods)}</strong></td>
        <td>
          <button class="teachers-report-actions-btn btn-print" title="Print Report" onclick="ReportsCommon.printReport()">
            <i class="fa-solid fa-print"></i> Print
          </button>
          <button class="teachers-report-actions-btn btn-pdf" title="Export PDF" onclick="ReportsCommon.printReport()">
            <i class="fa-solid fa-file-pdf"></i> PDF
          </button>
          <button class="teachers-report-actions-btn btn-excel" title="Export Excel" onclick="window.exportTeacherReport()">
            <i class="fa-solid fa-file-excel"></i> Excel
          </button>
        </td>
      </tr>
    `;
  }

  function renderDetails(teachers) {
    if (!detailBody) return;

    if (detailCount) {
      detailCount.textContent = `${teachers.length} ${teachers.length === 1 ? "teacher" : "teachers"}`;
    }

    if (!teachers || teachers.length === 0) {
      ReportsCommon.renderEmpty(detailBody, 7, "No teachers match the selected filters.");
      return;
    }

    detailBody.innerHTML = teachers
      .map((item) => {
        const staffId = item.staff_id || "N/A";
        const teacherName = item.profiles?.full_name || "Unknown Teacher";
        const department = item.departments?.name || "General";
        const status = (item.profiles?.status || "active").toLowerCase();

        return `
          <tr>
            <td><code>${ReportsCommon.escapeHTML(staffId)}</code></td>
            <td><strong>${ReportsCommon.escapeHTML(teacherName)}</strong></td>
            <td>${ReportsCommon.escapeHTML(department)}</td>
            <td><span class="status-badge ${status}">${ReportsCommon.escapeHTML(status)}</span></td>
            <td><strong>${item.subjectsAssignedCount}</strong></td>
            <td><strong>${item.classesAssignedCount}</strong></td>
            <td><strong>${item.timetablePeriodsCount}</strong></td>
          </tr>
        `;
      })
      .join("");
  }

  // Global Excel Export
  window.exportTeacherReport = function () {
    const headers = [
      "Staff ID",
      "Teacher Name",
      "Department",
      "Gender",
      "Qualification",
      "Status",
      "Subjects Assigned",
      "Classes Assigned",
      "Timetable Periods / Wk",
    ];

    const rows = allTeachersData.map((t) => [
      t.staff_id || "N/A",
      t.profiles?.full_name || "Unknown",
      t.departments?.name || "General",
      t.gender || "N/A",
      t.qualification || "N/A",
      t.profiles?.status || "active",
      t.subjectsAssignedCount,
      t.classesAssignedCount,
      t.timetablePeriodsCount,
    ]);

    ReportsCommon.exportToCSV("Teacher_Report", headers, rows);
  };
});
