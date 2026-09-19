/* ==========================================================================
   MY TIMETABLE - CARD BASED LAYOUT (my-timetable.js)
   ========================================================================== */

document.addEventListener("DOMContentLoaded", async () => {
  await initMyTimetable();

  // Print schedule handler
  document
    .getElementById("printTimetableBtn")
    ?.addEventListener("click", () => {
      window.print();
    });
});
async function initMyTimetable() {
  try {
    // 1. Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      renderEmptyState("User session not found. Please log in.");
      return;
    }

    // 2. Fetch user profile role and school_id
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("role, school_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      console.error("Profile Fetch Error:", profileError);
      throw new Error("Could not retrieve user profile.");
    }

    const role = profile.role?.toLowerCase();
    currentUserRole = role || "student";
    const schoolId = profile.school_id;

    if (role === "student") {
      // Query students table directly for the logged in user
      const { data: studentData, error: studentErr } = await supabaseClient
        .from("students")
        .select("class_id, school_id")
        .eq("id", user.id)
        .single();

      if (studentErr || !studentData?.class_id) {
        console.error("Student fetch error:", studentErr);
        renderEmptyState("You are not currently assigned to a class.");
        return;
      }

      // Pass class_id and school_id
      await loadStudentClassSchedule(
        studentData.class_id,
        studentData.school_id || schoolId,
      );

      // Initialize dropdown filters with valid schoolId
      await setupTimetableFilters(studentData.school_id || schoolId);
    } else if (role === "teacher") {
      // Fetch teacher record linked to user
      const { data: teacherData } = await supabaseClient
        .from("teachers")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();

      const teacherId = teacherData?.id || user.id;
      await loadTeacherPersonalSchedule(teacherId);

      // Initialize dropdown filters for teacher
      await setupTimetableFilters(schoolId);
    } else {
      renderEmptyState("Timetable access is not available for your role.");
    }
  } catch (err) {
    console.error("Timetable Load Error:", err);
    renderEmptyState("Failed to load timetable schedule.");
  }
}
/**
 * Load Class Schedule for Students
 */
async function loadStudentClassSchedule(classId, schoolId) {
  if (!classId) {
    renderEmptyState("You are not assigned to any class yet.");
    return;
  }

  // 1. Fetch Class Name scoped to school_id
  let classQuery = supabaseClient
    .from("classes")
    .select("name")
    .eq("id", classId);

  if (schoolId) {
    classQuery = classQuery.eq("school_id", schoolId);
  }

  const { data: classData } = await classQuery.maybeSingle();

  if (classData) {
    const classNameEl = document.getElementById("classNameDisplay");
    if (classNameEl) classNameEl.textContent = classData.name;
  }

  // Fetch class teacher for THIS EXACT class_id
  const { data: assignment } = await supabaseClient
    .from("teacher_assignments")
    .select("teacher_id")
    .eq("class_id", classId)
    .eq("is_class_teacher", true)
    .eq("status", "active")
    .maybeSingle();

  let teacherName = "Not Assigned";

  if (assignment?.teacher_id) {
    const { data: teacherProfile } = await supabaseClient
      .from("profiles")
      .select("full_name")
      .eq("id", assignment.teacher_id)
      .maybeSingle();

    if (teacherProfile?.full_name) {
      teacherName = teacherProfile.full_name;
    }
  }

  const classTeacherEl = document.getElementById("classTeacherDisplay");
  if (classTeacherEl) {
    classTeacherEl.textContent = teacherName;
  }

  document.getElementById("classMetaBanner")?.classList.remove("hidden");

  // 3. Fetch Active Timetable record scoped by class_id and school_id
  let ttQuery = supabaseClient
    .from("timetables")
    .select("id, status, academic_year_id")
    .eq("class_id", classId)
    .eq("status", "Active");

  if (schoolId) {
    ttQuery = ttQuery.eq("school_id", schoolId);
  }

  const { data: timetables, error: ttErr } = await ttQuery.order("created_at", {
    ascending: false,
  });

  if (ttErr) {
    console.error("Timetable Fetch Error:", ttErr);
    renderEmptyState("Error loading timetable data.");
    return;
  }

  const activeTimetable =
    timetables?.find((t) => t.status?.toLowerCase() === "active") ||
    timetables?.[0];

  if (!activeTimetable) {
    renderEmptyState("No active timetable found for your class.");
    return;
  }

  // 4. Fetch raw lessons
  const { data: rawLessons, error: lessonsErr } = await supabaseClient
    .from("timetable_lessons")
    .select("id, day_of_week, is_break, subject_id, teacher_id, period_id")
    .eq("timetable_id", activeTimetable.id);

  if (lessonsErr || !rawLessons || rawLessons.length === 0) {
    console.error("Lessons Fetch Error:", lessonsErr);
    renderEmptyState("No active timetable found for your class.");
    return;
  }

  // 5. Fetch lookups
  const [subjectsRes, profilesRes, periodsRes] = await Promise.all([
    supabaseClient.from("subjects").select("id, name"),
    supabaseClient.from("profiles").select("id, full_name"),
    supabaseClient.from("periods").select("id, name, start_time, end_time"),
  ]);

  const subjectsMap = new Map((subjectsRes.data || []).map((s) => [s.id, s]));
  const profilesMap = new Map((profilesRes.data || []).map((p) => [p.id, p]));
  const periodsMap = new Map((periodsRes.data || []).map((p) => [p.id, p]));

  // Step 6: Format lessons for rendering
  const formattedLessons = rawLessons.map((lesson) => {
    const subjectObj = subjectsMap.get(lesson.subject_id);
    const periodObj = periodsMap.get(lesson.period_id);
    const profileObj = profilesMap.get(lesson.teacher_id);

    // Strictly evaluate if this period is a break
    const isBreak = Boolean(
      lesson.is_break === true ||
      lesson.is_break === "true" ||
      (!lesson.subject_id && !subjectObj),
    );
    // Fallback to period name or generic "BREAK" if subjectName is absent
    const breakDisplayName = periodObj?.name || "BREAK";

    return {
      ...lesson,
      is_break: isBreak,
      subject: subjectObj
        ? { name: subjectObj.name }
        : { name: breakDisplayName },
      teacher: { full_name: profileObj?.full_name || "-" },
      period: periodObj || { start_time: null, end_time: null },
    };
  });

  allCurrentLessons = formattedLessons;

  renderScheduleCards(formattedLessons, "student");
}
/**
 * Load Personal Schedule for Teachers
 */
async function loadTeacherPersonalSchedule(teacherId) {
  // Hide Class Teacher Metadata Banner
  document.getElementById("classMetaBanner")?.classList.add("hidden");
  document.getElementById("timetableSubtitle").textContent =
    "Your personal weekly teaching schedule";

  // Fetch only lessons where teacher is assigned
  const { data: lessons, error } = await supabaseClient
    .from("timetable_lessons")
    .select(
      `
      id,
      day_of_week,
      is_break,
      subject:subjects (name),
      period:periods (name, start_time, end_time),
      timetable:timetables (class:classes(name))
    `,
    )
    .eq("teacher_id", teacherId)
    .eq("status", "active");

  if (error || !lessons || lessons.length === 0) {
    renderEmptyState("You have no assigned teaching periods.");
    return;
  }

  // 1. Format raw lessons for teachers
  const formattedLessons = lessons.map((lesson) => {
    const isBreak = Boolean(
      lesson.is_break || (!lesson.subject && !lesson.subject?.name),
    );

    return {
      ...lesson,
      is_break: isBreak,
      subject: lesson.subject
        ? { name: lesson.subject.name }
        : { name: lesson.period?.name || "BREAK" },
      class: { name: lesson.timetable?.class?.name || "" },
      period: lesson.period || { start_time: null, end_time: null },
    };
  });

  // 2. Save to global store for dropdown filtering
  allCurrentLessons = formattedLessons;

  // 3. Render once with teacher role context
  renderScheduleCards(formattedLessons, "teacher");
}

/**
 * Render Day Cards (Filters out hidden day cards when a day is selected)
 */
function renderScheduleCards(lessons, roleContext) {
  const container = document.getElementById("timetableCardsGrid");
  if (!container) return;

  const selectedDay = document.getElementById("filterTimetableDays")?.value;
  const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

  // Filter the list of days to display based on dropdown selection
  const activeDays = selectedDay
    ? daysOfWeek.filter(
        (day) => day.toLowerCase() === selectedDay.toLowerCase(),
      )
    : daysOfWeek;

  // Group lessons by active days
  const groupedLessons = activeDays.reduce((acc, day) => {
    acc[day] = lessons.filter(
      (l) => l.day_of_week === day || l.day_of_week === "All",
    );

    // Sort chronologically by period start time
    acc[day].sort((a, b) => {
      const timeA = a.period?.start_time || "00:00";
      const timeB = b.period?.start_time || "00:00";
      return timeA.localeCompare(timeB);
    });

    return acc;
  }, {});

  // Build HTML Cards for active days only
  container.innerHTML = activeDays
    .map((day) => {
      const dayLessons = groupedLessons[day] || [];

      return `
        <div class="day-card">
          <div class="day-card-header">
            <span>${day}</span>
            <span class="lesson-count">${dayLessons.length} Periods</span>
          </div>
          <div class="day-card-body">
            ${
              dayLessons.length === 0
                ? `<div class="empty-state"><p>No classes scheduled</p></div>`
                : dayLessons
                    .map((item) => renderLessonCardItem(item, roleContext))
                    .join("")
            }
          </div>
        </div>
      `;
    })
    .join("");
}

/**
 * Render individual period box inside a Day Card
 */
function renderLessonCardItem(item, roleContext) {
  const timeStr =
    item.period?.start_time && item.period?.end_time
      ? `${item.period.start_time.slice(0, 5)} - ${item.period.end_time.slice(0, 5)}`
      : "--:--";

  const subjectName = item.subject?.name || "";
  const teacherName = item.teacher?.full_name || "";

  // Evaluation to check if this slot is a break
  const isBreakCard = Boolean(
    item.is_break || (!item.subject_id && !item.subject?.name),
  );

  // Render Break Card (No Teacher, No Subject fields)
  if (isBreakCard) {
    const breakName = item.period?.name || "Break / Interval";
    return `
      <div class="lesson-card-item is-break" style="background-color: #f8fafc; border: 2px solid green; padding: 12px; text-align: center;">
        <div class="lesson-time" style="font-size: 0.85rem; color: #64748b; margin-bottom: 4px; align-items: center; justify-content: center;">
          <i class="fa-regular fa-clock"></i> ${timeStr}
        </div>
        <div class="lesson-break-title" style="font-weight: 700; font-size: 1.1rem; color: green; text-transform: uppercase; letter-spacing: 0.5px;">
          <i class="fa-solid fa-mug-hot"></i> ${escapeHTML(breakName)}
        </div>
      </div>
    `;
  }

  // Render Regular Class Card
  let secondaryLabel = "";
  if (roleContext === "student") {
    secondaryLabel = `<div class="lesson-teacher"><i class="fa-solid fa-user-tie"></i> ${escapeHTML(teacherName)}</div>`;
  } else if (roleContext === "teacher") {
    const className = item.timetable?.class?.name || "Class -";
    secondaryLabel = `<div class="lesson-teacher"><i class="fa-solid fa-graduation-cap"></i> ${escapeHTML(className)}</div>`;
  }

  return `
    <div class="lesson-card-item">
      <div class="lesson-time"><i class="fa-regular fa-clock"></i> ${timeStr}</div>
      <div class="lesson-subject">${escapeHTML(subjectName)}</div>
      ${secondaryLabel}
    </div>
  `;
}
/**
 * Render Empty State Placeholder
 */
function renderEmptyState(message) {
  const container = document.getElementById("timetableCardsGrid");
  if (!container) return;

  container.innerHTML = `
    <div class="empty-state">
      <i class="fa-solid fa-calendar-xmark" style="font-size: 2.5rem; margin-bottom: 12px; color: #94a3b8;"></i>
      <p>${escapeHTML(message)}</p>
    </div>
  `;
}

// Global store to keep loaded lessons in memory for instant client-side filtering
let allCurrentLessons = [];

async function setupTimetableFilters(schoolId) {
  const yearSelect = document.getElementById("filterTimetableAcademicYear");
  const daySelect = document.getElementById("filterTimetableDays");

  // 1. Populate Days Dropdown
  if (daySelect && daySelect.options.length <= 1) {
    daySelect.innerHTML = '<option value="">All Days</option>';
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
    days.forEach((day) => {
      const opt = document.createElement("option");
      opt.value = day;
      opt.textContent = day;
      daySelect.appendChild(opt);
    });
  }

  // 2. Fetch Academic Years from Supabase
  if (yearSelect && schoolId) {
    const { data: years, error } = await supabaseClient
      .from("academic_years")
      .select("*")
      .eq("school_id", schoolId);

    if (error) {
      console.error("Error fetching academic_years:", error);
      return;
    }

    if (years && yearSelect) {
      yearSelect.innerHTML = '<option value="">All Academic Years</option>';

      years.forEach((yr) => {
        const yrName = yr.name || yr.year_label || yr.title || "Academic Year";
        const isActive = yr.is_active || yr.status?.toLowerCase() === "active";

        const opt = document.createElement("option");
        opt.value = yr.id;
        opt.textContent = isActive ? `${yrName}` : yrName;
        if (isActive) opt.selected = true;
        yearSelect.appendChild(opt);
      });
    }
  }

  // 3. Attach Filter Listeners
  if (yearSelect) {
    yearSelect.removeEventListener("change", applyTimetableFilters);
    yearSelect.addEventListener("change", applyTimetableFilters);
  }
  if (daySelect) {
    daySelect.removeEventListener("change", applyTimetableFilters);
    daySelect.addEventListener("change", applyTimetableFilters);
  }
}

/**
 * Filter Loaded Lessons & Trigger Re-render
 */
function applyTimetableFilters() {
  const selectedYearId = document.getElementById(
    "filterTimetableAcademicYear",
  )?.value;
  const selectedDay = document.getElementById("filterTimetableDays")?.value;

  let filtered = [...allCurrentLessons];

  // Filter by Academic Year
  if (selectedYearId) {
    filtered = filtered.filter((lesson) => {
      // Check direct property, nested timetable object, or activeTimetable fallback
      const lessonYearId =
        lesson.academic_year_id || lesson.timetable?.academic_year_id;
      return !lessonYearId || lessonYearId === selectedYearId;
    });
  }

  // Filter by Day of Week
  if (selectedDay) {
    filtered = filtered.filter(
      (lesson) =>
        lesson.day_of_week?.toLowerCase() === selectedDay.toLowerCase(),
    );
  }

  // Re-render schedule cards
  renderScheduleCards(filtered, currentUserRole);
}
