const parentRecordStorageKey = "tHubParentSelectedStudentId";
const parentRecordViews = new Set([
  "fees",
  "attendance",
  "grades",
  "timetable",
]);
let parentRecordState = {
  view: "fees",
  fees: [],
  payments: [],
  attendance: [],
  grades: [],
  gradeCreators: new Map(),
  timetable: null,
  timetableLessons: [],
  student: null,
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
    timetable: "Class timetable",
  }[parentRecordState.view];

  document
    .getElementById("parentSignOut")
    ?.addEventListener("click", async () => {
      window.clearAuthContext?.();
      await client.auth.signOut();
      sessionStorage.removeItem(parentRecordStorageKey);
      window.location.replace("/index.html");
    });

  try {
    const authCtx =
      typeof window.getAuthContext === "function"
        ? await window.getAuthContext()
        : null;
    let user = authCtx?.user;
    let profile = authCtx?.profile;

    if (!user) {
      const { data, error: authError } = await client.auth.getUser();
      if (authError || !data?.user) {
        window.location.replace("/index.html");
        return;
      }
      user = data.user;
    }

    if (!profile) {
      const { data, error: profileError } = await client
        .from("profiles")
        .select("id, full_name, role, status")
        .eq("id", user.id)
        .single();
      if (profileError) throw profileError;
      profile = data;
    }

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
      .select(
        "id, student_id, school_id, class_id, classes:class_id(name), schools:school_id(id, school_name), profiles(full_name, photo_url)",
      )
      .eq("id", selectedStudentId)
      .single();
    if (studentError) throw studentError;
    parentRecordState.student = student;
    document.getElementById("recordStudentName").textContent =
      student.profiles?.full_name || "Student";
    setRecordStudentPhoto(
      document.getElementById("recordStudentPhoto"),
      student.profiles?.photo_url,
      student.profiles?.full_name || "Student",
    );
    document.getElementById("recordStudentDetails").textContent =
      `Student ID: ${student.student_id || "Not assigned"}`;

    await loadParentRecordData(client, selectedStudentId, student);
    document.getElementById("recordFilters").hidden = false;
    buildParentRecordFilters();
    [
      "recordSchoolFilter",
      "recordYearFilter",
      "recordClassFilter",
      "recordTermFilter",
      "recordPeriodFilter",
      "recordSubjectFilter",
      "recordDayFilter",
    ].forEach((id) => {
      document
        .getElementById(id)
        ?.addEventListener("change", renderParentRecords);
    });
    renderParentRecords();
  } catch (error) {
    showParentRecordsMessage(
      "Unable to load student records at this time. Please try again later or contact school administration.",
      true,
    );
  }
}

async function loadParentRecordData(
  client,
  studentId,
  student = parentRecordState.student,
) {
  if (parentRecordState.view === "timetable") {
    parentRecordState.timetable = null;
    parentRecordState.timetableLessons = [];
    if (!student?.class_id || !student?.school_id) return;

    const { data: timetable, error: timetableError } = await client
      .from("timetables")
      .select(
        "id, status, academic_year_id, academic_years:academic_year_id(year_label)",
      )
      .eq("class_id", student.class_id)
      .eq("school_id", student.school_id)
      .ilike("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (timetableError) throw timetableError;
    if (!timetable) return;

    const { data: lessons, error: lessonsError } = await client
      .from("timetable_lessons")
      .select(
        "id, day_of_week, is_break, period_id, subject_id, periods:period_id(name,start_time,end_time), subjects:subject_id(name)",
      )
      .eq("timetable_id", timetable.id);
    if (lessonsError) throw lessonsError;
    parentRecordState.timetable = timetable;
    parentRecordState.timetableLessons = lessons || [];
  } else if (parentRecordState.view === "fees") {
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
          `id, student_id, school_id, amount, payment_method, reference_number, notes, created_at, student_fee_id,
            payment_allocations (
              id,
              item_name,
              amount,
              fee_item_id
            )`,
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
        "id, status, created_at, student_id, attendance_id, attendance!inner(id,date,school_id,academic_year_id,term_id,class_id,subject_id,period_id,teacher_id,classes(name),academic_years(id,year_label),terms(id,name),subjects(name),periods(name),schools:school_id(id,school_name),profiles:teacher_id(full_name,role,teachers(staff_id)))",
      )
      .eq("student_id", studentId)
      .order("created_at", { ascending: false });
    if (result.error) throw result.error;
    parentRecordState.attendance = result.data || [];
  } else {
    // --- GRADES VIEW BLOCK ---
    const result = await client
      .from("grade_records")
      .select(
        `
          id,
          student_id,
          score,
          remarks,
          created_at,
          grades!inner (
            id,
            status,
            school_id,
            academic_year_id,
            term_id,
            class_id,
            subject_id,
            assessment_id,
            date_recorded,
            created_by,
            classes ( id, name ),
            subjects ( id, name ),
            terms ( id, name ), schools:school_id ( id, school_name ),
            academic_years ( id, year_label ),
            assessments ( id, name, maximum_marks ),
            assessment_categories ( id, name, marks )
          )
        `,
      )
      .eq("student_id", studentId)
      .eq("grades.status", "submitted")
      .order("created_at", { ascending: false });

    if (result.error) throw result.error;
    parentRecordState.grades = result.data || [];

    const creatorIds = [
      ...new Set(
        (parentRecordState.grades || [])
          .map((row) => row.grades?.created_by)
          .filter(Boolean)
          .map((id) => String(id)),
      ),
    ];

    parentRecordState.gradeCreators = new Map();
    if (creatorIds.length) {
      const { data: creators, error: creatorsError } = await client
        .from("profiles")
        .select("id, full_name, role, teachers(staff_id)")
        .in("id", creatorIds);

      if (creatorsError) {
        console.error("Could not load grade creators:", creatorsError);
      } else {
        for (const p of creators || []) {
          if (p?.id) parentRecordState.gradeCreators.set(String(p.id), p);
        }
      }
    }
  } // <--- THIS CLOSES THE `else` BLOCK FOR GRADES PROPERLY

  // --- COMMON SCHOOL MAP RESOLUTION (Runs for all views safely) ---
  const schoolIds = [
    ...new Set(
      [
        ...(parentRecordState.fees || []).map((row) => row.school_id),
        ...(parentRecordState.payments || []).map((row) => row.school_id),
        ...(parentRecordState.attendance || []).map(
          (row) => row.attendance?.school_id,
        ),
        ...(parentRecordState.grades || []).map((row) => row.grades?.school_id),
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

  if (student?.school_id && student.schools?.school_name) {
    if (!parentRecordState.schools) parentRecordState.schools = new Map();
    parentRecordState.schools.set(
      String(student.school_id),
      student.schools.school_name,
    );
  }

  for (const row of parentRecordState.attendance || []) {
    const s = row.attendance?.schools;
    if (s?.id && s.school_name) {
      parentRecordState.schools.set(String(s.id), s.school_name);
    }
  }
  for (const row of parentRecordState.grades || []) {
    const s = row.grades?.schools;
    if (s?.id && s.school_name) {
      parentRecordState.schools.set(String(s.id), s.school_name);
    }
  }
}

function buildParentSchoolMap(schools) {
  return new Map(
    (schools || [])
      .filter((s) => s?.id && s.school_name)
      .map((s) => [String(s.id), s.school_name]),
  );
}

function setRecordStudentPhoto(shell, photoUrl, name) {
  if (!shell) return;
  const image = shell.querySelector("img");
  const initials = shell.querySelector(".parent-student-avatar-initials");
  const firstLetters = String(name || "Student")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  if (initials) initials.textContent = firstLetters || "S";
  if (!image) return;
  image.alt = `${name || "Student"} photo`;
  image.hidden = true;
  image.removeAttribute("src");
  if (photoUrl) {
    try {
      const parsedPhotoUrl = new URL(photoUrl, window.location.href);
      if (["https:", "http:"].includes(parsedPhotoUrl.protocol)) {
        image.src = parsedPhotoUrl.href;
        image.hidden = false;
      }
    } catch {
      // Keep the initials placeholder when a profile photo URL is invalid.
    }
  }
  image.onerror = () => {
    image.onerror = null;
    image.hidden = true;
    image.removeAttribute("src");
  };
}

function getParentRecordContext(row, type) {
  const currentSchoolName = parentRecordState.student?.schools?.school_name;
  const currentSchoolId = parentRecordState.student?.school_id
    ? String(parentRecordState.student.school_id)
    : null;

  const resolveSchool = (schoolId, nestedSchool) => {
    if (nestedSchool?.school_name) return nestedSchool.school_name;
    const key = schoolId ? String(schoolId) : null;
    if (key && parentRecordState.schools.has(key)) {
      return parentRecordState.schools.get(key);
    }
    // Only use current school when id matches or is missing — not for other schools
    if (!key || key === currentSchoolId) {
      return currentSchoolName || undefined;
    }
    return undefined;
  };

  if (type === "fees")
    return {
      schoolId: row.school_id,
      yearId: row.academic_year_id,
      classId: row.class_id,
      termId: row.term_id,
      schoolName: resolveSchool(row.school_id),
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
      schoolName: resolveSchool(item.school_id, item.schools),
      yearName: item.academic_years?.year_label,
      className: item.classes?.name,
      termName: item.terms?.name,
      periodId: undefined,
      periodName: undefined,
      subjectId: item.subject_id,
      subjectName: item.subjects?.name,
    };
  }
  const item = row.grades || {};
  return {
    schoolId: item.school_id,
    yearId: item.academic_year_id,
    classId: item.class_id,
    termId: item.term_id,
    schoolName: resolveSchool(item.school_id, item.schools),
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
  const schoolField = document.getElementById("recordSchoolFilterField");
  const yearField = document.getElementById("recordYearFilterField");
  const classField = document.getElementById("recordClassFilterField");
  const termField = document.getElementById("recordTermFilterField");
  const periodFilterField = document.getElementById("recordPeriodFilterField");
  const subjectFilterField = document.getElementById(
    "recordSubjectFilterField",
  );
  const dayFilterField = document.getElementById("recordDayFilterField");

  if (type === "timetable") {
    if (schoolField) schoolField.hidden = true;
    if (yearField) yearField.hidden = true;
    if (classField) classField.hidden = true;
    if (termField) termField.hidden = true;
    if (periodFilterField) periodFilterField.hidden = true;
    if (subjectFilterField) subjectFilterField.hidden = true;
    if (dayFilterField) dayFilterField.hidden = false;

    const daySelect = document.getElementById("recordDayFilter");
    if (daySelect) {
      const selected = daySelect.value;
      const days = [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ];
      const normalizedDay = (value) =>
        String(value || "")
          .trim()
          .toLowerCase();
      const dayRank = (value) => {
        const index = days.findIndex(
          (day) => day.toLowerCase() === normalizedDay(value),
        );
        return index < 0 ? days.length : index;
      };

      const uniqueDays = [
        ...new Set(
          (parentRecordState.timetableLessons || [])
            .map((lesson) => lesson.day_of_week)
            .filter(Boolean),
        ),
      ].sort((a, b) => dayRank(a) - dayRank(b));

      daySelect.replaceChildren(new Option("All days", ""));
      uniqueDays.forEach((day) => {
        daySelect.add(new Option(day, day));
      });
      if (uniqueDays.includes(selected)) {
        daySelect.value = selected;
      }
    }
    return;
  }

  if (dayFilterField) dayFilterField.hidden = true;
  if (schoolField) schoolField.hidden = false;
  if (yearField) yearField.hidden = false;
  if (classField) classField.hidden = false;
  if (termField) termField.hidden = false;
  if (periodFilterField) periodFilterField.hidden = type !== "grades";
  if (subjectFilterField) subjectFilterField.hidden = type === "fees";

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
  if (type === "grades") {
    filterSets.push([
      "recordPeriodFilter",
      "periodId",
      "periodName",
      "All periods",
    ]);
  }
  if (type === "grades" || type === "attendance")
    filterSets.push([
      "recordSubjectFilter",
      "subjectId",
      "subjectName",
      "All subjects",
    ]);
  filterSets.forEach(([selectId, idKey, labelKey, defaultLabel]) => {
    const select = document.getElementById(selectId);
    if (!select) return;
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
  const content = document.getElementById("parentRecordsContent");
  if (type === "timetable") {
    content.setAttribute("aria-busy", "false");
    content.innerHTML = renderParentTimetable();
    return;
  }
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
      type !== "fees"
        ? document.getElementById("recordSubjectFilter").value
        : "",
  };
  const visible = rows.filter((row) => {
    const ctx = getParentRecordContext(row, type);
    return matchesParentRecordFilters(ctx, filters);
  });
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

function renderParentTimetable() {
  const { timetable, timetableLessons, student } = parentRecordState;
  if (!student?.class_id) {
    return '<p class="parent-empty">This student is not currently assigned to a class.</p>';
  }
  if (!timetable) {
    return '<p class="parent-empty">There is no active timetable for this student’s class yet.</p>';
  }
  if (!timetableLessons.length) {
    return '<p class="parent-empty">The active class timetable has no lessons yet.</p>';
  }

  const days = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];
  const normalizedDay = (value) =>
    String(value || "")
      .trim()
      .toLowerCase();
  const dayRank = (value) => {
    const index = days.findIndex(
      (day) => day.toLowerCase() === normalizedDay(value),
    );
    return index < 0 ? days.length : index;
  };
  const lessons = [...timetableLessons].sort(
    (a, b) =>
      dayRank(a.day_of_week) - dayRank(b.day_of_week) ||
      String(a.periods?.start_time || "").localeCompare(
        String(b.periods?.start_time || ""),
      ),
  );
  const selectedDay = document.getElementById("recordDayFilter")?.value;
  const filteredLessons = selectedDay
    ? lessons.filter(
        (lesson) =>
          normalizedDay(lesson.day_of_week) === normalizedDay(selectedDay),
      )
    : lessons;

  const className = student.classes?.name || "Student’s class";
  const yearLabel = timetable.academic_years?.year_label;
  const summary = `<p class="parent-timetable-summary"><strong>${parentEscape(className)}</strong>${yearLabel ? ` · ${parentEscape(yearLabel)}` : ""}</p>`;

  if (!filteredLessons.length) {
    return `${summary}<p class="parent-empty">No lessons scheduled for ${parentEscape(selectedDay)}.</p>`;
  }

  const rows = filteredLessons
    .map((lesson) => {
      const period = lesson.periods || {};
      const isBreak =
        lesson.is_break === true ||
        lesson.is_break === "true" ||
        (!lesson.subject_id && !lesson.subjects?.name);
      const subject = isBreak
        ? period.name || "Break"
        : lesson.subjects?.name || "Subject to be announced";
      const time =
        [period.start_time, period.end_time]
          .filter(Boolean)
          .map((value) => parentEscape(value))
          .join(" – ") || "-";
      return `<tr><td>${parentEscape(lesson.day_of_week || "-")}</td><td>${parentEscape(period.name || "-")}</td><td>${time}</td><td>${parentEscape(subject)}</td></tr>`;
    })
    .join("");

  return `${summary}<div class="parent-table-container"><table><thead><tr><th>Day</th><th>Period</th><th>Time</th><th>Subject</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function matchesParentRecordFilters(context, filters) {
  return Object.entries(filters).every(
    ([key, value]) => !value || String(context[key] || "") === value,
  );
}

function parentStatusClass(status) {
  const normalized = String(status || "")
    .trim()
    .toLowerCase();
  if (["paid", "present", "completed"].includes(normalized))
    return "status-success";
  if (["unpaid", "absent", "overdue"].includes(normalized))
    return "status-danger";
  if (["partial", "late", "pending"].includes(normalized))
    return "status-warning";
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
    .map((payment) => {
      const allocations = Array.isArray(payment.payment_allocations)
        ? payment.payment_allocations
        : [];
      const allocationsHtml = allocations.length
        ? `<ul>${allocations
            .map(
              (alloc) =>
                `<li>${parentEscape(alloc.item_name || "Fee item")}: <strong>${parentMoney(alloc.amount)}</strong></li>`,
            )
            .join("")}</ul>`
        : '<span style="color: #60708a; font-style: italic;">General payment</span>';

      return `<tr><td>${parentDate(payment.created_at)}</td><td>${parentEscape(payment.payment_method || "Cash / Other")}</td><td>${payment.reference_number ? `<code>${parentEscape(payment.reference_number)}</code>` : "-"}</td><td>${allocationsHtml}</td><td>${parentEscape(payment.notes || "-")}</td><td class="money">${parentMoney(payment.amount)}</td></tr>`;
    })
    .join("");
  return `<h3>Fee balances</h3><div class="parent-table-container"><table><thead><tr><th>School</th><th>Academic year</th><th>Class</th><th>Semester</th><th>Fee items</th><th>Total</th><th>Paid</th><th>Balance</th><th>Status</th></tr></thead><tbody>${feeRows}</tbody></table></div><h3>Payment history</h3>${payments.length ? `<div class="parent-table-container"><table><thead><tr><th>Date</th><th>Method</th><th>Reference</th><th>Allocated items</th><th>Note</th><th>Amount</th></tr></thead><tbody>${paymentRows}</tbody></table></div>` : '<p class="parent-empty">No payments are recorded for the selected fees.</p>'}`;
}

function renderAttendanceStats(records) {
  const total = records.length;
  let present = 0;
  let absent = 0;
  let late = 0;
  let excused = 0;

  records.forEach((row) => {
    const status = String(row.status || "")
      .trim()
      .toLowerCase();
    if (status === "present") present++;
    else if (status === "absent") absent++;
    else if (status === "late") late++;
    else if (status === "excused") excused++;
  });

  const rate = total > 0 ? Math.round((present / total) * 100) : 0;
  const rateClass =
    rate >= 85 ? "text-success" : rate >= 70 ? "text-warning" : "text-danger";

  return `
    <div class="parent-stats-grid">
      <div class="parent-stat-card">
        <span class="parent-stat-label">Attendance rate</span>
        <span class="parent-stat-value ${rateClass}">${rate}%</span>
        <span class="parent-stat-sub">${present} of ${total} recorded sessions</span>
      </div>
      <div class="parent-stat-card">
        <span class="parent-stat-label">Present</span>
        <span class="parent-stat-value text-success">${present}</span>
        <span class="parent-stat-sub">Sessions attended</span>
      </div>
      <div class="parent-stat-card">
        <span class="parent-stat-label">Absent</span>
        <span class="parent-stat-value text-danger">${absent}</span>
        <span class="parent-stat-sub">Missed sessions</span>
      </div>
    </div>
  `;
}

function renderAttendance(records) {
  const statsHtml = renderAttendanceStats(records);
  const rows = records
    .map((row) => {
      const session = row.attendance || {};
      const ctx = getParentRecordContext(row, "attendance");
      const status = row.status || "-";
      return `<tr><td>${parentDate(session.date)}</td><td>${parentEscape(ctx.schoolName || "-")}</td><td>${parentEscape(ctx.yearName || "-")}</td><td>${parentEscape(ctx.termName || "-")}</td><td>${parentEscape(ctx.className || "-")}</td><td>${parentEscape(session.subjects?.name || "-")}</td><td>${parentEscape(session.periods?.name || "-")}</td><td>${renderParentRecordAuthor(session.profiles)}</td><td><span class="status-pill ${parentStatusClass(status)}">${parentEscape(status)}</span></td></tr>`;
    })
    .join("");

  return `
    ${statsHtml}
    <h3>Attendance history</h3>
    <div class="parent-table-container">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>School</th>
            <th>Academic year</th>
            <th>Semester</th>
            <th>Class</th>
            <th>Subject</th>
            <th>Period</th>
            <th>Entered by</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function renderGradesStats(records) {
  let totalScore = 0;
  let totalMax = 0;
  let validCount = 0;
  let sumPercentages = 0;
  let highestPct = -1;
  let passedCount = 0;

  records.forEach((row) => {
    const score = Number(row.score);
    const maxMarks = Number(row.grades?.assessment_categories?.marks);

    if (Number.isFinite(score) && Number.isFinite(maxMarks) && maxMarks > 0) {
      const pct = (score / maxMarks) * 100;
      totalScore += score;
      totalMax += maxMarks;
      sumPercentages += pct;
      validCount++;
      if (pct > highestPct) highestPct = pct;
      if (pct >= 60) passedCount++;
    } else if (Number.isFinite(score)) {
      totalScore += score;
    }
  });

  const avgPct =
    totalMax > 0
      ? (totalScore / totalMax) * 100
      : validCount > 0
        ? sumPercentages / validCount
        : 0;

  const letterGrade =
    avgPct >= 90
      ? "A"
      : avgPct >= 80
        ? "B"
        : avgPct >= 70
          ? "C"
          : avgPct >= 60
            ? "D"
            : "F";

  const gradeClass =
    avgPct >= 80
      ? "text-success"
      : avgPct >= 60
        ? "text-warning"
        : "text-danger";

  return `
    <div class="parent-stats-grid">
      <div class="parent-stat-card">
        <span class="parent-stat-label">Average score</span>
        <span class="parent-stat-value ${gradeClass}">${validCount > 0 ? avgPct.toFixed(1) + "%" : "-"}</span>
        <span class="parent-stat-sub">${validCount > 0 ? `Grade ${letterGrade} performance` : "No scores yet"}</span>
      </div>
      <div class="parent-stat-card">
        <span class="parent-stat-label">Total points</span>
        <span class="parent-stat-value text-primary">${totalScore}${totalMax > 0 ? ` <small style="font-size:1rem;color:#8b99ad;">/ ${totalMax}</small>` : ""}</span>
        <span class="parent-stat-sub">Cumulative marks scored</span>
      </div>
      <div class="parent-stat-card">
        <span class="parent-stat-label">Assessments</span>
        <span class="parent-stat-value">${records.length}</span>
        <span class="parent-stat-sub">${validCount > 0 ? `${passedCount} of ${validCount} passed (≥60%)` : "Recorded grades"}</span>
      </div>
      <div class="parent-stat-card">
        <span class="parent-stat-label">Highest mark</span>
        <span class="parent-stat-value text-success">${highestPct >= 0 ? highestPct.toFixed(1) + "%" : "-"}</span>
        <span class="parent-stat-sub">Top assessment result</span>
      </div>
    </div>
  `;
}

function renderGrades(records) {
  const statsHtml = renderGradesStats(records);
  const rows = records
    .map((row) => {
      const grade = row.grades || {};
      const ctx = getParentRecordContext(row, "grades");
      const creatorId = grade.created_by ? String(grade.created_by) : null;
      const creator =
        (creatorId && parentRecordState.gradeCreators?.get(creatorId)) || null;
      return `<tr><td>${parentDate(grade.date_recorded || row.created_at)}</td><td>${parentEscape(ctx.schoolName || "-")}</td><td>${parentEscape(ctx.yearName || "-")}</td><td>${parentEscape(ctx.termName || "-")}</td><td>${parentEscape(ctx.className || "-")}</td><td>${parentEscape(grade.subjects?.name || "-")}</td><td>${parentEscape(grade.assessments?.name || "-")}</td><td>${parentEscape(grade.assessment_categories?.name || "-")}</td><td>${renderParentRecordAuthor(creator, creatorId)}</td><td>${parentEscape(row.score ?? "-")}</td><td>${parentEscape(grade.assessment_categories?.marks ?? "-")}</td></tr>`;
    })
    .join("");

  return `
    ${statsHtml}
    <h3>Grade records</h3>
    <div class="parent-table-container">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>School</th>
            <th>Academic year</th>
            <th>Semester</th>
            <th>Class</th>
            <th>Subject</th>
            <th>Assessment</th>
            <th>Category</th>
            <th>Entered by</th>
            <th>Score</th>
            <th>Maximum</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function renderParentRecordAuthor(profile, profileId) {
  if (!profile && profileId && parentRecordState.gradeCreators?.size) {
    profile = parentRecordState.gradeCreators.get(String(profileId)) || null;
  }
  if (!profile) {
    return `<span class="table-muted">Unknown</span>`;
  }
  const name = parentEscape(profile.full_name || "Unknown");
  const role = profile.role
    ? parentEscape(
        String(profile.role).charAt(0).toUpperCase() +
          String(profile.role).slice(1).toLowerCase(),
      )
    : null;
  const staffId = profile.teachers?.staff_id
    ? parentEscape(profile.teachers.staff_id)
    : null;

  const meta = [role, staffId].filter(Boolean).join(" · ");
  if (meta) {
    return `<span class="parent-record-author"><strong>${name}</strong><small>${meta}</small></span>`;
  }
  return `<span class="parent-record-author"><strong>${name}</strong></span>`;
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
  const filters = document.getElementById("recordFilters");
  if (filters) filters.hidden = true;
  const content = document.getElementById("parentRecordsContent");
  content.setAttribute("aria-busy", "false");
  content.innerHTML = `<p class="parent-empty ${isError ? "parent-error" : ""}">${parentEscape(message)}<br><a href="parent-dashboard.html">Go to your dashboard</a></p>`;
}
