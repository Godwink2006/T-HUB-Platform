const AUDIT_LOG_PAGE_SIZE = 25;

const auditLogState = {
  page: 0,
  pageSize: AUDIT_LOG_PAGE_SIZE,
  requestId: 0,
  schoolId: null,
  debounceTimer: null,
  lookups: new Map(),
};

document.addEventListener("DOMContentLoaded", initializeAuditLogsPage);

async function initializeAuditLogsPage() {
  bindAuditLogFilters();
  renderAuditLogLoading();

  const authContext = await window.getAuthContext?.();
  const profile = authContext?.profile;

  if (!authContext?.user || !profile) {
    await window.forceLogout?.();
    return;
  }

  if (
    String(profile.role || "").toLowerCase() !== "admin" ||
    String(profile.status || "").toLowerCase() !== "active" ||
    !profile.school_id
  ) {
    await window.forceLogout?.();
    return;
  }

  auditLogState.schoolId = profile.school_id;
  await loadAuditLogs();
}

async function loadAuditDisplayLookups(rows) {
  const client = window.supabaseClient;
  const schoolId = auditLogState.schoolId;
  if (!client || !schoolId) return;

  // Lookup failures should not hide the audit log; unresolved foreign keys are
  // shown as "Linked record" instead of exposing UUIDs.
  const lookups = [
    ["class_id", "classes", "id, name"],
    ["academic_year_id", "academic_years", "id, year_label"],
    ["term_id", "terms", "id, name"],
    ["period_id", "periods", "id, name, start_time, end_time"],
    ["subject_id", "subjects", "id, name"],
    ["department_id", "departments", "id, name"],
    ["assessment_id", "assessments", "id, name"],
    ["assessment_category_id", "assessment_categories", "id, name"],
    ["book_id", "books", "id, title"],
    ["fee_structure_item_id", "fee_structure_items", "id, fee_name"],
  ];

  await Promise.all(lookups.map(async ([key, table, columns]) => {
    const ids = collectAuditReferenceIds(rows, key);
    if (!ids.length) return;
    try {
      const { data, error } = await client
        .from(table)
        .select(columns)
        .eq("school_id", schoolId)
        .in("id", ids);
      if (error) throw error;
      auditLogState.lookups.set(key, new Map((data || []).map((row) => [row.id, lookupLabel(table, row)])));
    } catch (error) {
      console.warn(`Could not load ${table} audit display names:`, error.message);
    }
  }));

  const feeStructureIds = collectAuditReferenceIds(rows, "fee_structure_id");
  if (feeStructureIds.length) try {
    const { data, error } = await client
      .from("fee_structures")
      .select("id, classes(name), terms(name), academic_years(year_label)")
      .eq("school_id", schoolId)
      .in("id", feeStructureIds);
    if (error) throw error;
    auditLogState.lookups.set("fee_structure_id", new Map((data || []).map((row) => [
      row.id,
      [row.classes?.name, row.academic_years?.year_label, row.terms?.name].filter(Boolean).join(" · ") || "Fee structure",
    ])));
  } catch (error) {
    console.warn("Could not load fee structure audit display names:", error.message);
  }

  const profileIds = [...new Set([
    ...collectAuditReferenceIds(rows, "parent_id"),
    ...collectAuditReferenceIds(rows, "profile_id"),
    ...collectAuditReferenceIds(rows, "borrower_id"),
  ])];
  if (profileIds.length) try {
    const { data, error } = await client
      .from("profiles")
      .select("id, full_name, email")
      .eq("school_id", schoolId)
      .in("id", profileIds);
    if (error) throw error;
    auditLogState.lookups.set("profile_id", new Map((data || []).map((row) => [row.id, row.full_name || row.email || "School user"])));
  } catch (error) {
    console.warn("Could not load profile audit display names:", error.message);
  }

  const teacherIds = collectAuditReferenceIds(rows, "teacher_id");
  if (teacherIds.length) try {
    const { data, error } = await client
      .from("teachers")
      .select("id, profiles(full_name)")
      .eq("school_id", schoolId)
      .in("id", teacherIds);
    if (error) throw error;
    auditLogState.lookups.set("teacher_id", new Map((data || []).map((row) => [row.id, row.profiles?.full_name || "Teacher"])));
  } catch (error) {
    console.warn("Could not load teacher audit display names:", error.message);
  }

  const studentIds = collectAuditReferenceIds(rows, "student_id");
  if (studentIds.length) try {
    const { data, error } = await client
      .from("students")
      .select("id, student_id, profiles(full_name)")
      .eq("school_id", schoolId)
      .in("id", studentIds);
    if (error) throw error;
    auditLogState.lookups.set("student_id", new Map((data || []).map((row) => [
      row.id,
      [row.profiles?.full_name, row.student_id ? `(${row.student_id})` : ""].filter(Boolean).join(" ") || "Student",
    ])));
  } catch (error) {
    console.warn("Could not load student audit display names:", error.message);
  }
}

function collectAuditReferenceIds(rows, fieldName) {
  const values = new Set();
  const visit = (value) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) return value.forEach(visit);
    for (const [key, nested] of Object.entries(value)) {
      if (key === fieldName && isUuid(nested)) values.add(String(nested));
      visit(nested);
    }
  };
  (rows || []).forEach((row) => {
    visit(row.old_data);
    visit(row.new_data);
  });
  return [...values];
}

function lookupLabel(table, row) {
  if (table === "academic_years") return row.year_label || "Academic year";
  if (table === "periods" && row.start_time && row.end_time) {
    return `${row.name} (${row.start_time}–${row.end_time})`;
  }
  return row.name || row.title || row.fee_name || "Record";
}

function bindAuditLogFilters() {
  const searchInput = document.getElementById("auditSearchInput");
  const userInput = document.getElementById("auditUserInput");
  const moduleFilter = document.getElementById("auditModuleFilter");
  const actionFilter = document.getElementById("auditActionFilter");
  const dateFrom = document.getElementById("auditDateFrom");
  const dateTo = document.getElementById("auditDateTo");
  const pageSize = document.getElementById("auditPageSize");

  [searchInput, userInput].forEach((input) => {
    input?.addEventListener("input", () => {
      window.clearTimeout(auditLogState.debounceTimer);
      auditLogState.debounceTimer = window.setTimeout(() => {
        auditLogState.page = 0;
        loadAuditLogs();
      }, 300);
    });
  });

  [moduleFilter, actionFilter, dateFrom, dateTo].forEach((filter) => {
    filter?.addEventListener("change", () => {
      auditLogState.page = 0;
      loadAuditLogs();
    });
  });

  pageSize?.addEventListener("change", () => {
    auditLogState.pageSize = Number(pageSize.value) || AUDIT_LOG_PAGE_SIZE;
    auditLogState.page = 0;
    loadAuditLogs();
  });

  document.getElementById("clearAuditFilters")?.addEventListener("click", () => {
    if (searchInput) searchInput.value = "";
    if (userInput) userInput.value = "";
    if (moduleFilter) moduleFilter.value = "";
    if (actionFilter) actionFilter.value = "";
    if (dateFrom) dateFrom.value = "";
    if (dateTo) dateTo.value = "";
    auditLogState.page = 0;
    loadAuditLogs();
  });

  document.getElementById("auditPreviousPage")?.addEventListener("click", () => {
    if (auditLogState.page <= 0) return;
    auditLogState.page -= 1;
    loadAuditLogs();
  });

  document.getElementById("auditNextPage")?.addEventListener("click", () => {
    auditLogState.page += 1;
    loadAuditLogs();
  });
}

async function loadAuditLogs() {
  if (!auditLogState.schoolId || !window.supabaseClient) return;

  const requestId = ++auditLogState.requestId;
  const fromValue = document.getElementById("auditDateFrom")?.value;
  const toValue = document.getElementById("auditDateTo")?.value;
  const searchValue = document
    .getElementById("auditSearchInput")?.value.trim();
  const userValue = document
    .getElementById("auditUserInput")?.value.trim();

  if (fromValue && toValue && fromValue > toValue) {
    renderAuditLogError("The start date must be on or before the end date.");
    updateAuditPagination(0);
    return;
  }

  renderAuditLogLoading();

  try {
    let query = window.supabaseClient
      .from("audit_logs")
      .select(
        "id, school_id, actor_id, actor_display_name, actor_role, action, module, entity_table, entity_id, description, old_data, new_data, created_at",
        { count: "exact" },
      )
      .eq("school_id", auditLogState.schoolId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });

    const moduleValue = document.getElementById("auditModuleFilter")?.value;
    const actionValue = document.getElementById("auditActionFilter")?.value;

    if (searchValue) query = query.ilike("description", `%${searchValue}%`);
    if (userValue) query = query.ilike("actor_display_name", `%${userValue}%`);
    // Older trigger-map drafts may have stored these labels in lowercase.
    if (moduleValue) query = query.ilike("module", moduleValue);
    if (actionValue) query = query.eq("action", actionValue);

    if (fromValue) {
      query = query.gte(
        "created_at",
        new Date(`${fromValue}T00:00:00`).toISOString(),
      );
    }

    if (toValue) {
      const endExclusive = new Date(`${toValue}T00:00:00`);
      endExclusive.setDate(endExclusive.getDate() + 1);
      query = query.lt("created_at", endExclusive.toISOString());
    }

    const start = auditLogState.page * auditLogState.pageSize;
    const end = start + auditLogState.pageSize - 1;
    const { data, error, count } = await query.range(start, end);

    if (requestId !== auditLogState.requestId) return;
    if (error) throw error;

    const totalCount = count || 0;
    const pageCount = Math.max(1, Math.ceil(totalCount / auditLogState.pageSize));

    if (auditLogState.page >= pageCount) {
      auditLogState.page = pageCount - 1;
      return loadAuditLogs();
    }

    await loadAuditDisplayLookups(data || []);
    if (requestId !== auditLogState.requestId) return;
    renderAuditLogRows(data || []);
    updateAuditPagination(totalCount);
  } catch (error) {
    if (requestId !== auditLogState.requestId) return;
    console.error("Could not load audit logs:", error);

    const message =
      error?.code === "PGRST205" || error?.code === "42P01"
        ? "The audit log table is not available through the Data API. Apply the audit log SQL setup and confirm public.audit_logs is exposed to authenticated users."
        : error?.message || "Could not load audit logs. Please try again.";

    renderAuditLogError(message);
    updateAuditPagination(0);
  }
}

function renderAuditLogLoading() {
  const tbody = document.getElementById("auditLogsTableBody");
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="audit-table-message" role="status">
          <i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i>
          Loading audit logs...
        </td>
      </tr>
    `;
  }
}

function renderAuditLogRows(rows) {
  const tbody = document.getElementById("auditLogsTableBody");
  if (!tbody) return;

  if (!rows.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="audit-table-message">No audit logs match these filters.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = rows
    .map((row) => {
      const actorName = row.actor_display_name || "System process";
      const actorRole = row.actor_role || "";
      const action = String(row.action || "").toUpperCase();
      const actionLabel = auditActionLabel(action);
      const details = renderAuditLogDetails(row);

      return `
        <tr>
          <td class="audit-date-cell">${escapeAuditHtml(formatAuditDate(row.created_at))}</td>
          <td>
            <span class="audit-user-name">${escapeAuditHtml(actorName)}</span>
            ${actorRole ? `<small class="audit-user-role">${escapeAuditHtml(actorRole)}</small>` : ""}
          </td>
          <td>${escapeAuditHtml(auditModuleLabel(row.module))}</td>
          <td><span class="audit-action-badge audit-action-${escapeAuditHtml(action.toLowerCase())}">${escapeAuditHtml(actionLabel)}</span></td>
          <td>
            <div class="audit-description">${escapeAuditHtml(row.description || "—")}</div>
            ${details}
          </td>
        </tr>
      `;
    })
    .join("");
}

function renderAuditLogDetails(row) {
  const oldData = row.old_data || {};
  const newData = row.new_data || {};
  const oldFields = readableAuditFields(oldData);
  const newFields = readableAuditFields(newData);
  const entity = row.entity_table ? auditModuleLabel(row.module) : "";

  return `
    <details class="audit-row-details">
      <summary>View record details</summary>
      ${entity ? `<p class="audit-entity">${escapeAuditHtml(entity)} record</p>` : ""}
      <div class="audit-change-grid">
        <section>
          <h3>Before</h3>
          ${renderReadableAuditFields(oldFields, "No previous details available.")}
        </section>
        <section>
          <h3>After</h3>
          ${renderReadableAuditFields(newFields, "No new details available.")}
        </section>
      </div>
    </details>
  `;
}

const AUDIT_HIDDEN_FIELDS = new Set([
  "id", "school_id", "created_at", "updated_at", "deleted_at",
  "actor_id", "user_id", "password", "password_hash", "access_token",
  "refresh_token", "reset_token",
]);

const AUDIT_FIELD_LABELS = {
  student_id: "Student",
  class_id: "Class",
  academic_year_id: "Academic year",
  term_id: "Term",
  period_id: "Period",
  subject_id: "Subject",
  teacher_id: "Teacher",
  profile_id: "Account",
  parent_id: "Parent",
  borrower_id: "Borrower",
  assessment_id: "Assessment",
  assessment_category_id: "Assessment category",
  department_id: "Department",
  book_id: "Book",
  fee_structure_item_id: "Fee item",
  fee_structure_id: "Fee structure",
  enrollment_status: "Enrollment status",
  total_paid: "Amount paid",
  total_fees: "Total fees",
  fee_breakdown: "Fee breakdown",
};

function readableAuditFields(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return [];
  return Object.entries(data)
    .filter(([key]) => !AUDIT_HIDDEN_FIELDS.has(key.toLowerCase()))
    .map(([key, value]) => ({
      label: AUDIT_FIELD_LABELS[key] || humanizeAuditField(key),
      value: formatAuditFieldValue(key, value),
    }))
    .filter((field) => field.value !== null);
}

function renderReadableAuditFields(fields, emptyMessage) {
  if (!fields.length) return `<p class="audit-empty-details">${escapeAuditHtml(emptyMessage)}</p>`;
  return `<dl class="audit-readable-fields">${fields.map(({ label, value }) => `
    <div><dt>${escapeAuditHtml(label)}</dt><dd>${escapeAuditHtml(value)}</dd></div>
  `).join("")}</dl>`;
}

function humanizeAuditField(key) {
  return String(key)
    .replace(/_id$/i, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatAuditFieldValue(key, value) {
  if (value === null || value === undefined || value === "") return "Empty";
  if (Array.isArray(value)) {
    return value.map((item) => formatAuditFieldValue(key, item)).filter(Boolean).join(", ") || "None";
  }
  if (typeof value === "object") {
    const summary = Object.entries(value)
      .filter(([nestedKey]) => !AUDIT_HIDDEN_FIELDS.has(nestedKey.toLowerCase()))
      .map(([nestedKey, nestedValue]) => `${humanizeAuditField(nestedKey)}: ${formatAuditFieldValue(nestedKey, nestedValue)}`)
      .filter(Boolean);
    return summary.join(" · ") || "Details recorded";
  }

  const raw = String(value);
  const foreignKey = key.endsWith("_id") ? key : null;
  if (foreignKey) {
    const lookupKey = ["parent_id", "borrower_id"].includes(foreignKey)
      ? "profile_id"
      : foreignKey;
    const found = auditLogState.lookups.get(lookupKey)?.get(raw);
    if (found) return found;
    if (isUuid(raw)) return "Linked record";
  }
  if (isUuid(raw)) return null;
  if (/^(created_at|updated_at|date|due_date|payment_date|borrowed_at|returned_at)$/i.test(key)) {
    const date = new Date(raw);
    if (!Number.isNaN(date.getTime())) return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: raw.includes(":") ? "short" : undefined });
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (/status$/i.test(key)) return raw.replace(/[_-]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  return raw;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value));
}

function renderAuditLogError(message) {
  const tbody = document.getElementById("auditLogsTableBody");
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="5" class="audit-table-message audit-table-error">${escapeAuditHtml(message)}</td></tr>`;
}

function updateAuditPagination(totalCount) {
  const summary = document.getElementById("auditPageSummary");
  const previousButton = document.getElementById("auditPreviousPage");
  const nextButton = document.getElementById("auditNextPage");
  const firstRow = totalCount ? auditLogState.page * auditLogState.pageSize + 1 : 0;
  const lastRow = Math.min((auditLogState.page + 1) * auditLogState.pageSize, totalCount);
  const pageCount = Math.max(1, Math.ceil(totalCount / auditLogState.pageSize));

  if (summary) {
    summary.textContent = totalCount
      ? `${firstRow}–${lastRow} of ${totalCount.toLocaleString()} records · Page ${auditLogState.page + 1} of ${pageCount}`
      : "0 records";
  }
  if (previousButton) previousButton.disabled = auditLogState.page <= 0;
  if (nextButton) nextButton.disabled = auditLogState.page + 1 >= pageCount;
}

function auditActionLabel(action) {
  return ({
    INSERT: "Create",
    UPDATE: "Update",
    DELETE: "Delete",
    PROMOTE: "Promote",
    TRANSFER: "Transfer",
    PAYMENT: "Payment",
    LOGIN: "Login",
    LOGOUT: "Logout",
  })[action] || action || "—";
}

function auditModuleLabel(module) {
  const canonicalLabels = {
    accounts: "Accounts",
    "school settings": "School Settings",
    academics: "Academics",
    announcements: "Announcements",
    assessments: "Assessments",
    students: "Students",
    enrollment: "Enrollment",
    grades: "Grades",
    attendance: "Attendance",
    finance: "Finance",
    library: "Library",
    notifications: "Notifications",
    parents: "Parents",
    staff: "Staff",
    transfers: "Transfers",
    timetable: "Timetable",
    billing: "Billing",
  };
  const value = String(module || "").trim();
  return canonicalLabels[value.toLowerCase()] || value || "—";
}

function formatAuditDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function escapeAuditHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
