document.addEventListener("DOMContentLoaded", async () => {
  await initStudentContext();
});

async function initStudentContext() {
  const client = window.supabaseClient || supabaseClient;

  // 1. Get logged-in user session
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

  // Helper function to load terms dynamically by selected academic year
  async function loadTermsForYear(selectedYearId, preselectTermId = null) {
    if (!termSelect) return;

    termSelect.innerHTML = `<option value="">Select Term / Semester</option>`;
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
        
        // Preselect matching term if provided, otherwise select the first one
        if (preselectTermId ? t.id === preselectTermId : t === terms[0]) {
          opt.selected = true;
        }
        termSelect.appendChild(opt);
      });
    }
  }

  // 2. Fetch the student's actual grade records first to find their valid year & term IDs
  const { data: userGrades } = await client
    .from("grade_records")
    .select("grades!inner(academic_year_id, term_id)")
    .eq("student_id", user.id)
    .limit(1);

  const targetYearId = userGrades?.[0]?.grades?.academic_year_id;
  const targetTermId = userGrades?.[0]?.grades?.term_id;

  // 3. Load Academic Years into dropdown
  const { data: years, error: yearsErr } = await client
    .from("academic_years")
    .select("id, year_label, status")
    .order("created_at", { ascending: false });

  if (yearsErr) {
    console.error("Error loading academic years:", yearsErr);
    return;
  }

  if (yearSelect && years) {
    yearSelect.innerHTML = `<option value="">Select Academic Year</option>`;
    years.forEach((y) => {
      const opt = document.createElement("option");
      opt.value = y.id;
      opt.textContent = y.year_label;
      
      // Select the year that actually has grades for this student (or fallback to first)
      if (targetYearId ? y.id === targetYearId : y === years[0]) {
        opt.selected = true;
      }
      yearSelect.appendChild(opt);
    });
  }

  // 4. Load terms for the currently selected year
  const activeYearId = yearSelect?.value;
  if (activeYearId) {
    await loadTermsForYear(activeYearId, targetTermId);
  }

  // 5. Event Listeners
  yearSelect?.addEventListener("change", async (e) => {
    await loadTermsForYear(e.target.value);
    await loadStudentGrades(user.id);
  });

  termSelect?.addEventListener("change", () => {
    loadStudentGrades(user.id);
  });

  // 6. Initial fetch
  await loadStudentGrades(user.id);
}

async function loadStudentGrades(authUserId) {
  const reportContainer = document.getElementById("studentGradesReport");
  const yearId = document.getElementById("studentAcademicYearSelect")?.value;
  const termId = document.getElementById("studentTermSelect")?.value;

  if (!reportContainer) return;

  if (!termId) {
    reportContainer.innerHTML = `
      <p style="text-align: center; color: #888; padding: 20px;">
        Please select a term/semester to display grades.
      </p>`;
    return;
  }

  try {
    const client = window.supabaseClient || supabaseClient;

    // 1. Fetch grade records with all relations embedded in a single query
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
          subjects ( id, name ),
          terms ( id, name ),
          academic_years ( id, year_label ),
          assessments ( id, name, maximum_marks ),
          assessment_categories ( id, name, marks )
        )
      `,
      )
      .eq("student_id", authUserId);

    // Apply term and academic year filters using Supabase dot-notation
    if (termId) query = query.eq("grades.term_id", termId);
    if (yearId) query = query.eq("grades.academic_year_id", yearId);

    const { data: records, error } = await query;

    if (error) {
      console.error("Error querying grade records:", error);
      throw error;
    }

    if (!records || records.length === 0) {
      reportContainer.innerHTML = `
        <p style="text-align: center; color: #888; padding: 20px;">
          No published grades available for this period.
        </p>`;
      return;
    }

    // 2. Group records by Subject Name
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

    // 3. Build HTML Output
    let html = "";
    grouped.forEach((items, subName) => {
      html += `
        <div class="card" style="margin-bottom: 20px; background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px;">
          <h3 style="margin-bottom: 12px; color: #111827; font-size: 1.1rem; font-weight: 600;">${subName}</h3>
          <table class="table" style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="border-bottom: 2px solid #e5e7eb; text-align: left; background-color: #f9fafb;">
                <th style="padding: 10px; font-weight: 600; color: #374151;">Category</th>
                <th style="padding: 10px; font-weight: 600; color: #374151;">Score</th>
                <th style="padding: 10px; font-weight: 600; color: #374151;">Max Marks</th>
              </tr>
            </thead>
            <tbody>
              ${items
                .map(
                  (i) => `
                <tr style="border-bottom: 1.1px solid #f3f4f6;">
                  <td style="padding: 10px; color: #1f2937;">${i.catName}</td>
                  <td style="padding: 10px;"><strong>${i.score ?? "N/A"}</strong></td>
                  <td style="padding: 10px; color: #6b7280;">${i.weight}</td>
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
