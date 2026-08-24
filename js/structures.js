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

  // Preserve button UI states
  const btnUpdate = document.getElementById("btnUpdateStructure");
  const btnUpdateAndPrint = document.getElementById(
    "btnUpdateAndPrintStructure",
  );

  const originalUpdateText = btnUpdate ? btnUpdate.innerHTML : "";
  const originalPrintText = btnUpdateAndPrint
    ? btnUpdateAndPrint.innerHTML
    : "";

  // Set loading states
  if (btnUpdate) {
    btnUpdate.disabled = true;
    if (!shouldPrint) btnUpdate.innerHTML = `Updating...`;
  }
  if (btnUpdateAndPrint) {
    btnUpdateAndPrint.disabled = true;
    if (shouldPrint) btnUpdateAndPrint.innerHTML = `Updating...`;
  }

  try {
    // --- ADD THIS CHANGE CHECK ---
    const originalStatus =
      document.getElementById("editStructureModal")?.dataset.originalStatus;
    const originalItemsJson =
      document.getElementById("editStructureModal")?.dataset.originalItems;

    const currentItemsJson = JSON.stringify(
      tempEditFeeItems.map((i) => ({
        name: i.name.trim(),
        amount: Number(i.amount),
      })),
    );

    if (status === originalStatus && currentItemsJson === originalItemsJson) {
      if (typeof showToast === "function")
        showToast("No changes detected.", "info");
      return;
    }
    // ------------------------------

    // Single Atomic Call via RPC (Replaces manual update, delete, insert)
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

    // Close Modal & Unlock UI scroll immediately
    const modal = document.getElementById("editStructureModal");
    if (modal) modal.style.display = "none";
    if (typeof unLockBodyScroll === "function") unLockBodyScroll();

    // Refresh main data table
    if (typeof loadFeeStructures === "function") {
      await loadFeeStructures();
    }

    // Trigger Print asynchronously
    if (shouldPrint) {
      setTimeout(() => {
        window.print();
      }, 100);
    }
  } catch (err) {
    console.error("Error updating structure:", err.message || err);
    if (typeof showToast === "function") {
      showToast(err.message || "Failed to update fee structure.", "error");
    }
  } finally {
    // Restore button states
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

// Expose to window scope in case of inline HTML onclicks
window.updateFeeStructure = updateFeeStructure;

// Array to hold fee items locally before saving to the database
let tempFeeItems = [];

// DOM References for Add Item Modal
const addItemForm = document.getElementById("addItemForm"); // Ensure your form inside addItemModal has this ID
const feeItemNameInput = document.getElementById("feeItemName"); // Input for item name (e.g., Tuition)
const feeItemAmountInput = document.getElementById("feeItemAmount"); // Input for amount (e.g., 400)
const feeItemsBody = document.getElementById("feeItemsBody"); // <tbody> of the items table
const totalFeeAmountEl = document.getElementById("totalFeeAmount"); // Text element displaying total

// Render function to redraw items table & update total
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
      <td>${item.name}</td>
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

// Handle adding a new fee item from addItemModal
if (addItemForm) {
  addItemForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const name = feeItemNameInput.value.trim();
    const amount = parseFloat(feeItemAmountInput.value);

    if (!name || isNaN(amount) || amount <= 0) {
      showToast(
        "Please provide a valid item name and positive amount.",
        "error",
      );
      return;
    }

    // Push item to in-memory state
    tempFeeItems.push({ name, amount });

    // Refresh table & total
    renderTempFeeItems();

    // Reset inputs and close modal
    addItemForm.reset();
    addItemModal.style.display = "none";
  });
}

// Event delegation for Edit and Delete buttons on table rows
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

// Populate Academic Years and Classes on load
async function populateInitialDropdowns() {
  const academicYearSelect = document.getElementById("academicYearSelect");
  const classSelect = document.getElementById("classSelect");

  try {
    // 1. Fetch Active Academic Years
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

    // 2. Fetch Active Classes
    if (classSelect) {
      const { data: classes, error: classErr } = await supabaseClient
        .from("classes")
        .select("id, name")
        .eq("status", "active")
        .order("name", { ascending: true });

      if (classErr) throw classErr;

      classSelect.innerHTML = `<option value="">Select Class</option>`;
      classes?.forEach((cls) => {
        classSelect.innerHTML += `<option value="${cls.id}">${cls.name}</option>`;
      });
    }
  } catch (err) {
    console.error("Error loading initial dropdowns:", err.message);
  }
}

// Populate Semesters dynamically based on the selected Academic Year
async function fetchSemestersForYear(academicYearId) {
  const semesterSelect = document.getElementById("semesterSelect");
  if (!semesterSelect) return;

  // Reset dropdown if no year is selected
  if (!academicYearId) {
    semesterSelect.innerHTML = `<option value="">Select Semester</option>`;
    return;
  }

  try {
    // Query ONLY terms that belong to the selected academic_year_id
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
      semesterSelect.innerHTML += `<option value="${tm.id}">${tm.name}</option>`;
    });
  } catch (err) {
    console.error("Error fetching semesters for year:", err.message);
  }
}

const academicYearSelect = document.getElementById("academicYearSelect");

// Function to handle database insertion
async function saveFeeStructure(shouldPrint = false) {
  const academicYearId = document.getElementById("academicYearSelect")?.value;
  const termId = document.getElementById("semesterSelect")?.value;
  const classId = document.getElementById("classSelect")?.value;
  const status = document.getElementById("statusSelect")?.value || "Active";

  // 1. Validation
  if (!academicYearId || !termId || !classId) {
    showToast("Please select Academic Year, Semester, and Class.", "error");
    return;
  }

  if (tempFeeItems.length === 0) {
    showToast("Please add at least one fee item before saving.", "error");
    return;
  }

  // Calculate total amount from local items
  const totalAmount = tempFeeItems.reduce(
    (sum, item) => sum + Number(item.amount),
    0,
  );

  // Disable save buttons to prevent duplicate submissions
  const saveBtn = document.getElementById("saveStructureBtn");
  const saveAndPrintBtn = document.getElementById("saveAndPrintBtn");
  if (saveBtn) saveBtn.disabled = true;
  if (saveAndPrintBtn) saveAndPrintBtn.disabled = true;

  // Store original button labels
  const originalSaveText = saveBtn ? saveBtn.innerHTML : "";
  const originalPrintText = saveAndPrintBtn ? saveAndPrintBtn.innerHTML : "";

  // Set active loading text based on which action was triggered
  if (saveBtn && !shouldPrint) saveBtn.innerHTML = "Saving...";
  if (saveAndPrintBtn && shouldPrint) saveAndPrintBtn.innerHTML = "Saving...";

  try {
    // 2. Insert Parent Record into fee_structures
    const { data: structureData, error: structureError } = await supabaseClient
      .from("fee_structures")
      .insert([
        {
          academic_year_id: academicYearId,
          term_id: termId,
          class_id: classId,
          status: status,
          total_amount: totalAmount,
        },
      ])
      .select()
      .single();

    // Catch duplicate constraint error specifically
    if (structureError) {
      if (structureError.code === "23505") {
        showToast(
          "A fee structure already exists for this Class, Academic Year, and Semester.",
          "error",
        );
        return; // Exit early without throwing to avoid duplicate error logs
      }
      throw structureError;
    }

    // 3. Map temporary fee items with the returned parent ID
    const itemsToInsert = tempFeeItems.map((item) => ({
      fee_structure_id: structureData.id,
      fee_name: item.name,
      amount: item.amount,
    }));

    // 4. Batch insert Child Records into fee_structure_items
    const { error: itemsError } = await supabaseClient
      .from("fee_structure_items")
      .insert(itemsToInsert);

    if (itemsError) throw itemsError;

    showToast("Fee Structure saved successfully!", "success");

    // 5. Check if user clicked Save & Print
    if (shouldPrint) {
      window.print(); // Triggers print dialog (or replace with your specific PDF/Print utility)
    }

    loadFeeStructures();
    // 6. Reset Form & Local Array State
    tempFeeItems = [];
    renderTempFeeItems();
    document.getElementById("structureForm").reset();

    // Reset dynamic semester dropdown to default state
    const semesterSelect = document.getElementById("semesterSelect");
    if (semesterSelect) {
      semesterSelect.innerHTML = `<option value="">Select Semester</option>`;
    }
  } catch (err) {
    console.error("Error saving fee structure:", err);
    showToast(err.message || "Failed to save fee structure.", "error");
  } finally {
    // Re-enable buttons
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

// Event Listener for Main Form Submit ("Save" button)
const structureForm = document.getElementById("structureForm");
if (structureForm) {
  structureForm.addEventListener("submit", (e) => {
    e.preventDefault();
    saveFeeStructure(false);
  });
}

// Event Listener for "Save & Print" button
const saveAndPrintBtn = document.getElementById("saveAndPrintBtn");
if (saveAndPrintBtn) {
  saveAndPrintBtn.addEventListener("click", () => {
    saveFeeStructure(true);
  });
}

// Global variable to store loaded structures for client-side filtering
let allFeeStructures = [];

// Fetch and render fee structures
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
        <td colspan="6" style="text-align: center; color: red; padding: 20px;">
          Failed to load fee structures.
        </td>
      </tr>
    `;
  }
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

// Render structures to HTML table
function renderFeeStructuresTable(structures) {
  const tbody = document.getElementById("feeStructuresBody");
  if (!tbody) return;

  tbody.innerHTML = "";

  if (structures.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; color: #777; padding: 20px;">
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
    const statusClass =
      struct.status === "Active"
        ? "structures-status-active"
        : "structures-status-inactive";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${className}</td>
      <td>${academicYear}</td>
      <td>${termName}</td>
      <td>$${Number(struct.total_amount || 0).toFixed(2)}</td>
      <td>
        <span class="${statusClass}">${struct.status}</span>
      </td>
      <td>${formatDateTime(struct.created_at)}</td>
          <td>${formatDateTime(struct.updated_at)}</td>
      <td>
        <button class="structures-actions-btn view" data-id="${struct.id}" title="View">
          <i class="fa-solid fa-eye"></i>
        </button>
        <button class="structures-actions-btn edit" data-id="${struct.id}" title="Edit">
          <i class="fa-solid fa-pen"></i>
        </button>
        <button class="structures-actions-btn archive" data-id="${struct.id}" title="Archive">
          <i class="fa-solid fa-box-archive"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Function to fetch fee structure details and open the View Modal
async function openViewStructureModal(structureId) {
  const viewModal = document.getElementById("viewStructureModal");
  const itemsBody = document.getElementById("viewFeeItemsBody");
  if (!viewModal || !itemsBody) return;

  // Clear previous items and show loading state
  itemsBody.innerHTML = `<tr><td colspan="2" style="text-align: center; padding: 12px;">Loading details...</td></tr>`;
  if (typeof lockBodyScroll === "function") lockBodyScroll();
  viewModal.style.display = "flex";

  try {
    // 1. Fetch parent fee structure with join references
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

    // 2. Fetch child fee structure items
    const { data: items, error: itemsError } = await supabaseClient
      .from("fee_structure_items")
      .select("fee_name, amount")
      .eq("fee_structure_id", structureId);

    if (itemsError) throw itemsError;

    // 3. Populate Modal Information
    const className = struct.classes?.name || "N/A";
    const yearLabel = struct.academic_years?.year_label || "N/A";
    const termName = struct.terms?.name || "N/A";

    document.getElementById("viewAcademicYear").textContent = yearLabel;
    document.getElementById("viewTerm").textContent = termName;
    document.getElementById("viewClass").textContent = className;
    document.getElementById("viewTotalAmount").textContent =
      `$${Number(struct.total_amount || 0).toFixed(2)}`;
    document.getElementById("viewStatus").textContent = struct.status;

    // 4. Populate Items Table Body
    itemsBody.innerHTML = "";
    if (!items || items.length === 0) {
      itemsBody.innerHTML = `<tr><td colspan="2" style="text-align: center; color: #888; padding: 12px;">No items found.</td></tr>`;
    } else {
      items.forEach((item) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${item.fee_name}</td>
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

// Print Handler inside View Modal
const printViewBtn = document.getElementById("printViewStructureBtn");
if (printViewBtn) {
  printViewBtn.addEventListener("click", () => {
    window.print();
  });
}

// Local array holding current edit items state
let tempEditFeeItems = [];

async function openEditStructureModal(structureId) {
  const modal = document.getElementById("editStructureModal");
  if (!modal) return;

  // Clear previous state before loading new items
  tempEditFeeItems = [];

  try {
    // 1. Load parent fee structure & relation labels from database
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

    // Set hidden IDs for submit handler
    document.getElementById("editStructureId").value = struct.id;
    document.getElementById("editAcademicYearSelect").value =
      struct.academic_year_id;
    document.getElementById("editSemesterSelect").value = struct.term_id;
    document.getElementById("editClassSelect").value = struct.class_id;

    // Populate Read-Only Display Inputs & Status
    document.getElementById("editAcademicYearDisplay").value =
      struct.academic_years?.year_label || "N/A";
    document.getElementById("editSemesterDisplay").value =
      struct.terms?.name || "N/A";
    document.getElementById("editClassDisplay").value =
      struct.classes?.name || "N/A";
    document.getElementById("editStatusSelect").value = struct.status;

    // 2. Load existing fee structure items from database
    const { data: items, error: itemsErr } = await supabaseClient
      .from("fee_structure_items")
      .select("id, fee_name, amount")
      .eq("fee_structure_id", structureId);

    if (itemsErr) throw itemsErr;

    // Store fetched database items into local array
    tempEditFeeItems = (items || []).map((i) => ({
      id: i.id,
      name: i.fee_name,
      amount: i.amount,
    }));

    // Add these 2 lines inside openEditStructureModal after fetching `struct` and `items`:
    modal.dataset.originalStatus = struct.status;
    modal.dataset.originalItems = JSON.stringify(
      (items || []).map((i) => ({
        name: i.fee_name.trim(),
        amount: Number(i.amount),
      })),
    );

    // Render items in modal
    renderEditTempFeeItems();

    if (typeof lockBodyScroll === "function") lockBodyScroll();
    modal.style.display = "flex";
  } catch (err) {
    console.error("Error opening edit modal detailed:", err);
    if (typeof showToast === "function")
      showToast(err.message || "Failed to load edit details.", "error");
  }
}

// Render local fee items inside edit modal
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
      <td>${item.name}</td>
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

// Remove item locally when trash icon is clicked
const editFeeItemsBody = document.getElementById("editFeeItemsBody");
if (editFeeItemsBody) {
  editFeeItemsBody.addEventListener("click", (e) => {
    const deleteBtn = e.target.closest(".delete-editItem");
    if (deleteBtn) {
      const index = deleteBtn.getAttribute("data-index");
      tempEditFeeItems.splice(index, 1); // Removes from memory array
      renderEditTempFeeItems(); // Re-renders UI table & updates total
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  // Elements
  const addFeeItemBtn = document.getElementById("addFeeItemBtn");
  const addItemModal = document.getElementById("addItemModal");
  const closeAddItemModal = document.getElementById("closeAddItemModal");
  const cancelAddItemModal = document.getElementById("cancelAddItemModal");

  // 1. Add Item Modal Handlers
  addFeeItemBtn?.addEventListener("click", () => {
    if (addItemModal) addItemModal.style.display = "flex";
  });

  closeAddItemModal?.addEventListener("click", () => {
    if (addItemModal) addItemModal.style.display = "none";
  });

  cancelAddItemModal?.addEventListener("click", () => {
    if (addItemModal) addItemModal.style.display = "none";
  });

  // 2. Edit Item Modal
  const editItemModal = document.getElementById("editItemModal");
  const closeEditItemModal = document.getElementById("closeEditItemModal");
  const cancelEditItemModal = document.getElementById("cancelEditItemModal");

  cancelEditItemModal?.addEventListener("click", () => {
    if (editItemModal) editItemModal.style.display = "none";
  });
  closeEditItemModal?.addEventListener("click", () => {
    if (editItemModal) editItemModal.style.display = "none";
  });

  // 3. Delete Item Modal
  const deleteItemModal = document.getElementById("deleteItemModal");

  // 4. Structure Modal (Create)
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

  // 5. View Structure Modal
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

  // 6. Archive Structure Modal
  const archiveStructureModal = document.getElementById(
    "archiveStructureModal",
  );
  const cancelArchiveStructure = document.getElementById(
    "cancelArchiveStructure",
  );

  cancelArchiveStructure?.addEventListener("click", () => {
    if (archiveStructureModal) archiveStructureModal.style.display = "none";
    unLockBodyScroll();
  });

  // 7. Edit Structure Modal Controls
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

  // Global Outside Click Handler
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
    if (e.target === archiveStructureModal) {
      archiveStructureModal.style.display = "none";
      unLockBodyScroll();
    }
    if (e.target === editStructureModal) {
      editStructureModal.style.display = "none";
      unLockBodyScroll();
    }
  });

  populateInitialDropdowns();

  const academicYearSelect = document.getElementById("academicYearSelect");

  // Trigger semester fetch whenever Academic Year changes
  academicYearSelect?.addEventListener("change", (e) => {
    fetchSemestersForYear(e.target.value);
  });

  // Event delegation for table action buttons (View, Edit, Archive)
  const feeStructuresBody = document.getElementById("feeStructuresBody");

  if (feeStructuresBody) {
    feeStructuresBody.addEventListener("click", (e) => {
      // 1. View Button Handler
      const viewBtn = e.target.closest(".view");
      if (viewBtn) {
        const id = viewBtn.getAttribute("data-id");
        if (id) openViewStructureModal(id);
        return;
      }

      // 2. Edit Button Handler
      const editBtn = e.target.closest(".edit");
      if (editBtn) {
        const id = editBtn.getAttribute("data-id");
        if (id) openEditStructureModal(id);
        return;
      }
    });
  }

  // ✅ ADD INSIDE DOMCONTENTLOADED
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
    // 1. Stop form submission and event propagation to prevent nested modal triggers
    e.preventDefault();
    e.stopPropagation();

    // 2. Read values from edit modal inputs
    const nameInput = document.getElementById("editItemNameInput");
    const amountInput = document.getElementById("editItemAmountInput");

    const name = nameInput?.value ? nameInput.value.trim() : "";
    const amount = amountInput?.value ? parseFloat(amountInput.value) : NaN;

    // 3. Validation
    if (!name || isNaN(amount) || amount <= 0) {
      if (typeof showToast === "function") {
        showToast("Please enter a valid item name and amount.", "error");
      }
      return;
    }

    // Prevent duplicate item names (case-insensitive)
    const isDuplicate = tempEditFeeItems.some(
      (item) => item.name.toLowerCase() === name.toLowerCase(),
    );

    if (isDuplicate) {
      if (typeof showToast === "function") {
        showToast(`"${name}" is already in this fee structure.`, "error");
      }
      return;
    }

    // 4. Update memory state and table UI
    tempEditFeeItems.push({
      name: name,
      amount: amount,
    });

    renderEditTempFeeItems();

    // 5. Clear fields
    nameInput.value = "";
    amountInput.value = "";
  });

  renderTempFeeItems();
});
