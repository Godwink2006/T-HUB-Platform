document.addEventListener("DOMContentLoaded", loadMyTransferHistory);

async function loadMyTransferHistory() {
  const container = document.getElementById("transferHistoryList");
  const client = window.supabaseClient;
  if (!container || !client) return;

  try {
    const { data, error } = await client.rpc("get_my_transfer_history");
    if (error) throw error;
    const transfers = Array.isArray(data) ? data : [];
    if (transfers.length === 0) {
      container.innerHTML = '<p class="history-state">No transferred school records are available yet.</p>';
      return;
    }

    container.innerHTML = transfers.map((transfer) => {
      const records = Array.isArray(transfer.records) ? transfer.records : [];
      const recordMarkup = records.map((record) => {
        const snapshot = record.record_snapshot && typeof record.record_snapshot === "object"
          ? record.record_snapshot
          : {};
        const hiddenFields = new Set([
          "id", "student_id", "school_id", "attendance_id", "grade_id",
          "class_id", "fee_structure_id", "created_by", "updated_by",
        ]);
        const fields = Object.entries(snapshot).filter(([key, value]) =>
          !hiddenFields.has(key) && value !== null && typeof value !== "object",
        );
        const nestedFields = Object.entries(snapshot).filter(([key, value]) =>
          !hiddenFields.has(key) && value !== null && typeof value === "object",
        );
        const values = [...fields, ...nestedFields.map(([key, value]) => [key, JSON.stringify(value)])];
        const details = values.length
          ? `<dl>${values.map(([key, value]) => `<div><dt>${escapeHistoryHtml(key.replaceAll("_", " "))}</dt><dd>${escapeHistoryHtml(String(value))}</dd></div>`).join("")}</dl>`
          : '<p class="history-state">No displayable details in this record.</p>';
        return `
          <details class="history-record">
            <summary>${escapeHistoryHtml(record.record_type || "School record")} · ${escapeHistoryHtml(formatHistoryDate(record.captured_at))}</summary>
            ${details}
          </details>
        `;
      }).join("");

      return `
        <article class="transfer-history-card">
          <h2>Transfer record</h2>
          <p class="transfer-source">Sending school: ${escapeHistoryHtml(transfer.source_school_name || transfer.source_school_id || "Unavailable")} · Completed ${escapeHistoryHtml(formatHistoryDate(transfer.completed_at))}</p>
          ${recordMarkup || '<p class="history-state">No source records were captured for this transfer.</p>'}
        </article>
      `;
    }).join("");
  } catch (error) {
    console.error("Could not load transfer history:", error);
    container.innerHTML = '<p class="history-state">Could not load your transfer history. Refresh the page or contact your school administrator.</p>';
  }
}

function formatHistoryDate(value) {
  if (!value) return "date unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "date unavailable" : date.toLocaleString();
}

function escapeHistoryHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
