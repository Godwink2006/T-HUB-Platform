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
  const periodsLink = document.getElementById("nav-periodss");
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
    systemUsersLink.style.display = "none";
  }
}

// Auto-run on DOM load
document.addEventListener("DOMContentLoaded", loadHeaderSchoolLogo);

// Auto-run on DOM load
document.addEventListener("DOMContentLoaded", renderNavigation);
