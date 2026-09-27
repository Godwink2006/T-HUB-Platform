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
  await loadStudentFees(userId);
  await loadPaymentTransactions(userId);
});

// 1. Load Student Fees Summary
async function loadStudentFees(authUserId) {
  const feesContainer = document.getElementById("studentFeesContainer");
  if (!feesContainer) return;

  try {
    const client = window.supabaseClient || supabaseClient;

    const { data: fees, error } = await client
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
            classes ( id, name ),
            academic_years ( id, year_label ),
            terms ( id, name )
          `,
      )
      .eq("student_id", authUserId)
      .order("created_at", { ascending: false });

    if (error) {
      feesContainer.innerHTML = `<div class="empty-state" style="color: var(--danger-color);">Failed to load school fees.</div>`;
      return;
    }

    if (!fees || fees.length === 0) {
      feesContainer.innerHTML = `<div class="empty-state">No fee records found for your account.</div>`;
      return;
    }

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
      const yearLabel = fee.academic_years?.year_label || "N/A";
      const termName = fee.terms?.name || "N/A";
      const className = fee.classes?.name || "N/A";
      const statusClass =
        fee.status?.toLowerCase() === "paid" ? "paid" : "unpaid";

      let breakdownHtml = `<span style="color: var(--text-muted); font-style: italic;">No items specified</span>`;
      if (fee.fee_breakdown) {
        try {
          const items =
            typeof fee.fee_breakdown === "string"
              ? JSON.parse(fee.fee_breakdown)
              : fee.fee_breakdown;

          if (Array.isArray(items) && items.length > 0) {
            breakdownHtml = `<ul class="breakdown-list">`;
            items.forEach((item) => {
              const itemName = item.name || item.item_name || "Fee Item";
              const itemAmount = item.amount || 0;
              breakdownHtml += `<li>${itemName}: <strong>$${Number(itemAmount).toFixed(2)}</strong></li>`;
            });
            breakdownHtml += `</ul>`;
          }
        } catch (e) {
          console.error("Error parsing fee breakdown JSON:", e);
        }
      }

      html += `
            <tr>
              <td>
                <strong>${yearLabel}</strong><br>
                <span style="color: var(--text-muted); font-size: 13px;">${termName}</span>
              </td>
              <td>${className}</td>
              <td>${breakdownHtml}</td>
              <td class="amount-bold">$${Number(fee.total_fees).toFixed(2)}</td>
              <td class="amount-paid">$${Number(fee.total_paid).toFixed(2)}</td>
              <td class="amount-balance">$${Number(fee.balance).toFixed(2)}</td>
              <td>
                <span class="badge ${statusClass}">
                  ${fee.status || "Unpaid"}
                </span>
              </td>
            </tr>
          `;
    });

    html += `</tbody></table></div>`;
    feesContainer.innerHTML = html;
  } catch (err) {
    console.error("Unexpected error loading fees:", err);
    feesContainer.innerHTML = `<div class="empty-state" style="color: var(--danger-color);">An error occurred while loading fees.</div>`;
  }
}

// 2. Load Payment Transactions & Item Allocations
async function loadPaymentTransactions(authUserId) {
  const txContainer = document.getElementById("paymentTransactionsContainer");
  if (!txContainer) return;

  try {
    const client = window.supabaseClient || supabaseClient;

    // Fetch transactions along with their matching allocations
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
            payment_allocations (
              id,
              item_name,
              amount
            )
          `,
      )
      .eq("student_id", authUserId)
      .order("created_at", { ascending: false });

    if (error) {
      txContainer.innerHTML = `<div class="empty-state" style="color: var(--danger-color);">Failed to load transaction history.</div>`;
      return;
    }

    if (!transactions || transactions.length === 0) {
      txContainer.innerHTML = `<div class="empty-state">No payment transaction records found.</div>`;
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
      const referenceNum = tx.reference_number || "N/A";

      // Format allocation items (Uniform Fees, WASSCE Fees, etc.)
      let allocationsHtml = `<span style="color: var(--text-muted); font-style: italic;">General payment</span>`;
      if (tx.payment_allocations && tx.payment_allocations.length > 0) {
        allocationsHtml = `<ul class="breakdown-list">`;
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
    console.error("Unexpected error loading transactions:", err);
    txContainer.innerHTML = `<div class="empty-state" style="color: var(--danger-color);">An error occurred while loading payment history.</div>`;
  }
}
