async function openAddPeriodModal() {
  const modal = document.getElementById("periodModal");
  const form = document.getElementById("periodForm");
  const editIdInput = document.getElementById("editPeriodId");
  const title = document.getElementById("periodModalTitle");

  if (form) form.reset();
  if (editIdInput) editIdInput.value = "";
  if (title) title.textContent = "Add Period";

  await loadClassesIntoSchoolLevelDropdown();

  if (modal) {
    modal.classList.add("active");
  }

  if (typeof lockBodyScroll === "function") lockBodyScroll();
}

function closePeriodModal() {
  const modal = document.getElementById("periodModal");
  const form = document.getElementById("periodForm");
  if (form) form.reset();
  if (modal) modal.classList.remove("active");
  if (typeof unLockBodyScroll === "function") unLockBodyScroll();
}

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

function formatDateTime(isoString) {
  if (!isoString) return "N/A";
  const date = new Date(isoString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function convert12to24(timeStr) {
  if (!timeStr) return "";

  if (
    !timeStr.toLowerCase().includes("am") &&
    !timeStr.toLowerCase().includes("pm")
  ) {
    return timeStr.length === 5 ? `${timeStr}:00` : timeStr;
  }

  const [time, modifier] = timeStr.trim().split(" ");
  let [hours, minutes] = time.split(":");

  if (hours === "12") {
    hours = "00";
  }

  if (modifier.toUpperCase() === "PM") {
    hours = parseInt(hours, 10) + 12;
  }

  return `${String(hours).padStart(2, "0")}:${minutes}:00`;
}

async function handleSavePeriod(event) {
  event.preventDefault();

  const periodId = document.getElementById("editPeriodId")?.value;
  const schoolLevelSelect = document.getElementById("schoolLevelSelect");
  const schoolLevel = schoolLevelSelect?.value;

  const selectedOption =
    schoolLevelSelect?.options[schoolLevelSelect.selectedIndex];
  const schoolId = selectedOption?.dataset?.schoolId || null;

  const name = document.getElementById("periodNameInput")?.value.trim();
  let rawStartTime = document.getElementById("startTimeInput")?.value;
  let rawEndTime = document.getElementById("endTimeInput")?.value;
  const status = document.getElementById("periodStatusSelect")?.value;

  if (!schoolLevel || !name || !rawStartTime || !rawEndTime || !status) {
    showToast("Please fill in all required fields.", "error");
    return;
  }

  const startTime = convert12to24(rawStartTime);
  const endTime = convert12to24(rawEndTime);

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

    const payload = {
      school_level: schoolLevel,
      name: name,
      start_time: startTime,
      end_time: endTime,
      status: status,
    };

    if (schoolId) {
      payload.school_id = schoolId;
    }

    let query;

    if (periodId) {
      query = supabaseClient
        .from("periods")
        .update(payload)
        .eq("id", periodId)
        .select();
    } else {
      query = supabaseClient.from("periods").insert(payload).select();
    }

    const { data, error } = await query;

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

    showToast(
      periodId
        ? "Period updated successfully!"
        : "Period created successfully!",
      "success",
    );
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

  if (editBtn) {
    const id = editBtn.dataset.id;
    await openEditPeriodModal(id);
    return;
  }

}

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
      const isInactive = String(period.status).toLowerCase() === "inactive";
      const statusText = isInactive ? "Inactive" : "Active";
      const statusClass = isInactive
        ? "periods-status-inactive"
        : "periods-status-active";

      return `
    <tr>
      <td>${escapeHTML(period.school_level || "")}</td>
      <td>${escapeHTML(period.name || "")}</td>
      <td>${escapeHTML(period.start_time || "")}</td>
      <td>${escapeHTML(period.end_time || "")}</td>
      <td><span class="${statusClass}">${statusText}</span></td>
      <td>${formatDateTime(period.created_at)}</td>
      <td>${formatDateTime(period.updated_at)}</td>
      <td>
        <button class="periods-actions-btn edit-Period" data-id="${escapeHTML(period.id)}"> <i class="fa-solid fa-pen"></i></button>
      </td>
    </tr>
  `;
    })
    .join("");
}

async function populatePeriodFilterDropdowns() {
  const levelSelect = document.getElementById("filterLevelSelect");
  if (!levelSelect) return;

  const { data, error } = await supabaseClient
    .from("periods")
    .select("school_level")

  if (error || !data) return;

  const uniqueLevels = [...new Set(data.map((item) => item.school_level))];

  const currentVal = levelSelect.value;
  levelSelect.innerHTML =
    `<option value="">All Levels</option>` +
    uniqueLevels
      .map((lvl) => `<option value="${lvl}">${lvl}</option>`)
      .join("");
  levelSelect.value = currentVal;
}

document.addEventListener("DOMContentLoaded", () => {
  const periodForm = document.getElementById("periodForm");

  const openModalBtn = document.getElementById("addPeriod");

  const closeModalBtn = document.getElementById("closePeriodModal");
  const cancelModalBtn = document.getElementById("cancelPeriodModal");
  const searchInput = document.getElementById("searchPeriodInput");
  const levelSelect = document.getElementById("filterLevelSelect");
  const statusSelect = document.getElementById("filterStatusSelect");

  if (periodForm) {
    periodForm.addEventListener("submit", handleSavePeriod);
  }

  if (openModalBtn) openModalBtn.addEventListener("click", openAddPeriodModal);
  if (closeModalBtn) closeModalBtn.addEventListener("click", closePeriodModal);
  if (cancelModalBtn)
    cancelModalBtn.addEventListener("click", closePeriodModal);

  if (searchInput) searchInput.addEventListener("input", fetchFilteredPeriods);
  if (levelSelect) levelSelect.addEventListener("change", fetchFilteredPeriods);
  if (statusSelect)
    statusSelect.addEventListener("change", fetchFilteredPeriods);

  const tbody = document.getElementById("periodsTableBody");
  if (tbody) {
    tbody.addEventListener("click", handleTableActions);
  }

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

    if (!data || data.length === 0) {
      showToast(
        "Permission denied: You are not allowed to update this period.",
        "error",
      );
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

  const currentVal = select.value;

  const levelLabels = {
    nursery: "Nursery",
    junior_primary: "Junior Primary",
    senior_primary: "Senior Primary",
    junior_secondary: "Junior Secondary",
    senior_secondary: "Senior Secondary",
  };

  const { data: classes, error } = await supabaseClient
    .from("classes")
    .select("name, school_level")
    .eq("status", "active")
    .order("name", { ascending: true });

  if (error) {
    console.error("Failed to load active classes:", error);
    return;
  }

  const activeClasses = classes || [];

  const uniqueLevels = [
    ...new Set(activeClasses.map((c) => c.school_level).filter(Boolean)),
  ];

  select.innerHTML = `
    <option value="">Select Level or Class</option>

    <optgroup label="School Levels">
      ${
        uniqueLevels.length > 0
          ? uniqueLevels
              .map(
                (lvl) =>
                  `<option value="${lvl}">${levelLabels[lvl] || lvl}</option>`,
              )
              .join("")
          : `<option disabled>No active school levels</option>`
      }
    </optgroup>

    <optgroup label="Active Classes">
      ${
        activeClasses.length > 0
          ? activeClasses
              .map(
                (cls) =>
                  `<option value="${escapeHTML(cls.name)}" data-level="${escapeHTML(cls.school_level)}">${escapeHTML(cls.name)}</option>`,
              )
              .join("")
          : `<option disabled>No active classes found</option>`
      }
    </optgroup>
  `;

  if (
    currentVal &&
    [...select.options].some((option) => option.value === currentVal)
  ) {
    select.value = currentVal;
  }
}

