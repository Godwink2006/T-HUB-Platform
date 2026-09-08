(() => {
  let lessonsState = [];
  let currentTimetableId = null;
  let currentSchoolId = null;
  let editingLessonId = null;

  const getEl = (id) => document.getElementById(id);

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

  const supabaseClient = window.supabaseClient || window.supabase;

  // Initialize immediately or on DOMReady
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initApp);
  } else {
    initApp();
  }

  async function initApp() {
    bindEvents();

    if (supabaseClient) {
      await fetchUserProfileAndSchool();
      await loadDropdownData();
    }
  }

  async function fetchUserProfileAndSchool() {
    try {
      const {
        data: { user },
        error: authErr,
      } = await supabaseClient.auth.getUser();
      if (authErr || !user) return console.error("Authentication required");

      const { data: profile, error: profileErr } = await supabaseClient
        .from("profiles")
        .select("school_id")
        .eq("id", user.id)
        .single();

      if (profileErr) {
        console.error("Error fetching profile:", profileErr.message);
      } else {
        currentSchoolId = profile.school_id;
      }
    } catch (err) {
      console.error("Auth initialization failed:", err);
    }
  }

  async function loadDropdownData() {
    if (!currentSchoolId) return;

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
          .eq("school_id", currentSchoolId),
        supabaseClient
          .from("academic_years")
          .select("id, year_label")
          .eq("school_id", currentSchoolId),
        supabaseClient
          .from("subjects")
          .select("id, name")
          .eq("school_id", currentSchoolId),
        supabaseClient
          .from("periods")
          .select("id, name, start_time, end_time")
          .eq("school_id", currentSchoolId),
        supabaseClient
          .from("profiles")
          .select("id, full_name")
          .eq("school_id", currentSchoolId)
          .eq("role", "teacher"),
      ]);

      populateSelectOptions("timetableClassSelect", classes, "id", "name");
      populateSelectOptions("timetableYearSelect", years, "id", "year_label");

      populateSelectOptions("addLessonSubject", subjects, "id", "name");
      populateSelectOptions("editLessonSubject", subjects, "id", "name");

      populateSelectOptions("addLessonTeacher", teachers, "id", "full_name");
      populateSelectOptions("editLessonTeacher", teachers, "id", "full_name");

      populatePeriodOptions("addLessonPeriod", periods);
      populatePeriodOptions("editLessonPeriod", periods);
    } catch (err) {
      console.error("Failed loading dropdowns:", err);
    }
  }

  function populateSelectOptions(elementId, items, valueKey, labelKey) {
    const select = getEl(elementId);
    if (!select || !items) return;

    let html = `<option value="">Select option...</option>`;
    items.forEach((item) => {
      html += `<option value="${item[valueKey]}">${item[labelKey]}</option>`;
    });
    select.innerHTML = html;
  }

  function populatePeriodOptions(elementId, periods) {
    const select = getEl(elementId);
    if (!select || !periods) return;

    let html = `<option value="">Select period...</option>`;
    periods.forEach((p) => {
      html += `<option value="${p.id}" data-time="${p.start_time}-${p.end_time}">${p.name} (${p.start_time}-${p.end_time})</option>`;
    });
    select.innerHTML = html;
  }

  function renderLessonsTable() {
    const tbody =
      getEl("timetableLessonsTbody") ||
      document.querySelector(".timetable-table-card tbody");
    if (!tbody) return;

    tbody.innerHTML = "";

    if (lessonsState.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">No lessons added yet.</td></tr>`;
      return;
    }

    lessonsState.forEach((lesson) => {
      const tr = document.createElement("tr");
      tr.dataset.id = lesson.id;
      tr.innerHTML = `
        <td>${lesson.day}</td>
        <td>${lesson.time}</td>
        <td>${lesson.subject_name}</td>
        <td>${lesson.teacher_name}</td>
        <td><span class="status-badge ${(lesson.status || "active").toLowerCase()}">${lesson.status}</span></td>
        <td>
          <button type="button" class="timetables-actions-btn edit-lesson">
            <i class="fa-solid fa-pen"></i>
          </button>
          <button type="button" class="timetables-actions-btn delete-lesson">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  function bindEvents() {
    // Global Event Listener for trigger buttons (Fallback delegation)
    document.addEventListener("click", (e) => {
      const createTrigger = e.target.closest(
        "#createTimetableBtn, .create-timetable-btn",
      );
      if (createTrigger) {
        e.preventDefault();
        currentTimetableId = null;
        lessonsState = [];
        renderLessonsTable();
        showModal(getEl("timetableModal"));
      }
    });

    const addLessonBtn = getEl("addLessonBtn");
    if (addLessonBtn) {
      addLessonBtn.addEventListener("click", (e) => {
        e.preventDefault();
        showModal(getEl("lessonModal"));
      });
    }

    // Modal Close Triggers
    [getEl("closeTimetableModal"), getEl("cancelTimetableModalBtn")].forEach(
      (btn) => {
        btn?.addEventListener("click", () =>
          hideModal(getEl("timetableModal")),
        );
      },
    );

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

    setupPeriodTimeDisplay("addLessonPeriod", "addLessonTimeDisplay");
    setupPeriodTimeDisplay("editLessonPeriod", "editLessonTimeDisplay");

    const saveLessonBtn = getEl("saveLessonBtn");
    saveLessonBtn?.addEventListener("click", () => {
      const form = getEl("addLessonForm");
      const lessonData = extractLessonFormData(form);

      if (
        !lessonData.subject_id ||
        !lessonData.period_id ||
        !lessonData.teacher_id
      ) {
        showToast("Please fill out all required fields.", "error");
        return;
      }

      lessonsState.push({ id: crypto.randomUUID(), ...lessonData });
      renderLessonsTable();
      hideModal(getEl("lessonModal"));
      if (form) form.reset();
    });

    const tbody =
      getEl("timetableLessonsTbody") ||
      document.querySelector(".timetable-table-card tbody");
    tbody?.addEventListener("click", (e) => {
      const editBtn = e.target.closest(".edit-lesson");
      const deleteBtn = e.target.closest(".delete-lesson");
      const tr = e.target.closest("tr");
      if (!tr) return;

      const lessonId = tr.dataset.id;

      if (deleteBtn) {
        lessonsState = lessonsState.filter((l) => l.id !== lessonId);
        renderLessonsTable();
      }

      if (editBtn) {
        editingLessonId = lessonId;
        const lesson = lessonsState.find((l) => l.id === lessonId);
        if (lesson) {
          populateEditFormValues(lesson);
          showModal(getEl("editLessonModal"));
        }
      }
    });

    const updateLessonBtn = getEl("updateLessonBtn");
    updateLessonBtn?.addEventListener("click", () => {
      if (!editingLessonId) return;

      const form = getEl("editLessonForm");
      const updatedData = extractLessonFormData(form);

      lessonsState = lessonsState.map((l) =>
        l.id === editingLessonId ? { ...l, ...updatedData } : l,
      );

      renderLessonsTable();
      hideModal(getEl("editLessonModal"));
      editingLessonId = null;
    });

    const timetableForm = getEl("timetableForm");
    timetableForm?.addEventListener("submit", async (e) => {
      e.preventDefault();

      const classId = getEl("timetableClassSelect")?.value;
      const yearId = getEl("timetableYearSelect")?.value;

      if (!classId || !yearId) {
        showToast("Please select both a class and an academic year.", "error");
        return;
      }

      const payload = {
        p_timetable_id: currentTimetableId || null,
        p_school_id: currentSchoolId,
        p_class_id: classId,
        p_academic_year_id: yearId,
        p_status: "Active",
        p_lessons: lessonsState.map((l) => ({
          day_of_week: l.day || l.day_of_week,
          subject_id: l.subject_id,
          period_id: l.period_id,
          teacher_id: l.teacher_id,
        })),
      };

      const { data, error } = await supabaseClient.rpc(
        "save_timetable_with_lessons",
        payload,
      );

      if (error) {
        console.error("Save error:", error.message);
        showToast("Failed to save timetable: " + error.message, "error");
      } else {
        showToast("Timetable saved successfully!", "success");
        location.reload();
      }
    });
  }

  function extractLessonFormData(form) {
    if (!form) return {};

    const getSelectValue = (name) =>
      form.querySelector(`[name="${name}"]`)?.value || "";
    const getSelectText = (name) => {
      const sel = form.querySelector(`[name="${name}"]`);
      return sel && sel.selectedIndex >= 0
        ? sel.options[sel.selectedIndex].text
        : "";
    };

    const timeDisplay = form.querySelector(
      "#addLessonTimeDisplay, #editLessonTimeDisplay",
    );

    return {
      day: getSelectValue("day"),
      subject_id: getSelectValue("subject_id"),
      subject_name: getSelectText("subject_id"),
      period_id: getSelectValue("period_id"),
      period_name: getSelectText("period_id"),
      time: timeDisplay ? timeDisplay.textContent.trim() : "",
      teacher_id: getSelectValue("teacher_id"),
      teacher_name: getSelectText("teacher_id"),
      status: getSelectValue("status") || "Active",
    };
  }

  function populateEditFormValues(lesson) {
    const form = getEl("editLessonForm");
    if (!form) return;

    const setSelectValue = (name, val) => {
      const el = form.querySelector(`[name="${name}"]`);
      if (el) el.value = val;
    };

    setSelectValue("day", lesson.day);
    setSelectValue("subject_id", lesson.subject_id);
    setSelectValue("period_id", lesson.period_id);
    setSelectValue("teacher_id", lesson.teacher_id);
    setSelectValue("status", lesson.status);

    const timeDisplay = form.querySelector("#editLessonTimeDisplay");
    if (timeDisplay) timeDisplay.textContent = lesson.time;
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
})();

document.addEventListener("DOMContentLoaded", () => {
  const timetableModal = document.getElementById("timetableModal");

  // Show Modal Function
  function openModal(modal) {
    if (!modal) return;
    modal.classList.add("active");
    modal.style.display = "flex";
  }

  // Hide Modal Function
  function closeModal(modal) {
    if (!modal) return;
    modal.classList.remove("active");
    modal.style.display = "none";
  }

  // Bind click to open button
  document.addEventListener("click", (e) => {
    const trigger = e.target.closest("#addTimetable, .add-timetables-btn");
    if (trigger) {
      e.preventDefault();
      openModal(timetableModal);
    }
  });

  // Bind click to close buttons
  const closeBtn = document.getElementById("closeTimetableModal");
  const cancelBtn = document.getElementById("cancelTimetableModalBtn");

  closeBtn?.addEventListener("click", () => closeModal(timetableModal));
  cancelBtn?.addEventListener("click", () => closeModal(timetableModal));

  // Close when clicking outside the modal box
  window.addEventListener("click", (e) => {
    if (e.target === timetableModal) {
      closeModal(timetableModal);
    }
  });
});

let currentSchoolId = localStorage.getItem("school_id") || null;

// Safely retrieve the logged-in user's school_id
async function getActiveSchoolId() {
  // 1. Check local storage cache first
  const storedSchoolId = localStorage.getItem("school_id");
  if (
    storedSchoolId &&
    storedSchoolId !== "null" &&
    storedSchoolId !== "undefined"
  ) {
    return storedSchoolId;
  }

  // 2. Get active authenticated user session
  const {
    data: { user },
    error: authError,
  } = await supabaseClient.auth.getUser();
  if (authError || !user) {
    console.error("User not authenticated:", authError?.message);
    return null;
  }

  // 3. Query profiles table for school_id
  const { data: profile, error: profileError } = await supabaseClient
    .from("profiles") // Change 'profiles' to your user profiles table name if different (e.g. 'users')
    .select("school_id")
    .eq("id", user.id)
    .single();

  if (!profileError && profile?.school_id) {
    localStorage.setItem("school_id", profile.school_id);
    return profile.school_id;
  }

  // 4. Fallback: check metadata
  const metadataSchoolId =
    user.user_metadata?.school_id || user.app_metadata?.school_id;
  if (metadataSchoolId) {
    localStorage.setItem("school_id", metadataSchoolId);
    return metadataSchoolId;
  }

  return null;
}

// Render Timetables List
async function loadTimetables() {
  const tbody = document.getElementById("timetablesTableBody");
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;">Loading timetables...</td></tr>`;

  try {
    const schoolId = await getActiveSchoolId();

    if (!schoolId) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:red;">Error: School ID missing. Open Browser Dev Tools -> Application -> Local Storage and add key <b>school_id</b> with your school UUID.</td></tr>`;
      return;
    }

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
      .eq("school_id", schoolId)
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
          <tr data-timetable-id="${item.id}">
            <td>${escapeHTML(className)}</td>
            <td>${escapeHTML(yearLabel)}</td>
            <td>
              <span class="${statusClass}">${escapeHTML(item.status || "Inactive")}</span>
            </td>
            <td>
              <button class="timetables-actions-btn view" data-id="${item.id}" title="View">
                <i class="fa-solid fa-eye"></i>
              </button>
              <button class="timetables-actions-btn edit" data-id="${item.id}" title="Edit">
                <i class="fa-solid fa-pen"></i>
              </button>
              <button class="timetables-actions-btn archive" data-id="${item.id}" title="Archive">
                <i class="fa-solid fa-box-archive"></i>
              </button>
            </td>
          </tr>
        `;
      })
      .join("");
  } catch (err) {
    console.error("Failed to load timetables:", err.message);
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:red;">Failed to load data. ${escapeHTML(err.message)}</td></tr>`;
  }
}

loadTimetables();

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
    const { data: timetable, error: ttError } = await supabaseClient
      .from("timetables")
      .select(
        `
        id,
        classes ( name ),
        academic_years ( year_label )
      `,
      )
      .eq("id", timetableId)
      .single();

    if (ttError) throw ttError;

    if (classLabel) classLabel.textContent = timetable.classes?.name || "N/A";
    if (yearLabel)
      yearLabel.textContent = timetable.academic_years?.year_label || "N/A";

    // Query your existing 'periods' table directly
    const { data: periods, error: pError } = await supabaseClient
      .from("periods")
      .select("*")
      .eq("school_id", await getActiveSchoolId())
      .order("start_time", { ascending: true });

    if (pError) throw pError;

    // NEW:
    const { data: lessons, error: lError } = await supabaseClient
      .from("timetable_lessons")
      .select(
        `
    id,
    day_of_week,
    period_id,
    subjects ( name ),
    teacher:profiles!teacher_id ( full_name )
  `,
      )
      .eq("timetable_id", timetableId);

    if (lError) throw lError;

    if (!periods || periods.length === 0) {
      if (gridBody)
        gridBody.innerHTML = `<tr><td colspan="6" style="text-align:center;">No periods configured in the database.</td></tr>`;
      return;
    }

    const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

    if (gridBody) {
      gridBody.innerHTML = periods
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
                <td>${timeLabel}</td>
                <td colspan="5" class="break-row" style="text-align:center; font-weight:bold; background-color: #f1f5f9;">
                  ${escapeHTML(period.name || "Break Time")}
                </td>
              </tr>
            `;
          }

          const dayCellsHtml = daysOfWeek
            .map((day) => {
              const lesson = lessons?.find(
                (l) =>
                  l.period_id === period.id &&
                  (l.day_of_week || "").toLowerCase() === day.toLowerCase(),
              );

              if (lesson) {
                const subjectName = lesson.subjects?.full_name || "Subject";
                const teacherName = lesson.teacher?.full_name || "";
                return `
                  <td>
                    <h4>${escapeHTML(subjectName)}</h4>
                    ${teacherName ? escapeHTML(teacherName) : ""}
                  </td>
                `;
              }

              return `<td>-</td>`;
            })
            .join("");

          return `
            <tr>
              <td><strong>${timeLabel}</strong></td>
              ${dayCellsHtml}
            </tr>
          `;
        })
        .join("");
    }
  } catch (err) {
    console.error("Failed to load timetable view:", err.message);
    if (gridBody) {
      gridBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">Failed to display timetable: ${escapeHTML(err.message)}</td></tr>`;
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

// Delegate table action buttons
document
  .getElementById("timetablesTableBody")
  ?.addEventListener("click", (e) => {
    // Find closest button element regardless of clicking the <i> icon or padding
    const viewBtn = e.target.closest(".timetables-actions-btn.view");
    const editBtn = e.target.closest(".timetables-actions-btn.edit");
    const archiveBtn = e.target.closest(".timetables-actions-btn.archive");

    if (viewBtn) {
      const timetableId = viewBtn.getAttribute("data-id");
      if (timetableId) {
        handleViewTimetable(timetableId);
      }
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
