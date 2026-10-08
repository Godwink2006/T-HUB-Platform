const addRecordPayment = document.getElementById("addRecordPayment");
const addRecordPaymentModal = document.getElementById("addRecordPaymentModal");
const closeAddRecordPaymentModal = document.getElementById(
  "closeAddRecordPaymentModal",
);

const cancelAddRecordPaymentModal = document.getElementById(
  "cancelAddRecordPaymentModal",
);

let financeFeeRows = [];


const recordPaymentBtn = document.getElementById("addRecordPayment");
const recordModal = document.getElementById("addRecordPaymentModal");

if (recordPaymentBtn) {
  recordPaymentBtn.addEventListener("click", () => {
    const activeFeeId = recordPaymentBtn.getAttribute("data-fee-id");
    if (!activeFeeId) {
      showToast("Please select a student fee record first.", "info");
      return;
    }


    if (recordModal) recordModal.style.display = "flex";


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
  financeFeeRows = [];

  tbody.innerHTML =
    '<tr><td colspan="7" style="text-align: center; color: grey;"><i class="fas fa-spinner fa-spin" style="color: grey"></i>  Loading fees...</td></tr>';

  try {

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
        class_id,
        academic_year_id,
        term_id,
        classes:class_id (id, name),
        academic_years:academic_year_id (year_label),
        terms:term_id (name)
      `,
      )
      .order("created_at", { ascending: false });

    if (feeError) throw feeError;

    if (!fees || fees.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="7" style="text-align: center;">No fee records found.</td></tr>';
      return;
    }


    const studentIds = [...new Set(fees.map((fee) => fee.student_id).filter(Boolean))];
    const [{ data: profiles, error: profileError }, { data: studentRecords, error: studentError }] = await Promise.all([
      studentIds.length
        ? supabaseClient.from("profiles").select("id, full_name").in("id", studentIds)
        : Promise.resolve({ data: [], error: null }),
      studentIds.length
        ? supabaseClient.from("students").select("id, student_id").in("id", studentIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (profileError) throw profileError;
    if (studentError) throw studentError;

    const profileMap = {};
    (profiles || []).forEach((profile) => { profileMap[profile.id] = profile.full_name || "Unknown Student"; });
    const studentCodeMap = {};
    (studentRecords || []).forEach((student) => { studentCodeMap[student.id] = student.student_id || ""; });

    const { data: enrollments, error: enrollmentError } = await supabaseClient
      .from("student_enrollments")
      .select("student_id, enrollment_status");

    if (enrollmentError) throw enrollmentError;

    const enrollmentStatusMap = {};
    if (enrollments) {
      enrollments.forEach((enrollment) => {
        enrollmentStatusMap[enrollment.student_id] = enrollment.enrollment_status;
      });
    }

    const activeFees = fees.filter((fee) => {
      const status = enrollmentStatusMap[fee.student_id] || "";
      const lowerStatus = status.toLowerCase();
      return !lowerStatus.includes("graduated") && !lowerStatus.includes("transferred");
    });

    financeFeeRows = activeFees.map((fee) => ({
      fee,
      studentName: profileMap[fee.student_id] || "Unknown Student",
      studentCode: studentCodeMap[fee.student_id] || "",
      className: fee.classes?.name || "Unassigned",
      classId: fee.class_id || fee.classes?.id || "",
      yearLabel: fee.academic_years?.year_label || "Unassigned",
      yearId: fee.academic_year_id || "",
      termName: fee.terms?.name || "Unassigned",
      termId: fee.term_id || "",
    }));

    populateFinanceFilterOptions("financeTermFilter", financeFeeRows, "termId", "termName", "All semesters");
    populateFinanceFilterOptions("financeClassFilter", financeFeeRows, "classId", "className", "All classes");
    populateFinanceFilterOptions("financeYearFilter", financeFeeRows, "yearId", "yearLabel", "All academic years");
    renderFinanceFeeRows();
  } catch (err) {
    console.error("Error loading student fees:", err.message);
    tbody.innerHTML = '<tr><td colspan="7" class="payments-empty-state is-error">Payment records could not be loaded. Refresh the page or contact an administrator.</td></tr>';
  }
}

function populateFinanceFilterOptions(selectId, rows, valueKey, labelKey, placeholder) {
  const select = document.getElementById(selectId);
  if (!select) return;
  const selectedValue = select.value || "all";
  const values = new Map();
  rows.forEach((row) => {
    if (row[valueKey]) values.set(String(row[valueKey]), String(row[labelKey] || "Unassigned"));
  });
  select.replaceChildren(new Option(placeholder, "all"));
  [...values.entries()]
    .sort((a, b) => a[1].localeCompare(b[1], undefined, { numeric: true, sensitivity: "base" }))
    .forEach(([value, label]) => select.add(new Option(label, value)));
  if ([...values.keys()].includes(selectedValue)) select.value = selectedValue;
}

function matchesFinanceFeeFilters(row, filters) {
  const query = String(filters.search || "").trim().toLocaleLowerCase();
  const searchableText = `${row.studentName || ""} ${row.studentCode || ""}`.toLocaleLowerCase();
  return (!query || searchableText.includes(query))
    && (filters.term === "all" || String(row.termId) === String(filters.term))
    && (filters.classId === "all" || String(row.classId) === String(filters.classId))
    && (filters.year === "all" || String(row.yearId) === String(filters.year))
    && (filters.status === "all" || String(row.fee?.status || "Unpaid").toLowerCase() === String(filters.status).toLowerCase());
}

function renderFinanceFeeRows() {
  const tbody = document.getElementById("student-fees-tbody");
  if (!tbody) return;
  const filters = {
    search: document.getElementById("financeStudentSearch")?.value || "",
    term: document.getElementById("financeTermFilter")?.value || "all",
    classId: document.getElementById("financeClassFilter")?.value || "all",
    year: document.getElementById("financeYearFilter")?.value || "all",
    status: document.getElementById("financeStatusFilter")?.value || "all",
  };
  const matches = financeFeeRows.filter((row) => matchesFinanceFeeFilters(row, filters));
  if (!matches.length) {
    const hasRecords = financeFeeRows.length > 0;
    tbody.innerHTML = `<tr><td colspan="7" class="payments-empty-state">${hasRecords ? "No payment records match these filters." : "No active student fee records found."}</td></tr>`;
    return;
  }

  tbody.replaceChildren(...matches.map(({ fee, studentName, studentCode, className }) => {
    const row = document.createElement("tr");
    const studentCell = document.createElement("td");
    studentCell.appendChild(document.createTextNode(studentName));
    if (studentCode) {
      const studentId = document.createElement("span");
      studentId.className = "finance-student-id";
      studentId.textContent = ` · ${studentCode}`;
      studentCell.appendChild(studentId);
    }
    row.appendChild(studentCell);
    const cells = [
      className,
      `USD ${Number(fee.total_fees || 0).toLocaleString()}`,
      `USD ${Number(fee.total_paid || 0).toLocaleString()}`,
      `USD ${Number(fee.balance || 0).toLocaleString()}`,
    ];
    cells.forEach((value) => {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.appendChild(cell);
    });
    const statusCell = document.createElement("td");
    const status = document.createElement("span");
    const normalizedStatus = String(fee.status || "Unpaid").toLowerCase();
    status.className = normalizedStatus === "paid" ? "payments-status-active" : normalizedStatus === "partial" ? "payments-status-partial" : "payments-status-inactive";
    status.textContent = fee.status || "Unpaid";
    statusCell.appendChild(status);
    row.appendChild(statusCell);
    const actionCell = document.createElement("td");
    const viewButton = document.createElement("button");
    viewButton.type = "button";
    viewButton.className = "payments-actions-btn view";
    viewButton.setAttribute("aria-label", `View payment details for ${studentName}`);
    viewButton.innerHTML = '<i class="fa-solid fa-eye" aria-hidden="true"></i>';
    viewButton.addEventListener("click", () => viewFeeDetails(fee.id));
    actionCell.appendChild(viewButton);
    row.appendChild(actionCell);
    return row;
  }));
}

function initializeFinanceFilters() {
  ["financeStudentSearch", "financeTermFilter", "financeClassFilter", "financeYearFilter", "financeStatusFilter"]
    .forEach((id) => document.getElementById(id)?.addEventListener("input", renderFinanceFeeRows));
  ["financeTermFilter", "financeClassFilter", "financeYearFilter", "financeStatusFilter"]
    .forEach((id) => document.getElementById(id)?.addEventListener("change", renderFinanceFeeRows));
}

document.addEventListener("DOMContentLoaded", initializeFinanceFilters);

async function viewFeeDetails(feeId) {
  console.log("Opening fee details for fee.id:", feeId);
  if (!feeId || feeId === "undefined") {
    console.error("Invalid feeId passed to viewFeeDetails!");
    showToast("Error: Invalid fee record ID.", "error");
    return;
  }
  const modal = document.getElementById("viewPaymentModal");
  if (!modal) return;


  modal.style.display = "flex";

  try {

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
      .eq("student_fee_id", feeId)
      .order("created_at", { descending: true });

    if (txError) throw txError;


    document.getElementById("modal-student-name").textContent = studentName;
    document.getElementById("modal-academic-year").textContent =
      fee.academic_years?.year_label || "N/A";
    document.getElementById("modal-term").textContent =
      fee.terms?.name || "N/A";
    document.getElementById("modal-class").textContent =
      fee.classes?.name || "N/A";


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
          <td>${escapeHTML(fee.status || "Unpaid")}</td>
        </tr>
      `;
    }


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


          let allocationsHtml =
            '<ul style="margin: 4px 0 0 15px; padding: 0; font-size: 0.9em; color: #555;">';
          if (tx.payment_allocations && tx.payment_allocations.length > 0) {
            tx.payment_allocations.forEach((alloc) => {

              const itemName =
                alloc.item_name ||
                alloc.fee_structure_items?.fee_name ||
                "General Fee";
              allocationsHtml += `<li><strong>${escapeHTML(itemName)}:</strong> RWF ${Number(alloc.amount || 0).toLocaleString()}</li>`;
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
    if (savePaymentBtn.disabled) return;

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

    savePaymentBtn.disabled = true;
    const originalButtonText = savePaymentBtn.textContent;
    savePaymentBtn.textContent = "Saving...";

    try {

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


      if (typeof viewFeeDetails === "function") viewFeeDetails(activeFeeId);
      if (typeof loadStudentFees === "function") loadStudentFees();
    } catch (err) {
      console.error("Error saving itemized payment:", err.message);
      showToast("Failed to save payment: " + err.message, "error");
    } finally {
      savePaymentBtn.disabled = false;
      savePaymentBtn.textContent = originalButtonText;
    }
  });
}
async function loadFeeItemAllocations(feeId) {
  const container = document.getElementById("item-allocations-container");
  container.innerHTML = "Loading items...";

  try {

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


    container.innerHTML = "";
    items.forEach((item) => {
      const itemRow = document.createElement("div");
      itemRow.className = "allocation-row";
      itemRow.style.cssText =
        "display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;";


      const itemName = item.name || item.fee_name || "Fee Item";

      itemRow.innerHTML = `
        <div class="item-info">
          <strong>${escapeHTML(itemName)}</strong><br>
          <small>Amount: RWF ${Number(item.amount || 0).toLocaleString()}</small>
        </div>
        <input
          type="number"
          class="item-payment-input"
          data-item-id="${escapeHTML(item.id)}"
          data-max="${Number(item.amount) || 0}"
          placeholder="0.00"
          min="0"
          max="${Number(item.amount) || 0}"
          style="width: 120px; padding: 6px;"
        />
      `;
      container.appendChild(itemRow);
    });


    document.querySelectorAll(".item-payment-input").forEach((input) => {
      input.addEventListener("input", updateAllocationTotal);
    });
  } catch (err) {
    console.error("Detailed Supabase Error:", err.message || err);
    container.innerHTML = `<p style="color: red;">Error: ${escapeHTML(err.message || "Check console for details")}</p>`;
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
