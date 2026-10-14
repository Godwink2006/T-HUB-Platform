import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const jsPath = path.join(projectRoot, "js", "parent-records.js");
const sqlPath = path.join(projectRoot, "supabase", "parent_portal_data_access.sql");
const attendanceFixPath = path.join(projectRoot, "supabase", "parent_portal_attendance_recursion_fix.sql");
const contextFixPath = path.join(projectRoot, "supabase", "parent_portal_context_performance_fix.sql");

async function loadParentRecordHelpers() {
  const source = await readFile(jsPath, "utf8");
  const context = vm.createContext({ document: { addEventListener() {} }, Intl, URLSearchParams });
  vm.runInContext(`${source}\nglobalThis.helpers = { parentEscape, parseBreakdown, renderFeesAndPayments, buildParentSchoolMap, getParentRecordContext, matchesParentRecordFilters, parentStatusClass, parentRecordState };`, context);
  return context.helpers;
}

test("invitation student search matches names and student IDs without case sensitivity", async () => {
  const source = await readFile(path.join(projectRoot, "js", "parent-invitations.js"), "utf8");
  const context = vm.createContext({ document: { addEventListener() {} } });
  vm.runInContext(`${source}\nglobalThis.filterStudents = filterParentInviteStudents;`, context);
  const students = [
    { student_id: "ST-1010", profiles: { full_name: "Wilkin Rugs" } },
    { student_id: "ST-2044", profiles: { full_name: "Thomas Boimah" } },
  ];
  assert.equal(context.filterStudents(students, "wilkin").length, 1);
  assert.equal(context.filterStudents(students, "st-2044").length, 1);
  assert.equal(context.filterStudents(students, "missing").length, 0);
  assert.equal(context.filterStudents(students, "").length, 2);
});
test("linked parent search matches parent, email, student, and student ID", async () => {
  const source = await readFile(path.join(projectRoot, "js", "parent-invitations.js"), "utf8");
  const context = vm.createContext({ document: { addEventListener() {} } });
  vm.runInContext(`${source}\nglobalThis.matchesLink = matchesParentLinkSearch;`, context);
  const link = { parent_name: "Momodu Kamara", parent_email: "momodu@example.com", student_name: "Wilkin Rugs", student_code: "ST-1010" };
  assert.equal(context.matchesLink(link, "momodu"), true);
  assert.equal(context.matchesLink(link, "EXAMPLE.COM"), true);
  assert.equal(context.matchesLink(link, "wilkin"), true);
  assert.equal(context.matchesLink(link, "st-1010"), true);
  assert.equal(context.matchesLink(link, "not here"), false);
});
test("parent unlink confirmation uses a styled accessible dialog instead of a browser popup", async () => {
  const html = await readFile(path.join(projectRoot, "html", "parent-invitations.html"), "utf8");
  const source = await readFile(path.join(projectRoot, "js", "parent-invitations.js"), "utf8");
  const css = await readFile(path.join(projectRoot, "css", "parent-portal.css"), "utf8");
  assert.match(html, /<dialog id="parentUnlinkDialog"/);
  assert.match(html, /aria-labelledby="parentUnlinkTitle" aria-describedby="parentUnlinkMessage"/);
  assert.match(source, /dialog\.showModal\(\)/);
  assert.match(source, /function setupParentUnlinkDialog\(\)[\s\S]*?event\.target === dialog\) dialog\.close\("cancel"\)/);
  assert.match(source, /setupParentUnlinkDialog\(\);\s*\n\s*const client/);
  assert.doesNotMatch(source, /window\.confirm/);
  assert.match(css, /\.parent-portal \.parent-link-row \{\s*border-radius: 9px;/s);
  assert.match(css, /\.parent-portal \.parent-link-row button,/);
  assert.match(css, /\.parent-unlink-cancel \{ background: #1f2937; border: 2px solid #1f2937; color: #fff; \}/);
});
test("parent dashboard shows announcements for parents, students, and everyone only", async () => {
  const source = await readFile(path.join(projectRoot, "js", "parent-dashboard.js"), "utf8");
  const context = vm.createContext({ document: { addEventListener() {} } });
  vm.runInContext(`${source}\nglobalThis.isVisible = isParentAnnouncementVisible;`, context);
  assert.equal(context.isVisible({ target_audience: "All" }), true);
  assert.equal(context.isVisible({ target_audience: "Students, Teachers" }), true);
  assert.equal(context.isVisible({ target_audience: "Parents" }), true);
  assert.equal(context.isVisible({ target_audience: "Teachers, Accountants" }), false);
});
test("parent link management is staff-authorized and school-scoped server-side", async () => {
  const source = await readFile(path.join(projectRoot, "supabase", "functions", "manage-parent-links", "index.ts"), "utf8");
  assert.match(source, /\["admin", "accountant"\]\.includes\(staff\.role\)/);
  assert.match(source, /\.eq\("school_id", staff\.school_id\)/);
  assert.match(source, /status: "revoked"/);
  assert.doesNotMatch(source, /\.delete\(\)/);
});
test("parent announcement policy is additive and only exposes linked-school audiences", async () => {
  const source = await readFile(path.join(projectRoot, "supabase", "parent_portal_announcements_policy.sql"), "utf8");
  assert.match(source, /create policy "parent_portal_announcements_linked_students_select"/i);
  assert.match(source, /link\.parent_user_id = \(select auth\.uid\(\)\)/);
  assert.match(source, /link\.school_id = announcements\.school_id/);
  assert.match(source, /link\.status = 'active'/);
  assert.match(source, /'students'.*'parent'.*'parents'/s);
  assert.doesNotMatch(source, /drop policy if exists .*on public\.(?!announcements)/i);
});
test("finance filters match student search, term, class, academic year, and status", async () => {
  const source = await readFile(path.join(projectRoot, "js", "payment.js"), "utf8");
  const functionSource = source.match(/function matchesFinanceFeeFilters\(row, filters\) \{[\s\S]*?\n\}/)?.[0];
  assert.ok(functionSource, "finance filter matcher exists");
  const context = vm.createContext({});
  vm.runInContext(`${functionSource}\nglobalThis.matches = matchesFinanceFeeFilters;`, context);
  const row = {
    studentName: "Wilkin Rugs", studentCode: "ST-1010", termId: "term-a",
    classId: "class-9", yearId: "year-26", fee: { status: "Partial" },
  };
  const base = { search: "wilkin", term: "term-a", classId: "class-9", year: "year-26", status: "Partial" };
  assert.equal(context.matches(row, base), true);
  assert.equal(context.matches(row, { ...base, search: "ST-1010" }), true);
  assert.equal(context.matches(row, { ...base, term: "term-b" }), false);
  assert.equal(context.matches(row, { ...base, classId: "class-8" }), false);
  assert.equal(context.matches(row, { ...base, year: "year-25" }), false);
  assert.equal(context.matches(row, { ...base, status: "Paid" }), false);
});
test("finance loads only current-school fee rows, not transferred fee history", async () => {
  const source = await readFile(path.join(projectRoot, "js", "payment.js"), "utf8");
  const loadFunction = source.match(/async function loadStudentFees\(\) \{[\s\S]*?\n\}/)?.[0];
  assert.ok(loadFunction, "finance fee loader exists");
  assert.match(loadFunction, /\.eq\("school_id", schoolId\)/);
  assert.doesNotMatch(source, /get_school_transfer_fee_history|mapTransferredFeeHistoryRecord/);
});
test("finance maps profile name, photo, and student ID through the student relation", async () => {
  const source = await readFile(path.join(projectRoot, "js", "payment.js"), "utf8");
  const functionSource = source.match(/function mapCurrentFinanceFeeRecords\([\s\S]*?\) \{[\s\S]*?\n\}/)?.[0];
  assert.ok(functionSource, "current fee row mapper exists");
  const context = vm.createContext({});
  vm.runInContext(`${functionSource}\nglobalThis.map = mapCurrentFinanceFeeRecords;`, context);

  const rows = context.map(
    [{ id: "fee-1", student_id: "student-a", status: "Paid" }],
    {
      "student-a": {
        student_id: "ST-102",
        profiles: { full_name: "John Kenneh", photo_url: "/student.jpg" },
      },
    },
    {},
  );

  assert.equal(rows[0].studentName, "John Kenneh");
  assert.equal(rows[0].studentCode, "ST-102");
  assert.equal(rows[0].studentPhoto, "/student.jpg");
});
test("finance uses enrollment snapshots as a fallback for current fee rows", async () => {
  const source = await readFile(path.join(projectRoot, "js", "payment.js"), "utf8");
  const functionSource = source.match(/function mapCurrentFinanceFeeRecords\([\s\S]*?\) \{[\s\S]*?\n\}/)?.[0];
  assert.ok(functionSource, "current fee row mapper exists");
  const context = vm.createContext({});
  vm.runInContext(`${functionSource}\nglobalThis.map = mapCurrentFinanceFeeRecords;`, context);

  const rows = context.map(
    [{ id: "fee-1", student_id: "transferred-student" }],
    {},
    { "transferred-student": { student_name_snapshot: "Snapshot Student", student_code_snapshot: "ST-200", student_photo_snapshot: "/snapshot.jpg" } },
    {},
  );

  assert.equal(rows[0].studentName, "Snapshot Student");
  assert.equal(rows[0].studentCode, "ST-200");
  assert.equal(rows[0].studentPhoto, "/snapshot.jpg");
});
test("finance details modal resolves transfer identity and photo fallbacks", async () => {
  const source = await readFile(path.join(projectRoot, "js", "payment.js"), "utf8");
  const functionSource = source.match(/function resolveFinanceStudentIdentity\([\s\S]*?\n\}/)?.[0];
  assert.ok(functionSource, "modal identity resolver exists");
  const context = vm.createContext({});
  vm.runInContext(`${functionSource}\nglobalThis.resolve = resolveFinanceStudentIdentity;`, context);

  assert.deepEqual(
    { ...context.resolve(null, {
      student_name_snapshot: "Snapshot Student",
      student_code_snapshot: "ST-200",
      student_photo_snapshot: "/snapshot.jpg",
    }, null) },
    { name: "Snapshot Student", code: "ST-200", photo: "/snapshot.jpg" },
  );
  assert.deepEqual(
    { ...context.resolve({
      student_id: "ST-300",
      profiles: { full_name: "Current Name", photo_url: "/current.jpg" },
    }, null, { studentName: "Old Name", studentCode: "OLD-1", studentPhoto: "/old.jpg" }) },
    { name: "Current Name", code: "ST-300", photo: "/current.jpg" },
  );
});

test("finance modal scroll lock remains until every Finance modal closes", async () => {
  const source = await readFile(path.join(projectRoot, "js", "payment.js"), "utf8");
  const functionSource = source.match(
    /function setFinanceModalVisibility\(modal, isVisible\) \{[\s\S]*?\n\}/,
  )?.[0];
  assert.ok(functionSource, "Finance modal visibility helper exists");

  const modals = {
    addRecordPaymentModal: { style: { display: "none" } },
    viewPaymentModal: { style: { display: "none" } },
  };
  let bodyLocked = false;
  const context = vm.createContext({
    document: { getElementById: (id) => modals[id] },
    lockBodyScroll: () => { bodyLocked = true; },
    unLockBodyScroll: () => { bodyLocked = false; },
  });
  vm.runInContext(
    `${functionSource}\nglobalThis.setVisibility = setFinanceModalVisibility;`,
    context,
  );

  context.setVisibility(modals.addRecordPaymentModal, true);
  assert.equal(bodyLocked, true);
  context.setVisibility(modals.viewPaymentModal, true);
  context.setVisibility(modals.addRecordPaymentModal, false);
  assert.equal(bodyLocked, true);
  context.setVisibility(modals.viewPaymentModal, false);
  assert.equal(bodyLocked, false);
});

test("transfer acceptance and backfill preserve receiving-school student identity", async () => {
  const acceptanceSql = await readFile(
    path.join(projectRoot, "supabase", "student_transfer_acceptance.sql"),
    "utf8",
  );
  const backfillSql = await readFile(
    path.join(projectRoot, "supabase", "finance_transfer_student_identity_backfill.sql"),
    "utf8",
  );

  assert.match(acceptanceSql, /student_name_snapshot, student_code_snapshot, student_photo_snapshot/i);
  assert.match(acceptanceSql, /v_student_name, pg_catalog\.btrim\(p_target_student_code\)/i);
  assert.match(backfillSql, /add column if not exists student_photo_snapshot/i);
  assert.match(backfillSql, /target_enrollment\.school_id = transfer_identity\.target_school_id/i);
  assert.match(backfillSql, /student_name_snapshot = coalesce/i);
  assert.match(backfillSql, /student_code_snapshot = coalesce/i);
  assert.match(backfillSql, /student_photo_snapshot = coalesce/i);
});
test("finance transfer fee RPC is revoked from browser roles; student transfer history remains available", async () => {
  const source = await readFile(path.join(projectRoot, "supabase", "finance_transferred_fee_history.sql"), "utf8");
  assert.match(source, /security definer[\s\S]*?set search_path = ''/i);
  assert.match(source, /revoke all on function public\.get_school_transfer_fee_history\(\)[\s\S]*?from public, anon, authenticated/i);
  assert.doesNotMatch(source, /grant execute on function public\.get_school_transfer_fee_history/i);
  const studentHistorySql = await readFile(
    path.join(projectRoot, "supabase", "student_transfer_acceptance.sql"),
    "utf8",
  );
  assert.match(studentHistorySql, /grant execute on function public\.get_my_transfer_history\(\) to authenticated/i);
});
test("parent record renderers escape database text before inserting HTML", async () => {
  const helpers = await loadParentRecordHelpers();
  assert.equal(helpers.parentEscape(`<img src=x onerror="alert(1)">`), "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");

  helpers.parentRecordState.schools = new Map([["school-1", "<script>school</script>"]]);
  const html = helpers.renderFeesAndPayments([{
    id: "fee-1", school_id: "school-1", total_fees: 100, total_paid: 25, balance: 75,
    status: "Unpaid", fee_breakdown: [{ fee_name: "<b>Tuition</b>", amount: 100 }],
    academic_years: { year_label: "2026/2027" }, classes: { name: "Grade 9" }, terms: { name: "Term 1" },
  }]);
  assert.ok(html.includes("&lt;script&gt;school&lt;/script&gt;"));
  assert.ok(html.includes("&lt;b&gt;Tuition&lt;/b&gt;"));
  assert.ok(!html.includes("<script>school</script>"));
});

test("parent record school labels use the schools.school_name column", async () => {
  const helpers = await loadParentRecordHelpers();
  const schools = helpers.buildParentSchoolMap([
    { id: "school-1", school_name: "North High School" },
  ]);
  assert.equal(schools.get("school-1"), "North High School");
  assert.equal(schools.has("school-2"), false);
  helpers.parentRecordState.schools = schools;
  const html = helpers.renderFeesAndPayments([{
    id: "fee-1", school_id: "school-1", total_fees: 0, total_paid: 0, balance: 0,
    fee_breakdown: [],
  }]);
  assert.ok(html.includes("<td>North High School</td>"));
});

test("grade records can be filtered by their assessment period", async () => {
  const helpers = await loadParentRecordHelpers();
  const context = helpers.getParentRecordContext({
    grades: {
      assessment_id: "period-1", assessments: { name: "Midterm" },
      subject_id: "subject-1", subjects: { name: "Mathematics" },
    },
  }, "grades");
  assert.equal(context.periodName, "Midterm");
  assert.equal(context.periodId, "period-1");
  assert.equal(context.subjectName, "Mathematics");
  assert.equal(context.subjectId, "subject-1");
  assert.equal(helpers.matchesParentRecordFilters(context, { periodId: "period-1" }), true);
  assert.equal(helpers.matchesParentRecordFilters(context, { periodId: "period-2" }), false);
  assert.equal(helpers.matchesParentRecordFilters(context, { subjectId: "subject-1" }), true);
  assert.equal(helpers.matchesParentRecordFilters(context, { subjectId: "subject-2" }), false);
});

test("record statuses receive matching color classes", async () => {
  const helpers = await loadParentRecordHelpers();
  assert.equal(helpers.parentStatusClass("Paid"), "status-success");
  assert.equal(helpers.parentStatusClass("Absent"), "status-danger");
  assert.equal(helpers.parentStatusClass("Late"), "status-warning");
  assert.equal(helpers.parentStatusClass("Excused"), "status-info");
  assert.equal(helpers.parentStatusClass("Unknown"), "status-neutral");
});

test("attendance records can be filtered by subject", async () => {
  const helpers = await loadParentRecordHelpers();
  const context = helpers.getParentRecordContext({
    attendance: { subject_id: "subject-1", subjects: { name: "Mathematics" } },
  }, "attendance");
  assert.equal(context.subjectName, "Mathematics");
  assert.equal(context.subjectId, "subject-1");
  assert.equal(helpers.matchesParentRecordFilters(context, { subjectId: "subject-1" }), true);
  assert.equal(helpers.matchesParentRecordFilters(context, { subjectId: "subject-2" }), false);
});

test("inactive record filters stay hidden despite grid label styling", async () => {
  const css = await readFile(path.join(projectRoot, "css", "parent-portal.css"), "utf8");
  assert.match(css, /\.parent-record-filters label\[hidden\]\s*\{\s*display:\s*none\s*!important;/);
});

test("attendance recursion fix replaces only parent portal policies", async () => {
  const sql = await readFile(attendanceFixPath, "utf8");
  assert.ok(sql.includes("private.parent_portal_can_read_attendance(attendance.id)"));
  const droppedPolicies = [...sql.matchAll(/drop policy if exists "([^"]+)"/gi)].map((match) => match[1]);
  assert.deepEqual(droppedPolicies, [
    "parent_portal_attendance_sessions_linked_select",
    "parent_portal_attendance_sessions_select_scope",
  ]);
  assert.ok(sql.includes("security definer"));
  assert.ok(sql.includes("parent_user_id = (select auth.uid())"));
});
test("parent context policy fix uses private scoped lookups and only replaces owned policies", async () => {
  const sql = await readFile(contextFixPath, "utf8");
  assert.ok(sql.includes("private.parent_portal_can_view_context('school', schools.id)"));
  assert.ok(sql.includes("security definer"));
  assert.ok(sql.includes("parent_user_id = (select auth.uid())"));
  const droppedPolicies = [...sql.matchAll(/drop policy if exists "([^"]+)"/gi)].map((match) => match[1]);
  assert.equal(droppedPolicies.length, 8);
  assert.ok(droppedPolicies.every((name) => name.startsWith("parent_portal_")));
});
test("parent data SQL scopes sensitive reads to active child links and blocks parent writes", async () => {
  const sql = await readFile(sqlPath, "utf8");
  for (const policy of ["parent_portal_students_select_scope", "parent_portal_enrollments_select_scope", "parent_portal_fees_select_scope", "parent_portal_payments_select_scope", "parent_portal_attendance_records_select_scope", "parent_portal_grade_records_select_scope"]) {
    assert.ok(sql.includes(`"${policy}"`), `missing restrictive parent policy ${policy}`);
  }
  assert.ok(sql.includes("as restrictive for select"), "must narrow existing permissive school policies for parents");
  assert.ok(sql.includes("parent_portal_read_only_' || table_name || '_' || op"), "must prevent parents from writing school records");
  assert.ok(sql.includes("link.status = 'active'"), "inactive or revoked links must not authorize reads");
  assert.ok(sql.includes('g.category_id = p_id'), 'assessment category must use the actual grades.category_id column');
  assert.ok(!sql.includes('g.assessment_category_id'), 'do not reference a nonexistent grades column');
  assert.ok(sql.includes("private.current_profile_role()"), "role checks must avoid recursive profiles RLS queries");
  assert.ok(sql.includes("private.parent_portal_can_read_attendance(attendance.id)"), "attendance policies must use the recursion-safe helper");
  const attendancePolicySection = sql.split("-- Grades:")[0].split("-- Attendance details")[1];
  assert.ok(attendancePolicySection.includes("private.parent_portal_can_read_attendance(attendance.id)"));
  const droppedPolicies = [...sql.matchAll(/drop policy if exists "([^"]+)"/gi)].map((match) => match[1]);
  assert.ok(droppedPolicies.length > 0);
  assert.ok(droppedPolicies.every((name) => name.startsWith("parent_portal_")), "only policies owned by this patch may be replaced");
  assert.ok(!/alter table public\.[a-z_]+ enable row level security/i.test(sql), "do not toggle existing table RLS configuration");
  assert.ok(!sql.includes('"Users can view their own profile row"'), "do not replace any existing profile policy");
  assert.ok(sql.includes('"parent_portal_profiles_linked_select"'), "linked parents need additive profile access across schools");
  assert.match(sql, /parent_user_id = \(select auth\.uid\(\)\)[\s\S]*student_id = profiles\.id[\s\S]*link\.status = 'active'/, "profile reads must stay limited to actively linked students");
});

test("parent dashboard and record header request and display linked student photos", async () => {
  const dashboard = await readFile(path.join(projectRoot, "js", "parent-dashboard.js"), "utf8");
  const records = await readFile(jsPath, "utf8");
  const dashboardHtml = await readFile(path.join(projectRoot, "html", "parent-dashboard.html"), "utf8");
  const recordsHtml = await readFile(path.join(projectRoot, "html", "parent-records.html"), "utf8");
  assert.match(dashboard, /profiles\(full_name, photo_url\)/);
  assert.match(records, /profiles\(full_name, photo_url\)/);
  assert.match(dashboardHtml, /id="selectedStudentPhoto"/);
  assert.match(recordsHtml, /id="recordStudentPhoto"/);
  assert.match(dashboard, /parsedPhotoUrl\.protocol/);
  assert.match(records, /parsedPhotoUrl\.protocol/);
});

test("finance table uses thin cell grid borders and all finance buttons round on mobile", async () => {
  const css = await readFile(path.join(projectRoot, "css", "payment.css"), "utf8");
  assert.match(
    css,
    /\.finance-page \.payments-table-card tbody tr > td\s*\{\s*border:\s*1px solid rgb\(219,\s*215,\s*215\);/,
  );
  assert.match(
    css,
    /\.finance-page \.payments-table-card th\s*\{\s*border:\s*1px solid rgb\(219,\s*215,\s*215\);/,
  );
  assert.match(
    css,
    /\.finance-page \.payments-table-card table\s*\{\s*border-collapse:\s*collapse;/,
  );
  const mobileStyles = css.slice(css.lastIndexOf("@media screen and (max-width: 768px)"));
  assert.match(
    mobileStyles,
    /\.finance-page \.finances-container button\s*\{\s*border-radius:\s*10px;/,
  );
  assert.match(
    mobileStyles,
    /\.finance-page \.recordPayment-modal \.form-group input,[\s\S]*?\.finance-page \.recordPayment-modal \.item-payment-input\s*\{\s*border-radius:\s*10px;/,
  );
});
