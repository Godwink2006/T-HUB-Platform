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
  "created_by", "updated_by", "deleted_at", "updated_at",
]);

async function loadMyTransferHistory() {
  const container = document.getElementById("transferHistoryList");
  const client = window.supabaseClient;
  if (!container || !client) return;

  try {
    const { data, error } = await client.rpc("get_my_transfer_history");
    if (error) throw error;

    const transfers = Array.isArray(data) ? data : [];
    if (transfers.length === 0) {
      container.innerHTML = '<div class="history-empty"><i class="fa-regular fa-folder-open" aria-hidden="true"></i><h2>No transfer history yet</h2><p>Records from a previous school will appear here after a transfer is completed.</p></div>';
      return;
    }

    container.innerHTML = transfers.map(renderTransfer).join("");
  } catch (error) {
    console.error("Could not load transfer history:", error);
    container.innerHTML = '<div class="history-empty history-error"><i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i><h2>History could not be loaded</h2><p>Refresh the page or contact your school administrator.</p></div>';
  }
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
      <p class="transfer-source">Transfer completed ${escapeHistoryHtml(formatHistoryDate(transfer.completed_at))}</p>
      ${recordSections || '<p class="history-state">No source records were captured for this transfer.</p>'}
    </article>
  `;
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
