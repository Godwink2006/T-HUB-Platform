/**
 * reports-common.js
 * Common utilities, data fetching, export and print engines for T-HUB Reports.
 */

window.ReportsCommon = (function () {
  let cachedLookups = null;

  /**
   * Initializes page authentication and returns context.
   * Redirects to login if unauthenticated.
   */
  async function initAuth() {
    try {
      if (typeof window.getAuthContext !== "function") {
        throw new Error("window.getAuthContext is not defined.");
      }
      const authCtx = await window.getAuthContext();
      if (!authCtx || !authCtx.user) {
        window.location.href = "/login.html";
        return null;
      }

      // Check role navigation
      if (typeof renderNavigation === "function" && authCtx.profile?.role) {
        renderNavigation(authCtx.profile.role);
      }

      return authCtx;
    } catch (err) {
      console.error("ReportsCommon.initAuth error:", err);
      window.location.href = "/login.html";
      return null;
    }
  }

  /**
   * Fetches common lookup lists (academic years, terms, classes, subjects, departments)
   * scoped to school if applicable.
   */
  async function getLookups(forceRefresh = false) {
    if (cachedLookups && !forceRefresh) {
      return cachedLookups;
    }

    const client = window.supabaseClient || supabaseClient;
    if (!client) {
      console.error("Supabase client not initialized.");
      return {};
    }

    try {
      const [yearsRes, termsRes, classesRes, subjectsRes, deptsRes] =
        await Promise.all([
          client
            .from("academic_years")
            .select("id, year_label, status")
            .order("year_label", { ascending: false }),
          client
            .from("terms")
            .select("id, name, academic_year_id, status")
            .order("name", { ascending: true }),
          client
            .from("classes")
            .select("id, name, school_level, capacity, status")
            .order("name", { ascending: true }),
          client
            .from("subjects")
            .select("id, name, department_id, status")
            .order("name", { ascending: true }),
          client
            .from("departments")
            .select("id, name, status")
            .order("name", { ascending: true }),
        ]);

      cachedLookups = {
        academicYears: yearsRes.data || [],
        terms: termsRes.data || [],
        classes: classesRes.data || [],
        subjects: subjectsRes.data || [],
        departments: deptsRes.data || [],
      };

      return cachedLookups;
    } catch (err) {
      console.error("ReportsCommon.getLookups error:", err);
      return {
        academicYears: [],
        terms: [],
        classes: [],
        subjects: [],
        departments: [],
      };
    }
  }

  /**
   * Populates a <select> element with options.
   */
  function populateSelect(
    selectEl,
    items,
    { placeholder = "All", valueKey = "id", labelKey = "name", selectedValue = "" } = {},
  ) {
    if (!selectEl) return;
    selectEl.innerHTML = "";

    if (placeholder) {
      const defaultOpt = document.createElement("option");
      defaultOpt.value = "";
      defaultOpt.textContent = placeholder;
      selectEl.appendChild(defaultOpt);
    }

    (items || []).forEach((item) => {
      const opt = document.createElement("option");
      opt.value = item[valueKey] !== undefined ? item[valueKey] : item;
      opt.textContent = item[labelKey] !== undefined ? item[labelKey] : item;
      if (selectedValue && String(opt.value) === String(selectedValue)) {
        opt.selected = true;
      }
      selectEl.appendChild(opt);
    });
  }

  /**
   * Currency formatter in RWF (e.g. RWF 250,000,000)
   */
  function formatCurrency(amount) {
    const num = Number(amount) || 0;
    return `RWF ${num.toLocaleString("en-US")}`;
  }

  /**
   * Percentage formatter (e.g. 96.5%)
   */
  function formatPercent(value, decimals = 1) {
    if (value === null || value === undefined || isNaN(value)) return "0%";
    const num = Number(value);
    return `${num.toFixed(decimals).replace(/\.0$/, "")}%`;
  }

  /**
   * Number formatter (e.g. 1,234)
   */
  function formatNumber(value) {
    const num = Number(value) || 0;
    return num.toLocaleString("en-US");
  }

  /**
   * Renders a loading row in a table body.
   */
  function renderLoading(tbodyEl, colSpan = 6, message = "Loading report data...") {
    if (!tbodyEl) return;
    tbodyEl.innerHTML = `
      <tr>
        <td colspan="${colSpan}" style="text-align: center; padding: 30px; color: #64748b;">
          <i class="fa-solid fa-spinner fa-spin" style="margin-right: 8px; font-size: 18px; color: #2563eb;"></i>
          ${escapeHTML(message)}
        </td>
      </tr>
    `;
  }

  /**
   * Renders an empty row in a table body.
   */
  function renderEmpty(tbodyEl, colSpan = 6, message = "No data found matching selected filters.") {
    if (!tbodyEl) return;
    tbodyEl.innerHTML = `
      <tr>
        <td colspan="${colSpan}" style="text-align: center; padding: 30px; color: #94a3b8; font-style: italic;">
          ${escapeHTML(message)}
        </td>
      </tr>
    `;
  }

  /**
   * HTML escape helper.
   */
  function escapeHTML(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /**
   * Clean CSV export generator.
   */
  function exportToCSV(filename, headers, rows) {
    try {
      const csvLines = [];

      // Escape a single CSV cell
      const formatCell = (val) => {
        if (val === null || val === undefined) return '""';
        let str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      };

      // Header row
      csvLines.push(headers.map(formatCell).join(","));

      // Data rows
      rows.forEach((row) => {
        csvLines.push(row.map(formatCell).join(","));
      });

      const csvContent = "\uFEFF" + csvLines.join("\r\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", filename.endsWith(".csv") ? filename : `${filename}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      if (typeof showToast === "function") {
        showToast("Report exported to Excel (CSV) successfully!", "success");
      }
    } catch (err) {
      console.error("Export CSV error:", err);
      if (typeof showToast === "function") {
        showToast("Failed to export Excel file.", "error");
      }
    }
  }

  /**
   * Clean print utility.
   * Prints the current page with print-specific layout.
   */
  function printReport() {
    window.print();
  }

  return {
    initAuth,
    getLookups,
    populateSelect,
    formatCurrency,
    formatPercent,
    formatNumber,
    renderLoading,
    renderEmpty,
    escapeHTML,
    exportToCSV,
    printReport,
  };
})();
