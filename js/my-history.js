let myTransferHistory = [];
let myHistoryRows = []; // flat rows for filtering + tables

document.addEventListener("DOMContentLoaded", loadMyTransferHistory);

const HISTORY_TYPE_ORDER = ["attendance", "grade", "fee", "payment"];

const HISTORY_TYPE_LABELS = {
  attendance: "Attendance",
  grade: "Grades",
  fee: "Fees",
  payment: "Payments",
};

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
      clearHistoryFilters();
      return;
    }

    myHistoryRows = flattenHistoryRows(myTransferHistory);
    bindHistoryFilters();
    buildHistoryFilters();
    renderHistoryTables();
  } catch (error) {
    console.error("Could not load transfer history:", error);
    container.innerHTML =
      '<div class="history-empty history-error"><i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i><h2>History could not be loaded</h2><p>Refresh the page or contact your school administrator.</p></div>';
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

function flattenHistoryRows(transfers) {
  const rows = [];
  for (const transfer of transfers) {
    const schoolId = String(
      transfer.source_school_id || transfer.source_school_name || "",
    );
    const schoolName = transfer.source_school_name || "Previous school";
    const transferDate = transfer.completed_at || null;
    const studentCode = transfer.source_student_code || "";

    for (const record of Array.isArray(transfer.records)
      ? transfer.records
      : []) {
      const type = normalizeRecordType(record.record_type);
      const snapshot =
        record.record_snapshot && typeof record.record_snapshot === "object"
          ? record.record_snapshot
          : {};
      const ctx = getHistoryContext(snapshot, schoolId, schoolName);
      rows.push({
        type,
        transfer,
        record,
        snapshot,
        schoolId: ctx.schoolId,
        schoolName: ctx.schoolName,
        yearId: ctx.yearId,
        yearName: ctx.yearName,
        classId: ctx.classId,
        className: ctx.className,
        termId: ctx.termId,
        termName: ctx.termName,
        transferDate,
        studentCode,
        capturedAt: record.captured_at || null,
      });
    }
  }
  return rows;
}

function getHistoryContext(snapshot, schoolId, schoolName) {
  return {
    schoolId: schoolId || "",
    schoolName: schoolName || "Previous school",
    yearId: String(
      snapshot.history_academic_year_id || snapshot.academic_year_id || "",
    ),
    yearName: String(
      snapshot.history_academic_year ||
        snapshot.academic_year ||
        snapshot.year_label ||
        "",
    ),
    classId: String(snapshot.history_class_id || snapshot.class_id || ""),
    className: String(snapshot.history_class_name || snapshot.class_name || ""),
    termId: String(snapshot.history_term_id || snapshot.term_id || ""),
    termName: String(
      snapshot.history_term_name || snapshot.term_name || snapshot.term || "",
    ),
  };
}

function bindHistoryFilters() {
  [
    "historySearch",
    "historySchoolFilter",
    "historyYearFilter",
    "historyClassFilter",
    "historyTermFilter",
    "historyTypeFilter",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (!el || el.dataset.bound === "1") return;
    el.dataset.bound = "1";
    el.addEventListener(id === "historySearch" ? "input" : "change", () => {
      buildHistoryFilters();
      renderHistoryTables();
    });
  });
}

function clearHistoryFilters() {
  [
    "historySchoolFilter",
    "historyYearFilter",
    "historyClassFilter",
    "historyTermFilter",
  ].forEach((id) => {
    const select = document.getElementById(id);
    if (!select) return;
    const keepFirst =
      select.options[0]?.outerHTML || '<option value="">All</option>';
    select.innerHTML = keepFirst;
  });
  const count = document.getElementById("historyResultCount");
  if (count) count.textContent = "";
}

function buildHistoryFilters() {
  const active = getHistoryFilterValues();
  const matchesExcept = (exceptKey) =>
    myHistoryRows.filter((row) => rowMatchesFilters(row, active, exceptKey));

  fillHistorySelect(
    "historySchoolFilter",
    collectOptions(matchesExcept("schoolId"), "schoolId", "schoolName"),
    "All schools",
    active.schoolId,
  );
  fillHistorySelect(
    "historyYearFilter",
    collectOptions(matchesExcept("yearId"), "yearId", "yearName"),
    "All academic years",
    active.yearId,
  );
  fillHistorySelect(
    "historyClassFilter",
    collectOptions(matchesExcept("classId"), "classId", "className"),
    "All classes",
    active.classId,
  );
  fillHistorySelect(
    "historyTermFilter",
    collectOptions(matchesExcept("termId"), "termId", "termName"),
    "All semesters",
    active.termId,
  );
}

function collectOptions(rows, idKey, labelKey) {
  const map = new Map();
  for (const row of rows) {
    const id = row[idKey];
    if (!id) continue;
    const label = row[labelKey] || String(id).slice(0, 8);
    if (!map.has(id)) map.set(id, label);
  }
  return map;
}

function fillHistorySelect(id, options, placeholder, selectedValue) {
  const select = document.getElementById(id);
  if (!select) return;
  const selected = selectedValue || "";
  select.innerHTML =
    `<option value="">${escapeHistoryHtml(placeholder)}</option>` +
    [...options.entries()]
      .sort((a, b) => String(a[1]).localeCompare(String(b[1])))
      .map(
        ([value, label]) =>
          `<option value="${escapeHistoryHtml(value)}">${escapeHistoryHtml(label)}</option>`,
      )
      .join("");
  if (selected && options.has(selected)) select.value = selected;
  else select.value = "";
}

function getHistoryFilterValues() {
  return {
    search:
      document.getElementById("historySearch")?.value.trim().toLowerCase() ||
      "",
    schoolId: document.getElementById("historySchoolFilter")?.value || "",
    yearId: document.getElementById("historyYearFilter")?.value || "",
    classId: document.getElementById("historyClassFilter")?.value || "",
    termId: document.getElementById("historyTermFilter")?.value || "",
    type: document.getElementById("historyTypeFilter")?.value || "",
  };
}

function rowMatchesFilters(row, filters, exceptKey = null) {
  if (
    exceptKey !== "schoolId" &&
    filters.schoolId &&
    row.schoolId !== filters.schoolId
  )
    return false;
  if (exceptKey !== "yearId" && filters.yearId && row.yearId !== filters.yearId)
    return false;
  if (
    exceptKey !== "classId" &&
    filters.classId &&
    row.classId !== filters.classId
  )
    return false;
  if (exceptKey !== "termId" && filters.termId && row.termId !== filters.termId)
    return false;
  if (filters.type && row.type !== filters.type) return false;

  if (filters.search) {
    const snap = row.snapshot || {};
    const haystack = [
      row.schoolName,
      row.yearName,
      row.className,
      row.termName,
      row.studentCode,
      row.type,
      ...Object.values(snap).map((v) =>
        typeof v === "object" && v !== null ? JSON.stringify(v) : v,
      ),
    ]
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(filters.search)) return false;
  }
  return true;
}

function getVisibleHistoryRows() {
  const filters = getHistoryFilterValues();
  return myHistoryRows.filter((row) => rowMatchesFilters(row, filters));
}

function renderHistoryTables() {
  const container = document.getElementById("transferHistoryList");
  if (!container) return;

  const visible = getVisibleHistoryRows();
  const count = document.getElementById("historyResultCount");
  if (count) {
    count.textContent = `${visible.length} record${visible.length === 1 ? "" : "s"}`;
  }

  if (!visible.length) {
    container.innerHTML =
      '<div class="history-empty"><i class="fa-regular fa-folder-open" aria-hidden="true"></i><h2>No matching history</h2><p>Try changing or clearing your filters.</p></div>';
    return;
  }

  const byType = new Map();
  for (const row of visible) {
    if (!byType.has(row.type)) byType.set(row.type, []);
    byType.get(row.type).push(row);
  }

  const sections = HISTORY_TYPE_ORDER.filter((t) => byType.has(t))
    .concat([...byType.keys()].filter((t) => !HISTORY_TYPE_ORDER.includes(t)))
    .map((type) => renderHistoryTypeSection(type, byType.get(type)))
    .join("");

  container.innerHTML = sections;
}

function renderHistoryTypeSection(type, rows) {
  const title = HISTORY_TYPE_LABELS[type] || humanize(type);
  let tableHtml = "";
  if (type === "attendance") tableHtml = renderAttendanceTable(rows);
  else if (type === "grade") tableHtml = renderGradeTable(rows);
  else if (type === "fee") tableHtml = renderFeeTable(rows);
  else if (type === "payment") tableHtml = renderPaymentTable(rows);
  else tableHtml = renderGenericTable(rows);

  return `
    <section class="history-group card-section">
      <h2>${escapeHistoryHtml(title)} <span class="history-count-pill">${rows.length}</span></h2>
      <div class="history-table-wrap">${tableHtml}</div>
    </section>
  `;
}

function renderAttendanceTable(rows) {
  const body = rows
    .map((row) => {
      const s = row.snapshot;
      const date =
        s.attendance_date || s.date || s.created_at || row.capturedAt;
      const status = s.status || s.attendance_status || "—";
      return `<tr>
        <td>${escapeHistoryHtml(formatHistoryDate(date, { dateOnly: true }))}</td>
        <td>${escapeHistoryHtml(row.schoolName || "—")}</td>
        <td>${escapeHistoryHtml(row.yearName || "—")}</td>
        <td>${escapeHistoryHtml(row.termName || "—")}</td>
        <td>${escapeHistoryHtml(row.className || "—")}</td>
        <td>${escapeHistoryHtml(pick(s, ["subject_name", "subject"]) || "—")}</td>
        <td>${escapeHistoryHtml(pick(s, ["period_name", "period"]) || "—")}</td>
        <td><span class="status-pill ${statusClass(status)}">${escapeHistoryHtml(status)}</span></td>
        <td>${escapeHistoryHtml(pick(s, ["remarks", "notes"]) || "—")}</td>
      </tr>`;
    })
    .join("");

  return `<table class="history-table">
    <thead><tr>
      <th>Date</th><th>School</th><th>Academic year</th><th>Semester</th>
      <th>Class</th><th>Subject</th><th>Period</th><th>Status</th><th>Notes</th>
    </tr></thead>
    <tbody>${body}</tbody>
  </table>`;
}

function renderGradeTable(rows) {
  const body = rows
    .map((row) => {
      const s = row.snapshot;
      const date = s.date_recorded || s.created_at || row.capturedAt;
      const score = s.score ?? s.marks ?? "—";
      const max = s.max_marks ?? s.maximum_marks ?? "—";
      return `<tr>
        <td>${escapeHistoryHtml(formatHistoryDate(date, { dateOnly: true }))}</td>
        <td>${escapeHistoryHtml(row.schoolName || "—")}</td>
        <td>${escapeHistoryHtml(row.yearName || "—")}</td>
        <td>${escapeHistoryHtml(row.termName || "—")}</td>
        <td>${escapeHistoryHtml(row.className || "—")}</td>
        <td>${escapeHistoryHtml(pick(s, ["subject_name", "subject"]) || "—")}</td>
        <td>${escapeHistoryHtml(pick(s, ["assessment_name", "assessment", "assessment_period"]) || "—")}</td>
        <td>${escapeHistoryHtml(pick(s, ["assessment_category", "category_name", "category"]) || "—")}</td>
        <td>${escapeHistoryHtml(formatHistoryValue("score", score))}</td>
        <td>${escapeHistoryHtml(formatHistoryValue("max_marks", max))}</td>
        <td>${escapeHistoryHtml(s.remarks || "—")}</td>
      </tr>`;
    })
    .join("");

  return `<table class="history-table">
    <thead><tr>
      <th>Date</th><th>School</th><th>Academic year</th><th>Semester</th>
      <th>Class</th><th>Subject</th><th>Assessment</th><th>Category</th>
      <th>Score</th><th>Maximum</th><th>Remarks</th>
    </tr></thead>
    <tbody>${body}</tbody>
  </table>`;
}

function renderFeeTable(rows) {
  const body = rows
    .map((row) => {
      const s = row.snapshot;
      const items = renderFeeItemsInline(s.fee_breakdown);
      return `<tr>
        <td>${escapeHistoryHtml(row.schoolName || "—")}</td>
        <td>${escapeHistoryHtml(row.yearName || pick(s, ["academic_year", "year_label"]) || "—")}</td>
        <td>${escapeHistoryHtml(row.className || "—")}</td>
        <td>${escapeHistoryHtml(row.termName || pick(s, ["term_name", "term"]) || "—")}</td>
        <td>${items || "—"}</td>
        <td class="money">${escapeHistoryHtml(formatMoney(s.total_fees))}</td>
        <td class="money">${escapeHistoryHtml(formatMoney(s.total_paid))}</td>
        <td class="money">${escapeHistoryHtml(formatMoney(s.balance))}</td>
        <td><span class="status-pill ${statusClass(s.status)}">${escapeHistoryHtml(s.status || "—")}</span></td>
      </tr>`;
    })
    .join("");

  return `<table class="history-table">
    <thead><tr>
      <th>School</th><th>Academic year</th><th>Class</th><th>Semester</th>
      <th>Fee items</th><th>Total</th><th>Paid</th><th>Balance</th><th>Status</th>
    </tr></thead>
    <tbody>${body}</tbody>
  </table>`;
}

function renderPaymentTable(rows) {
  const body = rows
    .map((row) => {
      const s = row.snapshot;
      return `<tr>
        <td>${escapeHistoryHtml(formatHistoryDate(s.created_at || row.capturedAt))}</td>
        <td>${escapeHistoryHtml(row.schoolName || "—")}</td>
        <td>${escapeHistoryHtml(s.payment_method || "—")}</td>
        <td>${s.reference_number ? `<code>${escapeHistoryHtml(s.reference_number)}</code>` : "—"}</td>
        <td>${escapeHistoryHtml(s.notes || "—")}</td>
        <td class="money">${escapeHistoryHtml(formatMoney(s.amount))}</td>
      </tr>`;
    })
    .join("");

  return `<table class="history-table">
    <thead><tr>
      <th>Date</th><th>School</th><th>Method</th><th>Reference</th><th>Note</th><th>Amount</th>
    </tr></thead>
    <tbody>${body}</tbody>
  </table>`;
}

function renderGenericTable(rows) {
  const body = rows
    .map((row) => {
      const fields = selectDisplayFields(row.snapshot, []);
      const cells = fields
        .slice(0, 8)
        .map(
          (f) =>
            `<td><small class="field-key">${escapeHistoryHtml(humanize(f.key))}</small><br>${escapeHistoryHtml(formatHistoryValue(f.key, f.value))}</td>`,
        )
        .join("");
      return `<tr>
        <td>${escapeHistoryHtml(row.schoolName || "—")}</td>
        <td>${escapeHistoryHtml(row.yearName || "—")}</td>
        <td>${escapeHistoryHtml(row.className || "—")}</td>
        ${cells}
      </tr>`;
    })
    .join("");
  return `<table class="history-table"><tbody>${body}</tbody></table>`;
}

function renderFeeItemsInline(value) {
  let items = value;
  if (typeof value === "string") {
    try {
      items = JSON.parse(value);
    } catch {
      return "";
    }
  }
  if (!Array.isArray(items) || !items.length) return "";
  return `<ul class="fee-item-list">${items
    .map((item) => {
      if (!item || typeof item !== "object") return "";
      const name = item.fee_name || item.name || "Fee item";
      return `<li>${escapeHistoryHtml(name)}: <strong>${escapeHistoryHtml(formatMoney(item.amount))}</strong></li>`;
    })
    .join("")}</ul>`;
}

function selectDisplayFields(snapshot, preferredFields) {
  const HIDDEN = new Set([
    "id",
    "student_id",
    "school_id",
    "source_school_id",
    "target_school_id",
    "attendance_id",
    "grade_id",
    "class_id",
    "subject_id",
    "term_id",
    "academic_year_id",
    "assessment_id",
    "assessment_category_id",
    "fee_structure_id",
    "student_fee_id",
    "payment_transaction_id",
    "history_class_id",
    "history_academic_year_id",
    "history_term_id",
    "created_by",
    "updated_by",
    "deleted_at",
    "updated_at",
    "fee_breakdown",
  ]);
  const keys = [...preferredFields, ...Object.keys(snapshot || {})];
  const seen = new Set();
  const fields = [];
  for (const key of keys) {
    if (seen.has(key) || HIDDEN.has(key)) continue;
    seen.add(key);
    const value = snapshot[key];
    if (value === null || value === undefined || typeof value === "object")
      continue;
    const text = String(value).trim();
    if (!text) continue;
    fields.push({ key, value });
  }
  return fields;
}

function pick(obj, keys) {
  for (const key of keys) {
    if (obj[key] != null && String(obj[key]).trim() !== "") return obj[key];
  }
  return "";
}

function normalizeRecordType(value) {
  return String(value || "record").toLowerCase();
}

function humanize(value) {
  return String(value || "Details")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatHistoryValue(key, value) {
  if (value === null || value === undefined || value === "") return "—";
  if (
    [
      "created_at",
      "attendance_date",
      "date",
      "assessment_date",
      "date_recorded",
    ].includes(key)
  ) {
    return formatHistoryDate(value);
  }
  if (
    [
      "amount",
      "total_fees",
      "total_paid",
      "balance",
      "max_marks",
      "score",
      "marks",
    ].includes(key) &&
    Number.isFinite(Number(value))
  ) {
    return new Intl.NumberFormat(undefined, {
      maximumFractionDigits: 2,
    }).format(Number(value));
  }
  return String(value);
}

function formatMoney(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function formatHistoryDate(value, options = {}) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(
    undefined,
    options.dateOnly
      ? { day: "numeric", month: "short", year: "numeric" }
      : {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
        },
  ).format(date);
}

function statusClass(status) {
  const n = String(status || "")
    .trim()
    .toLowerCase();
  if (["paid", "present", "completed"].includes(n)) return "status-success";
  if (["unpaid", "absent", "overdue"].includes(n)) return "status-danger";
  if (["partial", "late", "pending"].includes(n)) return "status-warning";
  return "status-neutral";
}

function escapeHistoryHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
