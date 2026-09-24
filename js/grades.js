let activeAcademicYearId = null;
let activeTermId = null;
let activeAssessment = null;
let currentGradeSession = null;
let currentEditGradeId = null;

document.addEventListener("DOMContentLoaded", async () => {
  initGradeModalEventListeners();
  initGradeFormListeners();

  await loadAcademicContext();
  await populateClassOptions();
});

function openModal(modalEl) {
  if (!modalEl) return;
  modalEl.style.display = "flex";
  if (typeof lockBodyScroll === "function") lockBodyScroll();
}

function closeModal(modalEl) {
  if (!modalEl) return;
  modalEl.style.display = "none";
  if (typeof unLockBodyScroll === "function") unLockBodyScroll();
}

let isGradeModalListenersInitialized = false;

function initGradeModalEventListeners() {
  if (isGradeModalListenersInitialized) return;
  isGradeModalListenersInitialized = true;

  const gradeModal = document.getElementById("gradeModal");
  const enterGradeModal = document.getElementById("enterGradeModal");
  const viewGradeModal = document.getElementById("viewGradeModal");
  const editGradeModal = document.getElementById("editGradeModal");

  document.getElementById("addGrade")?.addEventListener("click", async () => {
    resetGradeModal();
    if (typeof openModal === "function") openModal(gradeModal);

    await populateClassOptions();
    await loadAssessmentCategories();
  });

  document
    .getElementById("closeGradeModal")
    .addEventListener("click", () => closeModal(gradeModal));
  document
    .getElementById("cancelGradeModal")
    .addEventListener("click", () => closeModal(gradeModal));

  // 3. Load Students Action (Proceed from Setup Modal to Enter Grade Modal)
  document
    .getElementById("loadEnterGrade")
    ?.addEventListener("click", handleLoadStudents);

  // 4. Enter Grade Modal Close Actions
  document
    .getElementById("closeEnterGradeModal")
    ?.addEventListener("click", () => closeModal(enterGradeModal));
  document
    .getElementById("cancelEnterGradeModal")
    ?.addEventListener("click", () => closeModal(enterGradeModal));

  // 5. View Grade Modal Close Actions
  document
    .getElementById("closeViewGradeModal")
    ?.addEventListener("click", () => closeModal(viewGradeModal));
  document
    .getElementById("closeViewBtn")
    ?.addEventListener("click", () => closeModal(viewGradeModal));

  // 6. Edit Grade Modal Close Actions
  document
    .getElementById("closeEditGradeModal")
    ?.addEventListener("click", () => closeModal(editGradeModal));
  document
    .getElementById("cancelEditGradeModal")
    ?.addEventListener("click", () => closeModal(editGradeModal));

  // 7. Table Row Actions (View & Edit Delegation)
  document.addEventListener("click", (e) => {
    const viewBtn = e.target.closest(".view");
    const editBtn = e.target.closest(".edit");

    if (viewBtn) {
      const gradeId =
        viewBtn.dataset.gradeId || viewBtn.closest("tr")?.dataset.gradeId;

      if (gradeId) {
        if (typeof handleViewGrades === "function") {
          handleViewGrades(gradeId);
        }
        if (typeof openModal === "function") openModal(viewGradeModal);
      }
    }

    if (editBtn) {
      const gradeId =
        editBtn.dataset.gradeId || editBtn.closest("tr")?.dataset.gradeId;

      if (gradeId) {
        if (typeof handleEditGrades === "function") {
          handleEditGrades(gradeId);
        }
        if (typeof openModal === "function") openModal(editGradeModal);
      }
    }
  });

  // 8. Outside Backdrop Click to Close Modals safely
  window.addEventListener("click", (e) => {
    if (e.target === gradeModal) closeModal(gradeModal);
    if (e.target === enterGradeModal) closeModal(enterGradeModal);
    if (e.target === viewGradeModal) closeModal(viewGradeModal);
    if (e.target === editGradeModal) closeModal(editGradeModal);
  });
}

function resetGradeModal() {
  // 1. Reset Form Inputs
  const form =
    document.getElementById("gradeForm") ||
    document.getElementById("gradeSetupForm");
  if (form) form.reset();

  // 2. Reset Class Dropdown (Checking both single and plural ID variants)
  const classSelect =
    document.getElementById("gradesClassSelect") ||
    document.getElementById("gradeClassSelect");
  if (classSelect) {
    classSelect.value = "";
  }

  // 3. Reset & Disable Subject Dropdown
  const subjectSelect = document.getElementById("gradeSubjectSelect");
  if (subjectSelect) {
    subjectSelect.innerHTML = `<option value="">Select Subject</option>`;
    subjectSelect.disabled = true;
  }

  // 4. Reset Category Dropdown if populated dynamically
  const categorySelect = document.getElementById(
    "gradeAssessmentCategorySelect",
  );
  if (categorySelect) {
    categorySelect.value = "";
  }
}

function initGradeFormListeners() {
  const classSelect =
    document.getElementById("gradesClassSelect") ||
    document.getElementById("gradeClassSelect");

  // Use dataset flag attached to element to prevent duplicate handlers safely
  if (classSelect && !classSelect.dataset.listenerBound) {
    classSelect.addEventListener("change", (e) => {
      handleClassSelectChange(e.target.value);
    });
    classSelect.dataset.listenerBound = "true";
  }
}

async function populateClassOptions() {
  const classSelect = document.getElementById("gradesClassSelect");
  if (!classSelect) return;

  // Preserve existing user choice if re-rendering options
  const selectedValue = classSelect.value;

  try {
    const client = window.supabaseClient || supabaseClient;
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) return;

    // Check Role
    const { data: profile } = await client
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const role = profile?.role;
    let classesList = [];

    if (role === "admin") {
      const { data: allClasses, error } = await client
        .from("classes")
        .select("id, name")
        .order("name", { ascending: true });
      if (error) throw error;
      classesList = allClasses || [];
    } else {
      const { data: assignments, error } = await client
        .from("teacher_assignments")
        .select("class_id, classes(id, name)")
        .eq("teacher_id", user.id);

      if (error) throw error;

      // Extract unique classes
      classesList = [
        ...new Map(
          (assignments || [])
            .filter((a) => a.classes)
            .map((a) => [a.classes.id, a.classes]),
        ).values(),
      ];

      // Sort teacher classes alphabetically A-Z
      classesList.sort((a, b) => a.name.localeCompare(b.name));
    }

    classSelect.innerHTML = `<option value="">Select Class</option>`;

    classesList.forEach((cls) => {
      const opt = document.createElement("option");
      opt.value = cls.id;
      opt.textContent = cls.name;
      classSelect.appendChild(opt);
    });

    // Re-apply selected value if it still exists in options
    if (selectedValue) {
      classSelect.value = selectedValue;
    }

    // Safely attach listeners only if flag isn't set, or call once during page init
    if (
      !classSelect.dataset.listenersBound &&
      typeof initGradeFormListeners === "function"
    ) {
      initGradeFormListeners();
      classSelect.dataset.listenersBound = "true";
    }
  } catch (err) {
    console.error("Error populating class options:", err);
    classSelect.innerHTML = `<option value="">Error loading classes</option>`;
  }
}

async function handleClassSelectChange(classId) {
  const subjectSelect = document.getElementById("gradeSubjectSelect");
  if (!subjectSelect) return;

  // Reset UI state
  subjectSelect.innerHTML = `<option value="">Select Subject</option>`;
  subjectSelect.disabled = true;

  if (!classId) return;

  try {
    const client = window.supabaseClient || supabaseClient;
    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) return;

    const { data: profile } = await client
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const role = profile?.role;
    const subjectMap = new Map();

    if (role === "admin") {
      // 1. Fetch class-assigned subjects first
      const { data: assignedData, error: assignedErr } = await client
        .from("teacher_assignments")
        .select("subject_id, subjects(id, name)")
        .eq("class_id", classId);

      if (assignedErr) console.error("Admin subject query error:", assignedErr);

      (assignedData || []).forEach((item) => {
        if (item.subjects?.id) {
          subjectMap.set(item.subjects.id, item.subjects.name);
        }
      });

      // Fallback for Admins: If no assignments exist for this class, fetch all subjects
      if (subjectMap.size === 0) {
        const { data: allSubjects } = await client
          .from("subjects")
          .select("id, name")
          .order("name", { ascending: true });

        (allSubjects || []).forEach((s) => subjectMap.set(s.id, s.name));
      }
    } else {
      // 2. Fetch teacher-specific assignments for this class
      const { data: teacherData, error: teacherErr } = await client
        .from("teacher_assignments")
        .select("subject_id, subjects(id, name)")
        .eq("class_id", classId)
        .eq("teacher_id", user.id);

      if (teacherErr) console.error("Teacher subject query error:", teacherErr);

      (teacherData || []).forEach((item) => {
        if (item.subjects?.id) {
          subjectMap.set(item.subjects.id, item.subjects.name);
        }
      });
    }

    if (subjectMap.size === 0) {
      subjectSelect.innerHTML = `<option value="">No subjects assigned</option>`;
      return;
    }

    // Sort subjects alphabetically before appending
    const sortedSubjects = Array.from(subjectMap.entries()).sort((a, b) =>
      a[1].localeCompare(b[1]),
    );

    sortedSubjects.forEach(([subjectId, subjectName]) => {
      const opt = document.createElement("option");
      opt.value = subjectId;
      opt.textContent = subjectName;
      subjectSelect.appendChild(opt);
    });

    subjectSelect.disabled = false;
  } catch (err) {
    console.error("Error in handleClassSelectChange:", err);
    subjectSelect.innerHTML = `<option value="">Error loading subjects</option>`;
  }
}

let activeAssessmentCategories = [];

async function loadAssessmentCategories() {
  const assessmentSelect = document.getElementById(
    "gradeAssessmentCategorySelect",
  );
  if (!assessmentSelect) return;

  assessmentSelect.innerHTML = `<option value="">Select Category</option>`;

  try {
    const client = window.supabaseClient || supabaseClient;

    const { data: categories, error } = await client
      .from("assessment_categories")
      .select("id, name, marks")
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching assessment categories:", error);
      assessmentSelect.innerHTML = `<option value="">Error loading categories</option>`;
      return;
    }

    if (!categories || categories.length === 0) {
      assessmentSelect.innerHTML = `<option value="">No categories found</option>`;
      return;
    }

    // 1. Sync global state arrays
    activeAssessmentCategories = categories;
    window.activeAssessmentCategories = categories;
    window.activeCategories = categories; // Ensures fallback compatibility in handleLoadStudents

    // 2. Clear and populate options
    assessmentSelect.innerHTML = `<option value="">Select Category</option>`;

    categories.forEach((cat) => {
      const opt = document.createElement("option");
      opt.value = cat.id;

      // Store marks on dataset for instant client-side lookup
      if (cat.marks != null) {
        opt.dataset.marks = cat.marks;
      }

      const marksLabel = cat.marks ? ` (${cat.marks} Marks)` : "";
      opt.textContent = `${cat.name}${marksLabel}`;
      assessmentSelect.appendChild(opt);
    });
  } catch (err) {
    console.error("Error in loadAssessmentCategories:", err);
    assessmentSelect.innerHTML = `<option value="">Error loading categories</option>`;
  }
}

function populateAssessmentDropdown(assessments) {
  const select = document.getElementById("enterGradeModalCategoryPeriod");
  if (!select) return;

  if (!Array.isArray(assessments)) return;

  assessments.forEach((item) => {
    const opt = document.createElement("option");
    opt.value = item.id;
    opt.textContent = `${item.name} (${item.maximum_marks ?? 0} marks)`;

    if (item.maximum_marks != null) {
      opt.dataset.marks = item.maximum_marks;
    }

    select.appendChild(opt);
  });
}

async function loadAcademicContext() {
  try {
    const client = window.supabaseClient || supabaseClient;

    const [yearRes, termRes, assessmentRes] = await Promise.all([
      // 1. Fetch Active Academic Year
      client
        .from("academic_years")
        .select("id, year_label")
        .ilike("status", "Active")
        .maybeSingle(),

      // 2. Fetch Active Term
      client
        .from("terms")
        .select("id, name")
        .ilike("status", "Active")
        .maybeSingle(),

      // 3. Fetch Assessment Categories / Periods
      client
        .from("assessments")
        .select("id, name, maximum_marks")
        .ilike("status", "Active")
        .order("name", { ascending: true }),
    ]);

    // Handle Active Year
    if (yearRes.data) {
      window.activeAcademicYearId = yearRes.data.id;
      window.activeAcademicYearLabel = yearRes.data.year_label;
    }

    // Handle Active Term
    if (termRes.data) {
      window.activeTermId = termRes.data.id;
      window.activeTermLabel = termRes.data.name;
    }

    // Handle Active Assessment Periods
    if (assessmentRes.data) {
      window.activeAssessment = assessmentRes.data;
    }
  } catch (err) {
    console.error("Error loading academic context for grades:", err);
    if (typeof showToast === "function") {
      showToast("Failed to load active academic context.", "error");
    }
  }
}

async function handleLoadStudents(e) {
  if (e) e.preventDefault();

  // 1. Get Dropdown References
  const classSelect =
    document.getElementById("gradesClassSelect") ||
    document.getElementById("gradeClassSelect");
  const subjectSelect = document.getElementById("gradeSubjectSelect");
  const categorySelect = document.getElementById(
    "gradeAssessmentCategorySelect",
  );

  // 2. VALIDATION
  if (!classSelect || !classSelect.value || classSelect.value.trim() === "") {
    showToast("Please select a Class.", "error");
    return;
  }

  if (
    !subjectSelect ||
    !subjectSelect.value ||
    subjectSelect.value.trim() === ""
  ) {
    showToast("Please select a Subject.", "error");
    return;
  }

  if (
    !categorySelect ||
    !categorySelect.value ||
    categorySelect.value.trim() === ""
  ) {
    showToast("Please select an Assessment Category.", "error");
    return;
  }

  // 3. Extract Selected Values & Labels
  const classId = classSelect.value;
  const className = classSelect.options[classSelect.selectedIndex].text;

  const subjectId = subjectSelect.value;
  const subjectName = subjectSelect.options[subjectSelect.selectedIndex].text;

  const categoryId = categorySelect.value;
  const categoryName =
    categorySelect.options[categorySelect.selectedIndex].text;

  // 4. Resolve Active Assessment automatically from state
  const assessmentsList = window.activeAssessment || activeAssessment || [];
  const selectedAssessment =
    Array.isArray(assessmentsList) && assessmentsList.length > 0
      ? assessmentsList[0]
      : null;

  const assessmentId = selectedAssessment ? selectedAssessment.id : null;
  const assessmentName = selectedAssessment ? selectedAssessment.name : "";

  // 5. Dual-Cap Limit Calculation
  const categoriesList =
    window.activeCategories || window.activeAssessmentCategories || [];

  const selectedCategory = categoriesList.find((c) => c.id === categoryId);

  const selectedCategoryOption =
    categorySelect.options[categorySelect.selectedIndex];

  const periodMax =
    selectedAssessment && selectedAssessment.maximum_marks != null
      ? Number(selectedAssessment.maximum_marks)
      : Infinity;

  const categoryMax =
    selectedCategory && selectedCategory.marks != null
      ? Number(selectedCategory.marks)
      : selectedCategoryOption && selectedCategoryOption.dataset.marks
        ? Number(selectedCategoryOption.dataset.marks)
        : Infinity;

  const effectiveMaxMarks = Math.min(periodMax, categoryMax);
  const finalMaxMarks = isFinite(effectiveMaxMarks) ? effectiveMaxMarks : null;

  // 6. Set Active Session Data
  currentGradeSession = {
    classId,
    className,
    subjectId,
    subjectName,
    assessmentId, // Now automatically set from the active assessment
    assessmentName,
    categoryId,
    categoryName,
    maxMarks: finalMaxMarks,
    academicYearId: window.activeAcademicYearId || activeAcademicYearId || null,
    termId: window.activeTermId || activeTermId || null,
  };

  // 7. Populate Modal 2 Header Text
  const elYear = document.getElementById("enterGradeModalYear");
  const elTerm = document.getElementById("enterGradeModalTerm");
  const elClass = document.getElementById("enterGradeModalClass");
  const elSubject = document.getElementById("enterGradeModalSubject");
  const elCategory = document.getElementById("enterGradeModalCategory");
  const elPeriod = document.getElementById("enterGradeModalAssessmentPeriod");
  const elDate = document.getElementById("enterGradeModalDate");

  if (elClass) elClass.textContent = className;
  if (elSubject) elSubject.textContent = subjectName;
  if (elCategory) {
    elCategory.textContent = `${categoryName} (Max Allowed: ${finalMaxMarks ?? "-"} marks)`;
  }

  if (elPeriod) {
    const periodMarks =
      selectedAssessment?.maximum_marks != null
        ? ` (${selectedAssessment.maximum_marks} marks)`
        : "";
    elPeriod.textContent = assessmentName
      ? `${assessmentName}${periodMarks}`
      : "-";
  }
  if (elDate) {
    elDate.textContent = new Date().toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  if (elYear)
    elYear.textContent = window.activeAcademicYearLabel || "Active Year";
  if (elTerm) elTerm.textContent = window.activeTermLabel || "Active Term";

  // 8. Switch Modals & Load Roster
  const setupModal = document.getElementById("gradeModal");
  const enterGradeModal = document.getElementById("enterGradeModal");

  if (setupModal) closeModal(setupModal);
  if (enterGradeModal) openModal(enterGradeModal);

  await loadStudentRosterForGrades(classId, finalMaxMarks);
}

async function handleSaveGrades(e) {
  if (e) e.preventDefault();

  const saveBtn = document.getElementById("saveGradesBtn");

  if (!currentGradeSession) {
    showToast(
      "No active grade session found. Please re-load students.",
      "error",
    );
    return;
  }

  if (!currentGradeSession.assessmentId) {
    showToast(
      "Active assessment period not found. Please refresh and try again.",
      "error",
    );
    return;
  }

  // 1. Read status from dropdown if present in modal
  const statusSelect =
    document.getElementById("gradeStatusSelect") ||
    document.getElementById("enterGradeModalStatus");
  const selectedStatus = statusSelect
    ? statusSelect.value.toLowerCase()
    : "drafted";

  // 2. Gather scores from input fields in the table
  const scoreInputs = document.querySelectorAll(".student-score-input");
  const recordsPayload = [];
  let maxExceeded = false;

  scoreInputs.forEach((input) => {
    const studentId = input.dataset.studentId;
    const rawVal = input.value.trim();

    if (rawVal !== "") {
      const score = Number(rawVal);

      // Client-side validation against current grade session maxMarks limit
      if (
        currentGradeSession.maxMarks !== null &&
        score > currentGradeSession.maxMarks
      ) {
        maxExceeded = true;
        input.classList.add("is-invalid");
      } else {
        input.classList.remove("is-invalid");
      }

      recordsPayload.push({
        student_id: studentId,
        score: score,
      });
    }
  });

  if (maxExceeded) {
    showToast(
      `Some scores exceed the maximum limit of ${currentGradeSession.maxMarks} marks.`,
      "error",
    );
    return;
  }

  if (recordsPayload.length === 0) {
    showToast("Please enter at least one student score before saving.", "info");
    return;
  }

  // Disable button and show loading state
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";
  }

  try {
    const client = window.supabaseClient || supabaseClient;

    const targetAssessmentId = currentGradeSession.assessmentId || null;

    // 3. RPC Call with p_is_edit flag
    const { data: gradeId, error } = await client.rpc("save_grade_session", {
      p_class_id: currentGradeSession.classId,
      p_subject_id: currentGradeSession.subjectId,
      p_assessment_id: targetAssessmentId,
      p_category_id: currentGradeSession.categoryId,
      p_academic_year_id: currentGradeSession.academicYearId || null,
      p_term_id: currentGradeSession.termId || null,
      p_status: selectedStatus,
      p_records: recordsPayload,
      p_is_edit: false, // Flag as new creation session
    });

    if (error) throw error;

    showToast("Grades saved successfully!", "success");

    // Close Modal
    const enterGradeModal = document.getElementById("enterGradeModal");
    if (enterGradeModal && typeof closeModal === "function") {
      closeModal(enterGradeModal);
    }

    // Refresh main list view
    if (typeof loadGradesList === "function") {
      loadGradesList();
    }

    if (
      selectedStatus === "submitted" &&
      typeof window.sendNotification === "function" &&
      schoolId
    ) {
      await Promise.all(
        recordsPayload.map(async (record) => {
          return window.sendNotification(
            schoolId,
            record.student_id,
            "New Grade Posted",
            `Your grade has been updated (Score: ${record.score}/${currentGradeSession.maxMarks || "N/A"}).`,
            "academic",
          );
        }),
      );
    }
  } catch (err) {
    console.error("Error saving grade session:", err);

    // Friendly message for duplicate entries
    if (err.code === "23505" || err.message?.includes("already exists")) {
      showToast(
        "A grade session for this Subject, Category, and Period already exists!",
        "error",
      );
    } else {
      showToast(`Failed to save grades: ${err.message}`, "error");
    }
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save Grades";
    }
  }
}

// Attach event listener directly to the ID
document.addEventListener("DOMContentLoaded", () => {
  const saveBtn = document.getElementById("saveGradesBtn");
  if (saveBtn) {
    saveBtn.addEventListener("click", handleSaveGrades);
  }
});

async function loadStudentRosterForGrades(classId, maxMarks = null) {
  const tbody = document.getElementById("gradeRosterTableBody");
  if (!tbody) return;

  // Updated colspan to 3 to account for Student ID column
  tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding: 16px; color: #6b7280;">Loading student roster...</td></tr>`;

  try {
    const client = window.supabaseClient || supabaseClient;
    const cleanClassId = classId ? classId.trim() : "";

    // 1. Single Query: Fetch students AND their profile names
    const { data: students, error: studentErr } = await client
      .from("students")
      .select("id, student_id, class_id, profiles(full_name)")
      .eq("class_id", cleanClassId);

    if (studentErr) {
      console.error("Error fetching students:", studentErr);
      tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding: 16px; color: #dc2626;">Error loading students: ${studentErr.message}</td></tr>`;
      return;
    }

    if (!students || students.length === 0) {
      tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding: 16px; color: #dc2626;">No students found for this class in database.</td></tr>`;
      return;
    }

    const numericMax =
      maxMarks !== null && maxMarks !== undefined && !isNaN(maxMarks)
        ? Number(maxMarks)
        : null;

    // Use numericMax consistently
    const maxAttr = numericMax !== null ? `max="${numericMax}"` : "";
    const placeholderText =
      numericMax !== null ? `0 - ${numericMax}` : "Enter grade";

    // 3. Populate rows
    tbody.innerHTML = "";
    students.forEach((student) => {
      const studentCode = student.student_id || "N/A";
      const displayName = student.profiles?.full_name || "Unknown Student";

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td style="padding: 12px; font-weight: 600; color: #374151;">${studentCode}</td>
        <td style="padding: 12px; font-weight: 500; color: #111827;">${displayName}</td>
        <td class="form-group" style="padding: 12px;">
          <input 
            type="number" 
            class="student-score-input" 
            data-student-id="${student.id}" 
            placeholder="${placeholderText}" 
            min="0" 
            ${maxAttr}
            step="0.01"
            style="width: 100%;"
          />
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error("Roster exception for grades:", err);
    tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding: 16px; color: #dc2626;">Failed to load roster.</td></tr>`;
  }
}

async function loadGradesList() {
  const tbody = document.getElementById("gradesTableBody");
  if (!tbody) return;

  const searchQuery = (document.getElementById("gradeSearchInput")?.value || "")
    .toLowerCase()
    .trim();
  const selectedClass = document.getElementById(
    "gradeToolbarClassSelect",
  )?.value;
  const selectedSubject = document.getElementById(
    "gradeToolbarSubjectSelect",
  )?.value;
  const selectedCategory = document.getElementById(
    "gradeToolbarCategorySelect",
  )?.value;

  try {
    const client = window.supabaseClient || supabaseClient;

    // 1. Fetch grades table with foreign relations using correct column name (category_id)
    let query = client
      .from("grades")
      .select(
        `
        id,
        status,
        created_at,
        class_id,
        subject_id,
        category_id,
        assessment_categories ( name ),
        classes ( name ),
        subjects ( name )
      `,
      )
      .order("created_at", { ascending: false });

    // Apply active toolbar dropdown filters
    if (selectedClass) {
      query = query.eq("class_id", selectedClass);
    }
    if (selectedSubject) {
      query = query.eq("subject_id", selectedSubject);
    }
    if (selectedCategory) {
      query = query.eq("category_id", selectedCategory);
    }

    const { data: grades, error } = await query;

    if (error) throw error;

    if (!grades || grades.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; color: #888; padding: 20px;">
            No grade records found.
          </td>
        </tr>`;
      return;
    }

    // Filter by text search query across Category, Class, Subject, and Status
    const filteredGrades = grades.filter((item) => {
      if (!searchQuery) return true;

      const categoryName = (
        item.assessment_categories?.name || ""
      ).toLowerCase();
      const className = (item.classes?.name || "").toLowerCase();
      const subjectName = (item.subjects?.name || "").toLowerCase();
      const statusText = (item.status || "").toLowerCase();

      return (
        categoryName.includes(searchQuery) ||
        className.includes(searchQuery) ||
        subjectName.includes(searchQuery) ||
        statusText.includes(searchQuery)
      );
    });

    if (filteredGrades.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; color: #888; padding: 20px;">
            No grade records found matching filters.
          </td>
        </tr>`;
      return;
    }

    // 2. Build row elements (UNCHANGED HTML OUTPUT)
    tbody.innerHTML = filteredGrades
      .map((item) => {
        const gradeId = item.id || item.grade_id;

        if (!gradeId) {
          console.error("Missing ID for grade record:", item);
        }

        const rawStatus = (item.status || "draft").toLowerCase();
        const isDraft = rawStatus.includes("draft");

        const formattedDate = item.created_at
          ? new Date(item.created_at).toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
            })
          : "N/A";

        const categoryName = item.assessment_categories?.name || "N/A";
        const className = item.classes?.name || "N/A";
        const subjectName = item.subjects?.name || "N/A";
        const displayStatus = isDraft ? "Drafted" : "Submitted";

        const actionButtonHTML = isDraft
          ? `<button class="grades-actions-btn edit" title="Edit Grades" data-action="edit" data-grade-id="${gradeId}">
               <i class="fa-solid fa-pen"></i>
             </button>`
          : `<button class="grades-actions-btn view" title="View Grades" data-action="view" data-grade-id="${gradeId}">
               <i class="fa-solid fa-eye"></i>
             </button>`;

        return `
          <tr data-grade-id="${gradeId}">
            <td>${categoryName}</td>
            <td>${className}</td>
            <td>${subjectName}</td>
            <td>${formattedDate}</td>
            <td><span class="badge ${isDraft ? "badge-drafted" : "badge-submitted"}">${displayStatus}</span></td>
            <td>${actionButtonHTML}</td>
          </tr>
        `;
      })
      .join("");
  } catch (err) {
    console.error("Error loading grades list:", err);
    if (typeof showToast === "function") {
      showToast(`Failed to load grades: ${err.message}`, "error");
    }
  }
}

/**
 * Open and Populate View Grade Modal (Read-Only)
 */
async function handleViewGrades(gradeId) {
  if (!gradeId || gradeId === "undefined") {
    console.error("handleViewGrades received invalid gradeId:", gradeId);
    if (typeof showToast === "function") showToast("Invalid Grade ID", "error");
    return;
  }

  const skeletonText = `<span class="skeleton-text">Loading...</span>`;

  document.getElementById("viewModalClass").innerHTML = skeletonText;
  document.getElementById("viewModalSubject").innerHTML = skeletonText;
  document.getElementById("viewModalAssessment").innerHTML = skeletonText;
  document.getElementById("viewModalAssessmentPeriod").innerHTML = skeletonText;
  document.getElementById("viewModalAcademicYear").innerHTML = skeletonText;
  document.getElementById("viewModalSemester").innerHTML = skeletonText;
  document.getElementById("viewModalDate").innerHTML = skeletonText;

  const modal = document.getElementById("viewGradeModal");
  if (!modal) return;

  try {
    const client = window.supabaseClient || supabaseClient;

    const { data: grade, error } = await client
      .from("grades")
      .select(
        `
        id,
        status,
        created_at,
        assessment_categories ( name ),
        assessments ( name ),
        academic_years ( year_label ),
        terms ( name ),
        classes ( name ),
        subjects ( name ),     
        grade_records (
          id,
          student_id,
          score,
          students (
            id, student_id,
            profiles ( full_name )
          )
        )
      `,
      )
      .eq("id", gradeId)
      .single();

    if (error) throw error;

    // Helper for safe text escaping
    const escapeHtml = (str) =>
      String(str ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    // Populate header details
    document.getElementById("viewModalClass").textContent =
      grade.classes?.name || "-";
    document.getElementById("viewModalSubject").textContent =
      grade.subjects?.name || "-";
    document.getElementById("viewModalAssessment").textContent =
      grade.assessment_categories?.name || "-";
    document.getElementById("viewModalAssessmentPeriod").textContent =
      grade.assessments?.name || "-";
    document.getElementById("viewModalAcademicYear").textContent =
      grade.academic_years?.year_label || "-";
    document.getElementById("viewModalSemester").textContent =
      grade.terms?.name || "-";

    document.getElementById("viewModalDate").textContent = grade.created_at
      ? new Date(grade.created_at).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : "-";

    // Populate student table rows
    const tbody = document.getElementById("viewGradeTableBody");
    const records = grade.grade_records || [];

    if (records.length === 0) {
      // Fixed: colspan changed to 3 to match the table columns
      tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: #888;">No student marks recorded.</td></tr>`;
    } else {
      // Fixed: HTML-escaped output to prevent XSS attacks
      tbody.innerHTML = records
        .map((rec) => {
          const idDisplay = escapeHtml(rec.students?.student_id ?? "-");
          const studentName = escapeHtml(
            rec.students?.profiles?.full_name || "-",
          );
          const scoreDisplay = escapeHtml(rec.score ?? "-");

          return `
            <tr>
              <td>${idDisplay}</td>
              <td>${studentName}</td>
              <td><p>${scoreDisplay}</p></td>
            </tr>`;
        })
        .join("");
    }

    openModal(modal);
  } catch (err) {
    console.error("Error opening view modal:", err);
    if (typeof showToast === "function")
      showToast("Failed to view grade details", "error");
  }
}
/**
 * Open and Populate Edit Grade Modal (Editable)
 */
async function handleEditGrades(gradeId) {
  if (!gradeId || gradeId === "undefined") {
    console.error("handleEditGrades received invalid gradeId:", gradeId);
    if (typeof showToast === "function") showToast("Invalid Grade ID", "error");
    return;
  }

  const modal = document.getElementById("editGradeModal");
  if (!modal) return;

  currentEditGradeId = gradeId;

  // 1. Safe HTML escape helper
  const escapeHtml = (str) =>
    String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  // 2. Set skeleton placeholders
  const skeletonText = `<span class="skeleton-text">Loading...</span>`;
  document.getElementById("editModalClass").innerHTML = skeletonText;
  document.getElementById("editModalSubject").innerHTML = skeletonText;
  document.getElementById("editModalAssessment").innerHTML = skeletonText;
  document.getElementById("editModalAssessmentPeriod").innerHTML = skeletonText;
  document.getElementById("editModalAcademicYear").innerHTML = skeletonText;
  document.getElementById("editModalSemester").innerHTML = skeletonText;
  document.getElementById("editModalDate").innerHTML = skeletonText;

  const elMaxMarks = document.getElementById("editModalMaxMarks");
  if (elMaxMarks) elMaxMarks.innerHTML = skeletonText;

  const tbody = document.getElementById("editGradeTableBody");
  tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: #888;">Loading records...</td></tr>`;

  openModal(modal);

  try {
    const client = window.supabaseClient || supabaseClient;

    const { data: grade, error } = await client
      .from("grades")
      .select(
        `
        id,
        status,
        created_at,
        assessment_categories ( name, marks ),
        assessments ( name, maximum_marks ),
        academic_years ( year_label ),
        terms ( name ),
        classes ( name ),
        subjects ( name ),     
        grade_records (
          id,
          student_id,
          score,
          students (
            id, student_id,
            profiles ( full_name )
          )
        )
      `,
      )
      .eq("id", gradeId)
      .single();

    if (error) throw error;

    // 1. Extract raw marks from foreign tables
    const categoryMax =
      grade.assessment_categories?.marks != null
        ? Number(grade.assessment_categories.marks)
        : null;

    const periodMax =
      grade.assessments?.maximum_marks != null
        ? Number(grade.assessments.maximum_marks)
        : null;

    // 2. Compute effective dynamic cap
    const effectiveMax = Math.min(
      categoryMax ?? Infinity,
      periodMax ?? Infinity,
    );
    const finalMaxMarks = isFinite(effectiveMax) ? effectiveMax : null;

    // 3. Render raw individual limits
    const elCatMax = document.getElementById("editModalCategoryMax");
    if (elCatMax) {
      elCatMax.textContent =
        categoryMax !== null ? `(Category Max: ${categoryMax})` : "";
    }

    const elPerMax = document.getElementById("editModalPeriodMax");
    if (elPerMax) {
      elPerMax.textContent =
        periodMax !== null ? `(Period Max: ${periodMax})` : "";
    }

    // 4. Render effective combined cap
    const elMaxMarks = document.getElementById("editModalMaxMarks");
    if (elMaxMarks) {
      elMaxMarks.textContent =
        finalMaxMarks !== null ? `${finalMaxMarks} Marks` : "No Limit";
    }

    // 4. Populate metadata
    document.getElementById("editModalClass").textContent =
      grade.classes?.name || "-";
    document.getElementById("editModalSubject").textContent =
      grade.subjects?.name || "-";
    document.getElementById("editModalAssessment").textContent =
      grade.assessment_categories?.name || "-";
    document.getElementById("editModalAssessmentPeriod").textContent =
      grade.assessments?.name || "-";
    document.getElementById("editModalAcademicYear").textContent =
      grade.academic_years?.year_label || "-";
    document.getElementById("editModalSemester").textContent =
      grade.terms?.name || "-";
    document.getElementById("editModalDate").textContent = grade.created_at
      ? new Date(grade.created_at).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : "-";

    if (elMaxMarks) {
      elMaxMarks.textContent =
        finalMaxMarks !== null ? `${finalMaxMarks} Marks` : "No Limit";
    }

    const statusSelect = document.getElementById("editModalStatusSelect");
    if (statusSelect) {
      const initialStatus = (grade.status || "drafted")
        .toLowerCase()
        .includes("drafted")
        ? "drafted"
        : "submitted";

      statusSelect.value = initialStatus;
      statusSelect.dataset.initialValue = initialStatus;
    }

    const tbody = document.getElementById("editGradeTableBody");
    const records = grade.grade_records || [];

    if (records.length === 0) {
      // Fixed: colspan="3"
      tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: #888;">No student records found.</td></tr>`;
    } else {
      // Fixed: escapeHtml wrapping
      tbody.innerHTML = records
        .map((rec) => {
          const studentName = escapeHtml(
            rec.students?.profiles?.full_name || "-",
          );
          const studentId = escapeHtml(rec.students?.student_id || "-");
          const scoreVal = rec.score ?? "";

          return `
 <tr data-record-id="${rec.id}">
          <td>${studentId}</td>
          <td>${studentName}</td>
          <td class="form-group">
            <input 
              type="number" 
              class="edit-score-input" 
              data-record-id="${rec.id}"
              data-student-id="${rec.student_id}"
              data-initial-value="${scoreVal}"
              value="${scoreVal}" 
              placeholder="0 - ${finalMaxMarks ?? "Max"}" 
              step="0.01"
              min="0"
              ${finalMaxMarks !== null ? `max="${finalMaxMarks}"` : ""}
            />
          </td>
         </tr>`;
        })
        .join("");
    }
  } catch (err) {
    console.error("Error opening edit modal:", err);
    if (typeof showToast === "function")
      showToast("Failed to load grade for editing", "error");
    closeModal(modal);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const tbody = document.getElementById("gradesTableBody");
  if (!tbody) return;

  tbody.addEventListener("click", async (e) => {
    const btn = e.target.closest(".grades-actions-btn");
    if (!btn || btn.disabled) return;

    const action = btn.getAttribute("data-action");

    // Check button first, fallback to table row
    const row = btn.closest("tr");
    const gradeId =
      btn.getAttribute("data-grade-id") || row?.getAttribute("data-grade-id");

    if (!gradeId || gradeId === "undefined") {
      console.error("Unable to locate valid gradeId on target:", btn);
      return;
    }

    try {
      // Prevent rapid double-clicks while async handler runs
      btn.disabled = true;

      if (action === "view") {
        await handleViewGrades(gradeId);
      } else if (action === "edit") {
        await handleEditGrades(gradeId);
      }
    } catch (err) {
      console.error(`Error processing ${action} action:`, err);
    } finally {
      btn.disabled = false;
    }
  });

  loadGradesList();
});

document.addEventListener("DOMContentLoaded", async () => {
  if (typeof initGradeModalEventListeners === "function") {
    initGradeModalEventListeners();
  }
  if (typeof initGradeFormListeners === "function") {
    initGradeFormListeners();
  }

  // Initialize Toolbar
  initToolbarListeners();
  await populateToolbarDropdowns();

  // Load Context & Initial Setup Options
  await loadAcademicContext();
  await populateClassOptions();
});

document
  .getElementById("editGradeForm")
  ?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentEditGradeId) return;

    // 1. Detect if anything actually changed
    const statusSelect = document.getElementById("editModalStatusSelect");
    const currentStatus = statusSelect
      ? statusSelect.value.toLowerCase()
      : "drafted";
    const initialStatus = statusSelect?.dataset.initialValue || "";

    let hasStatusChanged = currentStatus !== initialStatus;
    let hasScoresChanged = false;

    const inputs = document.querySelectorAll(".edit-score-input");
    inputs.forEach((input) => {
      const initialScore = input.dataset.initialValue ?? "";
      const currentScore = input.value.trim();

      if (initialScore !== currentScore) {
        hasScoresChanged = true;
      }
    });

    // 🛑 STOP: If no changes were made, notify user and cancel API request
    if (!hasStatusChanged && !hasScoresChanged) {
      if (typeof showToast === "function") {
        showToast("No changes detected.", "info"); // or "warning"
      }
      return;
    }

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn ? submitBtn.textContent : "Save";
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Updating...";
    }

    try {
      const client = window.supabaseClient || supabaseClient;

      if (hasStatusChanged) {
        const { error: gradeErr } = await client
          .from("grades")
          .update({ status: currentStatus })
          .eq("id", currentEditGradeId);

        if (gradeErr) throw gradeErr;
      }

      const { data: gradeDetails, error: detailsErr } = await client
        .from("grades")
        .select(
          `
          subjects ( name ),
          assessment_categories ( name )
        `,
        )
        .eq("id", currentEditGradeId)
        .single();

      if (detailsErr) {
        console.warn(
          "Could not fetch grade details for notification text:",
          detailsErr,
        );
      }

      const subjectName = gradeDetails?.subjects?.name || "Subject";
      const categoryName =
        gradeDetails?.assessment_categories?.name || "Assessment";

      const updatedRecordsInfo = [];

      const updatePromises = Array.from(inputs).map((input) => {
        const recordId = input.dataset.recordId;
        const studentId = input.dataset.studentId; // Ensure your edit input has data-student-id
        const rawVal = input.value.trim();

        let score = null;
        if (rawVal !== "") {
          const parsed = parseFloat(rawVal);
          if (isNaN(parsed))
            throw new Error(`Invalid score number for student record.`);
          score = parsed;
        }

        updatedRecordsInfo.push({ student_id: studentId, score: score });

        return client
          .from("grade_records")
          .update({ score: score })
          .eq("id", recordId)
          .throwOnError();
      });

      await Promise.all(updatePromises);

      if (typeof showToast === "function") {
        showToast("Grades updated successfully!", "success");
      }

      closeModal(document.getElementById("editGradeModal"));
      if (typeof loadGradesList === "function") loadGradesList();

      const isSubmittedState = currentStatus === "submitted";

      if (isSubmittedState && typeof window.sendNotification === "function") {
        await Promise.all(
          updatedRecordsInfo.map(async (record) => {
            if (!record.student_id) {
              return;
            }
            const scoreText = record.score !== null ? record.score : "N/A";
            const message = `Your grade for ${subjectName} (${categoryName}) has been updated. New Score: ${scoreText}.`;

            return window.sendNotification(
              null, 
              record.student_id,
              "Grade Updated",
              message,
              "academic",
            );
          }),
        );
      }
    } catch (err) {
      console.error("Error saving updated grades:", err);
      if (typeof showToast === "function") {
        showToast(`Update failed: ${err.message}`, "error");
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
      }
    }
  });

// 1. Populate Filter Dropdowns on Initial Load
async function populateToolbarDropdowns() {
  const classFilter = document.getElementById("gradeToolbarClassSelect");
  const subjectFilter = document.getElementById("gradeToolbarSubjectSelect");
  const categoryFilter = document.getElementById("gradeToolbarCategorySelect");

  const client = window.supabaseClient || supabaseClient;

  try {
    const [classRes, subjectRes, categoryRes] = await Promise.all([
      client.from("classes").select("id, name").order("name"),
      client.from("subjects").select("id, name").order("name"),
      client.from("assessment_categories").select("id, name").order("name"),
    ]);

    // Populate Class Filter
    if (classFilter && classRes.data) {
      classFilter.innerHTML = `<option value="">All Classes</option>`;
      classRes.data.forEach((c) => {
        classFilter.appendChild(new Option(c.name, c.id));
      });
    }

    // Populate Subject Filter
    if (subjectFilter && subjectRes.data) {
      subjectFilter.innerHTML = `<option value="">All Subjects</option>`;
      subjectRes.data.forEach((s) => {
        subjectFilter.appendChild(new Option(s.name, s.id));
      });
    }

    // Populate Category Filter
    if (categoryFilter && categoryRes.data) {
      categoryFilter.innerHTML = `<option value="">All Assessment Categories</option>`;
      categoryRes.data.forEach((cat) => {
        categoryFilter.appendChild(new Option(cat.name, cat.id));
      });
    }
  } catch (err) {
    console.error("Error populating toolbar filters:", err);
  }
}

// 2. Client-Side Table Filter Handler
function handleToolbarFilter() {
  const searchQuery = (document.getElementById("gradeSearchInput")?.value || "")
    .toLowerCase()
    .trim();
  const selectedClass = document.getElementById(
    "gradeToolbarClassSelect",
  )?.value;
  const selectedSubject = document.getElementById(
    "gradeToolbarSubjectSelect",
  )?.value;
  const selectedCategory = document.getElementById(
    "gradeToolbarCategorySelect",
  )?.value;

  const rows = document.querySelectorAll("#gradesTableBody tr");

  rows.forEach((row) => {
    // Extract row attributes or cell text
    const textContent = row.textContent.toLowerCase();
    const rowClassId = row.dataset.classId;
    const rowSubjectId = row.dataset.subjectId;
    const rowCategoryId = row.dataset.categoryId;

    const matchesSearch = !searchQuery || textContent.includes(searchQuery);
    const matchesClass = !selectedClass || rowClassId === selectedClass;
    const matchesSubject = !selectedSubject || rowSubjectId === selectedSubject;
    const matchesCategory =
      !selectedCategory || rowCategoryId === selectedCategory;

    if (matchesSearch && matchesClass && matchesSubject && matchesCategory) {
      row.style.display = "";
    } else {
      row.style.display = "none";
    }
  });
}

function initToolbarListeners() {
  const searchInput = document.getElementById("gradeSearchInput");
  const classFilter = document.getElementById("gradeToolbarClassSelect");
  const subjectFilter = document.getElementById("gradeToolbarSubjectSelect");
  const categoryFilter = document.getElementById("gradeToolbarCategorySelect");

  if (searchInput) searchInput.addEventListener("input", loadGradesList);
  if (classFilter) classFilter.addEventListener("change", loadGradesList);
  if (subjectFilter) subjectFilter.addEventListener("change", loadGradesList);
  if (categoryFilter) categoryFilter.addEventListener("change", loadGradesList);
}
