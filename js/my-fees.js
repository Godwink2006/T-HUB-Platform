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


  await populateFilterDropdowns(userId, client, historyIndex);
  await loadStudentFeesAndHistory(userId, {}, historyIndex);


  document
    .getElementById("filterAcademicYear")
    .addEventListener("change", () => triggerFilter(userId, historyIndex));
  document
    .getElementById("filterClass")
    .addEventListener("change", () => triggerFilter(userId, historyIndex));
  document
    .getElementById("filterTerm")
    .addEventListener("change", () => triggerFilter(userId, historyIndex));
});


async function populateFilterDropdowns(authUserId, client, historyIndex) {
  try {
    const { data: fees } = await client
      .from("student_fees")
      .select(
        `
        id,
        academic_years ( id, year_label ),
        classes ( id, name ),
        terms ( id, name )
      `,
      )
      .eq("student_id", authUserId);

    if (!fees) return;
    const historicalFeeIds = historyIndex?.recordIds?.fee || new Set();
    const currentFees = fees.filter((fee) => !historicalFeeIds.has(String(fee.id)));

    const yearsMap = new Map();
    const classesMap = new Map();
    const termsMap = new Map();

    currentFees.forEach((f) => {
      if (f.academic_years)
        yearsMap.set(f.academic_years.id, f.academic_years.year_label);
      if (f.classes) classesMap.set(f.classes.id, f.classes.name);
      if (f.terms) termsMap.set(f.terms.id, f.terms.name);
    });

    const yearSelect = document.getElementById("filterAcademicYear");
    const classSelect = document.getElementById("filterClass");
    const termSelect = document.getElementById("filterTerm");

    yearsMap.forEach(
      (label, id) =>
        (yearSelect.innerHTML += `<option value="${id}">${label}</option>`),
    );
    classesMap.forEach(
      (name, id) =>
        (classSelect.innerHTML += `<option value="${id}">${name}</option>`),
    );
    termSelect.innerHTML = `<option value="">All Semesters</option>`;
    termsMap.forEach(
      (name, id) =>
        (termSelect.innerHTML += `<option value="${id}">${name}</option>`),
    );
  } catch (err) {
    console.error("Error populating filters:", err);
  }
}

function triggerFilter(userId, historyIndex) {
  const filters = {
    academic_year_id: document.getElementById("filterAcademicYear").value,
    class_id: document.getElementById("filterClass").value,
    term_id: document.getElementById("filterTerm").value,
  };
  loadStudentFeesAndHistory(userId, filters, historyIndex);
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
  if (!feesContainer || !txContainer) return;

  try {
    const client = window.supabaseClient || supabaseClient;

    let feesQuery = client
      .from("student_fees")
      .select(
        `
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
        classes ( id, name ),
        academic_years ( id, year_label ),
        terms ( id, name )
      `,
      )
      .eq("student_id", authUserId)
      .order("created_at", { ascending: false });

    if (filters.academic_year_id)
      feesQuery = feesQuery.eq("academic_year_id", filters.academic_year_id);
    if (filters.class_id)
      feesQuery = feesQuery.eq("class_id", filters.class_id);
    if (filters.term_id) feesQuery = feesQuery.eq("term_id", filters.term_id);

    const { data: fetchedFees, error: feeError } = await feesQuery;
    const historicalFeeIds = historyIndex?.recordIds?.fee || new Set();
    const fees = (fetchedFees || []).filter((fee) => !historicalFeeIds.has(String(fee.id)));

    if (feeError || !fees || fees.length === 0) {
      feesContainer.innerHTML = `
        <div class="empty-state" style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4rem; text-align: center; color: #64748b;">
          <i class="fa-solid fa-file-invoice-dollar" style="font-size: 5rem; margin-bottom: 1rem; color: #cbd5e1;"></i>
          <span style="font-size: 1.1rem; font-weight: 600; color: #334155;">No fee records found.</span>
        </div>`;
      txContainer.innerHTML = `
        <div class="empty-state" style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4rem; text-align: center; color: #64748b;">
          <i class="fa-solid fa-receipt" style="font-size: 5rem; margin-bottom: 1rem; color: #cbd5e1;"></i>
          <span style="font-size: 1.1rem; font-weight: 600; color: #334155;">No payment transaction records found for this period.</span>
        </div>`;
      return;
    }

    renderFeesTable(fees, feesContainer);


    const activeFeeIds = fees.map((f) => f.id);
    await loadFilteredTransactions(
      authUserId,
      activeFeeIds,
      txContainer,
      client,
    );
  } catch (err) {
    console.error("Unexpected error loading fees & history:", err);
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
  }
}
