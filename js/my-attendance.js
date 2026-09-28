document.addEventListener("DOMContentLoaded", async () => {
  const currentStudentId = await getCurrentStudentId();
  if (currentStudentId) {
    loadStudentAttendanceData(currentStudentId);
  }
});

async function getCurrentStudentId() {
  const {
    data: { user },
    error: authError,
  } = await supabaseClient.auth.getUser();

  if (authError || !user) {
    console.error("User not authenticated:", authError);
    window.location.href = "/login.html";
    return null;
  }

  const { data: student, error: studentError } = await supabaseClient
    .from("students")
    .select("id")
    .eq("id", user.id)
    .single();

  if (studentError || !student) {
    console.error("Student profile not found for user:", studentError);
    return null;
  }

  return student.id;
}

let allAttendanceRecords = []; // Stores raw fetched data

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

function renderAttendanceHistory(records) {
  const tbody = document.getElementById("attendanceHistoryTable");
  tbody.innerHTML = "";

  if (records.length === 0) {
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
    const dateStr = new Date(r.attendance?.date).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

    const teacherName = r.attendance?.profiles?.full_name || "N/A";

    tr.innerHTML = `
      <td>${dateStr}</td>
      <td>${r.attendance?.subjects?.name || "N/A"}</td>
      <td>${teacherName}</td>
      <td>${r.attendance?.periods?.name || "1st Period"}</td>
      <td><span class="status-tag ${r.status.toLowerCase()}">${r.status}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

async function loadStudentAttendanceData(studentId) {
  const { data: records, error } = await supabaseClient
    .from("attendance_records")
    .select(
      `
      id,
      status,
      attendance:attendance_id!inner (
        id,
        date,
        status,
        academic_years ( id, year_label ),
        terms ( id, name ),
        classes ( id, name ),
        subjects ( id, name ),
        profiles:teacher_id ( full_name ),
        periods ( name )
      )
    `,
    )
    .eq("student_id", studentId)
    .eq("attendance.status", "submitted");

  if (error) {
    console.error("Error loading student attendance:", error);
    return;
  }

  allAttendanceRecords = records || [];

  // Populate all dropdown filter options dynamically with names
  populateDropdownFilters(allAttendanceRecords);

  // Apply filters and render stats, cards, and table initially
  applyFiltersAndRender();

  // Attach event listeners to all dropdown filters
  setupFilterEventListeners();
}

function applyFiltersAndRender() {
  const selectedYear = document.getElementById("academicYearFilter").value;
  const selectedTerm = document.getElementById("termFilter").value;
  const selectedClass = document.getElementById("classFilter").value;
  const selectedSubject = document.getElementById("subjectFilter").value;
  const selectedStatus = document.getElementById("statusFilter").value;

  const filteredRecords = allAttendanceRecords.filter((r) => {
    // Match against the names or IDs depending on what the dropdown value holds
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

  // Reset dropdowns
  subjectFilter.innerHTML = '<option value="all">All Subjects</option>';
  yearFilter.innerHTML = '<option value="all">All Academic Years</option>';
  termFilter.innerHTML = '<option value="all">All Terms</option>';
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
