// ==========================================
// CONFIGURATION & HELPERS
// ==========================================
const ADMIN_ONLY_PAGES = [
  "subjects.html",
  "department.html",
  "academic-year.html",
  "structures.html",
  "classes.html",
  "audit-logs.html",
  "periods.html",
  "assessments.html",
  "semester.html",
  "system-users.html",
];

function isLoginPage() {
  const path = window.location.pathname.toLowerCase();
  return (
    path.endsWith("/index.html") ||
    path.endsWith("index.html") ||
    path === "/" ||
    path === "" ||
    path.endsWith("/login.html")
  );
}

function lockBodyScroll() {
  document.body.style.overflow = "hidden";
}

function unLockBodyScroll() {
  document.body.style.overflow = "";
}

function showToast(message, type = "success", duration = 3000) {
  let container = document.getElementById("toastContainer");

  if (!container) {
    container = document.createElement("div");
    container.id = "toastContainer";
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;

  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add("show");
  });

  setTimeout(() => {
    toast.classList.remove("show");
    toast.addEventListener("transitionend", () => toast.remove());
  }, duration);
}

// Safe Logout Action
window.forceLogout = async function () {
  if (window.supabaseClient) {
    try {
      await window.supabaseClient.auth.signOut();
    } catch (e) {
      console.warn("SignOut error ignored:", e);
    }
  }

  localStorage.clear();
  sessionStorage.clear();

  if (!isLoginPage()) {
    window.location.replace("/index.html");
  }
};

// ==========================================
// CENTRAL ACCESS GUARD
// ==========================================
async function checkPageAccess() {
  const currentPage = window.location.pathname.split("/").pop();

  if (!ADMIN_ONLY_PAGES.includes(currentPage)) {
    return;
  }

  document.documentElement.style.visibility = "hidden";

  if (!window.supabaseClient) {
    document.documentElement.style.visibility = "";
    return;
  }

  const {
    data: { user },
    error,
  } = await window.supabaseClient.auth.getUser();

  if (error || !user) {
    await window.forceLogout();
    return;
  }

  const { data: profile } = await window.supabaseClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    await window.forceLogout();
    return;
  }

  document.documentElement.style.visibility = "";
}

// Run role validation immediately on script execution
checkPageAccess();

// ==========================================
// DOM & SESSION LIFECYCLE LISTENERS
// ==========================================
document.addEventListener("DOMContentLoaded", async () => {
  // Mobile menu setup
  const menuToggle = document.getElementById("menuToggle");
  const sidebar = document.querySelector(".sidebar");
  const overlay = document.getElementById("sidebarOverlay");

  function toggleMenu() {
    sidebar.classList.toggle("active");
    overlay.classList.toggle("active");
  }

  function closeMenu() {
    sidebar.classList.remove("active");
    overlay.classList.remove("active");
  }

  if (menuToggle) menuToggle.addEventListener("click", toggleMenu);
  if (overlay) overlay.addEventListener("click", closeMenu);

  document.querySelectorAll(".menu a").forEach((link) => {
    link.addEventListener("click", closeMenu);
  });

  // Modal Backdrop Click Handler
  const modalIds = [
    "periodModal",
    "editPeriodModal",
    "archivePeriodModal",
    "archiveSystemUserModal",
    "editSystemUserModal",
    "systemUserModal",
    "archiveSubjectModal",
    "editSubjectModal",
    "subjectModal",
    "structureModal",
    "editStructureModal",
    "addItemModal",
    "viewStructureModal",
    "archiveStructureModal",
    "termModal",
    "editTermModal",
    "archiveTermModal",
    "archiveDepartmentModal",
    "editDepartmentModal",
    "departmentModal",
    "classModal",
    "editClassModal",
    "archiveClassModal",
    "academicYearModal",
    "editAcademicYearModal",
    "archiveAcademicYearModal",
  ];

  document.addEventListener("click", (event) => {
    modalIds.forEach((id) => {
      const modal = document.getElementById(id);
      if (modal && event.target === modal) {
        modal.classList.remove("active");
        unLockBodyScroll();
      }
    });
  });

  // Dynamic Content Loading & Navigation Rendering
  if (!window.supabaseClient) return;

  await loadHeaderSchoolLogo();

  const {
    data: { user },
    error: authError,
  } = await window.supabaseClient.auth.getUser();

  if (authError || !user) {
    if (typeof renderNavigation === "function") {
      renderNavigation(null);
    }
    return;
  }

  const { data: profile } = await window.supabaseClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (typeof renderNavigation === "function") {
    renderNavigation(profile?.role || null);
  }
});

/**
 * Loads the school logo into the header/sidebar for authenticated users.
 */
async function loadHeaderSchoolLogo() {
  const logoImg = document.getElementById("appHeaderLogo");
  if (!logoImg || !window.supabaseClient) return;

  const DEFAULT_AVATAR =
    "https://api.dicebear.com/7.x/initials/svg?seed=School";

  try {
    const {
      data: { user },
    } = await window.supabaseClient.auth.getUser();
    if (!user) return;

    const { data, error } = await window.supabaseClient
      .from("school_profile")
      .select("logo_url")
      .limit(1)
      .maybeSingle();

    if (error) {
      logoImg.src = DEFAULT_AVATAR;
      return;
    }

    logoImg.src = data?.logo_url ? data.logo_url : DEFAULT_AVATAR;
  } catch (err) {
    console.error("Unexpected error loading header logo:", err);
    logoImg.src = DEFAULT_AVATAR;
  }
}

// Prevent BFCache execution & back-button bypasses
window.addEventListener("pageshow", async (event) => {
  if (
    event.persisted ||
    (window.performance && window.performance.navigation.type === 2)
  ) {
    if (!window.supabaseClient) return;

    const {
      data: { user },
      error,
    } = await window.supabaseClient.auth.getUser();

    // 2. If session died on protected pages, kick to login
    if (!isLoginPage() && (error || !user)) {
      await window.forceLogout();
      return;
    }

    // 3. Re-verify admin page permission on cached navigation
    const currentPage = window.location.pathname.split("/").pop();
    if (ADMIN_ONLY_PAGES.includes(currentPage)) {
      if (!user) {
        await window.forceLogout();
        return;
      }

      const { data: profile } = await window.supabaseClient
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profile?.role !== "admin") {
        await window.forceLogout();
      }
    }
  }
});

// ==========================================
// CENTRAL PAGE GUARD & AUTO-SESSION CHECK
// Runs automatically on every page load
// ==========================================
(async function initPageGuard() {
  // Wait for DOM to load
  if (document.readyState === "loading") {
    await new Promise((resolve) =>
      document.addEventListener("DOMContentLoaded", resolve),
    );
  }

  const path = window.location.pathname.toLowerCase();
  const isLogin =
    path.endsWith("index.html") || path === "/" || path.endsWith("/login.html");

  if (!window.supabaseClient) {
    console.error("Supabase client not initialized in window.supabaseClient");
    return;
  }

  // Actively validate token against Supabase Auth (Detects expired JWTs)
  const {
    data: { user },
    error,
  } = await window.supabaseClient.auth.getUser();

  // If on login page with an active session, redirect to main application
  //if (isLogin && user && !error) {
  //window.location.replace("/html/dashboard.html"); // Adjust path to your main home/dashboard page
  //return;
  //}

  // Redirect immediately if no user or token expired on protected pages
  if (!isLogin && (error || !user)) {
    console.warn("Session expired or invalid user. Redirecting to login...");
    await window.supabaseClient.auth.signOut();
    localStorage.clear();
    sessionStorage.clear();
    window.location.replace("/index.html");
    return;
  }

  // Real-time listener for signouts/timeouts during active session
  window.supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if ((event === "SIGNED_OUT" || !session) && !isLogin) {
      localStorage.clear();
      sessionStorage.clear();
      window.location.replace("/index.html");
    }
  });
})();

window.initAuthListener = async function (supabase) {
  if (!supabase) return;

  const path = window.location.pathname.toLowerCase();
  const isLogin =
    path.endsWith("index.html") || path === "/" || path.endsWith("/login.html");

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (!isLogin && (error || !user)) {
    await supabase.auth.signOut();
    localStorage.clear();
    sessionStorage.clear();
    window.location.replace("/index.html");
    return;
  }

  supabase.auth.onAuthStateChange(async (event, session) => {
    if ((event === "SIGNED_OUT" || !session) && !isLogin) {
      localStorage.clear();
      sessionStorage.clear();
      window.location.replace("/index.html");
    }
  });
};
window.addEventListener("pageshow", async (event) => {
  // Triggers when page is restored from Back-Forward cache
  if (
    event.persisted ||
    (window.performance && window.performance.navigation.type === 2)
  ) {
    if (!window.supabaseClient) return;

    const {
      data: { user },
      error,
    } = await window.supabaseClient.auth.getUser();

    // 1. If on login page but user session is active, push them forward to dashboard
    if (isLoginPage() && user && !error) {
      window.location.replace("/html/dashboard.html"); // Set your standard dashboard path
      return;
    }

    // 2. If on protected app pages but user is logged out, kick them to login
    if (!isLoginPage() && (error || !user)) {
      await window.supabaseClient.auth.signOut();
      localStorage.clear();
      sessionStorage.clear();
      window.location.replace("/index.html");
      return;
    }

    // 3. If on an admin-only page, re-validate role safely
    const currentPage = window.location.pathname.split("/").pop();
    if (ADMIN_ONLY_PAGES.includes(currentPage)) {
      if (!user) {
        window.location.replace("/index.html");
        return;
      }

      const { data: profile } = await window.supabaseClient
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profile?.role !== "admin") {
        await window.supabaseClient.auth.signOut();
        localStorage.clear();
        sessionStorage.clear();
        window.location.replace("/index.html");
      }
    }
  }
});

window.escapeHTML = function (str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};
