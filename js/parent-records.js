const parentRecordStorageKey = "tHubParentSelectedStudentId";
const parentRecordViews = new Set(["fees", "attendance", "grades"]);
let parentRecordState = {
  view: "fees",
  fees: [],
  payments: [],
  attendance: [],
  grades: [],
  schools: new Map(),
};

document.addEventListener("DOMContentLoaded", initializeParentRecords);

async function initializeParentRecords() {
  const client = window.supabaseClient;
  const content = document.getElementById("parentRecordsContent");
  if (!client || !content) return;

  const params = new URLSearchParams(window.location.search);
  const requestedView = params.get("view");
  parentRecordState.view = parentRecordViews.has(requestedView)
    ? requestedView
    : "fees";
  document.querySelectorAll("[data-record-view]").forEach((link) => {
    link.classList.toggle(
      "is-active",
      link.dataset.recordView === parentRecordState.view,
    );
    if (link.dataset.recordView === parentRecordState.view)
      link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  document.getElementById("recordViewTitle").textContent = {
    fees: "Fees & payments",
    attendance: "Attendance",
    grades: "Grades",
  }[parentRecordState.view];

  document
    .getElementById("parentSignOut")
    ?.addEventListener("click", async () => {
      await client.auth.signOut();
      sessionStorage.removeItem(parentRecordStorageKey);
      window.location.replace("/index.html");
    });

  try {
    const {
      data: { user },
      error: authError,
    } = await client.auth.getUser();
    if (authError || !user) {
      window.location.replace("/index.html");
      return;
    }
    const { data: profile, error: profileError } = await client
      .from("profiles")
      .select("id, full_name, role, status")
      .eq("id", user.id)
      .single();
    if (profileError) throw profileError;
    if (
      profile.role !== "parent" ||
      String(profile.status).toLowerCase() !== "active"
    ) {
      await client.auth.signOut();
      window.location.replace("/index.html");
      return;
    }

    const selectedStudentId = sessionStorage.getItem(parentRecordStorageKey);
    if (!selectedStudentId) {
      showParentRecordsMessage(
        "Choose a student from your dashboard before opening their records.",
        true,
      );
      return;
    }
    const { data: link, error: linkError } = await client
      .from("parent_student_links")
      .select("student_id")
      .eq("parent_user_id", user.id)
      .eq("student_id", selectedStudentId)
      .eq("status", "active")
      .maybeSingle();
    if (linkError) throw linkError;
    if (!link) {
      sessionStorage.removeItem(parentRecordStorageKey);
      showParentRecordsMessage(
        "That student is no longer linked to your account. Choose an available student from the dashboard.",
        true,
      );
      return;
    }

    const { data: student, error: studentError } = await client
      .from("students")
      .select("id, student_id, school_id, profiles(full_name)")
      .eq("id", selectedStudentId)
      .single();
    if (studentError) throw studentError;
    document.getElementById("recordStudentName").textContent =
      student.profiles?.full_name || "Student";
    document.getElementById("recordStudentDetails").textContent =
      `Student ID: ${student.student_id || "Not assigned"}`;

    await loadParentRecordData(client, selectedStudentId);
    document.getElementById("recordFilters").hidden = false;
    buildParentRecordFilters();
    [
      "recordSchoolFilter",
      "recordYearFilter",
      "recordClassFilter",
      "recordTermFilter",
      "recordPeriodFilter",
      "recordSubjectFilter",
    ].forEach((id) => {
      document
        .getElementById(id)
        .addEventListener("change", renderParentRecords);
    });
    renderParentRecords();
  } catch (error) {
    console.error("Could not load parent student records:", error);
    showParentRecordsMessage(
      `Records could not be loaded. ${error.message || "Check the parent data access setup and try again."}`,
      true,
    );
  }
}

async function loadParentRecordData(client, studentId) {
  if (parentRecordState.view === "fees") {
    const [feeResult, paymentResult] = await Promise.all([
      client
        .from("student_fees")
        .select(
          "id, student_id, school_id, total_fees, total_paid, balance, status, fee_breakdown, created_at, class_id, academic_year_id, term_id, classes(id,name), academic_years(id,year_label), terms(id,name)",
        )
        .eq("student_id", studentId)
        .order("created_at", { ascending: false }),
      client
        .from("payment_transactions")
        .select(
          "id, student_id, school_id, amount, payment_method, reference_number, notes, created_at, student_fee_id",
        )
        .eq("student_id", studentId)
        .order("created_at", { ascending: false }),
    ]);
    if (feeResult.error) throw feeResult.error;
    if (paymentResult.error) throw paymentResult.error;
    parentRecordState.fees = feeResult.data || [];
    parentRecordState.payments = paymentResult.data || [];
  } else if (parentRecordState.view === "attendance") {
    const result = await client
      .from("attendance_records")
      .select(
        "id, status, created_at, student_id, attendance_id, attendance!inner(id,date,school_id,academic_year_id,term_id,class_id,subject_id,period_id,classes(name),academic_years(id,year_label),terms(id,name),subjects(name),periods(name))",
      )
      .eq("student_id", studentId)
      .order("created_at", { ascending: false });
    if (result.error) throw result.error;
    parentRecordState.attendance = result.data || [];
  } else {
    const result = await client
      .from("grade_records")
      .select(
        "id, student_id, score, remarks, created_at, grades!inner(id,status,school_id,academic_year_id,term_id,class_id,subject_id,assessment_id,date_recorded,classes(name),academic_years(id,year_label),terms(id,name),subjects(name),assessments(name),assessment_categories(name,marks))",
      )
      .eq("student_id", studentId)
      .eq("grades.status", "submitted")
      .order("created_at", { ascending: false });
    if (result.error) throw result.error;
    parentRecordState.grades = result.data || [];
  }

  const schoolIds = [
    ...new Set(
      [
        ...parentRecordState.fees.map((row) => row.school_id),
        ...parentRecordState.payments.map((row) => row.school_id),
        ...parentRecordState.attendance.map((row) => row.attendance?.school_id),
        ...parentRecordState.grades.map((row) => row.grades?.school_id),
      ].filter(Boolean),
    ),
  ];
  if (schoolIds.length) {
    const { data: schools, error } = await client
      .from("schools")
      .select("id,school_name")
      .in("id", schoolIds);
    if (error) console.error("Could not load parent school labels:", error);
    else parentRecordState.schools = buildParentSchoolMap(schools);
  }
}

function buildParentSchoolMap(schools) {
  return new Map(
    (schools || []).map((school) => [school.id, school.school_name]),
  );
}

function getParentRecordContext(row, type) {
  if (type === "fees")
    return {
      schoolId: row.school_id,
      yearId: row.academic_year_id,
      classId: row.class_id,
      termId: row.term_id,
      schoolName: parentRecordState.schools.get(row.school_id),
      yearName: row.academic_years?.year_label,
      className: row.classes?.name,
      termName: row.terms?.name,
    };
  if (type === "attendance") {
    const item = row.attendance || {};
    return {
      schoolId: item.school_id,
      yearId: item.academic_year_id,
      classId: item.class_id,
      termId: item.term_id,
      schoolName: parentRecordState.schools.get(item.school_id),
      yearName: item.academic_years?.year_label,
      className: item.classes?.name,
      termName: item.terms?.name,
      periodId: undefined,
      periodName: undefined,
    };
  }
  const item = row.grades || {};
  return {
    schoolId: item.school_id,
    yearId: item.academic_year_id,
    classId: item.class_id,
    termId: item.term_id,
    schoolName: parentRecordState.schools.get(item.school_id),
    yearName: item.academic_years?.year_label,
    className: item.classes?.name,
    termName: item.terms?.name,
    periodId: item.assessment_id,
    periodName: item.assessments?.name,
    subjectId: item.subject_id,
    subjectName: item.subjects?.name,
  };
}

function buildParentRecordFilters() {
  const type = parentRecordState.view;
  const rows =
    type === "fees"
      ? parentRecordState.fees
      : type === "attendance"
        ? parentRecordState.attendance
        : parentRecordState.grades;
  const context = rows.map((row) => getParentRecordContext(row, type));
  const filterSets = [
    ["recordSchoolFilter", "schoolId", "schoolName", "All schools"],
    ["recordYearFilter", "yearId", "yearName", "All academic years"],
    ["recordClassFilter", "classId", "className", "All classes"],
    ["recordTermFilter", "termId", "termName", "All semesters"],
  ];
  const periodFilterField = document.getElementById("recordPeriodFilterField");
  const subjectFilterField = document.getElementById("recordSubjectFilterField");
  periodFilterField.hidden = type !== "grades";
  subjectFilterField.hidden = type !== "grades";
  if (type === "grades") {
    filterSets.push(["recordPeriodFilter", "periodId", "periodName", "All periods"]);
    filterSets.push(["recordSubjectFilter", "subjectId", "subjectName", "All subjects"]);
  }
  filterSets.forEach(([selectId, idKey, labelKey, defaultLabel]) => {
    const select = document.getElementById(selectId);
    const selected = select.value;
    const options = new Map();
    context.forEach((row) => {
      if (row[idKey])
        options.set(
          String(row[idKey]),
          row[labelKey] ||
            (idKey === "schoolId"
              ? `School ${String(row[idKey]).slice(0, 8)}`
              : "Record"),
        );
    });
    select.replaceChildren(new Option(defaultLabel, ""));
    [...options.entries()]
      .sort((a, b) =>
        a[1].localeCompare(b[1], undefined, { sensitivity: "base" }),
      )
      .forEach(([id, label]) => select.add(new Option(label, id)));
    if (options.has(selected)) select.value = selected;
  });
}

function renderParentRecords() {
  const type = parentRecordState.view;
  const rows =
    type === "fees"
      ? parentRecordState.fees
      : type === "attendance"
        ? parentRecordState.attendance
        : parentRecordState.grades;
  const filters = {
    schoolId: document.getElementById("recordSchoolFilter").value,
    yearId: document.getElementById("recordYearFilter").value,
    classId: document.getElementById("recordClassFilter").value,
    termId: document.getElementById("recordTermFilter").value,
    periodId:
      type === "grades"
        ? document.getElementById("recordPeriodFilter").value
        : "",
    subjectId:
      type === "grades"
        ? document.getElementById("recordSubjectFilter").value
        : "",
  };
  const visible = rows.filter((row) => {
    const ctx = getParentRecordContext(row, type);
    return matchesParentRecordFilters(ctx, filters);
  });
  const content = document.getElementById("parentRecordsContent");
  content.setAttribute("aria-busy", "false");
  if (!visible.length) {
    const hasAny = rows.length > 0;
    content.innerHTML = `<p class="parent-empty">${hasAny ? "No records match these filters." : `No ${type === "fees" ? "fee or payment" : type} records are available for this student.`}</p>`;
    return;
  }
  if (type === "fees") content.innerHTML = renderFeesAndPayments(visible);
  else if (type === "attendance") content.innerHTML = renderAttendance(visible);
  else content.innerHTML = renderGrades(visible);
}

function matchesParentRecordFilters(context, filters) {
  return Object.entries(filters).every(
    ([key, value]) => !value || String(context[key] || "") === value,
  );
}

function parentStatusClass(status) {
  const normalized = String(status || "").trim().toLowerCase();
  if (["paid", "present", "completed"].includes(normalized)) return "status-success";
  if (["unpaid", "absent", "overdue"].includes(normalized)) return "status-danger";
  if (["partial", "late", "pending"].includes(normalized)) return "status-warning";
  if (["excused", "transferred"].includes(normalized)) return "status-info";
  return "status-neutral";
}

function renderFeesAndPayments(fees) {
  const feeIds = new Set(fees.map((fee) => fee.id));
  const payments = parentRecordState.payments.filter((payment) =>
    feeIds.has(payment.student_fee_id),
  );
  const feeRows = fees
    .map((fee) => {
      const breakdown = parseBreakdown(fee.fee_breakdown);
      const status = fee.status || "Unpaid";
      return `<tr><td>${parentEscape(getParentRecordContext(fee, "fees").schoolName || "-")}</td><td>${parentEscape(fee.academic_years?.year_label || "-")}</td><td>${parentEscape(fee.classes?.name || "-")}</td><td>${parentEscape(fee.terms?.name || "-")}</td><td>${breakdown.length ? `<ul>${breakdown.map((item) => `<li>${parentEscape(item.fee_name || "Fee item")}: ${parentMoney(item.amount)}</li>`).join("")}</ul>` : "-"}</td><td class="money">${parentMoney(fee.total_fees)}</td><td class="money">${parentMoney(fee.total_paid)}</td><td class="money">${parentMoney(fee.balance)}</td><td><span class="status-pill ${parentStatusClass(status)}">${parentEscape(status)}</span></td></tr>`;
    })
    .join("");
  const paymentRows = payments
    .map(
      (payment) =>
        `<tr><td>${parentDate(payment.created_at)}</td><td>${parentEscape(payment.payment_method || "Cash / Other")}</td><td>${parentEscape(payment.reference_number || "-")}</td><td>${parentEscape(payment.notes || "-")}</td><td class="money">${parentMoney(payment.amount)}</td></tr>`,
    )
    .join("");
  return `<h3>Fee balances</h3><table><thead><tr><th>School</th><th>Academic year</th><th>Class</th><th>Semester</th><th>Fee items</th><th>Total</th><th>Paid</th><th>Balance</th><th>Status</th></tr></thead><tbody>${feeRows}</tbody></table><h3>Payment history</h3>${payments.length ? `<table><thead><tr><th>Date</th><th>Method</th><th>Reference</th><th>Note</th><th>Amount</th></tr></thead><tbody>${paymentRows}</tbody></table>` : '<p class="parent-empty">No payments are recorded for the selected fees.</p>'}`;
}

function renderAttendance(records) {
  return `<table><thead><tr><th>Date</th><th>School</th><th>Academic year</th><th>Semester</th><th>Class</th><th>Subject</th><th>Period</th><th>Status</th></tr></thead><tbody>${records
    .map((row) => {
      const session = row.attendance || {};
      const ctx = getParentRecordContext(row, "attendance");
      const status = row.status || "-";
      return `<tr><td>${parentDate(session.date)}</td><td>${parentEscape(ctx.schoolName || "-")}</td><td>${parentEscape(ctx.yearName || "-")}</td><td>${parentEscape(ctx.termName || "-")}</td><td>${parentEscape(ctx.className || "-")}</td><td>${parentEscape(session.subjects?.name || "-")}</td><td>${parentEscape(session.periods?.name || "-")}</td><td><span class="status-pill ${parentStatusClass(status)}">${parentEscape(status)}</span></td></tr>`;
    })
    .join("")}</tbody></table>`;
}

function renderGrades(records) {
  return `<table><thead><tr><th>Date</th><th>School</th><th>Academic year</th><th>Semester</th><th>Class</th><th>Subject</th><th>Assessment</th><th>Category</th><th>Score</th><th>Maximum</th></tr></thead><tbody>${records
    .map((row) => {
      const grade = row.grades || {};
      const ctx = getParentRecordContext(row, "grades");
      return `<tr><td>${parentDate(grade.date_recorded || row.created_at)}</td><td>${parentEscape(ctx.schoolName || "-")}</td><td>${parentEscape(ctx.yearName || "-")}</td><td>${parentEscape(ctx.termName || "-")}</td><td>${parentEscape(ctx.className || "-")}</td><td>${parentEscape(grade.subjects?.name || "-")}</td><td>${parentEscape(grade.assessments?.name || "-")}</td><td>${parentEscape(grade.assessment_categories?.name || "-")}</td><td>${parentEscape(row.score ?? "-")}</td><td>${parentEscape(grade.assessment_categories?.marks ?? "-")}</td></tr>`;
    })
    .join("")}</tbody></table>`;
}

function parseBreakdown(value) {
  if (!value) return [];
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parentMoney(value) {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: "USD",
      }).format(amount)
    : "-";
}

function parentDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "-"
    : date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
}

function parentEscape(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
}

function showParentRecordsMessage(message, isError = false) {
  document.getElementById("recordStudentName").textContent = "Choose a student";
  document.getElementById("recordStudentDetails").textContent =
    "Your selection is checked against your active parent links.";
  const content = document.getElementById("parentRecordsContent");
  content.setAttribute("aria-busy", "false");
  content.innerHTML = `<p class="parent-empty ${isError ? "parent-error" : ""}">${parentEscape(message)}<br><a href="parent-dashboard.html">Go to your dashboard</a></p>`;
}
