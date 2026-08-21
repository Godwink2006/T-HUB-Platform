const academicYearModal = document.getElementById("academicYearModal");

const editAcademicYearModal = document.getElementById("editAcademicYearModal");

const archiveAcademicYearModal = document.getElementById(
  "archiveAcademicYearModal",
);

window.addEventListener("click", (e) => {
  const modals = [academicYearModal, editAcademicYearModal, archiveAcademicYearModal];

  modals.forEach((modal) => {
    // Check if the modal is currently open AND the click was on the dark backdrop itself
    if (modal && modal.style.display === "flex" && e.target === modal) {
      modal.style.display = "none";
      unLockBodyScroll();
    }
  });
});

let academicYears = [];
let selectedYearId = null;

// Initialize on DOM ready
document.addEventListener("DOMContentLoaded", () => {
  loadAcademicYears();
  setupModalListeners();
});

// --- 1. FETCH & RENDER ---
async function loadAcademicYears() {
  // Show the loading indicator immediately
  renderTableLoading();

  const { data, error } = await supabaseClient
    .from("academic_years")
    .select("*")
    .eq("is_archived", false) // Exclude soft-deleted records
    .order("year_label", { ascending: false });

  if (error) {
    showToast("Error loading academic years: " + error.message, "error");
    return;
  }

  academicYears = data || [];
  renderAcademicYearsTable();
}

function renderTableLoading() {
  const tbody = document.querySelector(".academic-years-table-card tbody");
  if (!tbody) return;

  tbody.innerHTML = `
    <tr>
      <td colspan="3" style="text-align: center; padding: 2rem; color: #64748b;">
        <i class="fa-solid fa-spinner fa-spin" style="margin-right: 0.5rem;"></i>
        Loading academic years...
      </td>
    </tr>
  `;
}

function renderAcademicYearsTable() {
  const tbody = document.querySelector(".academic-years-table-card tbody");
  if (!tbody) return;

  if (academicYears.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;">No academic years found.</td></tr>`;
    return;
  }

  tbody.innerHTML = academicYears
    .map((item) => {
      const isActive = item.status === "Active";
      const statusClass = isActive
        ? "academic-years-status-active"
        : "academic-years-status-inactive";

      return `
        <tr>
          <td>${item.year_label}</td>
          <td><span class="${statusClass}">${item.status}</span></td>
          <td>
            <button class="academic-years-actions-btn edit-academicYear" onclick="openEditModal('${item.id}')">
              <i class="fa-solid fa-pen"></i>
            </button>
            <button class="academic-years-actions-btn archive-AcademicYear" onclick="openArchiveModal('${item.id}')">
              <i class="fa-solid fa-box-archive"></i>
            </button>
          </td>
        </tr>
      `;
    })
    .join("");
}

// --- 2. SINGLE ACTIVE YEAR ENFORCEMENT ---
async function handleSingleActiveStatus(
  requestedStatus,
  currentRecordId = null,
) {
  if (requestedStatus === "Active") {
    // Set all existing active years to 'Archive'
    let query = supabaseClient
      .from("academic_years")
      .update({ status: "Inactive" })
      .eq("status", "Active");

    if (currentRecordId) {
      query = query.neq("id", currentRecordId);
    }

    const { error } = await query;
    if (error) throw error;
  }
}

// --- 3. CREATE (ADD) ---
async function handleAddAcademicYear(event) {
  event.preventDefault();

  const yearLabel = document.getElementById("addYearSelect").value;
  const status = document.getElementById("addStatusSelect").value;

  if (!yearLabel || !status) {
    showToast("Please select all required fields.", "error");
    return;
  }

  // 2. Select submit button scoped to THIS form/modal
  const form = event.target;
  const saveBtn = form.querySelector('button[type="submit"]');

  try {
    // 3. Set loading state
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = "Saving...";
    }
    // Rule: Ensure only one Active year
    await handleSingleActiveStatus(status);

    const { error } = await supabaseClient
      .from("academic_years")
      .insert([{ year_label: yearLabel, status, is_archived: false }]);

    if (error) {
      // Code 23505 is PostgreSQL's Unique Constraint Violation
      if (error.code === "23505") {
        // Check if the error message/details mention the phone field
        if (
          error.message?.includes("year_label") ||
          error.details?.includes("year_label")
        ) {
          showToast("This Academic Year has already been created.", "error");
          return;
        }
      }
    }

    showToast("Academic Year added successfully!", "success");
    closeModal("academicYearModal");
    document.getElementById("academicYearForm").reset();
    await loadAcademicYears();
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    // 5. Always restore button state
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save"; // Replace with your original text
    }
  }
}

// Variable to store original values for comparison
let originalYearData = {};

// --- 4. UPDATE (EDIT) ---
function openEditModal(id) {
  selectedYearId = id;
  const item = academicYears.find((y) => y.id === id);
  if (!item) return;

  const yearSelect = document.getElementById("editYearSelect");
  yearSelect.value = item.year_label;
  yearSelect.disabled = true;

  const statusSelect = document.getElementById("editStatusSelect");
  statusSelect.value = item.status;

  // Store current state for change detection
  originalYearData = {
    year_label: item.year_label,
    status: item.status,
  };

  openModal("editAcademicYearModal");
}

async function handleEditAcademicYear(event) {
  event.preventDefault();

  const yearLabel = document.getElementById("editYearSelect").value;
  const status = document.getElementById("editStatusSelect").value;

  // --- 1. CHANGE DETECTION VALIDATION ---
  const hasChanges = status !== originalYearData.status; // Since year is disabled, only status can change

  if (!hasChanges) {
    showToast("No changes detected.", "info");
    return;
  }

  if (!selectedYearId || !yearLabel || !status) {
    showToast("Please fill in all required fields.", "error");
    return;
  }

  // 2. Select submit button scoped to THIS form/modal
  const form = event.target;
  const updateBtn = form.querySelector('button[type="submit"]');

  try {
    // 3. Set loading state
    if (updateBtn) {
      updateBtn.disabled = true;
      updateBtn.textContent = "Updating...";
    }

    // Rule: Ensure only one Active year
    await handleSingleActiveStatus(status, selectedYearId);

    const { error } = await supabaseClient
      .from("academic_years")
      .update({ year_label: yearLabel, status })
      .eq("id", selectedYearId);

    if (error) {
      // Code 23505 is PostgreSQL's Unique Constraint Violation
      if (error.code === "23505") {
        // Check if the error message/details mention the phone field
        if (
          error.message?.includes("year_label") ||
          error.details?.includes("year_label")
        ) {
          showToast("This Academic Year has already been created.", "error");
          return;
        }
      }
    }

    if (error) throw error;

    showToast("Academic Year updated successfully!", "success");
    closeModal("editAcademicYearModal");
    await loadAcademicYears();
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    // 5. Always restore button state
    if (updateBtn) {
      updateBtn.disabled = false;
      updateBtn.textContent = "Update"; // Replace with your original text
    }
  }
}

// --- 5. SOFT DELETE (ARCHIVE) ---
function openArchiveModal(id) {
  selectedYearId = id;
  openModal("archiveAcademicYearModal");
}

async function handleConfirmArchive() {
  if (!selectedYearId) return;

  // 2. Select submit button scoped to THIS form/modal
  const archiveBtn = document.getElementById("confirmArchive");

  try {
    // 3. Set loading state
    if (archiveBtn) {
      archiveBtn.disabled = true;
      archiveBtn.textContent = "Archiving...";
    }

    const { error } = await supabaseClient
      .from("academic_years")
      .update({ is_archived: true, status: "Inactive" }) // Soft delete flag
      .eq("id", selectedYearId);

    if (error) throw error;

    showToast("Academic year archived successfully!", "success");
    closeModal("archiveAcademicYearModal");
    await loadAcademicYears();
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    // 5. Always restore button state
    if (archiveBtn) {
      archiveBtn.disabled = false;
      archiveBtn.textContent = "Archive"; // Replace with your original text
    }
  }
}

// --- 6. MODAL HELPERS & LISTENERS ---
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.style.display = "flex";

  lockBodyScroll();
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.style.display = "none";

  unLockBodyScroll();
}

function setupModalListeners() {
  // Add Modal
  document
    .getElementById("addAcademicYear")
    ?.addEventListener("click", () => openModal("academicYearModal"));
  document
    .getElementById("closeAcademicYearModal")
    ?.addEventListener("click", () => closeModal("academicYearModal"));
  document
    .getElementById("cancelAcademicYearModal")
    ?.addEventListener("click", () => closeModal("academicYearModal"));
  document
    .getElementById("academicYearForm")
    ?.addEventListener("submit", handleAddAcademicYear);

  // Edit Modal
  document
    .getElementById("closeEditAcademicYearModal")
    ?.addEventListener("click", () => closeModal("editAcademicYearModal"));
  document
    .getElementById("cancelEditAcademicYearModal")
    ?.addEventListener("click", () => closeModal("editAcademicYearModal"));
  document
    .getElementById("editAcademicYearForm")
    ?.addEventListener("submit", handleEditAcademicYear);

  // Archive Modal
  document
    .getElementById("cancelArchive")
    ?.addEventListener("click", () => closeModal("archiveAcademicYearModal"));
  document
    .getElementById("confirmArchive")
    ?.addEventListener("click", handleConfirmArchive);
}
