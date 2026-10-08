let myAssignments = [];

document.addEventListener("DOMContentLoaded", async () => {
  const gridContainer = document.getElementById("assignmentsGrid");

  gridContainer.innerHTML = `
    <div style="text-align: center; justify-content: center; padding: 2rem; color: #64748b;">
      <i class="fa-solid fa-spinner fa-spin" style="margin-right: 0.5rem;"></i>
      <p>Loading assignments...</p>
    </div>
  `;

  try {
    const client = window.supabaseClient || supabaseClient;
    const {
      data: { user },
      error: authError,
    } = await client.auth.getUser();

    if (authError || !user) {
      gridContainer.innerHTML = `<p class="error-state">Authentication required.</p>`;
      return;
    }

    const { data: assignments, error } = await client
      .from("teacher_assignments")
      .select(
        `
        id,
        is_class_teacher,
        description,
        status,
        subjects (id, name),
        classes (id, name),
        academic_years (id, year_label)
      `,
      )
      .eq("teacher_id", user.id)
      .eq("status", "active");

    if (error) {
      console.error("Assignment fetch error:", error);
      gridContainer.innerHTML = `<p class="error-state">Error loading assignments.</p>`;
      return;
    }

    myAssignments = assignments || [];

    populateFilterDropdowns(myAssignments);
    renderScheduleCards(myAssignments);
    bindFilterEvents();
  } catch (err) {
    console.error("Unexpected error:", err);
    gridContainer.innerHTML = `<p class="error-state">Failed to load schedule.</p>`;
  }
});

function renderScheduleCards(assignments) {
  const gridContainer = document.getElementById("assignmentsGrid");

  if (!assignments || assignments.length === 0) {
    gridContainer.innerHTML = `<p class="empty-state">You currently have no assigned subjects or classes.</p>`;
    return;
  }

  gridContainer.innerHTML = assignments
    .map((item) => {
      const isClassTeacher = item.is_class_teacher;
      const subjectName = item.subjects?.name || "Unassigned Subject";
      const className = item.classes?.name || "N/A";
      const yearName = item.academic_years?.year_label || "Current Session";

      return `
        <div class="assignment-card">
          <div>
            <div class="card-top">
              <h3 class="subject-title">${subjectName}</h3>
              <span class="class-badge">${className}</span>
            </div>

            <div class="role-tag ${isClassTeacher ? "class-teacher" : "subject-teacher"}">
              <i class="fa-solid ${isClassTeacher ? "fa-star" : "fa-book-open"}"></i>
              ${isClassTeacher ? "Class Teacher" : "Subject Teacher"}
            </div>

            <div class="card-details">
              <div class="detail-item">
                <i class="fa-solid fa-calendar-day"></i>
                <span>${yearName}</span>
              </div>
              ${
                item.description
                  ? `
                <div class="detail-item">
                  <i class="fa-solid fa-align-left"></i>
                  <span>${escapeHTML(item.description || "")}</span>
                </div>
              `
                  : ""
              }
            </div>
          </div>

          <div class="card-actions">
            <a href="attendance.html?class=${encodeURIComponent(className)}" class="card-btn">
              Attendance
            </a>
            <a href="grades.html?class=${encodeURIComponent(className)}&subject=${encodeURIComponent(subjectName)}" class="card-btn primary">
              Enter Grades
            </a>
          </div>
        </div>
      `;
    })
    .join("");
}

function populateFilterDropdowns(assignments) {
  const subjectSelect = document.getElementById("filterSubject");
  const classSelect = document.getElementById("filterClass");

  if (!subjectSelect || !classSelect) return;

  const subjects = new Map();
  const classes = new Map();

  assignments.forEach((item) => {
    if (item.subjects) subjects.set(item.subjects.id, item.subjects.name);
    if (item.classes) classes.set(item.classes.id, item.classes.name);
  });

  populateOptions(subjectSelect, subjects, "All Subjects");
  populateOptions(classSelect, classes, "All Classes");
}

function populateOptions(selectElem, mapData, defaultText) {
  selectElem.innerHTML = `<option value="">${defaultText}</option>`;
  mapData.forEach((label, id) => {
    selectElem.innerHTML += `<option value="${id}">${label}</option>`;
  });
}

function bindFilterEvents() {
  const searchInput = document.getElementById("teacherSearchInput");
  const subjectSelect = document.getElementById("filterSubject");
  const classSelect = document.getElementById("filterClass");

  const applyFilters = () => {
    const query = searchInput ? searchInput.value.toLowerCase().trim() : "";
    const selectedSubject = subjectSelect ? subjectSelect.value : "";
    const selectedClass = classSelect ? classSelect.value : "";

    const filtered = myAssignments.filter((item) => {
      const matchQuery =
        !query ||
        item.subjects?.name?.toLowerCase().includes(query) ||
        item.classes?.name?.toLowerCase().includes(query);

      const matchSubject =
        !selectedSubject || item.subjects?.id === selectedSubject;
      const matchClass = !selectedClass || item.classes?.id === selectedClass;

      return matchQuery && matchSubject && matchClass;
    });

    renderScheduleCards(filtered);
  };

  if (searchInput) searchInput.addEventListener("input", applyFilters);
  if (subjectSelect) subjectSelect.addEventListener("change", applyFilters);
  if (classSelect) classSelect.addEventListener("change", applyFilters);
}
