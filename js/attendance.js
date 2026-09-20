// Global State
let activeAcademicYearId = null;
let activeTermId = null;
let activeAssessmentId = null;
let currentTodayLessons = [];

let currentAttendanceSession = {
  classId: null,
  className: "",
  periodId: null,
  periodName: "",
  subjectId: null,
  subjectName: "",
  teacherId: null,
  teacherName: "",
  schoolId: null,
  academicYearId: null,
  termId: null,
  dateStr: getLocalDateString(),
};

// Helper for local YYYY-MM-DD date representation
function getLocalDateString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Modal Helper Functions
function openModal(modal) {
  if (!modal) return;
  modal.style.display = "flex";
  modal.classList.add("active");
  if (typeof lockBodyScroll === "function") lockBodyScroll();
}

function closeModal(modal) {
  if (!modal) return;
  modal.style.display = "none";
  modal.classList.remove("active");
  if (typeof unLockBodyScroll === "function") unLockBodyScroll();
}

document.addEventListener("DOMContentLoaded", () => {
  initModalEventListeners();
  initAttendanceModalLogic();
  loadAcademicContext();
});

/**
 * Global Modal Event Listeners
 */
function initModalEventListeners() {
  const attendanceModal = document.getElementById("attendanceModal");
  const studentAttendanceModal = document.getElementById(
    "studentAttendanceModal",
  );
  const viewAttendanceModal = document.getElementById("viewAttendanceModal");
  const editAttendanceModal = document.getElementById("editAttendanceModal");

  // Take Attendance Modal Controls
  document
    .getElementById("addAttendance")
    ?.addEventListener("click", async () => {
      resetAttendanceModal();
      openModal(attendanceModal);
      await populateClassOptions();
    });

  document
    .getElementById("closeAttendanceModal")
    ?.addEventListener("click", () => closeModal(attendanceModal));
  document
    .getElementById("cancelAttendanceModal")
    ?.addEventListener("click", () => closeModal(attendanceModal));

  // Student Attendance Modal Controls
  document
    .getElementById("closeStudentAttendanceModal")
    ?.addEventListener("click", () => closeModal(studentAttendanceModal));
  document
    .getElementById("cancelStudentAttendanceModal")
    ?.addEventListener("click", () => closeModal(studentAttendanceModal));

  // View Attendance Modal Controls
  document.querySelectorAll(".view").forEach((button) => {
    button.addEventListener("click", () => openModal(viewAttendanceModal));
  });

  document
    .getElementById("closeViewAttendanceModal")
    ?.addEventListener("click", () => closeModal(viewAttendanceModal));
  document
    .getElementById("closeViewBtn")
    ?.addEventListener("click", () => closeModal(viewAttendanceModal));

  // Outside click listeners
  window.addEventListener("click", (e) => {
    if (e.target === attendanceModal) closeModal(attendanceModal);
    if (e.target === studentAttendanceModal) closeModal(studentAttendanceModal);
    if (e.target === viewAttendanceModal) closeModal(viewAttendanceModal);
    if (e.target === editAttendanceModal) closeModal(editAttendanceModal);
  });
}

async function loadAcademicContext() {
  try {
    const [yearRes, termRes, assessmentRes] = await Promise.all([
      supabaseClient
        .from("academic_years")
        .select("id")
        .ilike("status", "Active")
        .limit(1)
        .maybeSingle(),
      supabaseClient
        .from("terms")
        .select("id")
        .ilike("status", "Active")
        .limit(1)
        .maybeSingle(),
      supabaseClient
        .from("assessments")
        .select("id")
        .ilike("status", "Active") // Fetch active period (e.g. 1st Period) in background
        .limit(1)
        .maybeSingle(),
    ]);

    if (yearRes.data) {
      activeAcademicYearId = yearRes.data.id;
      window.activeAcademicYearId = yearRes.data.id;
    }
    if (termRes.data) {
      activeTermId = termRes.data.id;
      window.activeTermId = termRes.data.id;
    }
    if (assessmentRes.data) {
      activeAssessmentId = assessmentRes.data.id;
      window.activeAssessmentId = assessmentRes.data.id;
    }

    console.log("Loaded Academic Context in Background:", {
      academicYearId: activeAcademicYearId,
      termId: activeTermId,
      assessmentId: activeAssessmentId,
    });
  } catch (err) {
    console.error("Error loading academic context:", err);
  }
}

function initAttendanceModalLogic() {
  const classSelect = document.getElementById("attendanceClassSelect");
  const periodSelect = document.getElementById("attendancePeriodSelect");
  const loadStudentsBtn = document.getElementById("loadStudentAttendance");
  const studentForm = document.getElementById("studentAttendanceForm");
  const draftBtn = document.getElementById("saveDraftAttendanceBtn");

  classSelect?.addEventListener("change", async (e) => {
    await handleClassSelectChange(e.target.value);
  });

  // Load Students -> Switch from Modal 1 to Modal 2
  loadStudentsBtn?.addEventListener("click", async () => {
    const classId = classSelect.value;
    const className = classSelect.options[classSelect.selectedIndex]?.text;
    const periodId = periodSelect.value;
    const periodName = periodSelect.options[periodSelect.selectedIndex]?.text;

    if (!classId || !periodId) {
      showToast("Please select both Class and Period.", "error");
      return;
    }

    // Check if timetable lesson exists
    let lesson = currentTodayLessons.find((l) => l.period_id === periodId);
    let subjectId = lesson ? lesson.subject_id : null;
    let subjectName = lesson?.subjects?.name || null;

    // Fallback: fetch subject assigned to this teacher & class
    const user = (await supabaseClient.auth.getUser()).data?.user;
    let profile = null;

    if (user) {
      const [profileRes, assignmentRes] = await Promise.all([
        supabaseClient
          .from("profiles")
          .select("full_name, school_id")
          .eq("id", user.id)
          .maybeSingle(),
        supabaseClient
          .from("teacher_assignments")
          .select("subject_id, subjects(id, name)")
          .eq("class_id", classId)
          .eq("teacher_id", user.id)
          .limit(1)
          .maybeSingle(),
      ]);

      if (profileRes.data) profile = profileRes.data;
      if (!subjectName && assignmentRes.data?.subjects) {
        subjectId = assignmentRes.data.subjects.id;
        subjectName = assignmentRes.data.subjects.name;
      }
    }

    // Close Modal 1
    closeModal(document.getElementById("attendanceModal"));

    // Open Modal 2 with context (including activeAssessmentId in background)
    openStudentAttendanceModal({
      classId: classId,
      className: className,
      periodId: periodId,
      periodName: periodName,
      subjectId: subjectId,
      subjectName: subjectName || "-",
      teacherId: user?.id || null,
      teacherName: profile?.full_name || "-",
      schoolId: profile?.school_id || null,
      academicYearId: activeAcademicYearId || window.activeAcademicYearId,
      termId: activeTermId || window.activeTermId,
      assessmentId: activeAssessmentId || window.activeAssessmentId, // Background active assessment
      dateStr: getLocalDateString(),
    });
  });

  // Submit Action -> Save with status = 'submitted'
  studentForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    await handleSaveAttendance("submitted");
  });

  // Draft Action -> Save with status = 'drafted'
  draftBtn?.addEventListener("click", async () => {
    await handleSaveAttendance("drafted");
  });
}

/**
 * Fetch Assigned Classes for Current User
 */
async function populateClassOptions() {
  const classSelect = document.getElementById("attendanceClassSelect");
  if (!classSelect) return;
  classSelect.innerHTML = `<option value="">Select Class</option>`;

  const user = (await supabaseClient.auth.getUser()).data?.user;
  if (!user) return;

  const { data: assignments, error } = await supabaseClient
    .from("teacher_assignments")
    .select("class_id, classes(id, name)")
    .eq("teacher_id", user.id);

  if (error || !assignments) {
    console.error("Error fetching assigned classes:", error);
    return;
  }

  const uniqueClasses = [
    ...new Map(
      assignments
        .filter((a) => a.classes)
        .map((a) => [a.classes.id, a.classes]),
    ).values(),
  ];

  uniqueClasses.forEach((cls) => {
    const opt = document.createElement("option");
    opt.value = cls.id;
    opt.textContent = cls.name;
    classSelect.appendChild(opt);
  });
}

/**
 * Populate Period dropdown based on Class timetable filtered by active Teacher
 */
async function handleClassSelectChange(classId) {
  const periodSelect = document.getElementById("attendancePeriodSelect");
  if (!periodSelect) return;

  periodSelect.innerHTML = `<option value="">Select Period</option>`;
  periodSelect.disabled = true;
  currentTodayLessons = [];

  if (!classId) return;

  // Set to true while testing on weekends, set to false for production
  const IS_DEV_MODE = true;

  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
  ];
  let todayName = days[new Date().getDay()];

  if (IS_DEV_MODE && (todayName === "Saturday" || todayName === "Sunday")) {
    console.warn("DEV MODE: Defaulting weekend to Monday for testing...");
    todayName = "Monday";
  }

  console.log(`Checking timetable for Class: ${classId} on Day: ${todayName}`);

  try {
    // Get logged-in user ID (which matches teachers.id and profiles.id directly)
    const user = (await supabaseClient.auth.getUser()).data?.user;
    if (!user) {
      await loadDefaultPeriods(periodSelect);
      return;
    }

    // 2. Query active timetable for the selected class
    const { data: timetable, error: ttError } = await supabaseClient
      .from("timetables")
      .select("id")
      .eq("class_id", classId)
      .ilike("status", "active")
      .limit(1)
      .maybeSingle();

    if (ttError || !timetable) {
      console.warn("No active timetable found for this class.");
      await loadDefaultPeriods(periodSelect);
      return;
    }

    // 3. Query lessons directly using user.id as teacher_id
    const { data: lessons, error: lError } = await supabaseClient
      .from("timetable_lessons")
      .select(
        `
        period_id, 
        subject_id, 
        teacher_id,
        is_break, 
        periods:period_id(id, name, start_time, end_time), 
        subjects:subject_id(id, name)
      `,
      )
      .eq("timetable_id", timetable.id)
      .eq("teacher_id", user.id) // 👈 Directly matches teacher ID
      .ilike("day_of_week", todayName);

    if (lError) {
      console.error("Timetable query error:", lError);
      await loadDefaultPeriods(periodSelect);
      return;
    }

    if (!lessons || lessons.length === 0) {
      console.warn(
        `No lessons found for teacher (${user.id}) on ${todayName}. Loading default periods...`,
      );
      await loadDefaultPeriods(periodSelect);
      return;
    }

    // 4. Filter out breaks and populate periods with start/end times & subjects
    currentTodayLessons = lessons;

    lessons.forEach((l) => {
      if (l.is_break === true) return;

      if (l.periods) {
        const periodName = l.periods.name || "";
        const startTime = l.periods.start_time
          ? l.periods.start_time.slice(0, 5)
          : "";
        const endTime = l.periods.end_time
          ? l.periods.end_time.slice(0, 5)
          : "";
        const timeRange =
          startTime && endTime ? ` (${startTime} - ${endTime})` : "";
        const subjectLabel = l.subjects?.name ? ` - ${l.subjects.name}` : "";

        const opt = document.createElement("option");
        opt.value = l.periods.id;
        opt.textContent = `${periodName}${timeRange}${subjectLabel}`;
        periodSelect.appendChild(opt);
      }
    });

    periodSelect.disabled = false;
  } catch (err) {
    console.error("Error in handleClassSelectChange:", err);
    await loadDefaultPeriods(periodSelect);
  }
}

/**
 * Enhanced Fallback helper (includes start/end times)
 */
async function loadDefaultPeriods(periodSelect) {
  if (!periodSelect) return;

  try {
    const { data: defaultPeriods, error } = await supabaseClient
      .from("periods")
      .select("id, name, start_time, end_time")
      .order("name", { ascending: true });

    if (error) {
      console.error("Error loading default periods:", error);
      return;
    }

    if (defaultPeriods && defaultPeriods.length > 0) {
      defaultPeriods.forEach((p) => {
        const periodName = p.name || "";
        const isBreak =
          periodName.toLowerCase().includes("recess") ||
          periodName.toLowerCase().includes("break");

        if (isBreak) return;

        const startTime = p.start_time ? p.start_time.slice(0, 5) : "";
        const endTime = p.end_time ? p.end_time.slice(0, 5) : "";
        const timeRange =
          startTime && endTime ? ` (${startTime} - ${endTime})` : "";

        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = `${periodName}${timeRange}`;
        periodSelect.appendChild(opt);
      });
    }
  } catch (err) {
    console.error("Exception in loadDefaultPeriods:", err);
  } finally {
    periodSelect.disabled = false;
  }
}

/**
 * Open Modal 2 & Populate Metadata + Student Roster
 */
async function openStudentAttendanceModal(sessionData) {
  currentAttendanceSession = { ...currentAttendanceSession, ...sessionData };

  const modal = document.getElementById("studentAttendanceModal");

  // Inject Text Labels
  const elClass = document.getElementById("stModalClassName");
  const elSubject = document.getElementById("stModalSubjectName");
  const elPeriod = document.getElementById("stModalPeriodName");
  const elTeacher = document.getElementById("stModalTeacherName");
  const elDate = document.getElementById("stModalDateDisplay");

  if (elClass) elClass.textContent = currentAttendanceSession.className || "-";
  if (elSubject)
    elSubject.textContent = currentAttendanceSession.subjectName || "-";
  if (elPeriod)
    elPeriod.textContent = currentAttendanceSession.periodName || "-";
  if (elTeacher)
    elTeacher.textContent = currentAttendanceSession.teacherName || "-";
  if (elDate) elDate.textContent = currentAttendanceSession.dateStr;

  openModal(modal);

  await loadRosterIntoModal(currentAttendanceSession.classId);
}

/**
 * Render Student Rows into Modal 2
 */
async function loadRosterIntoModal(classId) {
  const tbody = document.getElementById("studentAttendanceRosterBody");
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="2" style="text-align:center; padding: 12px;">Loading students...</td></tr>`;

  try {
    const cleanClassId = classId ? classId.trim() : "";
    console.log("Querying students for class_id:", cleanClassId);

    // 1. Fetch students directly using class_id column
    const { data: students, error: studentErr } = await supabaseClient
      .from("students")
      .select("id, student_id, class_id")
      .eq("class_id", cleanClassId);

    if (studentErr) {
      console.error("Error fetching students:", studentErr);
      tbody.innerHTML = `<tr><td colspan="2" style="text-align:center; padding: 12px; color: #dc2626;">Error loading students: ${studentErr.message}</td></tr>`;
      return;
    }

    console.log("Found raw students in database:", students);

    if (!students || students.length === 0) {
      tbody.innerHTML = `<tr><td colspan="2" style="text-align:center; padding: 12px; color: #dc2626;">No students found for this class in database.</td></tr>`;
      return;
    }

    // 2. Fetch display names safely from profiles
    const studentIds = students.map((s) => s.id);
    let profileMap = new Map();

    const { data: profiles, error: profileErr } = await supabaseClient
      .from("profiles")
      .select("id, full_name")
      .in("id", studentIds);

    if (!profileErr && profiles) {
      profileMap = new Map(profiles.map((p) => [p.id, p.full_name]));
    }

    // 3. Render student rows
    tbody.innerHTML = "";
    students.forEach((student) => {
      const displayName =
        profileMap.get(student.id) ||
        (student.student_id
          ? `Student (${student.student_id})`
          : `Student (${student.id.slice(0, 8)})`);

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td style="padding: 10px 12px; font-weight: 500;">${displayName}</td>
        <td style="padding: 10px 12px;">
          <select class="attendance-status-dropdown" data-student-id="${student.id}" style="padding: 6px 10px; border-radius: 6px; border: 1px solid #d1d5db; width: 100%;">
            <option value="present">Present</option>
            <option value="absent">Absent</option>
          </select>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error("Roster exception:", err);
    tbody.innerHTML = `<tr><td colspan="2" style="text-align:center; padding: 12px; color: #dc2626;">Failed to load roster.</td></tr>`;
  }
}

/**
 * Handle Save Attendance Form Submission using RPC
 * @param {'drafted' | 'submitted'} passedWorkflowStatus
 */
async function handleSaveAttendance(passedWorkflowStatus = "submitted") {
  const saveBtn = document.querySelector(
    "#studentAttendanceForm button[type='submit']",
  );
  const draftBtn = document.getElementById("saveDraftAttendanceBtn");

  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent =
      passedWorkflowStatus === "drafted" ? "Drafting..." : "Submitting...";
  }
  if (draftBtn) draftBtn.disabled = true;

  try {
    const activeContext = currentAttendanceSession;
    const user = (await supabaseClient.auth.getUser()).data?.user;

    if (!user) {
      showToast("Session expired. Please log in again.", "error");
      return;
    }

    // Determine workflow status from dropdown or parameter
    const workflowStatusSelect = document.getElementById(
      "attendanceWorkflowStatus",
    );
    const workflowStatus = workflowStatusSelect
      ? workflowStatusSelect.value
      : passedWorkflowStatus;

    // 1. Fetch School ID
    let schoolId = activeContext.schoolId;
    if (!schoolId) {
      const { data: profile } = await supabaseClient
        .from("profiles")
        .select("school_id")
        .eq("id", user.id)
        .maybeSingle();

      schoolId = profile?.school_id;
    }

    if (!schoolId) {
      showToast("Error: Teacher profile is missing a school_id.", "error");
      return;
    }

    // 2. Fetch Active Academic Year
    let academicYearId =
      activeContext.academicYearId ||
      activeAcademicYearId ||
      window.activeAcademicYearId;

    if (!academicYearId) {
      const { data: activeYear } = await supabaseClient
        .from("academic_years")
        .select("id")
        .eq("school_id", schoolId)
        .ilike("status", "Active")
        .limit(1)
        .maybeSingle();

      academicYearId = activeYear?.id;
    }

    if (!academicYearId) {
      showToast("Error: No Active academic year found in database.", "error");
      return;
    }

    // 3. Fetch Active Term
    let termId = activeContext.termId || activeTermId || window.activeTermId;

    if (!termId) {
      const { data: activeTerm } = await supabaseClient
        .from("terms")
        .select("id")
        .eq("academic_year_id", academicYearId)
        .ilike("status", "Active")
        .limit(1)
        .maybeSingle();

      termId = activeTerm?.id;
    }

    if (!termId) {
      showToast("Error: No Active term found in database.", "error");
      return;
    }

    // 4. Fetch Active Assessment Period (Background Check)
    let assessmentId =
      activeContext.assessmentId ||
      activeAssessmentId ||
      window.activeAssessmentId;

    if (!assessmentId) {
      const { data: activeAssessment } = await supabaseClient
        .from("assessments")
        .select("id")
        .eq("term_id", termId)
        .ilike("status", "Active")
        .limit(1)
        .maybeSingle();

      assessmentId = activeAssessment?.id;
    }

    if (!assessmentId) {
      showToast(
        "Error: No Active assessment period found in database.",
        "error",
      );
      return;
    }

    // 5. Collect individual student status rows into JSON payload
    const statusDropdowns = document.querySelectorAll(
      ".attendance-status-dropdown",
    );
    const recordsPayload = [];

    statusDropdowns.forEach((dropdown) => {
      const studentId = dropdown.getAttribute("data-student-id");
      const status = dropdown.value;

      if (studentId) {
        recordsPayload.push({
          student_id: studentId,
          status: status,
        });
      }
    });

    if (recordsPayload.length === 0) {
      showToast("No student statuses to save.", "error");
      return;
    }

    // 6. Call the RPC function to save attendance and records atomically
    const { data: savedAttendanceId, error: rpcError } =
      await supabaseClient.rpc("save_attendance_with_records", {
        p_school_id: schoolId,
        p_class_id: activeContext.classId,
        p_subject_id: activeContext.subjectId || null,
        p_period_id: activeContext.periodId || null,
        p_assessment_id: assessmentId,
        p_teacher_id: user.id,
        p_academic_year_id: academicYearId,
        p_term_id: termId,
        p_date: activeContext.dateStr || getLocalDateString(),
        p_status: workflowStatus,
        p_attendance_id: activeContext.id || null,
        p_records: recordsPayload,
      });

    if (rpcError) {
      showToast(`Error saving attendance: ${rpcError.message}`, "error");
      return;
    }

    showToast(
      `Attendance successfully ${workflowStatus === "drafted" ? "saved as Draft" : "Submitted"}!`,
      "success",
    );
    closeModal(document.getElementById("studentAttendanceModal"));

    if (typeof loadAttendanceTable === "function") {
      loadAttendanceTable();
    }
  } catch (err) {
    showToast(`Failed to save attendance: ${err.message}`, "error");
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save Attendance";
    }
    if (draftBtn) draftBtn.disabled = false;
  }
}
/**
 * Reset Form Fields
 */
function resetAttendanceModal() {
  document.getElementById("attendanceForm")?.reset();
  const periodSelect = document.getElementById("attendancePeriodSelect");
  if (periodSelect) periodSelect.disabled = true;
  currentTodayLessons = [];
}

/**
 * Load and render attendance logs into the main UI table
 */
async function loadAttendanceTable() {
  const tbody = document.getElementById("attendanceTableBody");
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 16px;">Loading attendance records...</td></tr>`;

  try {
    const user = (await supabaseClient.auth.getUser()).data?.user;
    if (!user) return;

    // Fetch master attendance records joined with relational details + workflow status
    const { data: attendanceList, error } = await supabaseClient
      .from("attendance")
      .select(
        `
        id,
        date,
        status,
        class_id,
        subject_id,
        academic_year_id,
        term_id,
        classes(id, name),
        subjects(id, name),
        academic_years(id, year_label),
        terms(id, name)
      `,
      )
      .eq("teacher_id", user.id)
      .order("date", { ascending: false });

    if (error) {
      console.error("Error loading attendance table:", error);
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:#dc2626; padding: 16px;">Error: ${error.message}</td></tr>`;
      return;
    }

    if (!attendanceList || attendanceList.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 16px;">No attendance records found.</td></tr>`;
      return;
    }

    // Fetch total student counts per attendance ID from attendance_records
    const attendanceIds = attendanceList.map((a) => a.id);
    const { data: recordsData, error: countErr } = await supabaseClient
      .from("attendance_records")
      .select("attendance_id")
      .in("attendance_id", attendanceIds);

    const countsMap = new Map();
    if (!countErr && recordsData) {
      recordsData.forEach((rec) => {
        countsMap.set(
          rec.attendance_id,
          (countsMap.get(rec.attendance_id) || 0) + 1,
        );
      });
    }

    // Render table rows
    tbody.innerHTML = "";
    attendanceList.forEach((item) => {
      const className = item.classes?.name || "N/A";
      const classId = item.classes?.id || item.class_id || "";

      const subjectName = item.subjects?.name || "General";
      const subjectId = item.subjects?.id || item.subject_id || "";

      const yearName = item.academic_years?.year_label || "N/A";
      const yearId = item.academic_years?.id || item.academic_year_id || "";

      const termName = item.terms?.name || "N/A";
      const termId = item.terms?.id || item.term_id || "";

      const studentCount = countsMap.get(item.id) || 0;
      const formattedDate = formatDate(item.date);
      const isDraft = item.status === "drafted";

      // Status Badge Styling
      const statusBadge = isDraft
        ? `<span class="status-badge status-drafted">Drafted</span>`
        : `<span class="status-badge status-submitted">Submitted</span>`;

      // Conditional Action Button (Edit for draft, View for submitted)
      const actionButton = isDraft
        ? `<button class="attendances-actions-btn edit-attendance-btn" data-attendance-id="${item.id}" title="Edit Draft">
             <i class="fa-solid fa-pen-to-square"></i>
           </button>`
        : `<button class="attendances-actions-btn view-attendance-btn" data-attendance-id="${item.id}" title="View Details">
             <i class="fa-solid fa-eye"></i>
           </button>`;

      const tr = document.createElement("tr");

      // Attach data attributes for IDs to the table row
      tr.dataset.attendanceId = item.id;
      tr.dataset.classId = classId;
      tr.dataset.subjectId = subjectId;
      tr.dataset.academicYearId = yearId;
      tr.dataset.termId = termId;

      tr.innerHTML = `
        <td>${escapeHtml(className)}</td>
        <td>${escapeHtml(subjectName)}</td>
        <td data-year-id="${yearId}">${escapeHtml(yearName)}</td>
        <td data-term-id="${termId}">${escapeHtml(termName)}</td>
        <td>${formattedDate}</td>
        <td>${studentCount}</td>
        <td>${statusBadge}</td>
        <td>${actionButton}</td>
      `;

      tbody.appendChild(tr);
    });

    // Re-attach dynamic view/edit modal button listeners
    attachTableActionListeners();
  } catch (err) {
    console.error("Attendance table exception:", err);
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:#dc2626; padding: 16px;">Failed to load attendance logs.</td></tr>`;
  }
}

/**
 * Event Listener Handler for Dynamic 'View' and 'Edit' Buttons
 */
function attachTableActionListeners() {
  // Edit Button Listener (Drafted records)
  document.querySelectorAll(".edit-attendance-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const attendanceId = e.currentTarget.getAttribute("data-attendance-id");
      if (typeof openEditAttendanceModal === "function") {
        openEditAttendanceModal(attendanceId);
      }
    });
  });

  // View Button Listener (Submitted records)
  document.querySelectorAll(".view-attendance-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const attendanceId = e.currentTarget.getAttribute("data-attendance-id");
      if (typeof openViewAttendanceModal === "function") {
        openViewAttendanceModal(attendanceId);
      }
    });
  });
}
/**
 * Event Listener Handler for Dynamic 'View' Buttons
 */
function attachViewButtonListeners() {
  const viewModal = document.getElementById("viewAttendanceModal");
  document.querySelectorAll(".attendances-actions-btn.view").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const attendanceId = e.currentTarget.getAttribute("data-attendance-id");
      if (typeof openViewAttendanceModal === "function") {
        openViewAttendanceModal(attendanceId);
      } else if (viewModal) {
        openModal(viewModal);
      }
    });
  });
}

/**
 * Helper Utility to Format Date Strings (e.g. 2026-08-12 -> 12 Aug)
 */
function formatDate(dateStr) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/**
 * Basic XSS Prevention Helper
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Opens and populates the View Attendance Modal for a specific attendance ID
 * @param {string} attendanceId
 */
async function openViewAttendanceModal(attendanceId) {
  const modal = document.getElementById("viewAttendanceModal");
  if (!modal || !attendanceId) return;

  // 1. Reset / Set Loading state
  const elClass = document.getElementById("viewModalClassName");
  const elSubject = document.getElementById("viewModalSubjectName");
  const elYear = document.getElementById("viewModalAcademicYear");
  const elTerm = document.getElementById("viewModalTermName");
  const elAssessment = document.getElementById("viewModalAssessmentName");
  const elWorkflowStatus = document.getElementById("viewModalWorkflowStatus");
  const elTeacher = document.getElementById("viewModalTeacherName");
  const elDate = document.getElementById("viewModalDate");
  const tbody = document.getElementById("viewAttendanceRosterBody");

  if (elClass) elClass.textContent = "Loading...";
  if (elSubject) elSubject.textContent = "Loading...";
  if (elYear) elYear.textContent = "Loading...";
  if (elTerm) elTerm.textContent = "Loading...";
  if (elAssessment) elAssessment.textContent = "Loading...";
  if (elWorkflowStatus) elWorkflowStatus.textContent = "Loading...";
  if (elTeacher) elTeacher.textContent = "Loading...";
  if (elDate) elDate.textContent = "Loading...";
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="2" style="text-align:center; padding: 12px;">Loading student records...</td></tr>`;
  }

  // Open the modal container immediately
  openModal(modal);

  try {
    // 2. Query parent attendance record with assessments & workflow status
    const { data: attendance, error: parentErr } = await supabaseClient
      .from("attendance")
      .select(
        `
        id,
        date,
        status,
        classes(name),
        subjects(name),
        academic_years(year_label),
        terms(name),
        assessments(name),
        profiles:teacher_id(full_name)
      `,
      )
      .eq("id", attendanceId)
      .single();

    if (parentErr || !attendance) {
      console.error("Error fetching attendance details:", parentErr);
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="2" style="text-align:center; color:#dc2626; padding: 12px;">Failed to load attendance metadata.</td></tr>`;
      }
      return;
    }

    // Populate Header Grid Fields
    if (elClass) elClass.textContent = attendance.classes?.name || "N/A";
    if (elSubject)
      elSubject.textContent = attendance.subjects?.name || "General";
    if (elYear)
      elYear.textContent = attendance.academic_years?.year_label || "N/A";
    if (elTerm) elTerm.textContent = attendance.terms?.name || "N/A";
    if (elAssessment)
      elAssessment.textContent = attendance.assessments?.name || "General";
    if (elTeacher)
      elTeacher.textContent = attendance.profiles?.full_name || "Teacher";
    if (elDate) elDate.textContent = formatDate(attendance.date);

    // Format & Render Workflow Status Badge (Drafted vs Submitted)
    if (elWorkflowStatus) {
      const rawStatus = attendance.status || "drafted";
      const statusLabel =
        rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1);
      const statusClass =
        rawStatus.toLowerCase() === "submitted"
          ? "status-submitted"
          : "status-drafted";

      elWorkflowStatus.innerHTML = `
        <span class="status-badge ${statusClass}" style="padding: 4px 10px; font-size: 0.85rem; font-weight: 600;">
          ${escapeHtml(statusLabel)}
        </span>
      `;
    }

    // 3. Query individual student records for this attendance session
    const { data: records, error: recordsErr } = await supabaseClient
      .from("attendance_records")
      .select("student_id, status")
      .eq("attendance_id", attendanceId);

    if (recordsErr) {
      console.error("Error fetching attendance student records:", recordsErr);
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="2" style="text-align:center; color:#dc2626; padding: 12px;">Failed to load student records.</td></tr>`;
      }
      return;
    }

    if (!records || records.length === 0) {
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="2" style="text-align:center; padding: 12px;">No student records found for this session.</td></tr>`;
      }
      return;
    }

    // 4. Fetch display names for students from profiles table
    const studentIds = records.map((r) => r.student_id);
    const { data: profiles, error: profileErr } = await supabaseClient
      .from("profiles")
      .select("id, full_name")
      .in("id", studentIds);

    const profileMap = new Map();
    if (!profileErr && profiles) {
      profiles.forEach((p) => profileMap.set(p.id, p.full_name));
    }

    // 5. Render Student Roster Rows
    if (tbody) {
      tbody.innerHTML = "";
      records.forEach((record) => {
        const studentName =
          profileMap.get(record.student_id) ||
          `Student (${record.student_id.slice(0, 8)})`;
        const statusText = record.status
          ? record.status.charAt(0).toUpperCase() + record.status.slice(1)
          : "N/A";

        // Dynamic badge color styling based on student status
        const statusClass = getStatusBadgeStyle(record.status);

        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td style="padding: 10px 12px; font-weight: 500;">${escapeHtml(studentName)}</td>
          <td style="padding: 10px 12px;">
            <span class="status-badge ${statusClass}" style="padding: 4px 10px; font-size: 0.85rem; font-weight: 600;">
              ${escapeHtml(statusText)}
            </span>
          </td>
        `;
        tbody.appendChild(tr);
      });
    }
  } catch (err) {
    console.error("View modal exception:", err);
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="2" style="text-align:center; color:#dc2626; padding: 12px;">An error occurred while loading details.</td></tr>`;
    }
  }
}

/**
 * Helper to map status to inline CSS badge classes
 */
function getStatusBadgeStyle(status) {
  switch (status?.toLowerCase()) {
    case "present":
      return "status-present"; // Add matching CSS rule (e.g. green bg)
    case "absent":
      return "status-absent"; // Add matching CSS rule (e.g. red bg)
  }
}

let currentEditingAttendanceId = null;

/**
 * Global Event Listeners for Edit Modal Controls
 */
document
  .getElementById("closeEditAttendanceModal")
  ?.addEventListener("click", () => {
    closeModal(document.getElementById("editAttendanceModal"));
  });

document
  .getElementById("cancelEditAttendanceModal")
  ?.addEventListener("click", () => {
    closeModal(document.getElementById("editAttendanceModal"));
  });

document
  .getElementById("editAttendanceForm")
  ?.addEventListener("submit", async (e) => {
    e.preventDefault();
    await handleSaveEditAttendance();
  });

/**
 * Checks whether form inputs differ from initialEditState
 * @returns {boolean}
 */
function hasFormChanged() {
  if (!initialEditState) return true;

  // 1. Check if workflow status changed (e.g. drafted -> submitted)
  const workflowSelect = document.getElementById("editWorkflowStatus");
  const currentWorkflowStatus = workflowSelect
    ? workflowSelect.value
    : "drafted";
  if (currentWorkflowStatus !== initialEditState.workflowStatus) {
    return true;
  }

  // 2. Check if any student attendance status dropdown changed
  const dropdowns = document.querySelectorAll(".edit-status-dropdown");
  for (const dd of dropdowns) {
    const studentId = dd.getAttribute("data-student-id");
    const currentStatus = dd.value;
    const initialStatus = initialEditState.studentStatuses[studentId];

    if (currentStatus !== initialStatus) {
      return true; // Found a change!
    }
  }

  return false; // No changes detected
}

let initialEditState = null; // Snapshot of initial modal values

/**
 * Open Simple Edit Modal & Capture Initial State
 */
async function openEditAttendanceModal(attendanceId) {
  const modal = document.getElementById("editAttendanceModal");
  const tbody = document.getElementById("editAttendanceRosterBody");
  const workflowSelect = document.getElementById("editWorkflowStatus");

  if (!modal || !attendanceId) return;
  currentEditingAttendanceId = attendanceId;

  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="2" style="text-align:center; padding: 12px;">Loading...</td></tr>`;
  }

  openModal(modal);

  try {
    // 1. Fetch parent attendance workflow status
    const { data: attendance, error: parentErr } = await supabaseClient
      .from("attendance")
      .select("status")
      .eq("id", attendanceId)
      .single();

    if (parentErr || !attendance) {
      showToast("Error loading attendance record.", "error");
      closeModal(modal);
      return;
    }

    const initialWorkflowStatus = attendance.status || "drafted";
    if (workflowSelect) {
      workflowSelect.value = initialWorkflowStatus;
    }

    // 2. Fetch student records
    const { data: records, error: recordsErr } = await supabaseClient
      .from("attendance_records")
      .select("student_id, status")
      .eq("attendance_id", attendanceId);

    if (recordsErr || !records || records.length === 0) {
      if (tbody)
        tbody.innerHTML = `<tr><td colspan="2" style="text-align:center;">No students found.</td></tr>`;
      return;
    }

    // 3. Fetch student names
    const studentIds = records.map((r) => r.student_id);
    const { data: profiles } = await supabaseClient
      .from("profiles")
      .select("id, full_name")
      .in("id", studentIds);

    const profileMap = new Map();
    if (profiles) profiles.forEach((p) => profileMap.set(p.id, p.full_name));

    // 4. Render Editable Rows & Build Initial State Object
    const initialStudentStatuses = {};
    if (tbody) {
      tbody.innerHTML = "";
      records.forEach((record) => {
        const studentName =
          profileMap.get(record.student_id) ||
          `Student (${record.student_id.slice(0, 8)})`;
        initialStudentStatuses[record.student_id] = record.status;

        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td style="padding: 10px 12px; font-weight: 500;">${escapeHtml(studentName)}</td>
          <td style="padding: 10px 12px;">
            <select class="edit-status-dropdown" data-student-id="${record.student_id}" style="padding: 6px 10px; border: 2px solid #d1d5db; width: 100%;">
              <option value="present" ${record.status === "present" ? "selected" : ""}>Present</option>
              <option value="absent" ${record.status === "absent" ? "selected" : ""}>Absent</option>
            </select>
          </td>
        `;
        tbody.appendChild(tr);
      });
    }

    // 5. Store snapshot of initial form state for comparison
    initialEditState = {
      workflowStatus: initialWorkflowStatus,
      studentStatuses: initialStudentStatuses,
    };
  } catch (err) {
    console.error("Edit modal error:", err);
  }
}

/**
 * Save Updated Attendance via Database RPC
 */
async function handleSaveEditAttendance() {
  if (!currentEditingAttendanceId) return;

  // 🛑 Step 1: Validate if anything actually changed
  if (!hasFormChanged()) {
    showToast("No changes detected.", "info");
    return;
  }

  const saveBtn = document.getElementById("saveEditAttendanceBtn");
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = "Updating...";
  }

  try {
    const user = (await supabaseClient.auth.getUser()).data?.user;
    if (!user) {
      showToast("Session expired. Please log in again.", "error");
      return;
    }

    // 1. Resolve school_id
    let schoolId = currentAttendanceSession?.schoolId;
    if (!schoolId) {
      const { data: profile } = await supabaseClient
        .from("profiles")
        .select("school_id")
        .eq("id", user.id)
        .maybeSingle();

      schoolId = profile?.school_id;
    }

    if (!schoolId) {
      showToast("Error: Teacher profile is missing a school_id.", "error");
      return;
    }

    // 2. Read workflow status & roster
    const workflowSelect = document.getElementById("editWorkflowStatus");
    const newWorkflowStatus = workflowSelect
      ? workflowSelect.value
      : "submitted";

    const dropdowns = document.querySelectorAll(".edit-status-dropdown");
    const recordsPayload = [];

    dropdowns.forEach((dd) => {
      const studentId = dd.getAttribute("data-student-id");
      if (studentId) {
        recordsPayload.push({
          student_id: studentId,
          status: dd.value,
        });
      }
    });

    if (recordsPayload.length === 0) {
      showToast("No student records found to update.", "error");
      return;
    }

    // 3. Call RPC with exact parameter list
    const { error: rpcError } = await supabaseClient.rpc(
      "update_attendance_records",
      {
        p_attendance_id: currentEditingAttendanceId,
        p_teacher_id: user.id,
        p_school_id: schoolId,
        p_workflow_status: newWorkflowStatus,
        p_records: recordsPayload,
      },
    );

    if (rpcError) {
      showToast(`Error: ${rpcError.message}`, "error");
      return;
    }

    showToast(
      `Attendance updated successfully as ${newWorkflowStatus === "drafted" ? "Draft" : "Submitted"}!`,
      "success",
    );

    closeModal(document.getElementById("editAttendanceModal"));

    if (typeof loadAttendanceTable === "function") {
      loadAttendanceTable();
    }
  } catch (err) {
    showToast(`Failed to update attendance: ${err.message}`, "error");
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = "Update Attendance";
    }
  }
}

loadAttendanceTable();
