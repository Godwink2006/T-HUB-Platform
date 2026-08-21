const classModal = document.getElementById("classModal");

const cancelClassModal = document.getElementById("cancelClassModal");

const openClassModal = document.getElementById("addClass");

const closeClassModal = document.getElementById("closeClassModal");

openClassModal.addEventListener("click", () => {
  classModal.style.display = "flex";

  lockBodyScroll();
});

closeClassModal.addEventListener("click", () => {
  classModal.style.display = "none";

  unLockBodyScroll();
});

cancelClassModal.addEventListener("click", () => {
  classModal.style.display = "none";

  unLockBodyScroll();
});

window.addEventListener("click", (e) => {
  if (e.target === classModal) {
    classModal.style.display = "none";

    unLockBodyScroll();
  }
});

const closeEditClassModal = document.getElementById("closeEditClassModal");
const cancelEditClassModal = document.getElementById("cancelEditClassModal");
const editClassModal = document.getElementById("editClassModal");
const editButtons = document.querySelectorAll(".edit");

editButtons.forEach((button) => {
  button.addEventListener("click", () => {
    editClassModal.style.display = "flex";

    lockBodyScroll();
  });
});

closeEditClassModal.addEventListener("click", () => {
  editClassModal.style.display = "none";

  unLockBodyScroll();
});

cancelEditClassModal.addEventListener("click", () => {
  editClassModal.style.display = "none";

  unLockBodyScroll();
});

window.addEventListener("click", (e) => {
  if (e.target === editClassModal) {
    editClassModal.style.display = "none";

    unLockBodyScroll();
  }
});

const viewClassModal = document.getElementById("viewClassModal");

const archiveClassModal = document.getElementById("archiveClassModal");

const viewButtons = document.querySelectorAll(".view");

const archiveButtons = document.querySelectorAll(".archive");

const closeViewClassModal = document.getElementById("closeViewClassModal");

const closeViewBtn = document.getElementById("closeViewBtn");

const cancelArchive = document.getElementById("cancelArchive");

viewButtons.forEach((button) => {
  button.addEventListener("click", () => {
    viewClassModal.style.display = "flex";

    lockBodyScroll();
  });
});

closeViewClassModal.addEventListener("click", () => {
  viewClassModal.style.display = "none";

  unLockBodyScroll();
});

closeViewBtn.addEventListener("click", () => {
  viewClassModal.style.display = "none";

  unLockBodyScroll();
});

archiveButtons.forEach((button) => {
  button.addEventListener("click", () => {
    archiveClassModal.style.display = "flex";

    lockBodyScroll();
  });
});

cancelArchive.addEventListener("click", () => {
  archiveClassModal.style.display = "none";

  unLockBodyScroll();
});

window.addEventListener("click", (e) => {
  if (e.target === viewClassModal) {
    viewClassModal.style.display = "none";

    unLockBodyScroll();
  }

  if (e.target === archiveClassModal) {
    archiveClassModal.style.display = "none";

    unLockBodyScroll();
  }
});

let currentClassesData = [];

// Helper to display clean school level names
function formatSchoolLevel(level) {
  const levels = {
    nursery: "Nursery",
    junior_primary: "Junior Primary",
    senior_primary: "Senior Primary",
    junior_secondary: "Junior Secondary",
    senior_secondary: "Senior Secondary",
  };
  return levels[level] || level;
}

// 1. Fetch Classes from Supabase
async function loadClasses() {
  const tbody = document.getElementById("classesTableBody");
  tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">Loading classes...</td></tr>`;

  try {
    const { data, error } = await supabaseClient
      .from("classes")
      .select("*")
      .eq("is_archived", false)
      .order("created_at", { ascending: false });

    if (error) throw error;

    currentClassesData = data || [];
    renderClassesTable(currentClassesData);
  } catch (err) {
    console.error("Fetch Error:", err.message);
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">Failed to load classes.</td></tr>`;
  }
}

// 2. Render Rows to Table
function renderClassesTable(classes) {
  const tbody = document.getElementById("classesTableBody");
  tbody.innerHTML = "";

  if (classes.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">No classes found.</td></tr>`;
    return;
  }

  classes.forEach((item) => {
    const tr = document.createElement("tr");

    const isStatusActive = item.status === "active";
    const statusClass = isStatusActive
      ? "classes-status-active"
      : "classes-status-inactive";
    const statusText = isStatusActive ? "Active" : "Inactive";
    const descriptionText = item.description || "-";

    tr.innerHTML = `
      <td>${item.name}</td>
      <td>${formatSchoolLevel(item.school_level)}</td>
      <td>${item.capacity}</td>
      <td>
        <span class="${statusClass}">${statusText}</span>
      </td>
      <td>${descriptionText}</td>
      <td>
        <button class="classes-actions-btn view" onclick="openViewModal('${item.id}')">
          <i class="fa-solid fa-eye"></i>
        </button>
        <button class="classes-actions-btn edit" onclick="openEditModal('${item.id}')">
          <i class="fa-solid fa-pen"></i>
        </button>
        <button class="classes-actions-btn archive" onclick="openArchiveModal('${item.id}')">
          <i class="fa-solid fa-box-archive"></i>
        </button>
      </td>
    `;

    tbody.appendChild(tr);
  });
}

// 3. Client-Side Search & Filter Handler
function filterClasses() {
  const searchVal = document
    .getElementById("classSearchInput")
    .value.toLowerCase();
  const statusVal = document.getElementById("statusFilter").value;

  const filtered = currentClassesData.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchVal);
    const matchesStatus = statusVal === "all" || item.status === statusVal;
    return matchesSearch && matchesStatus;
  });

  renderClassesTable(filtered);
}

// Attach Event Listeners for Filters & Page Load
document
  .getElementById("classSearchInput")
  .addEventListener("input", filterClasses);
document
  .getElementById("statusFilter")
  .addEventListener("change", filterClasses);
document.addEventListener("DOMContentLoaded", loadClasses);

async function handleAddClass(event) {
  event.preventDefault();

  const name = document.getElementById("className").value.trim();
  const schoolLevel = document.getElementById("schoolLevel").value;
  const capacity = parseInt(document.getElementById("capacity").value, 10);
  const status = document.getElementById("status").value;
  const description = document.getElementById("description").value.trim();

  // 1. Client-side Validation
  if (!name || !schoolLevel || isNaN(capacity) || !status) {
    showToast("Please fill in all required fields.", "error");
    return;
  }

  if (capacity <= 0) {
    showToast("Capacity must be a positive number.", "error");
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
      .from("classes")
      .insert([
        {
          name,
          school_level: schoolLevel,
          capacity,
          status,
          description: description || null,
          is_archived: false,
        },
      ])
      .select();

    if (error) {
      if (error.code === "23505") {
        showToast(
          "This class name already exists (including in archives). Please choose a different name.",
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
        showToast("You do not have permission to add a class.", "error");
        return;
      }
      showToast(error.message, "error");
      return;
    }

    showToast("Class created successfully!", "success");
    form.reset();
    await loadClasses(); // Function to reload your table data
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save Class";
    }
  }
}

// 3. Attach Event Listener
document.getElementById("classForm").addEventListener("submit", handleAddClass);
