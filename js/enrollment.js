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
      .map((cb) => cb.value);

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
      selectAllCheckbox.indeterminate =
        someVisibleChecked && !allVisibleChecked;
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
    document
      .getElementById(id)
      ?.addEventListener(
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

        const { data: activeYear, error: yearErr } = await client
          .from("academic_years")
          .select("id, year_label")
          .eq("status", "Active")
          .eq("school_id", activeSchoolId)
          .maybeSingle();

        if (yearErr || !activeYear) {
          throw new Error("No active academic year found for this school.");
        }

        const { data: yearTerms, error: termErr } = await client
          .from("terms")
          .select("id, name")
          .eq("academic_year_id", activeYear.id)
          .eq("school_id", activeSchoolId);

        if (termErr) throw termErr;
        const isFirstTerm = (name) =>
          /\b(?:1(?:st)?|first|one|i)\b/i.test(name || "");
        const isSecondTerm = (name) =>
          /\b(?:2(?:nd)?|second|two|ii)\b/i.test(name || "");
        const firstTerms = (yearTerms || []).filter((term) =>
          isFirstTerm(term.name),
        );
        const secondTerms = (yearTerms || []).filter((term) =>
          isSecondTerm(term.name),
        );

        if (firstTerms.length !== 1) {
          throw new Error(
            "Could not identify exactly one 1st term for the active academic year.",
          );
        }
        if (secondTerms.length !== 1) {
          throw new Error(
            "Could not identify exactly one 2nd term for the active academic year.",
          );
        }
        const activeFirstTermId = firstTerms[0].id;
        const activeSecondTermId = secondTerms[0].id;

        const { data: sourceEnrollments, error: fetchErr } = await client
          .from("student_enrollments")
          .select(
            "id, student_id, school_id, academic_year_id, term_id, classes(name)",
          )
          .in("id", selectedEnrollmentIds);

        if (fetchErr) throw fetchErr;
        const enr = sourceEnrollments[0];

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

        const className = enr.classes?.name || "";
        const match = className.match(/(\d+)/);
        const grade = match ? parseInt(match[0]) : null;

        if (grade !== 9) {
          showToast("Selected student is not in Grade 9.", "error");
          closeModal();
          return;
        }

        const { data: classesData, error: classErr } = await client
          .from("classes")
          .select("id, name, capacity")
          .eq("school_id", activeSchoolId)
          .ilike("name", "%10%")
          .eq("status", "active");

        if (classErr) throw classErr;

        const { data: feesData, error: feeErr } = await client
          .from("fee_structures")
          .select(
            "id, total_amount, class_id, term_id, terms(name), classes(name)",
          )
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

        targetClassSelect.onchange = async () => {
          const classId = targetClassSelect.value;
          if (!classId) {
            targetFeeSelect.innerHTML = `<option value="">-- Select Target Class First --</option>`;
            targetFeeSelect.disabled = true;
            capacityWarning.textContent = "";
            return;
          }

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

      const { data: sourceEnrollments, error: fetchErr } = await supabaseClient
        .from("student_enrollments")
        .select("student_id")
        .in("id", enrollmentIds);

      if (fetchErr) throw fetchErr;

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

  document
    .getElementById("btnPromoteStudents")
    ?.addEventListener("click", async () => {
      const enrollmentIds = [...new Set(selectedEnrollmentIds || [])];
      if (enrollmentIds.length === 0) {
        showToast("Please select at least one enrollment record.", "info");
        return;
      }
      if (enrollmentIds.length !== selectedEnrollmentIds.length) {
        showToast(
          "The selection contains duplicate enrollment records.",
          "error",
        );
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
          const {
            data: { user },
            error: userError,
          } = await client.auth.getUser();
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
        if (!activeSchoolId)
          throw new Error("Active school could not be determined.");

        const { data: activeYear, error: yearError } = await client
          .from("academic_years")
          .select("id, year_label")
          .eq("school_id", activeSchoolId)
          .eq("status", "Active")
          .maybeSingle();
        if (yearError || !activeYear) {
          throw new Error(
            "Could not find one active academic year for this school.",
          );
        }

        const { data: yearTerms, error: termsError } = await client
          .from("terms")
          .select("id, name")
          .eq("school_id", activeSchoolId)
          .eq("academic_year_id", activeYear.id);
        if (termsError) throw termsError;

        const findTerm = (terms, termNumber) =>
          terms.filter((term) => {
            const name = (term.name || "").toLowerCase();
            return termNumber === 1
              ? /\b(?:1st|first|term\s*1|semester\s*1|one|i)\b/.test(name)
              : /\b(?:2nd|second|term\s*2|semester\s*2|two|ii)\b/.test(name);
          });
        const firstTerms = findTerm(yearTerms || [], 1);
        const secondTerms = findTerm(yearTerms || [], 2);
        if (firstTerms.length !== 1 || secondTerms.length !== 1) {
          throw new Error(
            "The active academic year must have exactly one first term and one second term.",
          );
        }
        const firstTermId = firstTerms[0].id;
        const secondTermId = secondTerms[0].id;

        const { data: sourceEnrollments, error: sourceError } = await client
          .from("student_enrollments")
          .select(
            "id, student_id, school_id, class_id, academic_year_id, term_id, classes(name)",
          )
          .in("id", enrollmentIds);
        if (sourceError) throw sourceError;
        if (
          !sourceEnrollments ||
          sourceEnrollments.length !== enrollmentIds.length
        ) {
          throw new Error(
            "Some selected enrollment records could not be found.",
          );
        }

        const studentIds = sourceEnrollments.map((enrollment) =>
          String(enrollment.student_id),
        );
        const sourceClassIds = [
          ...new Set(
            sourceEnrollments.map((enrollment) => String(enrollment.class_id)),
          ),
        ];
        const allFromFirstTerm = sourceEnrollments.every(
          (enrollment) =>
            String(enrollment.school_id) === String(activeSchoolId) &&
            String(enrollment.academic_year_id) === String(activeYear.id) &&
            String(enrollment.term_id) === String(firstTermId),
        );
        if (!allFromFirstTerm) {
          throw new Error(
            "Select students enrolled in the first term of this school's active academic year only.",
          );
        }
        if (sourceClassIds.length !== 1) {
          throw new Error(
            "Select students from one first-term class at a time.",
          );
        }
        if (new Set(studentIds).size !== studentIds.length) {
          throw new Error(
            "A student appears more than once in the selected enrollment records.",
          );
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
        const availableTargetClasses = (classesData || []).filter(
          (schoolClass) => {
            if (String(schoolClass.id) === sourceClassIds[0]) return false;
            const targetGrade = getGradeNumber(schoolClass.name);
            return !(
              sourceGrade !== null &&
              sourceGrade <= 9 &&
              targetGrade !== null &&
              targetGrade >= 10
            );
          },
        );

        const { data: feesData, error: feeErr } = await client
          .from("fee_structures")
          .select(
            "id, total_amount, class_id, academic_year_id, term_id, school_id, status, classes(name)",
          )
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

        targetClassSelect.onchange = async () => {
          const classId = targetClassSelect.value;

          if (!classId) {
            targetFeeSelect.value = "";
            targetFeeSelect.disabled = true;
            targetFeeSelect.innerHTML = `<option value="">-- Select a Target Class First --</option>`;
            capacityWarning.textContent = "";
            return;
          }

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
            capacityWarning.textContent =
              "Could not verify capacity. It will be checked again before saving.";
          } else if (
            capacity > 0 &&
            currentCount + sourceEnrollments.length > capacity
          ) {
            capacityWarning.textContent = `This class would exceed capacity (${currentCount + sourceEnrollments.length}/${capacity}).`;
          } else {
            capacityWarning.textContent =
              capacity > 0
                ? `Class occupancy after promotion: ${currentCount + sourceEnrollments.length} / ${capacity}.`
                : `Current second-term enrollment: ${currentCount}. No capacity limit is set.`;
          }

          const matchingFees = (feesData || []).filter(
            (fee) => String(fee.class_id) === String(classId),
          );
          if (matchingFees.length > 0) {
            targetFeeSelect.innerHTML = `<option value="">-- Select fee structure --</option>${matchingFees
              .map(
                (fee) =>
                  `<option value="${fee.id}">[${fee.classes?.name ?? "Class"}] Total: $${fee.total_amount}</option>`,
              )
              .join("")}`;
            targetFeeSelect.disabled = false;
          } else {
            targetFeeSelect.innerHTML = `<option value="">-- No active second-term fee structure for this class --</option>`;
            targetFeeSelect.value = "";
            targetFeeSelect.disabled = true;
          }
        };

        modalConfirm.onclick = async () => {
          const targetClassId = targetClassSelect.value;
          const feeStructureId = targetFeeSelect.value;

          if (!targetClassId || !feeStructureId) {
            capacityWarning.textContent =
              "Choose a target class and its second-term fee structure before confirming.";
            showToast(
              "Please select both a target class and a valid fee structure.",
              "info",
            );
            return;
          }

          capacityWarning.textContent =
            "Validating records and saving the promotion…";
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
        throw new Error(
          data?.message || "The promotion RPC returned an unsuccessful result.",
        );
      }

      const promotedCount = data.student_count ?? enrollmentIds.length;
      showToast(
        `Successfully promoted ${promotedCount} student(s) to 2nd Semester!`,
        "success",
      );
      if (typeof loadStudentEnrollments === "function")
        loadStudentEnrollments();
      return true;
    } catch (err) {
      const message =
        err?.message || "Unexpected error while promoting students.";
      console.error("Promotion RPC failed:", err);
      const status = document.getElementById("capacityWarning");
      if (status) status.textContent = `Promotion failed: ${message}`;
      showToast(`Promotion failed: ${message}`, "error");
      return false;
    }
  }

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
        const client = window.supabaseClient || supabaseClient;
        if (!client) throw new Error("Supabase client is not available.");

        let schoolId = window.currentSchoolId;
        if (!schoolId) {
          const { data: { user }, error: userError } = await client.auth.getUser();
          if (userError) throw userError;
          if (user) {
            const { data: profile, error: profileError } = await client
              .from("profiles")
              .select("school_id")
              .eq("id", user.id)
              .single();
            if (profileError) throw profileError;
            schoolId = profile?.school_id;
          }
        }
        if (!schoolId) throw new Error("Active school could not be determined.");

        const uniqueEnrollmentIds = [...new Set(selectedEnrollmentIds.map(String))];
        if (uniqueEnrollmentIds.length !== selectedEnrollmentIds.length) {
          throw new Error("The selection contains duplicate enrollment records.");
        }

        const { data: sourceRows, error: sourceError } = await client
          .from("student_enrollments")
          .select("id, student_id, school_id, academic_year_id, class_id, classes(name)")
          .in("id", uniqueEnrollmentIds);
        if (sourceError) throw sourceError;
        if (!sourceRows || sourceRows.length !== uniqueEnrollmentIds.length) {
          throw new Error("Some selected enrollment records could not be found.");
        }
        if (sourceRows.some((row) => String(row.school_id) !== String(schoolId))) {
          throw new Error("All selected students must belong to your school.");
        }
        if (new Set(sourceRows.map((row) => String(row.class_id))).size !== 1) {
          throw new Error("Select students from one source class at a time.");
        }
        if (new Set(sourceRows.map((row) => String(row.academic_year_id))).size !== 1) {
          throw new Error("Select students from one academic year at a time.");
        }
        if (new Set(sourceRows.map((row) => String(row.student_id))).size !== sourceRows.length) {
          throw new Error("A student can appear only once in this promotion.");
        }

        const { data: yearsData, error: yearsErr } = await client
          .from("academic_years")
          .select("id, year_label, status")
          .eq("school_id", schoolId)
          .order("year_label", { ascending: false });

        if (yearsErr || !yearsData)
          throw new Error("Could not fetch academic years.");

        const { data: termsData, error: termErr } = await client
          .from("terms")
          .select("id, name, academic_year_id")
          .eq("school_id", schoolId);

        if (termErr || !termsData) throw new Error("Could not fetch terms.");

        const isFirstTerm = (term) =>
          /(^|[^a-z0-9])(1(st)?|first|one|i)([^a-z0-9]|$)/i.test(term?.name || "");
        const firstSemesterTermIds = termsData.filter(isFirstTerm).map((term) => term.id);

        const { data: classesData, error: classErr } = await client
          .from("classes")
          .select("id, name, capacity")
          .eq("school_id", schoolId)
          .eq("status", "active");

        if (classErr) throw classErr;

        let feesData = [];
        if (firstSemesterTermIds.length > 0) {
          const { data, error: feeErr } = await client
            .from("fee_structures")
            .select(
              "id, total_amount, class_id, academic_year_id, term_id, classes(name)",
            )
            .eq("school_id", schoolId)
            .in("term_id", firstSemesterTermIds)
            .eq("status", "Active");
          if (feeErr) throw feeErr;
          feesData = data || [];
        }

        modalConfirm.style.display = "inline-block";
        modalBody.innerHTML = `
      <p style="margin-bottom: 10px; color: #555;">
        Promoting <b>${sourceRows.length}</b> student(s) from <b>${sourceRows[0].classes?.name || "one class"}</b> to a new academic year (1st Semester).
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

        const updateFeeOptions = () => {
          const selectedYearId = targetAcademicYearSelect.value;
          const selectedClassId = targetClassSelect.value;

          if (!selectedYearId || !selectedClassId) {
            targetFeeSelect.innerHTML = `<option value="">-- Select Target Year & Class First --</option>`;
            targetFeeSelect.disabled = true;
            return;
          }

          const matchingTerms = termsData.filter(
            (t) =>
              String(t.academic_year_id) === String(selectedYearId) &&
              isFirstTerm(t),
          );

          if (matchingTerms.length !== 1) {
            targetFeeSelect.innerHTML = `<option value="">-- Expected exactly one 1st Semester term for this year --</option>`;
            targetFeeSelect.disabled = true;
            return;
          }
          const targetTerm = matchingTerms[0];

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

        targetClassSelect.onchange = async () => {
          const classId = targetClassSelect.value;

          if (!classId) {
            capacityWarning.textContent = "";
            updateFeeOptions();
            return;
          }

          const { count, error: countErr } = await client
            .from("student_enrollments")
            .select("*", { count: "exact", head: true })
            .eq("school_id", schoolId)
            .eq("class_id", classId)
            .eq("academic_year_id", targetAcademicYearSelect.value)
            .in("term_id", firstSemesterTermIds);

          const selectedOption = targetClassSelect.selectedOptions[0];
          const capacity = parseInt(selectedOption.getAttribute("data-capacity"), 10) || 0;

          if (!countErr && capacity > 0 && count + sourceRows.length > capacity) {
            capacityWarning.textContent = `⚠️ Warning: Target class has reached or exceeded its capacity (${count}/${capacity}).`;
          } else {
            capacityWarning.textContent = `Class occupancy in target year: ${count || 0} / ${capacity} available.`;
          }

          updateFeeOptions();
        };

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

          const matchingTerms = termsData.filter(
            (t) =>
              String(t.academic_year_id) === String(targetAcademicYearId) &&
              isFirstTerm(t),
          );

          if (matchingTerms.length !== 1) {
            showToast(
              "The selected academic year must have exactly one 1st Semester term.",
              "error",
            );
            return;
          }

          const originalText = modalConfirm.textContent;
          modalConfirm.disabled = true;
          modalConfirm.textContent = "Promoting...";
          modalConfirm.setAttribute("aria-busy", "true");
          capacityWarning.textContent = "Validating and saving the promotion…";
          try {
            const succeeded = await executeYearlyPromotion({
              client,
              enrollmentIds: uniqueEnrollmentIds,
              targetAcademicYearId,
              targetClassId,
              feeStructureId,
            });
            if (succeeded) closeModal();
          } finally {
            modalConfirm.disabled = false;
            modalConfirm.textContent = originalText;
            modalConfirm.removeAttribute("aria-busy");
          }
        };
      } catch (err) {
        console.error("Error setting up yearly promotion modal:", err);
        modalBody.innerHTML = `<p style="color: red;">Error: ${err.message}</p>`;
      }
    });

  async function executeYearlyPromotion({
    client,
    enrollmentIds,
    targetAcademicYearId,
    targetClassId,
    feeStructureId,
  }) {
    try {
      const { data, error } = await client.rpc(
        "promote_students_to_new_academic_year",
        {
          p_enrollment_ids: enrollmentIds,
          p_target_academic_year_id: targetAcademicYearId,
          p_target_class_id: targetClassId,
          p_fee_structure_id: feeStructureId,
        },
      );
      if (error) throw error;
      if (!data?.success) throw new Error(data?.message || "The promotion RPC failed.");

      showToast(`Successfully promoted ${data.student_count ?? enrollmentIds.length} student(s) to the new academic year (1st Semester)!`, "success");
      if (typeof loadStudentEnrollments === "function") {
        loadStudentEnrollments();
      }
      return true;
    } catch (err) {
      console.error("Yearly promotion execution failed:", err);
      const message = err?.message || "Unexpected error while promoting students.";
      const status = document.getElementById("capacityWarning");
      if (status) status.textContent = `Promotion failed: ${message}`;
      showToast(`Promotion failed: ${message}`, "error");
      return false;
    }
  }
  async function executeStatusChange(enrollmentIds, newStatus) {
    try {
      const { error } = await supabaseClient
        .from("student_enrollments")
        .update({ enrollment_status: newStatus })
        .in("id", enrollmentIds);

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

  async function executeSemesterMove(studentIds, feeStructureId, confirmButton) {
    const originalText = confirmButton?.textContent;
    try {
      const client = window.supabaseClient || supabaseClient;
      if (!client) throw new Error("Supabase client is not available.");
      if (confirmButton) {
        confirmButton.disabled = true;
        confirmButton.textContent = "Moving...";
        confirmButton.setAttribute("aria-busy", "true");
      }
      const { data, error: rpcError } = await client.rpc(
        "promote_students_to_semester",
        {
          p_student_ids: studentIds,
          p_fee_structure_id: feeStructureId,
        },
      );

      if (rpcError) throw rpcError;
      if (!data?.success) throw new Error(data?.message || "The semester move failed.");

      showToast(
        `Successfully moved ${data.student_count ?? studentIds.length} student(s) to the 2nd semester!`,
        "success",
      );
      if (typeof loadStudentEnrollments === "function")
        loadStudentEnrollments();
      return true;
    } catch (err) {
      console.error("Error executing semester move:", err.message);
      showToast(`Failed to move students: ${err.message}`, "error");
      return false;
    } finally {
      if (confirmButton) {
        confirmButton.disabled = false;
        confirmButton.textContent = originalText;
        confirmButton.removeAttribute("aria-busy");
      }
    }
  }

  async function executeNewYearMove(
    schoolId,
    studentIds,
    oldAcademicYearId,
    newAcademicYearId,
    newTermId,
    confirmButton,
  ) {
    const originalText = confirmButton?.textContent;
    try {
      const client = window.supabaseClient || supabaseClient;
      if (!client) throw new Error("Supabase client is not available.");
      if (confirmButton) {
        confirmButton.disabled = true;
        confirmButton.textContent = "Moving...";
        confirmButton.setAttribute("aria-busy", "true");
      }
      const { data, error: rpcError } = await client.rpc(
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
      if (!data?.success) throw new Error(data?.message || "The academic-year move failed.");

      showToast(
        `Successfully moved ${data.student_count ?? studentIds.length} student(s) to the new academic year!`,
        "success",
      );
      if (typeof loadStudentEnrollments === "function")
        loadStudentEnrollments();
      return true;
    } catch (err) {
      console.error("Error executing new year move:", err.message);
      showToast(`Failed to move students to new year: ${err.message}`, "error");
      return false;
    } finally {
      if (confirmButton) {
        confirmButton.disabled = false;
        confirmButton.textContent = originalText;
        confirmButton.removeAttribute("aria-busy");
      }
    }
  }

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
        const client = window.supabaseClient || supabaseClient;
        if (!client) throw new Error("Supabase client is not available.");
        const enrollmentIds = [...new Set(selectedEnrollmentIds.map(String))];
        if (enrollmentIds.length !== selectedEnrollmentIds.length) {
          throw new Error("The selected enrollments contain duplicates.");
        }

        let schoolId = window.currentSchoolId;
        if (!schoolId) {
          const { data: { user }, error: userError } = await client.auth.getUser();
          if (userError) throw userError;
          if (user) {
            const { data: profile, error: profileError } = await client
              .from("profiles")
              .select("school_id")
              .eq("id", user.id)
              .single();
            if (profileError) throw profileError;
            schoolId = profile?.school_id;
          }
        }
        if (!schoolId) throw new Error("Active school could not be determined.");

        const { data: currentEnrollments, error: enrollErr } = await client
          .from("student_enrollments")
          .select("id, school_id, academic_year_id, term_id, student_id, class_id, classes(name)")
          .in("id", enrollmentIds);
        if (enrollErr) throw enrollErr;
        if (!currentEnrollments || currentEnrollments.length !== enrollmentIds.length) {
          throw new Error("Some selected enrollment records could not be found.");
        }
        if (currentEnrollments.some((row) => String(row.school_id) !== String(schoolId))) {
          throw new Error("All selected students must belong to your school.");
        }
        if (new Set(currentEnrollments.map((row) => String(row.class_id))).size !== 1) {
          throw new Error("Select students from one class at a time.");
        }
        if (new Set(currentEnrollments.map((row) => String(row.academic_year_id))).size !== 1) {
          throw new Error("Select students from one academic year at a time.");
        }
        if (new Set(currentEnrollments.map((row) => String(row.student_id))).size !== currentEnrollments.length) {
          throw new Error("A student can appear only once in this semester move.");
        }
        const sourceYearId = currentEnrollments[0].academic_year_id;
        const { data: yearTerms, error: termsError } = await client
          .from("terms")
          .select("id, name")
          .eq("school_id", schoolId)
          .eq("academic_year_id", sourceYearId);
        if (termsError) throw termsError;
        const isFirstTerm = (term) => /(^|[^a-z0-9])(1(st)?|first|one|i)([^a-z0-9]|$)/i.test(term?.name || "");
        const isSecondTerm = (term) => /(^|[^a-z0-9])(2(nd)?|second|two|ii)([^a-z0-9]|$)/i.test(term?.name || "");
        const firstTerms = (yearTerms || []).filter(isFirstTerm);
        const secondTerms = (yearTerms || []).filter(isSecondTerm);
        if (firstTerms.length !== 1 || secondTerms.length !== 1) {
          throw new Error("The source academic year must have exactly one first and one second term.");
        }
        if (currentEnrollments.some((row) => String(row.term_id) !== String(firstTerms[0].id))) {
          throw new Error("Select students enrolled in the first term of the same academic year.");
        }
        const studentIds = currentEnrollments.map((row) => row.student_id);

        const classId = currentEnrollments[0].class_id;
        const { data: feesData, error: feeErr } = await client
          .from("fee_structures")
          .select("id, total_amount, class_id, academic_year_id, term_id, school_id, status, classes(name)")
          .eq("school_id", schoolId)
          .eq("class_id", classId)
          .eq("academic_year_id", sourceYearId)
          .eq("term_id", secondTerms[0].id)
          .eq("status", "Active");

        if (feeErr) throw feeErr;

        modalConfirm.style.display = "inline-block";
        modalBody.innerHTML = `
      <p style="margin-bottom: 10px; color: #555;">Moving <b>${currentEnrollments.length}</b> student(s) from <b>${currentEnrollments[0].classes?.name || "their current class"}</b> to the 2nd Semester.</p>
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
          const succeeded = await executeSemesterMove(studentIds, feeId, modalConfirm);
          if (succeeded) closeModal();
        };
      } catch (err) {
        console.error("Error loading modal data:", err);
        modalBody.innerHTML = `<p style="color: red;">Failed to load form options: ${err.message}</p>`;
      }
    });

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
        const client = window.supabaseClient || supabaseClient;
        if (!client) throw new Error("Supabase client is not available.");
        const enrollmentIds = [...new Set(selectedEnrollmentIds.map(String))];
        if (enrollmentIds.length !== selectedEnrollmentIds.length) {
          throw new Error("The selected enrollments contain duplicates.");
        }

        let schoolId = window.currentSchoolId;
        if (!schoolId) {
          const { data: { user }, error: userError } = await client.auth.getUser();
          if (userError) throw userError;
          if (user) {
            const { data: profile, error: profileError } = await client
              .from("profiles")
              .select("school_id")
              .eq("id", user.id)
              .single();
            if (profileError) throw profileError;
            schoolId = profile?.school_id;
          }
        }
        if (!schoolId) throw new Error("Active school could not be determined.");

        const { data: currentEnrollments, error: enrollErr } = await client
          .from("student_enrollments")
          .select("id, school_id, academic_year_id, student_id, class_id, classes(name)")
          .in("id", enrollmentIds);
        if (enrollErr) throw enrollErr;
        if (!currentEnrollments || currentEnrollments.length !== enrollmentIds.length) {
          throw new Error("Some selected enrollment records could not be found.");
        }
        if (currentEnrollments.some((row) => String(row.school_id) !== String(schoolId))) {
          throw new Error("All selected students must belong to your school.");
        }
        if (new Set(currentEnrollments.map((row) => String(row.class_id))).size !== 1) {
          throw new Error("Select students from one source class at a time.");
        }
        if (new Set(currentEnrollments.map((row) => String(row.academic_year_id))).size !== 1) {
          throw new Error("Select students from one source academic year at a time.");
        }
        if (new Set(currentEnrollments.map((row) => String(row.student_id))).size !== currentEnrollments.length) {
          throw new Error("A student can appear only once in this rollover.");
        }

        const oldAcademicYearId = currentEnrollments[0].academic_year_id;
        const studentIds = currentEnrollments.map((row) => row.student_id);

        const [{ data: academicYears, error: yearsError }, { data: terms, error: termsError }] = await Promise.all([
          client
            .from("academic_years")
            .select("id, year_label")
            .eq("school_id", schoolId),
          client
            .from("terms")
            .select("id, name, academic_year_id")
            .eq("school_id", schoolId),
        ]);

        if (yearsError) throw yearsError;
        if (termsError) throw termsError;
        if (!academicYears || academicYears.length === 0)
          throw new Error("No academic years found.");
        const schoolTerms = terms || [];
        const isFirstTerm = (term) => /(^|[^a-z0-9])(1(st)?|first|one|i)([^a-z0-9]|$)/i.test(term?.name || "");
        const eligibleYears = academicYears.filter((year) =>
          String(year.id) !== String(oldAcademicYearId) &&
          schoolTerms.filter((term) => String(term.academic_year_id) === String(year.id) && isFirstTerm(term)).length === 1,
        );
        if (eligibleYears.length === 0) {
          throw new Error("No other school academic year with exactly one first term is available.");
        }

        modalConfirm.style.display = "inline-block";
        modalBody.innerHTML = `
      <p style="margin-bottom: 10px; color: #555;">Select the target Academic Year for rollover:</p>
      <div style="margin-bottom: 15px;">
        <label for="newAcademicYearSelect">Target Academic Year:</label>
        <select id="newAcademicYearSelect" class="form-control">
          <option value="">-- Select Academic Year --</option>
          ${eligibleYears.map((ay) => `<option value="${ay.id}">${ay.year_label}</option>`).join("")}
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
          const targetTerms = schoolTerms.filter(
            (term) => String(term.academic_year_id) === String(newAcademicYearId) && isFirstTerm(term),
          );
          if (targetTerms.length !== 1) {
            showToast("The target academic year must have exactly one first term.", "error");
            return;
          }
          const succeeded = await executeNewYearMove(
            schoolId,
            studentIds,
            oldAcademicYearId,
            newAcademicYearId,
            targetTerms[0].id,
            modalConfirm,
          );
          if (succeeded) closeModal();
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
      ].forEach(([id, label]) =>
        window.populateEnrollmentFilter(id, [], label),
      );
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

document.addEventListener("DOMContentLoaded", loadStudentEnrollments);
