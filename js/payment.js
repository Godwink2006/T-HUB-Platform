const addRecordPayment = document.getElementById("addRecordPayment");
const addRecordPaymentModal = document.getElementById("addRecordPaymentModal");
const closeAddRecordPaymentModal = document.getElementById(
  "closeAddRecordPaymentModal",
);

const cancelAddRecordPaymentModal = document.getElementById(
  "cancelAddRecordPaymentModal",
);

let financeFeeRows = [];

function setFinanceModalVisibility(modal, isVisible) {
  if (!modal) return;

  modal.style.display = isVisible ? "flex" : "none";

  const hasOpenFinanceModal = [
    "addRecordPaymentModal",
    "viewPaymentModal",
  ].some((modalId) => {
    const financeModal = document.getElementById(modalId);
    return financeModal?.style.display === "flex";
  });

  if (hasOpenFinanceModal) {
    lockBodyScroll();
  } else {
    unLockBodyScroll();
  }
}


const recordPaymentBtn = document.getElementById("addRecordPayment");
const recordModal = document.getElementById("addRecordPaymentModal");

if (recordPaymentBtn) {
  recordPaymentBtn.addEventListener("click", () => {
    const activeFeeId = recordPaymentBtn.getAttribute("data-fee-id");
    if (!activeFeeId) {
      showToast("Please select a student fee record first.", "info");
      return;
    }


    setFinanceModalVisibility(recordModal, true);


    loadFeeItemAllocations(activeFeeId);
  });
}

cancelAddRecordPaymentModal.addEventListener("click", () => {
  setFinanceModalVisibility(addRecordPaymentModal, false);
});

closeAddRecordPaymentModal.addEventListener("click", () => {
  setFinanceModalVisibility(addRecordPaymentModal, false);
});

window.addEventListener("click", (e) => {
  if (e.target === addRecordPaymentModal) {
    setFinanceModalVisibility(addRecordPaymentModal, false);
  }
});

const viewPaymentModal = document.getElementById("viewPaymentModal");
const viewButtons = document.querySelectorAll(".view");
const closeViewPaymentModal = document.getElementById("closeViewPaymentModal");
const closeViewBtn = document.getElementById("closeViewBtn");

viewButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setFinanceModalVisibility(viewPaymentModal, true);
  });
});

closeViewPaymentModal.addEventListener("click", () => {
  setFinanceModalVisibility(viewPaymentModal, false);
});

closeViewBtn.addEventListener("click", () => {
  setFinanceModalVisibility(viewPaymentModal, false);
});

window.addEventListener("click", (e) => {
  if (e.target === viewPaymentModal) {
    setFinanceModalVisibility(viewPaymentModal, false);
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

    const { data: transferFeeHistory, error: transferHistoryError } =
      await supabaseClient.rpc("get_school_transfer_fee_history");
    if (transferHistoryError) {
      console.error(
        "Could not load transferred fee history:",
        transferHistoryError,
      );
      showToast(
        `Transferred fee history could not be loaded: ${transferHistoryError.message}`,
        "error",
      );
    }

    const studentIds = [
      ...new Set([
        ...(fees || []).map((fee) => fee.student_id),
        ...(transferFeeHistory || []).map((record) => record.student_id),
      ].filter(Boolean)),
    ];
    const authContext = await window.getAuthContext();
    const schoolId = authContext?.profile?.school_id;
    const { data: studentRecords, error: studentError } = studentIds.length
      ? await supabaseClient
          .from("students")
          .select("id, student_id, profiles(full_name, photo_url)")
          .in("id", studentIds)
      : { data: [], error: null };
    if (studentError) throw studentError;

    const { data: enrollmentSnapshots, error: enrollmentSnapshotError } =
      studentIds.length && schoolId
        ? await supabaseClient
            .from("student_enrollments")
            .select("student_id, student_name_snapshot, student_code_snapshot, student_photo_snapshot")
            .eq("school_id", schoolId)
            .in("student_id", studentIds)
            .not("student_name_snapshot", "is", null)
        : { data: [], error: null };
    if (enrollmentSnapshotError) throw enrollmentSnapshotError;

    const studentMap = Object.fromEntries(
      (studentRecords || []).map((student) => [student.id, student]),
    );
    const enrollmentIdentityMap = Object.fromEntries(
      (enrollmentSnapshots || []).map((enrollment) => [
        enrollment.student_id,
        enrollment,
      ]),
    );
    const transferIdentityMap = Object.fromEntries(
      (transferFeeHistory || [])
        .filter((record) => record.student_id)
        .map((record) => [record.student_id, record]),
    );

    const currentFeeRows = mapCurrentFinanceFeeRecords(
      fees,
      studentMap,
      enrollmentIdentityMap,
      transferIdentityMap,
    );
    const historicalFeeRows = (transferFeeHistory || [])
      .map((record) =>
        mapTransferredFeeHistoryRecord(record, studentMap, enrollmentIdentityMap),
      )
      .filter(Boolean);
    financeFeeRows = [...currentFeeRows, ...historicalFeeRows];

    populateFinanceFilterOptions("financeTermFilter", financeFeeRows, "termId", "termName", "All semesters");
    populateFinanceFilterOptions("financeClassFilter", financeFeeRows, "classId", "className", "All classes");
    populateFinanceFilterOptions("financeYearFilter", financeFeeRows, "yearId", "yearLabel", "All academic years");
    renderFinanceFeeRows();
  } catch (err) {
    console.error("Error loading student fees:", err.message);
    tbody.innerHTML = '<tr><td colspan="7" class="payments-empty-state is-error">Payment records could not be loaded. Refresh the page or contact an administrator.</td></tr>';
  }
}

function mapCurrentFinanceFeeRecords(
  fees,
  studentMap,
  enrollmentIdentityMap,
  transferIdentityMap,
) {
  return (fees || []).map((fee) => ({
    fee,
    studentName:
      studentMap[fee.student_id]?.profiles?.full_name ||
      enrollmentIdentityMap[fee.student_id]?.student_name_snapshot ||
      transferIdentityMap[fee.student_id]?.student_name ||
      "Unknown Student",
    studentCode:
      studentMap[fee.student_id]?.student_id ||
      enrollmentIdentityMap[fee.student_id]?.student_code_snapshot ||
      transferIdentityMap[fee.student_id]?.student_code ||
      "",
    studentPhoto:
      studentMap[fee.student_id]?.profiles?.photo_url ||
      enrollmentIdentityMap[fee.student_id]?.student_photo_snapshot ||
      "",
    className: fee.classes?.name || "Unassigned",
    classId: fee.class_id || fee.classes?.id || "",
    yearLabel: fee.academic_years?.year_label || "Unassigned",
    yearId: fee.academic_year_id || "",
    termName: fee.terms?.name || "Unassigned",
    termId: fee.term_id || "",
  }));
}

function mapTransferredFeeHistoryRecord(
  record,
  studentMap = {},
  enrollmentIdentityMap = {},
) {
  const snapshot = record?.fee_snapshot;
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return null;
  }

  const feeId = snapshot.id || record.source_record_id;
  if (!feeId) return null;

  return {
    fee: {
      id: feeId,
      total_fees: snapshot.total_fees,
      total_paid: snapshot.total_paid,
      balance: snapshot.balance,
      status: snapshot.status,
      student_id: record.student_id,
    },
    studentName:
      record.student_name ||
      enrollmentIdentityMap[record.student_id]?.student_name_snapshot ||
      snapshot.student_name_snapshot ||
      snapshot.student_name ||
      "Unknown Student",
    studentCode:
      record.student_code ||
      enrollmentIdentityMap[record.student_id]?.student_code_snapshot ||
      snapshot.student_code_snapshot ||
      snapshot.student_code ||
      "",
    studentPhoto:
      studentMap[record.student_id]?.profiles?.photo_url ||
      enrollmentIdentityMap[record.student_id]?.student_photo_snapshot ||
      "",
    className: snapshot.history_class_name || "Unassigned",
    classId: snapshot.history_class_id || "",
    yearLabel: snapshot.history_academic_year || "Unassigned",
    yearId: snapshot.history_academic_year_id || "",
    termName: snapshot.history_term_name || "Unassigned",
    termId: snapshot.history_term_id || "",
    sourceSchoolName: record.source_school_name || "Previous school",
    isTransferHistory: true,
  };
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
    tbody.innerHTML = `<tr><td colspan="7" class="payments-empty-state">${hasRecords ? "No payment records match these filters." : "No fee records found."}</td></tr>`;
    return;
  }

  tbody.replaceChildren(...matches.map(({ fee, studentName, studentCode, studentPhoto, className, sourceSchoolName, isTransferHistory }) => {
    const row = document.createElement("tr");
    const studentCell = document.createElement("td");
    const studentIdentity = document.createElement("div");
    studentIdentity.className = "finance-student-identity";
    const photo = document.createElement("img");
    photo.className = "finance-student-avatar";
    photo.alt = "";
    photo.loading = "lazy";
    photo.src = studentPhoto || window.DEFAULT_PROFILE_AVATAR || "";
    photo.addEventListener("error", () => {
      if (window.DEFAULT_PROFILE_AVATAR && photo.src !== window.DEFAULT_PROFILE_AVATAR) {
        photo.src = window.DEFAULT_PROFILE_AVATAR;
      }
    }, { once: true });
    studentIdentity.appendChild(photo);
    const studentDetails = document.createElement("span");
    studentDetails.className = "finance-student-details";
    studentDetails.appendChild(document.createTextNode(studentName));
    if (studentCode) {
      const studentId = document.createElement("span");
      studentId.className = "finance-student-id";
      studentId.textContent = ` · ${studentCode}`;
      studentDetails.appendChild(studentId);
    }
    studentIdentity.appendChild(studentDetails);
    if (isTransferHistory) {
      const historyLabel = document.createElement("small");
      historyLabel.className = "payments-history-label";
      historyLabel.textContent = `Transferred fee history · ${sourceSchoolName}`;
      studentDetails.appendChild(historyLabel);
    }
    studentCell.appendChild(studentIdentity);
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
    if (isTransferHistory) {
      const historyNotice = document.createElement("span");
      historyNotice.className = "payments-history-readonly";
      historyNotice.textContent = "Read-only";
      historyNotice.title =
        "This fee record is from the student's previous school and cannot be edited here.";
      actionCell.appendChild(historyNotice);
    } else {
      const viewButton = document.createElement("button");
      viewButton.type = "button";
      viewButton.className = "payments-actions-btn view";
      viewButton.setAttribute("aria-label", `View payment details for ${studentName}`);
      viewButton.innerHTML = '<i class="fa-solid fa-eye" aria-hidden="true"></i>';
      viewButton.addEventListener("click", () => viewFeeDetails(fee.id));
      actionCell.appendChild(viewButton);
    }
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


  setFinanceModalVisibility(modal, true);

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


    let studentRecord = null;
    let enrollmentIdentity = null;
    const cachedFeeRow = financeFeeRows.find((row) => row.fee?.id === feeId);
    if (fee.student_id) {
      const { data, error: studentError } = await supabaseClient
        .from("students")
        .select("student_id, profiles(full_name, photo_url)")
        .eq("id", fee.student_id)
        .maybeSingle();
      if (studentError) throw studentError;
      studentRecord = data;

      const authContext = await window.getAuthContext();
      const schoolId = authContext?.profile?.school_id;
      if (schoolId) {
        const { data: snapshot, error: snapshotError } = await supabaseClient
          .from("student_enrollments")
          .select("student_name_snapshot, student_code_snapshot, student_photo_snapshot")
          .eq("school_id", schoolId)
          .eq("student_id", fee.student_id)
          .not("student_name_snapshot", "is", null)
          .limit(1)
          .maybeSingle();
        if (snapshotError) throw snapshotError;
        enrollmentIdentity = snapshot;
      }
    }
    const studentIdentity = resolveFinanceStudentIdentity(
      studentRecord,
      enrollmentIdentity,
      cachedFeeRow,
    );

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


    document.getElementById("modal-student-name").textContent =
      studentIdentity.name;
    document.getElementById("modal-student-id").textContent =
      studentIdentity.code ? `Student ID: ${studentIdentity.code}` : "";
    const studentPhoto = document.getElementById("modal-student-photo");
    if (studentPhoto) {
      studentPhoto.src =
        studentIdentity.photo || window.DEFAULT_PROFILE_AVATAR || "";
      studentPhoto.addEventListener(
        "error",
        () => {
          if (
            window.DEFAULT_PROFILE_AVATAR &&
            studentPhoto.src !== window.DEFAULT_PROFILE_AVATAR
          ) {
            studentPhoto.src = window.DEFAULT_PROFILE_AVATAR;
          }
        },
        { once: true },
      );
    }
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

function resolveFinanceStudentIdentity(studentRecord, enrollmentIdentity, cachedFeeRow) {
  return {
    name:
      studentRecord?.profiles?.full_name ||
      enrollmentIdentity?.student_name_snapshot ||
      cachedFeeRow?.studentName ||
      "Unknown Student",
    code:
      studentRecord?.student_id ||
      enrollmentIdentity?.student_code_snapshot ||
      cachedFeeRow?.studentCode ||
      "",
    photo:
      studentRecord?.profiles?.photo_url ||
      enrollmentIdentity?.student_photo_snapshot ||
      cachedFeeRow?.studentPhoto ||
      "",
  };
}

document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("viewPaymentModal");
  const closeBtn = document.getElementById("closeViewPaymentModal");
  const closeViewBtn = document.getElementById("closeViewBtn");

  const closeModal = () => {
    setFinanceModalVisibility(modal, false);
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
      setFinanceModalVisibility(recordModal, false);
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
