let activeAcademicYearId = null;
let activeTermId = null;
let activeAssessment = null;
let currentGradeSession = null;
let currentEditGradeId = null;

document.addEventListener("DOMContentLoaded", async () => {
  initGradeModalEventListeners();
  initGradeFormListeners();

  // Load Context & Initial Dropdowns
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

function initGradeModalEventListeners() {
  const gradeModal = document.getElementById("gradeModal");
  const enterGradeModal = document.getElementById("enterGradeModal");
  const viewGradeModal = document.getElementById("viewGradeModal");
  const editGradeModal = document.getElementById("editGradeModal");

  document.getElementById("addGrade")?.addEventListener("click", async () => {
    resetGradeModal();
    openModal(gradeModal);
    // Populate options on open without overriding active selection
    await populateClassOptions();
    await loadAssessmentCategories();
  });

  document
    .getElementById("closeGradeModal")
    ?.addEventListener("click", () => closeModal(gradeModal));
  document
    .getElementById("cancelGradeModal")
    ?.addEventListener("click", () => closeModal(gradeModal));

  document
    .getElementById("loadEnterGrade")
    ?.addEventListener("click", handleLoadStudents);

  document
    .getElementById("closeEnterGradeModal")
    ?.addEventListener("click", () => closeModal(enterGradeModal));
  document
    .getElementById("cancelEnterGradeModal")
    ?.addEventListener("click", () => closeModal(enterGradeModal));

  document
    .getElementById("closeViewGradeModal")
    ?.addEventListener("click", () => closeModal(viewGradeModal));
  document
    .getElementById("closeViewBtn")
    ?.addEventListener("click", () => closeModal(viewGradeModal));

  document
    .getElementById("closeEditGradeModal")
    ?.addEventListener("click", () => closeModal(editGradeModal));
  document
    .getElementById("cancelEditGradeModal")
    ?.addEventListener("click", () => closeModal(editGradeModal));

  document.addEventListener("click", (e) => {
    const viewBtn = e.target.closest(".view");
    const editBtn = e.target.closest(".edit");

    if (viewBtn) {
      // Read data-grade-id attribute instead of data-id
      const gradeId =
        viewBtn.dataset.gradeId || viewBtn.closest("tr")?.dataset.gradeId;

      if (typeof handleViewGrades === "function") {
        handleViewGrades(gradeId);
      }
      openModal(viewGradeModal);
    }

    if (editBtn) {
      // Read data-grade-id attribute instead of data-id
      const gradeId =
        editBtn.dataset.gradeId || editBtn.closest("tr")?.dataset.gradeId;

      if (typeof handleEditGrades === "function") {
        handleEditGrades(gradeId);
      }
      openModal(editGradeModal);
    }
  });
  window.addEventListener("click", (e) => {
    if (e.target === gradeModal) closeModal(gradeModal);
    if (e.target === enterGradeModal) closeModal(enterGradeModal);
    if (e.target === viewGradeModal) closeModal(viewGradeModal);
    if (e.target === editGradeModal) closeModal(editGradeModal);
  });
}

function resetGradeModal() {
  const form =
    document.getElementById("gradeForm") ||
    document.getElementById("gradeSetupForm");
  if (form) form.reset();

  const subjectSelect = document.getElementById("gradeSubjectSelect");
  if (subjectSelect) {
    subjectSelect.innerHTML = `<option value="">Select Subject</option>`;
    subjectSelect.disabled = true;
  }
}

let classListenerAttached = false;
function initGradeFormListeners() {
  const classSelect = document.getElementById("gradesClassSelect");
  if (classSelect && !classListenerAttached) {
    classSelect.addEventListener("change", (e) => {
      handleClassSelectChange(e.target.value);
    });
    classListenerAttached = true;
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
        .order("name");
      if (error) throw error;
      classesList = allClasses || [];
    } else {
      const { data: assignments, error } = await client
        .from("teacher_assignments")
        .select("class_id, classes(id, name)")
        .eq("teacher_id", user.id);

      if (error) throw error;

      classesList = [
        ...new Map(
          (assignments || [])
            .filter((a) => a.classes)
            .map((a) => [a.classes.id, a.classes]),
        ).values(),
      ];
    }

    classSelect.innerHTML = `<option value="">Select Class</option>`;

    classesList.forEach((cls) => {
      const opt = document.createElement("option");
      opt.value = cls.id;
      opt.textContent = cls.name;
      classSelect.appendChild(opt);
    });

    // Re-apply selected value if it still exists in the options
    if (selectedValue) {
      classSelect.value = selectedValue;
    }

    initGradeFormListeners();
  } catch (err) {
    console.error("Error populating class options:", err);
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
    let assignments = [];

    if (role === "admin") {
      const { data, error } = await client
        .from("teacher_assignments")
        .select("subject_id, subjects(id, name)")
        .eq("class_id", classId);

      if (error) console.error("Admin subject query error:", error);
      assignments = data || [];
    } else {
      const { data, error } = await client
        .from("teacher_assignments")
        .select("subject_id, subjects(id, name)")
        .eq("class_id", classId)
        .eq("teacher_id", user.id);

      if (error) console.error("Teacher subject query error:", error);
      assignments = data || [];
    }

    if (!assignments || assignments.length === 0) {
      subjectSelect.innerHTML = `<option value="">No subjects assigned</option>`;
      return;
    }

    const subjectMap = new Map();
    assignments.forEach((item) => {
      if (item.subjects?.id) {
        subjectMap.set(item.subjects.id, item.subjects.name);
      }
    });

    if (subjectMap.size === 0) {
      subjectSelect.innerHTML = `<option value="">No subjects found</option>`;
      return;
    }

    subjectMap.forEach((subjectName, subjectId) => {
      const opt = document.createElement("option");
      opt.value = subjectId;
      opt.textContent = subjectName;
      subjectSelect.appendChild(opt);
    });

    subjectSelect.disabled = false;
  } catch (err) {
    console.error("Error in handleClassSelectChange:", err);
  }
}

let activeAssessmentCategories = [];

async function loadAssessmentCategories() {
  const assessmentSelect = document.getElementById(
    "gradeAssessmentCategorySelect",
  );
  if (!assessmentSelect) return;

  assessmentSelect.innerHTML = `<option value="">Select Assessment</option>`;

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

    activeAssessmentCategories = categories;
    window.activeAssessmentCategories = categories;

    // Populate options
    assessmentSelect.innerHTML = `<option value="">Select Assessment</option>`;
    categories.forEach((cat) => {
      const opt = document.createElement("option");
      opt.value = cat.id;
      // Show total marks if available (e.g., Cat 1 (20 Marks))
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

  assessments.forEach((item) => {
    const opt = document.createElement("option");
    opt.value = item.id;
    opt.textContent = `${item.name} (${item.maximum_marks} marks)`;
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

      // 3. Fetch Assessment Categories
      client
        .from("assessments")
        .select("id, name, maximum_marks")
        .ilike("status", "Active")
        .order("name", { ascending: true }),
    ]);

    // Handle Active Year
    if (yearRes.data) {
      activeAcademicYearId = yearRes.data.id;
      window.activeAcademicYearId = yearRes.data.id;
      window.activeAcademicYearLabel = yearRes.data.year_label; // Attached for UI display
    }

    // Handle Active Term
    if (termRes.data) {
      activeTermId = termRes.data.id;
      window.activeTermId = termRes.data.id;
      window.activeTermLabel = termRes.data.name; // Attached for UI display
    }

    // Handle Assessment Categories
    if (assessmentRes.data) {
      activeAssessment = assessmentRes.data;
      window.activeAssessment = assessmentRes.data;
      populateAssessmentDropdown(assessmentRes.data);
    }

    console.log("Loaded Grades Academic Context:", {
      academicYearId: activeAcademicYearId,
      academicYearLabel: window.activeAcademicYearLabel,
      termId: activeTermId,
      termLabel: window.activeTermLabel,
      assessment: activeAssessment,
    });
  } catch (err) {
    console.error("Error loading academic context for grades:", err);
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
  const elDate = document.getElementById("enterGradeModalDate");

  if (elClass) elClass.textContent = className;
  if (elSubject) elSubject.textContent = subjectName;
  if (elCategory) {
    elCategory.textContent = `${categoryName} (Max Allowed: ${finalMaxMarks ?? "N/A"} marks)`;
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

  await loadStudentRosterForGrades(classId);
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

  // Inside handleSaveGrades(e):
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
    : "published";

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

    const { data: gradeId, error } = await client.rpc("save_grade_session", {
      p_class_id: currentGradeSession.classId,
      p_subject_id: currentGradeSession.subjectId,
      p_assessment_id: targetAssessmentId,
      p_category_id: currentGradeSession.categoryId,
      p_academic_year_id: currentGradeSession.academicYearId || null,
      p_term_id: currentGradeSession.termId || null,
      p_status: selectedStatus,
      p_records: recordsPayload,
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
  } catch (err) {
    console.error("Error saving grade session:", err);
    showToast(`Failed to save grades: ${err.message}`, "error");
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

async function loadStudentRosterForGrades(classId) {
  const tbody = document.getElementById("gradeRosterTableBody");
  if (!tbody) return;

  // Updated colspan to 3 to account for Student ID column
  tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding: 16px; color: #6b7280;">Loading student roster...</td></tr>`;

  try {
    const client = window.supabaseClient || supabaseClient;
    const cleanClassId = classId ? classId.trim() : "";

    // Fetch students in class (including student_id column)
    const { data: students, error: studentErr } = await client
      .from("students")
      .select("id, student_id, class_id")
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

    // Fetch student profile full names using primary key id
    const studentIds = students.map((s) => s.id);
    let profileMap = new Map();

    const { data: profiles, error: profileErr } = await client
      .from("profiles")
      .select("id, full_name")
      .in("id", studentIds);

    if (!profileErr && profiles) {
      profileMap = new Map(profiles.map((p) => [p.id, p.full_name]));
    }

    // Populate rows
    tbody.innerHTML = "";
    students.forEach((student) => {
      const studentCode = student.student_id || "N/A";
      const displayName = profileMap.get(student.id) || "Unknown Student";

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td style="padding: 12px; font-weight: 600; color: #374151;">${studentCode}</td>
        <td style="padding: 12px; font-weight: 500; color: #111827;">${displayName}</td>
        <td class="form-group" style="padding: 12px;">
          <input 
            type="number" 
            class="student-score-input" 
            data-student-id="${student.id}" 
            placeholder="Enter grade" 
            min="0" 
            step="0.5"
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

  try {
    const client = window.supabaseClient || supabaseClient;

    // 1. Fetch grades table with foreign relations
    const { data: grades, error } = await client
      .from("grades")
      .select(
        `
        id,
        status,
        created_at,
        assessment_categories ( name ),
        classes ( name ),
        subjects ( name )
      `,
      )
      .order("created_at", { ascending: false });

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

    // 2. Build row elements
    tbody.innerHTML = grades
      .map((item) => {
        // Fallback check to ensure gradeId exists
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

        // Generate action button with exact gradeId
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
        classes ( name ),
        subjects ( name ),
        grade_records (
          id,
          student_id,
          score,
          students (
            id,
            profiles ( full_name )
          )
        )
      `,
      )
      .eq("id", gradeId)
      .single();

    if (error) throw error;

    // Populate header details
    document.getElementById("viewModalClass").textContent =
      grade.classes?.name || "N/A";
    document.getElementById("viewModalSubject").textContent =
      grade.subjects?.name || "N/A";
    document.getElementById("viewModalAssessment").textContent =
      grade.assessment_categories?.name || "N/A";
    document.getElementById("viewModalDate").textContent = new Date(
      grade.created_at,
    ).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    // Populate student table rows
    const tbody = document.getElementById("viewGradeTableBody");
    const records = grade.grade_records || [];

    if (records.length === 0) {
      tbody.innerHTML = `<tr><td colspan="2" style="text-align: center; color: #888;">No student marks recorded.</td></tr>`;
    } else {
      tbody.innerHTML = records
        .map((rec) => {
          // Check nested profile full_name, fallback if null
          const studentName =
            rec.students?.profiles?.full_name || "Unknown Student";
          const scoreDisplay = rec.score ?? "-";

          return `
            <tr>
              <td>${studentName}</td>
              <td><p>${scoreDisplay}</p></td>
            </tr>`;
        })
        .join("");
    }

    // Replace modal.style.display = "block"; with:
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
        classes ( name ),
        subjects ( name ),
        grade_records (
          id,
          student_id,
          score,
          students (
            id,
            profiles ( full_name )
          )
        )
      `,
      )
      .eq("id", gradeId)
      .single();

    if (error) throw error;

    document.getElementById("editModalClass").textContent =
      grade.classes?.name || "N/A";
    document.getElementById("editModalSubject").textContent =
      grade.subjects?.name || "N/A";
    document.getElementById("editModalAssessment").textContent =
      grade.assessment_categories?.name || "N/A";
    document.getElementById("editModalDate").textContent = new Date(
      grade.created_at,
    ).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    const statusSelect = document.getElementById("editModalStatusSelect");
    if (statusSelect) {
      statusSelect.value = (grade.status || "draft")
        .toLowerCase()
        .includes("draft")
        ? "draft"
        : "submitted";
    }

    const tbody = document.getElementById("editGradeTableBody");
    const records = grade.grade_records || [];

    if (records.length === 0) {
      tbody.innerHTML = `<tr><td colspan="2" style="text-align: center; color: #888;">No student records found.</td></tr>`;
    } else {
      tbody.innerHTML = records
        .map((rec) => {
          const studentName =
            rec.students?.profiles?.full_name || "Unknown Student";
          return `
            <tr data-record-id="${rec.id}">
              <td>${studentName}</td>
              <td class="form-group">
                <input 
                  type="number" 
                  class="edit-score-input" 
                  data-record-id="${rec.id}"
                  value="${rec.score ?? ""}" 
                  placeholder="Enter grade" 
                  step="0.01"
                  min="0"
                />
              </td>
            </tr>`;
        })
        .join("");
    }

    // Replace modal.style.display = "block"; with:
    openModal(modal);
  } catch (err) {
    console.error("Error opening edit modal:", err);
    if (typeof showToast === "function")
      showToast("Failed to load grade for editing", "error");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const tbody = document.getElementById("gradesTableBody");
  if (!tbody) return;

  tbody.addEventListener("click", async (e) => {
    const btn = e.target.closest(".grades-actions-btn");
    if (!btn) return;

    const action = btn.getAttribute("data-action");

    // Check button first, fallback to table row
    const row = btn.closest("tr");
    const gradeId =
      btn.getAttribute("data-grade-id") || row?.getAttribute("data-grade-id");

    if (!gradeId || gradeId === "undefined") {
      console.error("Unable to locate valid gradeId on target:", btn);
      return;
    }

    if (action === "view") {
      await handleViewGrades(gradeId);
    } else if (action === "edit") {
      await handleEditGrades(gradeId);
    }
  });

  loadGradesList();
});
/**
 * Handle Save / Update Form Submission
 */
document
  .getElementById("editGradeForm")
  ?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentEditGradeId) return;

    try {
      const client = window.supabaseClient || supabaseClient;
      const newStatus = document.getElementById("editModalStatusSelect").value;

      // 1. Update grade session status
      const { error: gradeErr } = await client
        .from("grades")
        .update({ status: newStatus })
        .eq("id", currentEditGradeId);

      if (gradeErr) throw gradeErr;

      // 2. Collect updated marks from table inputs
      const inputs = document.querySelectorAll(".edit-score-input");
      const updatePromises = Array.from(inputs).map((input) => {
        const recordId = input.dataset.recordId;
        const score = input.value === "" ? null : parseFloat(input.value);

        return client
          .from("grade_records")
          .update({ score: score })
          .eq("id", recordId);
      });

      await Promise.all(updatePromises);

      if (typeof showToast === "function")
        showToast("Grades updated successfully!", "success");

      // Close modal and refresh list
      closeModal("editGradeModal");
      loadGradesList();
    } catch (err) {
      console.error("Error saving updated grades:", err);
      if (typeof showToast === "function")
        showToast(`Update failed: ${err.message}`, "error");
    }
  });

/**
 * Modal Close Utility Listeners
 */
function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.style.display = "none";
}

document
  .getElementById("closeViewGradeModal")
  ?.addEventListener("click", () => closeModal("viewGradeModal"));
document
  .getElementById("closeViewBtn")
  ?.addEventListener("click", () => closeModal("viewGradeModal"));
document
  .getElementById("closeEditGradeModal")
  ?.addEventListener("click", () => closeModal("editGradeModal"));
document
  .getElementById("cancelEditGradeModal")
  ?.addEventListener("click", () => closeModal("editGradeModal"));
