const academicYearModal = document.getElementById("academicYearModal");

window.addEventListener("click", (e) => {
  if (e.target === academicYearModal) {
    academicYearModal.style.display = "none";

    unLockBodyScroll();
  }
});

const editAcademicYearModal = document.getElementById("editAcademicYearModal");

window.addEventListener("click", (e) => {
  if (e.target === editAcademicYearModal) {
    editAcademicYearModal.style.display = "none";

    unLockBodyScroll();
  }
});

const archiveAcademicYearModal = document.getElementById(
  "archiveAcademicYearModal",
);

window.addEventListener("click", (e) => {
  if (e.target === archiveAcademicYearModal) {
    archiveAcademicYearModal.style.display = "none";

    unLockBodyScroll();
  }
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

  try {
    // Rule: Ensure only one Active year
    await handleSingleActiveStatus(status);

    const { error } = await supabaseClient
      .from("academic_years")
      .insert([{ year_label: yearLabel, status, is_archived: false }]);

    if (error) throw error;

    showToast("Academic Year added successfully!", "success");
    closeModal("academicYearModal");
    document.getElementById("academicYearForm").reset();
    await loadAcademicYears();
  } catch (err) {
    showToast(err.message, "error");
  }
}

// --- 4. UPDATE (EDIT) ---
function openEditModal(id) {
  selectedYearId = id;
  const item = academicYears.find((y) => y.id === id);
  if (!item) return;

  document.getElementById("editYearSelect").value = item.year_label;
  document.getElementById("editStatusSelect").value = item.status;

  openModal("editAcademicYearModal");
}

async function handleEditAcademicYear(event) {
  event.preventDefault();

  const yearLabel = document.getElementById("editYearSelect").value;
  const status = document.getElementById("editStatusSelect").value;

  if (!selectedYearId || !yearLabel || !status) {
    showToast("Please fill in all required fields.", "error");
    return;
  }

  try {
    // Rule: Ensure only one Active year
    await handleSingleActiveStatus(status, selectedYearId);

    const { error } = await supabaseClient
      .from("academic_years")
      .update({ year_label: yearLabel, status })
      .eq("id", selectedYearId);

       if (updateError) {
      // Code 23505 is PostgreSQL's Unique Constraint Violation
      if (updateError.code === "23505") {
        // Check if the error message/details mention the phone field
        if (
          updateError.message?.includes("year_label") ||
          updateError.details?.includes("year_label")
        ) {
          showToast(
            "This Academic Year is already been created.",
            "error",
          );
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
  }
}

// --- 5. SOFT DELETE (ARCHIVE) ---
function openArchiveModal(id) {
  selectedYearId = id;
  openModal("archiveAcademicYearModal");
}

async function handleConfirmArchive() {
  if (!selectedYearId) return;

  try {
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
  }
}

// --- 6. MODAL HELPERS & LISTENERS ---
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.style.display = "flex";
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.style.display = "none";
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
