const addRecordPayment = document.getElementById("addRecordPayment");
const addRecordPaymentModal = document.getElementById("addRecordPaymentModal");
const closeAddRecordPaymentModal = document.getElementById(
  "closeAddRecordPaymentModal",
);

const cancelAddRecordPaymentModal = document.getElementById(
  "cancelAddRecordPaymentModal",
);

let financeFeeRows = [];
let activePaymentCurrencyCode = null;
const FINANCE_PAGE_SIZE = 30;
let financeOffset = 0;
let financeHasMore = false;
let financeIsLoading = false;

function financeErrorMessage(error, action = "load") {
  const code = String(error?.code || "").toUpperCase();
  const status = Number(error?.status || error?.statusCode || 0);
  const raw = String(error?.message || error?.details || "").toLowerCase();

  if (code === "PGRST116") return "This fee record could not be found. Refresh the page and try again.";
  if (code === "23505") return "This payment may already have been recorded. Refresh the payment history before trying again.";
  if (code === "23514" || code === "22P02") return "Check the payment amounts and fee allocations, then try again.";
  if (/school.{0,30}(inactive|not active)|inactive.{0,30}school|school is not active/.test(raw)) {
    return "This school is inactive, so payments cannot be changed right now.";
  }
  if (code === "42501" || status === 401 || status === 403 || /permission denied|row-level security|rls|not authorized|unauthorized/.test(raw)) {
    return "You don’t have permission to do this. If you think you should, contact your school administrator.";
  }
  if (/jwt|token.{0,20}(expired|invalid)|session.{0,20}expired/.test(raw)) {
    return "Your session has expired. Sign in again, then retry.";
  }
  if (/insufficient|exceed.{0,20}(balance|remaining)|greater than.{0,20}(balance|remaining)/.test(raw)) {
    return "The payment amount is greater than the remaining balance. Check the amounts and try again.";
  }
  if (/network|fetch failed|failed to fetch|timeout|timed out|connection/.test(raw)) {
    return "The server could not be reached. Check your connection and try again.";
  }

  if (action === "save") return "The payment could not be saved. Check the amounts and try again.";
  if (action === "details") return "Payment details could not be loaded. Please try again.";
  if (action === "allocations") return "Fee items could not be loaded. Please try again.";
  return "Payment records could not be loaded. Please try again.";
}

function showFinanceLoadError(tbody, colspan, error, action, retry) {
  const row = document.createElement("tr");
  const cell = document.createElement("td");
  cell.colSpan = colspan;
  cell.className = "payments-empty-state is-error";
  const message = document.createElement("p");
  message.textContent = financeErrorMessage(error, action);
  cell.appendChild(message);
  if (retry) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "finance-error-retry";
    button.textContent = "Try again";
    button.addEventListener("click", retry, { once: true });
    cell.appendChild(button);
  }
  row.appendChild(cell);
  tbody.replaceChildren(row);
}

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

async function loadStudentFees(options = {}) {
  const tbody = document.getElementById("student-fees-tbody");
  if (!tbody) return;
  const append = options.append === true;
  const nextButton = document.getElementById("nextFinancePage");

  if (financeIsLoading || (append && !financeHasMore)) return;
  financeIsLoading = true;

  if (!append) {
    financeOffset = 0;
    financeHasMore = false;
    financeFeeRows = [];
    if (nextButton) {
      nextButton.hidden = true;
      nextButton.disabled = false;
      nextButton.textContent = "Next";
    }
    tbody.innerHTML =
      '<tr><td colspan="7" style="text-align: center; color: grey;"><i class="fas fa-spinner fa-spin" style="color: grey"></i>  Loading fees...</td></tr>';
  } else if (nextButton) {
    nextButton.disabled = true;
    nextButton.textContent = "Loading...";
  }

  try {
    const authContext = await window.getAuthContext();
    const schoolId = authContext?.profile?.school_id;
    if (!schoolId) throw new Error("Your account is not linked to a school.");

    const { data: page, error: feeError } = await supabaseClient
      .from("student_fees")
      .select(
        `
        id,
        currency_code,
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
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(financeOffset, financeOffset + FINANCE_PAGE_SIZE);

    if (feeError) throw feeError;

    const fees = page || [];
    const visibleFees = fees.slice(0, FINANCE_PAGE_SIZE);
    financeHasMore = fees.length > FINANCE_PAGE_SIZE;
    if (!append && visibleFees.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="payments-empty-state">No fee records found.</td></tr>';
      populateFinanceFilterOptions("financeTermFilter", [], "termId", "termName", "All semesters");
      populateFinanceFilterOptions("financeClassFilter", [], "classId", "className", "All classes");
      populateFinanceFilterOptions("financeYearFilter", [], "yearId", "yearLabel", "All academic years");
      return;
    }

    const studentIds = [...new Set(visibleFees.map((fee) => fee.student_id).filter(Boolean))];
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

    const currentFeeRows = mapCurrentFinanceFeeRecords(
      visibleFees,
      studentMap,
      enrollmentIdentityMap,
    );
    financeFeeRows = append
      ? financeFeeRows.concat(currentFeeRows)
      : currentFeeRows;
    financeOffset += visibleFees.length;

    populateFinanceFilterOptions("financeTermFilter", financeFeeRows, "termId", "termName", "All semesters");
    populateFinanceFilterOptions("financeClassFilter", financeFeeRows, "classId", "className", "All classes");
    populateFinanceFilterOptions("financeYearFilter", financeFeeRows, "yearId", "yearLabel", "All academic years");
    renderFinanceFeeRows();
  } catch (err) {
    console.error("Error loading student fees:", err);
    if (!append) {
      showFinanceLoadError(tbody, 7, err, "load", () => loadStudentFees());
    } else if (typeof showToast === "function") {
      showToast(financeErrorMessage(err, "load"), "error");
    }
  } finally {
    financeIsLoading = false;
    if (nextButton) {
      nextButton.hidden = !financeHasMore;
      nextButton.disabled = false;
      nextButton.textContent = "Next";
    }
  }
}

function mapCurrentFinanceFeeRecords(
  fees,
  studentMap,
  enrollmentIdentityMap,
) {
  return (fees || []).map((fee) => ({
    fee,
    studentName:
      studentMap[fee.student_id]?.profiles?.full_name ||
      enrollmentIdentityMap[fee.student_id]?.student_name_snapshot ||
      "Unknown Student",
    studentCode:
      studentMap[fee.student_id]?.student_id ||
      enrollmentIdentityMap[fee.student_id]?.student_code_snapshot ||
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

  tbody.replaceChildren(...matches.map(({ fee, studentName, studentCode, studentPhoto, className }) => {
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
    studentCell.appendChild(studentIdentity);
    row.appendChild(studentCell);
    const cells = [
      className,
      window.formatSchoolMoney(fee.total_fees, fee.currency_code),
      window.formatSchoolMoney(fee.total_paid, fee.currency_code),
      window.formatSchoolMoney(fee.balance, fee.currency_code),
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

async function refreshFinanceFeeRow(feeId) {
  const index = financeFeeRows.findIndex(
    (row) => String(row.fee?.id) === String(feeId),
  );
  if (index < 0) return false;

  try {
    const { data: fee, error } = await supabaseClient
      .from("student_fees")
      .select(
        `
        id,
        currency_code,
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
      .eq("id", feeId)
      .maybeSingle();

    if (error) throw error;
    if (!fee) return false;

    const cachedRow = financeFeeRows[index];
    const studentMap = fee.student_id
      ? {
          [fee.student_id]: {
            student_id: cachedRow.studentCode,
            profiles: {
              full_name: cachedRow.studentName,
              photo_url: cachedRow.studentPhoto,
            },
          },
        }
      : {};
    const enrollmentIdentityMap = fee.student_id
      ? {
          [fee.student_id]: {
            student_name_snapshot: cachedRow.studentName,
            student_code_snapshot: cachedRow.studentCode,
            student_photo_snapshot: cachedRow.studentPhoto,
          },
        }
      : {};

    const [updatedRow] = mapCurrentFinanceFeeRecords(
      [fee],
      studentMap,
      enrollmentIdentityMap,
    );
    financeFeeRows[index] = updatedRow;
    renderFinanceFeeRows();
    return true;
  } catch (error) {
    console.error("Could not refresh the updated finance fee row:", error);
    showToast(
      "Payment was saved, but the fee row could not be refreshed. The rest of the table was left as it is.",
      "error",
    );
    return false;
  }
}

function initializeFinanceFilters() {
  ["financeStudentSearch", "financeTermFilter", "financeClassFilter", "financeYearFilter", "financeStatusFilter"]
    .forEach((id) => document.getElementById(id)?.addEventListener("input", renderFinanceFeeRows));
  ["financeTermFilter", "financeClassFilter", "financeYearFilter", "financeStatusFilter"]
    .forEach((id) => document.getElementById(id)?.addEventListener("change", renderFinanceFeeRows));
  document
    .getElementById("nextFinancePage")
    ?.addEventListener("click", () => loadStudentFees({ append: true }));
}

document.addEventListener("DOMContentLoaded", initializeFinanceFilters);

let feeDetailsRequestId = 0;

async function viewFeeDetails(feeId) {
  console.log("Opening fee details for fee.id:", feeId);
  if (!feeId || feeId === "undefined") {
    console.error("Invalid feeId passed to viewFeeDetails!");
    showToast("Error: Invalid fee record ID.", "error");
    return;
  }
  const modal = document.getElementById("viewPaymentModal");
  if (!modal) return;

  const requestId = ++feeDetailsRequestId;
  const recordPaymentButton = document.getElementById("addRecordPayment");
  document.getElementById("modal-student-name").textContent = "Loading student…";
  document.getElementById("modal-student-id").textContent = "";
  document.getElementById("modal-academic-year").textContent = "Loading…";
  document.getElementById("modal-term").textContent = "Loading…";
  document.getElementById("modal-class").textContent = "Loading…";
  const studentPhoto = document.getElementById("modal-student-photo");
  if (studentPhoto) {
    studentPhoto.src = window.DEFAULT_PROFILE_AVATAR || "";
  }
  document.getElementById("modal-fee-summary-tbody").innerHTML =
    '<tr><td colspan="2">Loading fee details…</td></tr>';
  document.getElementById("modal-payment-history-tbody").innerHTML =
    '<tr><td colspan="3">Loading payment history…</td></tr>';
  if (recordPaymentButton) {
    recordPaymentButton.removeAttribute("data-fee-id");
    recordPaymentButton.removeAttribute("data-student-id");
    recordPaymentButton.disabled = true;
  }

  setFinanceModalVisibility(modal, true);

  try {

    const { data: fee, error: feeError } = await supabaseClient
      .from("student_fees")
      .select(
        `
        id,
        currency_code,
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

    if (requestId !== feeDetailsRequestId) return;

    if (recordPaymentButton) {
      recordPaymentButton.setAttribute("data-fee-id", feeId);
      recordPaymentButton.setAttribute("data-student-id", fee.student_id);
      recordPaymentButton.disabled = false;
    }

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
          <td>${window.formatSchoolMoney(fee.total_fees, fee.currency_code)}</td>
        </tr>
        <tr>
          <td>Total Paid</td>
          <td>${window.formatSchoolMoney(fee.total_paid, fee.currency_code)}</td>
        </tr>
        <tr>
          <td>Outstanding Balance</td>
          <td>${window.formatSchoolMoney(fee.balance, fee.currency_code)}</td>
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
            '<ul style="margin: 4px 0 0 15px; padding: 0; font-size: 0.8em; color: #555;">';
          if (tx.payment_allocations && tx.payment_allocations.length > 0) {
            tx.payment_allocations.forEach((alloc) => {

              const itemName =
                alloc.item_name ||
                alloc.fee_structure_items?.fee_name ||
                "General Fee";
              allocationsHtml += `<li><strong>${escapeHTML(itemName)}:</strong> ${window.formatSchoolMoney(alloc.amount, fee.currency_code)}</li>`;
            });
          } else {
            allocationsHtml += `<li><em>No specific item breakdown</em></li>`;
          }
          allocationsHtml += "</ul>";

          const row = document.createElement("tr");
          row.innerHTML = `
            <td>${formattedDate}</td>
            <td>
              <div><strong>${window.formatSchoolMoney(tx.amount, fee.currency_code)}</strong></div>
              ${allocationsHtml}
            </td>
            <td>${tx.payment_method || "Cash"}</td>
          `;
          historyTbody.appendChild(row);
        });
      }
    }
  } catch (err) {
    if (requestId !== feeDetailsRequestId) return;
    console.error("Error loading fee details:", err);
    document.getElementById("modal-student-name").textContent = "Details unavailable";
    document.getElementById("modal-academic-year").textContent = "—";
    document.getElementById("modal-term").textContent = "—";
    document.getElementById("modal-class").textContent = "—";
    const message = financeErrorMessage(err, "details");
    document.getElementById("modal-fee-summary-tbody").innerHTML =
      `<tr><td colspan="2" class="payments-empty-state is-error">${escapeHTML(message)}</td></tr>`;
    document.getElementById("modal-payment-history-tbody").innerHTML =
      `<tr><td colspan="3" class="payments-empty-state is-error">${escapeHTML(message)}</td></tr>`;
    const detailsCell = document.querySelector("#modal-fee-summary-tbody td");
    if (detailsCell) {
      const retryButton = document.createElement("button");
      retryButton.type = "button";
      retryButton.className = "finance-error-retry";
      retryButton.textContent = "Try again";
      retryButton.addEventListener("click", () => viewFeeDetails(feeId), { once: true });
      detailsCell.appendChild(document.createElement("br"));
      detailsCell.appendChild(retryButton);
    }
    showToast(message, "error");
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
      await refreshFinanceFeeRow(activeFeeId);
    } catch (err) {
      console.error("Error saving itemized payment:", err);
      showToast(financeErrorMessage(err, "save"), "error");
    } finally {
      savePaymentBtn.disabled = false;
      savePaymentBtn.textContent = originalButtonText;
    }
  });
}
async function loadFeeItemAllocations(feeId) {
  const container = document.getElementById("item-allocations-container");
  if (!container) return;
  container.innerHTML = "Loading items...";

  try {

    const { data: feeRecord, error: feeErr } = await supabaseClient
      .from("student_fees")
      .select("fee_breakdown, currency_code")
      .eq("id", feeId)
      .single();

    if (feeErr) throw feeErr;

    const { data: transactions, error: transactionsError } = await supabaseClient
      .from("payment_transactions")
      .select("payment_allocations(amount, fee_item_id)")
      .eq("student_fee_id", feeId);

    if (transactionsError) throw transactionsError;

    activePaymentCurrencyCode = feeRecord?.currency_code || null;

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
    const paidByItemId = new Map();
    (transactions || []).forEach((transaction) => {
      (transaction.payment_allocations || []).forEach((allocation) => {
        const itemId = allocation.fee_item_id;
        if (!itemId) return;
        paidByItemId.set(
          String(itemId),
          (paidByItemId.get(String(itemId)) || 0) + (Number(allocation.amount) || 0),
        );
      });
    });

    container.innerHTML = "";
    items.forEach((item) => {
      const itemRow = document.createElement("div");
      itemRow.className = "allocation-row";
      itemRow.style.cssText =
        "display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;";

      const itemName = item.name || item.fee_name || "Fee Item";
      const itemId = String(item.id || "");
      const itemAmount = Math.max(0, Number(item.amount) || 0);
      const amountPaid = Math.min(itemAmount, paidByItemId.get(itemId) || 0);
      const amountRemaining = Math.max(0, itemAmount - amountPaid);
      const hasItemId = Boolean(itemId);

      itemRow.innerHTML = `
        <div class="item-info">
          <strong>${escapeHTML(itemName)}</strong><br>
          <small>Fee: ${window.formatSchoolMoney(itemAmount, activePaymentCurrencyCode)}</small><br>
          <small>Paid: ${window.formatSchoolMoney(amountPaid, activePaymentCurrencyCode)}</small><br>
          <small>Remaining: ${window.formatSchoolMoney(amountRemaining, activePaymentCurrencyCode)}</small>
        </div>
        <input
          type="number"
          class="item-payment-input"
          data-item-id="${escapeHTML(itemId)}"
          data-max="${amountRemaining}"
          placeholder="${amountRemaining.toFixed(2)}"
          min="0"
          max="${amountRemaining}"
          style="width: 120px; padding: 6px;"
          ${!hasItemId || amountRemaining <= 0 ? "disabled" : ""}
          aria-label="Payment amount for ${escapeHTML(itemName)}; remaining ${window.formatSchoolMoney(amountRemaining, activePaymentCurrencyCode)}"
        />
      `;
      container.appendChild(itemRow);
    });

    document.querySelectorAll(".item-payment-input").forEach((input) => {
      input.addEventListener("input", updateAllocationTotal);
    });
  } catch (err) {
    console.error("Error loading fee items:", err);
    container.replaceChildren();
    const message = document.createElement("p");
    message.className = "payments-empty-state is-error";
    message.textContent = financeErrorMessage(err, "allocations");
    const retryButton = document.createElement("button");
    retryButton.type = "button";
    retryButton.className = "finance-error-retry";
    retryButton.textContent = "Try again";
    retryButton.addEventListener("click", () => loadFeeItemAllocations(feeId), { once: true });
    container.append(message, retryButton);
  }
}

function updateAllocationTotal() {
  let total = 0;
  document.querySelectorAll(".item-payment-input").forEach((input) => {
    const val = parseFloat(input.value) || 0;
    const max = parseFloat(input.getAttribute("data-max"));

    if (val > max) {
      showToast(
        `Amount cannot exceed the item maximum of ${window.formatSchoolMoney(max, activePaymentCurrencyCode)}`,
        "info",
      );
      input.value = max;
      total += max;
    } else {
      total += val;
    }
  });

  document.getElementById("calculated-total-payment").textContent =
    window.formatSchoolMoney(total, activePaymentCurrencyCode);
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
    window.formatSchoolMoney(total, activePaymentCurrencyCode);
}

document.addEventListener("DOMContentLoaded", loadStudentFees);
