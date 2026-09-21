function renderNavigation(userRole) {
  const isAdmin = userRole === "admin";
  const isAccountant = userRole === "accountant";
  const isTeacher = userRole === "teacher";
  const isStudent = userRole === "student";

  if (isAdmin) {
    document.querySelectorAll(".admin-only").forEach((el) => {
      el.style.setProperty("display", "list-item", "important");
    });
  }

  if (isAdmin || isAccountant) {
    document.querySelectorAll(".admin-accountant-only").forEach((el) => {
      el.style.setProperty("display", "list-item", "important");
    });
  }

  if (isTeacher || isStudent) {
    document.querySelectorAll(".teacher-student-only").forEach((el) => {
      el.style.setProperty("display", "list-item", "important");
    });
  }
}

const ADMIN_ACCOUNTANT_PAGES = ["students.html", "finance.html"];

const TEACHER_ONLY_PAGES = ["my-assignments.html"];

const TEACHER_Student_ONLY_PAGES = ["my-timetable.html"];

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
  "teacher-assignment.html",
  "teachers.html",
  "timetable.html",
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

function showToast(message, type = "success", duration = 5000) {
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

async function checkPageAccess() {
  const currentPage = window.location.pathname.split("/").pop();

  const isAdminOnly = ADMIN_ONLY_PAGES.includes(currentPage);
  const isAdminOrAccountantOnly = ADMIN_ACCOUNTANT_PAGES.includes(currentPage);
  const isTeacherOnly = TEACHER_ONLY_PAGES.includes(currentPage);

  if (!isAdminOnly && !isAdminOrAccountantOnly && !isTeacherOnly) {
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

  const role = profile?.role;

  if (isAdminOnly && role !== "admin") {
    await window.forceLogout();
    return;
  }

  if (isAdminOrAccountantOnly && role !== "admin" && role !== "accountant") {
    await window.forceLogout();
    return;
  }

  if (isTeacherOnly && role !== "teacher") {
    await window.forceLogout();
    return;
  }

  document.documentElement.style.visibility = "";
}

checkPageAccess();

document.addEventListener("DOMContentLoaded", async () => {
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
      .from("schools")
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

    if (!isLoginPage() && (error || !user)) {
      await window.forceLogout();
      return;
    }

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

(async function initPageGuard() {
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

  const {
    data: { user },
    error,
  } = await window.supabaseClient.auth.getUser();

  if (!isLogin && (error || !user)) {
    console.warn("Session expired or invalid user. Redirecting to login...");
    await window.supabaseClient.auth.signOut();
    localStorage.clear();
    sessionStorage.clear();
    window.location.replace("/index.html");
    return;
  }

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
  if (
    event.persisted ||
    (window.performance && window.performance.navigation.type === 2)
  ) {
    if (!window.supabaseClient) return;

    const {
      data: { user },
      error,
    } = await window.supabaseClient.auth.getUser();

    if (isLoginPage() && user && !error) {
      window.location.replace("/html/dashboard.html");
      return;
    }

    if (!isLoginPage() && (error || !user)) {
      await window.supabaseClient.auth.signOut();
      localStorage.clear();
      sessionStorage.clear();
      window.location.replace("/index.html");
      return;
    }

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

function escapeAttribute(str) {
  if (!str) return "";
  return String(str)
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
document.addEventListener("DOMContentLoaded", () => {
  if (window.supabaseClient?.auth) {
    window.supabaseClient.auth.onAuthStateChange(async (event, session) => {
      const isLoginPage =
        window.location.pathname.endsWith("index.html") ||
        window.location.pathname === "/";
      if (isLoginPage) return;

      if (session?.user) {
        const { data: profile, error } = await window.supabaseClient
          .from("profiles")
          .select("status")
          .eq("id", session.user.id)
          .maybeSingle();

        if (error || !profile || profile.status !== "active") {
          await window.supabaseClient.auth.signOut();
          localStorage.clear();
          sessionStorage.clear();
          window.location.replace("/index.html?error=account_disabled");
        }
      }
    });
  }
});

