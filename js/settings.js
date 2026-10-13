async function initSettingsPage() {
  const skeletonEl = document.getElementById("settingsSkeleton");
  const containerEl = document.getElementById("settingsContainer");

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

    if (containerEl) {
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

         <div id="nav-periods" class="setting-card">
          <h4>Periods</h4>
          <p>Manage and create periods.</p>
          <button onclick="window.location.href = 'periods.html'" class="manage-btn">
            Manage Periods <i class="fa-solid fa-chevron-right"></i>
          </button>
        </div>

           <div id="nav-assessments" class="setting-card">
          <h4>Assessment</h4>
          <p>Create and manage assessments.</p>
          <button onclick="window.location.href = 'assessments.html'" class="manage-btn">
            Manage Assessments <i class="fa-solid fa-chevron-right"></i>
          </button>
        </div>
        `
            : ""
        }

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

        <div class="setting-card">
          <h4>Log Out &amp; Clear Browser Data</h4>
          <p>Sign out on this device and remove saved data for this site, including cached files and local settings. School records are not deleted.</p>
          <button id="clearBrowserDataBtn" type="button" class="manage-btn clear-browser-data-btn">
            Log Out &amp; Clear Data <i class="fa-solid fa-right-from-bracket"></i>
          </button>
        </div>
      `;

      containerEl.innerHTML = allCardsHTML;

      const settingIcons = new Map([
        ["Semester", "fa-calendar-days"],
        ["Academic Year", "fa-calendar"],
        ["System Users", "fa-users"],
        ["My Profile", "fa-user"],
        ["Subjects", "fa-book-open"],
        ["Fee Structures", "fa-money-check-dollar"],
        ["Classes", "fa-chalkboard"],
        ["Department", "fa-building"],
        ["Periods", "fa-clock"],
        ["Assessment", "fa-file-pen"],
        ["School Information", "fa-school"],
        ["Audit Logs", "fa-clipboard-list"],
        ["Log Out & Clear Browser Data", "fa-right-from-bracket"],
      ]);

      containerEl.querySelectorAll(".setting-card h4").forEach((heading) => {
        const iconName = settingIcons.get(heading.textContent.trim());
        if (!iconName) return;

        const icon = document.createElement("i");
        icon.className = `fa-solid ${iconName}`;
        icon.setAttribute("aria-hidden", "true");
        heading.prepend(icon, " ");
      });

      document
        .getElementById("clearBrowserDataBtn")
        ?.addEventListener("click", openClearDataDialog);
      document
        .getElementById("cancelClearDataBtn")
        ?.addEventListener("click", closeClearDataDialog);
      document
        .getElementById("confirmClearDataBtn")
        ?.addEventListener("click", clearCurrentBrowserData);
      document.getElementById("clearDataDialog")?.addEventListener("click", (event) => {
        if (event.target.id === "clearDataDialog") closeClearDataDialog();
      });
      document.addEventListener("keydown", handleClearDataDialogKeydown);

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

document.addEventListener("DOMContentLoaded", initSettingsPage);

let clearDataDialogTrigger = null;

function openClearDataDialog(event) {
  const dialog = document.getElementById("clearDataDialog");
  if (!dialog) return;

  clearDataDialogTrigger = event.currentTarget;
  dialog.hidden = false;
  dialog.setAttribute("aria-hidden", "false");
  document.body.classList.add("settings-modal-open");
  requestAnimationFrame(() => {
    document.getElementById("cancelClearDataBtn")?.focus();
  });
}

function closeClearDataDialog() {
  const dialog = document.getElementById("clearDataDialog");
  if (!dialog || dialog.dataset.busy === "true") return;

  dialog.hidden = true;
  dialog.setAttribute("aria-hidden", "true");
  document.body.classList.remove("settings-modal-open");
  clearDataDialogTrigger?.focus();
}

function handleClearDataDialogKeydown(event) {
  const dialog = document.getElementById("clearDataDialog");
  if (!dialog || dialog.hidden) return;

  if (event.key === "Escape") {
    event.preventDefault();
    closeClearDataDialog();
    return;
  }

  if (event.key === "Tab") {
    const buttons = [
      document.getElementById("cancelClearDataBtn"),
      document.getElementById("confirmClearDataBtn"),
    ].filter((button) => button && !button.disabled);
    if (buttons.length === 0) return;

    const firstButton = buttons[0];
    const lastButton = buttons[buttons.length - 1];
    if (event.shiftKey && document.activeElement === firstButton) {
      event.preventDefault();
      lastButton.focus();
    } else if (!event.shiftKey && document.activeElement === lastButton) {
      event.preventDefault();
      firstButton.focus();
    }
  }
}

async function clearCurrentBrowserData() {
  const dialog = document.getElementById("clearDataDialog");
  const confirmButton = document.getElementById("confirmClearDataBtn");
  const cancelButton = document.getElementById("cancelClearDataBtn");
  if (!dialog || !confirmButton || dialog.dataset.busy === "true") return;

  dialog.dataset.busy = "true";
  confirmButton.disabled = true;
  confirmButton.textContent = "Logging out and clearing data…";
  if (cancelButton) cancelButton.disabled = true;

  try {
    if (window.supabaseClient?.auth) {
      const { error } = await window.supabaseClient.auth.signOut({
        scope: "local",
      });
      if (error) console.warn("Local Supabase sign-out returned an error:", error);
    }
  } catch (error) {
    console.warn("Supabase sign-out failed; clearing this site's local session anyway:", error);
  }

  try {
    window.localStorage.clear();
  } catch (error) {
    console.warn("Could not clear local storage:", error);
  }

  try {
    window.sessionStorage.clear();
  } catch (error) {
    console.warn("Could not clear session storage:", error);
  }

  try {
    const cacheNames = await window.caches?.keys();
    await Promise.all((cacheNames || []).map((name) => window.caches.delete(name)));
  } catch (error) {
    console.warn("Could not clear this site's cached files:", error);
  }

  try {
    const registrations = await navigator.serviceWorker?.getRegistrations();
    await Promise.all((registrations || []).map((registration) => registration.unregister()));
  } catch (error) {
    console.warn("Could not unregister this site's service workers:", error);
  }

  try {
    if (typeof window.indexedDB?.databases === "function") {
      const databases = await window.indexedDB.databases();
      await Promise.all(
        databases
          .filter((database) => database.name)
          .map(
            (database) =>
              new Promise((resolve) => {
                const request = window.indexedDB.deleteDatabase(database.name);
                request.onsuccess = resolve;
                request.onerror = resolve;
                request.onblocked = resolve;
              }),
          ),
      );
    }
  } catch (error) {
    console.warn("Could not clear this site's IndexedDB data:", error);
  }

  try {
    document.cookie.split(";").forEach((cookie) => {
      const cookieName = cookie.split("=")[0].trim();
      if (cookieName) {
        document.cookie = `${cookieName}=; Max-Age=0; path=/; SameSite=Lax`;
      }
    });
  } catch (error) {
    console.warn("Could not clear this site's accessible cookies:", error);
  }

  window.location.replace("/index.html");
}
