const addRecordPayment = document.getElementById("addRecordPayment");
const addRecordPaymentModal = document.getElementById("addRecordPaymentModal");
const closeAddRecordPaymentModal = document.getElementById(
  "closeAddRecordPaymentModal",
);

const cancelAddRecordPaymentModal = document.getElementById(
  "cancelAddRecordPaymentModal",
);

// When opening the Record Payment Modal
const recordPaymentBtn = document.getElementById("addRecordPayment");
const recordModal = document.getElementById("addRecordPaymentModal");

if (recordPaymentBtn) {
  recordPaymentBtn.addEventListener("click", () => {
    const activeFeeId = recordPaymentBtn.getAttribute("data-fee-id");
    if (!activeFeeId) {
      showToast("Please select a student fee record first.", "info");
      return;
    }

    // Show the modal
    if (recordModal) recordModal.style.display = "flex";

    // 💡 CALL THE LOADER HERE so items populate instantly!
    loadFeeItemAllocations(activeFeeId);
  });
}

cancelAddRecordPaymentModal.addEventListener("click", () => {
  addRecordPaymentModal.style.display = "none";
});

closeAddRecordPaymentModal.addEventListener("click", () => {
  addRecordPaymentModal.style.display = "none";
});

window.addEventListener("click", (e) => {
  if (e.target === addRecordPaymentModal) {
    addRecordPaymentModal.style.display = "none";
  }
});

const viewPaymentModal = document.getElementById("viewPaymentModal");
const viewButtons = document.querySelectorAll(".view");
const closeViewPaymentModal = document.getElementById("closeViewPaymentModal");
const closeViewBtn = document.getElementById("closeViewBtn");

viewButtons.forEach((button) => {
  button.addEventListener("click", () => {
    viewPaymentModal.style.display = "flex";

    lockBodyScroll();
  });
});

closeViewPaymentModal.addEventListener("click", () => {
  viewPaymentModal.style.display = "none";

  unLockBodyScroll();
});

closeViewBtn.addEventListener("click", () => {
  viewPaymentModal.style.display = "none";

  unLockBodyScroll();
});

window.addEventListener("click", (e) => {
  if (e.target === viewPaymentModal) {
    viewPaymentModal.style.display = "none";

    unLockBodyScroll();
  }
});

async function loadStudentFees() {
  const tbody = document.getElementById("student-fees-tbody");
  if (!tbody) return;

  tbody.innerHTML =
    '<tr><td colspan="7" style="text-align: center; color: grey;"><i class="fas fa-spinner fa-spin" style="color: grey"></i>  Loading fees...</td></tr>';

  try {
    // 1. Fetch student fees and join classes
    const { data: fees, error: feeError } = await supabaseClient
      .from("student_fees")
      .select(
        `
        id,
        total_fees,
        total_paid,
        balance,
        status,
        student_id,
        classes:class_id (name)
      `,
      )
      .order("created_at", { ascending: false });

    if (feeError) throw feeError;

    if (!fees || fees.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="7" style="text-align: center;">No fee records found.</td></tr>';
      return;
    }

    // 2. Fetch all profiles for student names
    const { data: profiles, error: profileError } = await supabaseClient
      .from("profiles")
      .select("id, full_name");

    if (profileError) throw profileError;

    const profileMap = {};
    if (profiles) {
      profiles.forEach((p) => {
        profileMap[p.id] = p.full_name;
      });
    }

    // 3. Fetch student enrollment statuses so we can filter out inactive students
    const { data: enrollments, error: enrollmentError } = await supabaseClient
      .from("student_enrollments")
      .select("student_id, enrollment_status");

    if (enrollmentError) throw enrollmentError;

    // Create a lookup map for the student's latest enrollment status
    const enrollmentStatusMap = {};
    if (enrollments) {
      enrollments.forEach((e) => {
        enrollmentStatusMap[e.student_id] = e.enrollment_status;
      });
    }

    // 4. FILTER: Exclude students whose status is Graduated or Transferred
    const activeFees = fees.filter((fee) => {
      const status = enrollmentStatusMap[fee.student_id] || "";
      const lowerStatus = status.toLowerCase();

      if (
        lowerStatus.includes("graduated") ||
        lowerStatus.includes("transferred")
      ) {
        return false; // Skip this student
      }
      return true;
    });

    if (activeFees.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="7" style="text-align: center;">No active student fee records found.</td></tr>';
      return;
    }

    // 5. Clear and populate table rows with active fees only
    tbody.innerHTML = "";

    activeFees.forEach((fee) => {
      const studentName = profileMap[fee.student_id] || "Unknown Student";
      const className = fee.classes?.name || "Unassigned";

      let statusClass = "payments-status-inactive";
      if (fee.status === "Paid") statusClass = "payments-status-active";
      if (fee.status === "Partial") statusClass = "payments-status-partial";

      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${studentName}</td>
        <td>${className}</td>
        <td>USD ${Number(fee.total_fees || 0).toLocaleString()}</td>
        <td>USD ${Number(fee.total_paid || 0).toLocaleString()}</td>
        <td>USD ${Number(fee.balance || 0).toLocaleString()}</td>
        <td>
          <span class="${statusClass}">${fee.status || "Unpaid"}</span>
        </td>
        <td>
          <button class="payments-actions-btn view" onclick="viewFeeDetails('${fee.id}')">
            <i class="fa-solid fa-eye"></i>
          </button>
        </td>
      `;
      tbody.appendChild(row);
    });
  } catch (err) {
    console.error("Error loading student fees:", err.message);
    tbody.innerHTML =
      '<tr><td colspan="7" style="text-align: center; color: red;">Failed to load fee data.</td></tr>';
  }
}

// Function to open and load the payment details modal
async function viewFeeDetails(feeId) {
  console.log("Opening fee details for fee.id:", feeId); // <-- Check your console for this!
  if (!feeId || feeId === "undefined") {
    console.error("Invalid feeId passed to viewFeeDetails!");
    showToast("Error: Invalid fee record ID.", "error");
    return;
  }
  const modal = document.getElementById("viewPaymentModal");
  if (!modal) return;

  // Show modal
  modal.style.display = "flex";

  try {
    // 1. Fetch fee record with joined class, academic year, and term
    const { data: fee, error: feeError } = await supabaseClient
      .from("student_fees")
      .select(
        `
        id,
        total_fees,
        total_paid,
        balance,
        status,
        student_id,
        classes:class_id (name),
        academic_years:academic_year_id (year_label),
        terms:term_id (name)
      `,
      )
      .eq("id", feeId)
      .single();

    if (feeError) throw feeError;

    const recordPaymentBtn = document.getElementById("addRecordPayment");
    if (recordPaymentBtn) {
      recordPaymentBtn.setAttribute("data-fee-id", feeId);
      recordPaymentBtn.setAttribute("data-student-id", fee.student_id);
    }

    // Fetch student profile name
    let studentName = "Unknown Student";
    if (fee.student_id) {
      const { data: profile } = await supabaseClient
        .from("profiles")
        .select("full_name")
        .eq("id", fee.student_id)
        .single();

      if (profile) studentName = profile.full_name;
    }

    const { data: transactions, error: txError } = await supabaseClient
      .from("payment_transactions")
      .select(
        `
        created_at,
        amount,
        payment_method,
        payment_allocations (
          amount,
          item_name
        )
      `,
      )
      .eq("student_fee_id", feeId) // <--- Fixed: changed activeFeeId to feeId
      .order("created_at", { descending: true });

    if (txError) throw txError;

    // 3. Populate Header / Info Grid using exact IDs
    document.getElementById("modal-student-name").textContent = studentName;
    document.getElementById("modal-academic-year").textContent =
      fee.academic_years?.year_label || "N/A";
    document.getElementById("modal-term").textContent =
      fee.terms?.name || "N/A";
    document.getElementById("modal-class").textContent =
      fee.classes?.name || "N/A";

    // 4. Populate Fees Summary Table
    const feeSummaryTbody = document.getElementById("modal-fee-summary-tbody");
    if (feeSummaryTbody) {
      feeSummaryTbody.innerHTML = `
        <tr>
          <td>Total Fees</td>
          <td>RWF ${Number(fee.total_fees || 0).toLocaleString()}</td>
        </tr>
        <tr>
          <td>Total Paid</td>
          <td>RWF ${Number(fee.total_paid || 0).toLocaleString()}</td>
        </tr>
        <tr>
          <td>Outstanding Balance</td>
          <td>RWF ${Number(fee.balance || 0).toLocaleString()}</td>
        </tr>
        <tr>
          <td>Status</td>
          <td>${fee.status || "Unpaid"}</td>
        </tr>
      `;
    }

    // 5. Populate Payment History Table with Itemized Breakdown
    const historyTbody = document.getElementById("modal-payment-history-tbody");
    if (historyTbody) {
      if (!transactions || transactions.length === 0) {
        historyTbody.innerHTML =
          '<tr><td colspan="3" style="text-align: center;">No payment history recorded yet.</td></tr>';
      } else {
        historyTbody.innerHTML = "";
        transactions.forEach((tx) => {
          const formattedDate = new Date(tx.created_at).toLocaleDateString(
            "en-GB",
            {
              day: "2-digit",
              month: "short",
              year: "numeric",
            },
          );

          // Build itemized breakdown sub-list using snapshot item_name with fallback
          let allocationsHtml =
            '<ul style="margin: 4px 0 0 15px; padding: 0; font-size: 0.9em; color: #555;">';
          if (tx.payment_allocations && tx.payment_allocations.length > 0) {
            tx.payment_allocations.forEach((alloc) => {
              // Prioritize the frozen snapshot item_name, fallback to live join or default
              const itemName =
                alloc.item_name ||
                alloc.fee_structure_items?.fee_name ||
                "General Fee";
              allocationsHtml += `<li><strong>${itemName}:</strong> RWF ${Number(alloc.amount || 0).toLocaleString()}</li>`;
            });
          } else {
            allocationsHtml += `<li><em>No specific item breakdown</em></li>`;
          }
          allocationsHtml += "</ul>";

          const row = document.createElement("tr");
          row.innerHTML = `
            <td>${formattedDate}</td>
            <td>
              <div><strong>RWF ${Number(tx.amount || 0).toLocaleString()}</strong></div>
              ${allocationsHtml}
            </td>
            <td>${tx.payment_method || "Cash"}</td>
          `;
          historyTbody.appendChild(row);
        });
      }
    }
  } catch (err) {
    console.error("Error loading fee details:", err.message);
    showToast("Could not load payment details.", "error");
  }
}
// Close Modal Event Listeners
document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("viewPaymentModal");
  const closeBtn = document.getElementById("closeViewPaymentModal");
  const closeViewBtn = document.getElementById("closeViewBtn");

  const closeModal = () => {
    if (modal) modal.style.display = "none";
  };

  if (closeBtn) closeBtn.addEventListener("click", closeModal);
  if (closeViewBtn) closeViewBtn.addEventListener("click", closeModal);

  window.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeModal();
    }
  });
});

let activeFeeIdForPayment = null;

const savePaymentBtn = document.getElementById("savePaymentBtn");
if (savePaymentBtn) {
  savePaymentBtn.addEventListener("click", async () => {
    const recordPaymentBtn = document.getElementById("addRecordPayment");
    const activeFeeId = recordPaymentBtn
      ? recordPaymentBtn.getAttribute("data-fee-id")
      : null;
    const activeStudentId = recordPaymentBtn
      ? recordPaymentBtn.getAttribute("data-student-id")
      : null;

    if (!activeFeeId) {
      showToast(
        "Error: Missing fee reference. Please reopen the payment details.",
        "error",
      );
      return;
    }

    const paymentMethod = document.getElementById(
      "payment-method-select",
    ).value;
    const referenceNumber = document.getElementById(
      "payment-reference-input",
    ).value;
    const notes = document.getElementById("payment-notes-input")?.value || null;

    // Collect itemized allocations and compute total payment
    let totalPayment = 0;
    const allocations = [];

    document.querySelectorAll(".item-payment-input").forEach((input) => {
      const val = parseFloat(input.value) || 0;
      if (val > 0) {
        totalPayment += val;
        allocations.push({
          fee_item_id: input.getAttribute("data-item-id"),
          amount: val,
        });
      }
    });

    if (totalPayment <= 0) {
      showToast("Please enter an amount for at least one fee item.", "info");
      return;
    }
    console.log("Found recordPaymentBtn element:", recordPaymentBtn);
    console.log(
      "Attribute data-fee-id:",
      recordPaymentBtn?.getAttribute("data-fee-id"),
    );
    console.log(
      "Attribute data-student-id:",
      recordPaymentBtn?.getAttribute("data-student-id"),
    );

    try {
      // Call the Supabase RPC function
      const { data: transactionId, error } = await supabaseClient.rpc(
        "record_itemized_payment",
        {
          p_student_fee_id: activeFeeId,
          p_student_id: activeStudentId || null,
          p_amount: totalPayment,
          p_payment_method: paymentMethod,
          p_reference_number: referenceNumber || null,
          p_notes: notes,
          p_allocations: allocations,
        },
      );

      if (error) throw error;

      showToast("Itemized payment saved successfully!", "success");

      const recordModal = document.getElementById("addRecordPaymentModal");
      if (recordModal) recordModal.style.display = "none";
      document.getElementById("recordPaymentForm")?.reset();

      // Refresh views
      if (typeof viewFeeDetails === "function") viewFeeDetails(activeFeeId);
      if (typeof loadStudentFees === "function") loadStudentFees();
    } catch (err) {
      console.error("Error saving itemized payment:", err.message);
      showToast("Failed to save payment: " + err.message, "error");
    }
  });
}
async function loadFeeItemAllocations(feeId) {
  const container = document.getElementById("item-allocations-container");
  container.innerHTML = "Loading items...";

  try {
    // 1. Get the frozen fee_breakdown snapshot from the student_fees record
    const { data: feeRecord, error: feeErr } = await supabaseClient
      .from("student_fees")
      .select("fee_breakdown")
      .eq("id", feeId)
      .single();

    if (feeErr) throw feeErr;

    if (
      !feeRecord ||
      !feeRecord.fee_breakdown ||
      feeRecord.fee_breakdown.length === 0
    ) {
      container.innerHTML =
        '<p style="color: gray;">No fee items found for this record.</p>';
      return;
    }

    const items = feeRecord.fee_breakdown;

    // 2. Render the input rows cleanly using the snapshot data
    container.innerHTML = "";
    items.forEach((item) => {
      const itemRow = document.createElement("div");
      itemRow.className = "allocation-row";
      itemRow.style.cssText =
        "display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;";

      // Note: Make sure the property matches what you used in jsonb_build_object ('name' vs 'fee_name')
      const itemName = item.name || item.fee_name || "Fee Item";

      itemRow.innerHTML = `
        <div class="item-info">
          <strong>${itemName}</strong><br>
          <small>Amount: RWF ${Number(item.amount || 0).toLocaleString()}</small>
        </div>
        <input 
          type="number" 
          class="item-payment-input" 
          data-item-id="${item.id}" 
          data-max="${item.amount}"
          placeholder="0.00" 
          min="0" 
          max="${item.amount}"
          style="width: 120px; padding: 6px;"
        />
      `;
      container.appendChild(itemRow);
    });

    // Attach listener for real-time total calculation
    document.querySelectorAll(".item-payment-input").forEach((input) => {
      input.addEventListener("input", updateAllocationTotal);
    });
  } catch (err) {
    console.error("Detailed Supabase Error:", err.message || err);
    container.innerHTML = `<p style="color: red;">Error: ${err.message || "Check console for details"}</p>`;
  }
}

function updateAllocationTotal() {
  let total = 0;
  document.querySelectorAll(".item-payment-input").forEach((input) => {
    const val = parseFloat(input.value) || 0;
    const max = parseFloat(input.getAttribute("data-max"));

    if (val > max) {
      showToast(
        `Amount cannot exceed the item maximum of RWF ${max.toLocaleString()}`,
        "info",
      );
      input.value = max;
      total += max;
    } else {
      total += val;
    }
  });

  document.getElementById("calculated-total-payment").textContent =
    total.toLocaleString();
}

function updateResponseTypeTotal() {
  let total = 0;
  document.querySelectorAll(".item-payment-input").forEach((input) => {
    const val = parseFloat(input.value) || 0;
    const max = parseFloat(input.getAttribute("data-max"));

    // Validation: prevent entering more than the remaining balance for this item
    if (val > max) {
      alert(
        `Payment for this item cannot exceed the remaining balance of ${max}`,
      );
      input.value = max;
      total += max;
    } else {
      total += val;
    }
  });

  document.getElementById("calculated-total-payment").textContent =
    total.toFixed(2);
}

document.addEventListener("DOMContentLoaded", loadStudentFees);
