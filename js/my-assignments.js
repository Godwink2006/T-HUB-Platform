document.addEventListener("DOMContentLoaded", async () => {
  const gridContainer = document.getElementById("assignmentsGrid");

  gridContainer.innerHTML = `
      <div style="text-align: center; justify-content: center; padding: 2rem; color: #64748b;">
        <i class="fa-solid fa-spinner fa-spin" style="margin-right: 0.5rem;"></i>
        <p>Loading assignments...</p>
      </div
  `;

  try {
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();
    if (!user) return;

    // Fetch active assignments directly using user.id (which equals teacher_id)
    const { data: assignments, error } = await supabaseClient
      .from("teacher_assignments")
      .select(
        `
        id,
        is_class_teacher,
        description,
        status,
        subjects (name),
        classes (name),
        academic_years (year_label)
      `,
      )
      .eq("teacher_id", user.id)
      .eq("status", "active");

    if (error) {
      console.error("Assignment fetch error:", error);
      gridContainer.innerHTML = `<p class="error-state">Error loading assignments.</p>`;
      return;
    }

    if (!assignments || assignments.length === 0) {
      gridContainer.innerHTML = `<p class="empty-state">You currently have no assigned subjects or classes.</p>`;
      return;
    }

    // Render Cards Grid
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
                  <span>${item.description}</span>
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
  } catch (err) {
    console.error("Unexpected error:", err);
    gridContainer.innerHTML = `<p class="error-state">Failed to load schedule.</p>`;
  }
});
