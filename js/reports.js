/**
 * reports.js
 * Controls the main Reports Hub dashboard.
 */

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const authCtx = await ReportsCommon.initAuth();
    if (!authCtx) return;

    // Set school name in sidebar if available
    const schoolNameEl = document.querySelector(".sidebar-school-name");
    if (schoolNameEl && authCtx.school?.name) {
      schoolNameEl.textContent = authCtx.school.name;
      schoolNameEl.removeAttribute("hidden");
    }

    // Role-based card visibility if needed
    const role = (authCtx.profile?.role || "").toLowerCase();
    const isLibrarian = role === "librarian";

    // If librarian, highlight library reports
    if (isLibrarian) {
      const allCards = document.querySelectorAll(".report-card");
      allCards.forEach((card) => {
        const title = card.querySelector("h4")?.textContent.toLowerCase() || "";
        if (!title.includes("library")) {
          card.style.opacity = "0.6";
        }
      });
    }

    // Enhance card icons
    const reportIcons = {
      "Teacher Reports": "fa-chalkboard-user",
      "Student Reports": "fa-user-graduate",
      "Library Reports": "fa-book-open",
      "Class Reports": "fa-landmark",
      "Subject Reports": "fa-book-bookmark",
      "Timetable Reports": "fa-calendar-days",
      "Attendance Reports": "fa-calendar-check",
      "Financial Reports": "fa-money-bill-trend-up",
      "Grade Reports": "fa-chart-column",
    };

    document.querySelectorAll(".report-card").forEach((card) => {
      const heading = card.querySelector("h4");
      if (!heading) return;
      const title = heading.textContent.trim();
      const iconClass = reportIcons[title];
      if (iconClass && !heading.querySelector("i")) {
        const icon = document.createElement("i");
        icon.className = `fa-solid ${iconClass}`;
        icon.style.marginRight = "10px";
        icon.style.color = "#2563eb";
        heading.prepend(icon);
      }
    });
  } catch (err) {
    console.error("Reports page initialization error:", err);
  }
});
