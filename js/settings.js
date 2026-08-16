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
    document.querySelectorAll(".menu a").forEach(link => {
        link.addEventListener("click", closeMenu);
    });
});