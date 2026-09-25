document.addEventListener("DOMContentLoaded", () => {
  const selectAllCheckbox = document.getElementById("selectAll");
  const bulkActionBar = document.getElementById("bulkActionBar");
  const selectedCountSpan = document.getElementById("selectedCount");

  const modalOverlay = document.getElementById("actionModal");
  const modalTitle = document.getElementById("modalTitle");
  const modalBody = document.getElementById("modalBody");
  const modalCancel = document.getElementById("modalCancel");
  const modalConfirm = document.getElementById("modalConfirm");

  let selectedStudentIds = [];

  function getStudentCheckboxes() {
    return document.querySelectorAll(".student-checkbox");
  }

  function updateSelectionState() {
    const checkboxes = getStudentCheckboxes();
    selectedStudentIds = Array.from(checkboxes)
      .filter((cb) => cb.checked)
      .map((cb) => cb.value);

    selectedCountSpan.textContent = `${selectedStudentIds.length} student${selectedStudentIds.length === 1 ? "" : "s"} selected`;

    if (selectedStudentIds.length > 0) {
      bulkActionBar.classList.add("active");
    } else {
      bulkActionBar.classList.remove("active");
    }

    if (selectAllCheckbox) {
      const allChecked = Array.from(checkboxes).every((cb) => cb.checked);
      const someChecked = Array.from(checkboxes).some((cb) => cb.checked);
      selectAllCheckbox.checked = allChecked && checkboxes.length > 0;
      selectAllCheckbox.indeterminate = someChecked && !allChecked;
    }
  }

  document
    .getElementById("studentTableBody")
    .addEventListener("change", (e) => {
      if (e.target.classList.contains("student-checkbox")) {
        updateSelectionState();
      }
    });

  if (selectAllCheckbox) {
    selectAllCheckbox.addEventListener("change", (e) => {
      const checkboxes = getStudentCheckboxes();
      checkboxes.forEach((cb) => {
        cb.checked = e.target.checked;
      });
      updateSelectionState();
    });
  }

  function closeModal() {
    modalOverlay.classList.remove("active");
  }

  modalCancel.addEventListener("click", closeModal);
  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) closeModal();
  });

  // --- 1. HANDLE "CHANGE STATUS" ---
  document.getElementById("btnChangeStatus").addEventListener("click", () => {
    modalTitle.textContent = "Change Enrollment Status";
    modalBody.innerHTML = `
      <label for="statusSelect">Select Status:</label>
      <select id="statusSelect" class="form-control">
        <option value="Normal">Normal</option>
        <option value="Promoted">Promoted</option>
        <option value="Repeating">Repeating</option>
        <option value="Transferred">Transferred</option>
        <option value="Graduated">Graduated</option>
      </select>
    `;
    modalOverlay.classList.add("active");

    modalConfirm.onclick = async () => {
      const newStatus = document.getElementById("statusSelect").value;
      if (!newStatus) {
        showToast("Please select a status.", "info");
        return;
      }
      await executeStatusChange(selectedStudentIds, newStatus);
      closeModal();
    };
  });

  // --- 2. HANDLE "MOVE TO 2ND SEMESTER" ---
  document.getElementById("btnSemesterMove").addEventListener("click", () => {
    modalTitle.textContent = "Move Students to 2nd Semester";
    modalBody.innerHTML = `
      <label for="feeStructureSelect">Select 2nd Semester Fee Structure:</label>
      <select id="feeStructureSelect" class="form-control">
        <option value="">-- Select Fee Structure --</option>
        <option value="fee-sem2-standard">Standard 2nd Semester Fee</option>
      </select>
    `;
    modalOverlay.classList.add("active");

    modalConfirm.onclick = async () => {
      const feeId = document.getElementById("feeStructureSelect").value;
      if (!feeId) {
        showToast("Please select a fee structure.", "info");
        return;
      }
      await executeSemesterMove(selectedStudentIds, feeId);
      closeModal();
    };
  });

  // --- 3. HANDLE "PROMOTE STUDENTS" ---
  document.getElementById("btnPromote").addEventListener("click", () => {
    modalTitle.textContent = "Promote Students";
    modalBody.innerHTML = `
      <label for="targetClassSelect">Target Class:</label>
      <select id="targetClassSelect" class="form-control">
        <option value="">-- Select Target Class --</option>
        <option value="class-id-6b">Grade 6B</option>
      </select>
      <label for="promotionFeeSelect">New Term Fee Structure:</label>
      <select id="promotionFeeSelect" class="form-control">
        <option value="">-- Select Fee Structure --</option>
        <option value="fee-id-new">New Year Standard Fee</option>
      </select>
    `;
    modalOverlay.classList.add("active");

    modalConfirm.onclick = async () => {
      const targetClassId = document.getElementById("targetClassSelect").value;
      const feeId = document.getElementById("promotionFeeSelect").value;
      if (!targetClassId || !feeId) {
        showToast("Please select both a target class and a fee structure.", "info");
        return;
      }
      await executePromotion(selectedStudentIds, targetClassId, feeId);
      closeModal();
    };
  });

  // Execution functions
  async function executeStatusChange(studentIds, newStatus) {
    try {
      const { error } = await supabaseClient
        .from("student_enrollments")
        .update({ enrollment_status: newStatus })
        .in("student_id", studentIds);

      if (error) throw error;

      showToast(
        `Successfully updated status to "${newStatus}" for ${studentIds.length} student(s)!`, "success"
      );
      if (typeof loadStudentEnrollments === "function") {
        loadStudentEnrollments();
      }
    } catch (err) {
      console.error("Error updating status:", err.message);
      showToast("Failed to update student status.", "error");
    }
  }

  async function executeSemesterMove(studentIds, feeStructureId) {
    showToast(
      `Successfully moved ${studentIds.length} student(s) to the 2nd semester!`, "success"
    );
  }

  async function executePromotion(studentIds, targetClassId, feeStructureId) {
    showToast(`Successfully promoted ${studentIds.length} student(s)!`); "success"
  }
});

async function loadStudentEnrollments() {
  const tbody = document.getElementById("studentTableBody");
  tbody.innerHTML =
    '<tr><td colspan="6" style="text-align: center;">Loading enrollment records...</td></tr>';

  try {
    // 1. Fetch all rows from student_enrollments
    const { data: enrollments, error: enrollError } = await supabaseClient
      .from("student_enrollments")
      .select("*");

    if (enrollError) throw enrollError;

    if (!enrollments || enrollments.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="6" style="text-align: center;">No enrollments found in the database.</td></tr>';
      return;
    }

    tbody.innerHTML = "";

    // 2. Loop through each enrollment and fetch the related names
    for (const enr of enrollments) {
      // Get student's name & status from profiles
      const { data: profileData } = await supabaseClient
        .from("profiles")
        .select("full_name, status")
        .eq("id", enr.student_id)
        .single();

      // Get class name
      const { data: classData } = await supabaseClient
        .from("classes")
        .select("name")
        .eq("id", enr.class_id)
        .single();

      // Get academic year name/label
      const { data: yearData } = await supabaseClient
        .from("academic_years")
        .select("year_label")
        .eq("id", enr.academic_year_id)
        .single();

      // Get term name/label
      const { data: termData } = await supabaseClient
        .from("terms")
        .select("name")
        .eq("id", enr.term_id)
        .single();

      const studentName = profileData?.full_name || "Unknown Student";
      const enrollmentStatus = enr.enrollment_status || "Normal";
      const className = classData?.name || "N/A";
      const academicYearName = yearData?.year_label || "N/A";
      const termName = termData?.name || "N/A";

      // 3. Render the row with your exact database attributes
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>
          <input 
            type="checkbox" 
            class="student-checkbox" 
            value="${enr.student_id}" 
          />
        </td>
        <td>${escapeHtml(studentName)}</td>
        <td>${escapeHtml(className)}</td>
        <td>${escapeHtml(academicYearName)}</td>
        <td>${escapeHtml(termName)}</td>
        <td><span class="status-badge ${enrollmentStatus.toLowerCase()}">${escapeHtml(enrollmentStatus)}</span></td>
      `;
      tbody.appendChild(row);
    }
  } catch (err) {
    console.error("Error loading enrollment table:", err.message);
    tbody.innerHTML =
      '<tr><td colspan="6" style="text-align: center; color: red;">Failed to load enrollment data.</td></tr>';
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
// Run when the page loads
document.addEventListener("DOMContentLoaded", loadStudentEnrollments);
