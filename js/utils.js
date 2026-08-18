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

function renderNavigation(userRole) {
  const systemUsersLink = document.getElementById("nav-system-users");
  const academicSettingsLink = document.getElementById("nav-academic-settings");
  const departmentsLink = document.getElementById("nav-departments");
  const roomsLink = document.getElementById("nav-rooms");
  const periodsLink = document.getElementById("nav-periods");
  const auditLogsLink = document.getElementById("nav-audit-logs");

  if (userRole == "admin") {
    systemUsersLink.style.display = "block";
  } else {
    systemUsersLink.style.display = "none";
  }

  if (userRole == "admin") {
    academicSettingsLink.style.display = "block";
  } else {
    academicSettingsLink.style.display = "none";
  }

  if (userRole == "admin") {
    departmentsLink.style.display = "block";
  } else {
    departmentsLink.style.display = "none";
  }

  if (userRole == "admin") {
    roomsLink.style.display = "block";
  } else {
    roomsLink.style.display = "none";
  }

  if (userRole == "admin") {
    periodsLink.style.display = "block";
  } else {
    periodsLink.style.display = "none";
  }

  if (userRole == "admin") {
    auditLogsLink.style.display = "block";
  } else {
    auditLogsLink.style.display = "none";
  }
}

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

const INACTIVITY_LIMIT = 30 * 1000; // 30 SECONDS FOR TESTING
let inactivityTimer;

// 1. Attach forceLogout to window
window.forceLogout = async function () {
  if (window.supabaseClient) {
    await window.supabaseClient.auth.signOut();
  }
  localStorage.clear();
  sessionStorage.clear();
  window.location.href = "/html/index.html";
};

// 2. Attach Inactivity Tracker to window
window.initInactivityTracker = function () {
  function resetTimer() {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(async () => {
      alert("Test: Logged out due to 30 seconds of inactivity.");
      await window.forceLogout();
    }, INACTIVITY_LIMIT);
  }

  // Listen for activity
  ["mousemove", "keydown", "click", "scroll"].forEach((event) => {
    window.addEventListener(event, resetTimer, { passive: true });
  });

  resetTimer();
};

// Auto-run inactivity tracker as soon as utils.js loads
window.initInactivityTracker();

supabaseClient.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_OUT" || !session) {
    window.location.href = "/html/index.html";
  }
});

// Auto-run on DOM load
document.addEventListener("DOMContentLoaded", loadHeaderSchoolLogo);

// Auto-run on DOM load
document.addEventListener("DOMContentLoaded", renderNavigation);
