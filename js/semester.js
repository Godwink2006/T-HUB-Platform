let terms = [];
let selectedTermId = null;
let originalTermData = {};

function semesterErrorMessage(error, action = "update") {
  const code = String(error?.code || "").toLowerCase();
  const status = Number(error?.status || error?.statusCode || 0);
  const diagnostic = `${code} ${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`.toLowerCase();

  if (/school.{0,30}inactive|inactive.{0,30}school/.test(diagnostic)) {
    return "This school is inactive, so semesters cannot be changed right now. Contact your school administrator.";
  }
  if (
    code === "42501" ||
    status === 403 ||
    /row-level security|permission denied|insufficient privilege|not authorized|unauthorized|access denied|not allowed/.test(diagnostic)
  ) {
    return action === "load"
      ? "You do not have permission to view semesters. Contact your school administrator."
      : "You do not have permission to manage semesters. Contact your school administrator.";
  }
  if (status === 401 || code === "pgrst301" || /invalid jwt|session.*expired|refresh token/.test(diagnostic)) {
    return "Your session has expired. Sign in again and retry.";
  }
  if (/failed to fetch|fetch failed|network|connection|timeout|timed out/.test(diagnostic)) {
    return `Could not connect while ${action === "load" ? "loading" : "saving"} semesters. Check your internet connection and try again.`;
  }
  if (code === "23505" || /duplicate key|already exists|unique constraint/.test(diagnostic)) {
    return "This semester already exists for the selected academic year.";
  }
  if (code === "pgrst116") {
    return "The selected semester could not be found. Refresh the list and try again.";
  }
  return action === "load"
    ? "Semesters could not be loaded. Please try again."
    : action === "create"
      ? "The semester could not be added. Please try again."
      : "The semester could not be updated. Please try again.";
}

const termModal = document.getElementById("termModal");
const editTermModal = document.getElementById("editTermModal");

document.addEventListener("DOMContentLoaded", () => {
  loadTerms();
  populateAcademicYearDropdowns();
  setupAcademicYearRealtime();
  setupModalListeners();
});

window.addEventListener("click", (e) => {
  const modals = [termModal, editTermModal];
  modals.forEach((modal) => {
    if (modal && modal.style.display === "flex" && e.target === modal) {
      closeModal(modal.id);
    }
  });
});

function validateTermDates(
  academicYearId,
  name,
  startDate,
  endDate,
  currentTermId = null,
) {
  if (new Date(startDate) >= new Date(endDate)) {
    return "End date must be strictly after start date.";
  }

  if (name === "2nd Semester") {
    const firstSemester = terms.find(
      (t) =>
        t.academic_year_id === academicYearId &&
        t.name === "1st Semester" &&
        t.id !== currentTermId,
    );

    if (firstSemester && firstSemester.end_date) {
      if (new Date(startDate) <= new Date(firstSemester.end_date)) {
        return `2nd Semester start date must be after 1st Semester end date (${formatDate(firstSemester.end_date)}).`;
      }
    }
  }

  return null;
}

async function loadTerms() {
  renderTableLoading();

  try {
    const { data, error } = await supabaseClient
      .from("terms")
      .select(
        `
      *,
      academic_years ( year_label )
    `,
      )
      .order("created_at", { ascending: false });

    if (error) throw error;
    terms = data || [];
    renderTermsTable();
  } catch (error) {
    console.error("Semester load failed:", error);
    const tbody = document.querySelector(".terms-table-card tbody");
    if (tbody) {
      const message = semesterErrorMessage(error, "load");
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 1.5rem;">${escapeHTML(message)}<br><button type="button" onclick="loadTerms()" style="margin-top: .75rem;">Try again</button></td></tr>`;
    }
  }

}

function renderTableLoading() {
  const tbody = document.querySelector(".terms-table-card tbody");
  if (!tbody) return;

  tbody.innerHTML = `
    <tr>
      <td colspan="8" style="text-align: center; padding: 2rem; color: #64748b;">
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
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;">No semesters found.</td></tr>`;
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
          <td>${escapeHTML(item.name || "")}</td>
          <td>${escapeHTML(yearLabel)}</td>
          <td><span class="${statusClass}">${escapeHTML(item.status || "")}</span></td>
          <td>${formatDate(item.start_date)}</td>
<td>${formatDate(item.end_date)}</td>
<td>${formatDateTime(item.created_at)}</td>
<td>${formatDateTime(item.updated_at)}</td>
          <td>
            <button class="terms-actions-btn edit-term" data-id="${escapeHTML(item.id)}">
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

function formatDate(dateString) {
  if (!dateString) return "N/A";

  const [year, month, day] = dateString.split("-");
  const date = new Date(year, month - 1, day);

  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

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

function setupAcademicYearRealtime() {
  supabaseClient
    .channel("public:academic_years")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "academic_years",
      },
      (payload) => {
        populateAcademicYearDropdowns();
      },
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
      }
    });
}

async function handleAddTerm(event) {
  event.preventDefault();

  const academicYearId = document.getElementById("addAcademicYearSelect").value;
  const name = document.getElementById("addSemesterNameSelect").value;
  const startDate = document.getElementById("addStartDate").value;
  const endDate = document.getElementById("addEndDate").value;

  const rawStatus = document.getElementById("addStatusSelect").value;
  const status =
    rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1).toLowerCase();

  if (!academicYearId || !name || !startDate || !endDate || !status) {
    showToast("Please fill in all required fields.", "error");
    return;
  }

  const validationError = validateTermDates(
    academicYearId,
    name,
    startDate,
    endDate,
  );
  if (validationError) {
    showToast(validationError, "error");
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
        },
      ])
      .select();

    if (error) throw error;

    showToast("Semester added successfully!", "success");
    closeModal("termModal");
    form.reset();
    await loadTerms();
  } catch (err) {
    console.error("Semester creation failed:", err);
    showToast(semesterErrorMessage(err, "create"), "error");
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

  if (editSelect) {
    const yearLabel = item.academic_years?.year_label || "N/A";
    editSelect.innerHTML = `<option value="${escapeHTML(item.academic_year_id)}">${escapeHTML(yearLabel)}</option>`;
    editSelect.value = item.academic_year_id || "";
    editSelect.disabled = true;
  }

  if (nameSelect) {
    nameSelect.value = item.name || "";
    nameSelect.disabled = true;
  }

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

  const validationError = validateTermDates(
    academicYearId,
    name,
    startDate,
    endDate,
    selectedTermId,
  );
  if (validationError) {
    showToast(validationError, "error");
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

    const { data, error } = await supabaseClient
      .from("terms")
      .update({
        start_date: startDate,
        end_date: endDate,
        status,
      })
      .eq("id", selectedTermId)
      .select();

    if (error) throw error;

    if (!data || data.length === 0) {
      const noRowsError = new Error("Semester update returned no rows.");
      noRowsError.code = "42501";
      throw noRowsError;
    }

    showToast("Semester updated successfully!", "success");
    closeModal("editTermModal");
    await loadTerms();
  } catch (err) {
    console.error("Semester update failed:", err);
    showToast(semesterErrorMessage(err, "update"), "error");
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

  if (modalId === "editTermModal") {
    originalTermData = null;
    selectedTermId = null;
  }
}

function setupModalListeners() {
  document.addEventListener("click", (event) => {
    const button = event.target.closest(".edit-term[data-id]");
    if (button) openEditModal(button.dataset.id);
  });
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

  document
    .getElementById("closeEditTermModal")
    ?.addEventListener("click", () => closeModal("editTermModal"));
  document
    .getElementById("cancelEditTermModal")
    ?.addEventListener("click", () => closeModal("editTermModal"));
  document
    .getElementById("editTermForm")
    ?.addEventListener("submit", handleEditTerm);

}

async function populateAcademicYearDropdowns() {
  const addSelect = document.getElementById("addAcademicYearSelect");
  const editSelect = document.getElementById("editAcademicYearSelect");

  try {
    const { data, error } = await supabaseClient
      .from("academic_years")
      .select("id, year_label, status")
      .order("year_label", { ascending: false });

    if (error) throw error;

    if (!data || data.length === 0) {
      const emptyOption = `<option value="">No Academic Years Available</option>`;
      if (addSelect) addSelect.innerHTML = emptyOption;
      if (editSelect) editSelect.innerHTML = emptyOption;
      return;
    }

    if (addSelect) {
      const activeYears = data.filter((item) => item.status === "Active");
      addSelect.innerHTML = activeYears.length
        ? activeYears
            .map(
              (item) => `<option value="${escapeHTML(item.id)}">${escapeHTML(item.year_label || "")}</option>`,
            )
            .join("")
        : `<option value="">No Active Academic Years Available</option>`;
    }

    if (editSelect && editTermModal?.style.display !== "flex") {
      editSelect.innerHTML = data
        .map((item) => `<option value="${escapeHTML(item.id)}">${escapeHTML(item.year_label || "")}</option>`)
        .join("");
    }
  } catch (error) {
    console.error("Academic year dropdown load failed:", error);
    const message = semesterErrorMessage(error, "load");
    if (addSelect) addSelect.innerHTML = `<option value="">Academic years unavailable</option>`;
    if (editSelect && editTermModal?.style.display !== "flex") {
      editSelect.innerHTML = `<option value="">Academic years unavailable</option>`;
    }
    showToast(message, "error");
  }
}
