document.addEventListener("DOMContentLoaded", async () => {
  const auth = await ReportsCommon.initAuth();
  if (!auth) return;

  const client = window.supabaseClient || supabaseClient;
  const schoolId = auth.profile?.school_id;
  const yearSelect = document.getElementById("reportYear");
  const termSelect = document.getElementById("reportTerm");
  const assessmentSelect = document.getElementById("reportAssessment");
  const classPeriodSelect = document.getElementById("reportClassPeriod");
  const classSelect = document.getElementById("reportClass");
  const searchInput = document.getElementById("studentSearch");
  const rowsBody = document.getElementById("studentRows");
  const summary = document.getElementById("rosterSummary");
  const previousButton = document.getElementById("previousPage");
  const nextButton = document.getElementById("nextPage");
  const pageLabel = document.getElementById("pageLabel");
  const modal = document.getElementById("reportModal");
  const reportContent = document.getElementById("reportContent");
  const PAGE_SIZE = 40;

  let years = [];
  let terms = [];
  let currentPage = 0;
  let requestVersion = 0;
  let activeStudent = null;
  let rosterStudents = [];
  let allRosterStudents = [];
  let assessmentRequestVersion = 0;

  if (!schoolId) {
    showRosterMessage("Your user profile is not linked to a school.", true);
    return;
  }

  await loadFilters();
  [yearSelect, termSelect, classSelect].forEach((select) =>
    select.addEventListener("change", () => {
      currentPage = 0;
      updateTerms();
      loadRoster();
      loadAssessments();
    }),
  );
  let searchTimer;
  searchInput.addEventListener("input", () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => {
      currentPage = 0;
      filterRoster();
    }, 250);
  });
  document.getElementById("refreshRoster").addEventListener("click", loadRoster);
  previousButton.addEventListener("click", () => {
    if (currentPage > 0) {
      currentPage -= 1;
      renderRoster();
      updatePager(rosterStudents.length);
    }
  });
  nextButton.addEventListener("click", () => {
    currentPage += 1;
    renderRoster();
    updatePager(rosterStudents.length);
  });
  rowsBody.addEventListener("click", (event) => {
    const button = event.target.closest("[data-report-student]");
    if (!button) return;
    const student = rosterStudents.find((item) => item.student_id === button.dataset.reportStudent);
    if (student) openReport(student, button.dataset.print === "true");
  });
  document.getElementById("closeReport").addEventListener("click", closeReport);
  modal.addEventListener("click", (event) => {
    if (event.target.hasAttribute("data-close-report")) closeReport();
  });
  document.getElementById("printReport").addEventListener("click", () => window.print());
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) closeReport();
  });

  async function loadFilters() {
    const [yearResult, termResult, classResult, periodResult] = await Promise.all([
      client.from("academic_years").select("id,year_label,status").eq("school_id", schoolId).order("year_label", { ascending: false }),
      client.from("terms").select("id,name,academic_year_id,status,is_archived,start_date,end_date").eq("school_id", schoolId).order("start_date", { ascending: true }),
      client.from("classes").select("id,name,status,is_archived").eq("school_id", schoolId).order("name"),
      client.from("periods").select("id,name").order("name"),
    ]);
    const failure = yearResult.error || termResult.error || classResult.error;
    if (failure) {
      showRosterMessage(failure.message || "Could not load report filters.", true);
      return;
    }

    years = (yearResult.data || []).filter((year) => year.status?.toLowerCase() !== "deleted");
    terms = (termResult.data || []).filter((term) => !term.is_archived);
    const classes = (classResult.data || []).filter((item) => !item.is_archived);
    ReportsCommon.populateSelect(yearSelect, years, { placeholder: "Choose academic year", labelKey: "year_label" });
    ReportsCommon.populateSelect(classSelect, classes, { placeholder: "All classes" });
    if (periodResult.error) console.warn("Could not load class periods:", periodResult.error.message);
    ReportsCommon.populateSelect(classPeriodSelect, periodResult.data || [], { placeholder: "All class periods", labelKey: "name" });

    const activeYear = years.find((year) => String(year.status || "").trim().toLowerCase() === "active");
    if (activeYear) yearSelect.value = activeYear.id;
    updateTerms();
    await Promise.all([loadRoster(), loadAssessments()]);
  }

  function updateTerms() {
    const selectedYear = yearSelect.value;
    const yearTerms = terms.filter((term) => !selectedYear || term.academic_year_id === selectedYear);
    const previous = termSelect.value;
    ReportsCommon.populateSelect(termSelect, yearTerms, { placeholder: "All terms / semesters" });
    if (yearTerms.some((term) => term.id === previous)) termSelect.value = previous;
  }

  async function loadRoster() {
    const version = ++requestVersion;
    const yearId = yearSelect.value;
    if (!yearId) {
      rosterStudents = [];
      allRosterStudents = [];
      showRosterMessage("Choose an academic year to load enrolled students.");
      summary.textContent = "Choose a school year to load enrolled students.";
      updatePager(0);
      return;
    }

    showRosterMessage("Loading enrolled students…");
    let query = client
      .from("student_enrollments")
      .select("id,student_id,school_id,class_id,academic_year_id,term_id,enrollment_status,student_name_snapshot,student_code_snapshot,student_photo_snapshot,created_at,classes(name)")
      .eq("school_id", schoolId)
      .eq("academic_year_id", yearId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: true });

    if (classSelect.value) query = query.eq("class_id", classSelect.value);
    if (termSelect.value) query = query.eq("term_id", termSelect.value);

    const enrollmentRows = [];
    const batchSize = 500;
    for (let offset = 0; ; offset += batchSize) {
      const { data, error } = await query.range(offset, offset + batchSize - 1);
      if (version !== requestVersion) return;
      if (error) {
        rosterStudents = [];
        allRosterStudents = [];
        showRosterMessage(error.message || "Could not load student enrollments.", true);
        summary.textContent = "Student list could not be loaded.";
        updatePager(0);
        return;
      }
      enrollmentRows.push(...(data || []));
      if (!data || data.length < batchSize) break;
    }

    const unique = new Map();
    for (const enrollment of enrollmentRows) {
      if (!unique.has(enrollment.student_id)) unique.set(enrollment.student_id, enrollment);
    }
    allRosterStudents = await resolveRosterIdentity([...unique.values()]);
    if (version !== requestVersion) return;
    allRosterStudents.sort((a, b) =>
      String(a.student_name_snapshot || "").localeCompare(String(b.student_name_snapshot || "")),
    );
    filterRoster();
    const yearLabel = years.find((year) => year.id === yearId)?.year_label || "selected year";
    summary.textContent = `${rosterStudents.length} student${rosterStudents.length === 1 ? "" : "s"} · ${yearLabel}${termSelect.value ? ` · ${terms.find((term) => term.id === termSelect.value)?.name || "selected term"}` : " · all terms"}`;
    updatePager(rosterStudents.length);
  }

  async function resolveRosterIdentity(students) {
    const resolved = new Map();
    const ids = students.map((student) => student.student_id).filter(Boolean);
    for (let offset = 0; offset < ids.length; offset += 100) {
      const { data, error } = await client
        .from("students")
        .select("id,student_id,profiles(full_name)")
        .eq("school_id", schoolId)
        .in("id", ids.slice(offset, offset + 100));
      if (error) {
        console.warn("Could not resolve report roster student names/IDs:", error.message);
        continue;
      }
      (data || []).forEach((record) => resolved.set(record.id, record));
    }
    return students.map((student) => {
      const record = resolved.get(student.student_id);
      return {
        ...student,
        student_name_snapshot:
          student.student_name_snapshot || record?.profiles?.full_name || "Student",
        student_code_snapshot:
          student.student_code_snapshot || record?.student_id || "—",
      };
    });
  }

  function filterRoster() {
    const search = searchInput.value.trim().toLocaleLowerCase();
    rosterStudents = search
      ? allRosterStudents.filter((student) =>
          `${student.student_name_snapshot || ""} ${student.student_code_snapshot || ""}`
            .toLocaleLowerCase()
            .includes(search),
        )
      : [...allRosterStudents];
    renderRoster();
    updatePager(rosterStudents.length);
    const yearLabel = years.find((year) => year.id === yearSelect.value)?.year_label || "selected year";
    summary.textContent = `${rosterStudents.length} student${rosterStudents.length === 1 ? "" : "s"} · ${yearLabel}${termSelect.value ? ` · ${terms.find((term) => term.id === termSelect.value)?.name || "selected term"}` : " · all terms"}`;
  }

  async function loadAssessments() {
    const version = ++assessmentRequestVersion;
    const yearId = yearSelect.value;
    if (!yearId) {
      ReportsCommon.populateSelect(assessmentSelect, [], { placeholder: "All assessments / periods" });
      return;
    }
    const { data, error } = await client
      .from("assessments")
      .select("id,name,start_date,end_date")
      .eq("school_id", schoolId)
      // Older assessment rows predate academic_year_id and are still linked
      // to grade records for the selected year.
      .or(`academic_year_id.eq.${yearId},academic_year_id.is.null`)
      .order("start_date", { ascending: true })
      .order("name", { ascending: true });
    if (version !== assessmentRequestVersion) return;
    if (error) {
      console.warn("Could not load assessment filters:", error.message);
      ReportsCommon.populateSelect(assessmentSelect, [], { placeholder: "All assessments / periods" });
      return;
    }
    const previous = assessmentSelect.value;
    const assessments = data || [];
    ReportsCommon.populateSelect(assessmentSelect, assessments, {
      placeholder: "All assessments / periods",
      labelKey: "name",
    });
    if (assessments.some((assessment) => assessment.id === previous)) {
      assessmentSelect.value = previous;
    }
  }

  assessmentSelect.addEventListener("change", () => {
    // The roster stays as-is; the selected assessment is applied when a card opens.
  });

  function renderRoster() {
    if (!rosterStudents.length) {
      showRosterMessage("No students found for these filters.");
      return;
    }
    const pageStudents = rosterStudents.slice(
      currentPage * PAGE_SIZE,
      (currentPage + 1) * PAGE_SIZE,
    );
    rowsBody.innerHTML = pageStudents.map((student) => {
      const name = student.student_name_snapshot || "Student";
      const code = student.student_code_snapshot || "—";
      const status = student.enrollment_status || "enrolled";
      return `<tr>
        <td><span class="student-name">${escapeHTML(name)}</span></td>
        <td>${escapeHTML(code)}</td>
        <td>${escapeHTML(student.classes?.name || "—")}</td>
        <td><span class="status-pill">${escapeHTML(status)}</span></td>
        <td><button class="row-button" type="button" data-report-student="${escapeHTML(student.student_id)}" data-print="true"><i class="fa-solid fa-print"></i> Print report card</button></td>
      </tr>`;
    }).join("");
  }

  async function openReport(student, printAfterLoad) {
    activeStudent = student;
    modal.hidden = false;
    document.body.classList.add("report-modal-open");
    document.getElementById("dialogTitle").textContent = student.student_name_snapshot || "Student Report Card";
    document.getElementById("dialogSubtitle").textContent = "Loading submitted grade and attendance records…";
    reportContent.innerHTML = '<p class="table-message"><i class="fa-solid fa-spinner fa-spin"></i> Preparing report card…</p>';
    const yearId = yearSelect.value;
    const filters = {
      yearId,
      termId: termSelect.value,
      assessmentId: assessmentSelect.value,
      classPeriodId: classPeriodSelect.value,
      classId: student.class_id,
      studentId: student.student_id,
    };
    try {
      const [schoolResult, gradesResult, attendanceResult, identityResult] = await Promise.all([
        client.from("schools").select("school_name,school_motto,logo_url,address,city,country").eq("id", schoolId).maybeSingle(),
        loadStudentGrades(filters),
        loadStudentAttendance(filters),
        loadStudentIdentity(student),
      ]);
      if (activeStudent?.student_id !== student.student_id) return;
      if (schoolResult.error) throw schoolResult.error;
      if (gradesResult.error) throw gradesResult.error;
      if (attendanceResult.error) throw attendanceResult.error;
      if (identityResult.error) throw identityResult.error;
      const yearLabel = years.find((year) => year.id === yearId)?.year_label || "Academic year";
      const termLabel = termSelect.value ? terms.find((term) => term.id === termSelect.value)?.name : "Full academic year";
      const assessmentLabel = assessmentSelect.value
        ? assessmentSelect.options[assessmentSelect.selectedIndex]?.text
        : null;
      const classPeriodLabel = classPeriodSelect.value
        ? classPeriodSelect.options[classPeriodSelect.selectedIndex]?.text
        : null;
      reportContent.innerHTML = renderReport(
        { ...student, ...(identityResult.data || {}) },
        schoolResult.data || {},
        gradesResult.data || [],
        attendanceResult.data || [],
        yearLabel,
        termLabel,
        assessmentLabel,
        classPeriodLabel,
      );
      document.getElementById("dialogTitle").textContent =
        identityResult.data?.student_name_snapshot || student.student_name_snapshot || "Student Report Card";
      document.getElementById("dialogSubtitle").textContent = `${student.classes?.name || "Class not recorded"} · ${yearLabel}${termLabel ? ` · ${termLabel}` : ""}${assessmentLabel ? ` · ${assessmentLabel}` : ""}${classPeriodLabel ? ` · ${classPeriodLabel}` : ""}`;
      if (printAfterLoad) window.setTimeout(() => window.print(), 100);
    } catch (error) {
      console.error("Could not prepare student report card:", error);
      reportContent.innerHTML = `<p class="table-message error-message">Could not load this report card: ${escapeHTML(error.message || "Please try again.")}</p>`;
      document.getElementById("dialogSubtitle").textContent = "Report card unavailable";
    }
  }

  async function loadStudentGrades({ yearId, termId, assessmentId, classId, studentId }) {
    let query = client.from("grade_records").select(`id,student_id,score,remarks,grades!inner(id,status,class_id,subject_id,assessment_id,category_id,academic_year_id,term_id,date_recorded,subjects(name),assessments(name,maximum_marks),assessment_categories(name,marks))`)
      .eq("student_id", studentId)
      .eq("school_id", schoolId)
      .eq("grades.school_id", schoolId)
      .eq("grades.academic_year_id", yearId)
      .ilike("grades.status", "submitted")
      .order("date_recorded", { referencedTable: "grades", ascending: true });
    if (classId) query = query.eq("grades.class_id", classId);
    if (termId) query = query.eq("grades.term_id", termId);
    if (assessmentId) query = query.eq("grades.assessment_id", assessmentId);
    return query;
  }

  async function loadStudentIdentity(student) {
    if (student.student_name_snapshot && student.student_code_snapshot) {
      return { data: null, error: null };
    }
    return client
      .from("students")
      .select("id,student_id,profiles(full_name,photo_url)")
      .eq("id", student.student_id)
      .eq("school_id", schoolId)
      .maybeSingle()
      .then(({ data, error }) => ({
        data: data
          ? {
              student_name_snapshot:
                student.student_name_snapshot || data.profiles?.full_name || "Student",
              student_code_snapshot:
                student.student_code_snapshot || data.student_id || "—",
              student_photo_snapshot:
                student.student_photo_snapshot || data.profiles?.photo_url || null,
            }
          : null,
        error,
      }));
  }

  async function loadStudentAttendance({ yearId, termId, classPeriodId, classId, studentId }) {
    // Start with this student's small set of marks, then resolve just those
    // session headers. This avoids the wide nested join that was timing out.
    const marks = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await client
        .from("attendance_records")
        .select("id,attendance_id,status")
        .eq("student_id", studentId)
        .eq("school_id", schoolId)
        .order("id", { ascending: true })
        .range(offset, offset + 499);
      if (error) return { data: null, error };
      marks.push(...(data || []));
      if (!data || data.length < 500) break;
    }
    if (!marks.length) return { data: [], error: null };

    const sessionIds = [...new Set(marks.map((mark) => mark.attendance_id).filter(Boolean))];
    const matchingSessions = new Map();
    const idBatchSize = 100;
    for (let offset = 0; offset < sessionIds.length; offset += idBatchSize) {
      let query = client
        .from("attendance")
        .select("id,date,period_id")
        .in("id", sessionIds.slice(offset, offset + idBatchSize))
        .eq("school_id", schoolId)
        .eq("academic_year_id", yearId)
        .ilike("status", "submitted")
        .order("date", { ascending: true });
      if (classId) query = query.eq("class_id", classId);
      if (termId) query = query.eq("term_id", termId);
      if (classPeriodId) query = query.eq("period_id", classPeriodId);
      const { data, error } = await query;
      if (error) return { data: null, error };
      (data || []).forEach((session) => matchingSessions.set(session.id, session.date));
    }

    return {
      data: marks.filter((mark) => matchingSessions.has(mark.attendance_id)).map((mark) => ({
        date: matchingSessions.get(mark.attendance_id),
        status: mark.status,
      })),
      error: null,
    };
  }

  function renderReport(student, school, gradeRows, attendanceRows, yearLabel, termLabel, assessmentLabel, classPeriodLabel) {
    const assessments = new Map();
    const subjects = new Map();
    const getTermLabel = (termId) => terms.find((term) => term.id === termId)?.name || "Unassigned term";
    for (const row of gradeRows) {
      const grade = row.grades || {};
      const subjectName = grade.subjects?.name || "Subject";
      const assessment = grade.assessments || {};
      const assessmentName = assessment.name || "Assessment";
      // A semester may have duplicate term rows in older data. In the
      // full-year view, combine same-named semester/period columns together.
      const termKey = termSelect.value ? grade.term_id || "no-term" : getTermLabel(grade.term_id).toLowerCase();
      const assessmentId = `${termKey}:${assessmentName.trim().toLowerCase()}`;
      const category = grade.assessment_categories || {};
      if (!assessments.has(assessmentId)) assessments.set(assessmentId, {
        id: assessmentId,
        termId: grade.term_id,
        termLabel: getTermLabel(grade.term_id),
        name: assessmentName,
        max: Number(assessment.maximum_marks) || 0,
      });
      const subjectKey = grade.subject_id || subjectName;
      if (!subjects.has(subjectKey)) subjects.set(subjectKey, { name: subjectName, assessments: new Map() });
      const subjectAssessments = subjects.get(subjectKey).assessments;
      if (!subjectAssessments.has(assessmentId)) subjectAssessments.set(assessmentId, { score: 0, categoryMax: 0, remarks: [] });
      const cell = subjectAssessments.get(assessmentId);
      if (row.score !== null && row.score !== undefined && Number.isFinite(Number(row.score))) cell.score += Number(row.score);
      if (Number(category.marks) > 0) cell.categoryMax += Number(category.marks);
      if (row.remarks?.trim()) cell.remarks.push(row.remarks.trim());
    }

    const periodNumber = (name) => {
      const match = String(name).match(/(?:^|\D)(\d+)(?:st|nd|rd|th)?\s*period/i);
      return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
    };
    const termOrder = (termId) => {
      const term = terms.find((item) => item.id === termId);
      const ordinal = String(term?.name || "").match(/(?:^|\D)(\d+)(?:st|nd|rd|th)\s*(?:semester|term)/i);
      if (ordinal) return Number(ordinal[1]);
      return term?.start_date ? new Date(`${term.start_date}T00:00:00`).getTime() : Number.MAX_SAFE_INTEGER;
    };
    const assessmentList = [...assessments.values()].sort((a, b) =>
      termOrder(a.termId) - termOrder(b.termId) ||
      periodNumber(a.name) - periodNumber(b.name) ||
      a.name.localeCompare(b.name, undefined, { numeric: true }),
    );
    const assessmentGroups = [];
    for (const assessment of assessmentList) {
      const groupKey = termSelect.value
        ? assessment.termId || "no-term"
        : assessment.termLabel.toLowerCase();
      let group = assessmentGroups.find((item) => item.key === groupKey);
      if (!group) {
        group = {
          key: groupKey,
          label: termSelect.value ? "Assessment periods" : assessment.termLabel,
          count: 0,
        };
        assessmentGroups.push(group);
      }
      group.count += 1;
    }
    let gradeTable = '<div class="empty-report">No submitted grades are available for this student in the selected period.</div>';
    if (assessmentList.length && subjects.size) {
      const allAssessmentPercentages = [];
      const subjectRows = [...subjects.values()].map(({ name: subjectName, assessments: marksByAssessment }) => {
        const cells = assessmentList.map((assessment) => {
          const value = marksByAssessment.get(assessment.id);
          if (!value) return '<td>—</td>';
          const max = assessment.max || value.categoryMax;
          const pct = max > 0 ? (value.score / max) * 100 : null;
          if (Number.isFinite(pct)) {
            allAssessmentPercentages.push(pct);
          }
          const remarks = value.remarks.length
            ? `<span class="student-sub">${escapeHTML(value.remarks.join("; "))}</span>`
            : "";
          return `<td>${value.score.toLocaleString("en-US", { maximumFractionDigits: 2 })}${max ? `<span class="student-sub">/ ${max}</span>` : ""}${remarks}</td>`;
        }).join("");
        return `<tr><td>${escapeHTML(subjectName)}</td>${cells}</tr>`;
      }).join("");
      const overallAverage = allAssessmentPercentages.length
        ? allAssessmentPercentages.reduce((sum, value) => sum + value, 0) / allAssessmentPercentages.length
        : null;
      const blankAverageCells = assessmentList.slice(0, -1).map(() => "<td></td>").join("");
      gradeTable = `<div class="table-wrap"><table class="grade-table"><thead><tr><th rowspan="2">Subject</th>${assessmentGroups.map((group) => `<th colspan="${group.count}">${escapeHTML(group.label)}</th>`).join("")}</tr><tr>${assessmentList.map((assessment) => `<th>${escapeHTML(assessment.name)}</th>`).join("")}</tr></thead><tbody>${subjectRows}<tr class="overall-average-row"><th>Average</th>${blankAverageCells}<th>${Number.isFinite(overallAverage) ? `${overallAverage.toFixed(1)}%` : "—"}</th></tr></tbody></table></div><p class="report-note">Overall average is the simple average of available subject assessment percentages. No school-specific weighting or pass threshold is applied.</p>`;
    }

    const attendanceStatuses = attendanceRows.map((record) =>
      String(record.status || "unmarked").trim().toLowerCase(),
    );
    const presentCount = attendanceStatuses.filter((status) => status === "present").length;
    const absentCount = attendanceStatuses.filter((status) => status === "absent").length;
    const attendanceHtml = attendanceRows.length
      ? `<div class="attendance-summary"><div class="attendance-stat"><b>${presentCount}</b><span>Present</span></div><div class="attendance-stat"><b>${absentCount}</b><span>Absent</span></div></div><p class="report-note">Totals count submitted attendance marks for the selected class, term, academic year, and attendance class period.</p>`
      : '<div class="empty-report">No submitted attendance is available for this student in the selected period.</div>';

    const address = [school.address, school.city, school.country].filter(Boolean).join(", ");
    const className = student.classes?.name || "—";
    const logo = school.logo_url ? `<img class="sheet-logo" src="${escapeHTML(school.logo_url)}" alt="School logo" />` : "";
    return `<article>
      <header class="sheet-heading">${logo}<div class="sheet-school"><h2>${escapeHTML(school.school_name || "School")}</h2>${school.school_motto ? `<p>${escapeHTML(school.school_motto)}</p>` : ""}${address ? `<p>${escapeHTML(address)}</p>` : ""}</div></header>
      <div class="sheet-title"><h3>Student Report Card</h3><p>${escapeHTML(yearLabel)}${termLabel ? ` · ${escapeHTML(termLabel)}` : ""}${assessmentLabel ? ` · Assessment: ${escapeHTML(assessmentLabel)}` : ""}${classPeriodLabel ? ` · Class period: ${escapeHTML(classPeriodLabel)}` : ""}</p></div>
      <section class="student-meta"><div><strong>Student:</strong> ${escapeHTML(student.student_name_snapshot || "Student")}</div><div><strong>Student ID:</strong> ${escapeHTML(student.student_code_snapshot || "—")}</div><div><strong>Class:</strong> ${escapeHTML(className)}</div><div><strong>Enrollment:</strong> ${escapeHTML(student.enrollment_status || "Enrolled")}</div><div><strong>Academic year:</strong> ${escapeHTML(yearLabel)}</div><div><strong>Term:</strong> ${escapeHTML(termLabel || "All terms")}</div></section>
      <h4 class="section-title">Grades</h4>${gradeTable}<h4 class="section-title">Attendance</h4>${attendanceHtml}
      <div class="signature-row"><div class="signature-line">Class teacher</div><div class="signature-line">Principal / school administrator</div></div>
    </article>`;
  }

  function updatePager(total) {
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    pageLabel.textContent = `Page ${Math.min(currentPage + 1, pages)} of ${pages}`;
    previousButton.disabled = currentPage === 0;
    nextButton.disabled = currentPage + 1 >= pages;
  }

  function showRosterMessage(message, isError = false) {
    rowsBody.innerHTML = `<tr><td colspan="5" class="table-message${isError ? " error-message" : ""}">${escapeHTML(message)}</td></tr>`;
  }

  function closeReport() {
    modal.hidden = true;
    document.body.classList.remove("report-modal-open");
    activeStudent = null;
  }

  function escapeHTML(value) {
    return ReportsCommon.escapeHTML(value ?? "");
  }
});
