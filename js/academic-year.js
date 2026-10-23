const academicYearModal = document.getElementById("academicYearModal");

const editAcademicYearModal = document.getElementById("editAcademicYearModal");

window.addEventListener("click", (e) => {
  const modals = [academicYearModal, editAcademicYearModal];
  modals.forEach((modal) => {
    if (modal && modal.style.display === "flex" && e.target === modal) {
      closeModal(modal.id);
    }
  });
});

let academicYears = [];
let selectedYearId = null;

function academicYearErrorMessage(error, action = "update") {
  const code = String(error?.code || "").toLowerCase();
  const status = Number(error?.status || error?.statusCode || 0);
  const diagnostic = `${code} ${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`.toLowerCase();

  if (/school.{0,30}inactive|inactive.{0,30}school/.test(diagnostic)) {
    return "This school is inactive, so academic years cannot be changed right now. Contact your school administrator.";
  }
  if (
    code === "42501" ||
    status === 403 ||
    /row-level security|permission denied|insufficient privilege|not authorized|unauthorized|access denied|not allowed/.test(diagnostic)
  ) {
    return action === "load"
      ? "You do not have permission to view academic years. Contact your school administrator."
      : "You do not have permission to manage academic years. Contact your school administrator.";
  }
  if (status === 401 || code === "pgrst301" || /invalid jwt|session.*expired|refresh token/.test(diagnostic)) {
    return "Your session has expired. Sign in again and retry.";
  }
  if (/failed to fetch|fetch failed|network|connection|timeout|timed out/.test(diagnostic)) {
    return `Could not connect to ${action === "load" ? "load" : "save"} academic years. Check your internet connection and try again.`;
  }
  if (code === "23505" || /duplicate key|already exists|unique constraint/.test(diagnostic)) {
    return "This academic year already exists. Choose a different year.";
  }
  if (code === "pgrst116") {
    return "The selected academic year could not be found. Refresh the list and try again.";
  }
  return action === "load"
    ? "Academic years could not be loaded. Please try again."
    : action === "create"
      ? "The academic year could not be added. Please try again."
      : "The academic year could not be updated. Please try again.";
}

document.addEventListener("DOMContentLoaded", () => {
  loadAcademicYears();
  setupModalListeners();
});

async function loadAcademicYears() {
  renderTableLoading();

  try {
    const { data, error } = await supabaseClient
      .from("academic_years")
      .select("*")
      .order("year_label", { ascending: false });

    if (error) throw error;
    academicYears = data || [];
    renderAcademicYearsTable();
  } catch (error) {
    console.error("Academic year load failed:", error);
    const tbody = document.querySelector(".academic-years-table-card tbody");
    if (tbody) {
      const message = academicYearErrorMessage(error, "load");
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 1.5rem;">${escapeHTML(message)}<br><button type="button" onclick="loadAcademicYears()" style="margin-top: .75rem;">Try again</button></td></tr>`;
    }
  }
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
          <td>${escapeHTML(item.year_label || "")}</td>
          <td><span class="${statusClass}">${escapeHTML(item.status || "")}</span></td>
          <td>${formatDateTime(item.created_at)}</td>
          <td>${formatDateTime(item.updated_at)}</td>
          <td>
            <button class="academic-years-actions-btn edit-academicYear" data-id="${escapeHTML(item.id)}">
              <i class="fa-solid fa-pen"></i>
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

      if (updateErr) throw updateErr;
    }

    const { data, error } = await supabaseClient
      .from("academic_years")
      .insert([{ year_label: yearLabel, status }])
      .select();

    if (error) throw error;

    showToast("Academic Year added successfully!", "success");
    closeModal("academicYearModal");
    form.reset();
    await loadAcademicYears();
  } catch (err) {
    console.error("Academic year creation failed:", err);
    showToast(academicYearErrorMessage(err, "create"), "error");
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

    if (error) throw error;

    if (!data || data.length === 0) {
      const noRowsError = new Error("Academic year update returned no rows.");
      noRowsError.code = "42501";
      throw noRowsError;
    }

    showToast("Academic Year updated successfully!", "success");
    closeModal("editAcademicYearModal");
    await loadAcademicYears();
  } catch (err) {
    console.error("Academic year update failed:", err);
    showToast(academicYearErrorMessage(err, "update"), "error");
  } finally {
    if (updateBtn) {
      updateBtn.disabled = false;
      updateBtn.textContent = "Update";
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

  if (modalId === "editAcademicYearModal") {
    selectedYearId = null;
    originalYearData = {};
  }
}
function setupModalListeners() {
  document.addEventListener("click", (event) => {
    const button = event.target.closest(".edit-academicYear[data-id]");
    if (button) openEditModal(button.dataset.id);
  });
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

}

