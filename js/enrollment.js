document.addEventListener("DOMContentLoaded", () => {
  const selectAllCheckbox = document.getElementById("selectAll");
  const bulkActionBar = document.getElementById("bulkActionBar");
  const selectedCountSpan = document.getElementById("selectedCount");

  const modalOverlay = document.getElementById("actionModal");
  const modalTitle = document.getElementById("modalTitle");
  const modalBody = document.getElementById("modalBody");
  const modalCancel = document.getElementById("modalCancel");
  const modalConfirm = document.getElementById("modalConfirm");

  let selectedEnrollmentIds = [];

  function getStudentCheckboxes() {
    return document.querySelectorAll(".student-checkbox");
  }

  function updateSelectionState() {
    const checkboxes = getStudentCheckboxes();
    selectedEnrollmentIds = Array.from(checkboxes)
      .filter((cb) => cb.checked)
      .map((cb) => cb.value); // This MUST be the enrollment table primary key (enrollment.id)

    selectedCountSpan.textContent = `${selectedEnrollmentIds.length} record${selectedEnrollmentIds.length === 1 ? "" : "s"} selected`;

    if (selectedEnrollmentIds.length > 0) {
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
      await executeStatusChange(selectedEnrollmentIds, newStatus);
      closeModal();
    };
  });

  // --- HANDLE "PROMOTE STUDENTS TO NEXT CLASS (2nd SEMESTER)" ---
  document
    .getElementById("btnPromoteStudents")
    ?.addEventListener("click", async () => {
      if (!selectedEnrollmentIds || selectedEnrollmentIds.length === 0) {
        showToast("Please select at least one enrollment record.", "info");
        return;
      }

      modalTitle.textContent = "Promote Students to Next Class (2nd Semester)";
      modalBody.innerHTML = `<p>Loading classes and fee structures...</p>`;
      modalOverlay.classList.add("active");

      try {
        const client = window.supabaseClient || supabaseClient;

        // 1. Get 2nd Semester Term ID
        const { data: termData, error: termErr } = await client
          .from("terms")
          .select("id")
          .ilike("name", "%2nd%")
          .limit(1)
          .single();

        if (termErr || !termData)
          throw new Error("Could not find 2nd Semester term.");
        const secondSemesterTermId = termData.id;

        // 2. Fetch selected students' current class IDs so we can filter them out of the target list
        const { data: currentEnrollments, error: currentErr } = await client
          .from("student_enrollments")
          .select("class_id")
          .in("id", selectedEnrollmentIds);

        if (currentErr) throw currentErr;
        const currentClassIds = [
          ...new Set(currentEnrollments.map((e) => e.class_id)),
        ];

        // 3. Fetch all active classes
        const { data: classesData, error: classErr } = await client
          .from("classes")
          .select("id, name, capacity")
          .eq("status", "active");

        if (classErr) throw classErr;

        // Filter out classes that the selected students are already currently in
        const availableTargetClasses = classesData.filter(
          (c) => !currentClassIds.includes(c.id),
        );

        // 4. Fetch 2nd Semester fee structures
        const { data: feesData, error: feeErr } = await client
          .from("fee_structures")
          .select("id, total_amount, class_id, classes(name)")
          .eq("term_id", secondSemesterTermId)
          .eq("status", "Active");

        if (feeErr) throw feeErr;

        modalConfirm.style.display = "inline-block";
        modalBody.innerHTML = `
      <p style="margin-bottom: 10px; color: #555;">
        Promoting <b>${selectedEnrollmentIds.length}</b> student(s) to a new class for the 2nd Semester.
      </p>

      <div style="margin-bottom: 15px;">
        <label for="targetClassSelect"><b>Target Class:</b></label>
        <select id="targetClassSelect" class="form-control">
          <option value="">-- Select Target Class --</option>
          ${availableTargetClasses.map((c) => `<option value="${c.id}" data-capacity="${c.capacity}">${c.name} (Capacity:${c.capacity})</option>`).join("")}
        </select>
      </div>

      <div style="margin-bottom: 15px;">
        <label for="targetFeeSelect"><b>2nd Semester Fee Structure:</b></label>
        <select id="targetFeeSelect" class="form-control" disabled>
          <option value="">-- Select a Target Class First --</option>
          ${feesData.map((f) => `<option value="${f.id}" data-class="${f.class_id}" data-amount="${f.total_amount}">[${f.classes?.name ?? "Class"}] Total: $${f.total_amount}</option>`).join("")}
        </select>
      </div>
      <div id="capacityWarning" style="color: #d9534f; font-size: 13px; margin-top: 5px;"></div>
    `;

        const targetClassSelect = document.getElementById("targetClassSelect");
        const targetFeeSelect = document.getElementById("targetFeeSelect");
        const capacityWarning = document.getElementById("capacityWarning");

        // Handle target class change: check capacity and auto-select matching fee structure
        targetClassSelect.onchange = async () => {
          const classId = targetClassSelect.value;

          if (!classId) {
            targetFeeSelect.value = "";
            targetFeeSelect.disabled = true;
            targetFeeSelect.innerHTML = `<option value="">-- Select a Target Class First --</option>`;
            capacityWarning.textContent = "";
            return;
          }

          // A. Check Capacity
          const { count, error: countErr } = await client
            .from("student_enrollments")
            .select("*", { count: "exact", head: true })
            .eq("class_id", classId);

          const selectedOption = targetClassSelect.selectedOptions[0];
          const capacity =
            parseInt(selectedOption.getAttribute("data-capacity")) || 0;

          if (!countErr && count >= capacity) {
            capacityWarning.textContent = `⚠️ Warning: Target class has reached or exceeded its capacity (${count}/${capacity}). Promotion may fail.`;
          } else {
            capacityWarning.textContent = `Class occupancy: ${count || 0} / ${capacity} available.`;
          }

          // B. Auto-select matching fee structure for this class
          const matchingFee = feesData.find((f) => f.class_id === classId);

          if (matchingFee) {
            targetFeeSelect.innerHTML = `
            <option value="${matchingFee.id}" data-class="${matchingFee.class_id}">
              [${matchingFee.classes?.name ?? "Class"}] Total: $${matchingFee.total_amount} (Auto-matched)
            </option>
          `;
            targetFeeSelect.value = matchingFee.id;
            targetFeeSelect.disabled = false; // Unlock so they can see it's set
          } else {
            targetFeeSelect.innerHTML = `<option value="">-- No active fee structure found for this class --</option>`;
            targetFeeSelect.value = "";
            targetFeeSelect.disabled = true;
            showToast(
              `Warning: No 2nd Semester fee structure is assigned to this target class.`,
              "info",
            );
          }
        };

        // Confirm Action Binding
        modalConfirm.onclick = async () => {
          const targetClassId = targetClassSelect.value;
          const feeStructureId = targetFeeSelect.value;

          if (!targetClassId || !feeStructureId) {
            showToast(
              "Please select both a target class and a valid fee structure.",
              "info",
            );
            return;
          }

          await executeNextClassPromotion(
            selectedEnrollmentIds,
            targetClassId,
            feeStructureId,
            secondSemesterTermId,
          );
          closeModal();
        };
      } catch (err) {
        console.error("Error setting up promotion modal:", err);
        modalBody.innerHTML = `<p style="color: red;">Error: ${err.message}</p>`;
      }
    });

  async function executeNextClassPromotion(
    enrollmentIds,
    targetClassId,
    feeStructureId,
    termId,
  ) {
    try {
      const client = window.supabaseClient || supabaseClient;

      // 1. Get target class details
      const { data: targetClass, error: targetClassErr } = await client
        .from("classes")
        .select("id, name")
        .eq("id", targetClassId)
        .single();

      if (targetClassErr || !targetClass)
        throw new Error("Target class not found.");

      // Helper function to extract grade number from class name (e.g., "Grade 4" -> 4)
      function extractGradeNumber(className) {
        const match = className.match(/(\d+)/);
        return match ? parseInt(match[0]) : null;
      }

      const targetGrade = extractGradeNumber(targetClass.name);

      // 2. Get student IDs, school IDs, academic years, AND their current classes
      const { data: sourceEnrollments, error: fetchErr } = await client
        .from("student_enrollments")
        .select("student_id, academic_year_id, school_id, classes(name)")
        .in("id", enrollmentIds);

      if (fetchErr) throw fetchErr;

      // 3. Validate Grade 10+ user account rule
      for (const enr of sourceEnrollments) {
        const currentClassName = enr.classes?.name || "";
        const currentGrade = extractGradeNumber(currentClassName);

        if (
          currentGrade !== null &&
          currentGrade < 9 &&
          targetGrade !== null &&
          targetGrade >= 10
        ) {
          showToast(
            `Promotion blocked: Students moving from ${currentClassName} to ${targetClass.name} require a user account. Please use the "Promote Student to User" button instead.`,
            "error",
          );
          return;
        }
      }

      // 4. Fetch fee structure details AND check its assigned class compatibility
      const { data: feeStruct, error: feeStructErr } = await client
        .from("fee_structures")
        .select("total_amount, class_id") // Fetches class_id to check compatibility
        .eq("id", feeStructureId)
        .single();

      if (feeStructErr || !feeStruct)
        throw new Error("Selected fee structure not found.");

      // 5. Validate that the fee structure matches the target class
      if (feeStruct.class_id && feeStruct.class_id !== targetClassId) {
        showToast(
          `Invalid fee structure! The selected fee structure is not assigned to ${targetClass.name}.`,
          "error",
        );
        return; // Stop execution
      }

      // Fetch matching fee structure breakdown items
      const { data: feeItems, error: itemsErr } = await client
        .from("fee_structure_items")
        .select("id, fee_name, amount")
        .eq("fee_structure_id", feeStructureId);

      if (itemsErr) throw itemsErr;

      for (const enr of sourceEnrollments) {
        // A. Check if a 2nd Semester enrollment record already exists
        const { data: existingEnr, error: checkErr } = await client
          .from("student_enrollments")
          .select("id")
          .eq("student_id", enr.student_id)
          .eq("academic_year_id", enr.academic_year_id)
          .eq("term_id", termId)
          .maybeSingle();

        if (checkErr) throw checkErr;

        let currentEnrollmentId;

        if (existingEnr) {
          const { error: updateErr } = await client
            .from("student_enrollments")
            .update({
              class_id: targetClassId,
              enrollment_status: "Promoted",
            })
            .eq("id", existingEnr.id);

          if (updateErr) throw updateErr;
          currentEnrollmentId = existingEnr.id;
        } else {
          const { data: newEnr, error: insertErr } = await client
            .from("student_enrollments")
            .insert({
              school_id: enr.school_id,
              student_id: enr.student_id,
              class_id: targetClassId,
              academic_year_id: enr.academic_year_id,
              term_id: termId,
              enrollment_status: "Promoted",
            })
            .select("id")
            .single();

          if (insertErr) throw insertErr;
          currentEnrollmentId = newEnr.id;
        }

        // B. Update student's primary class reference in `students` table
        const { error: studentUpdateErr } = await client
          .from("students")
          .update({ class_id: targetClassId })
          .eq("id", enr.student_id);

        if (studentUpdateErr) {
          console.warn(
            "Could not update student table class reference:",
            studentUpdateErr.message,
          );
        }

        // C. Insert into `student_fees`
        const { error: feeInsertErr } = await client
          .from("student_fees")
          .insert({
            school_id: enr.school_id,
            student_id: enr.student_id,
            class_id: targetClassId,
            academic_year_id: enr.academic_year_id,
            term_id: termId,
            fee_structure_id: feeStructureId,
            total_fees: feeStruct.total_amount,
            total_paid: 0,
            status: "Unpaid",
            fee_breakdown: feeItems || [],
          });

        if (feeInsertErr) throw feeInsertErr;
      }

      showToast(
        `Successfully promoted ${sourceEnrollments.length} student(s) to 2nd Semester!`,
        "success",
      );
      if (typeof loadStudentEnrollments === "function") {
        loadStudentEnrollments();
      }
    } catch (err) {
      console.error("Promotion execution failed:", err);
      showToast(`Promotion failed: ${err.message}`, "error");
    }
  }

  // Execution functions
  async function executeStatusChange(enrollmentIds, newStatus) {
    try {
      const { error } = await supabaseClient
        .from("student_enrollments")
        .update({ enrollment_status: newStatus })
        .in("id", enrollmentIds); // <-- Target the exact enrollment rows by their unique primary key 'id'

      if (error) throw error;

      showToast(
        `Successfully updated status to "${newStatus}" for ${enrollmentIds.length} enrollment record(s)!`,
        "success",
      );
      if (typeof loadStudentEnrollments === "function") {
        loadStudentEnrollments();
      }
    } catch (err) {
      console.error("Error updating status:", err.message);
      showToast("Failed to update student status.", "error");
    }
  }

  // --- 1. EXECUTE 2ND SEMESTER MOVE ---
  async function executeSemesterMove(studentIds, feeStructureId) {
    try {
      const client = window.supabaseClient || supabaseClient;
      const { error: rpcError } = await client.rpc(
        "promote_students_to_semester",
        {
          p_student_ids: studentIds,
          p_fee_structure_id: feeStructureId,
        },
      );

      if (rpcError) throw rpcError;

      showToast(
        `Successfully moved ${studentIds.length} student(s) to the 2nd semester!`,
        "success",
      );
      if (typeof loadStudentEnrollments === "function")
        loadStudentEnrollments();
    } catch (err) {
      console.error("Error executing semester move:", err.message);
      showToast(`Failed to move students: ${err.message}`, "error");
    }
  }

  // --- 2. EXECUTE NEW ACADEMIC YEAR MOVE ---
  async function executeNewYearMove(
    schoolId,
    studentIds,
    oldAcademicYearId,
    newAcademicYearId,
    newTermId,
  ) {
    try {
      const client = window.supabaseClient || supabaseClient;
      const { error: rpcError } = await client.rpc(
        "move_students_to_new_academic_year",
        {
          p_school_id: schoolId,
          p_student_ids: studentIds,
          p_old_academic_year_id: oldAcademicYearId,
          p_new_academic_year_id: newAcademicYearId,
          p_new_term_id: newTermId,
        },
      );

      if (rpcError) throw rpcError;

      showToast(
        `Successfully moved ${studentIds.length} student(s) to the new academic year!`,
        "success",
      );
      if (typeof loadStudentEnrollments === "function")
        loadStudentEnrollments();
    } catch (err) {
      console.error("Error executing new year move:", err.message);
      showToast(`Failed to move students to new year: ${err.message}`, "error");
    }
  }

  // --- 3. EVENT HANDLER: "MOVE TO 2ND SEMESTER" BUTTON ---
  document
    .getElementById("btnSemesterMove")
    ?.addEventListener("click", async () => {
      if (!selectedEnrollmentIds || selectedEnrollmentIds.length === 0) {
        showToast("Please select at least one enrollment record.", "info");
        return;
      }

      modalTitle.textContent = "Move Students to 2nd Semester";
      modalBody.innerHTML = `<p>Loading student details and fee structures...</p>`;
      modalOverlay.classList.add("active");

      try {
        const client = window.supabaseClient || supabaseClient;

        // Find 2nd Semester term ID
        const { data: termData, error: termErr } = await client
          .from("terms")
          .select("id")
          .ilike("name", "%2nd%")
          .limit(1)
          .single();

        if (termErr || !termData)
          throw new Error(
            "Could not find the 2nd Semester term in the database.",
          );
        const secondSemesterTermId = termData.id;

        // Fetch current enrollments
        const { data: currentEnrollments, error: enrollErr } = await client
          .from("student_enrollments")
          .select("student_id, class_id, classes(name)")
          .in("id", selectedEnrollmentIds);

        if (enrollErr) throw enrollErr;

        const uniqueClassMap = new Map();
        const extractedStudentIds = [];

        currentEnrollments.forEach((e) => {
          if (e.class_id)
            uniqueClassMap.set(e.class_id, e.classes?.name || "Unknown Class");
          if (e.student_id && !extractedStudentIds.includes(e.student_id))
            extractedStudentIds.push(e.student_id);
        });

        const uniqueClassIds = Array.from(uniqueClassMap.keys());
        if (uniqueClassIds.length === 0)
          throw new Error("Could not find current class enrollments.");

        // Fetch matching fee structures
        const { data: feesData, error: feeErr } = await client
          .from("fee_structures")
          .select("id, total_amount, class_id, classes(name)")
          .in("class_id", uniqueClassIds)
          .eq("term_id", secondSemesterTermId);

        if (feeErr) throw feeErr;

        modalConfirm.style.display = "inline-block";
        modalBody.innerHTML = `
      <p style="margin-bottom: 10px; color: #555;">Moving students to the 2nd Semester.</p>
      <div style="margin-bottom: 15px;">
        <label for="feeStructureSelect">Select Applicable Fee Structure:</label>
        <select id="feeStructureSelect" class="form-control">
          <option value="">-- Select Fee Structure --</option>
          ${feesData.map((f) => `<option value="${f.id}">[${f.classes?.name ?? "Class"}] Total: $${f.total_amount}</option>`).join("")}
        </select>
      </div>
    `;

        const feeStructureSelect =
          document.getElementById("feeStructureSelect");
        modalConfirm.onclick = async () => {
          const feeId = feeStructureSelect.value;
          if (!feeId) {
            showToast("Please select a fee structure.", "info");
            return;
          }
          await executeSemesterMove(extractedStudentIds, feeId);
          closeModal();
        };
      } catch (err) {
        console.error("Error loading modal data:", err);
        modalBody.innerHTML = `<p style="color: red;">Failed to load form options: ${err.message}</p>`;
      }
    });

  // --- 4. EVENT HANDLER: "MOVE TO NEW ACADEMIC YEAR" BUTTON ---
  document
    .getElementById("btnNewYearMove")
    ?.addEventListener("click", async () => {
      if (!selectedEnrollmentIds || selectedEnrollmentIds.length === 0) {
        showToast("Please select at least one enrollment record.", "info");
        return;
      }

      modalTitle.textContent = "Move Students to New Academic Year";
      modalBody.innerHTML = `<p>Loading academic years and terms...</p>`;
      modalOverlay.classList.add("active");

      try {
        const client = window.supabaseClient || supabaseClient;

        // Fetch selected enrollments to get school_id and old academic_year_id
        const { data: currentEnrollments, error: enrollErr } = await client
          .from("student_enrollments")
          .select("school_id, academic_year_id, student_id")
          .in("id", selectedEnrollmentIds);

        if (enrollErr || !currentEnrollments.length)
          throw new Error("Could not retrieve enrollment context.");

        const schoolId = currentEnrollments[0].school_id;
        const oldAcademicYearId = currentEnrollments[0].academic_year_id;
        const extractedStudentIds = [
          ...new Set(currentEnrollments.map((e) => e.student_id)),
        ];

        // Fetch available academic years and 1st semester terms
        const [{ data: academicYears }, { data: terms }] = await Promise.all([
          client
            .from("academic_years")
            .select("id, year_label")
            .eq("school_id", schoolId),
          client
            .from("terms")
            .select("id, name")
            .ilike("name", "%1st%")
            .limit(1),
        ]);

        if (!academicYears || academicYears.length === 0)
          throw new Error("No academic years found.");
        if (!terms || terms.length === 0)
          throw new Error("Could not find the 1st Semester term.");

        const newTermId = terms[0].id;

        modalConfirm.style.display = "inline-block";
        modalBody.innerHTML = `
      <p style="margin-bottom: 10px; color: #555;">Select the target Academic Year for rollover:</p>
      <div style="margin-bottom: 15px;">
        <label for="newAcademicYearSelect">Target Academic Year:</label>
        <select id="newAcademicYearSelect" class="form-control">
          <option value="">-- Select Academic Year --</option>
          ${academicYears.map((ay) => `<option value="${ay.id}">${ay.year_label}</option>`).join("")}
        </select>
      </div>
    `;

        const newAcademicYearSelect = document.getElementById(
          "newAcademicYearSelect",
        );
        modalConfirm.onclick = async () => {
          const newAcademicYearId = newAcademicYearSelect.value;
          if (!newAcademicYearId) {
            showToast("Please select a target academic year.", "info");
            return;
          }
          await executeNewYearMove(
            schoolId,
            extractedStudentIds,
            oldAcademicYearId,
            newAcademicYearId,
            newTermId,
          );
          closeModal();
        };
      } catch (err) {
        console.error("Error loading new year modal data:", err);
        modalBody.innerHTML = `<p style="color: red;">Failed to load options: ${err.message}</p>`;
      }
    });
});

async function loadStudentEnrollments() {
  const tbody = document.getElementById("studentTableBody");
  if (!tbody) return;

  tbody.innerHTML =
    '<tr><td colspan="6" style="text-align: center;">Loading enrollment records...</td></tr>';

  try {
    // 1. Fetch enrollments with all related names in ONE single query using Supabase joins
    const { data: enrollments, error: enrollError } = await supabaseClient.from(
      "student_enrollments",
    ).select(`
        id,
        enrollment_status,
        profiles (full_name, status),
        classes (name),
        academic_years (year_label),
        terms (name)
      `);

    if (enrollError) throw enrollError;

    if (!enrollments || enrollments.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="6" style="text-align: center;">No enrollments found in the database.</td></tr>';
      return;
    }

    // 2. Map all rows into a single HTML string in memory
    const rowsHTML = enrollments
      .map((enr) => {
        const studentName = enr.profiles?.full_name || "Unknown Student";
        const enrollmentStatus = enr.enrollment_status || "Normal";
        const className = enr.classes?.name || "N/A";
        const academicYearName = enr.academic_years?.year_label || "N/A";
        const termName = enr.terms?.name || "N/A";

        return `
        <tr>
          <td>
            <input 
              type="checkbox" 
              class="student-checkbox" 
              value="${enr.id}" 
            />
          </td>
          <td>${escapeHtml(studentName)}</td>
          <td>${escapeHtml(className)}</td>
          <td>${escapeHtml(academicYearName)}</td>
          <td>${escapeHtml(termName)}</td>
          <td><span class="status-badge ${enrollmentStatus.toLowerCase()}">${escapeHtml(enrollmentStatus)}</span></td>
        </tr>
      `;
      })
      .join("");

    // 3. Inject everything into the table in ONE single operation
    tbody.innerHTML = rowsHTML;
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
