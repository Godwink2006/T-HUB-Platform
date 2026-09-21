document.addEventListener("DOMContentLoaded", async () => {
  initGradeModalEventListeners();
  initGradeModalLogic();
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

  document.getElementById("loadEnterGrade")?.addEventListener("click", () => {
    closeModal(gradeModal);
    openModal(enterGradeModal);
  });

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
      const sessionId = viewBtn.dataset.id;
      if (typeof handleViewGrades === "function") {
        handleViewGrades(sessionId);
      }
      openModal(viewGradeModal);
    }

    if (editBtn) {
      const sessionId = editBtn.dataset.id;
      if (typeof handleEditGrades === "function") {
        handleEditGrades(sessionId);
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

function initGradeModalLogic() {
  // Logic for handling form submissions, score validation, draft saving, and Supabase calls
}

// Module-level context variables
let activeAcademicYearId = null;
let activeTermId = null;
let activeAssessment = [];

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
    }

    // Handle Active Term
    if (termRes.data) {
      activeTermId = termRes.data.id;
      window.activeTermId = termRes.data.id;
    }

    // Handle Assessment Categories (FIXED Variable Assignment)
    if (assessmentRes.data) {
      activeAssessment = assessmentRes.data;
      window.activeAssessment = assessmentRes.data;
    }

    console.log("Loaded Grades Academic Context:", {
      academicYearId: activeAcademicYearId,
      termId: activeTermId,
      assessment: activeAssessment,
    });
  } catch (err) {
    console.error("Error loading academic context for grades:", err);
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
