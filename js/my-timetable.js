document.addEventListener("DOMContentLoaded", async () => {
  await initMyTimetable();

  document
    .getElementById("printTimetableBtn")
    ?.addEventListener("click", () => {
      window.print();
    });
});
async function initMyTimetable() {
  try {
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      renderEmptyState("User session not found. Please log in.");
      return;
    }

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

      await loadStudentClassSchedule(
        studentData.class_id,
        studentData.school_id || schoolId,
      );

      await setupTimetableFilters(studentData.school_id || schoolId);
    } else if (role === "teacher") {
      const { data: teacherData } = await supabaseClient
        .from("teachers")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();

      const teacherId = teacherData?.id || user.id;
      await loadTeacherPersonalSchedule(teacherId);

      await setupTimetableFilters(schoolId);
    } else {
      renderEmptyState("Timetable access is not available for your role.");
    }
  } catch (err) {
    console.error("Timetable Load Error:", err);
    renderEmptyState("Failed to load timetable schedule.");
  }
}

async function loadStudentClassSchedule(classId, schoolId) {
  if (!classId) {
    renderEmptyState("You are not assigned to any class yet.");
    return;
  }

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

  const { data: timetableTeachers, error: teachersError } =
    await supabaseClient.rpc("student_timetable_teacher_names", {
      p_class_id: classId,
    });

  if (teachersError) {
    console.warn("Timetable teacher names unavailable:", teachersError);
  }

  const teacherProfilesMap = new Map(
    (timetableTeachers || []).map((teacher) => [teacher.teacher_id, teacher]),
  );

  let teacherName = "Not Assigned";
  const classTeacher = (timetableTeachers || []).find(
    (teacher) => teacher.is_class_teacher,
  );
  if (classTeacher?.full_name) {
    teacherName = classTeacher.full_name;
  }

  const classTeacherEl = document.getElementById("classTeacherDisplay");
  if (classTeacherEl) {
    classTeacherEl.textContent = teacherName;
  }

  document.getElementById("classMetaBanner")?.classList.remove("hidden");

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
    renderEmptyState("No timetable found.");
    return;
  }

  const { data: rawLessons, error: lessonsErr } = await supabaseClient
    .from("timetable_lessons")
    .select("id, day_of_week, is_break, subject_id, teacher_id, period_id")
    .eq("timetable_id", activeTimetable.id);

  if (lessonsErr || !rawLessons || rawLessons.length === 0) {
    console.error("Lessons Fetch Error:", lessonsErr);
    renderEmptyState("No timetable found.");
    return;
  }

  const [subjectsRes, periodsRes] = await Promise.all([
    supabaseClient.from("subjects").select("id, name"),
    supabaseClient.from("periods").select("id, name, start_time, end_time"),
  ]);

  const subjectsMap = new Map((subjectsRes.data || []).map((s) => [s.id, s]));
  const periodsMap = new Map((periodsRes.data || []).map((p) => [p.id, p]));

  const formattedLessons = rawLessons.map((lesson) => {
    const subjectObj = subjectsMap.get(lesson.subject_id);
    const periodObj = periodsMap.get(lesson.period_id);
    const teacherProfile = teacherProfilesMap.get(lesson.teacher_id);

    const isBreak = Boolean(
      lesson.is_break === true ||
      lesson.is_break === "true" ||
      (!lesson.subject_id && !subjectObj),
    );

    const breakDisplayName = periodObj?.name || "BREAK";

    return {
      ...lesson,
      is_break: isBreak,
      subject: subjectObj
        ? { name: subjectObj.name }
        : { name: breakDisplayName },
      teacher: { full_name: teacherProfile?.full_name || "-" },
      period: periodObj || { start_time: null, end_time: null },
    };
  });

  const breakSlots = formattedLessons
    .filter((l) => l.is_break)
    .map((l) => {
      const start = l.period?.start_time?.slice(0, 5);
      const end = l.period?.end_time?.slice(0, 5);
      const name = l.period?.name || l.subject?.name || "Break";
      if (start && end) return `${name} (${start}–${end})`;
      return name;
    });
  const uniqueBreaks = [...new Set(breakSlots)];
  const breaksEl = document.getElementById("classBreaksDisplay");
  if (breaksEl) {
    breaksEl.textContent = uniqueBreaks.length
      ? uniqueBreaks.join(" · ")
      : "None";
  }

  allCurrentLessons = formattedLessons;
}

async function loadTeacherPersonalSchedule(teacherId) {
  document.getElementById("classMetaBanner")?.classList.add("hidden");
  document.getElementById("timetableSubtitle").textContent =
    "Your personal weekly teaching schedule";

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

  allCurrentLessons = formattedLessons;
}

function renderScheduleCards(lessons, roleContext) {
  const container = document.getElementById("timetableCardsGrid");
  if (!container) return;

  const selectedDay = document.getElementById("filterTimetableDays")?.value;
  const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

  const activeDays = selectedDay
    ? daysOfWeek.filter(
        (day) => day.toLowerCase() === selectedDay.toLowerCase(),
      )
    : daysOfWeek;

  const groupedLessons = activeDays.reduce((acc, day) => {
    acc[day] = lessons.filter(
      (l) => l.day_of_week === day || l.day_of_week === "All",
    );

    acc[day].sort((a, b) => {
      const timeA = a.period?.start_time || "00:00";
      const timeB = b.period?.start_time || "00:00";
      return timeA.localeCompare(timeB);
    });

    return acc;
  }, {});

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
                ? `<div class="empty-state" style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 5rem 2rem; min-height: 250px; text-align: center; color: #64748b;">
  <i class="fa-solid fa-calendar-days" style="font-size: 5rem; margin-bottom: 1rem; color: #cbd5e1; display: block;"></i>
  <span style="font-size: 1.1rem; font-weight: 600; color: #334155;">No classes scheduled</span>
</div>`
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

function renderLessonCardItem(item, roleContext) {
  const timeStr =
    item.period?.start_time && item.period?.end_time
      ? `${item.period.start_time.slice(0, 5)} - ${item.period.end_time.slice(0, 5)}`
      : "--:--";

  const isBreak = Boolean(
    item.is_break === true ||
    item.is_break === "true" ||
    (!item.subject_id && !item.subject?.name),
  );

  const subjectName = isBreak
    ? item.period?.name || item.subject?.name || "Break"
    : item.subject?.name || "";

  let secondaryLabel = "";
  if (!isBreak) {
    if (roleContext === "student") {
      const teacherName = item.teacher?.full_name || "—";
      secondaryLabel = `<div class="lesson-teacher"><i class="fa-solid fa-user-tie"></i> ${escapeHTML(teacherName)}</div>`;
    } else if (roleContext === "teacher") {
      const className =
        item.timetable?.class?.name || item.class?.name || "Class —";
      secondaryLabel = `<div class="lesson-teacher"><i class="fa-solid fa-graduation-cap"></i> ${escapeHTML(className)}</div>`;
    }
  }

  return `
    <div class="lesson-card-item">
      <div class="lesson-time"><i class="fa-regular fa-clock"></i> ${timeStr}</div>
      <div class="lesson-subject">${escapeHTML(subjectName)}</div>
      ${secondaryLabel}
    </div>
  `;
}

function renderEmptyState(message) {
  const container = document.getElementById("timetableCardsGrid");
  if (!container) return;

  container.innerHTML = `
    <div class="empty-state">
      <i class="fa-solid fa-calendar-xmark" style="font-size: 5.5rem; margin-bottom: 12px; color: #94a3b8;"></i>
      <p>${escapeHTML(message)}</p>
    </div>
  `;
}

let allCurrentLessons = [];

async function setupTimetableFilters(schoolId) {
  const daySelect = document.getElementById("filterTimetableDays");

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
  const applyButton = document.getElementById("applyMyTimetableFilters");
  if (applyButton) {
    applyButton.removeEventListener("click", applyTimetableFilters);
    applyButton.addEventListener("click", applyTimetableFilters);
  }

  if (allCurrentLessons.length) {
    const container = document.getElementById("timetableCardsGrid");
    if (container) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="fa-solid fa-calendar-days" aria-hidden="true"></i>
          <p>Choose a day, then select View timetable.</p>
        </div>`;
    }
  }
}

function applyTimetableFilters() {
  const selectedDay = document.getElementById("filterTimetableDays")?.value;

  let filtered = allCurrentLessons.filter(
    (lesson) => currentUserRole !== "student" || !lesson.is_break,
  );

  if (selectedDay) {
    filtered = filtered.filter(
      (lesson) =>
        lesson.day_of_week?.toLowerCase() === selectedDay.toLowerCase() ||
        lesson.day_of_week?.toLowerCase() === "all",
    );
  }

  renderScheduleCards(filtered, currentUserRole);
}
