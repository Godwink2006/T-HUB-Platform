async function updateFeeStructure(shouldPrint = false) {
  const structureId = document.getElementById("editStructureId")?.value;
  const status = document.getElementById("editStatusSelect")?.value;

  if (!structureId) {
    if (typeof showToast === "function")
      showToast("Invalid structure target.", "error");
    return;
  }

  if (tempEditFeeItems.length === 0) {
    if (typeof showToast === "function")
      showToast("Please add at least one fee item.", "error");
    return;
  }

  const totalAmount = tempEditFeeItems.reduce(
    (sum, item) => sum + Number(item.amount),
    0,
  );

  const originalStatus =
    document.getElementById("editStructureModal")?.dataset.originalStatus;
  const originalItemsJson =
    document.getElementById("editStructureModal")?.dataset.originalItems;

  const currentItemsJson = normalizeItems(tempEditFeeItems);

  if (status === originalStatus && currentItemsJson === originalItemsJson) {
    if (typeof showToast === "function")
      showToast("No changes detected.", "info");
    return;
  }

  const btnUpdate = document.getElementById("btnUpdateStructure");
  const btnUpdateAndPrint = document.getElementById(
    "btnUpdateAndPrintStructure",
  );

  const originalUpdateText = btnUpdate ? btnUpdate.innerHTML : "";
  const originalPrintText = btnUpdateAndPrint
    ? btnUpdateAndPrint.innerHTML
    : "";

  if (btnUpdate) {
    btnUpdate.disabled = true;
    if (!shouldPrint) btnUpdate.innerHTML = `Updating...`;
  }
  if (btnUpdateAndPrint) {
    btnUpdateAndPrint.disabled = true;
    if (shouldPrint) btnUpdateAndPrint.innerHTML = `Updating...`;
  }

  try {
    const { error: rpcErr } = await supabaseClient.rpc(
      "update_fee_structure_atomic",
      {
        p_structure_id: structureId,
        p_status: status,
        p_total_amount: totalAmount,
        p_items: tempEditFeeItems,
      },
    );

    if (rpcErr) throw rpcErr;

    if (typeof showToast === "function") {
      showToast("Fee Structure updated successfully!", "success");
    }

    const modal = document.getElementById("editStructureModal");
    if (modal) modal.style.display = "none";
    if (typeof unLockBodyScroll === "function") unLockBodyScroll();

    if (typeof loadFeeStructures === "function") {
      await loadFeeStructures();
    }

    if (shouldPrint) {
      setTimeout(() => {
        window.print();
      }, 100);
    }
  } catch (err) {
    console.error("Error updating structure:", err);

    let message = err.message || "Failed to update fee structure.";

    if (err.code === "42501" || err.message?.includes("row-level security")) {
      message =
        "Unauthorized: You do not have permission to update fee structures.";
    }

    if (typeof showToast === "function") {
      showToast(message, "error");
    }
  } finally {
    if (btnUpdate) {
      btnUpdate.disabled = false;
      btnUpdate.innerHTML = originalUpdateText;
    }
    if (btnUpdateAndPrint) {
      btnUpdateAndPrint.disabled = false;
      btnUpdateAndPrint.innerHTML = originalPrintText;
    }
  }
}

window.updateFeeStructure = updateFeeStructure;

const normalizeItems = (arr) =>
  JSON.stringify(
    (arr || [])
      .map((i) => {
        const rawName = i?.name || i?.fee_name || "";
        return {
          name: rawName.trim().toLowerCase(),
          amount: Number(i?.amount || 0),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name)),
  );

function closeCreateModal() {
  const modal = document.getElementById("structureModal");
  if (modal) modal.style.display = "none";
  tempFeeItems = [];
  renderTempFeeItems();
  if (typeof unLockBodyScroll === "function") unLockBodyScroll();
}

let tempFeeItems = [];

const addItemForm = document.getElementById("addItemForm");
const feeItemNameInput = document.getElementById("feeItemName");
const feeItemAmountInput = document.getElementById("feeItemAmount");
const feeItemsBody = document.getElementById("feeItemsBody");
const totalFeeAmountEl = document.getElementById("totalFeeAmount");

function renderTempFeeItems() {
  if (!feeItemsBody) return;

  feeItemsBody.innerHTML = "";

  if (tempFeeItems.length === 0) {
    feeItemsBody.innerHTML = `
      <tr>
        <td colspan="3" style="text-align: center; color: #888; padding: 12px;">
          No fee items added yet.
        </td>
      </tr>
    `;
    if (totalFeeAmountEl) totalFeeAmountEl.textContent = "$0.00";
    return;
  }

  let grandTotal = 0;

  tempFeeItems.forEach((item, index) => {
    grandTotal += Number(item.amount);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHTML(item.name || "")}</td>
      <td>$${Number(item.amount).toFixed(2)}</td>
      <td style="text-align: right;">
        <button type="button" class="structures-actions-btn delete-addItem" data-index="${index}">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </td>
    `;
    feeItemsBody.appendChild(tr);
  });

  if (totalFeeAmountEl) {
    totalFeeAmountEl.textContent = `$${grandTotal.toFixed(2)}`;
  }
}

if (addItemForm) {
  addItemForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const name = feeItemNameInput?.value.trim();
    const rawAmount = document.getElementById("feeItemAmount")?.value.trim();
    const amount = parseFloat(rawAmount);

    if (!name || rawAmount === "" || isNaN(amount) || amount < 0) {
      showToast(
        "Please provide a valid item name and non-negative amount.",
        "error",
      );
      return;
    }

    const exists = tempFeeItems.some(
      (item) => item.name.toLowerCase() === name.toLowerCase(),
    );
    if (exists) {
      showToast(`"${name}" is already in the list.`, "error");
      return;
    }

    tempFeeItems.push({ name, amount });

    renderTempFeeItems();

    addItemForm.reset();
    addItemModal.style.display = "none";
  });
}

if (feeItemsBody) {
  feeItemsBody.addEventListener("click", (e) => {
    const deleteBtn = e.target.closest(".delete-addItem");
    if (deleteBtn) {
      const index = deleteBtn.getAttribute("data-index");
      tempFeeItems.splice(index, 1);
      renderTempFeeItems();
    }
  });
}

async function populateInitialDropdowns() {
  const academicYearSelect = document.getElementById("academicYearSelect");
  const classSelect = document.getElementById("classSelect");

  try {
    if (academicYearSelect) {
      const { data: years, error: yearsErr } = await supabaseClient
        .from("academic_years")
        .select("id, year_label")
        .eq("status", "Active")
        .order("year_label", { ascending: false });

      if (yearsErr) throw yearsErr;

      academicYearSelect.innerHTML = `<option value="">Select Academic Year</option>`;
      years?.forEach((yr) => {
        academicYearSelect.innerHTML += `<option value="${yr.id}">${yr.year_label}</option>`;
      });
    }

    if (classSelect) {
      const { data: classes, error: classErr } = await supabaseClient
        .from("classes")
        .select("id, name")
        .eq("status", "active")
        .order("name", { ascending: true });

      if (classErr) throw classErr;

      classSelect.innerHTML = `<option value="">Select Class</option>`;
      classes?.forEach((cls) => {
        classSelect.innerHTML += `<option value="${escapeHTML(cls.id)}">${escapeHTML(cls.name || "")}</option>`;
      });
    }
  } catch (err) {
    console.error("Error loading initial dropdowns:", err.message);
  }
}

async function fetchSemestersForYear(academicYearId) {
  const semesterSelect = document.getElementById("semesterSelect");
  if (!semesterSelect) return;

  if (!academicYearId) {
    semesterSelect.innerHTML = `<option value="">Select Semester</option>`;
    return;
  }

  try {
    const { data: terms, error } = await supabaseClient
      .from("terms")
      .select("id, name")
      .eq("academic_year_id", academicYearId)
      .order("name", { ascending: true });

    if (error) throw error;

    semesterSelect.innerHTML = `<option value="">Select Semester</option>`;

    if (!terms || terms.length === 0) {
      semesterSelect.innerHTML += `<option value="" disabled>No semesters found for this year</option>`;
      return;
    }

    terms.forEach((tm) => {
        semesterSelect.innerHTML += `<option value="${escapeHTML(tm.id)}">${escapeHTML(tm.name || "")}</option>`;
    });
  } catch (err) {
    console.error("Error fetching semesters for year:", err.message);
  }
}

const academicYearSelect = document.getElementById("academicYearSelect");

async function saveFeeStructure(shouldPrint = false) {
  const academicYearId = document.getElementById("academicYearSelect")?.value;
  const termId = document.getElementById("semesterSelect")?.value;
  const classId = document.getElementById("classSelect")?.value;
  const status = document.getElementById("statusSelect")?.value || "Active";

  if (!academicYearId || !termId || !classId) {
    showToast("Please select Academic Year, Semester, and Class.", "error");
    return;
  }

  if (tempFeeItems.length === 0) {
    showToast("Please add at least one fee item before saving.", "error");
    return;
  }

  const totalAmount = tempFeeItems.reduce(
    (sum, item) => sum + Number(item.amount),
    0,
  );

  const saveBtn = document.getElementById("saveStructureBtn");
  const saveAndPrintBtn = document.getElementById("saveAndPrintBtn");
  if (saveBtn) saveBtn.disabled = true;
  if (saveAndPrintBtn) saveAndPrintBtn.disabled = true;

  const originalSaveText = saveBtn ? saveBtn.innerHTML : "";
  const originalPrintText = saveAndPrintBtn ? saveAndPrintBtn.innerHTML : "";

  if (saveBtn && !shouldPrint) saveBtn.innerHTML = "Saving...";
  if (saveAndPrintBtn && shouldPrint) saveAndPrintBtn.innerHTML = "Saving...";

  try {
    const { data: newStructureId, error } = await supabaseClient.rpc(
      "create_fee_structure_atomic",
      {
        p_academic_year_id: academicYearId,
        p_term_id: termId,
        p_class_id: classId,
        p_status: status,
        p_total_amount: totalAmount,
        p_items: tempFeeItems,
      },
    );

    if (error) throw error;

    showToast("Fee Structure saved successfully!", "success");

    if (shouldPrint) {
      setTimeout(() => window.print(), 100);
    }

    if (typeof loadFeeStructures === "function") await loadFeeStructures();

    tempFeeItems = [];
    renderTempFeeItems();
    document.getElementById("structureForm")?.reset();

    const semesterSelect = document.getElementById("semesterSelect");
    if (semesterSelect) {
      semesterSelect.innerHTML = `<option value="">Select Semester</option>`;
    }

    const modal = document.getElementById("createStructureModal");
    if (modal) modal.style.display = "none";
    if (typeof unLockBodyScroll === "function") unLockBodyScroll();
  } catch (err) {
    console.error("Error saving fee structure:", err);

    let message = "Failed to save fee structure.";

    if (err.code === "23505") {
      message =
        "A fee structure already exists for this Class, Academic Year, and Semester.";
    } else if (
      err.code === "42501" ||
      err.message?.includes("row-level security")
    ) {
      message =
        "Unauthorized: You do not have permission to create fee structures.";
    } else if (err.message) {
      message = err.message;
    }

    showToast(message, "error");
  } finally {
    if (saveBtn) saveBtn.disabled = false;
    if (saveAndPrintBtn) saveAndPrintBtn.disabled = false;

    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = originalSaveText;
    }
    if (saveAndPrintBtn) {
      saveAndPrintBtn.disabled = false;
      saveAndPrintBtn.innerHTML = originalPrintText;
    }
  }
}

const structureForm = document.getElementById("structureForm");
if (structureForm) {
  structureForm.addEventListener("submit", (e) => {
    e.preventDefault();
    saveFeeStructure(false);
  });
}

const saveAndPrintBtn = document.getElementById("saveAndPrintBtn");
if (saveAndPrintBtn) {
  saveAndPrintBtn.addEventListener("click", () => {
    saveFeeStructure(true);
  });
}

let allFeeStructures = [];

async function loadFeeStructures() {
  const tbody = document.getElementById("feeStructuresBody");
  if (!tbody) return;

  tbody.innerHTML = `
    <tr>
        <td colspan="8" style="text-align: center; padding: 2rem; color: #64748b;">
        <i class="fa-solid fa-spinner fa-spin" style="margin-right: 0.5rem;"></i>
        Loading Fee Structures.........
      </td>
    </tr>
  `;

  try {
    const { data, error } = await supabaseClient
      .from("fee_structures")
      .select(
        `
        id,
        total_amount,
        status,
        created_at,
        updated_at,
        classes ( id, name ),
        academic_years ( id, year_label ),
        terms ( id, name )
      `,
      )
      .order("created_at", { ascending: false });

    if (error) throw error;

    allFeeStructures = data || [];
    renderFeeStructuresTable(allFeeStructures);
  } catch (err) {
    console.error("Error loading fee structures:", err.message);
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; color: red; padding: 20px;">
          Failed to load fee structures.
        </td>
      </tr>
    `;
  }
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

function renderFeeStructuresTable(structures) {
  const tbody = document.getElementById("feeStructuresBody");
  if (!tbody) return;

  tbody.innerHTML = "";

  if (structures.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; color: #777; padding: 20px;">
          No fee structures found.
        </td>
      </tr>
    `;
    return;
  }

  structures.forEach((struct) => {
    const className = struct.classes?.name || "N/A";
    const academicYear = struct.academic_years?.year_label || "N/A";
    const termName = struct.terms?.name || "N/A";

    const currentStatus = struct.status || "Active";
    const isInactive = currentStatus.toLowerCase() === "inactive";

    const statusText = isInactive ? "Inactive" : "Active";
    const statusClass = isInactive
      ? "structures-status-inactive"
      : "structures-status-active";

    const tr = document.createElement("tr");
    tr.innerHTML = `
     <td data-label="Class">${escapeHTML(className || "-")}</td>
<td data-label="Academic Year">${escapeHTML(academicYear || "-")}</td>
<td data-label="Semester">${escapeHTML(termName || "-")}</td>
<td data-label="Total Fees">$${Number(struct.total_amount || 0).toFixed(2)}</td>
<td data-label="Status">
  <span class="${statusClass}">${statusText}</span>
</td>
<td data-label="Created At">${formatDateTime(struct.created_at)}</td>
<td data-label="Updated At">${formatDateTime(struct.updated_at)}</td>
<td data-label="Actions">
  <button class="structures-actions-btn view" data-id="${struct.id}" title="View">
    <i class="fa-solid fa-eye"></i>
  </button>
  <button class="structures-actions-btn edit" data-id="${struct.id}" title="Edit">
    <i class="fa-solid fa-pen"></i>
  </button>
</td>
    `;
    tbody.appendChild(tr);
  });
}

async function openViewStructureModal(structureId) {
  const viewModal = document.getElementById("viewStructureModal");
  const itemsBody = document.getElementById("viewFeeItemsBody");
  if (!viewModal || !itemsBody) return;

  itemsBody.innerHTML = `<tr>  <td colspan="8" style="text-align: center; padding: 2rem; color: #64748b;">
        <i class="fa-solid fa-spinner fa-spin" style="margin-right: 0.5rem;"></i>
        Loading Details.........
      </td></tr>`;
  if (typeof lockBodyScroll === "function") lockBodyScroll();
  viewModal.style.display = "flex";

  try {
    const { data: struct, error: structError } = await supabaseClient
      .from("fee_structures")
      .select(
        `
        id,
        total_amount,
        status,
        classes ( name ),
        academic_years ( year_label ),
        terms ( name )
      `,
      )
      .eq("id", structureId)
      .single();

    if (structError) throw structError;

    const { data: items, error: itemsError } = await supabaseClient
      .from("fee_structure_items")
      .select("fee_name, amount")
      .eq("fee_structure_id", structureId);

    if (itemsError) throw itemsError;

    const className = struct.classes?.name || "N/A";
    const yearLabel = struct.academic_years?.year_label || "N/A";
    const termName = struct.terms?.name || "N/A";

    document.getElementById("viewAcademicYear").textContent = yearLabel;
    document.getElementById("viewTerm").textContent = termName;
    document.getElementById("viewClass").textContent = className;
    document.getElementById("viewTotalAmount").textContent =
      `$${Number(struct.total_amount || 0).toFixed(2)}`;

    const viewStatusEl = document.getElementById("viewStatus");
    if (viewStatusEl) {
      viewStatusEl.textContent = struct.status || "N/A";
      viewStatusEl.className = "status";
      viewStatusEl.classList.add(
        struct.status?.toLowerCase() === "active"
          ? "structures-status-active"
          : "structures-status-inactive",
      );
    }

    itemsBody.innerHTML = "";
    if (!items || items.length === 0) {
      itemsBody.innerHTML = `<tr><td colspan="2" style="text-align: center; color: #888; padding: 12px;">No items found.</td></tr>`;
    } else {
      items.forEach((item) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${escapeHTML(item.fee_name || "")}</td>
          <td>$${Number(item.amount).toFixed(2)}</td>
        `;
        itemsBody.appendChild(tr);
      });
    }
  } catch (err) {
    console.error("Error fetching view details:", err.message);
    if (typeof showToast === "function") {
      showToast("Failed to load fee structure details.", "error");
    }
    viewModal.style.display = "none";
    if (typeof unLockBodyScroll === "function") unLockBodyScroll();
  }
}

const printViewBtn = document.getElementById("printViewStructureBtn");
if (printViewBtn) {
  printViewBtn.addEventListener("click", () => {
    window.print();
  });
}

let tempEditFeeItems = [];

async function openEditStructureModal(structureId) {
  const modal = document.getElementById("editStructureModal");
  if (!modal) return;

  tempEditFeeItems = [];

  try {
    const { data: struct, error: structErr } = await supabaseClient
      .from("fee_structures")
      .select(
        `
        id,
        academic_year_id,
        term_id,
        class_id,
        status,
        classes ( name ),
        academic_years ( year_label ),
        terms ( name )
      `,
      )
      .eq("id", structureId)
      .single();

    if (structErr) throw structErr;

    document.getElementById("editStructureId").value = struct.id;
    document.getElementById("editAcademicYearSelect").value =
      struct.academic_year_id;
    document.getElementById("editSemesterSelect").value = struct.term_id;
    document.getElementById("editClassSelect").value = struct.class_id;

    document.getElementById("editAcademicYearDisplay").value =
      struct.academic_years?.year_label || "N/A";
    document.getElementById("editSemesterDisplay").value =
      struct.terms?.name || "N/A";
    document.getElementById("editClassDisplay").value =
      struct.classes?.name || "N/A";
    document.getElementById("editStatusSelect").value = struct.status;

    const { data: items, error: itemsErr } = await supabaseClient
      .from("fee_structure_items")
      .select("id, fee_name, amount")
      .eq("fee_structure_id", structureId);

    if (itemsErr) throw itemsErr;

    tempEditFeeItems = (items || []).map((i) => ({
      id: i.id,
      name: i.fee_name,
      amount: i.amount,
    }));

    modal.dataset.originalStatus = struct.status;
    modal.dataset.originalItems = normalizeItems(items || []);

    renderEditTempFeeItems();

    if (typeof lockBodyScroll === "function") lockBodyScroll();
    modal.style.display = "flex";
  } catch (err) {
    console.error("Error opening edit modal detailed:", err);
    if (typeof showToast === "function")
      showToast(err.message || "Failed to load edit details.", "error");
  }
}

function renderEditTempFeeItems() {
  const tbody = document.getElementById("editFeeItemsBody");
  const totalEl = document.getElementById("editTotalFeeAmount");
  if (!tbody) return;

  tbody.innerHTML = "";

  if (tempEditFeeItems.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: #888; padding: 12px;">No items added.</td></tr>`;
    if (totalEl) totalEl.textContent = "$0.00";
    return;
  }

  let grandTotal = 0;
  tempEditFeeItems.forEach((item, index) => {
    grandTotal += Number(item.amount);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHTML(item.name || "")}</td>
      <td>$${Number(item.amount).toFixed(2)}</td>
      <td style="text-align: right;">
        <button type="button" class="structures-actions-btn delete-editItem" data-index="${index}" title="Remove Item">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  if (totalEl) totalEl.textContent = `$${grandTotal.toFixed(2)}`;
}

const editFeeItemsBody = document.getElementById("editFeeItemsBody");
if (editFeeItemsBody) {
  editFeeItemsBody.addEventListener("click", (e) => {
    const deleteBtn = e.target.closest(".delete-editItem");
    if (deleteBtn) {
      const index = deleteBtn.getAttribute("data-index");
      tempEditFeeItems.splice(index, 1);
      renderEditTempFeeItems();
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const addFeeItemBtn = document.getElementById("addFeeItemBtn");
  const addItemModal = document.getElementById("addItemModal");
  const closeAddItemModal = document.getElementById("closeAddItemModal");
  const cancelAddItemModal = document.getElementById("cancelAddItemModal");

  addFeeItemBtn?.addEventListener("click", () => {
    if (addItemModal) addItemModal.style.display = "flex";
  });

  closeAddItemModal?.addEventListener("click", () => {
    if (addItemModal) addItemModal.style.display = "none";
  });

  cancelAddItemModal?.addEventListener("click", () => {
    if (addItemModal) addItemModal.style.display = "none";
  });

  const editItemModal = document.getElementById("editItemModal");
  const closeEditItemModal = document.getElementById("closeEditItemModal");
  const cancelEditItemModal = document.getElementById("cancelEditItemModal");

  cancelEditItemModal?.addEventListener("click", () => {
    if (editItemModal) editItemModal.style.display = "none";
  });
  closeEditItemModal?.addEventListener("click", () => {
    if (editItemModal) editItemModal.style.display = "none";
  });

  const deleteItemModal = document.getElementById("deleteItemModal");

  const structureModal = document.getElementById("structureModal");
  const openStructureBtn = document.getElementById("addStructure");
  const closeStructureModal = document.getElementById("closeStructureModal");
  const cancelStructureModal = document.getElementById("cancelStructureModal");

  openStructureBtn?.addEventListener("click", () => {
    if (structureModal) structureModal.style.display = "flex";
    lockBodyScroll();
  });

  closeStructureModal?.addEventListener("click", () => {
    if (structureModal) structureModal.style.display = "none";
    unLockBodyScroll();
  });

  cancelStructureModal?.addEventListener("click", () => {
    if (structureModal) structureModal.style.display = "none";
    unLockBodyScroll();
  });

  const viewStructureModal = document.getElementById("viewStructureModal");
  const closeViewStructureModal = document.getElementById(
    "closeViewStructureModal",
  );
  const closeViewBtn = document.getElementById("closeViewBtn");

  closeViewStructureModal?.addEventListener("click", () => {
    if (viewStructureModal) viewStructureModal.style.display = "none";
    unLockBodyScroll();
  });

  closeViewBtn?.addEventListener("click", () => {
    if (viewStructureModal) viewStructureModal.style.display = "none";
    unLockBodyScroll();
  });

  const editStructureModal = document.getElementById("editStructureModal");
  const closeEditStructureModal = document.getElementById(
    "closeEditStructureModal",
  );
  const cancelEditStructureModal = document.getElementById(
    "cancelEditStructureModal",
  );

  closeEditStructureModal?.addEventListener("click", () => {
    if (editStructureModal) editStructureModal.style.display = "none";
    unLockBodyScroll();
  });

  cancelEditStructureModal?.addEventListener("click", () => {
    if (editStructureModal) editStructureModal.style.display = "none";
    unLockBodyScroll();
  });

  window.addEventListener("click", (e) => {
    if (e.target === addItemModal) addItemModal.style.display = "none";
    if (e.target === editItemModal) editItemModal.style.display = "none";
    if (e.target === deleteItemModal) deleteItemModal.style.display = "none";
    if (e.target === structureModal) {
      structureModal.style.display = "none";
      unLockBodyScroll();
    }
    if (e.target === viewStructureModal) {
      viewStructureModal.style.display = "none";
      unLockBodyScroll();
    }
    if (e.target === editStructureModal) {
      editStructureModal.style.display = "none";
      unLockBodyScroll();
    }
  });

  populateInitialDropdowns();

  const academicYearSelect = document.getElementById("academicYearSelect");

  academicYearSelect?.addEventListener("change", (e) => {
    fetchSemestersForYear(e.target.value);
  });

  const feeStructuresBody = document.getElementById("feeStructuresBody");

  if (feeStructuresBody) {
    feeStructuresBody.addEventListener("click", (e) => {
      const viewBtn = e.target.closest(".view");
      if (viewBtn) {
        const id = viewBtn.getAttribute("data-id");
        if (id) openViewStructureModal(id);
        return;
      }

      const editBtn = e.target.closest(".edit");
      if (editBtn) {
        const id = editBtn.getAttribute("data-id");
        if (id) openEditStructureModal(id);
        return;
      }

    });
  }

  document
    .getElementById("btnUpdateStructure")
    ?.addEventListener("click", (e) => {
      e.preventDefault();
      updateFeeStructure(false);
    });

  document
    .getElementById("btnUpdateAndPrintStructure")
    ?.addEventListener("click", (e) => {
      e.preventDefault();
      updateFeeStructure(true);
    });

  loadFeeStructures();

  const btnSubmitEditFeeItem = document.getElementById("btnSubmitEditFeeItem");

  btnSubmitEditFeeItem?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();

    const nameInput = document.getElementById("editItemNameInput");
    const amountInput = document.getElementById("editItemAmountInput");

    const name = nameInput?.value ? nameInput.value.trim() : "";
    const rawAmount = amountInput?.value ? amountInput.value.trim() : "";
    const amount = parseFloat(rawAmount);

    if (!name || rawAmount === "" || isNaN(amount) || amount < 0) {
      if (typeof showToast === "function") {
        showToast(
          "Please enter a valid item name and non-negative amount.",
          "error",
        );
      }
      return;
    }

    const isDuplicate = tempEditFeeItems.some(
      (item) => item.name.toLowerCase() === name.toLowerCase(),
    );

    if (isDuplicate) {
      if (typeof showToast === "function") {
        showToast(`"${name}" is already in this fee structure.`, "error");
      }
      return;
    }

    tempEditFeeItems.push({ name, amount });
    renderEditTempFeeItems();

    nameInput.value = "";
    amountInput.value = "";
    const editItemModal = document.getElementById("editItemModal");
    if (editItemModal) editItemModal.style.display = "none";
  });

  renderTempFeeItems();
});

async function fetchFilteredFeeStructures() {
  const searchQuery = document
    .getElementById("searchStructureInput")
    ?.value.trim()
    .toLowerCase();
  const semesterId = document.getElementById("filterSemesterSelect")?.value;
  const classId = document.getElementById("filterClassSelect")?.value;
  const academicYearId = document.getElementById(
    "filterAcademicYearSelect",
  )?.value;
  const statusFilter = document
    .getElementById("filterStatusSelect")
    ?.value.toLowerCase();

  let query = supabaseClient.from("fee_structures").select(`
    *,
    academic_years ( id, year_label ),
    classes ( id, name ),
    terms ( id, name )
  `);

  if (academicYearId) query = query.eq("academic_year_id", academicYearId);
  if (semesterId) query = query.eq("term_id", semesterId);
  if (classId) query = query.eq("class_id", classId);

  if (statusFilter === "active") {
    query = query.eq("status", "Active");
  } else if (statusFilter === "inactive") {
    query = query.eq("status", "Inactive");
  }

  query = query.order("created_at", { ascending: false });

  const { data, error } = await query;

  if (error) {
    console.error("Fetch error:", error.message);
    return;
  }

  let filteredData = data || [];
  if (searchQuery) {
    filteredData = filteredData.filter((struct) => {
      const className = struct.classes?.name?.toLowerCase() || "";
      const yearLabel = struct.academic_years?.year_label?.toLowerCase() || "";
      const termName = struct.terms?.name?.toLowerCase() || "";
      const amount = String(struct.total_amount || "");

      return (
        className.includes(searchQuery) ||
        yearLabel.includes(searchQuery) ||
        termName.includes(searchQuery) ||
        amount.includes(searchQuery)
      );
    });
  }

  renderFeeStructuresTable(filteredData);
}

let searchDebounceTimeout = null;

document.addEventListener("DOMContentLoaded", async () => {
  const searchInput = document.getElementById("searchStructureInput");
  const semesterSelect = document.getElementById("filterSemesterSelect");
  const classSelect = document.getElementById("filterClassSelect");
  const yearSelect = document.getElementById("filterAcademicYearSelect");
  const statusSelect = document.getElementById("filterStatusSelect");

  searchInput?.addEventListener("input", () => {
    clearTimeout(searchDebounceTimeout);
    searchDebounceTimeout = setTimeout(() => {
      fetchFilteredFeeStructures();
    }, 300);
  });

  semesterSelect?.addEventListener("change", fetchFilteredFeeStructures);
  classSelect?.addEventListener("change", fetchFilteredFeeStructures);
  yearSelect?.addEventListener("change", fetchFilteredFeeStructures);
  statusSelect?.addEventListener("change", fetchFilteredFeeStructures);

  await populateFilterDropdowns();
  await fetchFilteredFeeStructures();
});
async function populateFilterDropdowns() {
  const { data: structures, error } = await supabaseClient
    .from("fee_structures")
    .select(
      `
      academic_year_id,
      academic_years ( id, year_label ),
      class_id,
      classes ( id, name ),
      term_id,
      terms ( id, name )
    `,
    )

  if (error) {
    console.error(
      "Error fetching filter choices from fee_structures:",
      error.message,
    );
    return;
  }

  const uniqueYears = new Map();
  const uniqueClasses = new Map();
  const uniqueTerms = new Map();

  structures?.forEach((struct) => {
    if (struct.academic_years?.id && struct.academic_years?.year_label) {
      uniqueYears.set(
        struct.academic_years.id,
        struct.academic_years.year_label,
      );
    }
    if (struct.classes?.id && struct.classes?.name) {
      uniqueClasses.set(struct.classes.id, struct.classes.name);
    }
    if (struct.terms?.id && struct.terms?.name) {
      uniqueTerms.set(struct.terms.id, struct.terms.name);
    }
  });

  const yearSelect = document.getElementById("filterAcademicYearSelect");
  if (yearSelect) {
    const selectedAcademicYear = yearSelect.value;
    yearSelect.innerHTML = `<option value="">All Academic Years</option>`;
    uniqueYears.forEach((year_label, id) => {
      yearSelect.add(new Option(year_label, id));
    });

    yearSelect.value = selectedAcademicYear;
  }

  const classSelect = document.getElementById("filterClassSelect");
  if (classSelect) {
    const selectedClass = classSelect.value;

    classSelect.innerHTML = `<option value="">All Classes</option>`;
    uniqueClasses.forEach((name, id) => {
      classSelect.add(new Option(name, id));
    });

    classSelect.value = selectedClass;
  }

  const semesterSelect = document.getElementById("filterSemesterSelect");
  if (semesterSelect) {
    const selectedsemester = semesterSelect.value;
    semesterSelect.innerHTML = `<option value="">All Semesters</option>`;
    uniqueTerms.forEach((name, id) => {
      semesterSelect.add(new Option(name, id));
    });

    semesterSelect.value = selectedsemester;
  }
}

