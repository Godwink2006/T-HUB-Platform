// --- STATE MANAGEMENT & DOM REFS ---
let terms = [];
let selectedTermId = null;
let originalTermData = {};

const termModal = document.getElementById("termModal");
const editTermModal = document.getElementById("editTermModal");
const archiveTermModal = document.getElementById("archiveTermModal");

// --- INITIALIZATION ---
document.addEventListener("DOMContentLoaded", () => {
  loadTerms();
  populateAcademicYearDropdowns(); // Populate dropdowns dynamically
  setupAcademicYearRealtime(); // Start real-time listener
  setupModalListeners();
});

// --- Backdrop Click Handler ---
window.addEventListener("click", (e) => {
  const modals = [termModal, editTermModal, archiveTermModal];
  modals.forEach((modal) => {
    if (modal && modal.style.display === "flex" && e.target === modal) {
      closeModal(modal.id);
    }
  });
});

// --- 1. FETCH & RENDER ---
async function loadTerms() {
  renderTableLoading();

  const { data, error } = await supabaseClient
    .from("terms") // DB Table name
    .select(
      `
      *,
      academic_years ( year_label )
    `,
    )
    .eq("is_archived", false)
    .order("created_at", { ascending: false });

  if (error) {
    showToast("Error loading semesters: " + error.message, "error");
    return;
  }

  terms = data || [];
  renderTermsTable();
}

function renderTableLoading() {
  const tbody = document.querySelector(".terms-table-card tbody");
  if (!tbody) return;

  tbody.innerHTML = `
    <tr>
      <td colspan="4" style="text-align: center; padding: 2rem; color: #64748b;">
        <i class="fa-solid fa-spinner fa-spin" style="margin-right: 0.5rem;"></i>
        Loading semesters...
      </td>
    </tr>
  `;
}

function renderTermsTable() {
  const tbody = document.querySelector(".terms-table-card tbody");
  if (!tbody) return;

  if (terms.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;">No semesters found.</td></tr>`;
    return;
  }

  tbody.innerHTML = terms
    .map((item) => {
      const isActive = item.status === "Active";
      const statusClass = isActive
        ? "terms-status-active"
        : "terms-status-inactive";

      const yearLabel =
        item.academic_years?.year_label || item.academic_year || "N/A";

      return `
        <tr>
          <td>${item.name}</td>
          <td>${yearLabel}</td>
          <td><span class="${statusClass}">${item.status}</span></td>
          <td>${formatDate(item.start_date)}</td>
<td>${formatDate(item.end_date)}</td>
<td>${formatDateTime(item.created_at)}</td>
<td>${formatDateTime(item.updated_at)}</td>
          <td>
            <button class="terms-actions-btn edit-term" onclick="openEditModal('${item.id}')">
              <i class="fa-solid fa-pen"></i>
            </button>
            <button class="terms-actions-btn archive-term" onclick="openArchiveModal('${item.id}')">
              <i class="fa-solid fa-box-archive"></i>
            </button>
          </td>
        </tr>
      `;
    })
    .join("");
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

function formatDate(dateString) {
  if (!dateString) return "N/A";

  // Parse YYYY-MM-DD components directly to avoid UTC timezone offset issues
  const [year, month, day] = dateString.split("-");
  const date = new Date(year, month - 1, day);

  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

// --- 2. SINGLE ACTIVE SEMESTER ENFORCEMENT ---
async function handleSingleActiveStatus(
  requestedStatus,
  currentRecordId = null,
) {
  if (requestedStatus === "Active") {
    let query = supabaseClient
      .from("terms")
      .update({ status: "Inactive" })
      .eq("status", "Active");

    if (currentRecordId) {
      query = query.neq("id", currentRecordId);
    }

    const { error } = await query;
    if (error) throw error;
  }
}

// --- REALTIME SUBSCRIPTION FOR ACADEMIC YEARS ---
function setupAcademicYearRealtime() {
  supabaseClient
    .channel("public:academic_years")
    .on(
      "postgres_changes",
      {
        event: "*", // Listen to INSERT, UPDATE, and DELETE
        schema: "public",
        table: "academic_years",
      },
      (payload) => {
        // Re-fetch active academic years whenever any change happens
        populateAcademicYearDropdowns();
      },
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
      }
    });
}

// --- 3. CREATE (ADD) ---
async function handleAddTerm(event) {
  event.preventDefault();

  const academicYearId = document.getElementById("addAcademicYearSelect").value;
  const name = document.getElementById("addSemesterNameSelect").value;
  const startDate = document.getElementById("addStartDate").value;
  const endDate = document.getElementById("addEndDate").value;
  // Example inside handleAddTerm:
  const rawStatus = document.getElementById("addStatusSelect").value;
  const status =
    rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1).toLowerCase(); // Ensures "Active" or "Inactive"

  if (!academicYearId || !name || !startDate || !endDate || !status) {
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

    await handleSingleActiveStatus(status);

    const { data, error } = await supabaseClient
      .from("terms")
      .insert([
        {
          academic_year_id: academicYearId,
          name,
          start_date: startDate,
          end_date: endDate,
          status,
          is_archived: false,
        },
      ])
      .select();

    if (error) {
      if (error.code === "23505") {
        showToast(
          "This semester already exists for the selected year.",
          "error",
        );
        return;
      }
      if (error.code === "42501") {
        showToast("You do not have permission to add a semester.", "error");
        return;
      }
      showToast(error.message, "error");
      return;
    }

    showToast("Semester added successfully!", "success");
    closeModal("termModal");
    form.reset();
    await loadTerms();
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save Semester";
    }
  }
}

async function openEditModal(id) {
  selectedTermId = id;
  const item = terms.find((t) => t.id === id);
  if (!item) return;

  const editSelect = document.getElementById("editAcademicYearSelect");
  const nameSelect = document.getElementById("editSemesterNameSelect");

  // 1. Populate only the item's original Academic Year option
  if (editSelect) {
    const yearLabel = item.academic_years?.year_label || "N/A";
    editSelect.innerHTML = `<option value="${item.academic_year_id}">${yearLabel}</option>`;
    editSelect.value = item.academic_year_id || "";
    editSelect.disabled = true; // Lock dropdown
  }

  // 2. Set and lock Semester Name
  if (nameSelect) {
    nameSelect.value = item.name || "";
    nameSelect.disabled = true; // Lock dropdown
  }

  // 3. Populate editable fields
  document.getElementById("editStartDate").value = item.start_date || "";
  document.getElementById("editEndDate").value = item.end_date || "";
  document.getElementById("editStatusSelect").value = item.status || "Inactive";

  originalTermData = {
    academic_year_id: item.academic_year_id,
    name: item.name,
    start_date: item.start_date,
    end_date: item.end_date,
    status: item.status,
  };

  openModal("editTermModal");
}

async function handleEditTerm(event) {
  event.preventDefault();

  const academicYearId = document.getElementById(
    "editAcademicYearSelect",
  ).value;
  const name = document.getElementById("editSemesterNameSelect").value;
  const startDate = document.getElementById("editStartDate").value;
  const endDate = document.getElementById("editEndDate").value;
  const status = document.getElementById("editStatusSelect").value;

  const hasChanges =
    academicYearId !== originalTermData.academic_year_id ||
    name !== originalTermData.name ||
    startDate !== originalTermData.start_date ||
    endDate !== originalTermData.end_date ||
    status !== originalTermData.status;

  if (!hasChanges) {
    showToast("No changes detected.", "info");
    return;
  }

  if (!startDate || !endDate || !status) {
    showToast("Please fill in all required fields.", "error");
    return;
  }

  const form = event.target;
  const updateBtn = form.querySelector('button[type="submit"]');

  try {
    if (updateBtn) {
      updateBtn.disabled = true;
      updateBtn.textContent = "Updating...";
    }

    await handleSingleActiveStatus(status, selectedTermId);

    // Ensure end date is strictly after start date
    if (new Date(startDate) >= new Date(endDate)) {
      showToast("End date must be after start date.", "error");
      return;
    }

    const currentTerm = terms.find((t) => t.id === selectedTermId);

    if (currentTerm && currentTerm.name === "2nd Semester") {
      // Find 1st Semester for the same academic year
      const firstSemester = terms.find(
        (t) =>
          t.academic_year_id === currentTerm.academic_year_id &&
          t.name === "1st Semester",
      );

      if (firstSemester && firstSemester.end_date) {
        if (new Date(startDate) <= new Date(firstSemester.end_date)) {
          showToast(
            `2nd Semester start date must be after 1st Semester end date (${formatDate(firstSemester.end_date)}).`,
            "error",
          );
          return;
        }
      }
    }

    const { data, error } = await supabaseClient
      .from("terms")
      .update({
        start_date: startDate,
        end_date: endDate,
        status,
      })
      .eq("id", selectedTermId)
      .select();

    if (error) {
      showToast("Error updating semester: " + error.message, "error");
      return;
    }

    if (!data || data.length === 0) {
      showToast("Permission denied.", "error");
      return;
    }

    showToast("Semester updated successfully!", "success");
    closeModal("editTermModal");
    await loadTerms();
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    if (updateBtn) {
      updateBtn.disabled = false;
      updateBtn.textContent = "Update";
    }
  }
}

// --- 5. ARCHIVE ---
function openArchiveModal(id) {
  selectedTermId = id;
  openModal("archiveTermModal");
}

async function handleConfirmArchive() {
  if (!selectedTermId) return;

  const archiveBtn = document.getElementById("confirmArchive");

  try {
    if (archiveBtn) {
      archiveBtn.disabled = true;
      archiveBtn.textContent = "Archiving...";
    }

    const { data, error } = await supabaseClient
      .from("terms")
      .update({ is_archived: true, status: "Inactive" })
      .eq("id", selectedTermId)
      .select();

    if (error) {
      showToast("Error archiving semester: " + error.message, "error");
      return;
    }

    if (!data || data.length === 0) {
      showToast("Permission denied.", "error");
      return;
    }

    showToast("Semester archived successfully!", "success");
    closeModal("archiveTermModal");
    await loadTerms();
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    if (archiveBtn) {
      archiveBtn.disabled = false;
      archiveBtn.textContent = "Archive";
    }
  }
}

// --- 6. MODAL HELPERS & LISTENERS ---
function lockBodyScroll() {
  document.body.style.overflow = "hidden";
}

function unLockBodyScroll() {
  document.body.style.overflow = "";
}

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
    .getElementById("addTerm")
    ?.addEventListener("click", () => openModal("termModal"));
  document
    .getElementById("closeTermModal")
    ?.addEventListener("click", () => closeModal("termModal"));
  document
    .getElementById("cancelTermModal")
    ?.addEventListener("click", () => closeModal("termModal"));
  document
    .getElementById("termForm")
    ?.addEventListener("submit", handleAddTerm);

  // Edit Modal
  document
    .getElementById("closeEditTermModal")
    ?.addEventListener("click", () => closeModal("editTermModal"));
  document
    .getElementById("cancelEditTermModal")
    ?.addEventListener("click", () => closeModal("editTermModal"));
  document
    .getElementById("editTermForm")
    ?.addEventListener("submit", handleEditTerm);

  // Archive Modal
  document
    .getElementById("cancelTermArchive")
    ?.addEventListener("click", () => closeModal("archiveTermModal"));
  document
    .getElementById("confirmArchive")
    ?.addEventListener("click", handleConfirmArchive);
}

async function populateAcademicYearDropdowns() {
  // 1. Include 'status' in select so addSelect filtering works
  const { data, error } = await supabaseClient
    .from("academic_years")
    .select("id, year_label, status")
    .eq("is_archived", false)
    .order("year_label", { ascending: false });

  if (error) {
    showToast(
      "Failed to load academic years for selection: " + error.message,
      "error",
    );
    return;
  }

  const addSelect = document.getElementById("addAcademicYearSelect");
  const editSelect = document.getElementById("editAcademicYearSelect");

  if (!data || data.length === 0) {
    const emptyOption = `<option value="">No Academic Years Available</option>`;
    if (addSelect) addSelect.innerHTML = emptyOption;
    if (editSelect) editSelect.innerHTML = emptyOption;
    return;
  }

  // 2. ADD MODAL: Filter for ACTIVE years only
  if (addSelect) {
    const activeYears = data.filter((item) => item.status === "Active");
    addSelect.innerHTML = activeYears.length
      ? activeYears
          .map(
            (item) => `<option value="${item.id}">${item.year_label}</option>`,
          )
          .join("")
      : `<option value="">No Active Academic Years Available</option>`;
  }

  // 3. EDIT MODAL: Load ALL years so the selected term's year can render
  if (editSelect) {
    editSelect.innerHTML = data
      .map((item) => `<option value="${item.id}">${item.year_label}</option>`)
      .join("");
  }

  // NOTE: REMOVED the optionsHTML block from the bottom because it was overwriting addSelect!
}
