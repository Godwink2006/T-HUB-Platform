document.addEventListener("DOMContentLoaded", async () => {
  await initStudentContext();
});

async function initStudentContext() {
  const client = window.supabaseClient || supabaseClient;


  const {
    data: { user },
    error: userErr,
  } = await client.auth.getUser();

  if (userErr || !user) {
    console.error("User not authenticated");
    return;
  }

  const yearSelect = document.getElementById("studentAcademicYearSelect");
  const termSelect = document.getElementById("studentTermSelect");


  async function loadTermsForYear(selectedYearId, preselectTermId = null) {
    if (!termSelect) return;

    termSelect.innerHTML = `<option value="">Select Semester</option>`;
    if (!selectedYearId) return;

    const { data: terms, error } = await client
      .from("terms")
      .select("id, name, status, academic_year_id")
      .eq("academic_year_id", selectedYearId)
      .order("start_date", { ascending: true });

    if (error) {
      console.error("Error loading terms:", error);
      return;
    }

    if (terms && terms.length > 0) {
      terms.forEach((t) => {
        const opt = document.createElement("option");
        opt.value = t.id;
        opt.textContent = t.name;


        if (preselectTermId ? t.id === preselectTermId : t === terms[0]) {
          opt.selected = true;
        }
        termSelect.appendChild(opt);
      });
    }
  }


  const { data: userGrades } = await client
    .from("grade_records")
    .select(
      "grades!inner(academic_year_id, term_id, assessment_id, class_id, subject_id)",
    )
    .eq("student_id", user.id)
    .limit(1);

  const targetYearId = userGrades?.[0]?.grades?.academic_year_id;
  const targetTermId = userGrades?.[0]?.grades?.term_id;
  const targetAssessmentId = userGrades?.[0]?.grades?.assessment_id;
  const targetClassId = userGrades?.[0]?.grades?.class_id;
  const targetSubjectId = userGrades?.[0]?.grades?.subject_id;


  const { data: years, error: yearsErr } = await client
    .from("academic_years")
    .select("id, year_label, status")
    .order("created_at", { ascending: false });

  if (yearsErr) {
    console.error("Error loading academic years:", yearsErr);
    return;
  }

  const classSelect = document.getElementById("studentClassSelect");
  const subjectSelect = document.getElementById("studentSubjectSelect");
  const assessmentSelect = document.getElementById("studentAssessmentSelect");

  if (yearSelect && years) {
    yearSelect.innerHTML = `<option value="">Select Academic Year</option>`;
    years.forEach((y) => {
      const opt = document.createElement("option");
      opt.value = y.id;
      opt.textContent = y.year_label;


      if (targetYearId ? y.id === targetYearId : y === years[0]) {
        opt.selected = true;
      }
      yearSelect.appendChild(opt);
    });
  }


  const activeYearId = yearSelect?.value;
  if (activeYearId) {
    await loadTermsForYear(activeYearId, targetTermId);
  }

  yearSelect?.addEventListener("change", async (e) => {
    await loadTermsForYear(e.target.value);
    await loadAssessmentsForYearAndTerm(yearSelect.value, termSelect.value);
    await loadClassesForSelection(
      yearSelect.value,
      termSelect.value,
      assessmentSelect.value,
    );
    await loadSubjectsForSelection(
      yearSelect.value,
      termSelect.value,
      assessmentSelect.value,
      classSelect.value,
    );
    loadStudentGrades(user.id);
  });

  termSelect?.addEventListener("change", async () => {
    await loadAssessmentsForYearAndTerm(yearSelect.value, termSelect.value);
    await loadClassesForSelection(
      yearSelect.value,
      termSelect.value,
      assessmentSelect.value,
    );
    await loadSubjectsForSelection(
      yearSelect.value,
      termSelect.value,
      assessmentSelect.value,
      classSelect.value,
    );
    loadStudentGrades(user.id);
  });

  assessmentSelect?.addEventListener("change", async () => {
    await loadClassesForSelection(
      yearSelect.value,
      termSelect.value,
      assessmentSelect.value,
    );
    await loadSubjectsForSelection(
      yearSelect.value,
      termSelect.value,
      assessmentSelect.value,
      classSelect.value,
    );
    loadStudentGrades(user.id);
  });

  classSelect?.addEventListener("change", async () => {
    await loadSubjectsForSelection(
      yearSelect.value,
      termSelect.value,
      assessmentSelect.value,
      classSelect.value,
    );
    loadStudentGrades(user.id);
  });

  subjectSelect?.addEventListener("change", () => {
    loadStudentGrades(user.id);
  });

  const activeTermId = termSelect?.value;
  if (activeYearId && activeTermId) {
    await loadAssessmentsForYearAndTerm(
      activeYearId,
      activeTermId,
      targetAssessmentId,
    );
  }


  if (activeYearId && activeTermId && assessmentSelect?.value) {
    await loadClassesForSelection(
      activeYearId,
      activeTermId,
      assessmentSelect.value,
      targetClassId,
    );

    const activeClassId = classSelect?.value;
    if (activeClassId) {
      await loadSubjectsForSelection(
        activeYearId,
        activeTermId,
        assessmentSelect.value,
        activeClassId,
        targetSubjectId,
      );
    }
  }


  await loadStudentGrades(user.id);
}

async function loadAssessmentsForYearAndTerm(
  academicYearId,
  termId,
  preselectAssessmentId = null,
) {
  const assessmentSelect = document.getElementById("studentAssessmentSelect");
  if (!assessmentSelect) return;

  assessmentSelect.innerHTML = `<option value="">Select Assessment / Period</option>`;
  if (!academicYearId || !termId) return;


  const { data: gradeEntries, error } = await supabaseClient
    .from("grades")
    .select("assessment_id, assessments ( id, name )")
    .eq("academic_year_id", academicYearId)
    .eq("term_id", termId);

  if (error) {
    console.error("Error loading assessments for period:", error);
    return;
  }


  const uniqueAssessments = new Map();
  gradeEntries?.forEach((entry) => {
    if (entry.assessments) {
      uniqueAssessments.set(entry.assessments.id, entry.assessments.name);
    }
  });

  if (uniqueAssessments.size > 0) {
    let index = 0;
    uniqueAssessments.forEach((name, id) => {
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = name;


      if (preselectAssessmentId ? id === preselectAssessmentId : index === 0) {
        opt.selected = true;
      }
      assessmentSelect.appendChild(opt);
      index++;
    });
  }
}

async function loadStudentStatusForTerm(studentId, academicYearId, termId) {
  const badge = document.getElementById("studentStatusBadge");
  if (!badge) {
    return;
  }

  try {
    const { data, error } = await supabaseClient
      .from("student_enrollments")
      .select("enrollment_status")
      .eq("student_id", studentId)
      .eq("academic_year_id", academicYearId)
      .eq("term_id", termId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (data && data.enrollment_status) {
      const status = data.enrollment_status;
      badge.textContent = status;
      badge.className = `status-badge ${status.toLowerCase()}`;
    } else {
      badge.textContent = "Normal";
      badge.className = "status-badge normal";
    }
  } catch (err) {
    console.error("Error loading term status:", err.message);
  }
}
async function loadStudentGrades(authUserId) {
  const reportContainer = document.getElementById("studentGradesReport");
  const yearId = document.getElementById("studentAcademicYearSelect")?.value;
  const termId = document.getElementById("studentTermSelect")?.value;
  const assessmentId = document.getElementById(
    "studentAssessmentSelect",
  )?.value;
  const classId = document.getElementById("studentClassSelect")?.value;
  const subjectId = document.getElementById("studentSubjectSelect")?.value;

  if (yearId && termId) {
    await loadStudentStatusForTerm(authUserId, yearId, termId);
  }

  if (!reportContainer) return;

  if (!termId || !assessmentId || !classId) {
    reportContainer.innerHTML = `
     <div style="text-align: center; color: #888; padding: 20px;">
  <i class="fa-solid fa-clipboard-question" style="font-size: 5.5rem; margin-bottom: 10px; color: #cbd5e1;"></i>
  <p style="margin: 0; font-size: 0.9rem;">
    Please select a semester, assessment period, and class to view your grades.
  </p>
</div>`;
    return;
  }
  try {
    const client = window.supabaseClient || supabaseClient;


    let query = client
      .from("grade_records")
      .select(
        `
        id,
        score,
        remarks,
        created_at,
        student_id,
        grades!inner (
          id,
          status,
          date_recorded,
          term_id,
          academic_year_id,
          assessment_id,
          class_id,
          subject_id,
          subjects ( id, name ),
          terms ( id, name ),
          academic_years ( id, year_label ),
          assessments ( id, name, maximum_marks ),
          assessment_categories ( id, name, marks )
        )
      `,
      )
      .eq("student_id", authUserId)
      .eq("grades.status", "submitted");


    if (termId) query = query.eq("grades.term_id", termId);
    if (yearId) query = query.eq("grades.academic_year_id", yearId);
    if (assessmentId) query = query.eq("grades.assessment_id", assessmentId);
    if (classId) query = query.eq("grades.class_id", classId);
    if (subjectId) query = query.eq("grades.subject_id", subjectId);

    const { data: records, error } = await query;

    if (error) throw error;

    if (!records || records.length === 0) {
      reportContainer.innerHTML = `
        <p style="text-align: center; color: #888; padding: 20px;">
          No published grades available for this assessment period.
        </p>`;
      return;
    }


    const grouped = new Map();

    records.forEach((rec) => {
      const parentGrade = rec.grades;
      if (!parentGrade) return;

      const subName = parentGrade.subjects?.name || "General Subject";
      const catObj = parentGrade.assessment_categories;
      const catName = catObj?.name || "Assessment";
      const weight = catObj?.marks ?? "-";

      if (!grouped.has(subName)) {
        grouped.set(subName, []);
      }
      grouped.get(subName).push({ catName, score: rec.score, weight });
    });


    let html = "";
    grouped.forEach((items, subName) => {
      html += `
        <div class="card" style="margin-bottom: 20px; background: #fff; border: 2px solid rgb(219, 215, 215); padding: 16px;">
          <h3>${subName}</h3>
          <table class="table" style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr>
                <th>Category</th>
                <th>Score</th>
                <th>Max Marks</th>
              </tr>
            </thead>
            <tbody>
              ${items
                .map(
                  (i) => `
                <tr>
                  <td>${i.catName}</td>
                  <td><strong>${i.score ?? "N/A"}</strong></td>
                  <td>${i.weight}</td>
                </tr>`,
                )
                .join("")}
            </tbody>
          </table>
        </div>`;
    });

    reportContainer.innerHTML =
      html ||
      `
      <p style="text-align: center; color: #888; padding: 20px;">
        No published grades available for this period.
      </p>`;
  } catch (err) {
    console.error("Error loading student grades:", err);
    reportContainer.innerHTML = `
      <p style="text-align: center; color: #ef4444; padding: 20px;">
        Failed to load grades: ${err.message}
      </p>`;
  }
}


async function loadClassesForSelection(
  yearId,
  termId,
  assessmentId,
  preselectClassId = null,
) {
  const classSelect = document.getElementById("studentClassSelect");
  if (!classSelect) return;

  classSelect.innerHTML = `<option value="">Select Class</option>`;
  if (!yearId || !termId || !assessmentId) return;

  const { data, error } = await supabaseClient
    .from("grades")
    .select("class_id, classes ( id, name )")
    .eq("academic_year_id", yearId)
    .eq("term_id", termId)
    .eq("assessment_id", assessmentId);

  if (error) {
    console.error("Error loading classes:", error);
    return;
  }

  const uniqueClasses = new Map();
  data?.forEach((entry) => {
    if (entry.classes) {
      uniqueClasses.set(entry.classes.id, entry.classes.name);
    }
  });

  let index = 0;
  uniqueClasses.forEach((name, id) => {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = name;
    if (preselectClassId ? id === preselectClassId : index === 0) {
      opt.selected = true;
    }
    classSelect.appendChild(opt);
    index++;
  });
}


async function loadSubjectsForSelection(
  yearId,
  termId,
  assessmentId,
  classId,
  preselectSubjectId = null,
) {
  const subjectSelect = document.getElementById("studentSubjectSelect");
  if (!subjectSelect) return;

  subjectSelect.innerHTML = `<option value="">Select Subject</option>`;
  if (!yearId || !termId || !assessmentId || !classId) return;

  const { data, error } = await supabaseClient
    .from("grades")
    .select("subject_id, subjects ( id, name )")
    .eq("academic_year_id", yearId)
    .eq("term_id", termId)
    .eq("assessment_id", assessmentId)
    .eq("class_id", classId);

  if (error) {
    console.error("Error loading subjects:", error);
    return;
  }

  const uniqueSubjects = new Map();
  data?.forEach((entry) => {
    if (entry.subjects) {
      uniqueSubjects.set(entry.subjects.id, entry.subjects.name);
    }
  });

  let index = 0;
  uniqueSubjects.forEach((name, id) => {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = name;
    if (preselectSubjectId ? id === preselectSubjectId : index === 0) {
      opt.selected = true;
    }
    subjectSelect.appendChild(opt);
    index++;
  });
}
