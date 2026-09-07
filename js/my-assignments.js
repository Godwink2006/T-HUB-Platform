document.addEventListener("DOMContentLoaded", async () => {
  const gridContainer = document.getElementById("assignmentsGrid");

  try {
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();
    if (!user) return;

    // Fetch teacher record linked to user email
    const { data: teacher } = await supabaseClient
      .from("teachers")
      .select("id, full_name")
      .eq("email", user.email)
      .single();

    if (!teacher) {
      gridContainer.innerHTML = `<p class="empty-state">No teacher profile associated with this account.</p>`;
      return;
    }

    // Fetch active assignments
    const { data: assignments, error } = await supabaseClient
      .from("teacher_assignments")
      .select(
        `
        id,
        is_class_teacher,
        description,
        subjects (name),
        classes (name),
        academic_years (name)
      `,
      )
      .eq("teacher_id", teacher.id)
      .eq("status", "Active");

    if (error) throw error;

    if (!assignments || assignments.length === 0) {
      gridContainer.innerHTML = `<p class="empty-state">You currently have no assigned subjects or classes.</p>`;
      return;
    }

    // Render Cards
    gridContainer.innerHTML = assignments
      .map((item) => {
        const isClassTeacher = item.is_class_teacher;
        const subjectName = item.subjects?.name || "Unassigned Subject";
        const className = item.classes?.name || "N/A";
        const yearName = item.academic_years?.name || "Current Session";

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
    console.error("Error loading assignments:", err);
    gridContainer.innerHTML = `<p class="error-state">Failed to load assignment schedule.</p>`;
  }
});
