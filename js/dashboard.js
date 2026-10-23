const filterBtn = document.querySelector(".filter-btn");
const filterMenu = document.querySelector(".filter-menu");
const customDate = document.querySelector(".custom-date");

let dashboardAnnouncementSchoolId = null;
let dashboardCanDeleteAnnouncements = false;
let resolveAnnouncementDeleteConfirmation = null;
let announcementDeleteFocusReturn = null;
let dashboardAvailabilityCheck = null;

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

const newAnnouncementTrigger = document.querySelector(".new-announcement-btn");
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

    const target_audience = checkedAudiences.join(", ");

    saveAnnouncementBtn.disabled = true;
    saveAnnouncementBtn.textContent = "Publishing...";

    try {
      const {
        data: { user },
        error: authError,
      } = await window.supabaseClient.auth.getUser();
      if (authError) throw authError;
      if (!user) {
        const error = new Error("Sign in required");
        error.dashboardMessage = "Your sign-in session has ended. Sign in again to publish announcements.";
        throw error;
      }

      const { data: profile, error: profileError } = await window.supabaseClient
        .from("profiles")
        .select("school_id")
        .eq("id", user.id)
        .single();

      if (profileError || !profile) {
        throw profileError || new Error("Could not determine user school.");
      }

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
        showToast(
          err.dashboardMessage ||
            getDashboardErrorMessage(err, "publish this announcement"),
          "error",
        );
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

function finishDashboardAccessCheck() {
  document.body.classList.remove("dashboard-auth-checking");
  document.body.classList.remove("dashboard-auth-error-open");
  document.getElementById("dashboardAuthLoading")?.remove();
}

function getDashboardErrorMessage(error, action = "load this dashboard information") {
  const code = String(error?.code || "").toUpperCase();
  const status = Number(error?.status || error?.statusCode || 0);
  const diagnostic = `${error?.message || ""} ${error?.details || ""}`.toLowerCase();

  if (
    code === "42501" ||
    status === 401 ||
    status === 403 ||
    /row-level security|permission denied|not allowed|insufficient privilege/.test(
      diagnostic,
    )
  ) {
    return `Your account cannot ${action}. Check that your account is active and belongs to this school, or ask a school administrator for help.`;
  }
  if (
    /failed to fetch|network|fetch error|connection|timeout|timed out/.test(
      diagnostic,
    )
  ) {
    return `We couldn’t connect to the school database to ${action}. Check your internet connection and try again.`;
  }
  if (code === "PGRST116") {
    return "Your school account profile could not be found. Ask a school administrator to check your account.";
  }
  if (code === "22023") {
    return "That date range is not valid. Choose a valid range and try again.";
  }
  if (code === "23505") {
    return "A record with these details already exists. Refresh the page and try again.";
  }
  if (code === "23503") {
    return "This record is linked to other school information and could not be changed.";
  }
  if (code === "23514" || code === "22P02") {
    return "Some of the information is invalid. Review your entries and try again.";
  }
  if (code.startsWith("PGRST") || code.startsWith("42")) {
    return `The dashboard data needed to ${action} is temporarily unavailable. Refresh the page or contact support if the problem continues.`;
  }
  return `We couldn’t ${action}. Please try again. If the problem continues, ask a school administrator for help.`;
}

function dashboardErrorRequiresSignIn(error) {
  const diagnostic = `${error?.message || ""} ${error?.code || ""}`.toLowerCase();
  return Number(error?.status || error?.statusCode || 0) === 401 ||
    /session.*(expired|missing|invalid)|invalid jwt|refresh token.*(expired|invalid)|sign in required/.test(
      diagnostic,
    );
}

async function checkDashboardAvailability(user, profile) {
  if (!user?.id || !profile?.school_id) return null;

  const cacheKey = `${user.id}:${profile.school_id}`;
  if (dashboardAvailabilityCheck?.key === cacheKey) {
    return dashboardAvailabilityCheck.promise;
  }

  const promise = (async () => {
    const profileStatus = String(profile.status || "active").trim().toLowerCase();
    if (profileStatus !== "active") {
      return "Your account is inactive. Contact your school administrator to restore access.";
    }

    const { data: schoolIsActive, error: schoolError } =
      await window.supabaseClient.rpc("is_school_active", {
        target_school_id: profile.school_id,
      });
    if (schoolError) throw schoolError;
    if (schoolIsActive !== true) {
      return "This school is currently inactive, so its dashboard data is unavailable. Contact T-HUB support for help.";
    }

    if (String(profile.role || "").trim().toLowerCase() === "student") {
      const { data: enrollments, error: enrollmentError } =
        await window.supabaseClient
          .from("student_enrollments")
          .select("enrollment_status")
          .eq("student_id", user.id)
          .eq("school_id", profile.school_id);
      if (enrollmentError) throw enrollmentError;

      const hasEndedEnrollment = (enrollments || []).some((enrollment) =>
        ["graduated", "transferred", "transfered"].includes(
          String(enrollment.enrollment_status || "").trim().toLowerCase(),
        ),
      );
      if (hasEndedEnrollment) {
        return "Your enrollment at this school is marked as graduated or transferred, so this dashboard is no longer available. Contact the school if you think this is a mistake.";
      }
    }

    return null;
  })();

  dashboardAvailabilityCheck = { key: cacheKey, promise };
  try {
    return await promise;
  } catch (error) {
    if (dashboardAvailabilityCheck?.promise === promise) {
      dashboardAvailabilityCheck = null;
    }
    throw error;
  }
}

function renderDashboardRetryMessage(container, message, retryLabel, retry) {
  if (!container) return;

  const wrapper = document.createElement(
    ["UL", "OL"].includes(container.tagName) ? "li" : "div",
  );
  wrapper.className = "dashboard-inline-error";
  wrapper.setAttribute("role", "alert");

  const text = document.createElement("p");
  text.textContent = message;
  wrapper.append(text);

  if (retry) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "dashboard-error-retry";
    button.textContent = retryLabel || "Try again";
    button.addEventListener("click", retry, { once: true });
    wrapper.append(button);
  }

  container.replaceChildren(wrapper);
}

function setDashboardMetricError(countId, detailId, error, action) {
  const count = document.getElementById(countId);
  const detail = document.getElementById(detailId);
  if (!count || !detail) return;

  count.textContent = "—";
  detail.textContent = getDashboardErrorMessage(error, action);
  detail.classList.add("dashboard-metric-error");
}

function clearDashboardMetricError(detailId) {
  document.getElementById(detailId)?.classList.remove("dashboard-metric-error");
}

async function loadDashboardRecentActivities(schoolId) {
  const listContainer = document.getElementById("recentActivitiesList");
  if (!listContainer) return;

  try {
    const { data, error } = await window.supabaseClient
      .from("recent_activities")
      .select("message, dot_color, created_at")
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false })
      .limit(5);

    if (error) throw error;
    if (!listContainer.isConnected) return;

    if (!data?.length) {
      listContainer.innerHTML = `<li class="dashboard-activity-empty">No recent activities found.</li>`;
      return;
    }

    listContainer.innerHTML = data
      .map((activity) => {
        const color = /^(green|blue|red|yellow|orange)$/.test(activity.dot_color)
          ? activity.dot_color
          : "green";
        return `<li><i class="fas fa-bullhorn dashboard-icon ${color}" aria-hidden="true"></i>${escapeHtml(activity.message || "")}</li>`;
      })
      .join("");
  } catch (error) {
    console.error("Error loading dashboard activities:", error);
    renderDashboardRetryMessage(
      listContainer,
      getDashboardErrorMessage(error, "load recent activities"),
      "Retry",
      () => loadDashboardRecentActivities(schoolId),
    );
  }
}

function showDashboardAccessCheckError(message, actionLabel = "Continue to view other information") {
  const loadingScreen = document.getElementById("dashboardAuthLoading");
  if (!loadingScreen) return;

  settleDashboardWidgetsForAccessIssue();

  const content = document.createElement("div");
  content.className = "dashboard-auth-loading__content";
  const text = document.createElement("p");
  text.id = "dashboardAuthErrorMessage";
  text.setAttribute("role", "alert");
  text.textContent = message;
  const action = document.createElement("button");
  action.className = "dashboard-auth-loading__retry";
  action.type = "button";
  const requiresSignIn = actionLabel === "Sign in";
  action.textContent = requiresSignIn
    ? "Sign in"
    : "Continue to view other information";
  action.addEventListener(
    "click",
    () => {
      unLockBodyScroll();
      if (requiresSignIn) {
        window.location.replace("/index.html");
      } else {
        finishDashboardAccessCheck();
      }
    },
    { once: true },
  );
  content.append(text, action);
  loadingScreen.replaceChildren(content);
  loadingScreen.setAttribute("role", "dialog");
  loadingScreen.setAttribute("aria-modal", "true");
  loadingScreen.setAttribute("aria-labelledby", text.id);
  document.body.classList.remove("dashboard-auth-checking");
  document.body.classList.add("dashboard-auth-error-open");
  lockBodyScroll();
  action.focus();
}

function settleDashboardWidgetsForAccessIssue() {
  for (const [countId, detailId] of [
    ["totalStudentsCount", "studentSubtext"],
    ["totalTeachersCount", "teacherSubtext"],
    ["totalClassesCount", "classSubtext"],
    ["attendanceCount", "attendanceSubtext"],
  ]) {
    const count = document.getElementById(countId);
    const detail = document.getElementById(detailId);
    if (count) count.textContent = "—";
    if (detail) {
      detail.textContent = "Unavailable for this account.";
      detail.classList.add("dashboard-metric-error");
    }
  }

  const activities = document.getElementById("recentActivitiesList");
  if (activities) {
    const item = document.createElement("li");
    item.className = "dashboard-activity-empty";
    item.textContent = "Recent activities are unavailable for this account.";
    activities.replaceChildren(item);
  }

  const announcements = document.getElementById("announcementPreviewContainer");
  if (announcements) {
    const message = document.createElement("p");
    message.className = "dashboard-activity-empty";
    message.textContent = "Announcements are unavailable for this account.";
    announcements.replaceChildren(message);
  }

  const enrollmentError = document.getElementById("enrollmentStatsError");
  if (enrollmentError) {
    enrollmentError.textContent = "Enrollment statistics are unavailable for this account.";
    enrollmentError.hidden = false;
  }
  for (const id of [
    "totalEnrollmentCount",
    "activeEnrollmentCount",
    "genderBreakdownCount",
  ]) {
    const metric = document.getElementById(id);
    if (metric) metric.textContent = "—";
  }
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

     <div style="padding: 24px; text-align: center; color: #64748b; background: #fff;  border: 1px solid rgb(219, 215, 215);">
        <i class="fa-solid fa-spinner fa-spin" style="margin-right: 0.5rem;"></i>
        Loading announcements...
      </div>
  `;

  let accessVerified = false;
  try {

    const {
      data: { user },
      error: authError,
    } = await window.supabaseClient.auth.getUser();
    if (authError) {
      authError.requiresSignIn = dashboardErrorRequiresSignIn(authError);
      throw authError;
    }
    if (!user) {
      const error = new Error("Sign in required");
      error.dashboardMessage = "Your sign-in session has ended. Sign in again to view the dashboard.";
      error.requiresSignIn = true;
      throw error;
    }

    const { data: profile, error: profileError } = await window.supabaseClient
      .from("profiles")
      .select("school_id, full_name, role, status")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      const error = profileError || new Error("Profile is missing");
      error.dashboardMessage = getDashboardErrorMessage(
        error,
        "verify your school account",
      );
      throw error;
    }

    if (profile.role === "parent") {
      window.location.replace("/html/parent-dashboard.html");
      return;
    }

    if (!profile.role) {
      const error = new Error("Role is missing from profile");
      error.dashboardMessage = "Your school account is missing a role. Ask a school administrator to check your account.";
      throw error;
    }

    const availabilityIssue = await checkDashboardAvailability(user, profile);
    if (availabilityIssue) {
      showDashboardAccessCheckError(availabilityIssue);
      return;
    }

    accessVerified = true;
    finishDashboardAccessCheck();

    dashboardAnnouncementSchoolId = profile.school_id;
    dashboardCanDeleteAnnouncements = profile.role === "admin";

    if (welcomeText) {
      welcomeText.textContent = `Welcome back, ${profile.full_name || "User"}`;
    }

    if (profile.role === "admin") {
      if (openAnnouncementBtn) openAnnouncementBtn.style.display = "flex";
      if (openClassBtn) openClassBtn.style.display = "block";
      if (openStudentBtn) openStudentBtn.style.display = "block";
      if (openTeacherBtn) openTeacherBtn.style.display = "block";
    }

    const allowedStaffRoles = ["admin", "teacher", "accountant", "librarian"];

    if (allowedStaffRoles.includes(profile.role)) {
      if (openEnrollmentBtn) openEnrollmentBtn.style.display = "block";
    }

    const allowedAttendanceRoles = ["admin", "teacher", "student"];

    if (allowedAttendanceRoles.includes(profile.role)) {
      if (openAttendanceBtn) openAttendanceBtn.style.display = "block";
    }

    const today = new Date().toISOString().split("T")[0];

    const { data: announcements, error: fetchError } =
      await window.supabaseClient
        .from("announcements")
        .select("*")
        .eq("school_id", profile.school_id)
        .or(`expiry_date.is.null,expiry_date.gte.${today}`)
        .order("created_at", { ascending: false });

    if (fetchError) {
      fetchError.dashboardMessage = getDashboardErrorMessage(
        fetchError,
        "view announcements for this school",
      );
      throw fetchError;
    }

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
        <div class="announcement-item" style="display: flex; flex-direction: column; gap: 12px; padding: 16px; margin-bottom: 12px; background: #fff; border: 0.5px solid rgb(219, 215, 215);">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;">
            <h4 style="margin: 0; font-size: 1.05rem; color: #0f172a; font-weight: 600;">${escapeHtml(ann.title)}</h4>
            <span class="announcement-status" style="font-size: 0.75rem; padding: 3px 10px; background: ${statusBg}; color: ${statusColor}; font-weight: 600; text-transform: uppercase; letter-spacing: 0.025em;">${escapeHtml(ann.status)}</span>
          </div>
          <p style="margin: 0; font-size: 0.95rem; color: #334155; line-height: 1.7; white-space: pre-wrap;">${escapeHtml(ann.message)}</p>
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; padding-top: 12px; font-size: 0.8rem; color: #64748b; border-top: 0.5px solid rgb(219, 215, 215);">
            <span><i class="fa-solid fa-users" style="margin-right: 4px;"></i> Target: ${escapeHtml(ann.target_audience)}</span>
            <span><i class="fa-regular fa-calendar" style="margin-right: 4px;"></i> ${ann.expiry_date || "No expiry date"}</span>
            ${dashboardCanDeleteAnnouncements ? `<button type="button" class="announcement-delete-btn" data-announcement-id="${escapeHtml(ann.id)}" aria-label="Delete announcement: ${escapeHtml(ann.title)}"><i class="fa-solid fa-trash" aria-hidden="true"></i> Delete</button>` : ""}
          </div>
        </div>
      `;
      })
      .join("");
  } catch (err) {
    console.error("Error loading announcements:", err);
    const message = err.dashboardMessage || getDashboardErrorMessage(
      err,
      "load announcements",
    );
    if (!accessVerified) {
      showDashboardAccessCheckError(
        message,
        err.requiresSignIn ? "Sign in" : "Try again",
      );
    } else {
      renderDashboardRetryMessage(
        previewContainer,
        message,
        "Retry",
        loadDashboardAnnouncements,
      );
    }
  }
}

function closeAnnouncementDeleteConfirmation(confirmed) {
  const dialog = document.getElementById("announcementDeleteConfirm");
  if (!dialog || !resolveAnnouncementDeleteConfirmation) return;

  dialog.hidden = true;
  document.documentElement.classList.remove("announcement-delete-open");
  unLockBodyScroll();

  const resolve = resolveAnnouncementDeleteConfirmation;
  resolveAnnouncementDeleteConfirmation = null;
  resolve(confirmed);

  if (!confirmed && announcementDeleteFocusReturn?.isConnected) {
    announcementDeleteFocusReturn.focus();
  }
  announcementDeleteFocusReturn = null;
}

function requestAnnouncementDeleteConfirmation(title) {
  const dialog = document.getElementById("announcementDeleteConfirm");
  const message = document.getElementById("announcementDeleteMessage");
  const cancelButton = document.getElementById("cancelAnnouncementDelete");
  if (!dialog || !message || !cancelButton) return Promise.resolve(false);

  message.textContent = title
    ? `Delete “${title}”? This action cannot be undone.`
    : "This action cannot be undone.";
  announcementDeleteFocusReturn = document.activeElement;
  dialog.hidden = false;
  document.documentElement.classList.add("announcement-delete-open");
  lockBodyScroll();
  cancelButton.focus();

  return new Promise((resolve) => {
    resolveAnnouncementDeleteConfirmation = resolve;
  });
}

document.getElementById("cancelAnnouncementDelete")?.addEventListener("click", () => {
  closeAnnouncementDeleteConfirmation(false);
});

document.getElementById("confirmAnnouncementDelete")?.addEventListener("click", () => {
  closeAnnouncementDeleteConfirmation(true);
});

document.getElementById("announcementDeleteConfirm")?.addEventListener("click", (event) => {
  if (event.target === event.currentTarget) closeAnnouncementDeleteConfirmation(false);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && resolveAnnouncementDeleteConfirmation) {
    closeAnnouncementDeleteConfirmation(false);
  }
});

document.querySelector(".announcement-preview")?.addEventListener("click", async (event) => {
  const deleteButton = event.target.closest(".announcement-delete-btn");
  if (!deleteButton || !dashboardCanDeleteAnnouncements || !dashboardAnnouncementSchoolId) return;

  const announcementId = deleteButton.dataset.announcementId;
  if (!announcementId) return;

  const confirmed = await requestAnnouncementDeleteConfirmation(
    deleteButton.closest(".announcement-item")?.querySelector("h4")?.textContent.trim(),
  );
  if (!confirmed) return;

  deleteButton.disabled = true;
  deleteButton.textContent = "Deleting...";

  try {
    const { data, error } = await window.supabaseClient
      .from("announcements")
      .delete()
      .eq("id", announcementId)
      .eq("school_id", dashboardAnnouncementSchoolId)
      .select("id")
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      const notDeletedError = new Error("No announcement was deleted");
      notDeletedError.dashboardMessage = "This announcement may already be deleted, or your access may have changed. Refresh the dashboard and try again.";
      throw notDeletedError;
    }

    if (typeof showToast === "function") showToast("Announcement deleted.", "success");
    await loadDashboardAnnouncements();
  } catch (err) {
    console.error("Error deleting announcement:", err);
    if (typeof showToast === "function") {
      showToast(
        err.dashboardMessage ||
          getDashboardErrorMessage(err, "delete this announcement"),
        "error",
      );
    }
    deleteButton.disabled = false;
    deleteButton.innerHTML = '<i class="fa-solid fa-trash" aria-hidden="true"></i> Delete';
  }
});

document.addEventListener("DOMContentLoaded", () => {
  loadDashboardAnnouncements();
});

document.addEventListener("DOMContentLoaded", async () => {
  const avatarImg = document.getElementById("profileAvatar");
  if (!avatarImg) return;
  avatarImg.src = window.DEFAULT_PROFILE_AVATAR || avatarImg.src;

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
    const dashboardMarker = document.getElementById("totalStudentsCount");
    if (!dashboardMarker) return;

    const { data: studentsData, error: studentError } =
      await window.supabaseClient
        .from("profiles")
        .select("status")
        .eq("school_id", schoolId)
        .eq("role", "student");
    if (!dashboardMarker.isConnected) return;

    if (studentError) {
      setDashboardMetricError(
        "totalStudentsCount",
        "studentSubtext",
        studentError,
        "load student totals",
      );
    } else if (studentsData) {
      clearDashboardMetricError("studentSubtext");
      const totalStudents = studentsData.length;
      const activeStudents = studentsData.filter(
        (s) => (s.status || "").toLowerCase() === "active",
      ).length;

      document.getElementById("totalStudentsCount").textContent = totalStudents;
      document.getElementById("studentSubtext").textContent =
        `${activeStudents} Active / ${totalStudents} Total`;
    }

    const { data: teachersData, error: teacherError } =
      await window.supabaseClient
        .from("profiles")
        .select("status")
        .eq("school_id", schoolId)
        .eq("role", "teacher");
    if (!dashboardMarker.isConnected) return;

    if (teacherError) {
      setDashboardMetricError(
        "totalTeachersCount",
        "teacherSubtext",
        teacherError,
        "load teacher totals",
      );
    } else if (teachersData) {
      clearDashboardMetricError("teacherSubtext");
      const totalTeachers = teachersData.length;
      const activeTeachers = teachersData.filter(
        (t) => (t.status || "").toLowerCase() === "active",
      ).length;

      document.getElementById("totalTeachersCount").textContent = totalTeachers;
      document.getElementById("teacherSubtext").textContent =
        `${activeTeachers} Active / ${totalTeachers} Total`;
    }

    const { data: classesData, error: classError } = await window.supabaseClient
      .from("classes")
      .select("status")
      .eq("school_id", schoolId);
    if (!dashboardMarker.isConnected) return;

    if (classError) {
      setDashboardMetricError(
        "totalClassesCount",
        "classSubtext",
        classError,
        "load class totals",
      );
    } else if (classesData) {
      clearDashboardMetricError("classSubtext");
      const totalClasses = classesData.length;
      const activeClasses = classesData.filter(
        (c) => (c.status || "").toLowerCase() === "active",
      ).length;

      document.getElementById("totalClassesCount").textContent = totalClasses;
      document.getElementById("classSubtext").textContent =
        `${activeClasses} Active / ${totalClasses} Total`;
    }

    const today = new Date().toISOString().split("T")[0];

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
    if (!dashboardMarker.isConnected) return;

    if (attError) {
      setDashboardMetricError(
        "attendanceCount",
        "attendanceSubtext",
        attError,
        "load today’s attendance summary",
      );
      return;
    }

    clearDashboardMetricError("attendanceSubtext");
    if (attendanceData && attendanceData.length > 0) {

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

        let statusLabel = "Normal";
        let statusColor = "#475569";

        if (percentage >= 90) {
          statusLabel = "Excellent";
          statusColor = "#16a34a";
        } else if (percentage >= 75) {
          statusLabel = "Normal";
          statusColor = "#2563eb";
        } else if (percentage >= 50) {
          statusLabel = "Needs Attention";
          statusColor = "#d97706";
        } else {
          statusLabel = "Bad";
          statusColor = "#dc2626";
        }

        const subtextEl = document.getElementById("attendanceSubtext");
        subtextEl.textContent = statusLabel;
        subtextEl.style.color = statusColor;
        subtextEl.style.fontWeight = "600";
      } else {

        document.getElementById("attendanceCount").textContent = "0%";
        const subtextEl = document.getElementById("attendanceSubtext");
        subtextEl.textContent = "No submitted records";
        subtextEl.style.color = "#64748b";
        subtextEl.style.fontWeight = "normal";
      }
    } else {

      document.getElementById("attendanceCount").textContent = "0%";
      const subtextEl = document.getElementById("attendanceSubtext");
      subtextEl.textContent = "No records today";
      subtextEl.style.color = "#64748b";
      subtextEl.style.fontWeight = "normal";
    }
  } catch (err) {
    console.error("Error loading dashboard stats:", err);
    for (const [countId, detailId, action] of [
      ["totalStudentsCount", "studentSubtext", "load student totals"],
      ["totalTeachersCount", "teacherSubtext", "load teacher totals"],
      ["totalClassesCount", "classSubtext", "load class totals"],
      ["attendanceCount", "attendanceSubtext", "load today’s attendance summary"],
    ]) {
      setDashboardMetricError(countId, detailId, err, action);
    }
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  try {

    const {
      data: { user },
      error: authError,
    } = await window.supabaseClient.auth.getUser();
    if (authError || !user) {
      const message = authError
        ? getDashboardErrorMessage(authError, "verify your sign-in")
        : "Your sign-in session has ended. Sign in again to view the dashboard.";
      showDashboardAccessCheckError(
        message,
        !user || dashboardErrorRequiresSignIn(authError) ? "Sign in" : "Try again",
      );
      return;
    }

    const { data: profile, error: profileError } = await window.supabaseClient
      .from("profiles")
      .select("school_id, role, status")
      .eq("id", user.id)
      .single();

    if (profileError || !profile || !profile.school_id) {
      console.error("Could not determine user school ID:", profileError);
      showDashboardAccessCheckError(
        profileError
          ? getDashboardErrorMessage(profileError, "verify your school account")
          : "Your account is not linked to a school. Ask a school administrator to check your profile.",
        "Try again",
      );
      return;
    }

    const availabilityIssue = await checkDashboardAvailability(user, profile);
    if (availabilityIssue) {
      showDashboardAccessCheckError(availabilityIssue);
      return;
    }

    const schoolId = profile.school_id;
    window.currentSchoolId = schoolId;

    await loadDashboardRecentActivities(schoolId);
    subscribeToRecentActivities(schoolId, profile.role);

    loadDashboardStats(schoolId);
    const enrollmentCard = document.getElementById("enrollment-dashboard-card");
    const canViewEnrollmentStats = ["admin", "teacher", "accountant", "librarian"]
      .includes(profile.role);
    if (enrollmentCard) enrollmentCard.hidden = !canViewEnrollmentStats;
    if (canViewEnrollmentStats) loadEnrollmentStats("year");
    updateNotificationBadge(user.id);
  } catch (err) {
    console.error("Error loading dashboard data:", err);
    showDashboardAccessCheckError(
      getDashboardErrorMessage(err, "load your dashboard"),
      "Try again",
    );
  }
});

async function updateNotificationBadge(userId) {
  try {

    const { error, count } = await window.supabaseClient
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_read", false);

    const badge = document.getElementById("sidebarNotificationBadge");
    if (!badge) return;

    if (error) {
      console.error("Error fetching dashboard notifications:", error);
      badge.textContent = "";
      badge.style.display = "none";
      const notificationLink = document.getElementById("navNotifications");
      if (notificationLink) {
        notificationLink.title = getDashboardErrorMessage(
          error,
          "load the notification count",
        );
      }
      return;
    }

    const unreadCount = count ?? 0;

    if (unreadCount > 0) {
      badge.textContent = unreadCount;
      badge.style.display = "inline-block";
      const notificationLink = document.getElementById("navNotifications");
      if (notificationLink) notificationLink.removeAttribute("title");
    } else {
      badge.style.display = "none";
      const notificationLink = document.getElementById("navNotifications");
      if (notificationLink) notificationLink.removeAttribute("title");
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
    const totalElement = document.getElementById("totalEnrollmentCount");
    const activeElement = document.getElementById("activeEnrollmentCount");
    const genderElement = document.getElementById("genderBreakdownCount");
    const errorElement = document.getElementById("enrollmentStatsError");
    if (!totalElement || !activeElement || !genderElement) return;

    const activeSchoolId = window.currentSchoolId;

    if (!activeSchoolId) {
      console.warn("Active school ID not found yet.");
      return;
    }

    const {
      data: { user },
      error: authError,
    } = await window.supabaseClient.auth.getUser();
    if (authError) throw authError;
    if (!user) {
      const error = new Error("Sign in required");
      error.code = "42501";
      throw error;
    }

    const { data: profile, error: profileError } = await window.supabaseClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      throw profileError || new Error("Could not verify the signed-in user's role.");
    }

    const userRole = profile.role;

    const formattedStart = customStart ? `${customStart}T00:00:00` : null;
    const formattedEnd = customEnd ? `${customEnd}T23:59:59` : null;

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

    // The request may finish after SPA navigation has removed the dashboard.
    if (
      !totalElement.isConnected ||
      !activeElement.isConnected ||
      !genderElement.isConnected
    ) {
      return;
    }

    totalElement.textContent = (stats.total || 0).toLocaleString();
    activeElement.textContent = (stats.active || 0).toLocaleString();
    genderElement.textContent = `${stats.boys || 0} / ${stats.girls || 0}`;
    if (errorElement) {
      errorElement.hidden = true;
      errorElement.textContent = "";
    }
  } catch (err) {
    console.error("Error loading enrollment stats:", err);
    const totalElement = document.getElementById("totalEnrollmentCount");
    const activeElement = document.getElementById("activeEnrollmentCount");
    const genderElement = document.getElementById("genderBreakdownCount");
    const errorElement = document.getElementById("enrollmentStatsError");
    if (!totalElement?.isConnected) return;
    totalElement.textContent = "—";
    if (activeElement) activeElement.textContent = "—";
    if (genderElement) genderElement.textContent = "— / —";
    if (errorElement) {
      errorElement.textContent = getDashboardErrorMessage(
        err,
        "load enrollment statistics",
      );
      errorElement.hidden = false;
    }
  }
}

const dateModal = document.getElementById("dateRangeModal");
const closeDateModalBtn = document.getElementById("closeDateModal");
const cancelDateModalBtn = document.getElementById("cancelDateModal");
const applyDateBtn = document.getElementById("applyDateBtn");

document
  .querySelector(".filter-menu a.custom-date")
  .addEventListener("click", (e) => {
    e.preventDefault();
    dateModal.style.display = "flex";
  });

closeDateModalBtn.addEventListener("click", closeDateModal);
cancelDateModalBtn.addEventListener("click", closeDateModal);

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

  const btnSpan = document.querySelector(".filter-dropdown .selected-filter");
  if (btnSpan) btnSpan.textContent = `${startDate} to ${endDate}`;

  dateModal.style.display = "none";

  unLockBodyScroll();

  await loadEnrollmentStats("custom", startDate, endDate);
});

document.querySelectorAll(".filter-menu a").forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    const filterText = e.target.textContent;
    const filterType = e.target.getAttribute("data-filter");

    // The custom option opens the date-range modal; it must not query without dates.
    if (filterType === "custom") return;

    const btnSpan = e.target
      .closest(".filter-dropdown")
      .querySelector(".selected-filter");
    if (btnSpan) btnSpan.textContent = filterText;

    loadEnrollmentStats(filterType);
  });
});
