let cachedStudentFees = [];

function getSemesterNumber(termName) {
  const name = String(termName || "");
  if (/\b(?:1(?:st)?|first|term\s*1|semester\s*1|one|i)\b/i.test(name)) {
    return 1;
  }
  if (/\b(?:2(?:nd)?|second|term\s*2|semester\s*2|two|ii)\b/i.test(name)) {
    return 2;
  }
  return null;
}
function getOneRelation(value) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

document.addEventListener("DOMContentLoaded", async () => {
  const client = window.supabaseClient || supabaseClient;
  if (!client) {
    console.error("Supabase client not initialized.");
    return;
  }

  const {
    data: { session },
    error: sessionError,
  } = await client.auth.getSession();
  if (sessionError || !session) {
    window.location.href = "login.html";
    return;
  }

  const userId = session.user.id;
  const historyIndex = await window.getStudentTransferHistoryIndex(client);
  const feesContainer = document.getElementById("studentFeesContainer");
  const txContainer = document.getElementById("paymentTransactionsContainer");

  if (feesContainer) {
    feesContainer.innerHTML = '<div class="empty-state">Loading your fee filters...</div>';
  }
  if (txContainer) {
    txContainer.innerHTML = '<div class="empty-state">Payment history will appear with your selected fee records.</div>';
  }

  const filtersLoaded = await populateFilterDropdowns(userId, client, historyIndex);
  if (!filtersLoaded) return;

  if (!cachedStudentFees.length) {
    if (feesContainer) {
      feesContainer.innerHTML = '<div class="empty-state">No fee records found.</div>';
    }
    if (txContainer) {
      txContainer.innerHTML = '<div class="empty-state">No payment transaction records found.</div>';
    }
    return;
  }

  if (feesContainer) {
    feesContainer.innerHTML = '<div class="empty-state">Choose your filters, then select View fees.</div>';
  }

  document
    .getElementById("applyStudentFeeFilters")
    ?.addEventListener("click", () => {
      const filters = {
        academic_year_id: document.getElementById("filterAcademicYear")?.value || "",
        class_id: document.getElementById("filterClass")?.value || "",
        semester_number: document.getElementById("filterTerm")?.value || "",
      };
      loadStudentFeesAndHistory(userId, filters, historyIndex);
    });
});

async function populateFilterDropdowns(authUserId, client, historyIndex) {
  const feesContainer = document.getElementById("studentFeesContainer");

  try {
    const { data: fees, error } = await client
      .from("student_fees")
      .select(`
        id,
        total_fees,
        total_paid,
        balance,
        status,
        fee_breakdown,
        created_at,
        class_id,
        academic_year_id,
        term_id,
        academic_years ( id, year_label ),
        classes ( id, name ),
        terms ( id, name )
      `)
      .eq("student_id", authUserId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const historicalFeeIds = historyIndex?.recordIds?.fee || new Set();
    cachedStudentFees = (fees || [])
      .filter((fee) => !historicalFeeIds.has(String(fee.id)))
      .map((fee) => ({
        ...fee,
        academic_years: getOneRelation(fee.academic_years),
        classes: getOneRelation(fee.classes),
        terms: getOneRelation(fee.terms),
      }));

    const years = new Map();
    const classes = new Map();

    cachedStudentFees.forEach((fee) => {
      if (fee.academic_years?.id) {
        years.set(String(fee.academic_years.id), fee.academic_years.year_label || "Academic year");
      }
      if (fee.classes?.id) {
        classes.set(String(fee.classes.id), fee.classes.name || "Class");
      }
    });

    fillFeeFilter(document.getElementById("filterAcademicYear"), "All Academic Years", years);
    fillFeeFilter(document.getElementById("filterClass"), "All Classes", classes);

    const termSelect = document.getElementById("filterTerm");
    if (termSelect) {
      termSelect.innerHTML = `
        <option value="">All Semesters</option>
        <option value="1">1st Semester</option>
        <option value="2">2nd Semester</option>`;
    }
    return true;
  } catch (error) {
    console.error("Error loading fee filters:", error);
    if (feesContainer) {
      feesContainer.innerHTML = `
        <div class="empty-state" style="color:#b42318;">
          Failed to load fee filters: ${escapeHTML(error.message || "Unknown error")}
        </div>`;
    }
    return false;
  }
}

function fillFeeFilter(select, placeholder, values) {
  if (!select) return;

  select.replaceChildren();
  const placeholderOption = document.createElement("option");
  placeholderOption.value = "";
  placeholderOption.textContent = placeholder;
  select.appendChild(placeholderOption);

  [...values.entries()]
    .sort((a, b) => String(a[1]).localeCompare(String(b[1]), undefined, { numeric: true }))
    .forEach(([id, label]) => {
      const option = document.createElement("option");
      option.value = id;
      option.textContent = label;
      select.appendChild(option);
    });
}
function renderFeesTable(fees, container) {
  let html = `
    <div class="table-responsive">
      <table>
        <thead>
          <tr>
            <th>Academic Period</th>
            <th>Class</th>
            <th>Fee Items Breakdown</th>
            <th>Total</th>
            <th>Paid</th>
            <th>Balance</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
  `;

  fees.forEach((fee) => {
    const yearLabel = fee.academic_years?.year_label || "-";
    const termName = fee.terms?.name || "-";
    const className = fee.classes?.name || "-";

    let breakdownHtml = `<span style="color: var(--text-muted); font-style: italic;">No items specified</span>`;
    if (fee.fee_breakdown) {
      try {
        const items =
          typeof fee.fee_breakdown === "string"
            ? JSON.parse(fee.fee_breakdown)
            : fee.fee_breakdown;
        if (Array.isArray(items) && items.length > 0) {
          breakdownHtml = `<ul class="breakdown-list" style="margin:0; padding-left:15px;">`;
          items.forEach((item) => {
            const itemName = item.fee_name || "Fee Item";
            const itemAmount = item.amount || 0;
            breakdownHtml += `<li>${escapeHTML(itemName)}: <strong>$${Number(itemAmount).toFixed(2)}</strong></li>`;
          });
          breakdownHtml += `</ul>`;
        }
      } catch (e) {
        console.error("Error parsing fee breakdown JSON:", e);
      }
    }

    const statusValue = (fee.status || "Unpaid").toLowerCase();
    const statusDisplay = fee.status || "Unpaid";

    html += `
      <tr>
        <td><strong>${yearLabel}</strong><br><span style="color: var(--text-muted); font-size: 13px;">${termName}</span></td>
        <td>${className}</td>
        <td>${breakdownHtml}</td>
        <td class="amount-bold">$${Number(fee.total_fees).toFixed(2)}</td>
        <td class="amount-paid">$${Number(fee.total_paid).toFixed(2)}</td>
        <td class="amount-balance">$${Number(fee.balance).toFixed(2)}</td>
        <td><span class="badge ${statusValue}">${statusDisplay}</span></td>
      </tr>
    `;
  });

  html += `</tbody></table></div>`;
  container.innerHTML = html;
}

async function loadStudentFeesAndHistory(authUserId, filters = {}, historyIndex) {
  const feesContainer = document.getElementById("studentFeesContainer");
  const txContainer = document.getElementById("paymentTransactionsContainer");
  const applyButton = document.getElementById("applyStudentFeeFilters");
  if (!feesContainer || !txContainer) return;

  const originalButtonContent = applyButton?.innerHTML;
  if (applyButton) {
    applyButton.disabled = true;
    applyButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Loading...';
  }
  feesContainer.innerHTML = '<div class="empty-state">Loading fee records...</div>';
  txContainer.innerHTML = '<div class="empty-state">Loading payment history...</div>';

  try {
    const fees = cachedStudentFees.filter((fee) => {
      const semesterNumber = Number(filters.semester_number || 0);
      return (
        (!filters.academic_year_id || String(fee.academic_year_id) === String(filters.academic_year_id)) &&
        (!filters.class_id || String(fee.class_id) === String(filters.class_id)) &&
        (!semesterNumber || getSemesterNumber(fee.terms?.name) === semesterNumber)
      );
    });

    if (!fees.length) {
      feesContainer.innerHTML = '<div class="empty-state">No fee records match the selected filters.</div>';
      txContainer.innerHTML = '<div class="empty-state">No payment transaction records match the selected fees.</div>';
      return;
    }

    renderFeesTable(fees, feesContainer);

    const client = window.supabaseClient || supabaseClient;
    const feeIds = fees.map((fee) => fee.id);
    await loadFilteredTransactions(authUserId, feeIds, txContainer, client);
  } catch (error) {
    console.error("Unexpected error loading fees and payment history:", error);
    feesContainer.innerHTML = `
      <div class="empty-state" style="color:#b42318;">
        Failed to load fee records: ${escapeHTML(error.message || "Unknown error")}
      </div>`;
    txContainer.innerHTML = '<div class="empty-state">Could not load payment history.</div>';
  } finally {
    if (applyButton) {
      applyButton.disabled = false;
      applyButton.innerHTML = originalButtonContent || '<i class="fa-solid fa-filter" aria-hidden="true"></i> View fees';
    }
  }
}
async function loadFilteredTransactions(
  authUserId,
  feeIds,
  txContainer,
  client,
) {
  try {

    const { data: transactions, error } = await client
      .from("payment_transactions")
      .select(
        `
        id,
        amount,
        payment_method,
        reference_number,
        notes,
        created_at,
        student_fee_id,
        payment_allocations (
          id,
          item_name,
          amount,
          fee_item_id
        )
      `,
      )
      .eq("student_id", authUserId)
      .in("student_fee_id", feeIds)
      .order("created_at", { ascending: false });

    if (error) {
      txContainer.innerHTML = `<div class="empty-state" style="color: var(--danger-color);">Failed to load transaction history.</div>`;
      return;
    }

    if (!transactions || transactions.length === 0) {
      txContainer.innerHTML = `
        <div class="empty-state" style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4rem; text-align: center; color: #64748b;">
          <i class="fa-solid fa-receipt" style="font-size: 5rem; margin-bottom: 1rem; color: #cbd5e1;"></i>
          <span style="font-size: 1.1rem; font-weight: 600; color: #334155;">No payment transaction records found for this period.</span>
        </div>`;
      return;
    }

    let html = `
      <div class="table-responsive">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Payment Method</th>
              <th>Reference No.</th>
              <th>Allocated Items</th>
              <th>Total Paid</th>
            </tr>
          </thead>
          <tbody>
    `;

    transactions.forEach((tx) => {
      const dateStr = new Date(tx.created_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
      const paymentMethod = tx.payment_method || "Cash / Other";
      const referenceNum = tx.reference_number || "-";

      let allocationsHtml = `<span style="color: var(--text-muted); font-style: italic;">General payment</span>`;
      if (tx.payment_allocations && tx.payment_allocations.length > 0) {
        allocationsHtml = `<ul class="breakdown-list" style="margin:0; padding-left:15px;">`;
        tx.payment_allocations.forEach((alloc) => {
          const name = alloc.item_name || "Fee Item";
          const amt = alloc.amount || 0;
          allocationsHtml += `<li>${name}: <strong>$${Number(amt).toFixed(2)}</strong></li>`;
        });
        allocationsHtml += `</ul>`;
      }

      html += `
        <tr>
          <td>${dateStr}</td>
          <td>${paymentMethod}</td>
          <td><code>${referenceNum}</code></td>
          <td>${allocationsHtml}</td>
          <td class="amount-paid">$${Number(tx.amount).toFixed(2)}</td>
        </tr>
      `;
    });

    html += `</tbody></table></div>`;
    txContainer.innerHTML = html;
  } catch (err) {
    console.error("Error loading transactions:", err);
    txContainer.innerHTML = `
      <div class="empty-state" style="color: var(--danger-color);">
        Failed to load transaction history.
      </div>`;
  }
}
