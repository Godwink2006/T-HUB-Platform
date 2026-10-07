let allAttendanceRecords = [];

document.addEventListener("DOMContentLoaded", async () => {
  const client = window.supabaseClient || supabaseClient;

  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  const userId = user.id;

  await loadStudentAttendanceData(userId);
});

async function loadStudentAttendanceData(userId) {
  const client = window.supabaseClient || supabaseClient;


  const { data: attendanceRecords, error: arError } = await client
    .from("attendance_records")
    .select("id, status, created_at, student_id, attendance_id")
    .eq("student_id", userId);

  if (!attendanceRecords || attendanceRecords.length === 0) {
    allAttendanceRecords = [];
    populateDropdownFilters([]);
    applyFiltersAndRender();
    return;
  }


  const attendanceIds = [
    ...new Set(attendanceRecords.map((r) => r.attendance_id).filter(Boolean)),
  ];


  let attendanceMap = {};
  if (attendanceIds.length > 0) {
    const { data: attendanceSessions, error: aError } = await client
      .from("attendance")
      .select(
        `
        id,
        date,
        term_id,
        academic_year_id,
        class_id,
        subject_id,
        periods ( id, name ),
        terms ( id, name ),
        academic_years ( id, year_label ),
        classes ( id, name ),
        subjects ( id, name ),
        profiles ( id, full_name )
      `,
      )
      .in("id", attendanceIds);

    if (aError) {
      showToast("Error loading related attendance sessions:", aError);
    } else if (attendanceSessions) {
      attendanceMap = Object.fromEntries(
        attendanceSessions.map((a) => [a.id, a]),
      );
    }
  }


  allAttendanceRecords = attendanceRecords
    .map((record) => ({
      ...record,
      attendance: attendanceMap[record.attendance_id] || null,
    }))
    .filter((r) => r.attendance !== null);

  populateDropdownFilters(allAttendanceRecords);
  applyFiltersAndRender();
  setupFilterEventListeners();
}

function renderAttendanceHistory(records) {
  const tbody = document.getElementById("attendanceHistoryTable");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!records || records.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; color: #888; padding: 20px;">
          No matching attendance records found for these filters.
        </td>
      </tr>`;
    return;
  }

  records.forEach((r) => {
    const tr = document.createElement("tr");
    const dateStr = r.attendance?.date
      ? new Date(r.attendance.date).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "-";

    const teacherName = r.attendance?.profiles?.full_name || "-";
    const statusClass = r.status ? r.status.toLowerCase() : "";

    tr.innerHTML = `
      <td>${dateStr}</td>
      <td>${r.attendance?.subjects?.name || "-"}</td>
      <td>${teacherName}</td>
      <td>${r.attendance?.periods?.name || "1st Period"}</td>
      <td><span class="status-tag ${statusClass}">${r.status || "-"}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

function setupFilterEventListeners() {
  document
    .getElementById("academicYearFilter")
    .addEventListener("change", applyFiltersAndRender);
  document
    .getElementById("termFilter")
    .addEventListener("change", applyFiltersAndRender);
  document
    .getElementById("classFilter")
    .addEventListener("change", applyFiltersAndRender);
  document
    .getElementById("subjectFilter")
    .addEventListener("change", applyFiltersAndRender);
  document
    .getElementById("statusFilter")
    .addEventListener("change", applyFiltersAndRender);
}

function calculateOverviewStats(records) {
  const total = records.length;
  let present = 0,
    absent = 0;

  records.forEach((r) => {
    if (r.status.toLowerCase() === "present") present++;
    else if (r.status.toLowerCase() === "absent") absent++;
  });

  const rate = total > 0 ? Math.round((present / total) * 100) : 0;

  document.getElementById("overallRate").textContent = `${rate}%`;
  document.getElementById("totalPresent").textContent = present;
  document.getElementById("totalAbsent").textContent = absent;
}

function renderSubjectCards(records) {
  const container = document.getElementById("subjectCardsContainer");
  if (!container) return;
  container.innerHTML = "";

  const subjectsMap = {};

  records.forEach((r) => {
    const subjectName = r.attendance?.subjects?.name || "General";
    if (!subjectsMap[subjectName]) {
      subjectsMap[subjectName] = { total: 0, present: 0 };
    }
    subjectsMap[subjectName].total++;
    if (r.status.toLowerCase() === "present")
      subjectsMap[subjectName].present++;
  });

  if (Object.keys(subjectsMap).length === 0) {
    container.innerHTML = `<p style="color: #888; grid-column: 1 / -1; text-align: center;">No subject data for this filter selection.</p>`;
    return;
  }

  Object.keys(subjectsMap).forEach((subjectName) => {
    const stat = subjectsMap[subjectName];
    const percentage =
      stat.total > 0 ? Math.round((stat.present / stat.total) * 100) : 0;

    const card = document.createElement("div");
    card.className = "subject-card";
    card.innerHTML = `
      <div class="subject-card-header">
        <span class="subject-name">${subjectName}</span>
        <span class="subject-badge">${percentage}%</span>
      </div>
      <div class="progress-bar-bg">
        <div class="progress-bar-fill" style="width: ${percentage}%"></div>
      </div>
      <div class="subject-details">
        <span>Attended: ${stat.present}/${stat.total}</span>
        <span>Classes</span>
      </div>
    `;
    container.appendChild(card);
  });
}

function applyFiltersAndRender() {
  const selectedYear =
    document.getElementById("academicYearFilter")?.value || "all";
  const selectedTerm = document.getElementById("termFilter")?.value || "all";
  const selectedClass = document.getElementById("classFilter")?.value || "all";
  const selectedSubject =
    document.getElementById("subjectFilter")?.value || "all";
  const selectedStatus =
    document.getElementById("statusFilter")?.value || "all";

  const filteredRecords = allAttendanceRecords.filter((r) => {
    const yearName = r.attendance?.academic_years?.year_label || "";
    const termName = r.attendance?.terms?.name || "";
    const className = r.attendance?.classes?.name || "";
    const subjectName = r.attendance?.subjects?.name || "";
    const status = (r.status || "").toLowerCase();

    const matchesYear = selectedYear === "all" || yearName === selectedYear;
    const matchesTerm = selectedTerm === "all" || termName === selectedTerm;
    const matchesClass = selectedClass === "all" || className === selectedClass;
    const matchesSubject =
      selectedSubject === "all" || subjectName === selectedSubject;
    const matchesStatus =
      selectedStatus === "all" || status === selectedStatus.toLowerCase();

    return (
      matchesYear &&
      matchesTerm &&
      matchesClass &&
      matchesSubject &&
      matchesStatus
    );
  });

  calculateOverviewStats(filteredRecords);
  renderSubjectCards(filteredRecords);
  renderAttendanceHistory(filteredRecords);
}

function populateDropdownFilters(records) {
  const subjectFilter = document.getElementById("subjectFilter");
  const yearFilter = document.getElementById("academicYearFilter");
  const termFilter = document.getElementById("termFilter");
  const classFilter = document.getElementById("classFilter");

  if (!subjectFilter || !yearFilter || !termFilter || !classFilter) return;

  subjectFilter.innerHTML = '<option value="all">All Subjects</option>';
  yearFilter.innerHTML = '<option value="all">All Academic Years</option>';
  termFilter.innerHTML = '<option value="all">All Semesters</option>';
  classFilter.innerHTML = '<option value="all">All Classes</option>';

  const uniqueSubjects = new Set();
  const uniqueYears = new Set();
  const uniqueTerms = new Set();
  const uniqueClasses = new Set();

  records.forEach((r) => {
    if (r.attendance?.subjects?.name)
      uniqueSubjects.add(r.attendance.subjects.name);
    if (r.attendance?.academic_years?.year_label)
      uniqueYears.add(r.attendance.academic_years.year_label);
    if (r.attendance?.terms?.name) uniqueTerms.add(r.attendance.terms.name);
    if (r.attendance?.classes?.name)
      uniqueClasses.add(r.attendance.classes.name);
  });

  uniqueSubjects.forEach((sub) => {
    subjectFilter.innerHTML += `<option value="${sub}">${sub}</option>`;
  });

  uniqueYears.forEach((yearName) => {
    yearFilter.innerHTML += `<option value="${yearName}">${yearName}</option>`;
  });

  uniqueTerms.forEach((termName) => {
    termFilter.innerHTML += `<option value="${termName}">${termName}</option>`;
  });

  uniqueClasses.forEach((className) => {
    classFilter.innerHTML += `<option value="${className}">${className}</option>`;
  });
}
