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
      // Catch capacity or check constraint failures
      if (error.code === "23514") {
        showToast(
          "Invalid data submitted. Check capacity and selected level.",
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

// Add this at the bottom of your file
document.addEventListener("DOMContentLoaded", () => {
  loadDepartments();
});
