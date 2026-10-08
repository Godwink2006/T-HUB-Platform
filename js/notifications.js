document.addEventListener("DOMContentLoaded", async () => {
  const notificationList = document.getElementById("fullNotificationList");
  const markAllReadBtn = document.getElementById("markAllReadBtn");
  const tabs = document.querySelectorAll(".notif-tab");

  let currentFilter = "all";
  let notificationsData = [];


  const {
    data: { session },
    error: sessionError,
  } = await window.supabaseClient.auth.getSession();
  if (sessionError || !session) {
    window.location.href = "login.html";
    return;
  }
  const userId = session.user.id;


  async function fetchNotifications() {
    try {
      const { data, error } = await window.supabaseClient
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      notificationsData = data || [];
      renderNotifications();
    } catch (err) {
      console.error("Error fetching notifications:", err);
      notificationList.innerHTML = `<div style="padding: 24px; text-align: center; color: #ef4444;">Failed to load notifications.</div>`;
    }
  }


  function renderNotifications() {
    let filtered = notificationsData;

    if (currentFilter === "unread") {
      filtered = notificationsData.filter((n) => !n.is_read);
    } else if (currentFilter === "read") {
      filtered = notificationsData.filter((n) => n.is_read);
    }

    if (filtered.length === 0) {
      notificationList.innerHTML = `<div style="padding: 32px; text-align: center; color: #6b7280; font-size: 14px;">No notifications found.</div>`;
      return;
    }

    notificationList.innerHTML = filtered
      .map(
        (item) => `
            <div data-id="${escapeHTML(item.id)}" class="notif-item" style="padding: 16px 20px; border-bottom: 1px solid #f3f4f6; background: ${item.is_read ? "white" : "#f8fafc"}; display: flex; justify-content: space-between; align-items: flex-start; transition: background 0.2s; cursor: pointer;">
                <div style="display: flex; gap: 12px; align-items: flex-start;">
                    <div style="margin-top: 4px; flex-shrink: 0; width: 12px; height: 12px; border-radius: 50%; background: ${item.is_read ? "transparent" : "#2563eb"};"></div>
                    <div>
                        <h4 style="margin: 0 0 4px 0; font-size: 14px; font-weight: ${item.is_read ? "500" : "600"}; color: #111827;">${escapeHTML(item.title || "")}</h4>
                        <p style="margin: 0 0 6px 0; font-size: 13px; color: #4b5563; line-height: 1.4;">${escapeHTML(item.message || "")}</p>
                        <span style="font-size: 11px; color: #9ca3af;">${new Date(item.created_at).toLocaleString()}</span>
                    </div>
                </div>
                ${!item.is_read ? `<button class="mark-read-single" data-id="${escapeHTML(item.id)}" style="background: none; border: none; color: #2563eb; font-size: 12px; cursor: pointer; font-weight: 500; white-space: nowrap;">Mark as read</button>` : ""}
            </div>
        `,
      )
      .join("");


    document.querySelectorAll(".mark-read-single").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const id = btn.getAttribute("data-id");
        await markAsRead(id);
      });
    });
  }


  async function markAsRead(id) {
    try {
      const { error } = await window.supabaseClient
        .from("notifications")
        .update({ is_read: true })
        .eq("id", id);

      if (error) throw error;


      notificationsData = notificationsData.map((n) =>
        n.id === id ? { ...n, is_read: true } : n,
      );
      renderNotifications();
    } catch (err) {
      console.error("Error updating notification:", err);
    }
  }


  markAllReadBtn.addEventListener("click", async () => {
    try {
      const unreadIds = notificationsData
        .filter((n) => !n.is_read)
        .map((n) => n.id);
      if (unreadIds.length === 0) return;

      const { error } = await window.supabaseClient
        .from("notifications")
        .update({ is_read: true })
        .in("id", unreadIds);

      if (error) throw error;

      notificationsData = notificationsData.map((n) => ({
        ...n,
        is_read: true,
      }));
      renderNotifications();
    } catch (err) {
      console.error("Error marking all as read:", err);
    }
  });


  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => {
        t.classList.remove("active");
        t.style.background = "#f3f4f6";
        t.style.color = "#4b5563";
        t.style.fontWeight = "500";
      });

      tab.classList.add("active");
      tab.style.background = "#eff6ff";
      tab.style.color = "#2563eb";
      tab.style.fontWeight = "600";

      currentFilter = tab.getAttribute("data-filter");
      renderNotifications();
    });
  });


  fetchNotifications();
});
