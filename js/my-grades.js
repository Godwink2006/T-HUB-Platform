let cachedStudentGrades = [];
let cachedStudentGradeCreators = new Map();
let studentTerms = [];

function getOneRelation(value) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function getSemesterNumber(termName) {
  const name = String(termName || "");
  if (/\b(?:1(?:st)?|first|term\s*1|semester\s*1|one|i)\b/i.test(name)) {
    return 1;
  }
  if (/\b(?:2(?:nd)?|second|term\s*2|semester\s*2|two|ii)\b/i.test(name)) {
    return 2;
  }
  return null;
}

document.addEventListener("DOMContentLoaded", async () => {
  await initStudentContext();
});

async function initStudentContext() {
  const client = window.supabaseClient || supabaseClient;
  const reportContainer = document.getElementById("studentGradesReport");
  const applyButton = document.getElementById("applyStudentGradeFilters");

  try {
    const {
      data: { user },
      error: userError,
    } = await client.auth.getUser();

    if (userError || !user) {
      throw new Error("Please sign in to view your grades.");
    }

    if (reportContainer) {
      reportContainer.innerHTML = `
        <p style="text-align:center;color:#888;padding:20px;">
          Loading your published grades and filter options...
        </p>`;
    }

    const historyIndex = await window.getStudentTransferHistoryIndex(client);
    const historicalGradeIds = historyIndex?.recordIds?.grade || new Set();

    const { data, error } = await client
      .from("grade_records")
      .select(`
        id,
        score,
        remarks,
        created_at,
        student_id,
        grades!inner (
          id,
          status,
          created_by,
          date_recorded,
          term_id,
          academic_year_id,
          assessment_id,
          class_id,
          subject_id,
          subjects ( id, name ),
          terms ( id, name, academic_year_id ),
          academic_years ( id, year_label ),
          assessments ( id, name, maximum_marks ),
          assessment_categories ( id, name, marks ),
          classes ( id, name )
        )
      `)
      .eq("student_id", user.id)
      .eq("grades.status", "submitted")
      .order("created_at", { ascending: false });

    if (error) throw error;

    cachedStudentGrades = (data || [])
      .filter((record) => !historicalGradeIds.has(String(record.id)))
      .map((record) => ({
        ...record,
        grades: getOneRelation(record.grades),
      }))
      .filter((record) => record.grades);

    cachedStudentGradeCreators = new Map();
    const gradeClassIds = [
      ...new Set(
        cachedStudentGrades
          .map((record) => record.grades.class_id)
          .filter(Boolean)
          .map(String),
      ),
    ];
    const teacherNameResults = await Promise.all(
      gradeClassIds.map((classId) =>
        client.rpc("student_timetable_teacher_names", { p_class_id: classId }),
      ),
    );
    for (const result of teacherNameResults) {
      if (result.error) {
        console.warn("Could not load assigned teacher names for grades:", result.error);
        continue;
      }
      for (const teacher of result.data || []) {
        if (teacher?.teacher_id && teacher.full_name) {
          cachedStudentGradeCreators.set(String(teacher.teacher_id), {
            full_name: teacher.full_name,
            role: "teacher",
          });
        }
      }
    }

    const gradeYearIds = [
      ...new Set(
        cachedStudentGrades
          .map((record) => record.grades.academic_year_id)
          .filter(Boolean)
          .map(String),
      ),
    ];

    studentTerms = [];
    if (gradeYearIds.length) {
      const { data: terms, error: termsError } = await client
        .from("terms")
        .select("id, name, academic_year_id")
        .in("academic_year_id", gradeYearIds);

      if (termsError) {
        console.error("Error loading semester labels:", termsError);
        studentTerms = cachedStudentGrades
          .map((record) => getOneRelation(record.grades.terms))
          .filter(Boolean);
      } else {
        studentTerms = terms || [];
      }
    }

    const yearSelect = document.getElementById("studentAcademicYearSelect");
    const termSelect = document.getElementById("studentTermSelect");
    const assessmentSelect = document.getElementById("studentAssessmentSelect");
    const classSelect = document.getElementById("studentClassSelect");
    const subjectSelect = document.getElementById("studentSubjectSelect");
    const statusBadge = document.getElementById("studentStatusBadge");

    const years = new Map();
    const assessments = new Map();
    const classes = new Map();
    const subjects = new Map();

    cachedStudentGrades.forEach((record) => {
      const grade = record.grades;
      const year = getOneRelation(grade.academic_years);
      const assessment = getOneRelation(grade.assessments);
      const schoolClass = getOneRelation(grade.classes);
      const subject = getOneRelation(grade.subjects);

      if (year?.id) years.set(String(year.id), year.year_label || "Academic year");
      if (assessment?.id) assessments.set(String(assessment.id), assessment.name || "Assessment");
      if (schoolClass?.id) classes.set(String(schoolClass.id), schoolClass.name || "Class");
      if (subject?.id) subjects.set(String(subject.id), subject.name || "Subject");
    });

    fillFilterSelect(yearSelect, "Select Academic Year", years, true);
    fillFilterSelect(assessmentSelect, "All Assessments", assessments);
    fillFilterSelect(classSelect, "All Classes", classes);
    fillFilterSelect(subjectSelect, "All Subjects", subjects);

    if (termSelect) {
      termSelect.innerHTML = `
        <option value="">Select Semester</option>
        <option value="1">1st Semester</option>
        <option value="2">2nd Semester</option>`;
    }

    if (statusBadge) {
      statusBadge.textContent = "Choose filters";
      statusBadge.className = "status-badge normal";
    }

    applyButton?.addEventListener("click", () => loadStudentGrades(user.id));

    if (!cachedStudentGrades.length && reportContainer) {
      reportContainer.innerHTML = `
        <p style="text-align:center;color:#888;padding:20px;">
          No published grades are available yet.
        </p>`;
    } else if (reportContainer) {
      reportContainer.innerHTML = `
        <p style="text-align:center;color:#888;padding:20px;">
          Choose an academic year and semester, adjust any other filters, then select View grades.
        </p>`;
    }
  } catch (error) {
    console.error("Error initializing My Grades:", error);
    if (reportContainer) {
      reportContainer.innerHTML = `
        <p style="text-align:center;color:#ef4444;padding:20px;">
          ${escapeHTML(error.message || "Could not load your grade filters.")}
        </p>`;
    }
  }
}

function fillFilterSelect(select, placeholder, values, required = false) {
  if (!select) return;

  select.replaceChildren();
  const placeholderOption = document.createElement("option");
  placeholderOption.value = "";
  placeholderOption.textContent = placeholder;
  select.appendChild(placeholderOption);

  const options = [...values.entries()].sort((a, b) =>
    String(a[1]).localeCompare(String(b[1]), undefined, {
      numeric: true,
      sensitivity: "base",
    }),
  );

  options.forEach(([id, label]) => {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = label;
    select.appendChild(option);
  });

  select.required = required;
}

async function loadStudentStatusForTerm(studentId, academicYearId, termId) {
  const badge = document.getElementById("studentStatusBadge");
  if (!badge) return;

  if (!termId) {
    badge.textContent = "No term";
    badge.className = "status-badge normal";
    return;
  }

  try {
    const client = window.supabaseClient || supabaseClient;
    const { data, error } = await client
      .from("student_enrollments")
      .select("enrollment_status")
      .eq("student_id", studentId)
      .eq("academic_year_id", academicYearId)
      .eq("term_id", termId)
      .maybeSingle();

    if (error) throw error;

    const status = data?.enrollment_status || "Normal";
    badge.textContent = status;
    badge.className = `status-badge ${String(status).toLowerCase()}`;
  } catch (error) {
    console.error("Error loading term status:", error);
    badge.textContent = "Unavailable";
    badge.className = "status-badge normal";
  }
}

async function loadStudentGrades(authUserId) {
  const reportContainer = document.getElementById("studentGradesReport");
  const applyButton = document.getElementById("applyStudentGradeFilters");
  const yearId = document.getElementById("studentAcademicYearSelect")?.value || "";
  const semesterNumber = Number(document.getElementById("studentTermSelect")?.value || 0);
  const assessmentId = document.getElementById("studentAssessmentSelect")?.value || "";
  const classId = document.getElementById("studentClassSelect")?.value || "";
  const subjectId = document.getElementById("studentSubjectSelect")?.value || "";

  if (!reportContainer) return;

  if (!yearId || ![1, 2].includes(semesterNumber)) {
    reportContainer.innerHTML = `
      <p style="text-align:center;color:#888;padding:20px;">
        Please choose an academic year and either the 1st or 2nd semester.
      </p>`;
    const badge = document.getElementById("studentStatusBadge");
    if (badge) {
      badge.textContent = "Choose filters";
      badge.className = "status-badge normal";
    }
    return;
  }

  const selectedTerm = studentTerms.find(
    (term) =>
      String(term.academic_year_id) === String(yearId) &&
      getSemesterNumber(term.name) === semesterNumber,
  );

  if (applyButton) {
    applyButton.disabled = true;
    applyButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Loading...';
  }
  reportContainer.innerHTML = `
    <p style="text-align:center;color:#888;padding:20px;">Loading your grades...</p>`;

  try {
    await loadStudentStatusForTerm(authUserId, yearId, selectedTerm?.id);

    const records = cachedStudentGrades.filter((record) => {
      const grade = record.grades;
      const term = getOneRelation(grade.terms);
      const matchesYear = String(grade.academic_year_id) === String(yearId);
      const matchesSemester = getSemesterNumber(term?.name) === semesterNumber;
      const matchesAssessment = !assessmentId || String(grade.assessment_id) === String(assessmentId);
      const matchesClass = !classId || String(grade.class_id) === String(classId);
      const matchesSubject = !subjectId || String(grade.subject_id) === String(subjectId);

      return (
        matchesYear &&
        matchesSemester &&
        matchesAssessment &&
        matchesClass &&
        matchesSubject
      );
    });

    if (!records.length) {
      reportContainer.innerHTML = `
        <p style="text-align:center;color:#888;padding:20px;">
          No published grades match the selected filters.
        </p>`;
      return;
    }

    const grouped = new Map();
    records.forEach((record) => {
      const grade = record.grades;
      const subject = getOneRelation(grade.subjects);
      const category = getOneRelation(grade.assessment_categories);
      const subjectName = subject?.name || "General Subject";
      const categoryName = category?.name || "Assessment";

      if (!grouped.has(subjectName)) grouped.set(subjectName, []);
      grouped.get(subjectName).push({
        categoryName,
        score: record.score,
        weight: category?.marks ?? "-",
        creatorId: grade.created_by ? String(grade.created_by) : null,
      });
    });

    let html = renderStudentGradesStats(records);
    grouped.forEach((items, subjectName) => {
      html += `
        <div class="card" style="margin-bottom:20px;background:#fff;border:0.5px solid rgb(219,215,215);padding:16px;">
          <h3>${escapeHTML(subjectName)}</h3>
          <div class="table-responsive">
            <table class="table" style="width:100%;border-collapse:collapse;min-width:480px;">
              <thead>
                <tr><th>Category</th><th>Score</th><th>Max Marks</th><th>Entered by</th></tr>
              </thead>
              <tbody>
                ${items.map((item) => `
                  <tr>
                    <td>${escapeHTML(item.categoryName)}</td>
                    <td><strong>${item.score ?? "N/A"}</strong></td>
                    <td>${item.weight}</td>
                    <td>${renderStudentGradeAuthor(cachedStudentGradeCreators.get(item.creatorId), item.creatorId)}</td>
                  </tr>`).join("")}
              </tbody>
            </table>
          </div>
        </div>`;
    });

    reportContainer.innerHTML = html;
  } catch (error) {
    console.error("Error loading student grades:", error);
    reportContainer.innerHTML = `
      <p style="text-align:center;color:#ef4444;padding:20px;">
        Failed to load grades: ${escapeHTML(error.message || "Unknown error")}
      </p>`;
  } finally {
    if (applyButton) {
      applyButton.disabled = false;
      applyButton.innerHTML = '<i class="fa-solid fa-filter" aria-hidden="true"></i> View grades';
    }
  }
}

function renderStudentGradeAuthor(profile, profileId) {
  if (!profile) {
    return `<span class="table-muted">${profileId ? "Name unavailable" : "Unknown"}</span>`;
  }

  const name = escapeHTML(profile.full_name || "Unknown");
  const role = profile.role
    ? escapeHTML(String(profile.role).charAt(0).toUpperCase() + String(profile.role).slice(1).toLowerCase())
    : "";
  const staffId = profile.teachers?.staff_id
    ? escapeHTML(profile.teachers.staff_id)
    : "";
  const details = [role, staffId].filter(Boolean).join(" · ");

  return `<span><strong>${name}</strong>${details ? `<small style="display:block;color:#718096;">${details}</small>` : ""}</span>`;
}

function renderStudentGradesStats(records) {
  let totalScore = 0;
  let totalMax = 0;
  let validCount = 0;
  let passedCount = 0;
  let sumPercentages = 0;

  records.forEach((rec) => {
    const grade = rec.grades || {};
    const category = getOneRelation(grade.assessment_categories) || {};
    const score = Number(rec.score);
    const categoryMax = Number(category.marks);

    if (Number.isFinite(score)) {
      totalScore += score;
    }
    if (Number.isFinite(categoryMax) && categoryMax > 0) {
      totalMax += categoryMax;
      if (Number.isFinite(score)) {
        const percentage = (score / categoryMax) * 100;
        sumPercentages += percentage;
        validCount++;
        if (percentage >= 70) passedCount++;
      }
    }
  });

  const avgPct = validCount
    ? totalMax > 0
      ? (totalScore / totalMax) * 100
      : sumPercentages / validCount
    : 0;

  const letterGrade =
    avgPct >= 90
      ? "A"
      : avgPct >= 80
        ? "B"
        : avgPct >= 70
          ? "C"
          : avgPct >= 60
            ? "D"
            : "F";

  const gradeClass =
    avgPct >= 80 ? "text-green" : avgPct >= 70 ? "text-amber" : "text-red";

  return `
    <div class="stats-grid">
      <div class="stat-card">
        <span class="stat-label">Average Category Score</span>
        <span class="stat-value ${gradeClass}">${validCount > 0 ? avgPct.toFixed(1) + "%" : "-"}</span>
        <span class="stat-sub">${validCount > 0 ? `Grade ${letterGrade} performance` : "No scores yet"}</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">Total Points</span>
        <span class="stat-value" style="color: #2563eb;">${totalScore}${totalMax > 0 ? ` <small style="font-size:1rem;color:#8b99ad;">/ ${totalMax}</small>` : ""}</span>
        <span class="stat-sub">Cumulative marks scored</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">Assessment Categories</span>
        <span class="stat-value">${validCount}</span>
        <span class="stat-sub">${validCount > 0 ? `${passedCount} of ${validCount} passed (≥70%)` : "Recorded grades"}</span>
      </div>
    </div>
  `;
}

