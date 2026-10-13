function renderNavigation(userRole) {
  const isAdmin = userRole === "admin";
  const isAccountant = userRole === "accountant";
  const isTeacher = userRole === "teacher";
  const isStudent = userRole === "student";
  const isLibrarian = userRole === "librarian";

  if (isAdmin || isStudent || isTeacher || isAccountant) {
    document.querySelectorAll(".exclude-librarian").forEach((el) => {
      el.style.setProperty("display", "list-item", "important");
    });
  }

  if (isAdmin || isLibrarian) {
    document.querySelectorAll(".admin-librarian-only").forEach((el) => {
      el.style.setProperty("display", "list-item", "important");
    });
  }

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

  if (isAdmin || isTeacher) {
    document.querySelectorAll(".admin-teacher-only").forEach((el) => {
      el.style.setProperty("display", "list-item", "important");
    });
  }

  if (isTeacher) {
    document.querySelectorAll(".teacher-only").forEach((el) => {
      el.style.setProperty("display", "list-item", "important");
    });
  }

  if (isStudent) {
    document.querySelectorAll(".student-only").forEach((el) => {
      el.style.setProperty("display", "list-item", "important");
    });
  }

  if (isTeacher || isStudent) {
    document.querySelectorAll(".teacher-student-only").forEach((el) => {
      el.style.setProperty("display", "list-item", "important");
    });
  }
}

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

const ADMIN_ACCOUNTANT_PAGES = [
  "students.html",
  "parent-invitations.html",
  "finance.html",
  "enrollment.html",
];

const PARENT_ONLY_PAGES = ["parent-dashboard.html", "parent-records.html"];

const ADMIN_TEACHER_PAGES = ["attendance.html", "grades.html"];

const TEACHER_ONLY_PAGES = ["my-assignments.html"];

const STUDENT_ONLY_PAGES = ["my-attendance.html"];

const TEACHER_STUDENT_ONLY_PAGES = ["my-timetable.html"];

const TEACHER_LIBRARIAN_ONLY_PAGES = ["library.html"];

const EXCLUDE_LIBRARIAN_PAGE = ["academics.html"];

window.DEFAULT_PROFILE_AVATAR =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128' width='128' height='128'><circle cx='64' cy='64' r='64' fill='%23E4E6EB'/><circle cx='64' cy='46' r='22' fill='%23B0B3B8'/><path d='M24 112c0-22 18-40 40-40s40 18 40 40' fill='%23B0B3B8'/></svg>";

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

let _authContextPromise = null;

window.getAuthContext = function (forceRefresh = false) {
  if (!forceRefresh && _authContextPromise) {
    return _authContextPromise;
  }

  _authContextPromise = (async () => {
    if (!window.supabaseClient) return null;

    try {
      const {
        data: { user },
        error: userError,
      } = await window.supabaseClient.auth.getUser();

      if (userError || !user) {
        return null;
      }

      const { data: profile, error: profileError } = await window.supabaseClient
        .from("profiles")
        .select("id, full_name, role, status, school_id")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        console.warn("Could not load user profile:", profileError);
      }

      return { user, profile: profile || null };
    } catch (err) {
      console.error("Error retrieving auth context:", err);
      return null;
    }
  })();

  return _authContextPromise;
};

window.clearAuthContext = function () {
  _authContextPromise = null;
};

window.loadTransferredStudentIdentitySnapshots = async function (studentIds) {
  const ids = [...new Set((studentIds || []).filter(Boolean))];
  if (ids.length === 0) return new Map();

  const client = window.supabaseClient;
  const authContext = await window.getAuthContext();
  const schoolId = authContext?.profile?.school_id;
  if (!client || !schoolId) return new Map();

  const { data, error } = await client
    .from("student_enrollments")
    .select("student_id, student_name_snapshot, student_code_snapshot")
    .eq("school_id", schoolId)
    .in("student_id", ids)
    .not("student_name_snapshot", "is", null);

  if (error) {
    console.error("Could not load transferred student identity snapshots:", error);
    return new Map();
  }

  const snapshots = new Map();
  (data || []).forEach((row) => {
    if (!snapshots.has(row.student_id)) snapshots.set(row.student_id, row);
  });
  return snapshots;
};

window.forceLogout = async function () {
  window.clearAuthContext?.();
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
  const isAdminOrTeacherOnly = ADMIN_TEACHER_PAGES.includes(currentPage);
  const isTeacherOnly = TEACHER_ONLY_PAGES.includes(currentPage);
  const isStudentOnly = STUDENT_ONLY_PAGES.includes(currentPage);
  const isTeacherOrStudentOnly =
    TEACHER_STUDENT_ONLY_PAGES.includes(currentPage);
  const isAdminOrLibrarianOnly =
    TEACHER_LIBRARIAN_ONLY_PAGES.includes(currentPage);
  const isExcludeLibrarian = EXCLUDE_LIBRARIAN_PAGE.includes(currentPage);
  const isParentOnly = PARENT_ONLY_PAGES.includes(currentPage);

  const isProtectedPage =
    isAdminOnly ||
    isAdminOrAccountantOnly ||
    isAdminOrTeacherOnly ||
    isTeacherOnly ||
    isStudentOnly ||
    isAdminOrLibrarianOnly ||
    isExcludeLibrarian ||
    isParentOnly ||
    isTeacherOrStudentOnly;

  if (!isProtectedPage) {
    return;
  }

  document.documentElement.style.visibility = "hidden";

  if (!window.supabaseClient) {
    window.location.replace("/index.html?error=service_unavailable");
    return;
  }

  const authCtx = await window.getAuthContext();
  const user = authCtx?.user;
  const profile = authCtx?.profile;

  if (!user) {
    await window.forceLogout();
    return;
  }

  const role = profile?.role;

  if (isParentOnly && role !== "parent") {
    await window.forceLogout();
    return;
  }

  if (isAdminOnly && role !== "admin") {
    await window.forceLogout();
    return;
  }

  if (isAdminOrAccountantOnly && role !== "admin" && role !== "accountant") {
    await window.forceLogout();
    return;
  }

  if (isAdminOrLibrarianOnly && role !== "admin" && role !== "librarian") {
    await window.forceLogout();
    return;
  }

  if (isAdminOrTeacherOnly && role !== "admin" && role !== "teacher") {
    await window.forceLogout();
    return;
  }

  if (isTeacherOnly && role !== "teacher") {
    await window.forceLogout();
    return;
  }

  if (isStudentOnly && role !== "student") {
    await window.forceLogout();
    return;
  }

  if (isTeacherOrStudentOnly && role !== "teacher" && role !== "student") {
    await window.forceLogout();
    return;
  }

  if (
    isExcludeLibrarian &&
    role !== "teacher" &&
    role !== "student" &&
    role !== "admin" &&
    role !== "accountant"
  ) {
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

  document.addEventListener(
    "error",
    (event) => {
      const image = event.target;
      if (
        image instanceof HTMLImageElement &&
        image.matches(
          ".student-photo, .teacher-photo, .systemUser-photo, .app-person-avatar, #profileAvatar, .view-student-photo, .view-teacher-photo",
        ) &&
        image.src !== window.DEFAULT_PROFILE_AVATAR
      ) {
        image.src = window.DEFAULT_PROFILE_AVATAR;
      }
    },
    true,
  );

  const modalIds = [
    "periodModal",
    "editPeriodModal",
    "editSystemUserModal",
    "systemUserModal",
    "editSubjectModal",
    "subjectModal",
    "structureModal",
    "editStructureModal",
    "viewStructureModal",
    "termModal",
    "editTermModal",
    "editDepartmentModal",
    "departmentModal",
    "classModal",
    "editClassModal",
    "academicYearModal",
    "editAcademicYearModal",
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

  const authCtx = await window.getAuthContext();
  if (typeof renderNavigation === "function") {
    renderNavigation(authCtx?.profile?.role || null);
  }
});

async function loadHeaderSchoolLogo() {
  const logoImg = document.getElementById("appHeaderLogo");
  if (!logoImg || !window.supabaseClient) return;

  const DEFAULT_AVATAR =
    "https://api.dicebear.com/7.x/initials/svg?seed=School";

  try {
    const authCtx = await window.getAuthContext();
    if (!authCtx?.user) return;

    let schoolNameEl = document.querySelector(".sidebar-school-name");
    const logo = logoImg.closest(".logo");
    if (logo) {
      if (!schoolNameEl) {
        schoolNameEl = document.createElement("p");
        schoolNameEl.className = "sidebar-school-name";
        schoolNameEl.setAttribute("aria-live", "polite");
        logo.insertAdjacentElement("afterend", schoolNameEl);
      }
      schoolNameEl.textContent = "";
      schoolNameEl.hidden = true;
    }

    if (!authCtx.profile?.school_id) {
      logoImg.src = DEFAULT_AVATAR;
      return;
    }

    const { data, error } = await window.supabaseClient
      .from("schools")
      .select("school_name, logo_url")
      .eq("id", authCtx.profile.school_id)
      .maybeSingle();

    if (error) {
      console.error("Could not load the signed-in user's school:", error);
      logoImg.src = DEFAULT_AVATAR;
      return;
    }

    logoImg.src = data?.logo_url ? data.logo_url : DEFAULT_AVATAR;
    if (schoolNameEl) {
      schoolNameEl.textContent = data?.school_name || "";
      schoolNameEl.hidden = !data?.school_name;
    }
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

    window.clearAuthContext?.();
    const authCtx = await window.getAuthContext(true);
    const user = authCtx?.user;
    const profile = authCtx?.profile;

    if (isLoginPage() && user) {
      window.location.replace("/html/dashboard.html");
      return;
    }

    if (!isLoginPage() && !user) {
      await window.forceLogout();
      return;
    }

    const currentPage = window.location.pathname.split("/").pop();
    if (ADMIN_ONLY_PAGES.includes(currentPage) && profile?.role !== "admin") {
      await window.forceLogout();
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
    if (!isLogin)
      window.location.replace("/index.html?error=service_unavailable");
    return;
  }

  const authCtx = await window.getAuthContext();
  const user = authCtx?.user;

  if (!isLogin && !user) {
    console.warn("Session expired or invalid user. Redirecting to login...");
    await window.supabaseClient.auth.signOut();
    window.clearAuthContext?.();
    localStorage.clear();
    sessionStorage.clear();
    window.location.replace("/index.html");
    return;
  }

  window.supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if ((event === "SIGNED_OUT" || !session) && !isLogin) {
      window.clearAuthContext?.();
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

  const authCtx = await window.getAuthContext();
  const user = authCtx?.user;

  if (!isLogin && !user) {
    await supabase.auth.signOut();
    window.clearAuthContext?.();
    localStorage.clear();
    sessionStorage.clear();
    window.location.replace("/index.html");
    return;
  }

  supabase.auth.onAuthStateChange(async (event, session) => {
    if ((event === "SIGNED_OUT" || !session) && !isLogin) {
      window.clearAuthContext?.();
      localStorage.clear();
      sessionStorage.clear();
      window.location.replace("/index.html");
    }
  });
};

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

async function logActivity(
  schoolId,
  description,
  color,
  targetAudience = "Everyone",
) {
  const { error } = await window.supabaseClient
    .from("recent_activities")
    .insert([
      {
        school_id: schoolId,
        message: description,
        dot_color: color,
        target_audience: targetAudience,
      },
    ]);

  if (error) console.error("Error logging activity:", error);
}

async function loadRecentActivities(schoolId) {
  const listContainer = document.getElementById("recentActivitiesList");
  if (!listContainer) return;

  try {
    const { data: activities, error } = await window.supabaseClient
      .from("recent_activities")
      .select("message, dot_color, created_at")
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false })
      .limit(5);

    if (!error && activities && activities.length > 0) {
      listContainer.innerHTML = activities
        .map(
          (act) => `
  <li>
  <i class="fas fa-bullhorn fa-2x dashboard-icon ${/^(green|blue|red|yellow|orange)$/.test(act.dot_color) ? act.dot_color : "green"}"></i>
  ${escapeHTML(act.message || "")}
</li>
      `,
        )
        .join("");
    } else {
      listContainer.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-bullhorn fa-10x"></i>
          <p>No recent activities found</p>
        </div>
      `;
    }
  } catch (err) {
    console.error("Error loading recent activities:", err);
  }
}

async function subscribeToRecentActivities(schoolId, userRole) {
  const existingChannel = window.supabaseClient
    .getChannels()
    .find((c) => c.topic === "realtime:public:recent_activities");

  if (existingChannel) {
    await window.supabaseClient.removeChannel(existingChannel);
  }

  window.supabaseClient
    .channel("public:recent_activities")
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "recent_activities",
        filter: `school_id=eq.${schoolId}`,
      },
      (payload) => {
        const activity = payload.new;
        const targetAudience = activity.target_audience || "Everyone";

        const allowedAudiences = targetAudience.split(",").map((a) => a.trim());

        if (
          allowedAudiences.includes("Everyone") ||
          allowedAudiences.includes("All") ||
          allowedAudiences.includes(userRole)
        ) {
          prependActivityToUI(activity);
        }
      },
    )
    .subscribe();
}

function prependActivityToUI(activity) {
  const listContainer = document.getElementById("recentActivitiesList");
  if (!listContainer) return;

  if (listContainer.innerHTML.includes("No recent activities")) {
    listContainer.innerHTML = "";
  }

  const li = document.createElement("li");
  li.innerHTML = `
    <span class="dashboard-dot ${/^(green|blue|red|yellow|orange)$/.test(activity.dot_color) ? activity.dot_color : "green"}"></span>
    ${escapeHTML(activity.message || "")}
  `;

  listContainer.prepend(li);

  const items = listContainer.getElementsByTagName("li");
  if (items.length > 5) {
    listContainer.removeChild(items[items.length - 1]);
  }
}

window.sendNotification = async function (
  schoolId,
  userId,
  title,
  message,
  type = "general",
) {
  try {
    const payload = {
      user_id: userId,
      title: title,
      message: message,
      type: type,
      is_read: false,
    };

    if (schoolId) {
      payload.school_id = schoolId;
    }

    const { data, error } = await window.supabaseClient
      .from("notifications")
      .insert([payload]);

    if (error) throw error;
    return { success: true, data };
  } catch (err) {
    console.error("Failed to send notification:", err);
    return { success: false, error: err };
  }
};
