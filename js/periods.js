// Update your openAddPeriodModal function to call it:
async function openAddPeriodModal() {
  const modal = document.getElementById("periodModal");
  const form = document.getElementById("periodForm");
  const editIdInput = document.getElementById("editPeriodId");
  const title = document.getElementById("periodModalTitle");

  if (form) form.reset();
  if (editIdInput) editIdInput.value = "";
  if (title) title.textContent = "Add Period";

  // Load active classes into dropdown
  await loadClassesIntoSchoolLevelDropdown();

  if (modal) {
    modal.classList.add("active");
  }

  if (typeof lockBodyScroll === "function") lockBodyScroll();
}
//Also, in your openEditPeriodModal(id) function, add await loadClassesIntoSchoolLevelDropdown(); right at the start before setting document.getElementById("schoolLevelSelect").value = period.school_level;.

function closePeriodModal() {
  const modal = document.getElementById("periodModal");
  const form = document.getElementById("periodForm");
  if (form) form.reset();
  if (modal) modal.classList.remove("active");
  if (typeof unLockBodyScroll === "function") unLockBodyScroll();
}

//  Change this:
// const fetchFilteredPeriods = async () => { ... }

//  To this:
async function fetchFilteredPeriods() {
  const searchQuery =
    document.getElementById("searchPeriodInput")?.value.trim() || "";
  const levelFilter = document.getElementById("filterLevelSelect")?.value || "";
  const statusFilter =
    document.getElementById("filterStatusSelect")?.value?.toLowerCase() || "";

  renderPeriodsTable([], true);

  let query = supabaseClient
    .from("periods")
    .select(
      `
    id, school_level, name, start_time, end_time, status, created_at, updated_at
  `,
    )
    .eq("is_archived", false);

  if (levelFilter) query = query.eq("school_level", levelFilter);
  if (statusFilter === "active") query = query.eq("status", "Active");
  else if (statusFilter === "inactive") query = query.eq("status", "Inactive");

  if (searchQuery) {
    query = query.or(
      `name.ilike.%${searchQuery}%,school_level.ilike.%${searchQuery}%`,
    );
  }

  query = query.order("start_time", { ascending: true });

  const { data: periods, error } = await query;

  if (error) {
    console.error("Fetch error:", error.message);
    if (typeof showToast === "function")
      showToast("Failed to load periods.", "error");
    return;
  }

  renderPeriodsTable(periods || []);
}

// Utility to format timestamps nicely
function formatDateTime(isoString) {
  if (!isoString) return "N/A";
  const date = new Date(isoString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

async function handleSavePeriod(event) {
  event.preventDefault();

  const periodId = document.getElementById("editPeriodId").value;
  const schoolLevel = document.getElementById("schoolLevelSelect").value;
  const name = document.getElementById("periodNameInput").value.trim();
  const startTime = document.getElementById("startTimeInput").value;
  const endTime = document.getElementById("endTimeInput").value;
  const status = document.getElementById("periodStatusSelect").value;

  if (!schoolLevel || !name || !startTime || !endTime || !status) {
    showToast("Please fill in all required fields.", "error");
    return;
  }

  if (startTime >= endTime) {
    showToast("Start time must be strictly before end time.", "error");
    return;
  }

  const saveBtn =
    document.getElementById("savePeriodBtn") ||
    event.target.querySelector('button[type="submit"]');

  try {
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = "Saving...";
    }

    const { data, error } = await supabaseClient
      .from("periods")
      .insert({
        school_level: schoolLevel,
        name: name,
        start_time: startTime,
        end_time: endTime,
        status: status,
        is_archived: false,
      })
      .select();

    if (error) {
      if (error.code === "42501") {
        showToast("Permission denied: Active admin status required.", "error");
        return;
      }
      if (error.code === "23P01") {
        showToast(
          `Time conflict! Overlaps with another period in ${schoolLevel}.`,
          "error",
        );
        return;
      }
      if (error.code === "23505") {
        showToast(
          `A period named '${name}' already exists in ${schoolLevel}.`,
          "error",
        );
        return;
      }
      showToast(error.message, "error");
      return;
    }

    showToast("Period created successfully!", "success");
    closePeriodModal();
    if (typeof unLockBodyScroll === "function") unLockBodyScroll();
    if (typeof populatePeriodFilterDropdowns === "function") {
      await populatePeriodFilterDropdowns();
    }
    await fetchFilteredPeriods();
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save Period";
    }
  }
}

async function handleTableActions(event) {
  const editBtn = event.target.closest(".edit-Period");
  const archiveBtn = event.target.closest(".archive-Period");

  if (editBtn) {
    const id = editBtn.dataset.id;
    await openEditPeriodModal(id);
    return;
  }

  if (archiveBtn) {
    const id = archiveBtn.dataset.id;
    await archivePeriod(id);
  }
}

let periodToArchive = null;

async function archivePeriod(id) {
  const { data: period, error } = await supabaseClient
    .from("periods")
    .select("id, school_level, name")
    .eq("id", id)
    .single();

  if (error || !period) {
    showToast("Failed to load period details.", "error");
    return;
  }

  periodToArchive = period;

  document.getElementById("archiveSchoolLevel").textContent =
    period.school_level;

  document.getElementById("archivePeriodName").textContent = period.name;

  document.getElementById("archivePeriodModal").classList.add("active");

  if (typeof lockBodyScroll === "function") {
    lockBodyScroll();
  }
}

async function confirmArchivePeriod() {
  if (!periodToArchive) return;

  const confirmBtn = document.getElementById("confirmArchive");

  try {
    if (confirmBtn) {
      confirmBtn.disabled = true;
      confirmBtn.textContent = "Archiving...";
    }

    const { error } = await supabaseClient
      .from("periods")
      .update({
        status: "Inactive",
        is_archived: true,
      })
      .eq("id", periodToArchive.id);

    if (error) {
      if (error.code === "42501") {
        showToast("Permission denied: Active admin status required.", "error");
        return;
      }

      showToast(error.message, "error");
      return;
    }

    showToast("Period archived successfully!", "success");

    closeArchivePeriodModal();

    await populatePeriodFilterDropdowns();
    await fetchFilteredPeriods();
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.textContent = "Archive";
    }
  }
}

function closeArchivePeriodModal() {
  const modal = document.getElementById("archivePeriodModal");

  if (modal) {
    modal.classList.remove("active");
  }

  periodToArchive = null;

  if (typeof unLockBodyScroll === "function") {
    unLockBodyScroll();
  }
}

// Renders periods array into the DOM table element
function renderPeriodsTable(periods = [], isLoading = false) {
  const tbody = document.getElementById("periodsTableBody");
  if (!tbody) return;

  if (isLoading) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 2rem; color: #64748b;">
        <i class="fa-solid fa-spinner fa-spin" style="margin-right: 0.5rem;"></i>
        Loading periods...
      </td></tr>`;
    return;
  }

  if (periods.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #777; padding: 20px;">
          No periods found.
        </td></tr>`;
    return;
  }

  tbody.innerHTML = periods
    .map((period) => {
      // 1. Determine status status class & formatting
      const isInactive = String(period.status).toLowerCase() === "inactive";
      const statusText = isInactive ? "Inactive" : "Active";
      const statusClass = isInactive
        ? "periods-status-inactive"
        : "periods-status-active";

      return `
    <tr>
      <td>${period.school_level}</td>
      <td>${period.name}</td>
      <td>${period.start_time}</td>
      <td>${period.end_time}</td>
      <td><span class="${statusClass}">${statusText}</span></td>
      <td>${formatDateTime(period.created_at)}</td>
      <td>${formatDateTime(period.updated_at)}</td>
      <td>
        <button class="periods-actions-btn edit-Period" data-id="${period.id}"> <i class="fa-solid fa-pen"></i></button>
        <button class="periods-actions-btn archive-Period" data-id="${period.id}"><i class="fa-solid fa-box-archive"></i></button>
      </td>
    </tr>
  `;
    })
    .join("");
}

// Populates filter dropdown options dynamically from Supabase
async function populatePeriodFilterDropdowns() {
  const levelSelect = document.getElementById("filterLevelSelect");
  if (!levelSelect) return;

  const { data, error } = await supabaseClient
    .from("periods")
    .select("school_level")
    .eq("is_archived", false);

  if (error || !data) return;

  const uniqueLevels = [...new Set(data.map((item) => item.school_level))];

  // Preserve selected option if any
  const currentVal = levelSelect.value;
  levelSelect.innerHTML =
    `<option value="">All Levels</option>` +
    uniqueLevels
      .map((lvl) => `<option value="${lvl}">${lvl}</option>`)
      .join("");
  levelSelect.value = currentVal;
}

// 1. Initialize Event Listeners on Page Load
document.addEventListener("DOMContentLoaded", () => {
  const periodForm = document.getElementById("periodForm");

  // FIX: Match the HTML ID 'addPeriod'
  const openModalBtn = document.getElementById("addPeriod");

  const closeModalBtn = document.getElementById("closePeriodModal");
  const cancelModalBtn = document.getElementById("cancelPeriodModal");
  const searchInput = document.getElementById("searchPeriodInput");
  const levelSelect = document.getElementById("filterLevelSelect");
  const statusSelect = document.getElementById("filterStatusSelect");

  // Form Submit Handler
  if (periodForm) {
    periodForm.addEventListener("submit", handleSavePeriod);
  }

  // Modal Open/Close Controls
  if (openModalBtn) openModalBtn.addEventListener("click", openAddPeriodModal);
  if (closeModalBtn) closeModalBtn.addEventListener("click", closePeriodModal);
  if (cancelModalBtn)
    cancelModalBtn.addEventListener("click", closePeriodModal);

  // Live Filtering Event Listeners
  if (searchInput) searchInput.addEventListener("input", fetchFilteredPeriods);
  if (levelSelect) levelSelect.addEventListener("change", fetchFilteredPeriods);
  if (statusSelect)
    statusSelect.addEventListener("change", fetchFilteredPeriods);

  // Table Action Event Delegation (Edit & Archive)
  const tbody = document.getElementById("periodsTableBody");
  if (tbody) {
    tbody.addEventListener("click", handleTableActions);
  }

  // Initial Data Load
  fetchFilteredPeriods();
  populatePeriodFilterDropdowns();

  const closeEditPeriodBtn = document.getElementById("closeEditPeriodModal");

  const cancelEditPeriodBtn = document.getElementById("cancelEditPeriodModal");

  if (closeEditPeriodBtn) {
    closeEditPeriodBtn.addEventListener("click", closeEditPeriodModal);
  }

  if (cancelEditPeriodBtn) {
    cancelEditPeriodBtn.addEventListener("click", closeEditPeriodModal);
  }

  const editPeriodForm = document.getElementById("editPeriodForm");

  if (editPeriodForm) {
    editPeriodForm.addEventListener("submit", handleUpdatePeriod);
  }

  const cancelArchiveBtn = document.getElementById("cancelArchive");

  const confirmArchiveBtn = document.getElementById("confirmArchive");

  if (cancelArchiveBtn) {
    cancelArchiveBtn.addEventListener("click", closeArchivePeriodModal);
  }

  if (confirmArchiveBtn) {
    confirmArchiveBtn.addEventListener("click", confirmArchivePeriod);
  }
});

async function handleUpdatePeriod(event) {
  event.preventDefault();

  const periodId = document.getElementById("editPeriodId").value;
  const name = document.getElementById("editPeriodNameInput").value.trim();
  const startTime = document.getElementById("editStartTimeInput").value;
  const endTime = document.getElementById("editEndTimeInput").value;
  const status = document.getElementById("editPeriodStatusSelect").value;

  if (!periodId || !name || !startTime || !endTime || !status) {
    showToast("Please fill in all required fields.", "error");
    return;
  }

  if (startTime >= endTime) {
    showToast("Start time must be strictly before end time.", "error");
    return;
  }

  // Check whether anything actually changed
  const noChanges =
    originalPeriodData &&
    name === originalPeriodData.name &&
    startTime === originalPeriodData.start_time &&
    endTime === originalPeriodData.end_time &&
    status === originalPeriodData.status;

  if (noChanges) {
    showToast("No changes detected.", "info");
    return;
  }

  const updateBtn =
    document.getElementById("updatePeriodBtn") ||
    event.target.querySelector('button[type="submit"]');

  try {
    if (updateBtn) {
      updateBtn.disabled = true;
      updateBtn.textContent = "Updating...";
    }

    const { data, error } = await supabaseClient
      .from("periods")
      .update({
        name: name,
        start_time: startTime,
        end_time: endTime,
        status: status,
      })
      .eq("id", periodId)
      .select();

    if (error) {
      if (error.code === "42501") {
        showToast("Permission denied: Active admin status required.", "error");
        return;
      }

      if (error.code === "23P01") {
        showToast(
          "Time conflict! This period overlaps with another period.",
          "error",
        );
        return;
      }

      if (error.code === "23505") {
        showToast(`A period named '${name}' already exists.`, "error");
        return;
      }

      showToast(error.message, "error");
      return;
    }

    showToast("Period updated successfully!", "success");

    closeEditPeriodModal();

    if (typeof unLockBodyScroll === "function") {
      unLockBodyScroll();
    }

    if (typeof populatePeriodFilterDropdowns === "function") {
      await populatePeriodFilterDropdowns();
    }

    await fetchFilteredPeriods();
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    if (updateBtn) {
      updateBtn.disabled = false;
      updateBtn.textContent = "Update Period";
    }
  }
}

let originalPeriodData = null;

function closeEditPeriodModal() {
  const modal = document.getElementById("editPeriodModal");
  const form = document.getElementById("editPeriodForm");

  if (form) form.reset();

  if (modal) modal.classList.remove("active");

  if (typeof unLockBodyScroll === "function") {
    unLockBodyScroll();
  }
}

async function openEditPeriodModal(id) {
  const { data: period, error } = await supabaseClient
    .from("periods")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !period) {
    showToast("Failed to load period details.", "error");
    return;
  }

  originalPeriodData = {
    name: period.name,
    start_time: period.start_time,
    end_time: period.end_time,
    status: period.status,
  };

  document.getElementById("editPeriodId").value = period.id;

  document.getElementById("editSchoolLevelInput").value = period.school_level;

  document.getElementById("editPeriodNameInput").value = period.name;

  document.getElementById("editStartTimeInput").value = period.start_time;

  document.getElementById("editEndTimeInput").value = period.end_time;

  document.getElementById("editPeriodStatusSelect").value = period.status;

  document.getElementById("editPeriodModalTitle").textContent = "Edit Period";

  document.getElementById("editPeriodModal").classList.add("active");

  if (typeof lockBodyScroll === "function") {
    lockBodyScroll();
  }
}

async function loadClassesIntoSchoolLevelDropdown() {
  const select = document.getElementById("schoolLevelSelect");
  if (!select) return;

  const staticLevels = [
    "Nursery",
    "Primary",
    "Junior Primary",
    "Senior Primary",
    "Secondary",
    "Junior Secondary",
    "Senior Secondary",
  ];

  const currentVal = select.value;

  // Only fetch ACTIVE classes.
  // Inactive classes are never included.
  const { data: classes, error } = await supabaseClient
    .from("classes")
    .select("name")
    .eq("status", "active")
    .order("name", { ascending: true });

  if (error) {
    console.error("Failed to load active classes:", error);
    return;
  }

  const activeClasses = (classes || []).map((c) => c.name).filter(Boolean);

  select.innerHTML = `
    <option value="">Select Level or Class</option>

    <optgroup label="School Levels">
      ${staticLevels
        .map((lvl) => `<option value="${lvl}">${lvl}</option>`)
        .join("")}
    </optgroup>

    ${
      activeClasses.length > 0
        ? `<optgroup label="Active Classes">
            ${activeClasses
              .map((cls) => `<option value="${cls}">${cls}</option>`)
              .join("")}
           </optgroup>`
        : `<optgroup label="Active Classes">
            <option disabled>No active classes found</option>
           </optgroup>`
    }
  `;

  // Restore the previous selection if it still exists.
  if (
    currentVal &&
    [...select.options].some((option) => option.value === currentVal)
  ) {
    select.value = currentVal;
  }
}
