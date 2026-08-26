function lockBodyScroll() {
  document.body.style.overflow = "hidden";
}

function unLockBodyScroll() {
  document.body.style.overflow = "";
}

document.addEventListener("DOMContentLoaded", () => {
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

  // Toggle menu click
  if (menuToggle) {
    menuToggle.addEventListener("click", toggleMenu);
  }

  // Close when tapping backdrop overlay
  if (overlay) {
    overlay.addEventListener("click", closeMenu);
  }

  // Close when tapping any link inside menu
  document.querySelectorAll(".menu a").forEach((link) => {
    link.addEventListener("click", closeMenu);
  });
});

/**
 * Loads the school logo into the header/sidebar for authenticated users.
 * Falls back to a DiceBear initial avatar if no custom logo is found.
 */
async function loadHeaderSchoolLogo() {
  const logoImg = document.getElementById("appHeaderLogo");
  if (!logoImg) return;

  const DEFAULT_AVATAR =
    "https://api.dicebear.com/7.x/initials/svg?seed=School";

  try {
    // 1. Verify user session
    const {
      data: { session },
      error: sessionError,
    } = await supabaseClient.auth.getSession();
    if (sessionError || !session) return;

    // 2. Fetch school profile logo_url
    const { data, error } = await supabaseClient
      .from("school_profile")
      .select("logo_url")
      .limit(1)
      .maybeSingle();

    if (error) {
      logoImg.src = DEFAULT_AVATAR;
      return;
    }

    // 3. Set logo source or fallback
    logoImg.src = data?.logo_url ? data.logo_url : DEFAULT_AVATAR;
  } catch (err) {
    console.error("Unexpected error loading header logo:", err);
    logoImg.src = DEFAULT_AVATAR;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadHeaderSchoolLogo();

  const {
    data: { user },
    error: authError,
  } = await supabaseClient.auth.getUser();

  if (authError || !user) {
    renderNavigation(null);
    return;
  }

  const { data: profile, error: profileError } = await supabaseClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const userRole = profile?.role;
  renderNavigation(userRole);
});

// auth-guard.js

// 1. LIST YOUR PROTECTED PAGES HERE
const ADMIN_ONLY_PAGES = [
  "subjects.html",
  "departments.html",
  "academic-years.html",
  "structure.html",
  "classes.html",
  "auditLogs.html",
];

async function checkPageAccess() {
  // Get the current page filename from the URL (e.g., "subjects.html")
  const currentPage = window.location.pathname.split("/").pop();

  // If the current page isn't in our protected list, let them through
  if (!ADMIN_ONLY_PAGES.includes(currentPage)) {
    return;
  }

  // Check Supabase Session
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();

  if (!session) {
    window.location.replace("/index.html");
    return;
  }

  // Check Role from DB
  const { data: profile } = await supabaseClient
    .from("users")
    .select("role")
    .eq("id", session.user.id)
    .single();

  if (profile?.role !== "admin") {
    // Kick non-admins out to the main dashboard
    window.location.replace("/index.html");
  }
}

// Run immediately before page renders
checkPageAccess();

function showToast(message, type = "success", duration = 3000) {
  let container = document.getElementById("toastContainer");

  // Fallback if container doesn't exist in HTML
  if (!container) {
    container = document.createElement("div");
    container.id = "toastContainer";
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  // Create toast element
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;

  container.appendChild(toast);

  // Trigger smooth fade-in animation
  requestAnimationFrame(() => {
    toast.classList.add("show");
  });

  // Automatically remove after duration
  setTimeout(() => {
    toast.classList.remove("show");
    toast.addEventListener("transitionend", () => toast.remove());
  }, duration);
}

// ==========================================
// CENTRALIZED SESSION & API UTILITIES
// ==========================================

const INACTIVITY_LIMIT = 60 * 30 * 1000; // 30 seconds testing
let inactivityTimer;

// Helper function: Check if current page is the login page
function isLoginPage() {
  const path = window.location.pathname.toLowerCase();
  return (
    path.endsWith("/index.html") ||
    path === "/index.html" ||
    path === "/" ||
    path === ""
  );
}

// 1. Safe forceLogout
window.forceLogout = async function () {
  clearTimeout(inactivityTimer);

  if (window.supabaseClient) {
    try {
      await window.supabaseClient.auth.signOut();
    } catch (e) {
      console.warn("SignOut error ignored:", e);
    }
  }

  localStorage.clear();
  sessionStorage.clear();

  // Redirect to absolute root /index.html
  if (!isLoginPage()) {
    window.location.href = "/index.html"; // <-- Absolute path fixes /html/index.html error
  }
};

// 2. Safe Inactivity Tracker
window.initInactivityTracker = function () {
  if (isLoginPage()) return;

  function resetTimer() {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(async () => {
      if (typeof showToast === "function") {
        showToast("Logged out due to 15 minutes of inactivity.", "error");
      }
      await window.forceLogout();
    }, INACTIVITY_LIMIT);
  }

  ["mousemove", "keydown", "click", "scroll"].forEach((event) => {
    window.addEventListener(event, resetTimer, { passive: true });
  });

  resetTimer();
};

// 3. Safe Auth State Listener
window.initAuthListener = function (supabase) {
  if (!supabase) return;

  supabase.auth.onAuthStateChange((event, session) => {
    if ((event === "SIGNED_OUT" || !session) && !isLoginPage()) {
      window.location.href = "/index.html"; // <-- Absolute path
    }
  });
};

// Auto-start inactivity tracker safely
window.initInactivityTracker();

// Auto-run on DOM load
document.addEventListener("DOMContentLoaded", loadHeaderSchoolLogo);

// Auto-run on DOM load
document.addEventListener("DOMContentLoaded", renderNavigation);
