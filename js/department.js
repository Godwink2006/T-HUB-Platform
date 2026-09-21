const departmentModal = document.getElementById("departmentModal");

const cancelDepartmentModal = document.getElementById("cancelDepartmentModal");

const openDepartmentModal = document.getElementById("addDepartment");

const closeDepartmentModal = document.getElementById("closeDepartmentModal");

if (openDepartmentModal && departmentModal) {
  openDepartmentModal.addEventListener("click", () => {
    departmentModal.style.display = "flex";
    lockBodyScroll();
  });
}

if (closeDepartmentModal && departmentModal) {
  closeDepartmentModal.addEventListener("click", () => {
    departmentModal.style.display = "none";
    unLockBodyScroll();
  });
}

if (cancelDepartmentModal && departmentModal) {
  cancelDepartmentModal.addEventListener("click", () => {
    departmentModal.style.display = "none";
    unLockBodyScroll();
  });
}

const closeEditDepartmentModal = document.getElementById(
  "closeEditDepartmentModal",
);
const cancelEditDepartmentModal = document.getElementById(
  "cancelEditDepartmentModal",
);
const editDepartmentModal = document.getElementById("editDepartmentModal");
const editDepartmentButtons = document.querySelectorAll(".edit-Department");

closeEditDepartmentModal.addEventListener("click", () => {
  editDepartmentModal.style.display = "none";

  unLockBodyScroll();
});

cancelEditDepartmentModal.addEventListener("click", () => {
  editDepartmentModal.style.display = "none";

  unLockBodyScroll();
});

window.addEventListener("click", (e) => {
  if (e.target === departmentModal) {
    departmentModal.style.display = "none";
    unLockBodyScroll();
  }
  if (e.target === editDepartmentModal) {
    editDepartmentModal.style.display = "none";
    unLockBodyScroll();
  }
  if (e.target === archiveDepartmentModal) {
    archiveDepartmentModal.style.display = "none";
    unLockBodyScroll();
  }
});

const archiveDepartmentModal = document.getElementById(
  "archiveDepartmentModal",
);

const archiveButtons = document.querySelectorAll(".archive-Department");

const cancelArchive = document.getElementById("cancelArchive");

cancelArchive.addEventListener("click", () => {
  archiveDepartmentModal.style.display = "none";

  unLockBodyScroll();
});

function escapeAttribute(str) {
  if (!str) return "";
  return String(str)
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function loadDepartments() {
  const tbody = document.getElementById("departmentsTableBody");

  if (!tbody) return;

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
  <td>${escapeHTML(item.name || "-")}</td>
  <td>${escapeHTML(descriptionText || "-")}</td>
  <td>
    <span class="${status}">${statusText}</span>
  </td>
  <td>${formatDateTime(item.created_at)}</td>
  <td>${formatDateTime(item.updated_at)}</td>
  <td>
    <button class="departments-actions-btn edit-Department" onclick="openEditModal('${item.id}')">
      <i class="fa-solid fa-pen"></i>
    </button>
    <button class="departments-actions-btn archive-Department" onclick="openArchiveModal('${item.id}', '${escapeAttribute(item.name)}')">
  <i class="fa-solid fa-box-archive"></i>
</button>
  </td>
`;

    tbody.appendChild(tr);
  });
}

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
        showToast("This department name already exists.", "error");
        return;
      }
      if (error.code === "42501") {
        showToast("You do not have permission to add a department.", "error");
        return;
      }
      showToast(error.message, "error");
      return;
    }

    if (!data || data.length === 0) {
      showToast("You do not have permission to add a department.", "error");
      return;
    }

    showToast("Department created successfully!", "success");
    form.reset();
    if (departmentModal) {
      departmentModal.style.display = "none";
      unLockBodyScroll();
    }
    await loadDepartments();
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save";
    }
  }
}

const departmentForm = document.getElementById("departmentForm");
if (departmentForm) {
  departmentForm.addEventListener("submit", handleAddClass);
}

function showModalById(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = "flex";
    lockBodyScroll();
  }
}

let originalDepartmentData = null;

async function openEditModal(departmentId) {
  if (!window.supabaseClient) {
    console.error("Supabase client is not initialized.");
    return;
  }

  try {
    const { data, error } = await supabaseClient
      .from("departments")
      .select("*")
      .eq("id", departmentId)
      .single();

    if (error || !data) {
      if (typeof showToast === "function") {
        showToast("Failed to fetch department details.", "error");
      }
      return;
    }

    originalDepartmentData = { ...data };

    const idInput = document.getElementById("editDepartmentId");
    const nameInput = document.getElementById("editDepartmentName");
    const statusInput = document.getElementById("editStatus");
    const descInput = document.getElementById("editDescription");

    if (idInput) idInput.value = data.id;
    if (nameInput) nameInput.value = data.name || "";
    if (statusInput) statusInput.value = data.status || "";
    if (descInput) descInput.value = data.description || "";

    showModalById("editDepartmentModal");
  } catch (err) {
    if (typeof showToast === "function") {
      showToast(err.message || "An error occurred.", "error");
    }
  }
}

async function handleEditDepartment(event) {
  event.preventDefault();

  const departmentId = document.getElementById("editDepartmentId").value;
  const name = document.getElementById("editDepartmentName").value.trim();
  const status = document.getElementById("editStatus").value;
  const description = document.getElementById("editDescription").value.trim();

  if (!name || !status) {
    showToast("Please fill in all required fields.", "error");
    return;
  }

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
      .select();

    if (error) {
      if (error.code === "23505") {
        showToast("This department name already exists.", "error");
        return;
      }
      if (error.code === "42501") {
        showToast(
          "You do not have permission to update a department.",
          "error",
        );
        return;
      }
      showToast(error.message, "error");
      return;
    }

    if (!data || data.length === 0) {
      showToast("You do not have permission to update a department.", "error");
      return;
    }

    showToast("Department updated successfully!", "success");
    originalDepartmentData = null;
    const editModalEl = document.getElementById("editDepartmentModal");
    if (editModalEl) editModalEl.style.display = "none";
    if (typeof unLockBodyScroll === "function") unLockBodyScroll();
    await loadDepartments();
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Update";
    }
  }
}

const editDepartmentForm = document.getElementById("editDepartmentForm");
if (editDepartmentForm) {
  editDepartmentForm.addEventListener("submit", handleEditDepartment);
}
let departmentToArchiveId = null;

function openArchiveModal(departmentId, departmentName) {
  departmentToArchiveId = departmentId;

  const archiveModal = document.getElementById("archiveDepartmentModal");
  if (archiveModal) {
    const nameElement = document.getElementById("archiveDepartmentName");
    if (nameElement) {
      nameElement.textContent = departmentName || "this department";
    }

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

    const { data, error } = await supabaseClient
      .from("departments")
      .update({
        is_archived: true,
        status: "inactive",
        updated_at: new Date().toISOString(),
      })
      .eq("id", departmentToArchiveId)
      .select();

    if (error) {
      showToast(
        "Permission denied: Only active admins can archive departments.",
        "error",
      );
      return;
    }

    if (!data || data.length === 0) {
      showToast(
        "Permission denied: Only active admins can archive departments.",
        "error",
      );
      return;
    }

    showToast("Department archived successfully!", "success");

    if (archiveModal) {
      archiveModal.style.display = "none";
      if (typeof unLockBodyScroll === "function") unLockBodyScroll();
    }

    departmentToArchiveId = null;
    await loadDepartments();
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.textContent = "Archive";
    }
  }
}

const confirmArchiveBtn = document.getElementById("confirmArchive");
if (confirmArchiveBtn) {
  confirmArchiveBtn.addEventListener("click", handleConfirmArchive);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    if (typeof loadDepartments === "function") loadDepartments();
  });
} else {
  if (typeof loadDepartments === "function") loadDepartments();
}

