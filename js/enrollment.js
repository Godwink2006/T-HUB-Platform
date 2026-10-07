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
      const visibleCheckboxes = Array.from(checkboxes).filter(
        (checkbox) => !checkbox.closest("tr")?.hidden,
      );
      const allVisibleChecked = visibleCheckboxes.every((cb) => cb.checked);
      const someVisibleChecked = visibleCheckboxes.some((cb) => cb.checked);
      selectAllCheckbox.checked =
        allVisibleChecked && visibleCheckboxes.length > 0;
      selectAllCheckbox.indeterminate = someVisibleChecked && !allVisibleChecked;
    }
  }

  const enrollmentFilterIds = [
    "enrollmentSearch",
    "filterAcademicYear",
    "filterSemester",
    "filterStatus",
    "filterClass",
  ];

  enrollmentFilterIds.forEach((id) => {
    document.getElementById(id)?.addEventListener(
      id === "enrollmentSearch" ? "input" : "change",
      applyEnrollmentFilters,
    );
  });

  document
    .getElementById("clearEnrollmentFilters")
    ?.addEventListener("click", () => {
      enrollmentFilterIds.forEach((id) => {
        const field = document.getElementById(id);
        if (field) field.value = "";
      });
      applyEnrollmentFilters();
    });

  function applyEnrollmentFilters() {
    const tbody = document.getElementById("studentTableBody");
    if (!tbody) return;

    const search =
      document.getElementById("enrollmentSearch")?.value.trim().toLowerCase() ||
      "";
    const filters = {
      year: document.getElementById("filterAcademicYear")?.value || "",
      semester: document.getElementById("filterSemester")?.value || "",
      status: document.getElementById("filterStatus")?.value || "",
      className: document.getElementById("filterClass")?.value || "",
    };

    let visibleCount = 0;
    const rows = Array.from(tbody.querySelectorAll("tr[data-enrollment-row]"));
    rows.forEach((row) => {
      const matchesSearch = !search || row.dataset.search.includes(search);
      const matches =
        matchesSearch &&
        (!filters.year || row.dataset.year === filters.year) &&
        (!filters.semester || row.dataset.semester === filters.semester) &&
        (!filters.status || row.dataset.status === filters.status) &&
        (!filters.className || row.dataset.className === filters.className);
      row.hidden = !matches;
      if (matches) visibleCount += 1;
    });

    let emptyRow = tbody.querySelector("#enrollmentNoMatches");
    if (!emptyRow && rows.length > 0) {
      emptyRow = document.createElement("tr");
      emptyRow.id = "enrollmentNoMatches";
      emptyRow.hidden = true;
      emptyRow.innerHTML =
        '<td colspan="6" class="enrollment-empty-state">No enrollments match these filters.</td>';
      tbody.appendChild(emptyRow);
    }
    if (emptyRow) emptyRow.hidden = visibleCount > 0 || rows.length === 0;

    const resultCount = document.getElementById("enrollmentResultCount");
    if (resultCount) {
      resultCount.textContent = `${visibleCount} of ${rows.length} enrollment${rows.length === 1 ? "" : "s"}`;
    }
    updateSelectionState();
  }

  function populateEnrollmentFilter(selectId, values, defaultLabel) {
    const select = document.getElementById(selectId);
    if (!select) return;
    const selectedValue = select.value;
    const sortedValues = [...new Set(values.filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }),
    );
    select.innerHTML = `<option value="">${defaultLabel}</option>${sortedValues
      .map(
        (value) =>
          `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`,
      )
      .join("")}`;
    if (sortedValues.includes(selectedValue)) select.value = selectedValue;
  }

  window.applyEnrollmentFilters = applyEnrollmentFilters;
  window.populateEnrollmentFilter = populateEnrollmentFilter;
  window.updateEnrollmentSelectionState = updateSelectionState;

  document
    .getElementById("studentTableBody")
    .addEventListener("change", (e) => {
      if (e.target.classList.contains("student-checkbox")) {
        updateSelectionState();
      }
    });

  if (selectAllCheckbox) {
    selectAllCheckbox.addEventListener("change", (e) => {
      const checkboxes = Array.from(getStudentCheckboxes()).filter(
        (checkbox) => !checkbox.closest("tr")?.hidden,
      );
      checkboxes.forEach((cb) => {
        cb.checked = e.target.checked;
      });
      window.updateEnrollmentSelectionState();
    });
  }

  function openModal() {
    modalOverlay.classList.add("active");
    document.body.classList.add("modal-open");
  }

  function closeModal() {
    modalOverlay.classList.remove("active");
    document.body.classList.remove("modal-open");
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
    openModal();

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

  // --- HANDLE "PROMOTE GRADE 9 TO 10 (CREATE USER)" ---
  document
    .getElementById("btnPromoteGrade9To10")
    ?.addEventListener("click", async () => {
      if (!selectedEnrollmentIds || selectedEnrollmentIds.length === 0) {
        showToast("Please select an enrollment record.", "info");
        return;
      }

      if (selectedEnrollmentIds.length > 1) {
        showToast(
          "Please select only one student at a time for promotion.",
          "error",
        );
        return;
      }

      modalTitle.textContent =
        "Promote Grade 9 to Grade 10 (Create Auth Account)";
      modalBody.innerHTML = `<p>Loading student details, classes, and fee structures...</p>`;
      openModal();

      try {
        const client = window.supabaseClient || supabaseClient;

        // 1. Ensure we have the school ID
        let activeSchoolId = window.currentSchoolId;
        if (!activeSchoolId) {
          const {
            data: { user },
          } = await client.auth.getUser();
          if (user) {
            const { data: userProfile } = await client
              .from("profiles")
              .select("school_id")
              .eq("id", user.id)
              .single();
            activeSchoolId = userProfile?.school_id;
          }
        }

        if (!activeSchoolId) {
          throw new Error("Active school ID could not be determined.");
        }

        // 2. Fetch the current Active Academic Year safely
        const { data: activeYear, error: yearErr } = await client
          .from("academic_years")
          .select("id, year_label")
          .eq("status", "Active")
          .eq("school_id", activeSchoolId)
          .maybeSingle();

        if (yearErr || !activeYear) {
          throw new Error("No active academic year found for this school.");
        }

        // Find both source and target terms for the current academic year.
        const { data: yearTerms, error: termErr } = await client
          .from("terms")
          .select("id, name")
          .eq("academic_year_id", activeYear.id)
          .eq("school_id", activeSchoolId);

        if (termErr) throw termErr;
        const isFirstTerm = (name) => /\b(?:1(?:st)?|first|one|i)\b/i.test(name || "");
        const isSecondTerm = (name) => /\b(?:2(?:nd)?|second|two|ii)\b/i.test(name || "");
        const firstTerms = (yearTerms || []).filter((term) => isFirstTerm(term.name));
        const secondTerms = (yearTerms || []).filter((term) => isSecondTerm(term.name));

        if (firstTerms.length !== 1) {
          throw new Error("Could not identify exactly one 1st term for the active academic year.");
        }
        if (secondTerms.length !== 1) {
          throw new Error("Could not identify exactly one 2nd term for the active academic year.");
        }
        const activeFirstTermId = firstTerms[0].id;
        const activeSecondTermId = secondTerms[0].id;

        // 4. Fetch the single selected enrollment safely, including term_id if available
        const { data: sourceEnrollments, error: fetchErr } = await client
          .from("student_enrollments")
          .select(
            "id, student_id, school_id, academic_year_id, term_id, classes(name)",
          )
          .in("id", selectedEnrollmentIds);

        if (fetchErr) throw fetchErr;
        const enr = sourceEnrollments[0];

        // 5. Validate that the student belongs to the active academic year & 1st term
        if (enr.academic_year_id !== activeYear.id) {
          showToast(
            "Selected student is not enrolled in the active academic year.",
            "error",
          );
          closeModal();
          return;
        }

        if (enr.term_id && enr.term_id !== activeFirstTermId) {
          showToast(
            "Selected student must be enrolled in the 1st Term of the active year.",
            "error",
          );
          closeModal();
          return;
        }

        // 6. Validate that the student is in Grade 9
        const className = enr.classes?.name || "";
        const match = className.match(/(\d+)/);
        const grade = match ? parseInt(match[0]) : null;

        if (grade !== 9) {
          showToast("Selected student is not in Grade 9.", "error");
          closeModal();
          return;
        }

        // 7. Fetch Grade 10 classes for the active school
        const { data: classesData, error: classErr } = await client
          .from("classes")
          .select("id, name, capacity")
          .eq("school_id", activeSchoolId)
          .ilike("name", "%10%")
          .eq("status", "active");

        if (classErr) throw classErr;

        // 8. Fetch active fee structures for Grade 10 classes
        const { data: feesData, error: feeErr } = await client
          .from("fee_structures")
          .select("id, total_amount, class_id, term_id, terms(name), classes(name)")
          .eq("status", "Active")
          .eq("school_id", activeSchoolId)
          .eq("academic_year_id", activeYear.id)
          .eq("term_id", activeSecondTermId);

        if (feeErr) throw feeErr;

        modalConfirm.style.display = "inline-block";
        modalBody.innerHTML = `
        <div style="margin-bottom: 15px; font-size: 13px; color: #555;">
          <b>Promotion:</b> Grade 9, 1st Term → Grade 10, 2nd Term (${activeYear.year_label})
        </div>

        <div style="margin-bottom: 15px;">
          <label for="targetClassSelect"><b>Target Grade 10 Class:</b></label>
          <select id="targetClassSelect" class="form-control">
            <option value="">-- Select Grade 10 Class --</option>
            ${classesData.map((c) => `<option value="${c.id}" data-capacity="${c.capacity}">${c.name} (Capacity:${c.capacity})</option>`).join("")}
          </select>
        </div>

        <div style="margin-bottom: 15px;">
          <label for="targetFeeSelect"><b>Fee Structure:</b></label>
          <select id="targetFeeSelect" class="form-control" disabled>
            <option value="">-- Select Target Class First --</option>
          </select>
        </div>

        <div style="margin-bottom: 15px;">
          <label for="studentEmail"><b>Student Email:</b></label>
          <input type="email" id="studentEmail" class="form-control" placeholder="student@school.com" />
        </div>

        <div style="margin-bottom: 15px;">
          <label for="studentPassword"><b>Temporary Password:</b></label>
          <input type="password" id="studentPassword" class="form-control" placeholder="Min 12 characters" />
        </div>

        <div style="margin-bottom: 15px;">
          <label for="studentPhone"><b>Phone Number:</b></label>
          <input type="text" id="studentPhone" class="form-control" placeholder="Phone number" />
        </div>

        <div id="capacityWarning" style="color: #d9534f; font-size: 13px; margin-top: 5px;"></div>
      `;

        const targetClassSelect = document.getElementById("targetClassSelect");
        const targetFeeSelect = document.getElementById("targetFeeSelect");
        const capacityWarning = document.getElementById("capacityWarning");

        // Handle class selection & dynamic fee structure filtering
        targetClassSelect.onchange = async () => {
          const classId = targetClassSelect.value;
          if (!classId) {
            targetFeeSelect.innerHTML = `<option value="">-- Select Target Class First --</option>`;
            targetFeeSelect.disabled = true;
            capacityWarning.textContent = "";
            return;
          }

          // Check Capacity for the active academic year
          const { count, error: countErr } = await client
            .from("student_enrollments")
            .select("*", { count: "exact", head: true })
            .eq("class_id", classId)
            .eq("academic_year_id", activeYear.id);

          const selectedOption = targetClassSelect.selectedOptions[0];
          const capacity =
            parseInt(selectedOption.getAttribute("data-capacity")) || 0;

          if (!countErr && count >= capacity) {
            capacityWarning.textContent = `⚠️ Warning: Class has reached capacity (${count}/${capacity}).`;
          } else {
            capacityWarning.textContent = `Class occupancy: ${count || 0} / ${capacity} available.`;
          }

          // Filter matching fee structures
          const matchingFees = feesData.filter(
            (f) => f.class_id === classId && f.term_id === activeSecondTermId,
          );
          if (matchingFees.length > 0) {
            targetFeeSelect.innerHTML = matchingFees
              .map(
                (f) =>
                  `<option value="${f.id}">[${f.classes?.name}] ${f.terms?.name ?? "Term"} - Total: $${f.total_amount}</option>`,
              )
              .join("");
            targetFeeSelect.disabled = false;
          } else {
            targetFeeSelect.innerHTML = `<option value="">-- No 2nd-term fee structure found for this class --</option>`;
            targetFeeSelect.disabled = true;
          }
        };

        // Confirm Action Binding
        modalConfirm.onclick = async () => {
          const targetClassId = targetClassSelect.value;
          const feeStructureId = targetFeeSelect.value;
          const email = document.getElementById("studentEmail").value.trim();
          const password = document
            .getElementById("studentPassword")
            .value.trim();
          const phone = document.getElementById("studentPhone").value.trim();

          if (
            !targetClassId ||
            !feeStructureId ||
            !email ||
            !password ||
            !phone
          ) {
            showToast(
              "Please fill in all required fields (Class, Fee Structure, Email, Password, Phone).",
              "info",
            );
            return;
          }

          const originalConfirmText = modalConfirm.textContent;
          const originalCancelDisabled = modalCancel.disabled;
          modalConfirm.disabled = true;
          modalConfirm.setAttribute("aria-busy", "true");
          modalConfirm.textContent = "Creating...";
          modalCancel.disabled = true;

          try {
            const created = await executeGrade9To10Promotion({
              enrollmentIds: selectedEnrollmentIds,
              studentId: enr.student_id,
              targetClassId,
              feeStructureId,
              activeAcademicYearId: activeYear.id,
              email,
              password,
              phone,
            });
            if (created) closeModal();
          } finally {
            modalConfirm.disabled = false;
            modalConfirm.removeAttribute("aria-busy");
            modalConfirm.textContent = originalConfirmText;
            modalCancel.disabled = originalCancelDisabled;
          }
        };
      } catch (err) {
        console.error("Error setting up Grade 9 to 10 promotion modal:", err);
        modalBody.innerHTML = `<p style="color: red;">Error: ${err.message}</p>`;
      }
    });

  async function executeGrade9To10Promotion({
    enrollmentIds,
    targetClassId,
    feeStructureId,
    email,
    password,
    phone,
  }) {
    try {
      const supabaseClient = window.supabaseClient || supabaseClient;

      // Get student_id from the enrollment records
      const { data: sourceEnrollments, error: fetchErr } = await supabaseClient
        .from("student_enrollments")
        .select("student_id")
        .in("id", enrollmentIds);

      if (fetchErr) throw fetchErr;

      // 🛑 ADD THIS CHECK TO DEBUG
      console.log("Submitting Promotion With:", {
        targetClassId,
        feeStructureId,
        email,
        phone,
        enrollmentIds,
      });

      if (!feeStructureId) {
        showToast(
          "Error: Fee Structure is missing or not selected in the modal dropdown!",
          "error",
        );
        return false;
      }

      for (const enr of sourceEnrollments) {
        const { data, error: fnErr } = await supabaseClient.functions.invoke(
          "promote-grade9-to-10",
          {
            body: {
              enrollment_ids: enrollmentIds,
              target_class_id: targetClassId,
              fee_structure_id: feeStructureId,
              email: email,
              phone_number: phone,
              password: password,
            },
          },
        );

        if (fnErr || !data?.success) {
          throw new Error(
            data?.message || fnErr?.message || "Promotion failed.",
          );
        }
      }

      showToast(
        "Successfully promoted student(s) to Grade 10 and generated portal accounts!",
        "success",
      );
      if (typeof loadStudentEnrollments === "function") {
        loadStudentEnrollments();
      }
      return true;
    } catch (err) {
      console.error("Grade 9 to 10 promotion failed:", err);
      showToast(`Promotion failed: ${err.message}`, "error");
      return false;
    }
  }

  // --- HANDLE "PROMOTE STUDENTS TO NEXT CLASS (2nd SEMESTER)" ---
  document
    .getElementById("btnPromoteStudents")
    ?.addEventListener("click", async () => {
      const enrollmentIds = [...new Set(selectedEnrollmentIds || [])];
      if (enrollmentIds.length === 0) {
        showToast("Please select at least one enrollment record.", "info");
        return;
      }
      if (enrollmentIds.length !== selectedEnrollmentIds.length) {
        showToast("The selection contains duplicate enrollment records.", "error");
        return;
      }

      modalTitle.textContent = "Promote Students to Next Class (2nd Semester)";
      modalBody.innerHTML = `<p>Checking the active year, first-term class, and fee structures...</p>`;
      openModal();

      try {
        const client = window.supabaseClient;
        if (!client) throw new Error("Supabase client is not initialized.");

        let activeSchoolId = window.currentSchoolId;
        if (!activeSchoolId) {
          const { data: { user }, error: userError } = await client.auth.getUser();
          if (userError) throw userError;
          if (user) {
            const { data: profile, error: profileError } = await client
              .from("profiles")
              .select("school_id")
              .eq("id", user.id)
              .single();
            if (profileError) throw profileError;
            activeSchoolId = profile?.school_id;
          }
        }
        if (!activeSchoolId) throw new Error("Active school could not be determined.");

        const { data: activeYear, error: yearError } = await client
          .from("academic_years")
          .select("id, year_label")
          .eq("school_id", activeSchoolId)
          .eq("status", "Active")
          .maybeSingle();
        if (yearError || !activeYear) {
          throw new Error("Could not find one active academic year for this school.");
        }

        const { data: yearTerms, error: termsError } = await client
          .from("terms")
          .select("id, name")
          .eq("school_id", activeSchoolId)
          .eq("academic_year_id", activeYear.id);
        if (termsError) throw termsError;

        const findTerm = (terms, termNumber) => terms.filter((term) => {
          const name = (term.name || "").toLowerCase();
          return termNumber === 1
            ? /\b(?:1st|first|term\s*1|semester\s*1|one|i)\b/.test(name)
            : /\b(?:2nd|second|term\s*2|semester\s*2|two|ii)\b/.test(name);
        });
        const firstTerms = findTerm(yearTerms || [], 1);
        const secondTerms = findTerm(yearTerms || [], 2);
        if (firstTerms.length !== 1 || secondTerms.length !== 1) {
          throw new Error("The active academic year must have exactly one first term and one second term.");
        }
        const firstTermId = firstTerms[0].id;
        const secondTermId = secondTerms[0].id;

        const { data: sourceEnrollments, error: sourceError } = await client
          .from("student_enrollments")
          .select("id, student_id, school_id, class_id, academic_year_id, term_id, classes(name)")
          .in("id", enrollmentIds);
        if (sourceError) throw sourceError;
        if (!sourceEnrollments || sourceEnrollments.length !== enrollmentIds.length) {
          throw new Error("Some selected enrollment records could not be found.");
        }

        const studentIds = sourceEnrollments.map((enrollment) => String(enrollment.student_id));
        const sourceClassIds = [...new Set(sourceEnrollments.map((enrollment) => String(enrollment.class_id)))];
        const allFromFirstTerm = sourceEnrollments.every((enrollment) =>
          String(enrollment.school_id) === String(activeSchoolId) &&
          String(enrollment.academic_year_id) === String(activeYear.id) &&
          String(enrollment.term_id) === String(firstTermId),
        );
        if (!allFromFirstTerm) {
          throw new Error("Select students enrolled in the first term of this school's active academic year only.");
        }
        if (sourceClassIds.length !== 1) {
          throw new Error("Select students from one first-term class at a time.");
        }
        if (new Set(studentIds).size !== studentIds.length) {
          throw new Error("A student appears more than once in the selected enrollment records.");
        }

        const { data: classesData, error: classErr } = await client
          .from("classes")
          .select("id, name, capacity")
          .eq("school_id", activeSchoolId)
          .eq("status", "active");
        if (classErr) throw classErr;
        const getGradeNumber = (name) => {
          const match = (name || "").match(/(\d+)/);
          return match ? Number(match[1]) : null;
        };
        const sourceGrade = getGradeNumber(sourceEnrollments[0].classes?.name);
        const availableTargetClasses = (classesData || []).filter((schoolClass) => {
          if (String(schoolClass.id) === sourceClassIds[0]) return false;
          const targetGrade = getGradeNumber(schoolClass.name);
          return !(sourceGrade !== null && sourceGrade <= 9 && targetGrade !== null && targetGrade >= 10);
        });

        const { data: feesData, error: feeErr } = await client
          .from("fee_structures")
          .select("id, total_amount, class_id, academic_year_id, term_id, school_id, status, classes(name)")
          .eq("school_id", activeSchoolId)
          .eq("academic_year_id", activeYear.id)
          .eq("term_id", secondTermId)
          .eq("status", "Active");
        if (feeErr) throw feeErr;

        modalConfirm.style.display = "inline-block";
        modalBody.innerHTML = `
      <p style="margin-bottom: 10px; color: #555;">
        Promoting <b>${sourceEnrollments.length}</b> student(s) from <b>${sourceEnrollments[0].classes?.name || "their first-term class"}</b> for the 2nd Semester of ${activeYear.year_label}.
      </p>

      <div style="margin-bottom: 15px;">
        <label for="targetClassSelect"><b>Target Class:</b></label>
        <select id="targetClassSelect" class="form-control">
          <option value="">-- Select Target Class --</option>
          ${availableTargetClasses.map((c) => `<option value="${c.id}" data-capacity="${c.capacity}">${c.name} (Capacity: ${c.capacity ?? "not set"})</option>`).join("")}
        </select>
      </div>

      <div style="margin-bottom: 15px;">
        <label for="targetFeeSelect"><b>2nd Semester Fee Structure:</b></label>
        <select id="targetFeeSelect" class="form-control" disabled>
          <option value="">-- Select a Target Class First --</option>
        </select>
      </div>
      <div id="capacityWarning" role="status" aria-live="polite" style="color: #d9534f; font-size: 13px; margin-top: 5px;"></div>
    `;

        const targetClassSelect = document.getElementById("targetClassSelect");
        const targetFeeSelect = document.getElementById("targetFeeSelect");
        const capacityWarning = document.getElementById("capacityWarning");

        // Handle target class change: check second-term capacity and matching fees.
        targetClassSelect.onchange = async () => {
          const classId = targetClassSelect.value;

          if (!classId) {
            targetFeeSelect.value = "";
            targetFeeSelect.disabled = true;
            targetFeeSelect.innerHTML = `<option value="">-- Select a Target Class First --</option>`;
            capacityWarning.textContent = "";
            return;
          }

          // Check occupancy for this target class in the active second term.
          const { count, error: countErr } = await client
            .from("student_enrollments")
            .select("*", { count: "exact", head: true })
            .eq("school_id", activeSchoolId)
            .eq("class_id", classId)
            .eq("academic_year_id", activeYear.id)
            .eq("term_id", secondTermId);

          const selectedOption = targetClassSelect.selectedOptions[0];
          const capacity =
            parseInt(selectedOption.getAttribute("data-capacity")) || 0;

          const currentCount = count || 0;
          if (countErr) {
            capacityWarning.textContent = "Could not verify capacity. It will be checked again before saving.";
          } else if (capacity > 0 && currentCount + sourceEnrollments.length > capacity) {
            capacityWarning.textContent = `This class would exceed capacity (${currentCount + sourceEnrollments.length}/${capacity}).`;
          } else {
            capacityWarning.textContent = capacity > 0
              ? `Class occupancy after promotion: ${currentCount + sourceEnrollments.length} / ${capacity}.`
              : `Current second-term enrollment: ${currentCount}. No capacity limit is set.`;
          }

          const matchingFees = (feesData || []).filter(
            (fee) => String(fee.class_id) === String(classId),
          );
          if (matchingFees.length > 0) {
            targetFeeSelect.innerHTML = `<option value="">-- Select fee structure --</option>${matchingFees.map((fee) =>
              `<option value="${fee.id}">[${fee.classes?.name ?? "Class"}] Total: $${fee.total_amount}</option>`,
            ).join("")}`;
            targetFeeSelect.disabled = false;
          } else {
            targetFeeSelect.innerHTML = `<option value="">-- No active second-term fee structure for this class --</option>`;
            targetFeeSelect.value = "";
            targetFeeSelect.disabled = true;
          }
        };

        // Confirm Action Binding
        modalConfirm.onclick = async () => {
          const targetClassId = targetClassSelect.value;
          const feeStructureId = targetFeeSelect.value;

          if (!targetClassId || !feeStructureId) {
            capacityWarning.textContent = "Choose a target class and its second-term fee structure before confirming.";
            showToast(
              "Please select both a target class and a valid fee structure.",
              "info",
            );
            return;
          }

          capacityWarning.textContent = "Validating records and saving the promotion…";
          const originalText = modalConfirm.textContent;
          modalConfirm.disabled = true;
          modalConfirm.textContent = "Promoting...";
          modalConfirm.setAttribute("aria-busy", "true");
          try {
            const succeeded = await executeNextClassPromotion({
              client,
              enrollmentIds,
              targetClassId,
              feeStructureId,
            });
            if (succeeded) closeModal();
          } catch (err) {
            console.error("Second-semester confirmation failed:", err);
            capacityWarning.textContent = `Promotion failed: ${err.message || "Unexpected error."}`;
          } finally {
            modalConfirm.disabled = false;
            modalConfirm.textContent = originalText;
            modalConfirm.removeAttribute("aria-busy");
          }
        };
      } catch (err) {
        console.error("Error setting up promotion modal:", err);
        modalBody.innerHTML = `<p style="color: red;">Error: ${err.message}</p>`;
      }
    });

  async function executeNextClassPromotion({
    client,
    enrollmentIds,
    targetClassId,
    feeStructureId,
  }) {
    try {
      const { data, error } = await client.rpc(
        "promote_regular_students_to_second_term",
        {
          p_enrollment_ids: enrollmentIds,
          p_target_class_id: targetClassId,
          p_fee_structure_id: feeStructureId,
        },
      );

      if (error) throw error;
      if (!data?.success) {
        throw new Error(data?.message || "The promotion RPC returned an unsuccessful result.");
      }

      const promotedCount = data.student_count ?? enrollmentIds.length;
      showToast(`Successfully promoted ${promotedCount} student(s) to 2nd Semester!`, "success");
      if (typeof loadStudentEnrollments === "function") loadStudentEnrollments();
      return true;
    } catch (err) {
      const message = err?.message || "Unexpected error while promoting students.";
      console.error("Promotion RPC failed:", err);
      const status = document.getElementById("capacityWarning");
      if (status) status.textContent = `Promotion failed: ${message}`;
      showToast(`Promotion failed: ${message}`, "error");
      return false;
    }
  }
  // --- HANDLE "PROMOTE STUDENTS TO NEW ACADEMIC YEAR (1st SEMESTER)" ---
  document
    .getElementById("btnPromoteNextYear")
    ?.addEventListener("click", async () => {
      if (!selectedEnrollmentIds || selectedEnrollmentIds.length === 0) {
        showToast("Please select at least one enrollment record.", "info");
        return;
      }

      modalTitle.textContent =
        "Promote Students to New Academic Year (1st Semester)";
      modalBody.innerHTML = `<p>Loading academic years, classes, and fee structures...</p>`;
      openModal();

      try {
        const supabaseClient = window.supabaseClient || supabaseClient;

        // 1. Fetch active Academic Years so admin can choose the target year
        const { data: yearsData, error: yearsErr } = await supabaseClient
          .from("academic_years")
          .select("id, year_label, status")
          .order("year_label", { ascending: false });

        if (yearsErr || !yearsData)
          throw new Error("Could not fetch academic years.");

        // 2. Fetch ALL terms so we can match 1st semester per academic year
        const { data: termsData, error: termErr } = await supabaseClient
          .from("terms")
          .select("id, name, academic_year_id");

        if (termErr || !termsData) throw new Error("Could not fetch terms.");

        // Get all 1st semester term IDs across years to fetch their fee structures
        const firstSemesterTermIds = termsData
          .filter((t) => t.name && t.name.toLowerCase().includes("1st"))
          .map((t) => t.id);

        // 3. Fetch all active classes
        const { data: classesData, error: classErr } = await supabaseClient
          .from("classes")
          .select("id, name, capacity")
          .eq("status", "active");

        if (classErr) throw classErr;

        // 4. Fetch 1st Semester fee structures for all 1st semester terms
        const { data: feesData, error: feeErr } = await supabaseClient
          .from("fee_structures")
          .select(
            "id, total_amount, class_id, academic_year_id, term_id, classes(name)",
          )
          .in(
            "term_id",
            firstSemesterTermIds.length > 0 ? firstSemesterTermIds : ["none"],
          )
          .eq("status", "Active");

        if (feeErr) throw feeErr;

        modalConfirm.style.display = "inline-block";
        modalBody.innerHTML = `
      <p style="margin-bottom: 10px; color: #555;">
        Promoting <b>${selectedEnrollmentIds.length}</b> student(s) to a new academic year (1st Semester).
      </p>

      <div style="margin-bottom: 15px;">
        <label for="targetAcademicYearSelect"><b>Target Academic Year:</b></label>
        <select id="targetAcademicYearSelect" class="form-control">
          <option value="">-- Select Target Academic Year --</option>
          ${yearsData
            .map(
              (y) => `
            <option value="${y.id}" ${y.status === "Active" ? "selected" : ""}>
              ${y.year_label}${y.status === "Active" ? "(Active)" : ""}
            </option>
          `,
            )
            .join("")}
        </select>
      </div>

      <div style="margin-bottom: 15px;">
        <label for="targetClassSelect"><b>Target Class:</b></label>
        <select id="targetClassSelect" class="form-control">
          <option value="">-- Select Target Class --</option>
          ${classesData.map((c) => `<option value="${c.id}" data-capacity="${c.capacity}">${c.name} (Capacity:${c.capacity})</option>`).join("")}
        </select>
      </div>

      <div style="margin-bottom: 15px;">
        <label for="targetFeeSelect"><b>1st Semester Fee Structure:</b></label>
        <select id="targetFeeSelect" class="form-control" disabled>
          <option value="">-- Select Target Year & Class First --</option>
        </select>
      </div>
      <div id="capacityWarning" style="color: #d9534f; font-size: 13px; margin-top: 5px;"></div>
    `;

        const targetAcademicYearSelect = document.getElementById(
          "targetAcademicYearSelect",
        );
        const targetClassSelect = document.getElementById("targetClassSelect");
        const targetFeeSelect = document.getElementById("targetFeeSelect");
        const capacityWarning = document.getElementById("capacityWarning");

        // Helper to update available fee structures based on selected Year & Class
        const updateFeeOptions = () => {
          const selectedYearId = targetAcademicYearSelect.value;
          const selectedClassId = targetClassSelect.value;

          if (!selectedYearId || !selectedClassId) {
            targetFeeSelect.innerHTML = `<option value="">-- Select Target Year & Class First --</option>`;
            targetFeeSelect.disabled = true;
            return;
          }

          // Find the exact 1st semester term ID for this specific academic year
          const targetTerm = termsData.find(
            (t) =>
              String(t.academic_year_id) === String(selectedYearId) &&
              t.name &&
              t.name.toLowerCase().includes("1st"),
          );

          if (!targetTerm) {
            targetFeeSelect.innerHTML = `<option value="">-- No 1st Semester term found for this year --</option>`;
            targetFeeSelect.disabled = true;
            return;
          }

          // Filter fees matching the target year, the correct 1st semester term ID, and class
          const matchingFees = feesData.filter(
            (f) =>
              String(f.academic_year_id) === String(selectedYearId) &&
              String(f.term_id) === String(targetTerm.id) &&
              String(f.class_id) === String(selectedClassId),
          );

          if (matchingFees.length > 0) {
            targetFeeSelect.innerHTML = matchingFees
              .map(
                (f) =>
                  `<option value="${f.id}" data-class="${f.class_id}" data-amount="${f.total_amount}">[${f.classes?.name ?? "Class"}] Total: $${f.total_amount}</option>`,
              )
              .join("");
            targetFeeSelect.disabled = false;
          } else {
            targetFeeSelect.innerHTML = `<option value="">-- No active fee structure found for this year/class --</option>`;
            targetFeeSelect.disabled = true;
          }
        };

        targetAcademicYearSelect.onchange = updateFeeOptions;

        // Handle target class change: check capacity and update fees
        targetClassSelect.onchange = async () => {
          const classId = targetClassSelect.value;

          if (!classId) {
            capacityWarning.textContent = "";
            updateFeeOptions();
            return;
          }

          // A. Check Capacity for the target class
          const { count, error: countErr } = await supabaseClient
            .from("student_enrollments")
            .select("*", { count: "exact", head: true })
            .eq("class_id", classId)
            .eq("academic_year_id", targetAcademicYearSelect.value);

          const selectedOption = targetClassSelect.selectedOptions[0];
          const capacity =
            parseInt(selectedOption.getAttribute("data-capacity")) || 0;

          if (!countErr && count >= capacity) {
            capacityWarning.textContent = `⚠️ Warning: Target class has reached or exceeded its capacity (${count}/${capacity}).`;
          } else {
            capacityWarning.textContent = `Class occupancy in target year: ${count || 0} / ${capacity} available.`;
          }

          updateFeeOptions();
        };

        // Confirm Action Binding
        modalConfirm.onclick = async () => {
          const targetAcademicYearId = targetAcademicYearSelect.value;
          const targetClassId = targetClassSelect.value;
          const feeStructureId = targetFeeSelect.value;

          if (!targetAcademicYearId || !targetClassId || !feeStructureId) {
            showToast(
              "Please select an academic year, target class, and a valid fee structure.",
              "info",
            );
            return;
          }

          // Dynamically find the correct term ID for execution
          const targetTerm = termsData.find(
            (t) =>
              String(t.academic_year_id) === String(targetAcademicYearId) &&
              t.name &&
              t.name.toLowerCase().includes("1st"),
          );

          if (!targetTerm) {
            showToast(
              "Could not find a 1st Semester term for the selected academic year.",
              "error",
            );
            return;
          }

          await executeYearlyPromotion(
            selectedEnrollmentIds,
            targetAcademicYearId,
            targetClassId,
            feeStructureId,
            targetTerm.id,
          );
          closeModal();
        };
      } catch (err) {
        console.error("Error setting up yearly promotion modal:", err);
        modalBody.innerHTML = `<p style="color: red;">Error: ${err.message}</p>`;
      }
    });

  async function executeYearlyPromotion(
    enrollmentIds,
    targetAcademicYearId,
    targetClassId,
    feeStructureId,
    termId,
  ) {
    try {
      const supabaseClient = window.supabaseClient || window.supabaseClient;

      // 1. Get target class details
      const { data: targetClass, error: targetClassErr } = await supabaseClient
        .from("classes")
        .select("id, name")
        .eq("id", targetClassId)
        .single();

      if (targetClassErr || !targetClass)
        throw new Error("Target class not found.");

      function extractGradeNumber(className) {
        const match = className.match(/(\d+)/);
        return match ? parseInt(match[0]) : null;
      }

      const targetGrade = extractGradeNumber(targetClass.name);

      // 2. Get student IDs, school IDs, and current classes
      const { data: sourceEnrollments, error: fetchErr } = await supabaseClient
        .from("student_enrollments")
        .select("student_id, school_id, classes(name)")
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

      // 4. Fetch fee structure details & validate compatibility
      const { data: feeStruct, error: feeStructErr } = await supabaseClient
        .from("fee_structures")
        .select("total_amount, class_id")
        .eq("id", feeStructureId)
        .single();

      if (feeStructErr || !feeStruct)
        throw new Error("Selected fee structure not found.");

      if (feeStruct.class_id && feeStruct.class_id !== targetClassId) {
        showToast(
          `Invalid fee structure! The selected fee structure is not assigned to ${targetClass.name}.`,
          "error",
        );
        return;
      }

      // Fetch matching fee structure breakdown items
      const { data: feeItems, error: itemsErr } = await supabaseClient
        .from("fee_structure_items")
        .select("id, fee_name, amount")
        .eq("fee_structure_id", feeStructureId);

      if (itemsErr) throw itemsErr;

      for (const enr of sourceEnrollments) {
        // A. Check if an enrollment record already exists for this student in the *new* academic year & 1st term
        const { data: existingEnr, error: checkErr } = await supabaseClient
          .from("student_enrollments")
          .select("id")
          .eq("student_id", enr.student_id)
          .eq("academic_year_id", targetAcademicYearId)
          .eq("term_id", termId)
          .maybeSingle();

        if (checkErr) throw checkErr;

        if (existingEnr) {
          // If already enrolled in the new year/term, update it
          const { error: updateErr } = await supabaseClient
            .from("student_enrollments")
            .update({
              class_id: targetClassId,
              enrollment_status: "Promoted",
            })
            .eq("id", existingEnr.id);

          if (updateErr) throw updateErr;
        } else {
          // Otherwise, insert a brand new enrollment record for the new academic year
          const { error: insertErr } = await supabaseClient
            .from("student_enrollments")
            .insert({
              school_id: enr.school_id,
              student_id: enr.student_id,
              class_id: targetClassId,
              academic_year_id: targetAcademicYearId,
              term_id: termId,
              enrollment_status: "Promoted",
            });

          if (insertErr) throw insertErr;
        }

        // B. Update student's primary class and academic year reference in `students` table
        const { error: studentUpdateErr } = await supabaseClient
          .from("students")
          .update({
            class_id: targetClassId,
            academic_year_id: targetAcademicYearId,
          })
          .eq("id", enr.student_id);

        if (studentUpdateErr) {
          console.warn(
            "Could not update student table references:",
            studentUpdateErr.message,
          );
        }

        // C. Insert into `student_fees` for the new academic year / 1st semester
        const { error: feeInsertErr } = await supabaseClient
          .from("student_fees")
          .insert({
            school_id: enr.school_id,
            student_id: enr.student_id,
            class_id: targetClassId,
            academic_year_id: targetAcademicYearId,
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
        `Successfully promoted ${sourceEnrollments.length} student(s) to the new academic year (1st Semester)!`,
        "success",
      );
      if (typeof loadStudentEnrollments === "function") {
        loadStudentEnrollments();
      }
    } catch (err) {
      console.error("Yearly promotion execution failed:", err);
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
      const supabaseClient = window.supabaseClient || window.supabaseClient;
      const { error: rpcError } = await supabaseClient.rpc(
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
      const supabaseClient = window.supabaseClient || window.supabaseClient;
      const { error: rpcError } = await supabaseClient.rpc(
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
      openModal();

      try {
        const supabaseClient = window.supabaseClient || window.supabaseClient;

        // Find 2nd Semester term ID
        const { data: termData, error: termErr } = await supabaseClient
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
        const { data: currentEnrollments, error: enrollErr } =
          await supabaseClient
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
        const { data: feesData, error: feeErr } = await supabaseClient
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
      openModal();

      try {
        const supabaseClient = window.supabaseClient || window.supabaseClient;

        // Fetch selected enrollments to get school_id and old academic_year_id
        const { data: currentEnrollments, error: enrollErr } =
          await supabaseClient
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
          supabaseClient
            .from("academic_years")
            .select("id, year_label")
            .eq("school_id", schoolId),
          supabaseClient
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
      [
        ["filterAcademicYear", "All academic years"],
        ["filterSemester", "All semesters"],
        ["filterStatus", "All statuses"],
        ["filterClass", "All classes"],
      ].forEach(([id, label]) => window.populateEnrollmentFilter(id, [], label));
      const resultCount = document.getElementById("enrollmentResultCount");
      if (resultCount) resultCount.textContent = "0 enrollments";
      window.updateEnrollmentSelectionState();
      return;
    }

    window.populateEnrollmentFilter(
      "filterAcademicYear",
      enrollments.map((enr) => enr.academic_years?.year_label || "N/A"),
      "All academic years",
    );
    window.populateEnrollmentFilter(
      "filterSemester",
      enrollments.map((enr) => enr.terms?.name || "N/A"),
      "All semesters",
    );
    window.populateEnrollmentFilter(
      "filterStatus",
      enrollments.map((enr) => enr.enrollment_status || "Normal"),
      "All statuses",
    );
    window.populateEnrollmentFilter(
      "filterClass",
      enrollments.map((enr) => enr.classes?.name || "N/A"),
      "All classes",
    );

    // 2. Map all rows into a single HTML string in memory
    const rowsHTML = enrollments
      .map((enr) => {
        const studentName = enr.profiles?.full_name || "Unknown Student";
        const enrollmentStatus = enr.enrollment_status || "Normal";
        const className = enr.classes?.name || "N/A";
        const academicYearName = enr.academic_years?.year_label || "N/A";
        const termName = enr.terms?.name || "N/A";
        const searchText = `${studentName} ${className} ${academicYearName} ${termName} ${enrollmentStatus}`;
        const statusClass = enrollmentStatus
          .toLowerCase()
          .replace(/[^a-z0-9_-]/g, "-");

        return `
        <tr
          data-enrollment-row
          data-search="${escapeHtml(searchText.toLowerCase())}"
          data-year="${escapeHtml(academicYearName)}"
          data-semester="${escapeHtml(termName)}"
          data-status="${escapeHtml(enrollmentStatus)}"
          data-class-name="${escapeHtml(className)}"
        >
          <td>
            <input 
              type="checkbox" 
              class="student-checkbox" 
              value="${escapeHtml(enr.id)}"
            />
          </td>
          <td>${escapeHtml(studentName)}</td>
          <td>${escapeHtml(className)}</td>
          <td>${escapeHtml(academicYearName)}</td>
          <td>${escapeHtml(termName)}</td>
          <td><span class="status-badge ${statusClass}">${escapeHtml(enrollmentStatus)}</span></td>
        </tr>
      `;
      })
      .join("");

    // 3. Inject everything into the table in ONE single operation
    tbody.innerHTML = rowsHTML;
    window.applyEnrollmentFilters();
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
