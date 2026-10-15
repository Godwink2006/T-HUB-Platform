let activeAcademicYearId = null;
let activeTermId = null;
let activeAssessmentId = null;
let currentTodayLessons = [];
let currentAttendanceProfile = null;

let currentAttendanceSession = {
  classId: null,
  className: "",
  periodId: null,
  periodName: "",
  subjectId: null,
  subjectName: "",
  teacherId: null,
  teacherName: "",
  teacherStaffId: "",
  teacherPhotoUrl: "",
  schoolId: null,
  academicYearId: null,
  termId: null,
  dateStr: getLocalDateString(),
};

function getLocalDateString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

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

function initModalEventListeners() {
  const attendanceModal = document.getElementById("attendanceModal");
  const studentAttendanceModal = document.getElementById(
    "studentAttendanceModal",
  );
  const viewAttendanceModal = document.getElementById("viewAttendanceModal");
  const editAttendanceModal = document.getElementById("editAttendanceModal");

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

  document
    .getElementById("closeStudentAttendanceModal")
    ?.addEventListener("click", () => closeModal(studentAttendanceModal));
  document
    .getElementById("cancelStudentAttendanceModal")
    ?.addEventListener("click", () => closeModal(studentAttendanceModal));

  document.querySelectorAll(".view").forEach((button) => {
    button.addEventListener("click", () => openModal(viewAttendanceModal));
  });

  document
    .getElementById("closeViewAttendanceModal")
    ?.addEventListener("click", () => closeModal(viewAttendanceModal));
  document
    .getElementById("closeViewBtn")
    ?.addEventListener("click", () => closeModal(viewAttendanceModal));

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
        .ilike("status", "Active")
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

  loadStudentsBtn?.addEventListener("click", async () => {
    const classId = classSelect.value;
    const className = classSelect.options[classSelect.selectedIndex]?.text;
    const periodId = periodSelect.value;
    const periodName = periodSelect.options[periodSelect.selectedIndex]?.text;

    if (!classId || !periodId) {
      showToast("Please select both Class and Period.", "error");
      return;
    }

    let lesson = currentTodayLessons.find((l) => l.period_id === periodId);
    let subjectId = lesson ? lesson.subject_id : null;
    let subjectName = lesson?.subjects?.name || null;

    const user = (await supabaseClient.auth.getUser()).data?.user;
    let profile = null;

    if (user) {
      const [profileRes, assignmentRes] = await Promise.all([
        supabaseClient
          .from("profiles")
          .select("full_name, school_id, photo_url, teachers(staff_id)")
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

    closeModal(document.getElementById("attendanceModal"));

    openStudentAttendanceModal({
      classId: classId,
      className: className,
      periodId: periodId,
      periodName: periodName,
      subjectId: subjectId,
      subjectName: subjectName || "-",
      teacherId: user?.id || null,
      teacherName: profile?.full_name || "-",
      teacherStaffId: profile?.teachers?.staff_id || "Not assigned",
      teacherPhotoUrl: profile?.photo_url || "",
      schoolId: profile?.school_id || null,
      academicYearId: activeAcademicYearId || window.activeAcademicYearId,
      termId: activeTermId || window.activeTermId,
      assessmentId: activeAssessmentId || window.activeAssessmentId,
      dateStr: getLocalDateString(),
    });
  });

  studentForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    await handleSaveAttendance("submitted");
  });

  draftBtn?.addEventListener("click", async () => {
    await handleSaveAttendance("drafted");
  });
}

async function populateClassOptions() {
  const classSelect = document.getElementById("attendanceClassSelect");
  if (!classSelect) return;
  classSelect.innerHTML = `<option value="">Select Class</option>`;

  const user = (await supabaseClient.auth.getUser()).data?.user;
  if (!user) return;

  try {
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("id, role, school_id")
      .eq("id", user.id)
      .single();
    if (profileError) throw profileError;
    currentAttendanceProfile = profile;

    const role = String(profile.role || "").toLowerCase();
    let classes = [];

    if (role === "admin") {
      if (!profile.school_id) {
        throw new Error("Your administrator profile is not linked to a school.");
      }

      const { data, error } = await supabaseClient
        .from("classes")
        .select("id, name")
        .eq("school_id", profile.school_id)
        .order("name");
      if (error) throw error;
      classes = data || [];
    } else if (role === "teacher") {
      const { data: assignments, error } = await supabaseClient
        .from("teacher_assignments")
        .select("class_id, classes(id, name)")
        .eq("teacher_id", user.id);
      if (error) throw error;

      classes = [
        ...new Map(
          (assignments || [])
            .filter((assignment) => assignment.classes)
            .map((assignment) => [
              assignment.classes.id,
              assignment.classes,
            ]),
        ).values(),
      ];
    } else {
      throw new Error("Only administrators and teachers can take attendance.");
    }

    classes.forEach((cls) => {
      const opt = document.createElement("option");
      opt.value = cls.id;
      opt.textContent = cls.name;
      classSelect.appendChild(opt);
    });

    if (classes.length === 0) {
      showToast(
        role === "admin"
          ? "No classes are available for your school."
          : "No classes are assigned to your account.",
        "error",
      );
    }
  } catch (error) {
    currentAttendanceProfile = null;
    console.error("Error fetching attendance classes:", error);
    showToast(error.message || "Could not load classes for attendance.", "error");
  }
}

async function handleClassSelectChange(classId) {
  const periodSelect = document.getElementById("attendancePeriodSelect");
  if (!periodSelect) return;

  periodSelect.innerHTML = `<option value="">Select Period</option>`;
  periodSelect.disabled = true;
  currentTodayLessons = [];

  if (!classId) return;

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
    const user = (await supabaseClient.auth.getUser()).data?.user;
    if (!user) {
      await loadDefaultPeriods(periodSelect);
      return;
    }
    const profile =
      currentAttendanceProfile?.id === user.id
        ? currentAttendanceProfile
        : null;
    const isAdmin = String(profile?.role || "").toLowerCase() === "admin";

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

    let lessonsQuery = supabaseClient
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
      .ilike("day_of_week", todayName);
    if (!isAdmin) lessonsQuery = lessonsQuery.eq("teacher_id", user.id);

    const { data: lessons, error: lError } = await lessonsQuery;

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

async function openStudentAttendanceModal(sessionData) {
  currentAttendanceSession = { ...currentAttendanceSession, ...sessionData };

  const modal = document.getElementById("studentAttendanceModal");

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
  if (elTeacher) {
    const teacherPhoto = escapeHtml(
      getAttendancePhotoUrl(currentAttendanceSession.teacherPhotoUrl),
    );
    elTeacher.innerHTML = `
      <span class="app-person-cell attendance-teacher-identity">
        <img class="app-person-avatar" src="${teacherPhoto}" alt="" loading="lazy" />
        <span class="app-person-meta">
          <span>${escapeHtml(currentAttendanceSession.teacherName || "-")}</span>
          <small class="app-person-id">Staff ID: ${escapeHtml(currentAttendanceSession.teacherStaffId || "Not assigned")}</small>
        </span>
      </span>
    `;
  }
  if (elDate) elDate.textContent = currentAttendanceSession.dateStr;

  openModal(modal);

  await loadRosterIntoModal(currentAttendanceSession.classId);
}

async function loadRosterIntoModal(classId) {
  const tbody = document.getElementById("studentAttendanceRosterBody");
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="2" style="text-align:center; padding: 12px;">Loading students...</td></tr>`;

  try {
    const cleanClassId = classId ? classId.trim() : "";
    console.log("Querying active students via RPC for class_id:", cleanClassId);


    const { data: activeStudents, error: studentErr } =
      await supabaseClient.rpc("get_active_class_students", {
        p_class_id: cleanClassId,
      });

    if (studentErr) {
      console.error("Error fetching active students:", studentErr);
      tbody.innerHTML = `<tr><td colspan="2" style="text-align:center; padding: 12px; color: #dc2626;">Error loading students: ${escapeHtml(studentErr.message)}</td></tr>`;
      return;
    }

    console.log("Filtered active students from database:", activeStudents);

    if (!activeStudents || activeStudents.length === 0) {
      tbody.innerHTML = `<tr><td colspan="2" style="text-align:center; padding: 12px; color: #dc2626;">No active students found for this class.</td></tr>`;
      return;
    }

    const studentIds = activeStudents.map((student) => student.id).filter(Boolean);
    const { data: studentProfiles, error: profileError } = await supabaseClient
      .from("profiles")
      .select("id, photo_url")
      .in("id", studentIds);

    if (profileError) {
      console.error("Could not load student photos for attendance roster:", profileError);
    }
    const studentPhotoById = new Map(
      (studentProfiles || []).map((profile) => [profile.id, profile.photo_url]),
    );

    tbody.innerHTML = "";
    activeStudents.forEach((student) => {
      const displayName =
        student.full_name ||
        (student.student_id
          ? `Student (${student.student_id})`
          : `Student (${student.id.slice(0, 8)})`);
      const studentPhoto = escapeHtml(
        getAttendancePhotoUrl(studentPhotoById.get(student.id)),
      );
      const studentCode = escapeHtml(student.student_id || "Not assigned");

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td style="padding: 10px 12px; font-weight: 500;">
          <span class="app-person-cell">
            <img class="app-person-avatar" src="${studentPhoto}" alt="" loading="lazy" />
            <span class="app-person-meta">
              <span>${escapeHtml(displayName)}</span>
              <small class="app-person-id">Student ID: ${studentCode}</small>
            </span>
          </span>
        </td>
        <td style="padding: 10px 12px;">
          <select class="attendance-status-dropdown" data-student-id="${escapeHtml(student.id)}" style="padding: 6px 10px; border: 2px solid rgb(219, 215, 215); width: 100%;">
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

    const workflowStatusSelect = document.getElementById(
      "attendanceWorkflowStatus",
    );
    const workflowStatus = workflowStatusSelect
      ? workflowStatusSelect.value
      : passedWorkflowStatus;

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
      showToast("Error: Your profile is missing a school_id.", "error");
      return;
    }

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

function resetAttendanceModal() {
  document.getElementById("attendanceForm")?.reset();
  const periodSelect = document.getElementById("attendancePeriodSelect");
  if (periodSelect) periodSelect.disabled = true;
  currentTodayLessons = [];
}

let allAttendanceList = [];

async function loadAttendanceTable() {
  const tbody = document.getElementById("attendanceTableBody");
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 16px;">Loading attendance records...</td></tr>`;

  try {
    const user = (await supabaseClient.auth.getUser()).data?.user;
    if (!user) return;


    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError) {
      console.error("Error fetching profile role:", profileError);
    }


    let query = supabaseClient.from("attendance").select(
      `
    id,
    date,
    status,
    teacher_id,
    class_id,
    subject_id,
    academic_year_id,
    term_id,
    classes(id, name),
    subjects(id, name),
    academic_years(id, year_label),
    terms(id, name),
    profiles(id, full_name, photo_url, teachers(staff_id))
  `,
    );

    const role = String(profile?.role || "").toLowerCase();
    if (role === "teacher") {
      query = query.eq("teacher_id", user.id);
    } else if (shouldFilterAttendanceToSubmitted(role)) {
      query = query.eq("status", "submitted");
    }


    const { data: attendanceList, error } = await query.order("date", {
      ascending: false,
    });

    if (error) {
      console.error("Error loading attendance table:", error);
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; color:#dc2626; padding: 16px;">Error: ${escapeHtml(error.message)}</td></tr>`;
      return;
    }

    if (!attendanceList || attendanceList.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 16px;">No attendance records found.</td></tr>`;
      return;
    }

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

      const statusBadge = isDraft
        ? `<span class="status-badge status-drafted">Drafted</span>`
        : `<span class="status-badge status-submitted">Submitted</span>`;

      const actionButton = isDraft
        ? `<button class="attendances-actions-btn edit-attendance-btn" data-attendance-id="${escapeHtml(item.id)}" title="Edit Draft">
             <i class="fa-solid fa-pen-to-square"></i>
           </button>`
        : `<button class="attendances-actions-btn view-attendance-btn" data-attendance-id="${escapeHtml(item.id)}" title="View Details">
             <i class="fa-solid fa-eye"></i>
           </button>`;

      const tr = document.createElement("tr");

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
        <td>${renderAttendanceActor(item.profiles)}</td>
        <td>${studentCount}</td>
        <td>${statusBadge}</td>
        <td>${actionButton}</td>
      `;

      tbody.appendChild(tr);
    });

    allAttendanceList = attendanceList || [];

    populateAttendanceFilters(allAttendanceList);

    renderFilteredAttendanceTable(allAttendanceList);

    setupAttendanceFilterListeners();

    attachTableActionListeners();
  } catch (err) {
    console.error("Attendance table exception:", err);
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; color:#dc2626; padding: 16px;">Failed to load attendance logs.</td></tr>`;
  }
}

function shouldFilterAttendanceToSubmitted(role) {
  return !["admin", "teacher"].includes(String(role || "").toLowerCase());
}

function populateClassFilter(records) {
  const classFilter = document.getElementById("attendanceClassFilter");
  if (!classFilter) return;

  populateAttendanceFilterOptions(
    classFilter,
    records,
    "classes",
    "class_id",
    "All Classes",
  );
}

function populateAttendanceFilterOptions(
  select,
  records,
  relationName,
  idField,
  allLabel,
) {
  select.replaceChildren(new Option(allLabel, "all"));

  const options = new Map();
  records.forEach((item) => {
    const relation = item[relationName];
    const id = relation?.id || item[idField];
    const label = relation?.name || relation?.year_label;
    if (id && label) options.set(id, label);
  });

  [...options.entries()]
    .sort(([, nameA], [, nameB]) => nameA.localeCompare(nameB))
    .forEach(([id, label]) => {
      select.add(new Option(label, id));
    });
}

function populateAttendanceFilters(records) {
  populateClassFilter(records);

  [
    ["attendanceSubjectFilter", "subjects", "subject_id", "All Subjects"],
    [
      "attendanceAcademicYearFilter",
      "academic_years",
      "academic_year_id",
      "All Academic Years",
    ],
    ["attendanceSemesterFilter", "terms", "term_id", "All Semesters"],
  ].forEach(([selectId, relation, idField, label]) => {
    const select = document.getElementById(selectId);
    if (select) {
      populateAttendanceFilterOptions(select, records, relation, idField, label);
    }
  });
}

function setupAttendanceFilterListeners() {
  const searchInput = document.getElementById("attendanceSearchInput");
  const filterIds = [
    "attendanceClassFilter",
    "attendanceSubjectFilter",
    "attendanceAcademicYearFilter",
    "attendanceSemesterFilter",
    "attendanceStatusFilter",
    "attendanceDateFilter",
  ];
  if (searchInput) searchInput.oninput = applyAttendanceFilters;
  filterIds.forEach((id) => {
    const select = document.getElementById(id);
    if (select) select.onchange = applyAttendanceFilters;
  });
}

function matchesAttendanceFilters(item, filters) {
  const searchTerm = filters.search.toLowerCase().trim();
  const className = (item.classes?.name || "").toLowerCase();
  const subjectName = (item.subjects?.name || "").toLowerCase();
  const itemDate = item.date ? item.date.split("T")[0] : "";

  return (
    (!searchTerm ||
      className.includes(searchTerm) ||
      subjectName.includes(searchTerm)) &&
    (filters.classId === "all" ||
      (item.classes?.id || item.class_id) === filters.classId) &&
    (filters.subjectId === "all" ||
      (item.subjects?.id || item.subject_id) === filters.subjectId) &&
    (filters.academicYearId === "all" ||
      (item.academic_years?.id || item.academic_year_id) ===
        filters.academicYearId) &&
    (filters.semesterId === "all" ||
      (item.terms?.id || item.term_id) === filters.semesterId) &&
    (filters.status === "all" ||
      String(item.status || "").toLowerCase() === filters.status) &&
    (!filters.date || itemDate === filters.date)
  );
}

function applyAttendanceFilters() {
  const filtered = allAttendanceList.filter((item) =>
    matchesAttendanceFilters(item, {
      search: document.getElementById("attendanceSearchInput")?.value || "",
      classId: document.getElementById("attendanceClassFilter")?.value || "all",
      subjectId:
        document.getElementById("attendanceSubjectFilter")?.value || "all",
      academicYearId:
        document.getElementById("attendanceAcademicYearFilter")?.value ||
        "all",
      semesterId:
        document.getElementById("attendanceSemesterFilter")?.value || "all",
      status: document.getElementById("attendanceStatusFilter")?.value || "all",
      date: document.getElementById("attendanceDateFilter")?.value || "",
    }),
  );
  renderFilteredAttendanceTable(filtered);
}

async function renderFilteredAttendanceTable(attendanceList) {
  const tbody = document.getElementById("attendanceTableBody");
  if (!tbody) return;

  if (!attendanceList || attendanceList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 16px;">No attendance records found.</td></tr>`;
    return;
  }

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

    const statusBadge = isDraft
      ? `<span class="status-badge status-drafted">Drafted</span>`
      : `<span class="status-badge status-submitted">Submitted</span>`;

    const actionButton = isDraft
      ? `<button class="attendances-actions-btn edit-attendance-btn" data-attendance-id="${escapeHtml(item.id)}" title="Edit Draft">
           <i class="fa-solid fa-pen-to-square"></i>
         </button>`
      : `<button class="attendances-actions-btn view-attendance-btn" data-attendance-id="${escapeHtml(item.id)}" title="View Details">
           <i class="fa-solid fa-eye"></i>
         </button>`;

    const tr = document.createElement("tr");
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
      <td>${renderAttendanceActor(item.profiles)}</td>
      <td>${studentCount}</td>
      <td>${statusBadge}</td>
      <td>${actionButton}</td>
    `;

    tbody.appendChild(tr);
  });

  if (typeof attachTableActionListeners === "function") {
    attachTableActionListeners();
  }
}

function renderAttendanceActor(profile) {
  if (!profile) return '<span class="table-muted">Unknown</span>';
  const name = escapeHtml(profile.full_name || "Unknown");
  const staffId = escapeHtml(profile.teachers?.staff_id || "No staff ID");
  const photo = escapeHtml(getAttendancePhotoUrl(profile.photo_url));
  return `<span class="app-person-cell attendance-table-actor"><img class="app-person-avatar" src="${photo}" alt="" loading="lazy" /><span class="app-person-meta"><span>${name}</span><small>${staffId}</small></span></span>`;
}

function attachTableActionListeners() {
  document.querySelectorAll(".edit-attendance-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const attendanceId = e.currentTarget.getAttribute("data-attendance-id");
      if (typeof openEditAttendanceModal === "function") {
        openEditAttendanceModal(attendanceId);
      }
    });
  });

  document.querySelectorAll(".view-attendance-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const attendanceId = e.currentTarget.getAttribute("data-attendance-id");
      if (typeof openViewAttendanceModal === "function") {
        openViewAttendanceModal(attendanceId);
      }
    });
  });
}

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

function formatDate(dateStr) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getAttendancePhotoUrl(photoUrl) {
  const fallback = window.DEFAULT_PROFILE_AVATAR || "";
  if (!photoUrl) return fallback;

  try {
    const parsedUrl = new URL(photoUrl, window.location.href);
    return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:"
      ? parsedUrl.href
      : fallback;
  } catch {
    return fallback;
  }
}

async function openViewAttendanceModal(attendanceId) {
  const modal = document.getElementById("viewAttendanceModal");
  if (!modal || !attendanceId) return;

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

  openModal(modal);

  try {
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
        profiles:teacher_id(full_name, photo_url, teachers(staff_id))
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

    if (elClass) elClass.textContent = attendance.classes?.name || "N/A";
    if (elSubject)
      elSubject.textContent = attendance.subjects?.name || "General";
    if (elYear)
      elYear.textContent = attendance.academic_years?.year_label || "N/A";
    if (elTerm) elTerm.textContent = attendance.terms?.name || "N/A";
    if (elAssessment)
      elAssessment.textContent = attendance.assessments?.name || "General";
    if (elTeacher) {
      const teacherName = attendance.profiles?.full_name || "Teacher";
      const teacherStaffId =
        attendance.profiles?.teachers?.staff_id || "Not assigned";
      const teacherPhoto = escapeHtml(
        getAttendancePhotoUrl(attendance.profiles?.photo_url),
      );
      elTeacher.innerHTML = `
        <span class="app-person-cell attendance-teacher-identity">
          <img class="app-person-avatar" src="${teacherPhoto}" alt="" loading="lazy" />
          <span class="app-person-meta">
            <span>${escapeHtml(teacherName)}</span>
            <small class="app-person-id">Staff ID: ${escapeHtml(teacherStaffId)}</small>
          </span>
        </span>
      `;
    }
    if (elDate) elDate.textContent = formatDate(attendance.date);

    if (elWorkflowStatus) {
      const rawStatus = attendance.status || "drafted";
      const statusLabel =
        rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1);
      const statusClass =
        rawStatus.toLowerCase() === "submitted"
          ? "status-submitted"
          : "status-drafted";

      elWorkflowStatus.innerHTML = `
        <span class="status-badge ${statusClass}" style="padding: 4px 10px; font-size: 0.85rem; margin-bottom: 5px; font-weight: 600;">
          ${escapeHtml(statusLabel)}
        </span>
      `;
    }

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

    const studentIds = records.map((r) => r.student_id);
    const identitySnapshots =
      await window.loadTransferredStudentIdentitySnapshots(studentIds);
    const { data: students, error: studentsError } = await supabaseClient
      .from("students")
      .select("id, student_id, profiles(full_name, photo_url)")
      .in("id", studentIds);

    if (studentsError) {
      console.error("Could not load student IDs for attendance details:", studentsError);
    }
    const studentMap = new Map(
      (students || []).map((student) => [student.id, student]),
    );

    if (tbody) {
      tbody.innerHTML = "";
      records.forEach((record) => {
        const student = studentMap.get(record.student_id);
        const snapshot = identitySnapshots.get(record.student_id);
        const studentName = student?.profiles?.full_name ||
          snapshot?.student_name_snapshot ||
          `Student (${record.student_id.slice(0, 8)})`;
        const studentPhoto = escapeHtml(
          getAttendancePhotoUrl(
            student?.profiles?.photo_url || snapshot?.student_photo_snapshot,
          ),
        );
        const studentCode = escapeHtml(
          student?.student_id || snapshot?.student_code_snapshot || "Not assigned",
        );
        const statusText = record.status
          ? record.status.charAt(0).toUpperCase() + record.status.slice(1)
          : "N/A";

        const statusClass = getStatusBadgeStyle(record.status);

        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td style="padding: 10px 12px; font-weight: 500;">
            <span class="app-person-cell">
              <img class="app-person-avatar" src="${studentPhoto}" alt="" loading="lazy" />
              <span class="app-person-meta">
                <span>${escapeHtml(studentName)}</span>
                <small class="app-person-id">Student ID: ${studentCode}</small>
              </span>
            </span>
          </td>
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

function getStatusBadgeStyle(status) {
  switch (status?.toLowerCase()) {
    case "present":
      return "status-present";
    case "absent":
      return "status-absent";
  }
}

let currentEditingAttendanceId = null;

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

function hasFormChanged() {
  if (!initialEditState) return true;

  const workflowSelect = document.getElementById("editWorkflowStatus");
  const currentWorkflowStatus = workflowSelect
    ? workflowSelect.value
    : "drafted";
  if (currentWorkflowStatus !== initialEditState.workflowStatus) {
    return true;
  }

  const dropdowns = document.querySelectorAll(".edit-status-dropdown");
  for (const dd of dropdowns) {
    const studentId = dd.getAttribute("data-student-id");
    const currentStatus = dd.value;
    const initialStatus = initialEditState.studentStatuses[studentId];

    if (currentStatus !== initialStatus) {
      return true;
    }
  }

  return false;
}

let initialEditState = null;

async function openEditAttendanceModal(attendanceId) {
  const modal = document.getElementById("editAttendanceModal");
  const tbody = document.getElementById("editAttendanceRosterBody");
  const workflowSelect = document.getElementById("editWorkflowStatus");
  const creatorElement = document.getElementById("editAttendanceCreator");

  if (!modal || !attendanceId) return;
  currentEditingAttendanceId = attendanceId;

  if (creatorElement) creatorElement.textContent = "Loading...";
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="2" style="text-align:center; padding: 12px;">Loading...</td></tr>`;
  }

  openModal(modal);

  try {
    const { data: attendance, error: parentErr } = await supabaseClient
      .from("attendance")
      .select(
        "status, profiles:teacher_id(full_name, photo_url, teachers(staff_id))",
      )
      .eq("id", attendanceId)
      .single();

    if (parentErr || !attendance) {
      showToast("Error loading attendance record.", "error");
      closeModal(modal);
      return;
    }

    if (creatorElement) {
      const creator = attendance.profiles;
      const creatorId = creator?.teachers?.staff_id
        ? `Staff ID: ${creator.teachers.staff_id}`
        : "No ID found";
      const creatorPhoto = escapeHtml(
        getAttendancePhotoUrl(creator?.photo_url),
      );
      creatorElement.innerHTML = `
        <span class="app-person-cell attendance-teacher-identity">
          <img class="app-person-avatar" src="${creatorPhoto}" alt="" loading="lazy" />
          <span class="app-person-meta">
            <span>${escapeHtml(creator?.full_name || "Unknown")}</span>
            <small class="app-person-id">${escapeHtml(creatorId)}</small>
          </span>
        </span>
      `;
    }

    const initialWorkflowStatus = attendance.status || "drafted";
    if (workflowSelect) {
      workflowSelect.value = initialWorkflowStatus;
    }

    const { data: records, error: recordsErr } = await supabaseClient
      .from("attendance_records")
      .select("student_id, status")
      .eq("attendance_id", attendanceId);

    if (recordsErr || !records || records.length === 0) {
      if (tbody)
        tbody.innerHTML = `<tr><td colspan="2" style="text-align:center;">No students found.</td></tr>`;
      return;
    }

    const studentIds = records.map((r) => r.student_id);
    const identitySnapshots =
      await window.loadTransferredStudentIdentitySnapshots(studentIds);
    const { data: students, error: studentsError } = await supabaseClient
      .from("students")
      .select("id, student_id, profiles(full_name, photo_url)")
      .in("id", studentIds);

    if (studentsError) {
      console.error("Could not load student IDs for attendance edit:", studentsError);
    }
    const studentMap = new Map(
      (students || []).map((student) => [student.id, student]),
    );

    const initialStudentStatuses = {};
    if (tbody) {
      tbody.innerHTML = "";
      records.forEach((record) => {
        const student = studentMap.get(record.student_id);
        const snapshot = identitySnapshots.get(record.student_id);
        const studentName =
          student?.profiles?.full_name ||
          snapshot?.student_name_snapshot ||
          `Student (${record.student_id.slice(0, 8)})`;
        const studentCode = escapeHtml(
          student?.student_id || snapshot?.student_code_snapshot || "Not assigned",
        );
        const studentPhoto = escapeHtml(
          getAttendancePhotoUrl(
            student?.profiles?.photo_url || snapshot?.student_photo_snapshot,
          ),
        );
        initialStudentStatuses[record.student_id] = record.status;

        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>
            <span class="app-person-cell">
              <img class="app-person-avatar" src="${studentPhoto}" alt="" loading="lazy" />
              <span class="app-person-meta">
                <span>${escapeHtml(studentName)}</span>
                <small class="app-person-id">Student ID: ${studentCode}</small>
              </span>
            </span>
          </td>
          <td>
            <select class="edit-status-dropdown" data-student-id="${escapeHtml(record.student_id)}">
              <option value="present" ${record.status === "present" ? "selected" : ""}>Present</option>
              <option value="absent" ${record.status === "absent" ? "selected" : ""}>Absent</option>
            </select>
          </td>
        `;
        tbody.appendChild(tr);
      });
    }

    initialEditState = {
      workflowStatus: initialWorkflowStatus,
      studentStatuses: initialStudentStatuses,
    };
  } catch (err) {
    console.error("Edit modal error:", err);
  }
}

async function handleSaveEditAttendance() {
  if (!currentEditingAttendanceId) return;

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
      showToast("Error: Your profile is missing a school_id.", "error");
      return;
    }

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
