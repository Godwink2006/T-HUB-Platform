function hideModal(modal) {
  if (!modal) return;
  modal.style.display = "none";
  modal.style.visibility = "hidden";
  modal.style.opacity = "0";
  modal.classList.remove("active");
}

(() => {
  // Application State
  const state = {
    lessons: [],
    editLessons: [],
    timetableId: null,
    editingTimetableId: null,
    schoolId: null,
    editingLessonId: null,
    isEditModalContext: false,
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
    const isBreak = getEl(`${prefix}IsBreak`)?.checked || false;
    const periodId = getEl(`${prefix}Period`)?.value || "";
    const periodObj = state.lookups.periods.find((p) => p.id === periodId);

    // If "Is Break" is checked, bypass day, subject, and teacher selections
    if (isBreak) {
      return {
        day: "All",
        is_break: true,
        subject_id: null,
        subject_name: "BREAK",
        period_id: periodId,
        time: periodObj
          ? `${periodObj.start_time} - ${periodObj.end_time}`
          : "N/A",
        teacher_id: null,
        teacher_name: "-",
        status: "Active",
      };
    }

    // Regular lesson extraction
    const day = getEl(`${prefix}Day`)?.value || "";
    const subjectId = getEl(`${prefix}Subject`)?.value || "";
    const teacherId = getEl(`${prefix}Teacher`)?.value || "";

    const subjectObj = state.lookups.subjects.find((s) => s.id === subjectId);
    const teacherObj = state.lookups.teachers.find((t) => t.id === teacherId);

    return {
      day,
      is_break: false,
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
      document.querySelector("#timetableModal .timetables-table-card tbody");
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

  function renderEditLessonsTable() {
    const tbody = getEl("editTimetableLessonsTbody");
    if (!tbody) return;

    tbody.innerHTML = "";

    if (state.editLessons.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">No lessons available.</td></tr>`;
      return;
    }

    state.editLessons.forEach((lesson) => {
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

  async function openEditTimetableModal(timetableId) {
    try {
      state.editingTimetableId = timetableId;

      // 1. Fetch Timetable metadata from 'timetables'
      const { data: timetable, error: ttErr } = await supabaseClient
        .from("timetables")
        .select("id, status, class_id, academic_year_id")
        .eq("id", timetableId)
        .single();

      if (ttErr) throw ttErr;

      // Map Class Name and Academic Year Label from preloaded lookups
      const classObj = state.lookups.classes.find(
        (c) => c.id === timetable.class_id,
      );
      const yearObj = state.lookups.years.find(
        (y) => y.id === timetable.academic_year_id,
      );

      const classEl = getEl("editModalClassName");
      const yearEl = getEl("editModalYearLabel");
      const statusSelect = getEl("editTimetableStatusSelect");

      if (classEl) classEl.textContent = classObj ? classObj.name : "N/A";
      if (yearEl) yearEl.textContent = yearObj ? yearObj.year_label : "N/A";
      if (statusSelect) statusSelect.value = timetable.status || "Active";

      // 2. Query 'timetable_lessons' without selecting 'status'
      const { data: lessons, error: lessonsErr } = await supabaseClient
        .from("timetable_lessons")
        .select("id, day_of_week, subject_id, period_id, teacher_id")
        .eq("timetable_id", timetableId);

      if (lessonsErr) throw lessonsErr;

      // Map lessons with lookup data
      state.editLessons = (lessons || []).map((l) => {
        const subjectObj = state.lookups.subjects.find(
          (s) => s.id === l.subject_id,
        );
        const periodObj = state.lookups.periods.find(
          (p) => p.id === l.period_id,
        );
        const teacherObj = state.lookups.teachers.find(
          (t) => t.id === l.teacher_id,
        );

        return {
          id: l.id,
          day: l.day_of_week,
          subject_id: l.subject_id,
          subject_name: subjectObj ? subjectObj.name : "N/A",
          period_id: l.period_id,
          time: periodObj
            ? `${periodObj.start_time} - ${periodObj.end_time}`
            : "N/A",
          teacher_id: l.teacher_id,
          teacher_name: teacherObj ? teacherObj.full_name : "N/A",
          status: timetable.status || "Active",
        };
      });

      renderEditLessonsTable();
      showModal(getEl("editTimetableModal"));
    } catch (err) {
      console.error("Error opening edit modal:", err);
      showToast(
        `Failed: ${err.message || "Could not load timetable details."}`,
        "error",
      );
    }
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
    // Open Main Timetable Creation Modal
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

      const editTrigger = e.target.closest(".timetables-actions-btn.edit");
      if (editTrigger) {
        e.preventDefault();
        e.stopPropagation();

        const timetableId =
          editTrigger.dataset.id ||
          editTrigger.closest("tr")?.dataset?.timetableId;

        if (timetableId && timetableId !== "undefined") {
          openEditTimetableModal(timetableId);
        }
      }

      // 2. Archive Button Handler
      const archiveTrigger = e.target.closest(
        ".timetables-actions-btn.archive",
      );
      if (archiveTrigger) {
        e.preventDefault();
        e.stopPropagation();
        const timetableId =
          archiveTrigger.dataset.id ||
          archiveTrigger.closest("tr")?.dataset?.timetableId;
        if (timetableId && timetableId !== "undefined") {
          openArchiveTimetableModal(timetableId);
        }
        return;
      }
    });

    // Add Lesson Triggers
    getEl("addLessonBtn")?.addEventListener("click", (e) => {
      e.preventDefault();
      state.isEditModalContext = false;
      resetForm("addLessonForm");
      showModal(getEl("lessonModal"));
    });

    getEl("addLessonEditBtn")?.addEventListener("click", (e) => {
      e.preventDefault();
      state.isEditModalContext = true;
      resetForm("addLessonForm");
      showModal(getEl("lessonModal"));
    });

    // Close Timetable Creation Modal
    [getEl("closeTimetableModal"), getEl("cancelTimetableModalBtn")].forEach(
      (btn) => {
        btn?.addEventListener("click", () =>
          hideModal(getEl("timetableModal")),
        );
      },
    );

    // Close Edit Timetable Modal
    [
      getEl("closeEditTimetableModal"),
      getEl("cancelEditTimetableModal"),
    ].forEach((btn) => {
      btn?.addEventListener("click", () =>
        hideModal(getEl("editTimetableModal")),
      );
    });

    // Close Add/Edit Lesson Secondary Modals
    [getEl("closeLessonModalHeaderBtn"), getEl("cancelLessonModalBtn")].forEach(
      (btn) => {
        btn?.addEventListener("click", () => hideModal(getEl("lessonModal")));
      },
    );

    [
      getEl("closeEditLessonModalHeaderBtn"),
      getEl("cancelEditLessonModalBtn"),
    ].forEach((btn) => {
      btn?.addEventListener("click", () => hideModal(getEl("editLessonModal")));
    });

    // Save Lesson Button (Adds to local state)
    getEl("saveLessonBtn")?.addEventListener("click", () => {
      const lessonData = extractLessonFormData("addLesson");

      // FIX 1: If it's a break, only period_id is strictly required
      const isValid = lessonData.is_break
        ? Boolean(lessonData.period_id)
        : Boolean(
            lessonData.day &&
            lessonData.subject_id &&
            lessonData.period_id &&
            lessonData.teacher_id,
          );

      if (!isValid) {
        showToast("Please fill out all required fields.", "error");
        return;
      }

      const newLesson = { id: crypto.randomUUID(), ...lessonData };

      if (state.isEditModalContext) {
        state.editLessons.push(newLesson);
        renderEditLessonsTable();
      } else {
        state.lessons.push(newLesson);
        renderLessonsTable();
      }

      hideModal(getEl("lessonModal"));
      resetForm("addLessonForm");
    });

    // Lesson Table Row Actions - Create Modal
    getEl("timetableLessonsTbody")?.addEventListener("click", (e) => {
      handleLessonTableActions(e, state.lessons, renderLessonsTable);
    });

    // Lesson Table Row Actions - Edit Modal
    getEl("editTimetableLessonsTbody")?.addEventListener("click", (e) => {
      handleLessonTableActions(e, state.editLessons, renderEditLessonsTable);
    });

    function handleLessonTableActions(e, lessonList, renderFn) {
      const editBtn = e.target.closest(".edit-lesson");
      const deleteBtn = e.target.closest(".delete-lesson");
      const tr = e.target.closest("tr");
      if (!tr) return;

      const lessonId = tr.dataset.id;

      if (deleteBtn) {
        const index = lessonList.findIndex((l) => l.id === lessonId);
        if (index !== -1) {
          lessonList.splice(index, 1);
          renderFn();
        }
      }

      if (editBtn) {
        state.editingLessonId = lessonId;
        const lesson = lessonList.find((l) => l.id === lessonId);
        if (lesson) {
          populateEditFormValues(lesson);
          showModal(getEl("editLessonModal"));
        }
      }
    }

    // Update Individual Lesson Item Modal
    getEl("updateLessonBtn")?.addEventListener("click", () => {
      if (!state.editingLessonId) return;

      const updatedData = extractLessonFormData("editLesson");

      // FIX 2: Check validation based on whether it is marked as a break
      const isValid = updatedData.is_break
        ? Boolean(updatedData.period_id)
        : Boolean(
            updatedData.day &&
            updatedData.subject_id &&
            updatedData.period_id &&
            updatedData.teacher_id,
          );

      if (!isValid) {
        showToast("Please fill out all required fields.", "error");
        return;
      }

      let targetList = state.lessons.some((l) => l.id === state.editingLessonId)
        ? state.lessons
        : state.editLessons;

      const index = targetList.findIndex((l) => l.id === state.editingLessonId);
      if (index !== -1) {
        targetList[index] = { ...targetList[index], ...updatedData };
      }

      renderLessonsTable();
      renderEditLessonsTable();
      hideModal(getEl("editLessonModal"));
      state.editingLessonId = null;
    });

    // Submit Create Timetable Form
    getEl("timetableForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();

      const classId = getEl("timetableClassSelect")?.value;
      const yearId = getEl("timetableYearSelect")?.value;
      const statusVal = getEl("timetableStatusSelect")?.value || "Active";

      if (
        !state.schoolId ||
        !classId ||
        !yearId ||
        state.lessons.length === 0
      ) {
        showToast(
          "Please complete all required fields and add at least one lesson.",
          "error",
        );
        return;
      }

      // FIX 3: Update payload for create form to properly format break entries
      const payload = {
        p_timetable_id: state.timetableId || null,
        p_school_id: state.schoolId,
        p_class_id: classId,
        p_academic_year_id: yearId,
        p_status: statusVal,
        p_lessons: state.lessons.map((l) => ({
          day_of_week: l.is_break ? "All" : l.day,
          period_id: l.period_id,
          is_break: l.is_break || false,
          subject_id: l.is_break ? null : l.subject_id,
          teacher_id: l.is_break ? null : l.teacher_id,
        })),
      };

      try {
        const { error } = await supabaseClient.rpc(
          "save_timetable_with_lessons",
          payload,
        );
        if (error) throw error;

        showToast("Timetable created successfully!", "success");
        hideModal(getEl("timetableModal"));
        state.lessons = [];
        resetForm("timetableForm");
        await loadTimetables();
      } catch (err) {
        showToast(err.message || "Failed to save timetable.", "error");
      }
    });

    // Submit Edit Timetable Form
    getEl("editTimetableForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();

      if (!state.editingTimetableId || !state.schoolId) {
        showToast("Context missing. Cannot update timetable.", "error");
        return;
      }

      if (state.editLessons.length === 0) {
        showToast("Please add at least one lesson before updating.", "error");
        return;
      }

      const statusVal = getEl("editTimetableStatusSelect")?.value || "Active";

      const payload = {
        p_timetable_id: state.editingTimetableId,
        p_school_id: state.schoolId,
        p_status: statusVal,
        p_lessons: state.editLessons.map((l) => ({
          id: l.id && l.id.includes("-") ? l.id : null,
          day_of_week: l.is_break ? "All" : l.day,
          period_id: l.period_id,
          is_break: l.is_break || false,
          subject_id: l.is_break ? null : l.subject_id,
          teacher_id: l.is_break ? null : l.teacher_id,
          status: l.status || "Active",
        })),
      };

      const submitBtn = getEl("editTimetableForm").querySelector(
        "button[type='submit']",
      );
      if (submitBtn) submitBtn.disabled = true;

      try {
        const { error } = await supabaseClient.rpc(
          "update_timetable_with_lessons",
          payload,
        );

        if (error) {
          showToast(`Error (${error.code}): ${error.message}`, "error");
          return;
        }

        showToast("Timetable updated successfully!", "success");
        hideModal(getEl("editTimetableModal"));
        state.editLessons = [];
        state.editingTimetableId = null;
        await loadTimetables();
      } catch (err) {
        showToast("Unexpected error while updating timetable.", "error");
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });

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

  // State variables to track target timetable
  let archivingTimetableId = null;

  /**
   * Open Archive Modal & Display Class Name
   */
  async function openArchiveTimetableModal(timetableId) {
    try {
      archivingTimetableId = timetableId;

      // 1. Fetch timetable record to get class_id
      const { data: timetable, error } = await supabaseClient
        .from("timetables")
        .select("id, class_id")
        .eq("id", timetableId)
        .single();

      if (error) throw error;

      // 2. Resolve class name from lookups
      const classObj = state.lookups.classes.find(
        (c) => c.id === timetable.class_id,
      );
      const className = classObj ? classObj.name : "this class";

      // 3. Update modal text
      const classSpan = document.getElementById("editArchiveClassName");
      if (classSpan) {
        classSpan.textContent = className;
      }

      // 4. Show modal
      showModal(document.getElementById("archiveTimetableModal"));
    } catch (err) {
      console.error("Error opening archive modal:", err);
      showToast(
        `Failed: ${err.message || "Could not open archive dialog."}`,
        "error",
      );
    }
  }

  /**
   * Perform Archive & Set Status to 'Inactive'
   */
  async function handleConfirmArchive() {
    if (!archivingTimetableId) return;

    const confirmBtn = document.getElementById("confirmArchiveTimetable");
    if (confirmBtn) confirmBtn.disabled = true;

    try {
      // Update timetable status to 'Inactive' and flag is_archived as true
      const { error } = await supabaseClient
        .from("timetables")
        .update({
          status: "Inactive",
          is_archived: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", archivingTimetableId);

      if (error) throw error;

      showToast("Timetable archived successfully!", "success");
      hideModal(getEl("archiveTimetableModal"));

      // Reload list to reflect changes
      if (typeof loadTimetables === "function") {
        await loadTimetables();
      }
    } catch (err) {
      console.error("Error archiving timetable:", err);
      showToast(`Failed to archive: ${err.message}`, "error");
    } finally {
      if (confirmBtn) confirmBtn.disabled = false;
      archivingTimetableId = null;
    }
  }

  // Attach Event Listeners
  document
    .getElementById("confirmArchiveTimetable")
    ?.addEventListener("click", handleConfirmArchive);
  document
    .getElementById("cancelArchiveTimetable")
    ?.addEventListener("click", () => {
      hideModal(getEl("archiveTimetableModal"));
      archivingTimetableId = null;
    });
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

      // UPDATE 1: Added is_break to the query payload
      supabaseClient
        .from("timetable_lessons")
        .select(
          `
      id,
      day_of_week,
      is_break,
      period_id,
      periods ( id, name, start_time, end_time),
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
          // UPDATE 2: Check for break record in lessonList or period structure
          const breakLesson = lessonList.find(
            (l) =>
              l.period_id === period.id &&
              (l.is_break || l.day_of_week === "All"),
          );

          const isBreak =
            Boolean(breakLesson) ||
            (period.period_type || period.type || "").toLowerCase() ===
              "break" ||
            (period.name || "").toLowerCase().includes("break");

          const startTime = period.start_time
            ? period.start_time.slice(0, 5)
            : "--:--";
          const endTime = period.end_time
            ? period.end_time.slice(0, 5)
            : "--:--";
          const timeLabel = `${startTime} - ${endTime}`;

          if (isBreak) {
            const breakTitle =
              breakLesson?.subjects?.name || period.name || "BREAK";
            return `
              <tr class="break-row">
                <td style="font-weight:600; background-color:#f8fafc;">${escapeHTML(timeLabel)}</td>
                <td colspan="5" style="text-align:center; font-weight:bold; background-color: #f1f5f9; color:#475569; letter-spacing:1.5px; text-transform:uppercase;">
                  ${escapeHTML(breakTitle)}
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

// Close on Backdrop/Overlay Click for all modals
window.addEventListener("click", (e) => {
  const modalIds = [
    "viewTimetableModal",
    "timetableModal",
    "editTimetableModal",
    "lessonModal",
    "editLessonModal",
    "archiveTimetableModal",
  ];

  modalIds.forEach((id) => {
    const modal = document.getElementById(id);
    if (modal && e.target === modal) {
      if (id === "viewTimetableModal" && typeof closeViewModal === "function") {
        closeViewModal();
      } else {
        hideModal(modal);
      }
    }
  });
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
