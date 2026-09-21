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

function setupFilterEventListeners() {
  document
    .getElementById("searchInput")
    .addEventListener("input", applyFiltersAndRender);
  document
    .getElementById("subjectFilter")
    .addEventListener("change", applyFiltersAndRender);
  document
    .getElementById("statusFilter")
    .addEventListener("change", applyFiltersAndRender);
}

function applyFiltersAndRender() {
  const searchTerm = document
    .getElementById("searchInput")
    .value.trim()
    .toLowerCase();
  const selectedSubject = document.getElementById("subjectFilter").value;
  const selectedStatus = document.getElementById("statusFilter").value;

  const filteredRecords = allAttendanceRecords.filter((r) => {
    const subjectName = (r.attendance?.subjects?.name || "").toLowerCase();
    const teacherName = (r.attendance?.profiles?.full_name || "").toLowerCase();
    const status = (r.status || "").toLowerCase();

    // 1. Text Search (Matches Subject OR Teacher)
    const matchesSearch =
      searchTerm === "" ||
      subjectName.includes(searchTerm) ||
      teacherName.includes(searchTerm);

    // 2. Subject Filter
    const matchesSubject =
      selectedSubject === "all" ||
      r.attendance?.subjects?.name === selectedSubject;

    // 3. Status Filter
    const matchesStatus =
      selectedStatus === "all" || status === selectedStatus.toLowerCase();

    return matchesSearch && matchesSubject && matchesStatus;
  });

  renderAttendanceHistory(filteredRecords);
}

function calculateOverviewStats(records) {
  const total = records.length;
  let present = 0,
    absent = 0;

  records.forEach((r) => {
    if (r.status === "present") present++;
    else if (r.status === "absent") absent++;
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
    if (r.status === "present") subjectsMap[subjectName].present++;
  });

  Object.keys(subjectsMap).forEach((subjectName) => {
    const stat = subjectsMap[subjectName];
    const percentage = Math.round((stat.present / stat.total) * 100);

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
          No matching attendance records found.
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

let allAttendanceRecords = []; // Global variable to store fetched data

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

  calculateOverviewStats(allAttendanceRecords);
  renderSubjectCards(allAttendanceRecords);

  // Populate the subject filter dropdown dynamically
  populateSubjectFilter(allAttendanceRecords);

  // Apply filtering and render history table
  applyFiltersAndRender();

  // Attach event listeners to search input and filter dropdowns
  setupFilterEventListeners();
}

function populateSubjectFilter(records) {
  const subjectFilter = document.getElementById("subjectFilter");
  subjectFilter.innerHTML = '<option value="all">All Subjects</option>';

  const uniqueSubjects = new Set();
  records.forEach((r) => {
    const name = r.attendance?.subjects?.name;
    if (name) uniqueSubjects.add(name);
  });

  uniqueSubjects.forEach((subject) => {
    const option = document.createElement("option");
    option.value = subject;
    option.textContent = subject;
    subjectFilter.appendChild(option);
  });
}
