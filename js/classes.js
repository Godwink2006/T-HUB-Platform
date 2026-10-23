const classModal = document.getElementById("classModal");

const cancelClassModal = document.getElementById("cancelClassModal");

const openClassModal = document.getElementById("addClass");

const closeClassModal = document.getElementById("closeClassModal");

if (openClassModal && classModal) {
  openClassModal.addEventListener("click", () => {
    classModal.style.display = "flex";
    if (typeof lockBodyScroll === "function") lockBodyScroll();
  });
}

if (closeClassModal && classModal) {
  closeClassModal.addEventListener("click", () => {
    classModal.style.display = "none";
    if (typeof unLockBodyScroll === "function") unLockBodyScroll();
  });
}

if (cancelClassModal && classModal) {
  cancelClassModal.addEventListener("click", () => {
    classModal.style.display = "none";
    if (typeof unLockBodyScroll === "function") unLockBodyScroll();
  });
}

window.addEventListener("click", (e) => {
  if (e.target === classModal) closeModal("classModal");
  if (e.target === editClassModal) closeModal("editClassModal");
});

const closeEditClassModal = document.getElementById("closeEditClassModal");
const cancelEditClassModal = document.getElementById("cancelEditClassModal");
const editClassModal = document.getElementById("editClassModal");
const editButtons = document.querySelectorAll(".edit");

function getClassErrorMessage(error, action) {
  const code = String(error?.code || "").toUpperCase();
  const status = Number(error?.status || error?.statusCode || 0);
  const diagnostic = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`.toLowerCase();

  if (/school.{0,30}inactive|inactive.{0,30}school|school is not active/.test(diagnostic)) {
    return "This school is inactive. You can view existing classes, but you cannot make changes until the school is reactivated.";
  }
  if (code === "23505") {
    return "A class with this name already exists.";
  }
  if (code === "23514") {
    return "Some class information is invalid. Check the capacity and selected school level.";
  }
  if (
    code === "42501" ||
    status === 403 ||
    /row-level security|permission denied|insufficient privilege|not authorized|not allowed/.test(diagnostic)
  ) {
    if (action === "load") {
      return "You do not have permission to view classes for this school.";
    }
    return `Could not ${action} this class. This school may be inactive, or your account may not have permission.`;
  }
  if (
    status === 401 ||
    code === "PGRST301" ||
    /invalid jwt|session.*expired|refresh token/.test(diagnostic)
  ) {
    return "Your session has expired. Sign in again and retry.";
  }
  if (/failed to fetch|network|connection|timeout|timed out/.test(diagnostic)) {
    return "Could not connect to load classes. Check your internet connection and try again.";
  }
  if (code === "PGRST116") {
    return action === "load"
      ? "This class is unavailable or you do not have permission to view it. Refresh the page and try again."
      : "This class is no longer available to update. Refresh the page and try again.";
  }
  if (code === "23503" || code === "22P02") {
    return "Some class information is invalid or linked to another record. Review the details and try again.";
  }
  return action === "load"
    ? "Could not load classes. Please try again."
    : `Could not ${action} this class. Please try again.`;
}

function showClassError(error, action) {
  console.error(`Classes page ${action} error:`, error);
  const message = getClassErrorMessage(error, action);
  if (typeof showToast === "function") showToast(message, "error");
  return message;
}

closeEditClassModal.addEventListener("click", () => {
  editClassModal.style.display = "none";

  unLockBodyScroll();
});

cancelEditClassModal.addEventListener("click", () => {
  editClassModal.style.display = "none";

  unLockBodyScroll();
});

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

function getSchoolLevelFromClass(className) {
  if (!className) return "";

  if (["ABC", "K1", "K2"].includes(className)) return "nursery";

  if (
    ["Grade 10", "Grade 11", "Grade 12"].some((g) => className.startsWith(g))
  ) {
    return "senior_secondary";
  }

  if (["Grade 7", "Grade 8", "Grade 9"].some((g) => className.startsWith(g))) {
    return "junior_secondary";
  }

  if (["Grade 4", "Grade 5", "Grade 6"].some((g) => className.startsWith(g))) {
    return "senior_primary";
  }

  if (["Grade 1", "Grade 2", "Grade 3"].some((g) => className.startsWith(g))) {
    return "junior_primary";
  }

  return "other";
}

document.addEventListener("DOMContentLoaded", () => {
  const classSelect = document.getElementById("className");
  const levelSelect = document.getElementById("schoolLevel");
  const hiddenLevelInput = document.getElementById("schoolLevelHidden");

  if (classSelect && levelSelect) {
    classSelect.addEventListener("change", (e) => {
      const selectedClass = e.target.value;
      const autoLevel = getSchoolLevelFromClass(selectedClass);

      levelSelect.value = autoLevel;

      if (hiddenLevelInput) {
        hiddenLevelInput.value = autoLevel;
      }
    });
  }
});

let currentClassesData = [];

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

async function loadClasses() {
  const tbody = document.getElementById("classesTableBody");

  if (!tbody) return;

  tbody.innerHTML = `
    <tr>
      <td colspan="8" style="text-align: center; padding: 2rem; color: #64748b;">
        <i class="fa-solid fa-spinner fa-spin" style="margin-right: 0.5rem;"></i>
        Loading classes...
      </td>
    </tr>
  `;

  try {
    if (!window.supabaseClient) {
      const message = showClassError(
        new Error("Supabase client is not initialized."),
        "load",
      );
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:20px;">${escapeHTML(message)}</td></tr>`;
      return;
    }

    const { data, error } = await supabaseClient
      .from("classes")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    currentClassesData = data || [];
    renderClassesTable(currentClassesData);
  } catch (err) {
    const message = showClassError(err, "load");
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:20px;">${escapeHTML(message)}</td></tr>`;
  }
}

function renderClassesTable(classes) {
  const tbody = document.getElementById("classesTableBody");
  tbody.innerHTML = "";

  if (classes.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;">No classes found.</td></tr>`;
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
      <td>${escapeHTML(item.name || "-")}</td>
  <td>${escapeHTML(formatSchoolLevel(item.school_level))}</td>
  <td>${escapeHTML(item.capacity || 0)}</td>
  <td>
    <span class="${statusClass}">${statusText}</span>
  </td>
  <td>${escapeHTML(descriptionText || "-")}</td>
       <td>${formatDateTime(item.created_at)}</td>
          <td>${formatDateTime(item.updated_at)}</td>
      <td>
        <button class="classes-actions-btn edit" onclick="openEditModal('${item.id}')">
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

let originalClassData = null;

async function openEditModal(classId) {
  if (!window.supabaseClient) {
    showClassError(new Error("Supabase client is not initialized."), "load");
    return;
  }

  try {
    const { data, error } = await supabaseClient
      .from("classes")
      .select("*")
      .eq("id", classId)
      .single();

    if (error || !data) {
      showClassError(error || new Error("Class not found."), "load");
      return;
    }

    originalClassData = { ...data };

    const idInput = document.getElementById("editClassId");
    const nameInput = document.getElementById("editClassName");
    const levelInput = document.getElementById("editSchoolLevel");
    const capInput = document.getElementById("editCapacity");
    const statusInput = document.getElementById("editStatus");
    const descInput = document.getElementById("editDescription");

    if (idInput) idInput.value = data.id;
    if (nameInput) nameInput.value = data.name || "";
    if (levelInput) levelInput.value = data.school_level || "";
    if (capInput) capInput.value = data.capacity || "";
    if (statusInput) statusInput.value = data.status || "";
    if (descInput) descInput.value = data.description || "";

    openModal("editClassModal");
  } catch (err) {
    showClassError(err, "load");
  }
}

async function handleEditClass(event) {
  event.preventDefault();

  const classId = document.getElementById("editClassId").value;
  const name = document.getElementById("editClassName").value.trim();
  const schoolLevel = document.getElementById("editSchoolLevel").value;
  const capacity = parseInt(document.getElementById("editCapacity").value, 10);
  const status = document.getElementById("editStatus").value;
  const description = document.getElementById("editDescription").value.trim();

  if (!name || !schoolLevel || isNaN(capacity) || !status) {
    showToast("Please fill in all required fields.", "error");
    return;
  }

  if (capacity <= 0) {
    showToast("Capacity must be greater than 0.", "error");
    return;
  }

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
        capacity,
        status,
        description: description || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", classId)
      .select();

    if (error) {
      showClassError(error, "update");
      return;
    }

    if (!data || data.length === 0) {
      showClassError({ code: "42501" }, "update");
      return;
    }

    showToast("Class updated successfully!", "success");
    closeModal("editClassModal");
    await loadClasses();
  } catch (err) {
    showClassError(err, "update");
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Update Class";
    }
  }
}

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

async function handleAddClass(event) {
  event.preventDefault();

  const name = document.getElementById("className").value.trim();
  const schoolLevel = document.getElementById("schoolLevel").value;
  const capacity = parseInt(document.getElementById("capacity").value, 10);
  const status = document.getElementById("status").value;
  const description = document.getElementById("description").value.trim();

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

    const { data, error } = await supabaseClient
      .from("classes")
      .insert([
        {
          name,
          school_level: schoolLevel,
          capacity,
          status,
          description: description || null,
        },
      ])
      .select();

    if (error) {
      showClassError(error, "create");
      return;
    }

    if (!data || data.length === 0) {
      showClassError({ code: "42501" }, "create");
      return;
    }

    showToast("Class created successfully!", "success");
    form.reset();
    closeModal("classModal");
    await loadClasses();
  } catch (err) {
    showClassError(err, "create");
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save Class";
    }
  }
}

document
  .getElementById("editClassForm")
  ?.addEventListener("submit", handleEditClass);
document
  .getElementById("closeEditClassModal")
  ?.addEventListener("click", () => closeModal("editClassModal"));
document
  .getElementById("cancelEditClassModal")
  ?.addEventListener("click", () => closeModal("editClassModal"));

document
  .getElementById("classSearchInput")
  ?.addEventListener("input", filterClasses);
document
  .getElementById("statusFilter")
  ?.addEventListener("change", filterClasses);

document
  .getElementById("classForm")
  ?.addEventListener("submit", handleAddClass);

document.addEventListener("DOMContentLoaded", loadClasses);

