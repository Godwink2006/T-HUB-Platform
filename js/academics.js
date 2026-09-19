// Single initialization function to handle fetching, rendering, and visibility swap
async function initAcademicsPage() {
  const skeletonEl = document.getElementById("academicsSkeleton");
  const containerEl = document.getElementById("academicsContainer");

  try {
    // 1. Fetch user authentication
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      console.warn("No authenticated user found.");
      return;
    }

    // 2. Fetch user profile and role BEFORE altering the UI
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError) {
      console.error("Error fetching user role:", profileError);
    }

    const userRole = profile?.role;
    const isAdmin = userRole === "admin";
    const isTeacher = userRole === "teacher"; // Check for teacher role

    // 3. Build HTML conditionally
    if (containerEl) {
      const allCardsHTML = `
    ${
      isAdmin
        ? `
    <div id="nav-teacher-assignment" class="academic-card">
      <h4>Teacher Assignment</h4>
      <p>Assign teachers to classes and subjects.</p>
      <button onclick="window.location.href = 'teacher-assignment.html'" class="manage-btn">
        Assign Teachers <i class="fa-solid fa-chevron-right"></i>
      </button>
    </div>
    `
        : ""
    }

    ${
      isTeacher
        ? `
     <div id="nav-my-assignments" class="academic-card">
      <h4>My Assignments</h4>
      <p>View and manage your assigned tasks.</p>
      <button onclick="window.location.href = 'my-assignments.html'" class="manage-btn">
        Manage Assignments <i class="fa-solid fa-chevron-right"></i>
      </button>
    </div>
    `
        : ""
    }

    <div id="nav-timetable" class="academic-card">
      <h4>My Timetable</h4>
      <p>View and manage your assigned tasks.</p>
      <button onclick="window.location.href = 'my-timetable.html'" class="manage-btn">
        Manage Timetable <i class="fa-solid fa-chevron-right"></i>
      </button>
    </div>

    <div id="nav-timetable" class="academic-card">
      <h4>Timetable</h4>
      <p>Create and manage school timetables.</p>
      <button onclick="window.location.href = 'timetable.html'" class="manage-btn">
        Manage Timetable <i class="fa-solid fa-chevron-right"></i>
      </button>
    </div>

    <div id="nav-attendance" class="academic-card">
      <h4>Attendance</h4>
      <p>Take and manage Attendance.</p>
      <button onclick="window.location.href = 'attendance.html'" class="manage-btn">
        Manage Attendance <i class="fa-solid fa-chevron-right"></i>
      </button>
    </div>

    <div id="nav-grades" class="academic-card">
      <h4>Grades</h4>
      <p>Add and manage grades.</p>
      <button onclick="window.location.href = 'grades.html'" class="manage-btn">
        Manage Grades <i class="fa-solid fa-chevron-right"></i>
      </button>
    </div>
  `;

      containerEl.innerHTML = allCardsHTML;

      // Apply any additional element visibility checks from your utils
      if (typeof renderNavigation === "function") {
        renderNavigation(userRole);
      }
    }
  } catch (err) {
    console.error("Initialization error:", err);
  } finally {
    // 4. Reveal final content only after processing finishes
    if (skeletonEl) skeletonEl.style.display = "none";
    if (containerEl) containerEl.style.display = "grid";
  }
}

// Single listener call
document.addEventListener("DOMContentLoaded", initAcademicsPage);
