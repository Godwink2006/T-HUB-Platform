const academicYearModal = document.getElementById("academicYearModal");

const editAcademicYearModal = document.getElementById("editAcademicYearModal");

const archiveAcademicYearModal = document.getElementById(
  "archiveAcademicYearModal",
);

window.addEventListener("click", (e) => {
  const modals = [
    academicYearModal,
    editAcademicYearModal,
    archiveAcademicYearModal,
  ];
  modals.forEach((modal) => {
    if (modal && modal.style.display === "flex" && e.target === modal) {
      closeModal(modal.id);
    }
  });
});

let academicYears = [];
let selectedYearId = null;

document.addEventListener("DOMContentLoaded", () => {
  loadAcademicYears();
  setupModalListeners();
});

async function loadAcademicYears() {
  renderTableLoading();

  const { data, error } = await supabaseClient
    .from("academic_years")
    .select("*")
    .eq("is_archived", false)
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
      <td colspan="5" style="text-align: center; padding: 2rem; color: #64748b;">
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
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No academic years found.</td></tr>`;
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
          <td>${formatDateTime(item.created_at)}</td>
          <td>${formatDateTime(item.updated_at)}</td>
          <td>
            <button class="academic-years-actions-btn edit-academicYear" onclick="openEditModal('${item.id}')">
              <i class="fa-solid fa-pen"></i>
            </button>
            <button 
  class="academic-years-actions-btn archive-AcademicYear" 
  onclick="openArchiveModal('${item.id}', '${(item.year_label || "this Academic Year").replace(/'/g, "\\'")}')"
>
  <i class="fa-solid fa-box-archive"></i>
</button>
          </td>
        </tr>
      `;
    })
    .join("");
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

async function handleSingleActiveStatus(requestedStatus, currentRecordId) {
  if (requestedStatus === "Active" && currentRecordId) {
    const { error } = await supabaseClient
      .from("academic_years")
      .update({ status: "Inactive" })
      .eq("status", "Active")
      .neq("id", currentRecordId);

    if (error) throw error;
  }
}

async function handleAddAcademicYear(event) {
  event.preventDefault();

  const yearLabel = document.getElementById("addYearSelect").value;
  const status = document.getElementById("addStatusSelect").value;

  if (!yearLabel || !status) {
    showToast("Please select all required fields.", "error");
    return;
  }

  const form = event.target;
  const saveBtn = form.querySelector('button[type="submit"]');

  try {
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = "Saving...";
    }

    if (status === "Active") {
      const { error: updateErr } = await supabaseClient
        .from("academic_years")
        .update({ status: "Inactive" })
        .eq("status", "Active");

      if (updateErr) {
        showToast(
          "Permission denied when setting existing year to Inactive: " +
            updateErr.message,
          "error",
        );
        return;
      }
    }

    const { data, error } = await supabaseClient
      .from("academic_years")
      .insert([{ year_label: yearLabel, status, is_archived: false }])
      .select();

    if (error) {
      if (error.code === "23505") {
        showToast("This Academic Year has already been created.", "error");
        return;
      }
      if (error.code === "42501") {
        showToast(
          "You do not have permission to add an academic year.",
          "error",
        );
        return;
      }
      showToast(error.message, "error");
      return;
    }

    showToast("Academic Year added successfully!", "success");
    closeModal("academicYearModal");
    form.reset();
    await loadAcademicYears();
  } catch (err) {
    showToast(err.message || "An unexpected error occurred.", "error");
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save";
    }
  }
}

let originalYearData = {};

function openEditModal(id) {
  selectedYearId = id;
  const item = academicYears.find((y) => y.id === id);
  if (!item) return;

  const yearSelect = document.getElementById("editYearSelect");
  yearSelect.value = item.year_label;
  yearSelect.disabled = true;

  const statusSelect = document.getElementById("editStatusSelect");
  statusSelect.value = item.status;

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

  const hasChanges = status !== originalYearData.status;

  if (!hasChanges) {
    showToast("No changes detected.", "info");
    return;
  }

  if (!selectedYearId || !yearLabel || !status) {
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

    await handleSingleActiveStatus(status, selectedYearId);

    const { data, error } = await supabaseClient
      .from("academic_years")
      .update({ status })
      .eq("id", selectedYearId)
      .select();

    if (error) {
      if (error.code === "23505") {
        showToast("This Academic Year has already been created.", "error");
        return;
      }
      showToast("Error updating academic year: " + error.message, "error");
      return;
    }

    if (!data || data.length === 0) {
      showToast("Permission denied.", "error");
      return;
    }

    showToast("Academic Year updated successfully!", "success");
    closeModal("editAcademicYearModal");
    await loadAcademicYears();
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    if (updateBtn) {
      updateBtn.disabled = false;
      updateBtn.textContent = "Update";
    }
  }
}

function openArchiveModal(id, yearName) {
  selectedYearId = id;

  const nameElement = document.getElementById("archiveAcademicYearName");
  if (nameElement) {
    nameElement.textContent = yearName || "this Academic Year";
  }

  openModal("archiveAcademicYearModal");
}

async function handleConfirmArchive() {
  if (!selectedYearId) return;

  const archiveBtn = document.getElementById("confirmArchive");

  try {
    if (archiveBtn) {
      archiveBtn.disabled = true;
      archiveBtn.textContent = "Archiving...";
    }

    const { data, error } = await supabaseClient
      .from("academic_years")
      .update({ is_archived: true, status: "Inactive" })
      .eq("id", selectedYearId)
      .select();

    if (error) {
      showToast("Error archiving academic year: " + error.message, "error");
      return;
    }

    if (!data || data.length === 0) {
      showToast("Permission denied.", "error");
      return;
    }

    showToast("Academic year archived successfully!", "success");
    closeModal("archiveAcademicYearModal");
    await loadAcademicYears();
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    if (archiveBtn) {
      archiveBtn.disabled = false;
      archiveBtn.textContent = "Archive";
    }
  }
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

  if (
    modalId === "editAcademicYearModal" ||
    modalId === "archiveAcademicYearModal"
  ) {
    selectedYearId = null;
    originalYearData = {};
  }
}
function setupModalListeners() {
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

  document
    .getElementById("closeEditAcademicYearModal")
    ?.addEventListener("click", () => closeModal("editAcademicYearModal"));
  document
    .getElementById("cancelEditAcademicYearModal")
    ?.addEventListener("click", () => closeModal("editAcademicYearModal"));
  document
    .getElementById("editAcademicYearForm")
    ?.addEventListener("submit", handleEditAcademicYear);

  document
    .getElementById("cancelArchive")
    ?.addEventListener("click", () => closeModal("archiveAcademicYearModal"));
  document
    .getElementById("confirmArchive")
    ?.addEventListener("click", handleConfirmArchive);
}

