function hideModal(modal) {
  if (!modal) return;
  modal.style.display = "none";
  modal.style.visibility = "hidden";
  modal.style.opacity = "0";
  modal.classList.remove("active");
}

function getTeacherStaffId(profile) {
  const teacherDetails = Array.isArray(profile?.teachers)
    ? profile.teachers[0]
    : profile?.teachers;
  return teacherDetails?.staff_id || "No ID found";
}

const DRAFT_KEY = "draft_timetable_lessons";

function saveDraftToStorage(lessons) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(lessons));
  } catch (e) {
    console.error("Failed to write to LocalStorage:", e);
  }
}

function clearDraftStorage() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch (e) {
    console.error("Failed to clear LocalStorage:", e);
  }
}

(() => {
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

  async function loadDropdownData() {
    try {
      const [
        { data: classes },
        { data: years },
        { data: periods },
        { data: teachers },
        { data: subjects },
        { data: teacherAssignments },
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
          .from("periods")
          .select("id, name, start_time, end_time")
          .eq("school_id", state.schoolId)
          .eq("status", "Active"),

        supabaseClient
          .from("profiles")
          .select("id, full_name, teachers(staff_id)")
          .eq("school_id", state.schoolId)
          .eq("role", "teacher")
          .eq("status", "active"),

        supabaseClient
          .from("subjects")
          .select("id, name")
          .eq("school_id", state.schoolId)
          .eq("status", "Active"),

        supabaseClient
          .from("teacher_assignments")
          .select("id, teacher_id, class_id, subject_id")
          .eq("school_id", state.schoolId)
          .eq("status", "active"),
      ]);

      state.teacherAssignments = teacherAssignments || [];
      state.lookups = {
        classes: classes || [],
        years: years || [],
        periods: periods || [],
        teachers: teachers || [],
        subjects: subjects || [],
      };

      const assignedClassIds = new Set(
        state.teacherAssignments.map((ta) => ta.class_id),
      );
      const assignedClasses = state.lookups.classes.filter((c) =>
        assignedClassIds.has(c.id),
      );

      populateSelectOptions(
        "timetableClassSelect",
        assignedClasses,
        "id",
        "name",
      );
      populateSelectOptions(
        "timetableYearSelect",
        state.lookups.years,
        "id",
        "year_label",
      );

      populatePeriodOptions("addLessonPeriod", state.lookups.periods);
      populatePeriodOptions("editLessonPeriod", state.lookups.periods);
    } catch (err) {
      console.error("Failed loading dropdowns:", err);
      showToast("Error loading interface dropdowns.", "error");
    }
  }

  function getSelectedClassId() {
    if (state.isEditModalContext && state.editingTimetableClassId) {
      return state.editingTimetableClassId;
    }
    return getEl("timetableClassSelect")?.value || null;
  }

  function updateCascadingDropdowns(prefix) {
    const classId = getSelectedClassId();
    const teacherSelect = getEl(`${prefix}Teacher`);
    const subjectSelect = getEl(`${prefix}Subject`);

    if (!teacherSelect || !subjectSelect) return;

    const currentTeacherId = teacherSelect.value;
    const currentSubjectId = subjectSelect.value;

    if (!classId) {
      populateSelectOptions(`${prefix}Teacher`, [], "id", "full_name");
      populateSelectOptions(`${prefix}Subject`, [], "id", "name");
      return;
    }

    const classAssignments = state.teacherAssignments.filter(
      (ta) => ta.class_id === classId,
    );

    let validAssignmentsForTeachers = classAssignments;
    if (currentSubjectId) {
      validAssignmentsForTeachers = classAssignments.filter(
        (ta) => ta.subject_id === currentSubjectId,
      );
    }

    const validTeacherIds = new Set(
      validAssignmentsForTeachers.map((ta) => ta.teacher_id),
    );
    const availableTeachers = state.lookups.teachers.filter((t) =>
      validTeacherIds.has(t.id),
    );

    let validAssignmentsForSubjects = classAssignments;
    if (currentTeacherId) {
      validAssignmentsForSubjects = classAssignments.filter(
        (ta) => ta.teacher_id === currentTeacherId,
      );
    }

    const validSubjectIds = new Set(
      validAssignmentsForSubjects.map((ta) => ta.subject_id),
    );
    const availableSubjects = state.lookups.subjects.filter((s) =>
      validSubjectIds.has(s.id),
    );

    populateSelectOptions(
      `${prefix}Teacher`,
      availableTeachers,
      "id",
      "full_name",
      (teacher) =>
        `${teacher.full_name || "Teacher"} (Staff ID: ${getTeacherStaffId(teacher)})`,
    );
    teacherSelect.value = validTeacherIds.has(currentTeacherId)
      ? currentTeacherId
      : "";

    populateSelectOptions(`${prefix}Subject`, availableSubjects, "id", "name");
    subjectSelect.value = validSubjectIds.has(currentSubjectId)
      ? currentSubjectId
      : "";
  }

  function bindCascadingEvents() {
    getEl("timetableClassSelect")?.addEventListener("change", () => {
      updateCascadingDropdowns("addLesson");
      updateCascadingDropdowns("editLesson");
    });

    getEl("addLessonTeacher")?.addEventListener("change", () =>
      updateCascadingDropdowns("addLesson"),
    );
    getEl("addLessonSubject")?.addEventListener("change", () =>
      updateCascadingDropdowns("addLesson"),
    );

    getEl("editLessonTeacher")?.addEventListener("change", () =>
      updateCascadingDropdowns("editLesson"),
    );
    getEl("editLessonSubject")?.addEventListener("change", () =>
      updateCascadingDropdowns("editLesson"),
    );
  }

  function populateSelectOptions(
    elementId,
    items,
    valueKey,
    labelKey,
    labelFormatter = (item) => item[labelKey],
  ) {
    const select = getEl(elementId);
    if (!select) return;

    let html = `<option value="">Select option...</option>`;
    items.forEach((item) => {
      html += `<option value="${escapeHTML(item[valueKey])}">${escapeHTML(labelFormatter(item))}</option>`;
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

  function resolveLessonDisplayData(lesson) {
    if (lesson.is_break) {
      const period = state.lookups?.periods?.find(
        (p) => p.id === lesson.period_id,
      );
      const timeStr = period
        ? `${period.start_time.slice(0, 5)} - ${period.end_time.slice(0, 5)}`
        : lesson.time || "-";

      return {
        day: "All",
        time: timeStr,
        subject: `<span class="badge bg-secondary">Break / Recess</span>`,
        teacher: "-",
        isBreak: true,
      };
    }

    const period = state.lookups?.periods?.find(
      (p) => p.id === lesson.period_id,
    );
    const subject = state.lookups?.subjects?.find(
      (s) => s.id === lesson.subject_id,
    );
    const teacher = state.lookups?.teachers?.find(
      (t) => t.id === lesson.teacher_id,
    );

    const timeStr = period
      ? `${period.start_time.slice(0, 5)} - ${period.end_time.slice(0, 5)}`
      : lesson.time || "N/A";

    const subjectName = subject
      ? subject.name
      : lesson.subject_name || lesson.subject || "N/A";

    const teacherName = teacher
      ? teacher.full_name || teacher.name
      : lesson.teacher_name || lesson.teacher || "N/A";
    const teacherStaffId = teacher ? getTeacherStaffId(teacher) : "No ID found";

    return {
      day: lesson.day || "N/A",
      time: timeStr,
      subject: escapeHTML(subjectName),
      teacher: `
        <span class="timetable-teacher">
          <span>${escapeHTML(teacherName)}</span>
          <small>Staff ID: ${escapeHTML(teacherStaffId)}</small>
        </span>
      `,
      isBreak: false,
    };
  }

  function renderLessonsTable() {
    const tbody =
      getEl("timetableLessonsTbody") ||
      document.querySelector("#timetableModal .timetables-table-card tbody");
    if (!tbody) return;

    tbody.innerHTML = "";

    if (!state.lessons || state.lessons.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">No lessons added yet.</td></tr>`;
      return;
    }

    state.lessons.forEach((lesson) => {
      const display = resolveLessonDisplayData(lesson);
      const tr = document.createElement("tr");
      tr.dataset.id = lesson.id;

      tr.innerHTML = `
      <td>${escapeHTML(display.day)}</td>
      <td>${escapeHTML(display.time)}</td>
      <td>${display.subject}</td>
      <td>${display.teacher}</td>
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

    if (!state.editLessons || state.editLessons.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">No lessons available.</td></tr>`;
      return;
    }

    state.editLessons.forEach((lesson) => {
      const display = resolveLessonDisplayData(lesson);
      const tr = document.createElement("tr");
      tr.dataset.id = lesson.id;

      tr.innerHTML = `
      <td>${escapeHTML(display.day)}</td>
      <td>${escapeHTML(display.time)}</td>
      <td>${display.subject}</td>
      <td>${display.teacher}</td>
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

      const { data: timetable, error: ttErr } = await supabaseClient
        .from("timetables")
        .select("id, status, class_id, academic_year_id, academic_years(id, year_label)")
        .eq("id", timetableId)
        .single();

      if (ttErr) throw ttErr;

      state.editingTimetableClassId = timetable.class_id;

      const classObj = state.lookups.classes.find(
        (c) => c.id === timetable.class_id,
      );
  const yearObj =
  timetable.academic_years ||
  state.lookups.years.find((y) => y.id === timetable.academic_year_id);

  const classEl = getEl("editModalClassName");
      const yearEl = getEl("editModalYearLabel");
      const statusSelect = getEl("editTimetableStatusSelect");

      if (classEl) classEl.textContent = classObj ? classObj.name : "-";
      if (yearEl) yearEl.textContent = yearObj ? yearObj.year_label : "-";
      if (statusSelect) statusSelect.value = timetable.status || "Active";

      const { data: lessons, error: lessonsErr } = await supabaseClient
        .from("timetable_lessons")
        .select("id, day_of_week, subject_id, period_id, teacher_id")
        .eq("timetable_id", timetableId);

      if (lessonsErr) throw lessonsErr;

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
          subject_name: subjectObj ? subjectObj.name : "-",
          period_id: l.period_id,
          time: periodObj
            ? `${periodObj.start_time} - ${periodObj.end_time}`
            : "-",
          teacher_id: l.teacher_id,
          teacher_name: teacherObj ? teacherObj.full_name : "-",
          status: timetable.status || "Active",
        };
      });

      state.initialEditStatus = timetable.status;
      state.initialEditLessons = JSON.parse(JSON.stringify(state.editLessons));

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
          classes ( id, name ),
          academic_years ( id, year_label )
        `,
        )
        .eq("school_id", state.schoolId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      cachedTimetables = timetables || [];

      populateAcademicYearFilterOptions(cachedTimetables);

      renderTimetablesTable(cachedTimetables);

      if (!timetables || timetables.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;">No timetables found.</td></tr>`;
        return;
      }

      tbody.innerHTML = timetables
        .map((item) => {
          const className = item.classes?.name || "-";
          const yearLabel = item.academic_years?.year_label || "-";
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

  function bindEvents() {
    document.addEventListener("click", (e) => {
      const createTrigger = e.target.closest(
        "#createTimetableBtn, .create-timetable-btn, #addTimetable, .add-timetables-btn",
      );
      if (createTrigger) {
        e.preventDefault();
        state.timetableId = null;
        state.lessons = [];
        clearDraftStorage();
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

    });

    getEl("addLessonBtn")?.addEventListener("click", (e) => {
      e.preventDefault();
      state.isEditModalContext = false;
      resetForm("addLessonForm");

      if (getEl("addLessonTeacher")) getEl("addLessonTeacher").value = "";
      if (getEl("addLessonSubject")) getEl("addLessonSubject").value = "";

      updateCascadingDropdowns("addLesson");
      showModal(getEl("lessonModal"));
    });

    getEl("addLessonEditBtn")?.addEventListener("click", (e) => {
      e.preventDefault();
      state.isEditModalContext = true;
      resetForm("addLessonForm");

      if (getEl("addLessonTeacher")) getEl("addLessonTeacher").value = "";
      if (getEl("addLessonSubject")) getEl("addLessonSubject").value = "";

      updateCascadingDropdowns("addLesson");
      showModal(getEl("lessonModal"));
    });

    [getEl("closeTimetableModal"), getEl("cancelTimetableModalBtn")].forEach(
      (btn) => {
        btn?.addEventListener("click", () =>
          hideModal(getEl("timetableModal")),
        );
      },
    );

    [
      getEl("closeEditTimetableModal"),
      getEl("cancelEditTimetableModal"),
    ].forEach((btn) => {
      btn?.addEventListener("click", () =>
        hideModal(getEl("editTimetableModal")),
      );
    });

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

    getEl("saveLessonBtn")?.addEventListener("click", () => {
      const lessonData = extractLessonFormData("addLesson");

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
        saveDraftToStorage(state.lessons);
      }

      hideModal(getEl("lessonModal"));

      resetForm("addLessonForm");
      if (getEl("addLessonTeacher")) getEl("addLessonTeacher").value = "";
      if (getEl("addLessonSubject")) getEl("addLessonSubject").value = "";
    });

    getEl("timetableLessonsTbody")?.addEventListener("click", (e) => {
      handleLessonTableActions(e, state.lessons, renderLessonsTable);
    });

    getEl("editTimetableLessonsTbody")?.addEventListener("click", (e) => {
      handleLessonTableActions(e, state.editLessons, renderEditLessonsTable, true);
    });

    function handleLessonTableActions(e, lessonList, renderFn, isEditContext) {
      const editBtn = e.target.closest(".edit-lesson");
      const deleteBtn = e.target.closest(".delete-lesson");
      const tr = e.target.closest("tr");
      if (!tr) return;

      const lessonId = tr.dataset.id;
      const rowIndex = Array.from(tr.parentNode.children).indexOf(tr);

      // Prefer ID-based lookup; fall back to row index only for locally-added rows with no saved ID
      const index = (targetIndex !== -1) ? targetIndex : (lessonId ? -1 : rowIndex);

      if (index === -1 || !lessonList[index]) return;

      if (deleteBtn) {
        lessonList.splice(index, 1);
        renderFn();
        if (lessonList === state.lessons) {
          saveDraftToStorage(state.lessons);
        }
      }

      if (editBtn) {
        const lesson = lessonList[index];

        state.editingLessonIndex = index;
        state.editingLessonId = lesson.id || null;
        state.isEditModalContext = isEditContext;

        if (typeof updateCascadingDropdowns === "function") {
          updateCascadingDropdowns("editLesson");
        }

        populateEditFormValues(lesson);
        showModal(getEl("editLessonModal"));
      }
    }

    getEl("updateLessonBtn")?.addEventListener("click", () => {
      if (
        state.editingLessonIndex === null ||
        state.editingLessonIndex === undefined
      )
        return;

      const updatedData = extractLessonFormData("editLesson");

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

      const targetList = state.isEditModalContext
        ? state.editLessons
        : state.lessons;

      if (targetList[state.editingLessonIndex]) {
        targetList[state.editingLessonIndex] = {
          ...targetList[state.editingLessonIndex],
          ...updatedData,
        };
      }

      if (state.isEditModalContext) {
        renderEditLessonsTable();
      } else {
        renderLessonsTable();
        saveDraftToStorage(state.lessons);
      }

      hideModal(getEl("editLessonModal"));
      state.editingLessonIndex = null;
      state.editingLessonId = null;
    });

    function updatePeriodTimeLabel(selectEl, displayEl) {
      if (!selectEl || !displayEl) return;

      const selectedOption = selectEl.options[selectEl.selectedIndex];
      if (!selectedOption || !selectedOption.value) {
        displayEl.textContent = "--:--";
        return;
      }

      let timeText = selectedOption.dataset?.time;

      if (!timeText) {
        const match = selectedOption.textContent.match(/\((.*?)\)/);
        if (match && match[1]) {
          timeText = match[1];
        }
      }

      displayEl.textContent = timeText || "--:--";
    }

    function setupPeriodTimeDisplay(selectId, displayId) {
      const select = getEl(selectId);
      const display = getEl(displayId);

      if (!select || !display) return;

      select.addEventListener("change", () => {
        updatePeriodTimeLabel(select, display);
      });
    }

    function ensureDropdownOptionsExist(prefix) {
      const subjectSelect =
        getEl(`${prefix}SubjectSelect`) || getEl(`${prefix}Subject`);
      const teacherSelect =
        getEl(`${prefix}TeacherSelect`) || getEl(`${prefix}Teacher`);

      if (
        subjectSelect &&
        subjectSelect.options.length <= 1 &&
        state.lookups?.subjects
      ) {
        subjectSelect.innerHTML =
          `<option value="">Select option...</option>` +
          state.lookups.subjects
            .map(
              (s) =>
                `<option value="${escapeHTML(s.id)}">${escapeHTML(s.name)}</option>`,
            )
            .join("");
      }

      if (
        teacherSelect &&
        teacherSelect.options.length <= 1 &&
        state.lookups?.teachers
      ) {
        teacherSelect.innerHTML =
          `<option value="">Select option...</option>` +
          state.lookups.teachers
            .map(
              (t) =>
                `<option value="${escapeHTML(t.id)}">${escapeHTML(t.full_name || t.name)} (Staff ID: ${escapeHTML(getTeacherStaffId(t))})</option>`,
            )
            .join("");
      }
    }

    function populateEditFormValues(lesson) {
      const isBreak = Boolean(lesson.is_break);

      ensureDropdownOptionsExist("editLesson");

      const daySelect = getEl("editLessonDaySelect") || getEl("editLessonDay");
      const periodSelect =
        getEl("editLessonPeriodSelect") || getEl("editLessonPeriod");
      const subjectSelect =
        getEl("editLessonSubjectSelect") || getEl("editLessonSubject");
      const teacherSelect =
        getEl("editLessonTeacherSelect") || getEl("editLessonTeacher");
      const isBreakCheckbox =
        getEl("editLessonIsBreakCheckbox") || getEl("editLessonIsBreak");

      if (isBreakCheckbox) isBreakCheckbox.checked = isBreak;
      if (periodSelect) periodSelect.value = lesson.period_id || "";

      if (daySelect) {
        daySelect.disabled = isBreak;
        daySelect.value = isBreak ? "All" : lesson.day || "Monday";
      }

      if (subjectSelect) {
        subjectSelect.disabled = isBreak;
        subjectSelect.value = isBreak ? "" : lesson.subject_id || "";
      }

      if (teacherSelect) {
        teacherSelect.disabled = isBreak;
        teacherSelect.value = isBreak ? "" : lesson.teacher_id || "";
      }

      const editTimeDisplay =
        getEl("editLessonTimeDisplay") || getEl("editTimeDisplay");
      updatePeriodTimeLabel(periodSelect, editTimeDisplay);
    }

    function extractLessonFormData(prefix) {
      const isBreak =
        getEl(`${prefix}IsBreakCheckbox`)?.checked ||
        getEl(`${prefix}IsBreak`)?.checked ||
        false;

      return {
        day: isBreak
          ? "All"
          : getEl(`${prefix}DaySelect`)?.value ||
            getEl(`${prefix}Day`)?.value ||
            "",
        period_id:
          getEl(`${prefix}PeriodSelect`)?.value ||
          getEl(`${prefix}Period`)?.value ||
          "",
        subject_id: isBreak
          ? null
          : getEl(`${prefix}SubjectSelect`)?.value ||
            getEl(`${prefix}Subject`)?.value ||
            null,
        teacher_id: isBreak
          ? null
          : getEl(`${prefix}TeacherSelect`)?.value ||
            getEl(`${prefix}Teacher`)?.value ||
            null,
        is_break: isBreak,
      };
    }

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

      const submitBtn = getEl("timetableForm")?.querySelector(
        'button[type="submit"]',
      );
      const originalBtnText = submitBtn ? submitBtn.innerHTML : "Save";

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `Saving...`;
      }

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

        state.lessons = [];
        clearDraftStorage();

        hideModal(getEl("timetableModal"));
        resetForm("timetableForm");
        await loadTimetables();
      } catch (err) {
        showToast(err.message || "Failed to save timetable.", "error");
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalBtnText;
        }
      }
    });

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

      const hasStatusChanged =
        statusVal !== (state.initialEditStatus || "Active");
      const currentLessonsJSON = JSON.stringify(state.editLessons);
      const initialLessonsJSON = JSON.stringify(state.initialEditLessons || []);
      const hasLessonsChanged = currentLessonsJSON !== initialLessonsJSON;

      if (!hasStatusChanged && !hasLessonsChanged) {
        showToast("No changes detected.", "info");
        return;
      }

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

      const submitBtn = getEl("editTimetableForm")?.querySelector(
        "button[type='submit']",
      );
      const originalBtnText = submitBtn ? submitBtn.innerHTML : "Update";

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Updating...";
      }

      try {
        const { error } = await supabaseClient.rpc(
          "update_timetable_with_lessons",
          payload,
        );

        if (error) {
          let customMessage = error.message;

          if (customMessage.includes("Failed to update timetable:")) {
            customMessage = customMessage
              .replace("Failed to update timetable:", "")
              .trim();
          }

          if (
            error.code === "23P02" ||
            customMessage.includes("Teacher Conflict")
          ) {
            showToast(
              "Teacher Conflict: A selected teacher is already booked for another class during this period.",
              "error",
            );
            return;
          }

          if (
            error.code === "23P03" ||
            customMessage.includes("Invalid lesson")
          ) {
            showToast(
              "Assignment Error: Teacher is not actively assigned to teach this subject for this class.",
              "error",
            );
            return;
          }

          showToast(`Error: ${customMessage}`, "error");
          return;
        }

        showToast("Timetable updated successfully!", "success");

        state.editLessons = [];
        state.initialEditLessons = [];
        state.editingTimetableId = null;
        clearDraftStorage();

        hideModal(getEl("editTimetableModal"));
        await loadTimetables();
      } catch (err) {
        showToast("Unexpected error while updating timetable.", "error");
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalBtnText;
        }
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
      bindCascadingEvents();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initApp);
  } else {
    initApp();
  }

  let cachedTimetables = [];

  function applyTimetableFilters() {
    const searchQuery = (getEl("timetableSearchInput")?.value || "")
      .toLowerCase()
      .trim();
    const selectedYearId = getEl("academicYearFilter")?.value || "";
    const selectedStatus = (getEl("statusFilter")?.value || "")
      .toLowerCase()
      .trim();

    const filtered = cachedTimetables.filter((item) => {
      const className = (item.classes?.name || "").toLowerCase();
      const yearLabel = (item.academic_years?.year_label || "").toLowerCase();
      const yearId = item.academic_years?.id || "";
      const status = (item.status || "inactive").toLowerCase();

      const matchesSearch =
        !searchQuery ||
        className.includes(searchQuery) ||
        yearLabel.includes(searchQuery);

      const matchesYear = !selectedYearId || yearId === selectedYearId;

      const matchesStatus = !selectedStatus || status === selectedStatus;

      return matchesSearch && matchesYear && matchesStatus;
    });

    renderTimetablesTable(filtered);
  }

  function renderTimetablesTable(list) {
    const tbody = getEl("timetablesTableBody");
    if (!tbody) return;

    if (!list || list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;">No timetables found.</td></tr>`;
      return;
    }

    tbody.innerHTML = list
      .map((item) => {
        const className = item.classes?.name || "-";
        const yearLabel = item.academic_years?.year_label || "-";
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
          </td>
        </tr>
      `;
      })
      .join("");
  }

  function populateAcademicYearFilterOptions(timetables) {
    const yearSelect = getEl("academicYearFilter");
    if (!yearSelect) return;

    const currentSelection = yearSelect.value;

    const yearMap = new Map();
    timetables.forEach((item) => {
      if (item.academic_years?.id) {
        yearMap.set(item.academic_years.id, item.academic_years.year_label);
      }
    });

    let optionsHTML = `<option value="">All Academic Years</option>`;
    yearMap.forEach((label, id) => {
      optionsHTML += `<option value="${escapeHTML(id)}">${escapeHTML(label)}</option>`;
    });

    yearSelect.innerHTML = optionsHTML;
    yearSelect.value = currentSelection;
  }

  getEl("timetableSearchInput")?.addEventListener(
    "input",
    applyTimetableFilters,
  );
  getEl("academicYearFilter")?.addEventListener(
    "change",
    applyTimetableFilters,
  );
  getEl("statusFilter")?.addEventListener("change", applyTimetableFilters);
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
      is_break,
      period_id,
      periods ( id, name, start_time, end_time),
      subjects ( name ),
      teacher:profiles!teacher_id ( full_name, teachers(staff_id) )
    `,
        )
        .eq("timetable_id", timetableId),
    ]);

    if (ttError) throw ttError;
    if (lError) throw lError;

    if (classLabel) classLabel.textContent = timetable.classes?.name || "-";
    if (yearLabel)
      yearLabel.textContent = timetable.academic_years?.year_label || "-";

    const lessonList = lessons || [];

    if (lessonList.length === 0) {
      if (gridBody) {
        gridBody.innerHTML = `<tr><td colspan="6" style="text-align:center;">No lessons added to this timetable yet.</td></tr>`;
      }
      return;
    }

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
                <td style="font-weight:600; background-color: #f1f5f9;">${escapeHTML(timeLabel)}</td>
                <td colspan="5" style="text-align:center; font-size: 20px; font-weight:bold; background-color: green; color: white; letter-spacing: 24px; text-transform:uppercase;">
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
                const teacherStaffId = getTeacherStaffId(lesson.teacher);
                return `
                  <td>
                    <div style="font-weight:600;">${escapeHTML(subjectName)}</div>
                    ${teacherName ? `
                      <span class="timetable-teacher">
                        <span>${escapeHTML(teacherName)}</span>
                        <small>Staff ID: ${escapeHTML(teacherStaffId)}</small>
                      </span>
                    ` : ""}
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

document
  .getElementById("closeViewTimetableModal")
  ?.addEventListener("click", closeViewModal);
document
  .getElementById("closeViewBtn")
  ?.addEventListener("click", closeViewModal);

window.addEventListener("click", (e) => {
  const modalIds = [
    "viewTimetableModal",
    "timetableModal",
    "editTimetableModal",
    "lessonModal",
    "editLessonModal",
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

document
  .getElementById("timetablesTableBody")
  ?.addEventListener("click", (e) => {
    const viewBtn = e.target.closest(".timetables-actions-btn.view");
    const editBtn = e.target.closest(".timetables-actions-btn.edit");

    if (viewBtn) {
      const timetableId = viewBtn.getAttribute("data-id");
      if (timetableId) handleViewTimetable(timetableId);
    } else if (editBtn) {
      const timetableId = editBtn.getAttribute("data-id");
      if (typeof handleEditTimetable === "function")
        handleEditTimetable(timetableId);
    }
  });
