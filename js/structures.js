document.addEventListener("DOMContentLoaded", () => {
  // Helpers
  const lockBodyScroll = () => document.body.classList.add("modal-open");
  const unLockBodyScroll = () => document.body.classList.remove("modal-open");

  // Elements
  const addFeeItemBtn = document.getElementById("addFeeItemBtn"); // Corrected ID
  const addItemModal = document.getElementById("addItemModal");
  const closeAddItemModal = document.getElementById("closeAddItemModal");
  const cancelAddItemModal = document.getElementById("cancelAddItemModal");

  // Open Add Item Modal
  addFeeItemBtn?.addEventListener("click", () => {
    if (addItemModal) addItemModal.style.display = "flex";
  });

  // Close Add Item Modal handlers
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

  // 4. Structure Modal
  const structureModal = document.getElementById("structureModal");
  const cancelStructureModal = document.getElementById("cancelStructureModal");
  const openStructureModal = document.getElementById("addStructure");
  const closeStructureModal = document.getElementById("closeStructureModal");
  const openEditStructureModal = document.getElementById("addEditStructure");

  openEditStructureModal?.addEventListener("click", () => {
    if (addItemModal) addItemModal.style.display = "flex";
    lockBodyScroll();
  });

  openStructureModal?.addEventListener("click", () => {
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
  const viewButtons = document.querySelectorAll(".view");
  const closeViewStructureModal = document.getElementById(
    "closeViewStructureModal",
  );
  const closeViewBtn = document.getElementById("closeViewBtn");

  viewButtons.forEach((button) => {
    button.addEventListener("click", () => {
      if (viewStructureModal) viewStructureModal.style.display = "flex";
      lockBodyScroll();
    });
  });

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
  const archiveButtons = document.querySelectorAll(".archive");
  const cancelArchiveStructure = document.getElementById(
    "cancelArchiveStructure",
  );

  archiveButtons.forEach((button) => {
    button.addEventListener("click", () => {
      if (archiveStructureModal) archiveStructureModal.style.display = "flex";
      lockBodyScroll();
    });
  });

  cancelArchiveStructure?.addEventListener("click", () => {
    if (archiveStructureModal) archiveStructureModal.style.display = "none";
    unLockBodyScroll();
  });

  // 7. Edit Structure Modal
  const closeEditStructureModal = document.getElementById(
    "closeEditStructureModal",
  );
  const cancelEditStructureModal = document.getElementById(
    "cancelEditStructureModal",
  );
  const editStructureModal = document.getElementById("editStructureModal");
  const editButtons = document.querySelectorAll(".edit");

  editButtons.forEach((button) => {
    button.addEventListener("click", () => {
      if (editStructureModal) editStructureModal.style.display = "flex";
      lockBodyScroll();
    });
  });

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
});

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
        <button type="button" class="structures-actions-btn edit-addItem" data-index="${index}">
          <i class="fa-solid fa-pen"></i>
        </button>
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
      alert("Please provide a valid item name and positive amount.");
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

academicYearSelect?.addEventListener("change", (e) => {
  const selectedYearId = e.target.value;
  fetchSemestersForYear(selectedYearId);
});

// Event Listeners Initialization
document.addEventListener("DOMContentLoaded", () => {
  populateInitialDropdowns();

  const academicYearSelect = document.getElementById("academicYearSelect");

  // Trigger semester fetch whenever Academic Year changes
  academicYearSelect?.addEventListener("change", (e) => {
    fetchSemestersForYear(e.target.value);
  });
});

// Function to handle database insertion
async function saveFeeStructure(shouldPrint = false) {
  const academicYearId = document.getElementById("academicYearSelect")?.value;
  const termId = document.getElementById("semesterSelect")?.value;
  const classId = document.getElementById("classSelect")?.value;
  const status = document.getElementById("statusSelect")?.value || "Active";

  // 1. Validation
  if (!academicYearId || !termId || !classId) {
    alert("Please select Academic Year, Semester, and Class.");
    return;
  }

  if (tempFeeItems.length === 0) {
    alert("Please add at least one fee item before saving.");
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

    if (structureError) throw structureError;

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

    alert("Fee Structure saved successfully!");

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

    // Close Modal
    const structureModal = document.getElementById("structureModal");
    if (structureModal) structureModal.style.display = "none";
  } catch (err) {
    console.error("Error saving fee structure:", err);
    alert(err.message || "Failed to save fee structure.");
  } finally {
    // Re-enable buttons
    if (saveBtn) saveBtn.disabled = false;
    if (saveAndPrintBtn) saveAndPrintBtn.disabled = false;
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
      <td colspan="6" style="text-align: center; padding: 20px;">Loading fee structures...</td>
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

// Call loadFeeStructures on page load
document.addEventListener("DOMContentLoaded", () => {
  loadFeeStructures();
});
