document.addEventListener("DOMContentLoaded", async () => {
  const currentStudentId = await getCurrentStudentId();
  if (currentStudentId) {
    loadStudentAttendanceData(currentStudentId);
  }
});

// Helper function to get current logged-in student's UUID
async function getCurrentStudentId() {
  const {
    data: { user },
    error: authError,
  } = await supabaseClient.auth.getUser();

  if (authError || !user) {
    console.error("User not authenticated:", authError);
    // Redirect to login if user session doesn't exist
    window.location.href = "/login.html";
    return null;
  }

  // Fetch student record corresponding to auth user id
  const { data: student, error: studentError } = await supabaseClient
    .from("students")
    .select("id")
    .eq("id", user.id) // Matches auth user id column
    .single();

  if (studentError || !student) {
    console.error("Student profile not found for user:", studentError);
    return null;
  }

  return student.id;
}

async function loadStudentAttendanceData(studentId) {
  const { data: records, error } = await supabaseClient
    .from("attendance_records")
    .select(
      `
      id,
      status,
      attendance:attendance_id (
        id,
        date,
        subjects ( id, name ),
        profiles:teacher_id ( full_name ),
        periods ( name )
      )
    `,
    )
    .eq("student_id", studentId);

  if (error) {
    console.error("Error loading student attendance:", error);
    return;
  }

  calculateOverviewStats(records);
  renderSubjectCards(records);
  renderAttendanceHistory(records);
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

  // Group records by subject
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

  records.forEach((r) => {
    const tr = document.createElement("tr");
    const dateStr = new Date(r.attendance?.date).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

    // Uses full_name field from your profiles join query
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
