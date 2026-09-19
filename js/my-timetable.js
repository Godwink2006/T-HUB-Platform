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

/**
 * Main initialization router
 */
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

    // 2. Fetch user profile role
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      console.error("Profile Fetch Error:", profileError);
      throw new Error("Could not retrieve user profile.");
    }

    const role = profile.role?.toLowerCase();

    // 3. Route based on Role
    if (role === "student") {
      // Query students table directly using 'id' equal to authenticated user id
      const { data: studentData, error: studentErr } = await supabaseClient
        .from("students")
        .select("class_id")
        .eq("id", user.id)
        .maybeSingle();

      if (studentErr) console.error("Student fetch error:", studentErr);

      if (!studentData?.class_id) {
        renderEmptyState("You are not currently assigned to a class.");
        return;
      }

      await loadStudentClassSchedule(studentData.class_id);
    } else if (role === "teacher") {
      // Fetch teacher record linked to user
      const { data: teacherData } = await supabaseClient
        .from("teachers")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();

      const teacherId = teacherData?.id || user.id;
      await loadTeacherPersonalSchedule(teacherId);
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
async function loadStudentClassSchedule(classId) {
  if (!classId) {
    renderEmptyState("You are not assigned to any class yet.");
    return;
  }

  // 1. Fetch Class details
  const { data: classData, error: classErr } = await supabaseClient
    .from("classes")
    .select("name")
    .eq("id", classId)
    .maybeSingle();

  if (classErr) console.warn("Class details fetch warning:", classErr);

  const subtitle = document.getElementById("timetableSubtitle");
  if (subtitle) {
    subtitle.textContent = `Weekly class schedule for ${classData?.name || "your class"}`;
  }

  // 2. Fetch Active Timetable record
  const { data: timetables, error: ttErr } = await supabaseClient
    .from("timetables")
    .select("id, status")
    .eq("class_id", classId)
    .order("created_at", { ascending: false });

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

  // 3. Fetch raw lessons
  const { data: rawLessons, error: lessonsErr } = await supabaseClient
    .from("timetable_lessons")
    .select("id, day_of_week, is_break, subject_id, teacher_id, period_id")
    .eq("timetable_id", activeTimetable.id);

  if (lessonsErr || !rawLessons || rawLessons.length === 0) {
    console.error("Lessons Fetch Error:", lessonsErr);
    renderEmptyState("No active timetable found for your class.");
    return;
  }

  // 4. Fetch lookup tables directly without intermediate steps
  const [subjectsRes, profilesRes, periodsRes] = await Promise.all([
    supabaseClient.from("subjects").select("id, name"),
    supabaseClient.from("profiles").select("id, full_name"),
    supabaseClient.from("periods").select("id, name, start_time, end_time"),
  ]);

  // Create fast lookup maps
  const subjectsMap = new Map((subjectsRes.data || []).map((s) => [s.id, s]));
  const profilesMap = new Map((profilesRes.data || []).map((p) => [p.id, p]));
  const periodsMap = new Map((periodsRes.data || []).map((p) => [p.id, p]));

  // 5. Format lessons for rendering
  const formattedLessons = rawLessons.map((lesson) => {
    const subjectObj = subjectsMap.get(lesson.subject_id);
    const periodObj = periodsMap.get(lesson.period_id);
    const profileObj = profilesMap.get(lesson.teacher_id);

    return {
      ...lesson,
      subject: subjectObj ? { name: subjectObj.name } : { name: "Subject N/A" },
      teacher: { full_name: profileObj?.full_name || "Teacher Unassigned" },
      period: periodObj || { start_time: null, end_time: null },
    };
  });

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
    .eq("teacher_id", teacherId);

  if (error || !lessons || lessons.length === 0) {
    renderEmptyState("You have no assigned teaching periods.");
    return;
  }

  renderScheduleCards(lessons, "teacher");
}

/**
 * Render Day Cards (Monday -> Friday)
 */
function renderScheduleCards(lessons, roleContext) {
  const container = document.getElementById("timetableCardsGrid");
  if (!container) return;

  const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

  // Group lessons by Day
  const groupedLessons = daysOfWeek.reduce((acc, day) => {
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

  // Build HTML Cards
  container.innerHTML = daysOfWeek
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
  const timeStr = item.period
    ? `${item.period.start_time.slice(0, 5)} - ${item.period.end_time.slice(0, 5)}`
    : "--:--";

  // Handle Break / Interval
  if (item.is_break) {
    return `
      <div class="lesson-card-item is-break">
        <div class="lesson-time"><i class="fa-regular fa-clock"></i> ${timeStr}</div>
        <div class="lesson-subject"><i class="fa-solid fa-mug-hot"></i> Break / Interval</div>
      </div>
    `;
  }

  const subjectName = item.subject?.name || "Subject N/A";

  // Display Teacher Name for Students, or Class Name for Teachers
  let secondaryLabel = "";
  if (roleContext === "student") {
    const teacherName =
      item.teacher?.full_name || item.teacher?.name || "Teacher Unassigned";
    secondaryLabel = `<div class="lesson-teacher"><i class="fa-solid fa-user-tie"></i> ${escapeHTML(teacherName)}</div>`;
  } else if (roleContext === "teacher") {
    const className = item.timetable?.class?.name || "Class N/A";
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
