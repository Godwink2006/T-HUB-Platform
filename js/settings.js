// Single initialization function to handle fetching, rendering, and visibility swap
async function initSettingsPage() {
  const skeletonEl = document.getElementById("settingsSkeleton");
  const containerEl = document.getElementById("settingsContainer");

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

    // 3. Build HTML conditionally (or use renderNavigation if cards exist in HTML)
    // If containerEl exists, inject or filter cards
    if (containerEl) {
      // Option A: If cards are rendered dynamically via JS string
      const allCardsHTML = `
        ${
          isAdmin
            ? `
        <div id="nav-semesters" class="setting-card">
          <h4>Semester</h4>
          <p>Create and manage Semesters.</p>
          <button onclick="window.location.href = 'semester.html'" class="manage-btn">
            Manage Semesters <i class="fa-solid fa-chevron-right"></i>
          </button>
        </div>
        <div id="nav-academic-years" class="setting-card">
          <h4>Academic Year</h4>
          <p>Create and manage Academic Year.</p>
          <button onclick="window.location.href = 'academic-year.html'" class="manage-btn">
            Manage Academic Year <i class="fa-solid fa-chevron-right"></i>
          </button>
        </div>
        <div id="nav-system-users" class="setting-card">
          <h4>System Users</h4>
          <p>Manage and create users.</p>
          <button onclick="window.location.href = 'system-users.html'" class="manage-btn">
            Manage Users <i class="fa-solid fa-chevron-right"></i>
          </button>
        </div>
        `
            : ""
        }

        <div class="setting-card">
          <h4>My Profile</h4>
          <p>Manage profile.</p>
          <button onclick="window.location.href = 'my-profile.html'" class="manage-btn">
            Manage Profile <i class="fa-solid fa-chevron-right"></i>
          </button>
        </div>

        ${
          isAdmin
            ? `

             <div class="setting-card">
          <h4>Subjects</h4>
          <p>Create and manage all school subjects.</p>
          <button onclick="window.location.href = 'subjects.html'" class="manage-btn">
            Manage Subjects <i class="fa-solid fa-chevron-right"></i>
          </button>
        </div>

         <div class="setting-card">
          <h4>Fee Structures</h4>
          <p>Create and manage fee structures.</p>
          <button onclick="window.location.href = 'structures.html'" class="manage-btn">
            Manage Structures <i class="fa-solid fa-chevron-right"></i>
          </button>
        </div>

        <div class="setting-card">
          <h4>Classes</h4>
          <p>Create and manage all school classes.</p>
          <button onclick="window.location.href = 'classes.html'" class="manage-btn">
            Manage Classes <i class="fa-solid fa-chevron-right"></i>
          </button>
        </div>

        <div id="nav-departments" class="setting-card">
          <h4>Department</h4>
          <p>Manage and create departments.</p>
          <button onclick="window.location.href = 'department.html'" class="manage-btn">
            Manage Departments <i class="fa-solid fa-chevron-right"></i>
          </button>
        </div>

        <div id="nav-rooms" class="setting-card">
          <h4>Room</h4>
          <p>Create and manage rooms.</p>
          <button onclick="window.location.href = 'rooms.html'" class="manage-btn">
            Manage Rooms <i class="fa-solid fa-chevron-right"></i>
          </button>
        </div>
        `
            : ""
        }

        <div id="nav-periods" class="setting-card">
          <h4>Periods</h4>
          <p>Manage and create periods.</p>
          <button onclick="window.location.href = 'periods.html'" class="manage-btn">
            Manage Periods <i class="fa-solid fa-chevron-right"></i>
          </button>
        </div>

        <div class="setting-card">
          <h4>School Information</h4>
          <p>Manage or view school information.</p>
          <button onclick="window.location.href = 'school-information.html'" class="manage-btn">
            View School Information <i class="fa-solid fa-chevron-right"></i>
          </button>
        </div>

        ${
          isAdmin
            ? `
        <div id="nav-audit-logs" class="setting-card">
          <h4>Audit Logs</h4>
          <p>View audit logs.</p>
          <button onclick="window.location.href = 'audit-logs.html'" class="manage-btn">
            View Audit Logs <i class="fa-solid fa-chevron-right"></i>
          </button>
        </div>
        `
            : ""
        }
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
document.addEventListener("DOMContentLoaded", initSettingsPage);
