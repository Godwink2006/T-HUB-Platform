(() => {
  // Application State
  const state = {
    lessons: [],
    timetableId: null,
    schoolId: null,
    editingLessonId: null,
    lookups: {
      classes: [],
      years: [],
      subjects: [],
      periods: [],
      teachers: [],
    },
  };

  const getEl = (id) => document.getElementById(id);
  const supabaseClient = window.supabaseClient || window.supabase;

  /* ==========================================================================
     1. UTILITIES & MODAL CONTROLS
     ========================================================================== */
  function escapeHTML(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function showModal(modal) {
    if (!modal) return;
    modal.style.display = "flex";
    modal.style.visibility = "visible";
    modal.style.opacity = "1";
    modal.classList.add("active");
  }

  function hideModal(modal) {
    if (!modal) return;
    modal.style.display = "none";
    modal.style.visibility = "hidden";
    modal.style.opacity = "0";
    modal.classList.remove("active");
  }

  function showToast(message, type = "info") {
    console.log(`[${type.toUpperCase()}] ${message}`);
  }

  function resetForm(formId) {
    const form = getEl(formId);
    if (form) form.reset();
  }

  /* ==========================================================================
     2. AUTHENTICATION & SCHOOL CONTEXT
     ========================================================================== */
  async function fetchUserProfileAndSchool() {
    try {
      if (!supabaseClient) throw new Error("Supabase client missing.");

      const {
        data: { user },
        error: authErr,
      } = await supabaseClient.auth.getUser();
      if (authErr || !user) throw new Error("Authentication required");

      const { data: profile, error: profileErr } = await supabaseClient
        .from("profiles")
        .select("school_id")
        .eq("id", user.id)
        .single();

      if (profileErr) throw profileErr;
      state.schoolId = profile.school_id;
      return profile.school_id;
    } catch (err) {
      console.error("Auth initialization failed:", err.message);
      showToast("Failed to authenticate user context.", "error");
      return null;
    }
  }

  /* ==========================================================================
     3. DROPDOWNS & FORM HELPERS
     ========================================================================== */
  async function loadDropdownData() {
    try {
      const [
        { data: classes },
        { data: years },
        { data: subjects },
        { data: periods },
        { data: teachers },
      ] = await Promise.all([
        supabaseClient
          .from("classes")
          .select("id, name")
          .eq("school_id", state.schoolId)
          .eq("status", "active"),

        supabaseClient
          .from("academic_years")
          .select("id, year_label")
          .eq("school_id", state.schoolId)
          .eq("status", "Active"),

        supabaseClient
          .from("subjects")
          .select("id, name")
          .eq("school_id", state.schoolId)
          .eq("status", "Active"),

        supabaseClient
          .from("periods")
          .select("id, name, start_time, end_time")
          .eq("school_id", state.schoolId)
          .eq("status", "Active"),

        supabaseClient
          .from("profiles")
          .select("id, full_name")
          .eq("school_id", state.schoolId)
          .eq("role", "teacher")
          .eq("status", "active"),
      ]);

      state.lookups = {
        classes: classes || [],
        years: years || [],
        subjects: subjects || [],
        periods: periods || [],
        teachers: teachers || [],
      };

      populateSelectOptions(
        "timetableClassSelect",
        state.lookups.classes,
        "id",
        "name",
      );
      populateSelectOptions(
        "timetableYearSelect",
        state.lookups.years,
        "id",
        "year_label",
      );
      populateSelectOptions(
        "addLessonSubject",
        state.lookups.subjects,
        "id",
        "name",
      );
      populateSelectOptions(
        "editLessonSubject",
        state.lookups.subjects,
        "id",
        "name",
      );
      populateSelectOptions(
        "addLessonTeacher",
        state.lookups.teachers,
        "id",
        "full_name",
      );
      populateSelectOptions(
        "editLessonTeacher",
        state.lookups.teachers,
        "id",
        "full_name",
      );

      populatePeriodOptions("addLessonPeriod", state.lookups.periods);
      populatePeriodOptions("editLessonPeriod", state.lookups.periods);
    } catch (err) {
      console.error("Failed loading dropdowns:", err);
      showToast("Error loading interface dropdowns.", "error");
    }
  }

  function populateSelectOptions(elementId, items, valueKey, labelKey) {
    const select = getEl(elementId);
    if (!select) return;

    let html = `<option value="">Select option...</option>`;
    items.forEach((item) => {
      html += `<option value="${escapeHTML(item[valueKey])}">${escapeHTML(item[labelKey])}</option>`;
    });
    select.innerHTML = html;
  }

  function populatePeriodOptions(elementId, periods) {
    const select = getEl(elementId);
    if (!select) return;

    let html = `<option value="">Select period...</option>`;
    periods.forEach((p) => {
      html += `<option value="${escapeHTML(p.id)}" data-time="${escapeHTML(p.start_time)} - ${escapeHTML(p.end_time)}">${escapeHTML(p.name)} (${escapeHTML(p.start_time)} - ${escapeHTML(p.end_time)})</option>`;
    });
    select.innerHTML = html;
  }

  function setupPeriodTimeDisplay(selectId, displayId) {
    const select = getEl(selectId);
    const display = getEl(displayId);
    select?.addEventListener("change", (e) => {
      const selectedOption = e.target.options[e.target.selectedIndex];
      const timeRange = selectedOption?.dataset?.time || "--:--";
      if (display) display.textContent = timeRange;
    });
  }

  function extractLessonFormData(prefix) {
    const day = getEl(`${prefix}Day`)?.value || "";
    const subjectId = getEl(`${prefix}Subject`)?.value || "";
    const periodId = getEl(`${prefix}Period`)?.value || "";
    const teacherId = getEl(`${prefix}Teacher`)?.value || "";

    const subjectObj = state.lookups.subjects.find((s) => s.id === subjectId);
    const teacherObj = state.lookups.teachers.find((t) => t.id === teacherId);
    const periodObj = state.lookups.periods.find((p) => p.id === periodId);

    return {
      day,
      subject_id: subjectId,
      subject_name: subjectObj ? subjectObj.name : "N/A",
      period_id: periodId,
      time: periodObj
        ? `${periodObj.start_time} - ${periodObj.end_time}`
        : "N/A",
      teacher_id: teacherId,
      teacher_name: teacherObj ? teacherObj.full_name : "N/A",
      status: "Active",
    };
  }

  function populateEditFormValues(lesson) {
    const setVal = (id, val) => {
      const el = getEl(id);
      if (el) el.value = val || "";
    };

    setVal("editLessonDay", lesson.day);
    setVal("editLessonSubject", lesson.subject_id);
    setVal("editLessonPeriod", lesson.period_id);
    setVal("editLessonTeacher", lesson.teacher_id);
  }

  /* ==========================================================================
     4. DATA RENDERING & TABLES
     ========================================================================== */
  function renderLessonsTable() {
    const tbody =
      getEl("timetableLessonsTbody") ||
      document.querySelector(".timetables-table-card tbody");
    if (!tbody) return;

    tbody.innerHTML = "";

    if (state.lessons.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">No lessons added yet.</td></tr>`;
      return;
    }

    state.lessons.forEach((lesson) => {
      const tr = document.createElement("tr");
      tr.dataset.id = lesson.id;
      tr.innerHTML = `
        <td>${escapeHTML(lesson.day || "N/A")}</td>
        <td>${escapeHTML(lesson.time || "N/A")}</td>
        <td>${escapeHTML(lesson.subject_name || "N/A")}</td>
        <td>${escapeHTML(lesson.teacher_name || "N/A")}</td>
        <td><span class="timetables-status-active">${escapeHTML(lesson.status || "Active")}</span></td>
        <td>
          <button type="button" class="timetables-actions-btn edit-lesson" title="Edit">
            <i class="fa-solid fa-pen"></i>
          </button>
          <button type="button" class="timetables-actions-btn delete-lesson" title="Delete">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  async function loadTimetables() {
    const tbody = getEl("timetablesTableBody");
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;">Loading timetables...</td></tr>`;

    try {
      if (!state.schoolId) return;

      const { data: timetables, error } = await supabaseClient
        .from("timetables")
        .select(
          `
          id,
          status,
          is_archived,
          classes ( id, name ),
          academic_years ( id, year_label )
        `,
        )
        .eq("school_id", state.schoolId)
        .eq("is_archived", false)
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (!timetables || timetables.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;">No timetables found.</td></tr>`;
        return;
      }

      tbody.innerHTML = timetables
        .map((item) => {
          const className = item.classes?.name || "N/A";
          const yearLabel = item.academic_years?.year_label || "N/A";
          const isStatusActive = (item.status || "").toLowerCase() === "active";
          const statusClass = isStatusActive
            ? "timetables-status-active"
            : "timetables-status-inactive";

          return `
            <tr data-timetable-id="${escapeHTML(item.id)}">
              <td>${escapeHTML(className)}</td>
              <td>${escapeHTML(yearLabel)}</td>
              <td>
                <span class="${statusClass}">${escapeHTML(item.status || "Inactive")}</span>
              </td>
              <td>
                <button class="timetables-actions-btn view" data-id="${escapeHTML(item.id)}" title="View">
                  <i class="fa-solid fa-eye"></i>
                </button>
                <button class="timetables-actions-btn edit" data-id="${escapeHTML(item.id)}" title="Edit">
                  <i class="fa-solid fa-pen"></i>
                </button>
                <button class="timetables-actions-btn archive" data-id="${escapeHTML(item.id)}" title="Archive">
                  <i class="fa-solid fa-box-archive"></i>
                </button>
              </td>
            </tr>
          `;
        })
        .join("");
    } catch (err) {
      console.error("Failed to load timetables:", err.message);
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#dc2626;">Failed to load data. ${escapeHTML(err.message)}</td></tr>`;
    }
  }

  /* ==========================================================================
     5. EVENT BINDINGS & INITIALIZATION
     ========================================================================== */
  function bindEvents() {
    // Open Main Timetable Modal
    document.addEventListener("click", (e) => {
      const createTrigger = e.target.closest(
        "#createTimetableBtn, .create-timetable-btn, #addTimetable, .add-timetables-btn",
      );
      if (createTrigger) {
        e.preventDefault();
        state.timetableId = null;
        state.lessons = [];
        resetForm("timetableForm");
        renderLessonsTable();
        showModal(getEl("timetableModal"));
      }
    });

    // Open Add Lesson Modal
    const addLessonBtn = getEl("addLessonBtn");
    addLessonBtn?.addEventListener("click", (e) => {
      e.preventDefault();
      resetForm("addLessonForm");
      showModal(getEl("lessonModal"));
    });

    // Close Timetable Modal
    [getEl("closeTimetableModal"), getEl("cancelTimetableModalBtn")].forEach(
      (btn) => {
        btn?.addEventListener("click", () =>
          hideModal(getEl("timetableModal")),
        );
      },
    );

    // Close Add Lesson Modal
    [getEl("closeLessonModalHeaderBtn"), getEl("cancelLessonModalBtn")].forEach(
      (btn) => {
        btn?.addEventListener("click", () => hideModal(getEl("lessonModal")));
      },
    );

    // Close Edit Lesson Modal
    [
      getEl("closeEditLessonModalHeaderBtn"),
      getEl("cancelEditLessonModalBtn"),
    ].forEach((btn) => {
      btn?.addEventListener("click", () => hideModal(getEl("editLessonModal")));
    });

    // Save Lesson Button
    const saveLessonBtn = getEl("saveLessonBtn");
    saveLessonBtn?.addEventListener("click", () => {
      const lessonData = extractLessonFormData("addLesson");

      if (
        !lessonData.day ||
        !lessonData.subject_id ||
        !lessonData.period_id ||
        !lessonData.teacher_id
      ) {
        showToast("Please fill out all required fields.", "error");
        return;
      }

      state.lessons.push({ id: crypto.randomUUID(), ...lessonData });
      renderLessonsTable();
      hideModal(getEl("lessonModal"));
      resetForm("addLessonForm");
    });

    // Lessons Table Actions (Edit & Delete)
    const tbody =
      getEl("timetableLessonsTbody") ||
      document.querySelector(".timetables-table-card tbody");
    tbody?.addEventListener("click", (e) => {
      const editBtn = e.target.closest(".edit-lesson");
      const deleteBtn = e.target.closest(".delete-lesson");
      const tr = e.target.closest("tr");
      if (!tr) return;

      const lessonId = tr.dataset.id;

      if (deleteBtn) {
        state.lessons = state.lessons.filter((l) => l.id !== lessonId);
        renderLessonsTable();
      }

      if (editBtn) {
        state.editingLessonId = lessonId;
        const lesson = state.lessons.find((l) => l.id === lessonId);
        if (lesson) {
          populateEditFormValues(lesson);
          showModal(getEl("editLessonModal"));
        }
      }
    });

    // Update Lesson Button
    const updateLessonBtn = getEl("updateLessonBtn");
    updateLessonBtn?.addEventListener("click", () => {
      if (!state.editingLessonId) return;

      const updatedData = extractLessonFormData("editLesson");

      if (
        !updatedData.day ||
        !updatedData.subject_id ||
        !updatedData.period_id ||
        !updatedData.teacher_id
      ) {
        showToast("Please fill out all required fields.", "error");
        return;
      }

      state.lessons = state.lessons.map((l) =>
        l.id === state.editingLessonId ? { ...l, ...updatedData } : l,
      );

      renderLessonsTable();
      hideModal(getEl("editLessonModal"));
      state.editingLessonId = null;
    });

    // Save Timetable Form
    const timetableForm = getEl("timetableForm");
    timetableForm?.addEventListener("submit", async (e) => {
      e.preventDefault();

      const classId = getEl("timetableClassSelect")?.value;
      const yearId = getEl("timetableYearSelect")?.value;
      const statusVal = getEl("timetableStatusSelect")?.value || "Active";

      if (!classId || !yearId) {
        showToast("Please select both a class and an academic year.", "error");
        return;
      }

      const payload = {
        p_timetable_id: state.timetableId || null,
        p_school_id: state.schoolId,
        p_class_id: classId,
        p_academic_year_id: yearId,
        p_status: statusVal,
        p_lessons: state.lessons.map((l) => ({
          day_of_week: l.day,
          subject_id: l.subject_id,
          period_id: l.period_id,
          teacher_id: l.teacher_id,
        })),
      };

      try {
        const { error } = await supabaseClient.rpc(
          "save_timetable_with_lessons",
          payload,
        );
        if (error) throw error;

        showToast("Timetable saved successfully!", "success");
        hideModal(getEl("timetableModal"));
        state.lessons = [];
        state.timetableId = null;
        resetForm("timetableForm");
        await loadTimetables();
      } catch (err) {
        console.error("Save error:", err.message);
        showToast("Failed to save timetable: " + err.message, "error");
      }
    });

    // Setup dynamic time label behavior
    setupPeriodTimeDisplay("addLessonPeriod", "addLessonTimeDisplay");
    setupPeriodTimeDisplay("editLessonPeriod", "editLessonTimeDisplay");
  }

  async function initApp() {
    bindEvents();
    await fetchUserProfileAndSchool();
    if (state.schoolId) {
      await loadDropdownData();
      await loadTimetables();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initApp);
  } else {
    initApp();
  }
})();
async function getActiveSchoolId() {
  try {
    const supabaseClient = window.supabaseClient || window.supabase;
    if (!supabaseClient) throw new Error("Supabase client not initialized.");

    const {
      data: { user },
      error: authErr,
    } = await supabaseClient.auth.getUser();
    if (authErr || !user) throw new Error("User not authenticated.");

    const { data: profile, error: profileErr } = await supabaseClient
      .from("profiles")
      .select("school_id")
      .eq("id", user.id)
      .single();

    if (profileErr) throw profileErr;
    return profile?.school_id || null;
  } catch (err) {
    console.error("Error fetching school ID:", err.message);
    return null;
  }
}
async function handleViewTimetable(timetableId) {
  const modal = document.getElementById("viewTimetableModal");
  if (!modal) return;

  modal.style.display = "flex";
  modal.classList.add("active", "show", "open");

  const classLabel = document.getElementById("viewClassLabel");
  const yearLabel = document.getElementById("viewYearLabel");
  const gridBody = document.getElementById("viewTimetableGridBody");

  if (classLabel) classLabel.textContent = "Loading...";
  if (yearLabel) yearLabel.textContent = "Loading...";
  if (gridBody) {
    gridBody.innerHTML = `<tr><td colspan="6" style="text-align:center;">Loading timetable details...</td></tr>`;
  }

  try {
    const supabaseClient = window.supabaseClient || window.supabase;

    const [
      { data: timetable, error: ttError },
      { data: lessons, error: lError },
    ] = await Promise.all([
      supabaseClient
        .from("timetables")
        .select("id, classes(name), academic_years(year_label)")
        .eq("id", timetableId)
        .single(),

      supabaseClient
        .from("timetable_lessons")
        .select(
          `
      id,
      day_of_week,
      period_id,
      periods ( id, name, start_time, end_time ),
      subjects ( name ),
      teacher:profiles!teacher_id ( full_name )
    `,
        )
        .eq("timetable_id", timetableId),
    ]);

    if (ttError) throw ttError;
    if (lError) throw lError;

    if (classLabel) classLabel.textContent = timetable.classes?.name || "N/A";
    if (yearLabel)
      yearLabel.textContent = timetable.academic_years?.year_label || "N/A";

    const lessonList = lessons || [];

    if (lessonList.length === 0) {
      if (gridBody) {
        gridBody.innerHTML = `<tr><td colspan="6" style="text-align:center;">No lessons added to this timetable yet.</td></tr>`;
      }
      return;
    }

    // Extract unique periods from the retrieved timetable_lessons and sort them by start time
    const periodMap = new Map();
    lessonList.forEach((lesson) => {
      if (lesson.periods && !periodMap.has(lesson.periods.id)) {
        periodMap.set(lesson.periods.id, lesson.periods);
      }
    });

    const activePeriods = Array.from(periodMap.values()).sort((a, b) =>
      (a.start_time || "").localeCompare(b.start_time || ""),
    );

    const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

    if (gridBody) {
      gridBody.innerHTML = activePeriods
        .map((period) => {
          const isBreak =
            (period.period_type || period.type || "").toLowerCase() === "break";
          const startTime = period.start_time
            ? period.start_time.slice(0, 5)
            : "--:--";
          const endTime = period.end_time
            ? period.end_time.slice(0, 5)
            : "--:--";
          const timeLabel = `${startTime} - ${endTime}`;

          if (isBreak) {
            return `
              <tr>
                <td>${escapeHTML(timeLabel)}</td>
                <td colspan="5" class="break-row" style="text-align:center; font-weight:bold; background-color: #f1f5f9;">
                  ${escapeHTML(period.name || "Break Time")}
                </td>
              </tr>
            `;
          }

          const dayCellsHtml = daysOfWeek
            .map((day) => {
              const lesson = lessonList.find(
                (l) =>
                  l.period_id === period.id &&
                  (l.day_of_week || "").toLowerCase() === day.toLowerCase(),
              );

              if (lesson) {
                const subjectName = lesson.subjects?.name || "Subject";
                const teacherName = lesson.teacher?.full_name || "";
                return `
                  <td>
                    <div style="font-weight:600;">${escapeHTML(subjectName)}</div>
                    ${teacherName ? `<small style="color:#64748b;">${escapeHTML(teacherName)}</small>` : ""}
                  </td>
                `;
              }

              return `<td style="color:#cbd5e1; text-align:center;">-</td>`;
            })
            .join("");

          return `
            <tr>
              <td><strong>${escapeHTML(timeLabel)}</strong></td>
              ${dayCellsHtml}
            </tr>
          `;
        })
        .join("");
    }
  } catch (err) {
    console.error("Failed to load timetable view:", err.message);
    if (gridBody) {
      gridBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#dc2626;">Failed to display timetable: ${escapeHTML(err.message)}</td></tr>`;
    }
  }
}
function closeViewModal() {
  const modal = document.getElementById("viewTimetableModal");
  if (modal) {
    modal.style.display = "none";
    modal.classList.remove("active", "show", "open");
  }
}

// Close Triggers
document
  .getElementById("closeViewTimetableModal")
  ?.addEventListener("click", closeViewModal);
document
  .getElementById("closeViewBtn")
  ?.addEventListener("click", closeViewModal);

// Close on Backdrop/Overlay Click
window.addEventListener("click", (e) => {
  const modal = document.getElementById("viewTimetableModal");
  if (e.target === modal) {
    closeViewModal();
  }
});

// Delegate Table Actions
document
  .getElementById("timetablesTableBody")
  ?.addEventListener("click", (e) => {
    const viewBtn = e.target.closest(".timetables-actions-btn.view");
    const editBtn = e.target.closest(".timetables-actions-btn.edit");
    const archiveBtn = e.target.closest(".timetables-actions-btn.archive");

    if (viewBtn) {
      const timetableId = viewBtn.getAttribute("data-id");
      if (timetableId) handleViewTimetable(timetableId);
    } else if (editBtn) {
      const timetableId = editBtn.getAttribute("data-id");
      if (typeof handleEditTimetable === "function")
        handleEditTimetable(timetableId);
    } else if (archiveBtn) {
      const timetableId = archiveBtn.getAttribute("data-id");
      if (typeof handleArchiveTimetable === "function")
        handleArchiveTimetable(timetableId);
    }
  });
