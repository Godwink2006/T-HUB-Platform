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

  // 3. Delete Item Modal
  const deleteItemModal = document.getElementById("deleteItemModal");
  const cancelDelete = document.getElementById("cancelDelete");

  cancelDelete?.addEventListener("click", () => {
    if (deleteItemModal) deleteItemModal.style.display = "none";
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
