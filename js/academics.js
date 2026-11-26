async function initAcademicsPage() {
  const skeletonEl = document.getElementById("academicsSkeleton");
  const containerEl = document.getElementById("academicsContainer");

  try {
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      console.warn("No authenticated user found.");
      return;
    }

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
    const isTeacher = userRole === "teacher";
    const isAccountant = userRole === "accountant";

    const isAdminOrTeacher = isAdmin || isTeacher;
    const isAdminOrAccountant = isAdmin || isAccountant;

    if (containerEl) {
      const allCardsHTML = `
 ${
   isAdminOrAccountant
     ? `
    <div id="nav-enrollment" class="academic-card">
      <h4>Enrollment</h4>
      <p>View and manage students Enrollment.</p>
      <button onclick="window.location.href = 'enrollment.html'" class="manage-btn">
        Manage enrollment <i class="fa-solid fa-chevron-right"></i>
      </button>
    </div>
    `
     : ""
 }

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

      <div id="nav-timetable" class="academic-card">
      <h4>Timetable</h4>
      <p>Create and manage school timetables.</p>
      <button onclick="window.location.href = 'timetable.html'" class="manage-btn">
        Manage Timetable <i class="fa-solid fa-chevron-right"></i>
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

    ${
      isAdminOrTeacher
        ? `
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
    `
        : ""
    }

    ${
      isTeacher
        ? `
    <div id="nav-timetable" class="academic-card">
      <h4>My Timetable</h4>
      <p>View and manage your assigned tasks.</p>
      <button onclick="window.location.href = 'my-timetable.html'" class="manage-btn">
        Manage Timetable <i class="fa-solid fa-chevron-right"></i>
      </button>
    </div>
    `
        : ""
    }
  `;

      containerEl.innerHTML = allCardsHTML;

      const cardIcons = new Map([
        ["Enrollment", "fa-user-plus"],
        ["Teacher Assignment", "fa-chalkboard-user"],
        ["Timetable", "fa-calendar-days"],
        ["My Assignments", "fa-clipboard-check"],
        ["My Attendance", "fa-calendar-check"],
        ["My Grades", "fa-chart-column"],
        ["My Fees", "fa-wallet"],
        ["My Transfer History", "fa-right-left"],
        ["Attendance", "fa-user-check"],
        ["Grades", "fa-chart-line"],
        ["My Timetable", "fa-calendar-days"],
      ]);

      containerEl.querySelectorAll(".academic-card").forEach((card) => {
        const title = card.querySelector("h4")?.textContent.trim();
        const iconName = cardIcons.get(title);
        if (!iconName) return;

        const icon = document.createElement("i");
        icon.className = `fa-solid ${iconName} app-academic-icon`;
        icon.setAttribute("aria-hidden", "true");
        card.querySelector("h4")?.prepend(icon, " ");
      });

      if (typeof renderNavigation === "function") {
        renderNavigation(userRole);
      }
    }
  } catch (err) {
    console.error("Initialization error:", err);
  } finally {
    if (skeletonEl) skeletonEl.style.display = "none";
    if (containerEl) containerEl.style.display = "grid";
  }
}

document.addEventListener("DOMContentLoaded", initAcademicsPage);
