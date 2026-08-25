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
const editButtons = document.querySelectorAll(".edit");

editButtons.forEach((button) => {
  button.addEventListener("click", () => {
    editSubjectModal.style.display = "flex";

    lockBodyScroll();
  });
});

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

const archiveSubjectModal = document.getElementById("archiveSubjectModal");

const archiveButtons = document.querySelectorAll(".archive");

const cancelArchive = document.getElementById("cancelArchive");

archiveButtons.forEach((button) => {
  button.addEventListener("click", () => {
    archiveSubjectModal.style.display = "flex";

    lockBodyScroll();
  });
});

window.addEventListener("click", (e) => {
  if (e.target === archiveSubjectModal) {
    archiveSubjectModal.style.display = "none";

    unLockBodyScroll();
  }
});

// 1. Populate Department Dropdown (Active only)
async function populateDepartmentDropdown() {
  const departmentSelect = document.getElementById("departmentSelect");
  if (!departmentSelect) return;

  const { data: departments, error } = await supabaseClient
    .from("departments")
    .select("id, name")
    .eq("status", "active")
    .eq("is_archived", false)
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

// 2. Handle Add/Create Subject Form Submission
async function handleAddSubject(event) {
  event.preventDefault();

  const name = document.getElementById("subjectNameInput").value.trim();
  const departmentId =
    document.getElementById("departmentSelect").value || null;
  const status = document.getElementById("statusSelect").value;
  const description = document.getElementById("descriptionInput").value.trim();

  // Client-side Validation
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

    // Insert into Supabase
    const { data, error } = await supabaseClient
      .from("subjects")
      .insert([
        {
          name,
          department_id: departmentId,
          status,
          description: description || null,
          is_archived: false,
        },
      ])
      .select();

    if (error) {
      if (error.code === "23505") {
        showToast(
          "This subject name already exists (including in archives). Please choose a different name.",
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

    // Close modal if toggle function exists
    if (typeof closeSubjectModal === "function") {
      closeSubjectModal();
    }

    if (typeof loadSubjects === "function") {
      await loadSubjects();
    }
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

// Utility for safe HTML escaping to prevent XSS vulnerabilities
function escapeHTML(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Utility to format timestamps nicely
function formatDateTime(isoString) {
  if (!isoString) return "N/A";
  const date = new Date(isoString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// 1. Fetch Filtered & Searchable Subjects
async function fetchFilteredSubjects() {
  const searchQuery =
    document.getElementById("searchSubjectInput")?.value.trim() || "";
  const departmentId =
    document.getElementById("filterDepartmentSelect")?.value || "";
  const statusFilter =
    document.getElementById("filterStatusSelect")?.value?.toLowerCase() || "";

  // Show loading indicator in table
  renderSubjectsTable([], true);

  // Perform targeted relational JOIN selecting only columns needed for rendering
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

  // Hard exclusion of archived rows at the query level
  query = query.eq("is_archived", false);

  // Database-level Foreign Key & Status Filtering
  if (departmentId) {
    query = query.eq("department_id", departmentId);
  }

  if (statusFilter === "active") {
    query = query.eq("status", "Active");
  } else if (statusFilter === "inactive") {
    query = query.eq("status", "Inactive");
  }

  // Server-side text search filter
  if (searchQuery) {
    // Correct format: name.ilike.%term%,description.ilike.%term% (NO extra parentheses around the whole string)
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

// 2. High-Performance Batch DOM Renderer
function renderSubjectsTable(subjects, isLoading = false) {
  const tbody = document.getElementById("subjectsTableBody");
  if (!tbody) return;

  // 1. Loading State UI
  if (isLoading) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 2rem; color: #64748b;">
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

  // Build HTML fragment in-memory to prevent browser layout thrashing
  const rowsHTML = subjects
    .map((subject) => {
      // With this line:
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
          <button class="subjects-actions-btn archive" data-id="${subject.id}" title="Archive Subject">
            <i class="fa-solid fa-box-archive"></i>
          </button>
        </td>
      </tr>
    `;
    })
    .join("");

  tbody.innerHTML = rowsHTML;
}
// Populate Department Filter using only departments assigned in subjects
async function populateSubjectFilterDropdowns() {
  const deptSelect = document.getElementById("filterDepartmentSelect");
  if (!deptSelect) return;

  // Query subjects to extract only assigned, non-archived department relationships
  const { data: subjects, error } = await supabaseClient
    .from("subjects")
    .select(
      `
      department_id,
      departments ( id, name )
    `,
    )
    .eq("is_archived", false);

  if (error) {
    console.error(
      "Error fetching filter departments from subjects:",
      error.message,
    );
    return;
  }

  // Deduplicate departments using a Map
  const uniqueDepartments = new Map();

  subjects?.forEach((item) => {
    if (item.departments?.id && item.departments?.name) {
      uniqueDepartments.set(item.departments.id, item.departments.name);
    }
  });

  // Preserve current selection
  const selectedDept = deptSelect.value;
  deptSelect.innerHTML = `<option value="">All Departments</option>`;

  uniqueDepartments.forEach((name, id) => {
    deptSelect.add(new Option(name, id));
  });

  // Restore previous user choice if it still exists in the map
  if (uniqueDepartments.has(selectedDept)) {
    deptSelect.value = selectedDept;
  }
}

// Variable to hold initial values for change detection
let initialSubjectData = null;

// 1. Populate Edit Modal Department Dropdown
async function populateEditDepartmentDropdown() {
  const deptSelect = document.getElementById("editDepartmentSelect");
  if (!deptSelect) return;

  const { data: departments, error } = await supabaseClient
    .from("departments")
    .select("id, name")
    .eq("status", "active")
    .eq("is_archived", false)
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

// 2. Load Subject Data into Edit Modal
async function openEditSubjectModal(subjectId) {
  try {
    // Populate active departments first
    await populateEditDepartmentDropdown();

    // Fetch existing subject details
    const { data: subject, error } = await supabaseClient
      .from("subjects")
      .select("id, name, department_id, status, description")
      .eq("id", subjectId)
      .single();

    if (error || !subject) {
      showToast("Could not load subject details.", "error");
      return;
    }

    // Set hidden ID and form input values
    document.getElementById("editSubjectId").value = subject.id;
    document.getElementById("editSubjectNameInput").value = subject.name || "";
    document.getElementById("editDepartmentSelect").value =
      subject.department_id || "";
    document.getElementById("editStatusSelect").value =
      subject.status || "Active";
    document.getElementById("editDescriptionInput").value =
      subject.description || "";

    // Store current state snapshot to detect changes later
    initialSubjectData = {
      name: subject.name || "",
      department_id: subject.department_id || "",
      status: subject.status || "Active",
      description: subject.description || "",
    };

    // Show modal (or call your UI toggle function)
    const modal = document.getElementById("editSubjectModal");
    if (modal) modal.style.display = "flex";
  } catch (err) {
    showToast(err.message, "error");
  }
}

// 3. Handle Edit Form Submission with Change Detection
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

  // Client-side Validation
  if (!name || !status) {
    showToast("Please fill in all required fields.", "error");
    return;
  }

  // Change Detection Check
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

    // Update in Supabase
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

    // If data array is empty, RLS blocked the update silently
    if (!data || data.length === 0) {
      showToast("You do not have permission to update this subject.", "error");
      return;
    }

    showToast("Subject updated successfully!", "success");
    closeEditModal();

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

// Utility to close edit modal
function closeEditModal() {
  const modal = document.getElementById("editSubjectModal");
  if (modal) modal.style.display = "none";
  initialSubjectData = null;
}

// 4. Delegation Event Listener for Edit Action Buttons
document.getElementById("subjectsTableBody")?.addEventListener("click", (e) => {
  const editBtn = e.target.closest(".subjects-actions-btn.edit");
  if (editBtn) {
    const subjectId = editBtn.dataset.id;
    openEditSubjectModal(subjectId);
  }
});

// Event Listeners for Modal Controls
document
  .getElementById("editSubjectForm")
  ?.addEventListener("submit", handleUpdateSubject);
document
  .getElementById("closeEditSubjectModal")
  ?.addEventListener("click", closeEditModal);
document
  .getElementById("cancelEditSubjectModal")
  ?.addEventListener("click", closeEditModal);

// 4. Initializer & Event Listeners
document.addEventListener("DOMContentLoaded", async () => {
  const searchInput = document.getElementById("searchSubjectInput");
  const filterDept = document.getElementById("filterDepartmentSelect");
  const filterStatus = document.getElementById("filterStatusSelect");

  // Debounced input search
  searchInput?.addEventListener("input", () => {
    clearTimeout(searchDebounceTimeout);
    searchDebounceTimeout = setTimeout(() => {
      fetchFilteredSubjects();
    }, 300);
  });

  // Instant filtering on select change
  filterDept?.addEventListener("change", fetchFilteredSubjects);
  filterStatus?.addEventListener("change", fetchFilteredSubjects);

  // Load dropdown choices first, then execute data query
  await populateSubjectFilterDropdowns();
  await fetchFilteredSubjects();

  const subjectForm = document.getElementById("subjectForm");
  subjectForm?.addEventListener("submit", handleAddSubject);

  await populateDepartmentDropdown();
});

let targetSubjectIdToArchive = null;

// 1. Open Archive Modal & Set Target ID
function openArchiveModal(subjectId, subjectName = "") {
  targetSubjectIdToArchive = subjectId;

  const textElem = document.getElementById("archiveModalText");
  if (textElem) {
    textElem.textContent = subjectName
      ? `Are you sure you want to archive "${subjectName}"?`
      : "Are you sure you want to archive this subject?";
  }

  const modal = document.getElementById("archiveSubjectModal");
  if (modal) modal.style.display = "flex";
}

// 2. Close Archive Modal
function closeArchiveModal() {
  const modal = document.getElementById("archiveSubjectModal");
  if (modal) modal.style.display = "none";
  targetSubjectIdToArchive = null;
}

// 3. Confirm Archive Database Mutation
async function handleConfirmArchive() {
  if (!targetSubjectIdToArchive) return;

  const confirmBtn = document.getElementById("confirmArchiveBtn");

  try {
    if (confirmBtn) {
      confirmBtn.disabled = true;
      confirmBtn.innerHTML = `Archiving...`;
    }

    // Soft delete / archive in Supabase
    const { data, error } = await supabaseClient
      .from("subjects")
      .update({
        is_archived: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", targetSubjectIdToArchive)
      .select();
    if (error) {
      showToast(error.message, "error");
      return;
    }

    // If data array is empty, RLS blocked the update silently
    if (!data || data.length === 0) {
      showToast("You do not have permission to archive this subject.", "error");
      return;
    }

    showToast("Subject archived successfully!", "success");
    closeArchiveModal();

    // Refresh table and dropdown filters dynamically
    if (typeof populateSubjectFilterDropdowns === "function") {
      await populateSubjectFilterDropdowns();
    }
    if (typeof fetchFilteredSubjects === "function") {
      await fetchFilteredSubjects();
    }
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.textContent = "Archive";
    }
  }
}

// 4. Delegation Event Listener for Table Clicks
document.getElementById("subjectsTableBody")?.addEventListener("click", (e) => {
  const archiveBtn = e.target.closest(".subjects-actions-btn.archive");
  if (archiveBtn) {
    const subjectId = archiveBtn.dataset.id;

    // Grab name from parent row for confirmation text
    const row = archiveBtn.closest("tr");
    const subjectName = row?.querySelector("td strong")?.textContent || "";

    openArchiveModal(subjectId, subjectName);
  }
});

// Modal Event Listeners
document
  .getElementById("confirmArchiveBtn")
  ?.addEventListener("click", handleConfirmArchive);
document
  .getElementById("cancelArchiveModal")
  ?.addEventListener("click", closeArchiveModal);
