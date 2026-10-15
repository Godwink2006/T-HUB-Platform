let myTransferHistory = [];

document.addEventListener("DOMContentLoaded", loadMyTransferHistory);

const HISTORY_RECORDS = {
  attendance: {
    title: "Attendance",
    icon: "fa-calendar-check",
    fields: ["attendance_date", "date", "status", "attendance_status", "remarks", "notes"],
  },
  grade: {
    title: "Grade",
    icon: "fa-graduation-cap",
    fields: [
      "subject_name", "subject", "assessment_name", "assessment_category",
      "assessment_period", "score", "marks", "max_marks", "remarks", "created_at",
    ],
  },
  fee: {
    title: "Fee record",
    icon: "fa-file-invoice-dollar",
    fields: ["academic_year", "term_name", "total_fees", "total_paid", "status"],
  },
  payment: {
    title: "Payment",
    icon: "fa-money-bill-wave",
    fields: ["created_at", "amount", "payment_method", "reference_number", "notes"],
  },
};

const HIDDEN_HISTORY_FIELDS = new Set([
  "id", "student_id", "school_id", "source_school_id", "target_school_id",
  "attendance_id", "grade_id", "class_id", "subject_id", "term_id",
  "academic_year_id", "assessment_id", "assessment_category_id",
  "fee_structure_id", "student_fee_id", "payment_transaction_id",
  "history_class_id", "history_academic_year_id", "history_term_id",
  "created_by", "updated_by", "deleted_at", "updated_at",
]);

async function loadMyTransferHistory() {
  const container = document.getElementById("transferHistoryList");
  const client = window.supabaseClient;
  if (!container || !client) return;

  try {
    const historyIndex = await window.getStudentTransferHistoryIndex(client);
    myTransferHistory = await enrichStudentHistory(historyIndex.transfers.filter(
      (transfer) => String(transfer.source_school_id || "").toLowerCase() !== historyIndex.currentSchoolId,
    ), client);
    const transfers = myTransferHistory;
    if (transfers.length === 0) {
      container.innerHTML = '<div class="history-empty"><i class="fa-regular fa-folder-open" aria-hidden="true"></i><h2>No transfer history yet</h2><p>Records from a previous school will appear here after a transfer is completed.</p></div>';
      return;
    }

    populateHistoryFilters(transfers);
    ["historySearch", "historySchoolFilter", "historyYearFilter", "historyClassFilter", "historyTypeFilter"]
      .forEach((id) => document.getElementById(id)?.addEventListener(
        id === "historySearch" ? "input" : "change",
        applyHistoryFilters,
      ));
    applyHistoryFilters();
  } catch (error) {
    console.error("Could not load transfer history:", error);
    container.innerHTML = '<div class="history-empty history-error"><i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i><h2>History could not be loaded</h2><p>Refresh the page or contact your school administrator.</p></div>';
  }
}

async function enrichStudentHistory(transfers, client) {
  const records = transfers.flatMap((transfer) => Array.isArray(transfer.records) ? transfer.records : []);
  const idsByType = new Map();
  for (const record of records) {
    const type = normalizeRecordType(record.record_type);
    const id = record.record_snapshot?.id || record.source_record_id;
    if (id) {
      if (!idsByType.has(type)) idsByType.set(type, []);
      idsByType.get(type).push(String(id));
    }
  }

  const lookups = await Promise.all([
    loadHistoryLookup(client, "grade", idsByType.get("grade"), `id, score, remarks, created_at, grades!inner(id, date_recorded, subjects(name), terms(name), academic_years(year_label), assessments(name, maximum_marks), assessment_categories(name))`),
    loadHistoryLookup(client, "attendance", idsByType.get("attendance"), `id, status, created_at, attendance!inner(id, date, subjects(name), periods(name), terms(name), academic_years(year_label), classes(name), profiles:teacher_id(full_name))`),
    loadHistoryLookup(client, "fee", idsByType.get("fee"), `id, total_fees, total_paid, balance, status, fee_breakdown, classes(name), academic_years(year_label), terms(name)`),
  ]);

  const byType = new Map(lookups.map(({ type, rows }) => [type, new Map(rows.map((row) => [String(row.id), row]))]));
  return transfers.map((transfer) => ({
    ...transfer,
    records: (transfer.records || []).map((record) => {
      const type = normalizeRecordType(record.record_type);
      const id = record.record_snapshot?.id || record.source_record_id;
      const live = byType.get(type)?.get(String(id));
      return live ? { ...record, record_snapshot: { ...record.record_snapshot, ...historyLabels(type, live) } } : record;
    }),
  }));
}

async function loadHistoryLookup(client, type, ids, selection) {
  if (!ids?.length) return { type, rows: [] };
  const table = type === "grade" ? "grade_records" : type === "attendance" ? "attendance_records" : "student_fees";
  const { data, error } = await client.from(table).select(selection).in("id", [...new Set(ids)]);
  if (error) {
    console.warn(`[v0] Could not enrich ${type} history records:`, error.message);
    return { type, rows: [] };
  }
  return { type, rows: data || [] };
}

function historyLabels(type, row) {
  if (type === "grade") return {
    score: row.score, remarks: row.remarks, created_at: row.created_at,
    subject_name: row.grades?.subjects?.name, assessment_name: row.grades?.assessments?.name,
    max_marks: row.grades?.assessments?.maximum_marks, assessment_category: row.grades?.assessment_categories?.name,
    term_name: row.grades?.terms?.name, academic_year: row.grades?.academic_years?.year_label,
  };
  if (type === "attendance") return {
    status: row.status, created_at: row.created_at, date: row.attendance?.date,
    subject_name: row.attendance?.subjects?.name, period_name: row.attendance?.periods?.name,
    term_name: row.attendance?.terms?.name, academic_year: row.attendance?.academic_years?.year_label,
    class_name: row.attendance?.classes?.name, teacher_name: row.attendance?.profiles?.full_name,
  };
  return {
    total_fees: row.total_fees, total_paid: row.total_paid, balance: row.balance, status: row.status,
    fee_breakdown: row.fee_breakdown, class_name: row.classes?.name,
    term_name: row.terms?.name, academic_year: row.academic_years?.year_label,
  };
}

function renderTransfer(transfer) {
  const records = Array.isArray(transfer.records) ? transfer.records : [];
  const recordGroups = new Map();
  for (const record of records) {
    const type = normalizeRecordType(record.record_type);
    if (!recordGroups.has(type)) recordGroups.set(type, []);
    recordGroups.get(type).push(record);
  }

  const recordSections = [...recordGroups.entries()].map(([type, items]) => {
    const definition = HISTORY_RECORDS[type] || {
      title: humanize(type),
      icon: "fa-file-lines",
    };
    return `
      <section class="history-group" aria-label="${escapeHistoryHtml(definition.title)} records">
        <h3><i class="fa-solid ${definition.icon}" aria-hidden="true"></i>${escapeHistoryHtml(definition.title)} <span>${items.length}</span></h3>
        <div class="history-record-list">${items.map((item) => renderRecord(item, type)).join("")}</div>
      </section>
    `;
  }).join("");

  return `
    <article class="transfer-history-card">
      <div class="transfer-card-heading">
        <div>
          <span class="history-eyebrow">Previous school</span>
          <h2>${escapeHistoryHtml(transfer.source_school_name || "School name unavailable")}</h2>
        </div>
        <span class="history-date"><i class="fa-regular fa-calendar" aria-hidden="true"></i>${escapeHistoryHtml(formatHistoryDate(transfer.completed_at, { dateOnly: true }))}</span>
      </div>
      <p class="transfer-source">Transfer completed ${escapeHistoryHtml(formatHistoryDate(transfer.completed_at))}${transfer.source_student_code ? ` · Student ID ${escapeHistoryHtml(transfer.source_student_code)}` : ""}</p>
      ${recordSections || '<p class="history-state">No source records were captured for this transfer.</p>'}
    </article>
  `;
}

function populateHistoryFilters(transfers) {
  const schools = new Map();
  const years = new Set();
  const classes = new Set();

  for (const transfer of transfers) {
    const schoolKey = String(transfer.source_school_id || transfer.source_school_name || "");
    if (schoolKey) schools.set(schoolKey, transfer.source_school_name || "Previous school");
    for (const record of Array.isArray(transfer.records) ? transfer.records : []) {
      const snapshot = record.record_snapshot || {};
      const year = historyYear(snapshot);
      const className = historyClass(snapshot);
      if (year) years.add(year);
      if (className) classes.add(className);
    }
  }

  fillHistorySelect("historySchoolFilter", schools, "All schools");
  fillHistorySelect("historyYearFilter", new Map([...years].map((value) => [value, value])), "All years");
  fillHistorySelect("historyClassFilter", new Map([...classes].map((value) => [value, value])), "All classes");
}

function fillHistorySelect(id, options, placeholder) {
  const select = document.getElementById(id);
  if (!select) return;
  select.innerHTML = `<option value="">${escapeHistoryHtml(placeholder)}</option>` +
    [...options.entries()].sort((a, b) => String(a[1]).localeCompare(String(b[1])))
      .map(([value, label]) => `<option value="${escapeHistoryHtml(value)}">${escapeHistoryHtml(label)}</option>`)
      .join("");
}

function applyHistoryFilters() {
  const container = document.getElementById("transferHistoryList");
  if (!container) return;

  const search = document.getElementById("historySearch")?.value.trim().toLowerCase() || "";
  const school = document.getElementById("historySchoolFilter")?.value || "";
  const year = document.getElementById("historyYearFilter")?.value || "";
  const className = document.getElementById("historyClassFilter")?.value || "";
  const type = document.getElementById("historyTypeFilter")?.value || "";
  let recordCount = 0;

  const cards = myTransferHistory.map((transfer) => {
    const schoolKey = String(transfer.source_school_id || transfer.source_school_name || "");
    if (school && school !== schoolKey) return "";
    const records = (Array.isArray(transfer.records) ? transfer.records : []).filter((record) => {
      const snapshot = record.record_snapshot || {};
      if (year && historyYear(snapshot) !== year) return false;
      if (className && historyClass(snapshot) !== className) return false;
      if (type && normalizeRecordType(record.record_type) !== type) return false;
      if (search) {
        const searchable = [transfer.source_school_name, transfer.source_student_code,
          record.record_type, ...Object.values(snapshot).map((value) =>
            typeof value === "object" && value !== null ? JSON.stringify(value) : value,
          )].join(" ").toLowerCase();
        if (!searchable.includes(search)) return false;
      }
      return true;
    });
    recordCount += records.length;
    return records.length ? renderTransfer({ ...transfer, records }) : "";
  }).filter(Boolean);

  const count = document.getElementById("historyResultCount");
  if (count) count.textContent = `${recordCount} record${recordCount === 1 ? "" : "s"}`;
  container.innerHTML = cards.length
    ? cards.join("")
    : '<div class="history-empty"><i class="fa-regular fa-folder-open" aria-hidden="true"></i><h2>No matching history</h2><p>Try changing or clearing your filters.</p></div>';
}

function historyYear(snapshot) {
  return String(snapshot.history_academic_year || snapshot.academic_year || snapshot.year_label || snapshot.academic_year_id || "");
}

function historyClass(snapshot) {
  return String(snapshot.history_class_name || snapshot.class_name || snapshot.class_id || "");
}

function renderRecord(record, type) {
  const definition = HISTORY_RECORDS[type] || { title: humanize(type), fields: [] };
  const snapshot = record.record_snapshot && typeof record.record_snapshot === "object"
    ? record.record_snapshot
    : {};
  const fields = selectDisplayFields(snapshot, definition.fields || []);
  const feeItems = type === "fee" ? renderFeeItems(snapshot.fee_breakdown) : "";
  const summary = fields.find((field) => ["amount", "score", "total_fees", "status", "attendance_date", "date"].includes(field.key));
  const summaryText = summary
    ? `${humanize(summary.key)}: ${formatHistoryValue(summary.key, summary.value)}`
    : formatHistoryDate(record.captured_at, { dateOnly: true });

  return `
    <details class="history-record">
      <summary>
        <span class="history-record-title">${escapeHistoryHtml(definition.title)}</span>
        <span class="history-record-summary">${escapeHistoryHtml(summaryText)}</span>
        <span class="history-record-date">${escapeHistoryHtml(formatHistoryDate(record.captured_at, { dateOnly: true }))}</span>
      </summary>
      <div class="history-record-content">
        ${fields.length ? `<dl class="history-fields">${fields.map(renderField).join("")}</dl>` : '<p class="history-state">No additional details are available.</p>'}
        ${feeItems}
      </div>
    </details>
  `;
}

function selectDisplayFields(snapshot, preferredFields) {
  const keys = [...preferredFields, ...Object.keys(snapshot)];
  const seen = new Set();
  const fields = [];
  for (const key of keys) {
    if (seen.has(key) || HIDDEN_HISTORY_FIELDS.has(key) || key === "fee_breakdown") continue;
    seen.add(key);
    const value = snapshot[key];
    if (value === null || value === undefined || typeof value === "object" || typeof value === "boolean") continue;
    const text = String(value).trim();
    if (!text) continue;
    fields.push({ key, value });
  }
  return fields;
}

function renderField(field) {
  return `
    <div class="history-field">
      <dt>${escapeHistoryHtml(humanize(field.key))}</dt>
      <dd>${escapeHistoryHtml(formatHistoryValue(field.key, field.value))}</dd>
    </div>
  `;
}

function renderFeeItems(value) {
  if (!Array.isArray(value) || value.length === 0) return "";
  const rows = value.map((item) => {
    if (!item || typeof item !== "object") return "";
    const name = item.fee_name || item.name || "Fee item";
    const amount = item.amount;
    return `<div class="fee-item-row"><span>${escapeHistoryHtml(name)}</span><strong>${escapeHistoryHtml(formatHistoryValue("amount", amount))}</strong></div>`;
  }).join("");
  return rows ? `<div class="fee-items"><h4>Fee items</h4>${rows}</div>` : "";
}

function normalizeRecordType(value) {
  const normalized = String(value || "record").toLowerCase();
  return HISTORY_RECORDS[normalized] ? normalized : normalized;
}

function humanize(value) {
  return String(value || "Details")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatHistoryValue(key, value) {
  if (value === null || value === undefined || value === "") return "Not recorded";
  if (["created_at", "attendance_date", "date", "assessment_date"].includes(key)) {
    return formatHistoryDate(value);
  }
  if (["amount", "total_fees", "total_paid", "max_marks", "score", "marks"].includes(key) && Number.isFinite(Number(value))) {
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(Number(value));
  }
  return String(value);
}

function formatHistoryDate(value, options = {}) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(undefined, options.dateOnly
    ? { day: "numeric", month: "short", year: "numeric" }
    : { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}

function escapeHistoryHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
