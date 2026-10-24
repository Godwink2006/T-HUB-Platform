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

function teacherAssignmentErrorMessage(error, action = "load") {
  const code = String(error?.code || "").toUpperCase();
  const status = Number(error?.status || error?.statusCode || 0);
  const details = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`.toLowerCase();

  if (
    status === 401 ||
    code === "PGRST301" ||
    /invalid jwt|session.*expired|refresh token/.test(details)
  ) {
    return "Your session has expired. Sign in again, then retry.";
  }
  if (/school.{0,30}inactive|inactive.{0,30}school|school is not active/.test(details)) {
    return "This school is inactive. You can view existing teacher assignments, but changes are unavailable until the school is reactivated.";
  }
  if (
    code === "42501" ||
    status === 403 ||
    /row-level security|permission denied|insufficient privilege|not authorized|unauthorized|access denied|not allowed/.test(details)
  ) {
    return action === "load"
      ? "You do not have permission to view teacher assignments. Contact your school administrator."
      : `Teacher assignments could not be ${action === "update" ? "updated" : "saved"}. The school may be inactive, or your account may not have permission. Contact your school administrator.`;
  }
  if (/failed to fetch|fetch failed|network|connection|timeout|timed out/.test(details)) {
    return "Teacher assignments could not be reached. Check your internet connection and try again.";
  }
  if (code === "23505" || /duplicate key|already exists|unique constraint/.test(details)) {
    if (details.includes("idx_unique_class_teacher_per_class")) {
      return "This class already has a class teacher for the selected academic year.";
    }
    return "A matching teacher assignment already exists. Review the teacher, subject, class, and academic year.";
  }
  if (code === "23503" || /foreign key|violates.*constraint/.test(details)) {
    return "One of the selected teachers, subjects, classes, or academic years is no longer available. Refresh the page and try again.";
  }
  if (code === "PGRST116") {
    if (action === "view") {
      return "This teacher assignment could not be found. Refresh the list and try again.";
    }
    if (action === "update") {
      return "This assignment could not be updated. It may no longer exist, or your school or account may not allow the change. Refresh the list and contact your school administrator if the problem continues.";
    }
    return "The requested teacher assignment is no longer available. Refresh the page and try again.";
  }
  if (code === "23514" || code === "22P02" || code === "22023") {
    return "Some assignment information is invalid. Review your selections and try again.";
  }

  return action === "load"
    ? "Teacher assignments could not be loaded. Please try again."
    : `The teacher assignment could not be ${action === "update" ? "updated" : "saved"}. Please try again.`;
}

function showTeacherAssignmentError(error, action = "load") {
  console.error(`Teacher assignments ${action} error:`, error);
  const message = teacherAssignmentErrorMessage(error, action);
  if (typeof showToast === "function") showToast(message, "error");
  return message;
}

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

let assignmentDropdownsLoaded = false;

async function loadFormDropdowns() {
  try {
    if (!window.supabaseClient) throw new Error("Supabase client is unavailable");
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

    const failedResult = [teachersRes, subjectsRes, classesRes, yearsRes].find(
      (result) => result.error,
    );
    if (failedResult) throw failedResult.error;

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
    assignmentDropdownsLoaded = true;
  } catch (err) {
    assignmentDropdownsLoaded = false;
    [
      ["assignTeacherId", "Select Teacher"],
      ["assignSubjectId", "Select Subject"],
      ["assignClassId", "Select Class"],
      ["assignAcademicYearId", "Select Academic Year"],
    ].forEach(([id, label]) => populateSelect(id, [], "id", "name", label));
    showTeacherAssignmentError(err, "load");
  }
}

async function handleCreateAssignment(e) {
  e.preventDefault();

  const form = e.target;
  const saveBtn = form.querySelector("button[type='submit']");

  if (!window.supabaseClient) {
    showTeacherAssignmentError(new Error("Supabase client is unavailable"), "create");
    return;
  }

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

  try {
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = "Saving...";
    }

    const {
      data: { user },
      error: authError,
    } = await window.supabaseClient.auth.getUser();
    if (authError) throw authError;
    if (!user) {
      showToast("Your session has expired. Sign in again, then retry.", "error");
      return;
    }

    const { data: profile, error: profileError } = await window.supabaseClient
      .from("profiles")
      .select("school_id")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile?.school_id) {
      showToast("Your school profile could not be found. Contact your school administrator.", "error");
      return;
    }

    const payload = {
      school_id: profile.school_id,
      teacher_id: teacherId,
      subject_id: subjectId,
      class_id: classId,
      academic_year_id: academicYearId,
      is_class_teacher: isClassTeacher,
      status: status ? status.toLowerCase() : "active",
      description: description || null,
    };

    const isValid = await validateTeacherAssignment(payload);
    if (!isValid) return;

    const { error } = await window.supabaseClient
      .from("teacher_assignments")
      .insert([payload]);

    if (error) {
      if (error.code === "23505") {
        const constraintName = error.details || error.message || "";

        if (constraintName.includes("idx_unique_class_teacher_per_class")) {
          showToast(
            "This class already has a class teacher for the selected academic year.",
            "error",
          );
          return;
        }
      }
      throw error;
    }

    form.reset();
    showToast("Teacher assignment added successfully!", "success");
    await loadAssignmentsTable();
  } catch (err) {
    showTeacherAssignmentError(err, "create");
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
  const client = window.supabaseClient;
  if (!client) {
    showTeacherAssignmentError(new Error("Supabase client is unavailable"), "create");
    return false;
  }

  let query = client
    .from("teacher_assignments")
    .select("id, profiles(full_name)")
    .eq("school_id", school_id)
    .eq("class_id", class_id)
    .eq("academic_year_id", academic_year_id)
    .eq("subject_id", subject_id)
    .eq("status", "active");

  if (currentAssignmentId) query = query.neq("id", currentAssignmentId);

  const { data: existing, error } = await query;

  if (error) {
    showTeacherAssignmentError(error, "create");
    return false;
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
  if (!editModal || !assignmentId) {
    showToast("This teacher assignment could not be identified. Refresh the list and try again.", "error");
    return;
  }

  try {
    if (!window.supabaseClient) throw new Error("Supabase client is unavailable");
    const { data: assign, error } = await window.supabaseClient
      .from("teacher_assignments")
      .select("id, is_class_teacher, status, description")
      .eq("id", assignmentId)
      .maybeSingle();

    if (error) throw error;
    if (!assign) {
      showToast(teacherAssignmentErrorMessage({ code: "PGRST116" }, "view"), "error");
      return;
    }

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

    editModal.style.display = "flex";
    document.body.style.overflow = "hidden";
  } catch (err) {
    showTeacherAssignmentError(err, "view");
  }
}

async function handleUpdateAssignment(e) {
  e.preventDefault();

  const form = e.target;
  const updateBtn = form.querySelector("button[type='submit']");
  const assignmentId = document.getElementById("editAssignmentId")?.value;

  if (!assignmentId || !originalEditData) {
    showToast("Assignment details are missing. Close this form, refresh the list, and try again.", "error");
    return;
  }

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

  if (!classTeacherSelect || !statusSelect || !descriptionTextarea) {
    showToast("The assignment form could not be read. Close it and try again.", "error");
    return;
  }

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

    const { data: updatedAssignment, error } = await window.supabaseClient
      .from("teacher_assignments")
      .update(payload)
      .eq("id", assignmentId)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!updatedAssignment) {
      throw { code: "PGRST116", message: "No assignment row was updated" };
    }

    closeModal(document.getElementById("editAssignModal"));
    showToast("Teacher assignment updated successfully!", "success");

    if (typeof loadAssignmentsTable === "function") {
      await loadAssignmentsTable();
    }
  } catch (err) {
    showTeacherAssignmentError(err, "update");
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
    openBtn.addEventListener("click", () => {
      openModal(assignModal);
      if (!assignmentDropdownsLoaded) loadFormDropdowns();
    });
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
    if (!window.supabaseClient) throw new Error("Supabase client is unavailable");
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
    const message = teacherAssignmentErrorMessage(err, "load");
    console.error("Error fetching teacher assignments:", err);
    if (!append) {
      tableBody.replaceChildren();
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 10;
      cell.style.cssText = "text-align:center; padding:20px; color:#b91c1c;";
      const text = document.createElement("p");
      text.textContent = message;
      text.style.margin = "0 0 12px";
      const retryButton = document.createElement("button");
      retryButton.type = "button";
      retryButton.textContent = "Try again";
      retryButton.className = "save-btn";
      retryButton.addEventListener("click", () => loadAssignmentsTable());
      cell.append(text, retryButton);
      row.appendChild(cell);
      tableBody.appendChild(row);
    } else {
      showTeacherAssignmentError(err, "load");
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
