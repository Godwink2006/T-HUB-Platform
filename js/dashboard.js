const filterBtn = document.querySelector(".filter-btn");
const filterMenu = document.querySelector(".filter-menu");
const customDate = document.querySelector(".custom-date");

const dateRangeModal = document.getElementById("dateRangeModal");
const closeDateModal = document.getElementById("closeDateModal");
const cancelDateModal = document.getElementById("cancelDateModal");

filterBtn.addEventListener("click", function (e) {
  e.stopPropagation();
  if (filterMenu.style.display === "block") {
    filterMenu.style.display = "none";
  } else {
    filterMenu.style.display = "block";
  }
});

customDate.addEventListener("click", function (e) {
  e.preventDefault();

  filterMenu.style.display = "none";

  dateRangeModal.style.display = "flex";

  lockBodyScroll();
});

closeDateModal.addEventListener("click", function () {
  dateRangeModal.style.display = "none";

  unLockBodyScroll();
});

cancelDateModal.addEventListener("click", function () {
  dateRangeModal.style.display = "none";

  unLockBodyScroll();
});

window.addEventListener("click", (e) => {
  if (!filterBtn.contains(e.target) && !filterMenu.contains(e.target)) {
    filterMenu.style.display = "none";
  }

  if (e.target === dateRangeModal) {
    dateRangeModal.style.display = "none";

    unLockBodyScroll();
  }
});

const announcementModal = document.getElementById("announcementModal");

const cancelAnnouncementModal = document.getElementById(
  "cancelAnnouncementModal",
);

const openAnnouncementModal = document.getElementById("openAnnouncementModal");

const closeAnnouncementModal = document.getElementById(
  "closeAnnouncementModal",
);

openAnnouncementModal.addEventListener("click", () => {
  announcementModal.style.display = "flex";

  lockBodyScroll();
});

closeAnnouncementModal.addEventListener("click", () => {
  announcementModal.style.display = "none";

  unLockBodyScroll();
});

cancelAnnouncementModal.addEventListener("click", () => {
  announcementModal.style.display = "none";

  unLockBodyScroll();
});

window.addEventListener("click", (e) => {
  if (e.target === announcementModal) {
    announcementModal.style.display = "none";

    unLockBodyScroll();
  }
});

const newAnnouncementTrigger = document.querySelector(".new-announcement-btn"); // Adjust selector if your trigger button has a specific ID
const closeAnnouncementBtn = document.getElementById("closeAnnouncementModal");
const cancelAnnouncementBtn = document.getElementById(
  "cancelAnnouncementModal",
);
const saveAnnouncementBtn = document.getElementById("saveAnnouncementBtn");

if (newAnnouncementTrigger) {
  newAnnouncementTrigger.addEventListener("click", () => {
    announcementModal.style.display = "flex";
  });
}

function closeAnnounceModal() {
  announcementModal.style.display = "none";
  unLockBodyScroll();
}

if (closeAnnouncementBtn)
  closeAnnouncementBtn.addEventListener("click", closeAnnounceModal);
if (cancelAnnouncementBtn)
  cancelAnnouncementBtn.addEventListener("click", closeAnnounceModal);

if (saveAnnouncementBtn) {
  saveAnnouncementBtn.addEventListener("click", async () => {
    const title = document.getElementById("announcementTitle").value.trim();
    const status = document.getElementById("announcementStatus").value;
    const expiry_date =
      document.getElementById("announcementExpiry").value || null;
    const message = document.getElementById("announcementMessage").value.trim();

    // 1. Gather all checked audience values
    const checkedAudiences = Array.from(
      document.querySelectorAll('input[name="announcementAudience"]:checked'),
    ).map((cb) => cb.value);

    if (!title || !message) {
      if (typeof showToast === "function")
        showToast("Please fill in all required fields.", "error");
      return;
    }

    if (checkedAudiences.length === 0) {
      if (typeof showToast === "function")
        showToast("Please select at least one target audience.", "error");
      return;
    }

    // Join them into a comma-separated string for storage (e.g., "Teachers, Librarians")
    const target_audience = checkedAudiences.join(", ");

    saveAnnouncementBtn.disabled = true;
    saveAnnouncementBtn.textContent = "Publishing...";

    try {
      const {
        data: { user },
        error: authError,
      } = await window.supabaseClient.auth.getUser();
      if (authError) throw authError;

      const { data: profile, error: profileError } = await window.supabaseClient
        .from("profiles")
        .select("school_id")
        .eq("id", user.id)
        .single();

      if (profileError || !profile)
        throw new Error("Could not determine user school.");

      const schoolId = profile.school_id;

      const { error: insertError } = await window.supabaseClient
        .from("announcements")
        .insert([
          {
            school_id: schoolId,
            title: title,
            message: message,
            status: status,
            target_audience: target_audience,
            expiry_date: expiry_date,
            created_by: user.id,
          },
        ]);

      if (insertError) throw insertError;

      await logActivity(
        schoolId,
        `New Announcement: ${title}`,
        "blue",
        target_audience,
      );

      if (typeof showToast === "function") {
        showToast("Announcement published successfully!", "success");
      }

      await loadRecentActivities(schoolId);
      subscribeToRecentActivities(schoolId);

      closeAnnounceModal();

      unLockBodyScroll();

      if (typeof loadDashboardAnnouncements === "function") {
        loadDashboardAnnouncements();
      }
    } catch (err) {
      console.error("Error publishing announcement:", err);
      if (typeof showToast === "function") {
        showToast(err.message || "Failed to publish announcement.", "error");
      }
    } finally {
      saveAnnouncementBtn.disabled = false;
      saveAnnouncementBtn.textContent = "Publish Announcements";
    }
  });
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function loadDashboardAnnouncements() {
  const previewContainer = document.querySelector(".announcement-preview");
  const openAnnouncementBtn = document.getElementById("openAnnouncementModal");
  const openClassBtn = document.getElementById("class-dashboard-card");
  const openStudentBtn = document.getElementById("student-dashboard-card");
  const openTeacherBtn = document.getElementById("teacher-dashboard-card");
  const openAttendanceBtn = document.getElementById(
    "attendance-dashboard-card",
  );
  const openEnrollmentBtn = document.getElementById(
    "enrollment-dashboard-card",
  );
  const welcomeText = document.getElementById("welcomeUserText");
  if (!previewContainer) return;

  previewContainer.innerHTML = `

     <div style="padding: 24px; text-align: center; color: #64748b; background: #fff;  border: 2px solid rgb(219, 215, 215);">
        <i class="fa-solid fa-spinner fa-spin" style="margin-right: 0.5rem;"></i>
        Loading announcements...
      </div>
  `;

  try {
    // 1. Get current user and profile (school_id & role)
    const {
      data: { user },
      error: authError,
    } = await window.supabaseClient.auth.getUser();
    if (authError) throw authError;

    const { data: profile, error: profileError } = await window.supabaseClient
      .from("profiles")
      .select("school_id, full_name, role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile)
      throw new Error("Could not fetch user profile.");

    loadDashboardStats(profile.school_id);

    if (welcomeText) {
      welcomeText.textContent = `Welcome back, ${profile.full_name || "User"}`;
    }
    // 1. Admin-only buttons check
    if (profile.role === "admin") {
      if (openAnnouncementBtn) openAnnouncementBtn.style.display = "flex";
      if (openClassBtn) openClassBtn.style.display = "block";
      if (openStudentBtn) openStudentBtn.style.display = "block";
      if (openTeacherBtn) openTeacherBtn.style.display = "block";
    }

    // 2. Staff roles check for enrollment button (using .includes() instead of commas)
    const allowedStaffRoles = ["admin", "teacher", "accountant", "librarian"];

    if (allowedStaffRoles.includes(profile.role)) {
      if (openEnrollmentBtn) openEnrollmentBtn.style.display = "block";
    }

    const allowedAttendanceRoles = ["admin", "teacher", "student"];

    if (allowedAttendanceRoles.includes(profile.role)) {
      if (openAttendanceBtn) openAttendanceBtn.style.display = "block";
    }

    const today = new Date().toISOString().split("T")[0];

    // 2. Fetch announcements for this school that haven't expired
    const { data: announcements, error: fetchError } =
      await window.supabaseClient
        .from("announcements")
        .select("*")
        .eq("school_id", profile.school_id)
        .or(`expiry_date.is.null,expiry_date.gte.${today}`)
        .order("created_at", { ascending: false });

    if (fetchError) throw fetchError;

    // 3. Filter by role/audience
    const filteredAnnouncements = (announcements || []).filter((ann) => {
      if (profile.role === "admin") return true;
      const audiences = (ann.target_audience || "").split(",").map((a) => {
        let clean = a.trim().toLowerCase();
        if (clean.endsWith("s")) clean = clean.slice(0, -1);
        return clean;
      });
      const userRole = (profile.role || "").trim().toLowerCase();
      return audiences.includes("all") || audiences.includes(userRole);
    });

    // 4. Render into preview container
    if (filteredAnnouncements.length === 0) {
      previewContainer.innerHTML = `
     <div class="announcement-item empty-state" style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 20px; text-align: center; height: 280px; color: #64748b;">
  <i class="fas fa-bullhorn fa-7x" style="color: #cbd5e1; margin-bottom: 16px;"></i>
  <h4 style="margin: 0 0 8px 0; color: #334155; font-size: 22px; font-weight: 600;">No announcements found</h4>
  <p style="margin: 0; font-size: 15px; color: #64748b;">Published announcements will appear here.</p>
</div>
      `;
      return;
    }

    previewContainer.innerHTML = filteredAnnouncements
      .map((ann) => {
        // Dynamic styling based on status
        let statusBg = "#e2e8f0";
        let statusColor = "#475569";
        let borderColor = "#3b82f6";

        if (ann.status === "Important") {
          statusBg = "#fef3c7";
          statusColor = "#d97706";
          borderColor = "#f59e0b";
        } else if (ann.status === "Urgent") {
          statusBg = "#fee2e2";
          statusColor = "#dc2626";
          borderColor = "#ef4444";
        }

        return `
        <div class="small-border-announcement" style=" padding: 16px; margin-bottom: 12px; background: #fff;  border: 2px solid rgb(219, 215, 215);">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
            <h4 style="margin: 0; font-size: 1.05rem; color: #0f172a; font-weight: 600;">${escapeHtml(ann.title)}</h4>
            <span class="announcement-status" style="font-size: 0.75rem; padding: 3px 10px; background: ${statusBg}; color: ${statusColor}; font-weight: 600; text-transform: uppercase; letter-spacing: 0.025em;">${escapeHtml(ann.status)}</span>
          </div>
          <p style="margin: 0 0 12px 0; font-size: 0.95rem; color: #334155; line-height: 1.5;">${escapeHtml(ann.message)}</p>
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; color: #64748b;  border-top: 2px solid rgb(219, 215, 215);">
            <span><i class="fa-solid fa-users" style="margin-right: 4px;"></i> Target: ${escapeHtml(ann.target_audience)}</span>
            <span><i class="fa-regular fa-calendar" style="margin-right: 4px;"></i> ${ann.expiry_date || "No expiry date"}</span>
          </div>
        </div>
      `;
      })
      .join("");
  } catch (err) {
    console.error("Error loading announcements:", err);
  }
}

// Automatically load when the dashboard page opens
document.addEventListener("DOMContentLoaded", () => {
  loadDashboardAnnouncements();
});

document.addEventListener("DOMContentLoaded", async () => {
  const avatarImg = document.getElementById("profileAvatar");
  if (!avatarImg) return;

  const {
    data: { user },
    error: authError,
  } = await supabaseClient.auth.getUser();
  if (authError || !user) return;

  const { data: profile, error } = await supabaseClient
    .from("profiles")
    .select("photo_url")
    .eq("id", user.id)
    .single();

  if (error) {
    console.error("Error fetching dashboard avatar:", error);
    return;
  }

  if (profile && profile.photo_url) {
    avatarImg.src = profile.photo_url;
  }
});

async function loadDashboardStats(schoolId) {
  try {
    // 1. Fetch Total & Active Students
    const { data: studentsData, error: studentError } =
      await window.supabaseClient
        .from("profiles")
        .select("status")
        .eq("school_id", schoolId)
        .eq("role", "student");

    if (!studentError && studentsData) {
      const totalStudents = studentsData.length;
      const activeStudents = studentsData.filter(
        (s) => (s.status || "").toLowerCase() === "active",
      ).length;

      document.getElementById("totalStudentsCount").textContent = totalStudents;
      document.getElementById("studentSubtext").textContent =
        `${activeStudents} Active / ${totalStudents} Total`;
    } else {
      document.getElementById("totalStudentsCount").textContent = "0";
      document.getElementById("studentSubtext").textContent =
        "0 Active / 0 Total";
    }

    // 2. Fetch Total & Active Teachers
    const { data: teachersData, error: teacherError } =
      await window.supabaseClient
        .from("profiles")
        .select("status")
        .eq("school_id", schoolId)
        .eq("role", "teacher");

    if (!teacherError && teachersData) {
      const totalTeachers = teachersData.length;
      const activeTeachers = teachersData.filter(
        (t) => (t.status || "").toLowerCase() === "active",
      ).length;

      document.getElementById("totalTeachersCount").textContent = totalTeachers;
      document.getElementById("teacherSubtext").textContent =
        `${activeTeachers} Active / ${totalTeachers} Total`;
    } else {
      document.getElementById("totalTeachersCount").textContent = "0";
      document.getElementById("teacherSubtext").textContent =
        "0 Active / 0 Total";
    }

    const { data: classesData, error: classError } = await window.supabaseClient
      .from("classes")
      .select("status")
      .eq("school_id", schoolId);

    if (!classError && classesData) {
      const totalClasses = classesData.length;
      const activeClasses = classesData.filter(
        (c) => (c.status || "").toLowerCase() === "active",
      ).length;

      document.getElementById("totalClassesCount").textContent = totalClasses;
      document.getElementById("classSubtext").textContent =
        `${activeClasses} Active / ${totalClasses} Total`;
    } else {
      document.getElementById("totalClassesCount").textContent = "0";
      document.getElementById("classSubtext").textContent =
        "0 Active / 0 Total";
    }

    const today = new Date().toISOString().split("T")[0]; // e.g., "2026-09-24"

    const { data: attendanceData, error: attError } =
      await window.supabaseClient
        .from("attendance_records")
        .select(
          `
          status,
          attendance:attendance_id ( status )
        `,
        )
        .eq("school_id", schoolId)
        .gte("created_at", `${today}T00:00:00`)
        .lte("created_at", `${today}T23:59:59`);

    if (!attError && attendanceData && attendanceData.length > 0) {
      // Filter only student records belonging to an attendance session whose status is "submitted"
      const submittedRecords = attendanceData.filter(
        (row) => (row.attendance?.status || "").toLowerCase() === "submitted",
      );

      if (submittedRecords.length > 0) {
        const presentCount = submittedRecords.filter(
          (row) => (row.status || "").toLowerCase() === "present",
        ).length;

        const percentage = Math.round(
          (presentCount / submittedRecords.length) * 100,
        );
        document.getElementById("attendanceCount").textContent =
          `${percentage}%`;

        // Determine dynamic status subtext
        let statusLabel = "Normal";
        let statusColor = "#475569";

        if (percentage >= 90) {
          statusLabel = "Excellent";
          statusColor = "#16a34a"; // Green
        } else if (percentage >= 75) {
          statusLabel = "Normal";
          statusColor = "#2563eb"; // Blue
        } else if (percentage >= 50) {
          statusLabel = "Needs Attention";
          statusColor = "#d97706"; // Amber/Orange
        } else {
          statusLabel = "Bad";
          statusColor = "#dc2626"; // Red
        }

        const subtextEl = document.getElementById("attendanceSubtext");
        subtextEl.textContent = statusLabel;
        subtextEl.style.color = statusColor;
        subtextEl.style.fontWeight = "600";
      } else {
        // Triggered if there are records today, but none of them are officially submitted yet
        document.getElementById("attendanceCount").textContent = "0%";
        const subtextEl = document.getElementById("attendanceSubtext");
        subtextEl.textContent = "No submitted records";
        subtextEl.style.color = "#64748b";
        subtextEl.style.fontWeight = "normal";
      }
    } else {
      // Triggered automatically when a new day starts and no records exist yet
      document.getElementById("attendanceCount").textContent = "0%";
      const subtextEl = document.getElementById("attendanceSubtext");
      subtextEl.textContent = "No records today";
      subtextEl.style.color = "#64748b";
      subtextEl.style.fontWeight = "normal";
    }
  } catch (err) {
    console.error("Error loading dashboard stats:", err);
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    // 1. Get the current logged-in user from Supabase Auth
    const {
      data: { user },
      error: authError,
    } = await window.supabaseClient.auth.getUser();
    if (authError || !user) {
      console.warn("No active user session found.");
      return;
    }

    // 2. Fetch the user's profile to get their school_id
    const { data: profile, error: profileError } = await window.supabaseClient
      .from("profiles")
      .select("school_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile || !profile.school_id) {
      console.error("Could not determine user school ID.");
      return;
    }

    const schoolId = profile.school_id;
    window.currentSchoolId = schoolId;

    await loadRecentActivities(schoolId);
    subscribeToRecentActivities(schoolId);

    loadDashboardStats(schoolId);
    loadEnrollmentStats(schoolId);
    loadEnrollmentStats("year");
    updateNotificationBadge(user.id);
  } catch (err) {
    console.error("Error loading dashboard data:", err);
  }
});

async function updateNotificationBadge(userId) {
  try {
    // Query unread notifications for the user
    const { error, count } = await window.supabaseClient
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_read", false); // Adjust to .eq("status", "unread") if your DB uses a text column instead of boolean

    const badge = document.getElementById("sidebarNotificationBadge");
    if (!badge) return;

    // Use nullish coalescing to ensure count defaults to 0 safely
    const unreadCount = count ?? 0;

    if (!error && unreadCount > 0) {
      badge.textContent = unreadCount;
      badge.style.display = "inline-block"; // Makes it visible!
    } else {
      badge.style.display = "none"; // Hide if zero or error occurs
    }
  } catch (err) {
    console.error("Error fetching notifications:", err);
  }
}

async function loadEnrollmentStats(
  filterType = "year",
  customStart = null,
  customEnd = null,
) {
  try {
    const activeSchoolId = window.currentSchoolId;

    if (!activeSchoolId) {
      console.warn("Active school ID not found yet.");
      return;
    }

    // 1. Get current user and role
    const {
      data: { user },
    } = await window.supabaseClient.auth.getUser();
    if (!user) return;

    const { data: profile } = await window.supabaseClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const userRole = profile ? profile.role : "teacher";

    // 2. Format custom dates properly for PostgreSQL if provided
    const formattedStart = customStart ? `${customStart}T00:00:00` : null;
    const formattedEnd = customEnd ? `${customEnd}T23:59:59` : null;

    // 3. Call database function with filter variables
    const { data: stats, error } = await window.supabaseClient.rpc(
      "get_dashboard_stats",
      {
        p_school_id: activeSchoolId,
        p_user_id: user.id,
        p_role: userRole,
        p_filter_type: filterType,
        p_custom_start: formattedStart,
        p_custom_end: formattedEnd,
      },
    );

    if (error) throw error;

    // 4. Update the UI DOM elements
    document.getElementById("totalEnrollmentCount").textContent = (
      stats.total || 0
    ).toLocaleString();
    document.getElementById("activeEnrollmentCount").textContent = (
      stats.active || 0
    ).toLocaleString();
    document.getElementById("genderBreakdownCount").textContent =
      `${stats.boys || 0} / ${stats.girls || 0}`;
  } catch (err) {
    console.error("Error loading enrollment stats:", err);
  }
}

const dateModal = document.getElementById("dateRangeModal");
const closeDateModalBtn = document.getElementById("closeDateModal");
const cancelDateModalBtn = document.getElementById("cancelDateModal");
const applyDateBtn = document.getElementById("applyDateBtn");

// 1. Open modal when "Custom Date Range" is clicked in the dropdown
document
  .querySelector(".filter-menu a.custom-date")
  .addEventListener("click", (e) => {
    e.preventDefault();
    dateModal.style.display = "flex"; // Or whatever class/display style your app uses for modals
  });

closeDateModalBtn.addEventListener("click", closeDateModal);
cancelDateModalBtn.addEventListener("click", closeDateModal);

// 3. Apply custom date filter
applyDateBtn.addEventListener("click", async () => {
  const startDate = document.getElementById("startDateInput").value;
  const endDate = document.getElementById("endDateInput").value;

  if (!startDate || !endDate) {
    showToast("Please select both start and end dates.", "error");
    return;
  }

  if (startDate > endDate) {
    showToast("Start date cannot be after end date.", "error");
    return;
  }

  // Update the dropdown button text to show the active custom range
  const btnSpan = document.querySelector(".filter-dropdown .selected-filter");
  if (btnSpan) btnSpan.textContent = `${startDate} to ${endDate}`;

  dateModal.style.display = "none";

  unLockBodyScroll();

  // Call your stats function with custom date parameters
  await loadEnrollmentStats("custom", startDate, endDate);
});
// Handle dropdown filter menu clicks
document.querySelectorAll(".filter-menu a").forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    const filterText = e.target.textContent;
    const filterType = e.target.getAttribute("data-filter");

    // Update button text
    const btnSpan = e.target
      .closest(".filter-dropdown")
      .querySelector(".selected-filter");
    if (btnSpan) btnSpan.textContent = filterText;

    // Reload stats with the selected range
    loadEnrollmentStats(filterType);
  });
});
