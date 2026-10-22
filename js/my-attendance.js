let allAttendanceRecords = [];

function getOneRelation(value) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function getSemesterNumber(termName) {
  const name = String(termName || "");
  if (/\b(?:1(?:st)?|first|term\s*1|semester\s*1|one|i)\b/i.test(name)) {
    return 1;
  }
  if (/\b(?:2(?:nd)?|second|term\s*2|semester\s*2|two|ii)\b/i.test(name)) {
    return 2;
  }
  return null;
}

document.addEventListener("DOMContentLoaded", async () => {
  const client = window.supabaseClient || supabaseClient;
  const tableBody = document.getElementById("attendanceHistoryTable");

  try {
    if (!client) throw new Error("Supabase client is not available.");

    const {
      data: { user },
      error,
    } = await client.auth.getUser();

    if (error || !user) {
      window.location.href = "login.html";
      return;
    }

    if (tableBody) {
      tableBody.innerHTML = `
        <tr><td colspan="5" style="text-align:center;color:#888;padding:20px;">
          Loading your attendance and filter options...
        </td></tr>`;
    }

    const historyIndex = await window.getStudentTransferHistoryIndex(client);
    await loadStudentAttendanceData(user.id, historyIndex, client);

    document
      .getElementById("applyStudentAttendanceFilters")
      ?.addEventListener("click", applyFiltersAndRender);
  } catch (error) {
    console.error("Error loading student attendance:", error);
    if (tableBody) {
      tableBody.innerHTML = `
        <tr><td colspan="5" style="text-align:center;color:#b42318;padding:20px;">
          ${escapeHTML(error.message || "Could not load attendance records.")}
        </td></tr>`;
    }
    showToast(error.message || "Could not load attendance records.", "error");
  }
});

async function loadStudentAttendanceData(userId, historyIndex, client) {
  const { data: attendanceRecords, error: recordsError } = await client
    .from("attendance_records")
    .select("id, status, created_at, student_id, attendance_id")
    .eq("student_id", userId);

  if (recordsError) throw recordsError;

  const historicalAttendanceIds = historyIndex?.recordIds?.attendance || new Set();
  const currentAttendanceRecords = (attendanceRecords || []).filter(
    (record) => !historicalAttendanceIds.has(String(record.id)),
  );

  if (!currentAttendanceRecords.length) {
    allAttendanceRecords = [];
    populateDropdownFilters([]);
    showAttendanceFilterPrompt("No attendance records found. Choose filters to view attendance.");
    return;
  }

  const attendanceIds = [
    ...new Set(currentAttendanceRecords.map((record) => record.attendance_id).filter(Boolean)),
  ];

  let attendanceMap = {};
  if (attendanceIds.length) {
    const { data: attendanceSessions, error: attendanceError } = await client
      .from("attendance")
      .select(`
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
        profiles:teacher_id ( id, full_name )
      `)
      .in("id", attendanceIds);

    if (attendanceError) throw attendanceError;
    attendanceMap = Object.fromEntries(
      (attendanceSessions || []).map((attendance) => [attendance.id, attendance]),
    );
  }

  allAttendanceRecords = currentAttendanceRecords
    .map((record) => ({
      ...record,
      attendance: getOneRelation(attendanceMap[record.attendance_id]),
    }))
    .filter((record) => record.attendance)
    .map((record) => ({
      ...record,
      attendance: {
        ...record.attendance,
        periods: getOneRelation(record.attendance.periods),
        terms: getOneRelation(record.attendance.terms),
        academic_years: getOneRelation(record.attendance.academic_years),
        classes: getOneRelation(record.attendance.classes),
        subjects: getOneRelation(record.attendance.subjects),
        profiles: getOneRelation(record.attendance.profiles),
      },
    }));

  populateDropdownFilters(allAttendanceRecords);
  showAttendanceFilterPrompt("Choose your filters, then select View attendance.");
}

function showAttendanceFilterPrompt(message) {
  const tableBody = document.getElementById("attendanceHistoryTable");
  const cards = document.getElementById("subjectCardsContainer");
  if (tableBody) {
    tableBody.innerHTML = `
      <tr><td colspan="5" style="text-align:center;color:#888;padding:20px;">
        ${escapeHTML(message)}
      </td></tr>`;
  }
  if (cards) {
    cards.innerHTML = `<p style="color:#888;grid-column:1/-1;text-align:center;">${escapeHTML(message)}</p>`;
  }
  calculateOverviewStats([]);
}

function fillAttendanceFilter(select, placeholder, values) {
  if (!select) return;

  select.replaceChildren();
  const placeholderOption = document.createElement("option");
  placeholderOption.value = "all";
  placeholderOption.textContent = placeholder;
  select.appendChild(placeholderOption);

  [...values.entries()]
    .sort((a, b) => String(a[1]).localeCompare(String(b[1]), undefined, {
      numeric: true,
      sensitivity: "base",
    }))
    .forEach(([id, label]) => {
      const option = document.createElement("option");
      option.value = id;
      option.textContent = label;
      select.appendChild(option);
    });
}

function populateDropdownFilters(records) {
  const subjectFilter = document.getElementById("subjectFilter");
  const yearFilter = document.getElementById("academicYearFilter");
  const termFilter = document.getElementById("termFilter");
  const classFilter = document.getElementById("classFilter");

  const subjects = new Map();
  const years = new Map();
  const classes = new Map();

  records.forEach((record) => {
    const attendance = record.attendance;
    if (attendance.subject_id) {
      subjects.set(String(attendance.subject_id), attendance.subjects?.name || "Subject");
    }
    if (attendance.academic_year_id) {
      years.set(String(attendance.academic_year_id), attendance.academic_years?.year_label || "Academic year");
    }
    if (attendance.class_id) {
      classes.set(String(attendance.class_id), attendance.classes?.name || "Class");
    }
  });

  fillAttendanceFilter(subjectFilter, "All Subjects", subjects);
  fillAttendanceFilter(yearFilter, "All Academic Years", years);
  fillAttendanceFilter(classFilter, "All Classes", classes);

  if (termFilter) {
    termFilter.innerHTML = `
      <option value="all">All Semesters</option>
      <option value="1">1st Semester</option>
      <option value="2">2nd Semester</option>`;
  }
}

function renderAttendanceHistory(records) {
  const tbody = document.getElementById("attendanceHistoryTable");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!records?.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center;color:#888;padding:20px;">
          No matching attendance records found for these filters.
        </td>
      </tr>`;
    return;
  }

  records.forEach((record) => {
    const attendance = record.attendance;
    const dateStr = attendance?.date
      ? new Date(attendance.date).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "-";
    const teacherName = attendance?.profiles?.full_name || "-";
    const status = record.status || "-";
    const statusClass = status.toLowerCase().replace(/[^a-z0-9_-]/g, "");
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${escapeHTML(dateStr)}</td>
      <td>${escapeHTML(attendance?.subjects?.name || "-")}</td>
      <td>${escapeHTML(teacherName)}</td>
      <td>${escapeHTML(attendance?.periods?.name || "1st Period")}</td>
      <td><span class="status-tag ${statusClass}">${escapeHTML(status)}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

function calculateOverviewStats(records) {
  const total = records.length;
  let present = 0;
  let absent = 0;

  records.forEach((record) => {
    const status = String(record.status || "").toLowerCase();
    if (status === "present") present++;
    else if (status === "absent") absent++;
  });

  const rate = total ? Math.round((present / total) * 100) : 0;
  const rateElement = document.getElementById("overallRate");
  const presentElement = document.getElementById("totalPresent");
  const absentElement = document.getElementById("totalAbsent");
  if (rateElement) rateElement.textContent = `${rate}%`;
  if (presentElement) presentElement.textContent = present;
  if (absentElement) absentElement.textContent = absent;
}

function renderSubjectCards(records) {
  const container = document.getElementById("subjectCardsContainer");
  if (!container) return;
  container.innerHTML = "";

  const subjectsMap = new Map();
  records.forEach((record) => {
    const subjectName = record.attendance?.subjects?.name || "General";
    if (!subjectsMap.has(subjectName)) subjectsMap.set(subjectName, { total: 0, present: 0 });
    const stat = subjectsMap.get(subjectName);
    stat.total++;
    if (String(record.status || "").toLowerCase() === "present") stat.present++;
  });

  if (!subjectsMap.size) {
    container.innerHTML = `<p style="color:#888;grid-column:1/-1;text-align:center;">No subject data for this filter selection.</p>`;
    return;
  }

  subjectsMap.forEach((stat, subjectName) => {
    const percentage = stat.total ? Math.round((stat.present / stat.total) * 100) : 0;
    const card = document.createElement("div");
    card.className = "subject-card";
    card.innerHTML = `
      <div class="subject-card-header">
        <span class="subject-name">${escapeHTML(subjectName)}</span>
        <span class="subject-badge">${percentage}%</span>
      </div>
      <div class="progress-bar-bg">
        <div class="progress-bar-fill" style="width:${percentage}%"></div>
      </div>
      <div class="subject-details">
        <span>Attended: ${stat.present}/${stat.total}</span>
        <span>Classes</span>
      </div>`;
    container.appendChild(card);
  });
}

function applyFiltersAndRender() {
  const selectedYear = document.getElementById("academicYearFilter")?.value || "all";
  const selectedSemester = document.getElementById("termFilter")?.value || "all";
  const selectedClass = document.getElementById("classFilter")?.value || "all";
  const selectedSubject = document.getElementById("subjectFilter")?.value || "all";
  const selectedStatus = document.getElementById("statusFilter")?.value || "all";

  const filteredRecords = allAttendanceRecords.filter((record) => {
    const attendance = record.attendance;
    const status = String(record.status || "").toLowerCase();
    return (
      (selectedYear === "all" || String(attendance.academic_year_id) === selectedYear) &&
      (selectedSemester === "all" || getSemesterNumber(attendance.terms?.name) === Number(selectedSemester)) &&
      (selectedClass === "all" || String(attendance.class_id) === selectedClass) &&
      (selectedSubject === "all" || String(attendance.subject_id) === selectedSubject) &&
      (selectedStatus === "all" || status === selectedStatus.toLowerCase())
    );
  });

  calculateOverviewStats(filteredRecords);
  renderSubjectCards(filteredRecords);
  renderAttendanceHistory(filteredRecords);
}
