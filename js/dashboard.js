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

      const { error: insertError } = await window.supabaseClient
        .from("announcements")
        .insert([
          {
            school_id: profile.school_id,
            title: title,
            message: message,
            status: status,
            target_audience: target_audience,
            expiry_date: expiry_date,
            created_by: user.id,
          },
        ]);

      if (insertError) throw insertError;

      if (typeof showToast === "function") {
        showToast("Announcement published successfully!", "success");
      }

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

    if (welcomeText) {
      welcomeText.textContent = `Welcome back, ${profile.full_name || "User"}`;
    }
    // Show "New Announcement" button only if the user is an admin
    if (openAnnouncementBtn) {
      if (profile.role === "admin") {
        openAnnouncementBtn.style.display = "flex"; // Replaces the CSS default only for admins
      }
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
        <div class="announcement-item" style="padding: 20px; text-align: center; color: #64748b;">
          <h4 style="margin: 0 0 4px 0; color: #334155;">No announcements yet</h4>
          <p style="margin: 0; font-size: 0.9rem;">Published announcements will appear here.</p>
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
        <div style=" padding: 16px; margin-bottom: 12px; background: #fff;  border: 2px solid rgb(219, 215, 215);">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
            <h4 style="margin: 0; font-size: 1.05rem; color: #0f172a; font-weight: 600;">${escapeHtml(ann.title)}</h4>
            <span style="font-size: 0.75rem; padding: 3px 10px; background: ${statusBg}; color: ${statusColor}; font-weight: 600; text-transform: uppercase; letter-spacing: 0.025em;">${escapeHtml(ann.status)}</span>
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
