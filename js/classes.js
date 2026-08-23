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

const archiveClassModal = document.getElementById("archiveClassModal");

const archiveButtons = document.querySelectorAll(".archive");

const cancelArchive = document.getElementById("cancelArchive");

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
  if (e.target === archiveClassModal) {
    archiveClassModal.style.display = "none";

    unLockBodyScroll();
  }
});

let classToArchiveId = null;

// 1. Open Archive Confirmation Modal
function openArchiveModal(classId) {
  classToArchiveId = classId;
  openModal("archiveClassModal");
}

async function handleConfirmArchive() {
  if (!classToArchiveId) return;

  const confirmBtn = document.getElementById("confirmArchive");

  try {
    if (confirmBtn) {
      confirmBtn.disabled = true;
      confirmBtn.textContent = "Archiving...";
    }

    // Archiving is an UPDATE operation in Supabase
    const { data, error } = await supabaseClient
      .from("classes")
      .update({
        is_archived: true,
        status: "inactive",
        updated_at: new Date().toISOString(),
      })
      .eq("id", classToArchiveId)
      .select(); // <--- ADD .select() to return the updated row

    // 1. Handle hard database errors
    if (error) {
      showToast(
        "Permission denied: Only active admins can archive classes.",
        "error",
      );
      return;
    }

    // 2. Handle RLS silent block (0 rows modified)
    if (!data || data.length === 0) {
      showToast(
        "Permission denied: Only active admins can archive classes.",
        "error",
      );
      return;
    }

    // 3. True success
    showToast("Class archived successfully!", "success");

    closeModal("archiveClassModal");
    classToArchiveId = null;
    await loadClasses(); // Reload active classes table
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

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = "flex";
    if (typeof lockBodyScroll === "function") lockBodyScroll();
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = "none";
    if (typeof unLockBodyScroll === "function") unLockBodyScroll();
  }
}

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

  // Guard clause: stop execution ONLY if the element is missing
  if (!tbody) return;

  // Loading indicator
  tbody.innerHTML = `
    <tr>
      <td colspan="8" style="text-align: center; padding: 2rem; color: #64748b;">
        <i class="fa-solid fa-spinner fa-spin" style="margin-right: 0.5rem;"></i>
        Loading classes...
      </td>
    </tr>
  `;

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
       <td>${formatDateTime(item.created_at)}</td>
          <td>${formatDateTime(item.updated_at)}</td>
      <td>
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

let originalClassData = null;

// 1. Open Edit Modal & Populate Form Data
async function openEditModal(classId) {
  try {
    const { data, error } = await supabaseClient
      .from("classes")
      .select("*")
      .eq("id", classId)
      .single();

    if (error || !data) {
      showToast("Failed to fetch class details.", "error");
      return;
    }

    // Cache original values to detect changes later
    originalClassData = { ...data };

    // Fill form fields
    document.getElementById("editClassId").value = data.id;
    document.getElementById("editClassName").value = data.name;
    document.getElementById("editSchoolLevel").value = data.school_level;
    document.getElementById("editCapacity").value = data.capacity;
    document.getElementById("editStatus").value = data.status;
    document.getElementById("editDescription").value = data.description || "";

    openModal("editClassModal");
  } catch (err) {
    showToast(err.message, "error");
  }
}

// 2. Form Submit Handler for Updating
async function handleEditClass(event) {
  event.preventDefault();

  const classId = document.getElementById("editClassId").value;
  const name = document.getElementById("editClassName").value.trim();
  const schoolLevel = document.getElementById("editSchoolLevel").value;
  const capacity = parseInt(document.getElementById("editCapacity").value, 10);
  const status = document.getElementById("editStatus").value;
  const description = document.getElementById("editDescription").value.trim();

  // Basic validation
  if (!name || !schoolLevel || isNaN(capacity) || !status) {
    showToast("Please fill in all required fields.", "error");
    return;
  }

  if (capacity <= 0) {
    showToast("Capacity must be greater than 0.", "error");
    return;
  }

  // Check if any value changed
  const isUnchanged =
    originalClassData &&
    originalClassData.name === name &&
    originalClassData.school_level === schoolLevel &&
    originalClassData.capacity === capacity &&
    originalClassData.status === status &&
    (originalClassData.description || "") === description;

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
      .from("classes")
      .update({
        name,
        school_level: schoolLevel,
        capacity,
        status,
        description: description || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", classId)
      .select(); // <--- ADD .select() to return the updated row
    // 1. Handle hard database errors
    if (error) {
      showToast(
        "Permission denied: Only active admins can archive classes.",
        "error",
      );
      return;
    }

    // 2. Handle RLS silent block (0 rows modified)
    if (!data || data.length === 0) {
      showToast(
        "Permission denied: Only active admins can archive classes.",
        "error",
      );
      return;
    }

    if (error) {
      if (error.code === "23505") {
        showToast("This class name already exists.", "error");
        return;
      }
      showToast(error.message, "error");
      return;
    }

    showToast("Class updated successfully!", "success");
    closeModal("editClassModal");
    await loadClasses(); // Refresh main table
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Update Class";
    }
  }
}

// Attach Event Listeners
document
  .getElementById("editClassForm")
  .addEventListener("submit", handleEditClass);
document
  .getElementById("closeEditClassModal")
  .addEventListener("click", () => closeModal("editClassModal"));
document
  .getElementById("cancelEditClassModal")
  .addEventListener("click", () => closeModal("editClassModal"));

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
