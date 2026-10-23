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

function getDepartmentErrorMessage(error, action) {
  const code = String(error?.code || "").toUpperCase();
  const status = Number(error?.status || error?.statusCode || 0);
  const diagnostic = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`.toLowerCase();

  if (/school.{0,30}inactive|inactive.{0,30}school|school is not active/.test(diagnostic)) {
    return "This school is inactive. You can view existing departments, but you cannot make changes until the school is reactivated.";
  }
  if (code === "23505") {
    return "A department with this name already exists.";
  }
  if (
    code === "42501" ||
    status === 403 ||
    /row-level security|permission denied|insufficient privilege|not authorized|not allowed/.test(diagnostic)
  ) {
    if (action === "load") {
      return "You do not have permission to view departments for this school.";
    }
    return `Could not ${action} this department. This school may be inactive, or your account may not have permission.`;
  }
  if (
    status === 401 ||
    code === "PGRST301" ||
    /invalid jwt|session.*expired|refresh token/.test(diagnostic)
  ) {
    return "Your session has expired. Sign in again and retry.";
  }
  if (/failed to fetch|network|connection|timeout|timed out/.test(diagnostic)) {
    return "Could not connect to load departments. Check your internet connection and try again.";
  }
  if (code === "PGRST116") {
    return action === "load"
      ? "This department is unavailable or you do not have permission to view it. Refresh the page and try again."
      : "This department is no longer available to update. Refresh the page and try again.";
  }
  if (code === "23503" || code === "23514" || code === "22P02") {
    return "Some department information is invalid or linked to another record. Review the details and try again.";
  }
  return action === "load"
    ? "Could not load departments. Please try again."
    : `Could not ${action} this department. Please try again.`;
}

function showDepartmentError(error, action) {
  console.error(`Departments page ${action} error:`, error);
  const message = getDepartmentErrorMessage(error, action);
  if (typeof showToast === "function") showToast(message, "error");
  return message;
}

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
    if (!window.supabaseClient) {
      const message = showDepartmentError(
        new Error("Supabase client is not initialized."),
        "load",
      );
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px;">${escapeHTML(message)}</td></tr>`;
      return;
    }

    const { data, error } = await supabaseClient
      .from("departments")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    currentDepartmentsData = data || [];
    renderDepartmentsTable(currentDepartmentsData);
  } catch (err) {
    const message = showDepartmentError(err, "load");
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px;">${escapeHTML(message)}</td></tr>`;
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
        },
      ])
      .select();

    if (error) {
      showDepartmentError(error, "create");
      return;
    }

    if (!data || data.length === 0) {
      showDepartmentError({ code: "42501" }, "create");
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
    showDepartmentError(err, "create");
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
    showDepartmentError(new Error("Supabase client is not initialized."), "load");
    return;
  }

  try {
    const { data, error } = await supabaseClient
      .from("departments")
      .select("*")
      .eq("id", departmentId)
      .single();

    if (error || !data) {
      showDepartmentError(error || new Error("Department not found."), "load");
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
    showDepartmentError(err, "load");
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
      showDepartmentError(error, "update");
      return;
    }

    if (!data || data.length === 0) {
      showDepartmentError({ code: "42501" }, "update");
      return;
    }

    showToast("Department updated successfully!", "success");
    originalDepartmentData = null;
    const editModalEl = document.getElementById("editDepartmentModal");
    if (editModalEl) editModalEl.style.display = "none";
    if (typeof unLockBodyScroll === "function") unLockBodyScroll();
    await loadDepartments();
  } catch (err) {
    showDepartmentError(err, "update");
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
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    if (typeof loadDepartments === "function") loadDepartments();
  });
} else {
  if (typeof loadDepartments === "function") loadDepartments();
}

