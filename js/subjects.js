const subjectModal = document.getElementById("subjectModal");

const cancelSubjectModal = document.getElementById("cancelSubjectModal");

const openSubjectModal = document.getElementById("addSubject");

const closeSubjectModal = document.getElementById("closeSubjectModal");

openSubjectModal.addEventListener("click", () => {
  subjectModal.style.display = "flex";

  lockBodyScroll();
});

closeSubjectModal.addEventListener("click", () => {
  subjectModal.style.display = "none";

  unLockBodyScroll();
});

cancelSubjectModal.addEventListener("click", () => {
  subjectModal.style.display = "none";

  unLockBodyScroll();
});

window.addEventListener("click", (e) => {
  if (e.target === subjectModal) {
    subjectModal.style.display = "none";

    unLockBodyScroll();
  }
});

const closeEditSubjectModal = document.getElementById("closeEditSubjectModal");
const cancelEditSubjectModal = document.getElementById(
  "cancelEditSubjectModal",
);
const editSubjectModal = document.getElementById("editSubjectModal");

closeEditSubjectModal.addEventListener("click", () => {
  editSubjectModal.style.display = "none";

  unLockBodyScroll();
});

cancelEditSubjectModal.addEventListener("click", () => {
  editSubjectModal.style.display = "none";

  unLockBodyScroll();
});

window.addEventListener("click", (e) => {
  if (e.target === editSubjectModal) {
    editSubjectModal.style.display = "none";

    unLockBodyScroll();
  }
});

async function populateDepartmentDropdown() {
  const departmentSelect = document.getElementById("departmentSelect");
  if (!departmentSelect) return;

  const { data: departments, error } = await supabaseClient
    .from("departments")
    .select("id, name")
    .eq("status", "active")
    .order("name");

  const currentSelection = departmentSelect.value;
  departmentSelect.innerHTML = `<option value="">Select department</option>`;

  departments?.forEach((dept) => {
    departmentSelect.add(new Option(dept.name, dept.id));
  });

  if (currentSelection) {
    departmentSelect.value = currentSelection;
  }
}

async function handleAddSubject(event) {
  event.preventDefault();

  const name = document.getElementById("subjectNameInput").value.trim();
  const departmentId =
    document.getElementById("departmentSelect").value || null;
  const status = document.getElementById("statusSelect").value;
  const description = document.getElementById("descriptionInput").value.trim();

  if (!name || !status) {
    showToast("Please fill in all required fields.", "error");
    return;
  }

  const form = event.target;
  const saveBtn =
    document.getElementById("saveSubjectBtn") ||
    form.querySelector('button[type="submit"]');

  try {
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = "Saving...";
    }

    const { data, error } = await supabaseClient
      .from("subjects")
      .insert([
        {
          name,
          department_id: departmentId,
          status,
          description: description || null,
        },
      ])
      .select();

    if (error) {
      if (error.code === "23505") {
        showToast(
          "This subject name already exists. Please choose a different name.",
          "error",
        );
        return;
      }

      if (error.code === "42501") {
        showToast("You do not have permission to add a subject.", "error");
        return;
      }

      showToast(error.message, "error");
      return;
    }

    showToast("Subject created successfully!", "success");
    form.reset();

    if (typeof populateSubjectFilterDropdowns === "function") {
      await populateSubjectFilterDropdowns();
    }

    await fetchFilteredSubjects();
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save Subject";
    }
  }
}

let searchDebounceTimeout = null;

function escapeHTML(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDateTime(isoString) {
  if (!isoString) return "N/A";
  const date = new Date(isoString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

async function fetchFilteredSubjects() {
  const searchQuery =
    document.getElementById("searchSubjectInput")?.value.trim() || "";
  const departmentId =
    document.getElementById("filterDepartmentSelect")?.value || "";
  const statusFilter =
    document.getElementById("filterStatusSelect")?.value?.toLowerCase() || "";

  renderSubjectsTable([], true);

  let query = supabaseClient.from("subjects").select(`
    id,
    name,
    description,
    status,
    created_at,
    updated_at,
    department_id,
    departments ( id, name )
  `);


  if (departmentId) {
    query = query.eq("department_id", departmentId);
  }

  if (statusFilter === "active") {
    query = query.eq("status", "Active");
  } else if (statusFilter === "inactive") {
    query = query.eq("status", "Inactive");
  }

  if (searchQuery) {
    query = query.or(
      `name.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`,
    );
  }

  query = query.order("created_at", { ascending: false });

  const { data: subjects, error } = await query;

  if (error) {
    console.error("Fetch error:", error.message);
    if (typeof showToast === "function") {
      showToast("Failed to load subjects.", "error");
    }
    return;
  }

  renderSubjectsTable(subjects || []);
}

function renderSubjectsTable(subjects, isLoading = false) {
  const tbody = document.getElementById("subjectsTableBody");
  if (!tbody) return;

  if (isLoading) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 2rem; color: #64748b;">
        <i class="fa-solid fa-spinner fa-spin" style="margin-right: 0.5rem;"></i>
        Loading subjects...
      </td>
      </tr>
    `;
    return;
  }

  if (subjects.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; color: #777; padding: 20px;">
          No subjects found.
        </td>
      </tr>
    `;
    return;
  }

  const rowsHTML = subjects
    .map((subject) => {
      const departmentName = subject.departments?.name
        ? escapeHTML(subject.departments.name)
        : "—";
      const subjectName = escapeHTML(subject.name);
      const descriptionText = subject.description
        ? escapeHTML(subject.description)
        : "—";

      const isInactive = String(subject.status).toLowerCase() === "inactive";
      const statusText = isInactive ? "Inactive" : "Active";
      const statusClass = isInactive
        ? "subjects-status-inactive"
        : "subjects-status-active";

      return `
      <tr data-subject-id="${subject.id}">
        <td>${subjectName}</td>
        <td>${departmentName}</td>
        <td>${descriptionText}</td>
        <td>
          <span class="${statusClass}">${statusText}</span>
        </td>
        <td>${formatDateTime(subject.created_at)}</td>
        <td>${formatDateTime(subject.updated_at)}</td>
        <td>
          <button class="subjects-actions-btn edit" data-id="${subject.id}" title="Edit Subject">
            <i class="fa-solid fa-pen"></i>
          </button>
        </td>
      </tr>
    `;
    })
    .join("");

  tbody.innerHTML = rowsHTML;
}

async function populateSubjectFilterDropdowns() {
  const deptSelect = document.getElementById("filterDepartmentSelect");
  if (!deptSelect) return;

  const { data: subjects, error } = await supabaseClient
    .from("subjects")
    .select(
      `
      department_id,
      departments ( id, name )
    `,
    )

  if (error) {
    console.error(
      "Error fetching filter departments from subjects:",
      error.message,
    );
    return;
  }

  const uniqueDepartments = new Map();

  subjects?.forEach((item) => {
    if (item.departments?.id && item.departments?.name) {
      uniqueDepartments.set(item.departments.id, item.departments.name);
    }
  });

  const selectedDept = deptSelect.value;
  deptSelect.innerHTML = `<option value="">All Departments</option>`;

  uniqueDepartments.forEach((name, id) => {
    deptSelect.add(new Option(name, id));
  });

  if (uniqueDepartments.has(selectedDept)) {
    deptSelect.value = selectedDept;
  }
}

let initialSubjectData = null;

async function populateEditDepartmentDropdown() {
  const deptSelect = document.getElementById("editDepartmentSelect");
  if (!deptSelect) return;

  const { data: departments, error } = await supabaseClient
    .from("departments")
    .select("id, name")
    .eq("status", "active")
    .order("name");

  if (error) {
    console.error("Error fetching active departments:", error.message);
    return;
  }

  deptSelect.innerHTML = `<option value="">Select department</option>`;
  departments?.forEach((dept) => {
    deptSelect.add(new Option(dept.name, dept.id));
  });
}

async function openEditSubjectModal(subjectId) {
  try {
    await populateEditDepartmentDropdown();

    const { data: subject, error } = await supabaseClient
      .from("subjects")
      .select("id, name, department_id, status, description")
      .eq("id", subjectId)
      .single();

    if (error || !subject) {
      showToast("Could not load subject details.", "error");
      return;
    }

    document.getElementById("editSubjectId").value = subject.id;
    document.getElementById("editSubjectNameInput").value = subject.name || "";
    document.getElementById("editDepartmentSelect").value =
      subject.department_id || "";
    document.getElementById("editStatusSelect").value =
      subject.status || "Active";
    document.getElementById("editDescriptionInput").value =
      subject.description || "";

    initialSubjectData = {
      name: subject.name || "",
      department_id: subject.department_id || "",
      status: subject.status || "Active",
      description: subject.description || "",
    };

    const modal = document.getElementById("editSubjectModal");
    if (modal) modal.style.display = "flex";
    if (typeof lockBodyScroll === "function") lockBodyScroll();
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function handleUpdateSubject(event) {
  event.preventDefault();

  const id = document.getElementById("editSubjectId").value;
  const name = document.getElementById("editSubjectNameInput").value.trim();
  const departmentId =
    document.getElementById("editDepartmentSelect").value || null;
  const status = document.getElementById("editStatusSelect").value;
  const description = document
    .getElementById("editDescriptionInput")
    .value.trim();

  if (!name || !status) {
    showToast("Please fill in all required fields.", "error");
    return;
  }

  const currentData = {
    name,
    department_id: departmentId || "",
    status,
    description,
  };

  const isUnchanged =
    currentData.name === initialSubjectData?.name &&
    currentData.department_id === initialSubjectData?.department_id &&
    currentData.status === initialSubjectData?.status &&
    currentData.description === initialSubjectData?.description;

  if (isUnchanged) {
    showToast("No changes detected.", "info");
    return;
  }

  const form = event.target;
  const updateBtn =
    document.getElementById("updateSubjectBtn") ||
    form.querySelector('button[type="submit"]');

  try {
    if (updateBtn) {
      updateBtn.disabled = true;
      updateBtn.innerHTML = `Updating...`;
    }

    const { data, error } = await supabaseClient
      .from("subjects")
      .update({
        name,
        department_id: departmentId,
        status,
        description: description || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select();

    if (error) {
      if (error.code === "23505") {
        showToast(
          "This subject name already exists. Please choose another.",
          "error",
        );
        return;
      }
      showToast(error.message, "error");
      return;
    }

    if (!data || data.length === 0) {
      showToast("You do not have permission to update this subject.", "error");
      return;
    }

    showToast("Subject updated successfully!", "success");
    closeEditModal();
    if (typeof unLockBodyScroll === "function") {
      unLockBodyScroll();
    }

    if (typeof populateSubjectFilterDropdowns === "function") {
      await populateSubjectFilterDropdowns();
    }

    if (typeof fetchFilteredSubjects === "function") {
      await fetchFilteredSubjects();
    }
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    if (updateBtn) {
      updateBtn.disabled = false;
      updateBtn.textContent = "Update Subject";
    }
  }
}

function closeEditModal() {
  const modal = document.getElementById("editSubjectModal");
  if (modal) modal.style.display = "none";
  unLockBodyScroll();
  initialSubjectData = null;
}

document.addEventListener("DOMContentLoaded", async () => {
  const searchInput = document.getElementById("searchSubjectInput");
  const filterDept = document.getElementById("filterDepartmentSelect");
  const filterStatus = document.getElementById("filterStatusSelect");

  searchInput?.addEventListener("input", () => {
    clearTimeout(searchDebounceTimeout);
    searchDebounceTimeout = setTimeout(() => {
      fetchFilteredSubjects();
    }, 300);
  });

  filterDept?.addEventListener("change", fetchFilteredSubjects);
  filterStatus?.addEventListener("change", fetchFilteredSubjects);

  await populateSubjectFilterDropdowns();
  await fetchFilteredSubjects();

  const subjectForm = document.getElementById("subjectForm");
  subjectForm?.addEventListener("submit", handleAddSubject);

  await populateDepartmentDropdown();

  document
    .getElementById("editSubjectForm")
    ?.addEventListener("submit", handleUpdateSubject);
  document
    .getElementById("closeEditSubjectModal")
    ?.addEventListener("click", closeEditModal);
  document
    .getElementById("cancelEditSubjectModal")
    ?.addEventListener("click", closeEditModal);
});

document.getElementById("subjectsTableBody")?.addEventListener("click", (e) => {
  const editBtn = e.target.closest(".subjects-actions-btn.edit");

  if (editBtn) {
    const subjectId = editBtn.dataset.id;
    if (typeof openEditSubjectModal === "function") {
      openEditSubjectModal(subjectId);
    }
  }
});

