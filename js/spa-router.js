/**
 * spa-router.js — Client-side SPA router for T-HUB Platform
 *
 * How it works:
 *  1. Intercepts clicks on sidebar <a> links and topbar nav links
 *  2. fetch()es the target .html page, parses it
 *  3. Extracts <main> content + page-specific <link> CSS + page <script> src
 *  4. Injects CSS (once), swaps <main>, injects page <script> (re-executes)
 *  5. Updates history.pushState + active link styling
 *  6. Prefetches on hover (HTML + pre-warms page data via QueryCache)
 *
 * Falls back gracefully:
 *  - External links, #hash-only links, and links with data-spa="false" are skipped
 *  - If the fetch fails the browser performs a normal navigation
 *  - Direct URL access still works (the script just doesn't intercept initial load)
 */

(function () {
  "use strict";

  // ─── Config ────────────────────────────────────────────────────────────────

  /** Pages that live outside /html/ — skip SPA for these */
  const SPA_SKIP_PATTERNS = [
    /\/index\.html$/i,
    /\/parent-set-password\.html$/i,
  ];

  /** Max age (ms) for cached HTML fragments */
  const HTML_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /** CSS/JS hosts we treat as "same-app" (not CDN) */
  const INTERNAL_HOST = window.location.origin;

  // ─── State ─────────────────────────────────────────────────────────────────

  /** Loaded CSS hrefs (absolute URLs) → true */
  const _loadedCSS = new Set();

  /** Loaded JS srcs (absolute URLs) → true */
  const _loadedJS = new Set();

  /** HTML fragment cache: url → { html: string, ts: number } */
  const _htmlCache = new Map();

  /** Currently navigating flag — prevents double-clicks */
  let _navigating = false;

  // Track the current page JS src so we know what to replace
  let _currentPageJS = null;

  // ─── Helpers ───────────────────────────────────────────────────────────────

  function resolveURL(href) {
    try {
      return new URL(href, window.location.href).href;
    } catch {
      return null;
    }
  }

  function isSameOrigin(url) {
    try {
      return new URL(url).origin === window.location.origin;
    } catch {
      return false;
    }
  }

  function shouldSkip(url) {
    if (!url) return true;
    if (!isSameOrigin(url)) return true;
    const path = new URL(url).pathname;
    if (SPA_SKIP_PATTERNS.some((rx) => rx.test(path))) return true;
    // Skip pure hash changes on same page
    if (
      url.split("#")[0] === window.location.href.split("#")[0] &&
      url.includes("#")
    )
      return true;
    return false;
  }

  /** Returns the page filename from a URL, e.g. "students.html" */
  function pageNameOf(url) {
    return new URL(url).pathname.split("/").pop() || "dashboard.html";
  }

  /** Returns the JS src for a page by reading the loaded page's <script> tags */
  function extractPageJS(doc) {
    const scripts = Array.from(doc.querySelectorAll("script[src]"));
    // Page-specific JS is anything under /js/ that is NOT supabase/utils/app-icons/query-cache/spa-router
    const SHARED = [
      "supabase.js",
      "utils.js",
      "app-icons.js",
      "query-cache.js",
      "spa-router.js",
    ];
    const pageScript = scripts.find((s) => {
      const src = s.getAttribute("src") || "";
      return (
        src.startsWith("/js/") && !SHARED.some((sh) => src.endsWith(sh))
      );
    });
    return pageScript ? pageScript.getAttribute("src") : null;
  }

  /** Extract all page-specific CSS <link> hrefs (not shared ones) */
  function extractPageCSS(doc) {
    const SHARED_CSS = ["utils.css", "app-visuals.css"];
    return Array.from(doc.querySelectorAll("link[rel='stylesheet'][href]"))
      .map((l) => l.getAttribute("href"))
      .filter(
        (h) =>
          h &&
          h.startsWith("/css/") &&
          !SHARED_CSS.some((s) => h.endsWith(s)),
      );
  }

  /** Fetch + parse an HTML page, return Document */
  async function fetchPage(url) {
    const cached = _htmlCache.get(url);
    if (cached && Date.now() - cached.ts < HTML_CACHE_TTL) {
      const parser = new DOMParser();
      return parser.parseFromString(cached.html, "text/html");
    }

    const res = await fetch(url, { credentials: "same-origin" });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const html = await res.text();
    _htmlCache.set(url, { html, ts: Date.now() });
    const parser = new DOMParser();
    return parser.parseFromString(html, "text/html");
  }

  /** Inject a CSS link if not already loaded */
  function ensureCSS(href) {
    const abs = resolveURL(href);
    if (!abs || _loadedCSS.has(abs)) return;
    _loadedCSS.add(abs);
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }

  /**
   * Dynamically load and execute a page JS file.
   * Creates a new <script> tag every time (to re-execute).
   */
  function loadPageScript(src) {
    return new Promise((resolve) => {
      if (!src) return resolve();
      // Remove any previous page-specific script tag to avoid duplicates
      const abs = resolveURL(src);
      const prev = document.querySelector(
        `script[src="${src}"], script[data-spa-page]`,
      );
      if (prev) prev.remove();

      const s = document.createElement("script");
      s.src = src + "?_spa=" + Date.now(); // bust browser cache for re-execution
      s.setAttribute("data-spa-page", "true");
      s.onload = resolve;
      s.onerror = resolve; // don't block on error
      document.body.appendChild(s);
    });
  }

  // ─── Core navigate ─────────────────────────────────────────────────────────

  async function navigate(url, pushState = true) {
    if (_navigating) return;
    if (shouldSkip(url)) {
      window.location.href = url;
      return;
    }

    _navigating = true;

    // Show loading indicator
    showSPALoader();

    try {
      // 1. Fetch & parse the target page
      const targetDoc = await fetchPage(url);

      // 2. Extract <main> content
      const newMain = targetDoc.querySelector("main");
      if (!newMain) {
        // No <main> found — fall back to full navigation
        window.location.href = url;
        return;
      }

      // 3. Inject page CSS (idempotent)
      const cssLinks = extractPageCSS(targetDoc);
      cssLinks.forEach(ensureCSS);

      // 4. Get page JS src
      const pageJSSrc = extractPageJS(targetDoc);

      // 5. Swap <main> with transition
      const currentMain = document.querySelector("main");
      if (currentMain) {
        currentMain.classList.add("spa-fade-out");
        await delay(150);
        currentMain.replaceWith(newMain);
      } else {
        document.body.appendChild(newMain);
      }

      // 6. Update <title>
      const newTitle = targetDoc.querySelector("title");
      if (newTitle) document.title = newTitle.textContent;

      // 7. Update active sidebar link
      updateActiveLink(url);

      // 8. Push history
      if (pushState) {
        history.pushState({ url }, document.title, url);
      }

      // 9. Scroll to top
      window.scrollTo(0, 0);

      // 10. Close mobile sidebar if open
      closeMobileSidebar();

      // 11. Fade in new content
      newMain.classList.add("spa-fade-in");
      requestAnimationFrame(() => {
        newMain.classList.add("spa-visible");
      });

      // 12. Re-run sidebar init (navigation highlighting) using cached auth
      const authCtx = await window.getAuthContext();
      if (typeof renderNavigation === "function") {
        renderNavigation(authCtx?.profile?.role || null);
      }

      // 13. Re-wire modal close listeners from utils.js
      rewireModalListeners();

      // 14. Load and execute the page-specific JS
      //     (Do this AFTER DOM is in place so querySelector calls in page JS work)
      await loadPageScript(pageJSSrc);

    } catch (err) {
      console.error("[SPA Router] Navigation failed:", err);
      // Fall back to full navigation
      window.location.href = url;
    } finally {
      _navigating = false;
      hideSPALoader();
    }
  }

  // ─── Sidebar / active link ──────────────────────────────────────────────────

  function updateActiveLink(targetURL) {
    const targetPage = pageNameOf(targetURL);
    document.querySelectorAll(".menu li").forEach((li) => {
      li.classList.remove("active");
      const a = li.querySelector("a");
      if (!a) return;
      const linkHref = a.getAttribute("href") || "";
      const linkPage = linkHref.split("/").pop() || "";
      if (linkPage === targetPage) {
        li.classList.add("active");
      }
    });
  }

  function closeMobileSidebar() {
    const sidebar = document.querySelector(".sidebar");
    const overlay = document.getElementById("sidebarOverlay");
    if (sidebar) sidebar.classList.remove("active");
    if (overlay) overlay.classList.remove("active");
  }

  // ─── Re-wire utils.js modal listeners after swap ───────────────────────────
  // utils.js attaches modal listeners on DOMContentLoaded which only fires once.
  // After each SPA nav we re-attach them so backdrop-click-to-close still works.

  const MODAL_IDS = [
    "periodModal","editPeriodModal","editSystemUserModal","systemUserModal",
    "editSubjectModal","subjectModal","structureModal","editStructureModal",
    "viewStructureModal","termModal","editTermModal","editDepartmentModal",
    "departmentModal","classModal","editClassModal","academicYearModal",
    "editAcademicYearModal",
  ];

  function rewireModalListeners() {
    // Remove old delegated handler if any, add fresh one
    document.removeEventListener("click", _modalBackdropHandler, true);
    document.addEventListener("click", _modalBackdropHandler, true);

    // Image error fallback
    document.removeEventListener("error", _imgErrorHandler, true);
    document.addEventListener("error", _imgErrorHandler, true);
  }

  function _modalBackdropHandler(event) {
    MODAL_IDS.forEach((id) => {
      const modal = document.getElementById(id);
      if (modal && event.target === modal) {
        modal.classList.remove("active");
        if (typeof unLockBodyScroll === "function") unLockBodyScroll();
      }
    });
  }

  function _imgErrorHandler(event) {
    const image = event.target;
    if (
      image instanceof HTMLImageElement &&
      image.matches(
        ".student-photo,.teacher-photo,.systemUser-photo,.app-person-avatar,#profileAvatar,.view-student-photo,.view-teacher-photo",
      ) &&
      image.src !== window.DEFAULT_PROFILE_AVATAR
    ) {
      image.src = window.DEFAULT_PROFILE_AVATAR;
    }
  }

  // ─── Prefetch on hover ──────────────────────────────────────────────────────

  function prefetch(url) {
    if (!url || shouldSkip(url)) return;
    const cached = _htmlCache.get(url);
    if (cached && Date.now() - cached.ts < HTML_CACHE_TTL) return;
    // Silent background fetch
    fetch(url, { credentials: "same-origin" })
      .then((res) => (res.ok ? res.text() : null))
      .then((html) => {
        if (html) _htmlCache.set(url, { html, ts: Date.now() });
      })
      .catch(() => {});
  }

  // ─── Click interception ─────────────────────────────────────────────────────

  function interceptClicks() {
    document.addEventListener("click", (e) => {
      const a = e.target.closest("a[href]");
      if (!a) return;

      // Respect opt-out
      if (a.dataset.spa === "false") return;
      // Skip modifier keys (open in new tab etc.)
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      // Skip download links
      if (a.hasAttribute("download")) return;
      // Skip target="_blank"
      if (a.target === "_blank") return;

      const url = resolveURL(a.getAttribute("href"));
      if (!url) return;
      if (shouldSkip(url)) return;

      e.preventDefault();
      navigate(url);
    });
  }

  // ─── Hover prefetch ─────────────────────────────────────────────────────────

  function attachHoverPrefetch() {
    // Use event delegation on the sidebar menu and topbar
    document.addEventListener("mouseover", (e) => {
      const a = e.target.closest("a[href]");
      if (!a || a.dataset.spa === "false") return;
      const url = resolveURL(a.getAttribute("href"));
      if (url) prefetch(url);
    });
  }

  // ─── Popstate (browser back/forward) ───────────────────────────────────────

  function handlePopState() {
    window.addEventListener("popstate", (e) => {
      const url = (e.state && e.state.url) || window.location.href;
      navigate(url, false);
    });
  }

  // ─── Loading indicator ──────────────────────────────────────────────────────

  function ensureLoaderEl() {
    let el = document.getElementById("spa-top-loader");
    if (!el) {
      el = document.createElement("div");
      el.id = "spa-top-loader";
      el.innerHTML = '<div class="spa-loader-bar"></div>';
      document.body.prepend(el);
    }
    return el;
  }

  function showSPALoader() {
    const el = ensureLoaderEl();
    el.classList.add("active");
  }

  function hideSPALoader() {
    const el = document.getElementById("spa-top-loader");
    if (el) el.classList.remove("active");
  }

  // ─── Delay helper ───────────────────────────────────────────────────────────

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ─── Bootstrap ─────────────────────────────────────────────────────────────

  function init() {
    // Record the initial page state in history so popstate works
    history.replaceState(
      { url: window.location.href },
      document.title,
      window.location.href,
    );

    interceptClicks();
    attachHoverPrefetch();
    handlePopState();

    // Expose for external use (e.g., programmatic navigation)
    window.SPARouter = { navigate, prefetch };

    console.info("[SPA Router] Initialized ✓");
  }

  // Run after DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
