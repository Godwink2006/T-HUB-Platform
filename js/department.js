const departmentModal = document.getElementById("departmentModal");

const cancelDepartmentModal = document.getElementById("cancelDepartmentModal");

const openDepartmentModal = document.getElementById("addDepartment");

const closeDepartmentModal = document.getElementById("closeDepartmentModal");

openDepartmentModal.addEventListener("click", () => {
  departmentModal.style.display = "flex";

  lockBodyScroll();
});

closeDepartmentModal.addEventListener("click", () => {
  departmentModal.style.display = "none";

  unLockBodyScroll();
});

cancelDepartmentModal.addEventListener("click", () => {
  departmentModal.style.display = "none";

  unLockBodyScroll();
});

window.addEventListener("click", (e) => {
  if (e.target === departmentModal) {
    departmentModal.style.display = "none";

    unLockBodyScroll();
  }
});

const closeEditDepartmentModal = document.getElementById(
  "closeEditDepartmentModal",
);
const cancelEditDepartmentModal = document.getElementById(
  "cancelEditDepartmentModal",
);
const editDepartmentModal = document.getElementById("editDepartmentModal");
const editDepartmentButtons = document.querySelectorAll(".edit-Department");

editDepartmentButtons.forEach((button) => {
  button.addEventListener("click", () => {
    editDepartmentModal.style.display = "flex";

    lockBodyScroll();
  });
});

closeEditDepartmentModal.addEventListener("click", () => {
  editDepartmentModal.style.display = "none";

  unLockBodyScroll();
});

cancelEditDepartmentModal.addEventListener("click", () => {
  editDepartmentModal.style.display = "none";

  unLockBodyScroll();
});

window.addEventListener("click", (e) => {
  if (e.target === editDepartmentModal) {
    editDepartmentModal.style.display = "none";

    unLockBodyScroll();
  }
});

const archiveDepartmentModal = document.getElementById(
  "archiveDepartmentModal",
);

const archiveButtons = document.querySelectorAll(".archive-Department");

const cancelArchive = document.getElementById("cancelArchive");

archiveButtons.forEach((button) => {
  button.addEventListener("click", () => {
    archiveDepartmentModal.style.display = "flex";

    lockBodyScroll();
  });
});

cancelArchive.addEventListener("click", () => {
  archiveDepartmentModal.style.display = "none";

  unLockBodyScroll();
});

window.addEventListener("click", (e) => {
  if (e.target === archiveDepartmentModal) {
    archiveDepartmentModal.style.display = "none";

    unLockBodyScroll();
  }
});

// 1. Fetch Departments from Supabase
async function loadDepartments() {
  const tbody = document.getElementById("departmentsTableBody");

  // Guard clause: stop execution ONLY if the element is missing
  if (!tbody) return;

  // Loading indicator
  tbody.innerHTML = `
    <tr>
      <td colspan="6" style="text-align: center; padding: 2rem; color: #64748b;">
        <i class="fa-solid fa-spinner fa-spin" style="margin-right: 0.5rem;"></i>
        Loading departments...
      </td>
    </tr>
  `;

  try {
    const { data, error } = await supabaseClient
      .from("departments")
      .select("*")
      .eq("is_archived", false)
      .order("created_at", { ascending: false });

    if (error) throw error;

    currentDepartmentsData = data || [];
    renderDepartmentsTable(currentDepartmentsData);
  } catch (err) {
    console.error("Fetch Error:", err.message);
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">Failed to load departments.</td></tr>`;
  }
}

// 2. Render Rows to Table
function renderDepartmentsTable(departments) {
  const tbody = document.getElementById("departmentsTableBody");
  tbody.innerHTML = "";

  if (departments.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">No departments found.</td></tr>`;
    return;
  }

  departments.forEach((item) => {
    const tr = document.createElement("tr");

    const isStatusActive = item.status === "active";
    const status = isStatusActive
      ? "departments-status-active"
      : "departments-status-inactive";
    const statusText = isStatusActive ? "Active" : "Inactive";
    const descriptionText = item.description || "-";

    tr.innerHTML = `
  <td>${item.name}</td>
  <td>${descriptionText}</td>
  <td>
    <span class="${status}">${statusText}</span>
  </td>
  <td>${formatDateTime(item.created_at)}</td>
  <td>${formatDateTime(item.updated_at)}</td>
  <td>
    <button class="departments-actions-btn edit-Department" onclick="openEditModal('${item.id}')">
      <i class="fa-solid fa-pen"></i>
    </button>
    <button class="departments-actions-btn archive-Department" onclick="openArchiveModal('${item.id}')">
      <i class="fa-solid fa-box-archive"></i>
    </button>
  </td>
`;

    tbody.appendChild(tr);
  });
}

// 2. For ISO timestamps (created_at, updated_at)
function formatDateTime(isoString) {
  if (!isoString) return "N/A";
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return "N/A";

  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

async function handleAddClass(event) {
  event.preventDefault();

  const name = document.getElementById("departmentName").value.trim();
  const description = document
    .getElementById("departmentDescription")
    .value.trim();
  const status = document.getElementById("departmentStatus").value;

  // 1. Client-side Validation
  if (!name || !status) {
    showToast("Please fill in all required fields.", "error");
    return;
  }

  const form = event.target;
  const saveBtn = form.querySelector('button[type="submit"]');

  try {
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = "Saving...";
    }

    // 2. Insert into Supabase
    const { data, error } = await supabaseClient
      .from("departments")
      .insert([
        {
          name,
          status,
          description: description || null,
          is_archived: false,
        },
      ])
      .select();

    if (error) {
      if (error.code === "23505") {
        showToast(
          "This department name already exists (including in archives). Please choose a different name.",
          "error",
        );
        return;
      }

      if (error.code === "42501") {
        showToast("You do not have permission to add a department.", "error");
        return;
      }
      showToast(error.message, "error");
      return;
    }

    showToast("Department created successfully!", "success");
    form.reset();
    await loadDepartments(); // Function to reload your table data
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save";
    }
  }
}

// 3. Attach Event Listener
document
  .getElementById("departmentForm")
  .addEventListener("submit", handleAddClass);

// Rename this function to avoid overwriting async function openEditModal
function showModalById(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = "flex";
    lockBodyScroll();
  }
}

let originalDepartmentData = null;

// 1. Open Edit Modal & Populate Form Data
async function openEditModal(departmentId) {
  try {
    const { data, error } = await supabaseClient
      .from("departments")
      .select("*")
      .eq("id", departmentId)
      .single();

    if (error || !data) {
      showToast("Failed to fetch department details.", "error");
      return;
    }

    // Cache original values to detect changes later
    originalDepartmentData = { ...data };

    // Fill form fields
    document.getElementById("editDepartmentId").value = data.id;
    document.getElementById("editDepartmentName").value = data.name;
    document.getElementById("editStatus").value = data.status;
    document.getElementById("editDescription").value = data.description || "";

    showModalById("editDepartmentModal");
  } catch (err) {
    showToast(err.message, "error");
  }
}

// 2. Form Submit Handler for Updating
async function handleEditDepartment(event) {
  event.preventDefault();

  const departmentId = document.getElementById("editDepartmentId").value;
  const name = document.getElementById("editDepartmentName").value.trim();
  const status = document.getElementById("editStatus").value;
  const description = document.getElementById("editDescription").value.trim();

  // Basic validation
  if (!name || !status) {
    showToast("Please fill in all required fields.", "error");
    return;
  }

  // Check if any value changed
  const isUnchanged =
    originalDepartmentData &&
    originalDepartmentData.name === name &&
    originalDepartmentData.status === status &&
    (originalDepartmentData.description || "") === description;

  if (isUnchanged) {
    showToast("No changes detected.", "info");
    return;
  }

  const form = event.target;
  const submitBtn = form.querySelector('button[type="submit"]');

  try {
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Updating...";
    }

    const { data, error } = await supabaseClient
      .from("departments")
      .update({
        name,
        status,
        description: description || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", departmentId)
      .select(); // <--- ADD .select() to return the updated row

    if (error) {
      if (error.code === "23505") {
        showToast(
          "This department name already exists (including in archives). Please choose a different name.",
          "error",
        );
        return;
      }

      if (error.code === "42501") {
        showToast("You do not have permission to add a department.", "error");
        return;
      }

      showToast(error.message, "error");
      return;
    }

    showToast("Department updated successfully!", "success");
    // Close modal
    editDepartmentModal.style.display = "none";
    unLockBodyScroll();
    await loadDepartments(); // Refresh main table
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Update";
    }
  }
}

// Attach Event Listeners
document
  .getElementById("editDepartmentForm")
  .addEventListener("submit", handleEditDepartment);

let departmentToArchiveId = null;

// 1. Open Archive Confirmation Modal
function openArchiveModal(departmentId) {
  departmentToArchiveId = departmentId;

  const archiveModal = document.getElementById("archiveDepartmentModal");
  if (archiveModal) {
    archiveModal.style.display = "flex";
    if (typeof lockBodyScroll === "function") lockBodyScroll();
  }
}

async function handleConfirmArchive() {
  if (!departmentToArchiveId) return;

  const confirmBtn = document.getElementById("confirmArchive");
  const archiveModal = document.getElementById("archiveDepartmentModal");

  try {
    if (confirmBtn) {
      confirmBtn.disabled = true;
      confirmBtn.textContent = "Archiving...";
    }

    // Archiving is an UPDATE operation in Supabase
    const { data, error } = await supabaseClient
      .from("departments")
      .update({
        is_archived: true,
        status: "inactive",
        updated_at: new Date().toISOString(),
      })
      .eq("id", departmentToArchiveId)
      .select(); // <--- ADD .select() to return the updated row

    // 1. Handle hard database errors
    if (error) {
      showToast(
        "Permission denied: Only active admins can archive departments.",
        "error",
      );
      return;
    }

    // 2. Handle RLS silent block (0 rows modified)
    if (!data || data.length === 0) {
      showToast(
        "Permission denied: Only active admins can archive departments.",
        "error",
      );
      return;
    }

    // 3. True success
    showToast("Department archived successfully!", "success");

    // Close modal using direct DOM manipulation
    if (archiveModal) {
      archiveModal.style.display = "none";
      if (typeof unLockBodyScroll === "function") unLockBodyScroll();
    }

    departmentToArchiveId = null;
    await loadDepartments(); // Reload active departments table
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.textContent = "Archive";
    }
  }
}

// Attach Confirm Event Listener
document
  .getElementById("confirmArchive")
  ?.addEventListener("click", handleConfirmArchive);

// Add this at the bottom of your file
document.addEventListener("DOMContentLoaded", () => {
  loadDepartments();
});
