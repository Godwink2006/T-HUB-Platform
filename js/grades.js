let activeAcademicYearId = null;
let activeTermId = null;
let activeAssessment = null;
let currentGradeSession = null;
let currentEditGradeId = null;
const GRADE_LIST_PAGE_SIZE = 30;
let gradeListOffset = 0;
let gradeListHasMore = true;
let gradeListRenderedCount = 0;
let gradeListIsLoading = false;
let gradeListRefreshPending = false;

function getGradeErrorMessage(error, action = "load") {
  if (error?.partialGradeUpdate) {
    return "Some scores may have been updated before the error. Reload the grade record before trying again.";
  }
  const code = String(error?.code || "").toUpperCase();
  const details = [error?.message, error?.details, error?.hint]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (!error) {
    return action === "save"
      ? "Grades could not be saved. Please try again."
      : "Grades could not be loaded. Please try again.";
  }
  if (/choose an assessment before recording/.test(details)) {
    return "Choose an assessment before entering grades.";
  }
  if (/selected assessment does not exist/.test(details)) {
    return "The selected assessment is no longer available. Refresh and choose an assessment again.";
  }
  if (
    (code === "23514" || code === "P0001") &&
    /assessment is not active for entry today|assessment.*date range|date range.*assessment/.test(details)
  ) {
    return "Grade entry is closed for this assessment. Ask an administrator to check that it is Active and that today is within its start and end dates.";
  }
  if (code === "42501" || /row-level security|permission denied|not authorized|not permitted/.test(details)) {
    return action === "save"
      ? "You do not have permission to change these grades. Check that your account is active and assigned to this school."
      : "You do not have permission to view these grades. Check that your account is active and assigned to this school.";
  }
  if (/school.{0,30}(inactive|not active)|inactive.{0,30}school/.test(details)) {
    return "This school is inactive, so grades cannot be changed. Contact your school administrator.";
  }
  if (code === "401" || code === "PGRST301" || /jwt expired|invalid jwt|not authenticated/.test(details)) {
    return "Your session has expired. Sign in again, then retry.";
  }
  if (/failed to fetch|network|timed out|timeout|fetch error/.test(details)) {
    return "The server could not be reached. Check your connection and try again.";
  }
  if (code === "23505" || /duplicate key|already exists|unique constraint/.test(details)) {
    return "Grades for this class, subject, assessment, and category already exist. Open the existing grade record to make changes.";
  }
  if (/maximum|exceed.*mark|score.*limit/.test(details)) {
    return "One or more scores exceed the maximum marks allowed for this assessment.";
  }
  if (/does not belong|not enrolled|wrong class|student.*class/.test(details)) {
    return "One or more students are no longer eligible for this class. Reload the roster and try again.";
  }
  if (/not updated|access may have been removed|record.*changed/.test(details)) {
    return "This grade record changed or your access was removed. Reload the grade record and try again.";
  }
  if (/invalid score|score.*number|only administrators and teachers/.test(details)) {
    return /administrator|teacher/.test(details)
      ? "Only school administrators and teachers can manage grades."
      : "Enter a valid numeric score for each student.";
  }
  if (code === "PGRST116") return "This grade record is no longer available. Refresh the page and try again.";
  return action === "save"
    ? "Grades could not be saved. Check the scores and selections, then try again."
    : "Grades could not be loaded. Refresh the page and try again.";
}

function setGradeTableMessage(tbody, message, colspan = 7) {
  if (!tbody) return;
  const row = document.createElement("tr");
  const cell = document.createElement("td");
  cell.colSpan = colspan;
  cell.style.cssText = "text-align:center; padding:16px;";
  cell.textContent = message;
  row.appendChild(cell);
  tbody.replaceChildren(row);
}

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

  const classSelect =
    document.getElementById("gradesClassSelect") ||
    document.getElementById("gradeClassSelect");
  if (classSelect) {
    classSelect.value = "";
  }

  const subjectSelect = document.getElementById("gradeSubjectSelect");
  if (subjectSelect) {
    subjectSelect.innerHTML = `<option value="">Select Subject</option>`;
    subjectSelect.disabled = true;
  }

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

  const selectedValue = classSelect.value;

  try {
    const client = window.supabaseClient || supabaseClient;
    const { data: authData, error: authError } = await client.auth.getUser();
    if (authError) throw authError;
    const user = authData?.user;
    if (!user) {
      showToast("Your session has expired. Sign in again to load classes.", "error");
      classSelect.replaceChildren(new Option("Sign in to load classes", ""));
      return;
    }

    const { data: profile, error: profileError } = await client
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile?.role) {
      throw new Error("Your account profile could not be verified.");
    }

    const role = String(profile.role).toLowerCase();
    let classesList = [];

    if (role === "admin") {
      const { data: allClasses, error } = await client
        .from("classes")
        .select("id, name")
        .order("name", { ascending: true });
      if (error) throw error;
      classesList = allClasses || [];
    } else if (role === "teacher") {
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

      classesList.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      throw new Error("Only administrators and teachers can manage grades.");
    }

    classSelect.innerHTML = `<option value="">Select Class</option>`;

    classesList.forEach((cls) => {
      const opt = document.createElement("option");
      opt.value = cls.id;
      opt.textContent = cls.name;
      classSelect.appendChild(opt);
    });

    if (selectedValue) {
      classSelect.value = selectedValue;
    }

    if (
      !classSelect.dataset.listenersBound &&
      typeof initGradeFormListeners === "function"
    ) {
      initGradeFormListeners();
      classSelect.dataset.listenersBound = "true";
    }
  } catch (err) {
    console.error("Error populating class options:", err);
    classSelect.replaceChildren(new Option("Classes could not be loaded", ""));
    showToast(getGradeErrorMessage(err), "error");
  }
}

async function handleClassSelectChange(classId) {
  const subjectSelect = document.getElementById("gradeSubjectSelect");
  if (!subjectSelect) return;

  subjectSelect.innerHTML = `<option value="">Select Subject</option>`;
  subjectSelect.disabled = true;

  if (!classId) return;

  try {
    const client = window.supabaseClient || supabaseClient;
    const { data: authData, error: authError } = await client.auth.getUser();
    if (authError) throw authError;
    const user = authData?.user;
    if (!user) {
      subjectSelect.replaceChildren(new Option("Sign in to load subjects", ""));
      showToast("Your session has expired. Sign in again, then retry.", "error");
      return;
    }

    const { data: profile, error: profileError } = await client
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile?.role) throw new Error("Your account profile could not be verified.");

    const role = String(profile.role).toLowerCase();
    const subjectMap = new Map();

    if (role === "admin") {

      const { data: assignedData, error: assignedErr } = await client
        .from("teacher_assignments")
        .select("subject_id, subjects(id, name)")
        .eq("class_id", classId);

      if (assignedErr) throw assignedErr;

      (assignedData || []).forEach((item) => {
        if (item.subjects?.id) {
          subjectMap.set(item.subjects.id, item.subjects.name);
        }
      });

      if (subjectMap.size === 0) {
        const { data: allSubjects, error: subjectsError } = await client
          .from("subjects")
          .select("id, name")
          .order("name", { ascending: true });
        if (subjectsError) throw subjectsError;

        (allSubjects || []).forEach((s) => subjectMap.set(s.id, s.name));
      }
    } else if (role === "teacher") {

      const { data: teacherData, error: teacherErr } = await client
        .from("teacher_assignments")
        .select("subject_id, subjects(id, name)")
        .eq("class_id", classId)
        .eq("teacher_id", user.id);

      if (teacherErr) throw teacherErr;

      (teacherData || []).forEach((item) => {
        if (item.subjects?.id) {
          subjectMap.set(item.subjects.id, item.subjects.name);
        }
      });
    } else {
      throw new Error("Only administrators and teachers can manage grades.");
    }

    if (subjectMap.size === 0) {
      subjectSelect.innerHTML = `<option value="">No subjects assigned</option>`;
      return;
    }

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
    subjectSelect.replaceChildren(new Option("Subjects could not be loaded", ""));
    showToast(getGradeErrorMessage(err), "error");
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
      assessmentSelect.replaceChildren(new Option("Categories could not be loaded", ""));
      showToast(getGradeErrorMessage(error), "error");
      return;
    }

    if (!categories || categories.length === 0) {
      assessmentSelect.innerHTML = `<option value="">No categories found</option>`;
      return;
    }

    activeAssessmentCategories = categories;
    window.activeAssessmentCategories = categories;
    window.activeCategories = categories;

    assessmentSelect.innerHTML = `<option value="">Select Category</option>`;

    categories.forEach((cat) => {
      const opt = document.createElement("option");
      opt.value = cat.id;

      if (cat.marks != null) {
        opt.dataset.marks = cat.marks;
      }

      const marksLabel = cat.marks ? ` (${cat.marks} Marks)` : "";
      opt.textContent = `${cat.name}${marksLabel}`;
      assessmentSelect.appendChild(opt);
    });
  } catch (err) {
    console.error("Error in loadAssessmentCategories:", err);
    assessmentSelect.replaceChildren(new Option("Categories could not be loaded", ""));
    showToast(getGradeErrorMessage(err), "error");
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

      client
        .from("academic_years")
        .select("id, year_label")
        .ilike("status", "Active")
        .maybeSingle(),

      client
        .from("terms")
        .select("id, name")
        .ilike("status", "Active")
        .maybeSingle(),

      client
        .from("assessments")
        .select("id, name, maximum_marks")
        .ilike("status", "Active")
        .order("name", { ascending: true }),
    ]);

    const contextError = yearRes.error || termRes.error || assessmentRes.error;
    if (contextError) {
      console.error("Could not load grades academic context:", contextError);
      showToast(getGradeErrorMessage(contextError), "error");
      return;
    }

    if (yearRes.data) {
      window.activeAcademicYearId = yearRes.data.id;
      window.activeAcademicYearLabel = yearRes.data.year_label;
    }

    if (termRes.data) {
      window.activeTermId = termRes.data.id;
      window.activeTermLabel = termRes.data.name;
    }

    if (assessmentRes.data) {
      window.activeAssessment = assessmentRes.data;
    }
  } catch (err) {
    console.error("Error loading academic context for grades:", err);
    if (typeof showToast === "function") {
      showToast(getGradeErrorMessage(err), "error");
    }
  }
}

async function handleLoadStudents(e) {
  if (e) e.preventDefault();

  const classSelect =
    document.getElementById("gradesClassSelect") ||
    document.getElementById("gradeClassSelect");
  const subjectSelect = document.getElementById("gradeSubjectSelect");
  const categorySelect = document.getElementById(
    "gradeAssessmentCategorySelect",
  );

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

  const loadStudentsBtn = document.getElementById("loadEnterGrade");
  const originalButtonText = loadStudentsBtn?.textContent || "Load Students";
  if (loadStudentsBtn) {
    loadStudentsBtn.disabled = true;
    loadStudentsBtn.setAttribute("aria-busy", "true");
    loadStudentsBtn.textContent = "Loading...";
  }

  try {
  const classId = classSelect.value;
  const className = classSelect.options[classSelect.selectedIndex].text;

  const subjectId = subjectSelect.value;
  const subjectName = subjectSelect.options[subjectSelect.selectedIndex].text;

  const categoryId = categorySelect.value;
  const categoryName =
    categorySelect.options[categorySelect.selectedIndex].text;

  const assessmentsList = window.activeAssessment || activeAssessment || [];
  const selectedAssessment =
    Array.isArray(assessmentsList) && assessmentsList.length > 0
      ? assessmentsList[0]
      : null;

  const assessmentId = selectedAssessment ? selectedAssessment.id : null;
  const assessmentName = selectedAssessment ? selectedAssessment.name : "";

  const categoriesList =
    window.activeCategories || window.activeAssessmentCategories || [];

  const selectedCategory = categoriesList.find((c) => c.id === categoryId);

  const selectedCategoryOption =
    categorySelect.options[categorySelect.selectedIndex];

  let gradeCreatorMarkup;
  try {
    const client = window.supabaseClient || supabaseClient;
    gradeCreatorMarkup = await getCurrentGradeActorMarkup(client);
  } catch (err) {
    console.error("Error loading grade creator identity:", err);
    showToast("Unable to load your profile details. Please try again.", "error");
    return;
  }

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

  currentGradeSession = {
    classId,
    className,
    subjectId,
    subjectName,
    assessmentId,
    assessmentName,
    categoryId,
    categoryName,
    maxMarks: finalMaxMarks,
    academicYearId: window.activeAcademicYearId || activeAcademicYearId || null,
    termId: window.activeTermId || activeTermId || null,
  };

  const elYear = document.getElementById("enterGradeModalYear");
  const elTerm = document.getElementById("enterGradeModalTerm");
  const elClass = document.getElementById("enterGradeModalClass");
  const elSubject = document.getElementById("enterGradeModalSubject");
  const elCategory = document.getElementById("enterGradeModalCategory");
  const elPeriod = document.getElementById("enterGradeModalAssessmentPeriod");
  const elDate = document.getElementById("enterGradeModalDate");
  const elCreator = document.getElementById("enterGradeModalCreator");

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
  if (elCreator) elCreator.innerHTML = gradeCreatorMarkup;

  if (elYear)
    elYear.textContent = window.activeAcademicYearLabel || "Active Year";
  if (elTerm) elTerm.textContent = window.activeTermLabel || "Active Term";

  const setupModal = document.getElementById("gradeModal");
  const enterGradeModal = document.getElementById("enterGradeModal");

  if (setupModal) closeModal(setupModal);
  if (enterGradeModal) openModal(enterGradeModal);

  await loadStudentRosterForGrades(classId, finalMaxMarks);
  } finally {
    if (loadStudentsBtn) {
      loadStudentsBtn.disabled = false;
      loadStudentsBtn.removeAttribute("aria-busy");
      loadStudentsBtn.textContent = originalButtonText;
    }
  }
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

  const statusSelect =
    document.getElementById("gradeStatusSelect") ||
    document.getElementById("enterGradeModalStatus");
  const selectedStatus = statusSelect
    ? statusSelect.value.toLowerCase()
    : "drafted";

  const scoreInputs = document.querySelectorAll(".student-score-input");
  const recordsPayload = [];
  let maxExceeded = false;
  let invalidScore = false;

  scoreInputs.forEach((input) => {
    const studentId = input.dataset.studentId;
    const rawVal = input.value.trim();
    const score = rawVal === "" ? 0 : Number(rawVal);

    if (!Number.isFinite(score) || score < 0) {
      invalidScore = true;
      input.classList.add("is-invalid");
      return;
    }

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
      score,
    });
  });

  if (invalidScore) {
    showToast("Scores must be zero or a positive number.", "error");
    return;
  }

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
      p_is_edit: false,
    });

    if (error) throw error;

    const enterGradeModal = document.getElementById("enterGradeModal");
    if (enterGradeModal && typeof closeModal === "function") {
      closeModal(enterGradeModal);
    }

    if (typeof loadGradesList === "function") {
      loadGradesList();
    }

    let notificationFailed = false;
    if (
      selectedStatus === "submitted" &&
      typeof window.sendNotification === "function"
    ) {
      const notificationResults = await Promise.allSettled(
        recordsPayload.map((record) =>
          window.sendNotification(
            null,
            record.student_id,
            "New Grade Posted",
            `Your grade has been updated (Score: ${record.score}/${currentGradeSession.maxMarks || "N/A"}).`,
            "academic",
          ),
        ),
      );
      notificationFailed = notificationResults.some(
        (result) => result.status === "rejected" || result.value?.success === false,
      );
    }

    if (notificationFailed) {
      showToast("Grades were saved, but some student notifications could not be sent.", "error");
    } else {
      showToast("Grades saved successfully!", "success");
    }
  } catch (err) {
    console.error("Error saving grade session:", err);
    showToast(getGradeErrorMessage(err, "save"), "error");
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save Grades";
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const saveBtn = document.getElementById("saveGradesBtn");
  if (saveBtn) {
    saveBtn.addEventListener("click", handleSaveGrades);
  }
});

async function loadStudentRosterForGrades(classId, maxMarks = null) {
  const tbody = document.getElementById("gradeRosterTableBody");
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="2" style="text-align:center; padding: 16px; color: #6b7280;">Loading student roster...</td></tr>`;

  try {
    const client = window.supabaseClient || supabaseClient;
    const cleanClassId = classId ? classId.trim() : "";

    const { data: activeStudents, error: studentErr } = await client.rpc(
      "get_active_class_students",
      { p_class_id: cleanClassId },
    );

    if (studentErr) {
      console.error("Error fetching active students:", studentErr);
      const message = getGradeErrorMessage(studentErr);
      setGradeTableMessage(tbody, message, 2);
      showToast(message, "error");
      return;
    }

    if (!activeStudents || activeStudents.length === 0) {
      tbody.innerHTML = `<tr><td colspan="2" style="text-align:center; padding: 16px; color: #dc2626;">No active students found for this class in database.</td></tr>`;
      return;
    }

    const numericMax =
      maxMarks !== null && maxMarks !== undefined && !isNaN(maxMarks)
        ? Number(maxMarks)
        : null;

    const maxAttr = numericMax !== null ? `max="${numericMax}"` : "";

    const activeStudentIds = activeStudents.map((student) => student.id);
    const { data: studentProfiles, error: profilesError } = await client
      .from("profiles")
      .select("id, photo_url")
      .in("id", activeStudentIds);
    if (profilesError) {
      console.error("Could not load grade roster profile photos:", profilesError);
    }
    const photoByStudentId = new Map(
      (studentProfiles || []).map((profile) => [profile.id, profile.photo_url]),
    );

    tbody.innerHTML = "";
    activeStudents.forEach((student) => {
      const studentCode = student.student_id || "N/A";
      const displayName = student.full_name || "Unknown Student";
      const photoUrl = escapeHTML(
        photoByStudentId.get(student.id) || window.DEFAULT_PROFILE_AVATAR || "",
      );

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td style="padding: 12px; font-weight: 500; color: #111827;">
          <span class="app-person-cell">
            <img class="app-person-avatar" src="${photoUrl}" alt="" loading="lazy" />
            <span class="app-person-meta">
              <span>${escapeHTML(displayName)}</span>
              <small class="app-person-id">Student ID: ${escapeHTML(studentCode)}</small>
            </span>
          </span>
        </td>
        <td class="form-group" style="padding: 12px;">
          <input
            type="number"
            class="student-score-input"
            data-student-id="${escapeHTML(student.id)}"
            value="0"
            aria-label="Score for ${escapeHTML(displayName)}"
            title="Enter a score, or leave 0 if no score was earned"
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
    const message = getGradeErrorMessage(err);
    setGradeTableMessage(tbody, message, 2);
    showToast(message, "error");
  }
}

function getGradeLocalDate(timestamp) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function escapeGradeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function getGradeCreatorProfiles(client, userIds) {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return new Map();

  const { data, error } = await client
    .from("profiles")
    .select(
      "id, full_name, photo_url, role, teachers(staff_id), students(student_id)",
    )
    .in("id", ids);

  if (error) throw error;
  return new Map((data || []).map((profile) => [profile.id, profile]));
}

async function getCurrentGradeActorMarkup(client) {
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error) throw error;
  if (!user) throw new Error("No authenticated user found.");

  const profiles = await getGradeCreatorProfiles(client, [user.id]);
  return renderGradeCreator(profiles.get(user.id));
}

function renderGradeCreator(profile) {
  if (!profile) {
    return `<span class="grade-creator-cell"><span class="grade-creator-meta"><span class="grade-creator-name">Unknown</span><small>No ID found</small></span></span>`;
  }

  const teacherId = profile.teachers?.staff_id;
  const studentId = profile.students?.student_id;
  const label = teacherId
    ? `Staff ID: ${teacherId}`
    : studentId
      ? `Student ID: ${studentId}`
      : "No ID found";
  const photo = profile.photo_url || window.DEFAULT_PROFILE_AVATAR || "";

  return `<span class="grade-creator-cell"><img class="app-person-avatar" src="${escapeGradeHtml(photo)}" alt="" loading="lazy" /><span class="grade-creator-meta"><span class="grade-creator-name">${escapeGradeHtml(profile.full_name || "Unknown")}</span><small>${escapeGradeHtml(label)}</small></span></span>`;
}

async function loadGradesList(options = {}) {
  const tbody = document.getElementById("gradesTableBody");
  if (!tbody) return;

  const append = options?.append === true;
  const nextButton = document.getElementById("nextGradesPage");

  if (gradeListIsLoading) {
    if (!append) gradeListRefreshPending = true;
    return;
  }
  if (append && !gradeListHasMore) return;

  if (!append) {
    gradeListOffset = 0;
    gradeListHasMore = true;
    gradeListRenderedCount = 0;
    tbody.innerHTML = "";
  }

  gradeListIsLoading = true;
  if (nextButton) {
    nextButton.disabled = true;
    nextButton.hidden = false;
    nextButton.textContent = "Loading...";
  }

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
  const selectedStatus = document.getElementById(
    "gradeToolbarStatusSelect",
  )?.value;
  const startDate = document.getElementById("gradeToolbarStartDate")?.value;

  try {
    const client = window.supabaseClient || supabaseClient;

    let query = client
      .from("grades")
      .select(
        `
        id,
        status,
        created_at,
        created_by,
        class_id,
        subject_id,
        category_id,
        assessment_categories ( name ),
        classes ( name ),
        subjects ( name ),
        grade_records ( count )
      `,
      )
      .order("created_at", { ascending: false });

    if (selectedClass) {
      query = query.eq("class_id", selectedClass);
    }
    if (selectedSubject) {
      query = query.eq("subject_id", selectedSubject);
    }
    if (selectedCategory) {
      query = query.eq("category_id", selectedCategory);
    }

    query = query
      .order("id", { ascending: false })
      .range(gradeListOffset, gradeListOffset + GRADE_LIST_PAGE_SIZE - 1);

    const { data: grades, error } = await query;

    if (error) throw error;

    if (!grades || grades.length === 0) {
      gradeListHasMore = false;
      if (gradeListRenderedCount === 0) {
        tbody.innerHTML = `
        <tr data-grade-empty="true">
          <td colspan="7" style="text-align: center; color: #888; padding: 20px;">
            No grade records found.
          </td>
        </tr>`;
      }
      return;
    }

    gradeListOffset += grades.length;
    gradeListHasMore = grades.length === GRADE_LIST_PAGE_SIZE;

    const filteredGrades = grades.filter((item) => {
      const normalizedStatus = (item.status || "drafted").toLowerCase();
      const itemStatus = normalizedStatus.includes("draft")
        ? "drafted"
        : "submitted";
      const itemDate = getGradeLocalDate(item.created_at);
      if (selectedStatus && itemStatus !== selectedStatus) return false;
      if (startDate && itemDate !== startDate) return false;
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
      if (gradeListRenderedCount === 0) {
        tbody.innerHTML = `
        <tr data-grade-empty="true">
          <td colspan="7" style="text-align: center; color: #888; padding: 20px;">
            No grade records on this page match the selected filters.
          </td>
        </tr>`;
      }
      return;
    }

    tbody.querySelector('[data-grade-empty="true"]')?.remove();
    tbody.insertAdjacentHTML("beforeend", filteredGrades
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
        const studentCount = item.grade_records?.[0]?.count ?? 0;
        const displayStatus = isDraft ? "Drafted" : "Submitted";

        const actionButtonHTML = isDraft
          ? `<button class="grades-actions-btn edit" title="Edit Grades" data-action="edit" data-grade-id="${gradeId}">
               <i class="fa-solid fa-pen"></i>
             </button>`
          : `<button class="grades-actions-btn view" title="View Grades" data-action="view" data-grade-id="${gradeId}">
               <i class="fa-solid fa-eye"></i>
             </button>`;

        return `
          <tr data-grade-id="${gradeId}" data-class-id="${item.class_id || ""}" data-subject-id="${item.subject_id || ""}" data-category-id="${item.category_id || ""}">
            <td>${categoryName}</td>
            <td>${className}</td>
            <td>${subjectName}</td>
            <td>${formattedDate}</td>
            <td>${studentCount}</td>
            <td><span class="badge ${isDraft ? "badge-drafted" : "badge-submitted"}">${displayStatus}</span></td>
            <td>${actionButtonHTML}</td>
          </tr>
        `;
      })
      .join(""));
    gradeListRenderedCount += filteredGrades.length;
  } catch (err) {
    console.error("Error loading grades list:", err);
    if (!append && gradeListRenderedCount === 0) {
      gradeListHasMore = false;
      setGradeTableMessage(tbody, getGradeErrorMessage(err));
    }
    if (typeof showToast === "function") {
      showToast(getGradeErrorMessage(err), "error");
    }
  } finally {
    gradeListIsLoading = false;
    if (nextButton) {
      nextButton.hidden = !gradeListHasMore;
      nextButton.disabled = false;
      nextButton.textContent = "Next";
    }
    if (gradeListRefreshPending) {
      gradeListRefreshPending = false;
      loadGradesList();
    }
  }
}

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
  document.getElementById("viewModalCreator").innerHTML = skeletonText;

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
        created_by,
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
            profiles ( full_name, photo_url )
          )
        )
      `,
      )
      .eq("id", gradeId)
      .single();

    if (error) throw error;
    const creatorProfiles = await getGradeCreatorProfiles(client, [
      grade.created_by,
    ]);

    const escapeHtml = (str) =>
      String(str ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

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
    document.getElementById("viewModalCreator").innerHTML = renderGradeCreator(
      creatorProfiles.get(grade.created_by),
    );

    const tbody = document.getElementById("viewGradeTableBody");
    const records = grade.grade_records || [];
    const identitySnapshots =
      await window.loadTransferredStudentIdentitySnapshots(
        records.map((record) => record.student_id),
      );

    if (records.length === 0) {

      tbody.innerHTML = `<tr><td colspan="2" style="text-align: center; color: #888;">No student marks recorded.</td></tr>`;
    } else {

      tbody.innerHTML = records
        .map((rec) => {
          const snapshot = identitySnapshots.get(rec.student_id);
          const idDisplay = escapeHtml(
            rec.students?.student_id ||
              snapshot?.student_code_snapshot ||
              "-",
          );
          const studentName = escapeHtml(
            rec.students?.profiles?.full_name ||
              snapshot?.student_name_snapshot ||
              "-",
          );
          const studentPhoto = escapeHtml(
            rec.students?.profiles?.photo_url ||
              snapshot?.student_photo_snapshot ||
              window.DEFAULT_PROFILE_AVATAR ||
              "",
          );
          const scoreDisplay = escapeHtml(rec.score ?? "-");

          return `
            <tr>
              <td>
                <span class="app-person-cell">
                  <img class="app-person-avatar" src="${studentPhoto}" alt="" loading="lazy" />
                  <span class="app-person-meta">
                    <span>${studentName}</span>
                    <small class="app-person-id">Student ID: ${idDisplay}</small>
                  </span>
                </span>
              </td>
              <td><p>${scoreDisplay}</p></td>
            </tr>`;
        })
        .join("");
    }

    openModal(modal);
  } catch (err) {
    console.error("Error opening view modal:", err);
    const tbody = document.getElementById("viewGradeTableBody");
    setGradeTableMessage(tbody, getGradeErrorMessage(err), 2);
    [
      "viewModalClass",
      "viewModalSubject",
      "viewModalAssessment",
      "viewModalAssessmentPeriod",
      "viewModalAcademicYear",
      "viewModalSemester",
      "viewModalDate",
      "viewModalCreator",
    ].forEach((id) => {
      const element = document.getElementById(id);
      if (element) element.textContent = "Unavailable";
    });
    if (typeof showToast === "function") showToast(getGradeErrorMessage(err), "error");
  }
}

async function handleEditGrades(gradeId) {
  if (!gradeId || gradeId === "undefined") {
    console.error("handleEditGrades received invalid gradeId:", gradeId);
    if (typeof showToast === "function") showToast("Invalid Grade ID", "error");
    return;
  }

  const modal = document.getElementById("editGradeModal");
  if (!modal) return;

  currentEditGradeId = gradeId;

  const escapeHtml = (str) =>
    String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const skeletonText = `<span class="skeleton-text">Loading...</span>`;
  document.getElementById("editModalClass").innerHTML = skeletonText;
  document.getElementById("editModalSubject").innerHTML = skeletonText;
  document.getElementById("editModalAssessment").innerHTML = skeletonText;
  document.getElementById("editModalAssessmentPeriod").innerHTML = skeletonText;
  document.getElementById("editModalAcademicYear").innerHTML = skeletonText;
  document.getElementById("editModalSemester").innerHTML = skeletonText;
  document.getElementById("editModalDate").innerHTML = skeletonText;
  document.getElementById("editModalCreator").innerHTML = skeletonText;

  const elMaxMarks = document.getElementById("editModalMaxMarks");
  if (elMaxMarks) elMaxMarks.innerHTML = skeletonText;

  const tbody = document.getElementById("editGradeTableBody");
  if (tbody) tbody.innerHTML = `<tr><td colspan="2" style="text-align: center; color: #888;">Loading records...</td></tr>`;

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
        created_by,
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
            profiles ( full_name, photo_url )
          )
        )
      `,
      )
      .eq("id", gradeId)
      .single();

    if (error) throw error;
    const creatorProfiles = await getGradeCreatorProfiles(client, [
      grade.created_by,
    ]);

    const categoryMax =
      grade.assessment_categories?.marks != null
        ? Number(grade.assessment_categories.marks)
        : null;

    const periodMax =
      grade.assessments?.maximum_marks != null
        ? Number(grade.assessments.maximum_marks)
        : null;

    const effectiveMax = Math.min(
      categoryMax ?? Infinity,
      periodMax ?? Infinity,
    );
    const finalMaxMarks = isFinite(effectiveMax) ? effectiveMax : null;

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

    const elMaxMarks = document.getElementById("editModalMaxMarks");
    if (elMaxMarks) {
      elMaxMarks.textContent =
        finalMaxMarks !== null ? `${finalMaxMarks} Marks` : "No Limit";
    }

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
    document.getElementById("editModalCreator").innerHTML = renderGradeCreator(
      creatorProfiles.get(grade.created_by),
    );

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
    const identitySnapshots =
      await window.loadTransferredStudentIdentitySnapshots(
        records.map((record) => record.student_id),
      );

    if (records.length === 0) {

      tbody.innerHTML = `<tr><td colspan="2" style="text-align: center; color: #888;">No student records found.</td></tr>`;
    } else {

      tbody.innerHTML = records
        .map((rec) => {
          const snapshot = identitySnapshots.get(rec.student_id);
          const studentName = escapeHtml(
            rec.students?.profiles?.full_name ||
              snapshot?.student_name_snapshot ||
              "-",
          );
          const studentId = escapeHtml(
            rec.students?.student_id ||
              snapshot?.student_code_snapshot ||
              "-",
          );
          const studentPhoto = escapeHtml(
            rec.students?.profiles?.photo_url ||
              snapshot?.student_photo_snapshot ||
              window.DEFAULT_PROFILE_AVATAR ||
              "",
          );
          const scoreVal = rec.score ?? "";

          return `
 <tr data-record-id="${rec.id}">
          <td>
            <span class="app-person-cell">
              <img class="app-person-avatar" src="${studentPhoto}" alt="" loading="lazy" />
              <span class="app-person-meta">
                <span>${studentName}</span>
                <small class="app-person-id">Student ID: ${studentId}</small>
              </span>
            </span>
          </td>
          <td class="form-group">
            <input
              type="number"
              class="edit-score-input"
              data-record-id="${rec.id}"
              data-student-id="${escapeHTML(rec.student_id)}"
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
    setGradeTableMessage(tbody, getGradeErrorMessage(err), 2);
    if (typeof showToast === "function") showToast(getGradeErrorMessage(err), "error");
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

    const row = btn.closest("tr");
    const gradeId =
      btn.getAttribute("data-grade-id") || row?.getAttribute("data-grade-id");

    if (!gradeId || gradeId === "undefined") {
      console.error("Unable to locate valid gradeId on target:", btn);
      return;
    }

    try {

      btn.disabled = true;

      if (action === "view") {
        openModal(document.getElementById("viewGradeModal"));
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

  initToolbarListeners();
  await populateToolbarDropdowns();

  await loadAcademicContext();
  await populateClassOptions();
});

document
  .getElementById("editGradeForm")
  ?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentEditGradeId) return;

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

    if (!hasStatusChanged && !hasScoresChanged) {
      if (typeof showToast === "function") {
        showToast("No changes detected.", "info");
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

      const updatePromises = Array.from(inputs).map(async (input) => {
        const recordId = input.dataset.recordId;
        const studentId = input.dataset.studentId;
        const rawVal = input.value.trim();

        let score = null;
        if (rawVal !== "") {
          const parsed = parseFloat(rawVal);
          if (isNaN(parsed))
            throw new Error(`Invalid score number for student record.`);
          score = parsed;
        }

        updatedRecordsInfo.push({ student_id: studentId, score: score });

        const { data, error } = await client
          .from("grade_records")
          .update({ score: score })
          .eq("id", recordId)
          .select("id")
          .maybeSingle();
        if (error) throw error;
        if (!data) {
          throw new Error("The grade record was not updated. It may have changed or your access may have been removed.");
        }
      });

      const updateResults = await Promise.allSettled(updatePromises);
      const failedUpdates = updateResults.filter((result) => result.status === "rejected");
      if (failedUpdates.length) {
        const updateError = failedUpdates[0].reason;
        updateError.partialGradeUpdate = updateResults.some((result) => result.status === "fulfilled");
        throw updateError;
      }

      if (hasStatusChanged) {
        const { data: updatedGrade, error: gradeErr } = await client
          .from("grades")
          .update({ status: currentStatus })
          .eq("id", currentEditGradeId)
          .select("id")
          .maybeSingle();

        if (gradeErr) {
          gradeErr.partialGradeUpdate = hasScoresChanged;
          throw gradeErr;
        }
        if (!updatedGrade) {
          const noUpdateError = new Error("The grade record was not updated. It may have changed or your access may have been removed.");
          noUpdateError.partialGradeUpdate = hasScoresChanged;
          throw noUpdateError;
        }
      }

      const isSubmittedState = currentStatus === "submitted";
      let notificationFailed = false;

      if (isSubmittedState && typeof window.sendNotification === "function") {
        const notificationResults = await Promise.allSettled(
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
        notificationFailed = notificationResults.some(
          (result) => result.status === "rejected" || result.value?.success === false,
        );
      }

      if (typeof showToast === "function") {
        showToast(
          notificationFailed
            ? "Grades were updated, but some student notifications could not be sent."
            : "Grades updated successfully!",
          notificationFailed ? "error" : "success",
        );
      }

      closeModal(document.getElementById("editGradeModal"));
      if (typeof loadGradesList === "function") loadGradesList();
    } catch (err) {
      console.error("Error saving updated grades:", err);
      if (typeof showToast === "function") {
        showToast(getGradeErrorMessage(err, "save"), "error");
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
      }
    }
  });

async function populateToolbarDropdowns() {
  const classFilter = document.getElementById("gradeToolbarClassSelect");
  const subjectFilter = document.getElementById("gradeToolbarSubjectSelect");
  const categoryFilter = document.getElementById("gradeToolbarCategorySelect");

  const client = window.supabaseClient || supabaseClient;
  let filterResults;

  try {
    filterResults = await Promise.all([
      client.from("classes").select("id, name").order("name"),
      client.from("subjects").select("id, name").order("name"),
      client.from("assessment_categories").select("id, name").order("name"),
    ]);
    const [classRes, subjectRes, categoryRes] = filterResults;

    if (classFilter && classRes.data) {
      classFilter.innerHTML = `<option value="">All Classes</option>`;
      classRes.data.forEach((c) => {
        classFilter.appendChild(new Option(c.name, c.id));
      });
    }

    if (subjectFilter && subjectRes.data) {
      subjectFilter.innerHTML = `<option value="">All Subjects</option>`;
      subjectRes.data.forEach((s) => {
        subjectFilter.appendChild(new Option(s.name, s.id));
      });
    }

    if (categoryFilter && categoryRes.data) {
      categoryFilter.innerHTML = `<option value="">All Assessment Categories</option>`;
      categoryRes.data.forEach((cat) => {
        categoryFilter.appendChild(new Option(cat.name, cat.id));
      });
    }
  } catch (err) {
    console.error("Error populating toolbar filters:", err);
    showToast(getGradeErrorMessage(err), "error");
    return;
  }

  const [classRes, subjectRes, categoryRes] = filterResults;
  const failedFilter = [classRes.error, subjectRes.error, categoryRes.error].find(Boolean);
  if (failedFilter) {
    console.error("One or more grade filters could not be loaded:", failedFilter);
    showToast(getGradeErrorMessage(failedFilter), "error");
  }
  if (classFilter && classRes.error) classFilter.replaceChildren(new Option("Classes unavailable", ""));
  if (subjectFilter && subjectRes.error) subjectFilter.replaceChildren(new Option("Subjects unavailable", ""));
  if (categoryFilter && categoryRes.error) categoryFilter.replaceChildren(new Option("Categories unavailable", ""));
}

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
  const statusFilter = document.getElementById("gradeToolbarStatusSelect");
  const startDateFilter = document.getElementById("gradeToolbarStartDate");
  const nextButton = document.getElementById("nextGradesPage");

  if (searchInput) searchInput.addEventListener("input", loadGradesList);
  if (classFilter) classFilter.addEventListener("change", loadGradesList);
  if (subjectFilter) subjectFilter.addEventListener("change", loadGradesList);
  if (categoryFilter) categoryFilter.addEventListener("change", loadGradesList);
  if (statusFilter) statusFilter.addEventListener("change", loadGradesList);
  if (startDateFilter) startDateFilter.addEventListener("change", loadGradesList);
  if (nextButton) {
    nextButton.addEventListener("click", () => loadGradesList({ append: true }));
  }
}
