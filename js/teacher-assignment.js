const formatDate = (dateString) => {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

document.addEventListener("DOMContentLoaded", () => {
  loadAssignmentsTable();
});

function openModal(modal) {
  if (!modal) return;
  modal.style.display = "flex";
  document.body.style.overflow = "hidden";
}

function closeModal(modal) {
  if (!modal) return;

  modal.style.display = "none";
  document.body.style.overflow = "";

  const form = modal.querySelector("form");
  if (form) form.reset();

  const hiddenIdInput = modal.querySelector("#editAssignmentId");
  if (hiddenIdInput) hiddenIdInput.value = "";

  originalEditData = null;
}

function populateSelect(
  selectId,
  items,
  valueKey,
  textKey,
  defaultText,
  secondTextKey = null,
) {
  const select = document.getElementById(selectId);
  if (!select) return;

  select.innerHTML = `<option value="">${defaultText}</option>`;
  if (items && items.length > 0) {
    items.forEach((item) => {
      const option = document.createElement("option");
      option.value = item[valueKey];

      if (secondTextKey && item[secondTextKey]) {
        option.textContent = `${item[textKey]} (${item[secondTextKey]})`;
      } else {
        option.textContent = item[textKey];
      }

      select.appendChild(option);
    });
  }
}

async function loadFormDropdowns() {
  try {
    const [teachersRes, subjectsRes, classesRes, yearsRes] = await Promise.all([
      window.supabaseClient
        .from("teachers")
        .select(
          `
      id,
      staff_id,
      profiles!inner ( id, full_name, status )
    `,
        )
        .eq("profiles.status", "active"),

      window.supabaseClient
        .from("subjects")
        .select("id, name")
        .eq("status", "Active"),

      window.supabaseClient
        .from("classes")
        .select("id, name")
        .eq("status", "active"),

      window.supabaseClient
        .from("academic_years")
        .select("id, year_label")
        .eq("status", "Active")
    ]);

    const formattedTeachers = (teachersRes.data || []).map((t) => ({
      id: t.profiles?.id || t.id,
      full_name: t.profiles?.full_name || "Unknown",
      staff_id: t.staff_id,
    }));

    populateSelect(
      "assignTeacherId",
      formattedTeachers,
      "id",
      "full_name",
      "Select Teacher",
      "staff_id",
    );
    populateSelect(
      "assignSubjectId",
      subjectsRes.data,
      "id",
      "name",
      "Select Subject",
    );
    populateSelect(
      "assignClassId",
      classesRes.data,
      "id",
      "name",
      "Select Class",
    );
    populateSelect(
      "assignAcademicYearId",
      yearsRes.data,
      "id",
      "year_label",
      "Select Academic Year",
    );
  } catch (err) {
    console.error("Error loading dropdown data:", err.message);
  }
}

async function handleCreateAssignment(e) {
  e.preventDefault();

  const form = e.target;
  const saveBtn = form.querySelector("button[type='submit']");

  const {
    data: { user },
    error: authError,
  } = await window.supabaseClient.auth.getUser();

  if (authError || !user) {
    showToast("Session expired. Please log in again.", "error");
    return;
  }

  const { data: profile, error: profileError } = await window.supabaseClient
    .from("profiles")
    .select("school_id")
    .eq("id", user.id)
    .single();

  if (profileError || !profile?.school_id) {
    showToast("Could not retrieve school profile for this user.", "error");
    return;
  }

  const schoolId = profile.school_id;

  const teacherId = document.getElementById("assignTeacherId").value;
  const subjectId = document.getElementById("assignSubjectId").value;
  const classId = document.getElementById("assignClassId").value;
  const academicYearId = document.getElementById("assignAcademicYearId").value;
  const isClassTeacher =
    document.getElementById("assignIsClassTeacher").value === "true";
  const status = document.getElementById("assignStatus").value;
  const description = document.getElementById("assignDescription").value.trim();

  if (!teacherId || !subjectId || !classId || !academicYearId) {
    showToast("Please fill out all required fields.", "error");
    return;
  }

  const payload = {
    school_id: schoolId,
    teacher_id: teacherId,
    subject_id: subjectId,
    class_id: classId,
    academic_year_id: academicYearId,
    is_class_teacher: isClassTeacher,
    status: status ? status.toLowerCase() : "active",
    description: description || null,
  };

  try {
    const isValid = await validateTeacherAssignment(payload);
    if (!isValid) return;

    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = "Saving...";
    }

    const { error } = await window.supabaseClient
      .from("teacher_assignments")
      .insert([payload]);

    if (error) {
      if (error.code === "23505") {
        const constraintName = error.details || error.message || "";

        if (constraintName.includes("idx_unique_class_teacher_per_class")) {
          throw new Error(
            "This class already has an assigned Class Teacher for this academic year.",
          );
        }

        throw new Error(
          "This class already has an assigned Class Teacher for this academic year.",
        );
      }
      throw error;
    }

    form.reset();
    showToast("Teacher assignment added successfully!", "success");
    await loadAssignmentsTable();
  } catch (err) {
    console.error("Error creating assignment:", err.message);
    showToast("Failed to assign teacher: " + err.message, "error");
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save";
    }
  }
}

async function validateTeacherAssignment({
  school_id,
  class_id,
  academic_year_id,
  subject_id,
  currentAssignmentId = null,
}) {
  const client = window.supabaseClient || supabaseClient;

  const { data: existing, error } = await client
    .from("teacher_assignments")
    .select("id, profiles(full_name)")
    .eq("school_id", school_id)
    .eq("class_id", class_id)
    .eq("academic_year_id", academic_year_id)
    .eq("subject_id", subject_id)
    .eq("status", "active")
    .neq("id", currentAssignmentId);

  if (error) {
    console.error("Validation error:", error);
    return true;
  }

  if (existing && existing.length > 0) {
    const assignedTeacher =
      existing[0].profiles?.full_name || "Another teacher";
    showToast(
      `${assignedTeacher} is already assigned to teach this subject for the selected class and academic year.`,
      "error",
    );
    return false;
  }

  return true;
}

let originalEditData = null;

async function openEditModal(assignmentId) {
  const editModal = document.getElementById("editAssignModal");
  if (!editModal) return;

  editModal.style.display = "flex";
  document.body.style.overflow = "hidden";

  try {
    const { data: assign, error } = await window.supabaseClient
      .from("teacher_assignments")
      .select("id, is_class_teacher, status, description")
      .eq("id", assignmentId)
      .single();

    if (error) throw error;

    originalEditData = {
      is_class_teacher: assign.is_class_teacher,
      status: assign.status,
      description: assign.description || "",
    };

    const idInput = document.getElementById("editAssignmentId");
    if (!idInput) {
      const hiddenInput = document.createElement("input");
      hiddenInput.type = "hidden";
      hiddenInput.id = "editAssignmentId";
      document.querySelector("#editAssignModal form").appendChild(hiddenInput);
      hiddenInput.value = assign.id;
    } else {
      idInput.value = assign.id;
    }

    const classTeacherSelect =
      document.querySelector(
        "#editAssignModal select[name='is_class_teacher']",
      ) || document.getElementById("editIsClassTeacher");
    const statusSelect =
      document.querySelector("#editAssignModal select[name='status']") ||
      document.getElementById("editStatus");
    const descriptionTextarea =
      document.querySelector("#editAssignModal textarea") ||
      document.getElementById("editDescription");

    if (classTeacherSelect)
      classTeacherSelect.value = assign.is_class_teacher ? "true" : "false";
    if (statusSelect) statusSelect.value = assign.status;
    if (descriptionTextarea)
      descriptionTextarea.value = assign.description || "";
  } catch (err) {
    console.error("Error fetching assignment details:", err.message);
    showToast("Failed to load assignment details: " + err.message, "error");
  }
}

async function handleUpdateAssignment(e) {
  e.preventDefault();

  const form = e.target;
  const updateBtn = form.querySelector("button[type='submit']");
  const assignmentId = document.getElementById("editAssignmentId")?.value;

  const classTeacherSelect =
    form.querySelector("select[name='is_class_teacher']") ||
    document.getElementById("editIsClassTeacher");
  const statusSelect =
    form.querySelector("select[name='status']") ||
    document.getElementById("editStatus");
  const descriptionTextarea =
    form.querySelector("textarea") ||
    document.getElementById("editDescription");

  const currentIsClassTeacher = classTeacherSelect
    ? classTeacherSelect.value === "true"
    : false;
  const currentStatus = statusSelect ? statusSelect.value : "active";
  const currentDescription = descriptionTextarea
    ? descriptionTextarea.value.trim()
    : "";

  const hasChanges =
    currentIsClassTeacher !== originalEditData.is_class_teacher ||
    currentStatus !== originalEditData.status ||
    currentDescription !== originalEditData.description;

  if (!hasChanges) {
    showToast("No changes detected.", "info");
    return;
  }

  const payload = {
    is_class_teacher: currentIsClassTeacher,
    status: currentStatus,
    description: currentDescription || null,
    updated_at: new Date().toISOString(),
  };

  try {
    if (updateBtn) {
      updateBtn.disabled = true;
      updateBtn.textContent = "Updating...";
    }

    const { error } = await window.supabaseClient
      .from("teacher_assignments")
      .update(payload)
      .eq("id", assignmentId);
    if (error) {
      if (
        error.code === "42501" ||
        error.message?.toLowerCase().includes("row-level security")
      ) {
        throw new Error("Permission denied.");
      }

      if (error.code === "23505") {
        throw new Error(
          "This class already has an assigned Class Teacher for this academic year.",
        );
      }

      throw error;
    }

    closeModal(document.getElementById("editAssignModal"));
    showToast("Teacher assignment updated successfully!", "success");

    if (typeof loadAssignmentsTable === "function") {
      await loadAssignmentsTable();
    }
  } catch (err) {
    console.error("Error updating assignment:", err.message);
    showToast(err.message, "error");
  } finally {
    if (updateBtn) {
      updateBtn.disabled = false;
      updateBtn.textContent = "Update";
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const tableBody = document.getElementById("assignmentsTableBody");
  if (tableBody) {
    tableBody.addEventListener("click", (e) => {
      const editBtn = e.target.closest(".assigns-actions-btn.edit");
      if (editBtn) {
        const id = editBtn.getAttribute("data-id");
        openEditModal(id);
      }
    });
  }

  const editForm = document.querySelector("#editAssignModal form");
  if (editForm) {
    editForm.addEventListener("submit", handleUpdateAssignment);
  }

  const closeEditBtn = document.getElementById("closeEditAssignModal");
  const cancelEditBtn = document.getElementById("cancelEditAssignModal");
  const editModal = document.getElementById("editAssignModal");

  const hideModal = () => closeModal(editModal);

  if (closeEditBtn) closeEditBtn.addEventListener("click", hideModal);
  if (cancelEditBtn) cancelEditBtn.addEventListener("click", hideModal);

  window.addEventListener("click", (e) => {
    if (e.target === editModal) hideModal();
  });
});

document.addEventListener("DOMContentLoaded", () => {
  loadFormDropdowns();

  const assignModal = document.getElementById("assignModal");
  const openBtn = document.getElementById("addAssign");
  const closeBtn = document.getElementById("closeAssignModal");
  const cancelBtn = document.getElementById("cancelAssignModal");
  const form = document.getElementById("assignForm");

  if (openBtn) {
    openBtn.addEventListener("click", () => openModal(assignModal));
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", () => closeModal(assignModal));
  }

  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => closeModal(assignModal));
  }

  window.addEventListener("click", (e) => {
    if (e.target === assignModal) {
      closeModal(assignModal);
    }
  });

  if (form) {
    form.addEventListener("submit", handleCreateAssignment);
  }
});

let globalAssignmentsData = [];
const ASSIGNMENTS_PAGE_SIZE = 30;
let assignmentsOffset = 0;
let assignmentsHasMore = false;
let assignmentsLoading = false;

async function loadAssignmentsTable(options = {}) {
  const tableBody = document.getElementById("assignmentsTableBody");
  if (!tableBody) return;
  const append = options.append === true;
  const nextButton = document.getElementById("nextAssignmentsPage");

  if (assignmentsLoading || (append && !assignmentsHasMore)) return;
  assignmentsLoading = true;

  if (!append) {
    assignmentsOffset = 0;
    assignmentsHasMore = false;
    globalAssignmentsData = [];
    if (nextButton) {
      nextButton.hidden = true;
      nextButton.disabled = false;
      nextButton.textContent = "Next";
    }
    tableBody.innerHTML = `
      <tr>
        <td colspan="10" style="text-align: center; padding: 2rem; color: #64748b;">
          <i class="fa-solid fa-spinner fa-spin" style="margin-right: 0.5rem;"></i>
          Loading teacher assignments...
        </td>
      </tr>
    `;
  } else if (nextButton) {
    nextButton.disabled = true;
    nextButton.textContent = "Loading...";
  }

  try {
    const { data: assignments, error } = await window.supabaseClient
      .from("teacher_assignments")
      .select(
        `
        id,
        is_class_teacher,
        status,
        created_at,
        updated_at,
        description,
        profiles!teacher_id (
          id,
          full_name,
          photo_url,
          teachers ( staff_id )
        ),
        subjects ( id, name ),
        classes ( id, name ),
        academic_years ( id, year_label )
      `,
      )
      .order("created_at", { ascending: false })
      // Fetch one look-ahead row so Next is shown only when another page exists.
      .range(assignmentsOffset, assignmentsOffset + ASSIGNMENTS_PAGE_SIZE);

    if (error) throw error;

    const page = assignments || [];
    const visiblePage = page.slice(0, ASSIGNMENTS_PAGE_SIZE);
    assignmentsHasMore = page.length > ASSIGNMENTS_PAGE_SIZE;
    assignmentsOffset += visiblePage.length;
    globalAssignmentsData = append
      ? globalAssignmentsData.concat(visiblePage)
      : visiblePage;

    populateFilterDropdowns(globalAssignmentsData);

    filterAssignments();
  } catch (err) {
    console.error("Error fetching assignments:", err.message);
    if (!append) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="10" style="text-align: center; color: red; padding: 20px;">Failed to load assignments data.</td>
        </tr>`;
    } else if (typeof showToast === "function") {
      showToast("Could not load more assignments.", "error");
    }
  } finally {
    assignmentsLoading = false;
    if (nextButton) {
      nextButton.hidden = !assignmentsHasMore;
      nextButton.disabled = false;
      nextButton.textContent = "Next";
    }
  }
}

function populateFilterDropdowns(assignments) {
  const subjectSelect = document.getElementById("filterSubject");
  const classSelect = document.getElementById("filterClass");
  const yearSelect = document.getElementById("filterAcademicYear");
  const selectedSubject = subjectSelect?.value || "";
  const selectedClass = classSelect?.value || "";
  const selectedYear = yearSelect?.value || "";

  const subjectsMap = new Map();
  const classesMap = new Map();
  const yearsMap = new Map();

  assignments.forEach((item) => {
    if (item.subjects?.id && item.subjects?.name) {
      subjectsMap.set(item.subjects.id, item.subjects.name);
    }
    if (item.classes?.id && item.classes?.name) {
      classesMap.set(item.classes.id, item.classes.name);
    }
    if (item.academic_years?.id && item.academic_years?.year_label) {
      yearsMap.set(item.academic_years.id, item.academic_years.year_label);
    }
  });

  const buildOptions = (selectElem, map, defaultText) => {
    if (!selectElem) return;
    selectElem.innerHTML = `<option value="">${defaultText}</option>`;
    map.forEach((name, id) => {
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = name;
      selectElem.appendChild(opt);
    });
  };

  buildOptions(subjectSelect, subjectsMap, "All Subjects");
  buildOptions(classSelect, classesMap, "All Classes");
  buildOptions(yearSelect, yearsMap, "All Academic Years");
  if (subjectSelect && subjectsMap.has(selectedSubject)) {
    subjectSelect.value = selectedSubject;
  }
  if (classSelect && classesMap.has(selectedClass)) {
    classSelect.value = selectedClass;
  }
  if (yearSelect && yearsMap.has(selectedYear)) {
    yearSelect.value = selectedYear;
  }
}

function renderAssignmentsTable(assignments) {
  const tableBody = document.getElementById("assignmentsTableBody");
  if (!tableBody) return;

  tableBody.innerHTML = "";

  if (!assignments || assignments.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="10" style="text-align: center; padding: 20px;">No matching assignments found.</td>
      </tr>`;
    return;
  }

  assignments.forEach((assign) => {
    const tr = document.createElement("tr");

    const teacherName = assign.profiles?.full_name || "N/A";
    const teacherStaffId = assign.profiles?.teachers?.staff_id || "No ID found";
    const teacherPhoto = escapeHTML(
      assign.profiles?.photo_url || window.DEFAULT_PROFILE_AVATAR || "",
    );
    const subjectName = assign.subjects?.name || "N/A";
    const className = assign.classes?.name || "N/A";
    const academicYear = assign.academic_years?.year_label || "N/A";
    const isClassTeacherText = assign.is_class_teacher ? "Yes" : "No";

    const statusClass =
      assign.status === "active"
        ? "assigns-status-active"
        : "assigns-status-inactive";
    const statusText = assign.status
      ? assign.status.charAt(0).toUpperCase() + assign.status.slice(1)
      : "Inactive";

    tr.innerHTML = `
      <td>
        <span class="app-person-cell teacher-assignment-identity">
          <img class="app-person-avatar teacher-assignment-avatar" src="${teacherPhoto}" alt="" loading="lazy" />
          <span class="app-person-meta">
            <span>${escapeHTML(teacherName)}</span>
            <small class="app-person-id">Staff ID: ${escapeHTML(teacherStaffId)}</small>
          </span>
        </span>
      </td>
      <td>${escapeHTML(subjectName || "-")}</td>
      <td>${escapeHTML(className || "-")}</td>
      <td>${escapeHTML(academicYear || "-")}</td>
      <td>${isClassTeacherText}</td>
      <td>${escapeHTML(assign.description || "-")}</td>
      <td>${formatDate(assign.created_at)}</td>
      <td>${formatDate(assign.updated_at)}</td>
      <td>
        <span class="${statusClass}">${escapeHTML(statusText)}</span>
      </td>
      <td>
        <button class="assigns-actions-btn edit" data-id="${escapeHTML(assign.id)}">
          <i class="fa-solid fa-pen"></i>
        </button>
      </td>
    `;

    tableBody.appendChild(tr);
    const teacherAvatar = tr.querySelector(".teacher-assignment-avatar");
    teacherAvatar?.addEventListener(
      "error",
      () => {
        const fallback = window.DEFAULT_PROFILE_AVATAR || "";
        if (fallback && teacherAvatar.src !== fallback) {
          teacherAvatar.src = fallback;
        }
      },
      { once: true },
    );
  });
}

function filterAssignments() {
  const searchTerm =
    document.getElementById("assignSearchInput")?.value.toLowerCase().trim() ||
    "";
  const subjectId = document.getElementById("filterSubject")?.value || "";
  const classId = document.getElementById("filterClass")?.value || "";
  const yearId = document.getElementById("filterAcademicYear")?.value || "";
  const status = document.getElementById("filterStatus")?.value || "";

  const filtered = globalAssignmentsData.filter((item) => {
    const matchesSearch =
      !searchTerm ||
      (item.profiles?.full_name || "").toLowerCase().includes(searchTerm) ||
      (item.subjects?.name || "").toLowerCase().includes(searchTerm) ||
      (item.classes?.name || "").toLowerCase().includes(searchTerm) ||
      (item.description || "").toLowerCase().includes(searchTerm);

    const matchesSubject = !subjectId || item.subjects?.id === subjectId;
    const matchesClass = !classId || item.classes?.id === classId;
    const matchesYear = !yearId || item.academic_years?.id === yearId;
    const matchesStatus =
      !status || (item.status || "").toLowerCase() === status.toLowerCase();

    return (
      matchesSearch &&
      matchesSubject &&
      matchesClass &&
      matchesYear &&
      matchesStatus
    );
  });

  renderAssignmentsTable(filtered);
}

document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("assignSearchInput");
  const filterSubject = document.getElementById("filterSubject");
  const filterClass = document.getElementById("filterClass");
  const filterYear = document.getElementById("filterAcademicYear");
  const filterStatus = document.getElementById("filterStatus");
  const nextButton = document.getElementById("nextAssignmentsPage");

  if (searchInput) searchInput.addEventListener("input", filterAssignments);
  if (filterSubject)
    filterSubject.addEventListener("change", filterAssignments);
  if (filterClass) filterClass.addEventListener("change", filterAssignments);
  if (filterYear) filterYear.addEventListener("change", filterAssignments);
  if (filterStatus) filterStatus.addEventListener("change", filterAssignments);
  if (nextButton) {
    nextButton.addEventListener("click", () => loadAssignmentsTable({ append: true }));
  }
});
