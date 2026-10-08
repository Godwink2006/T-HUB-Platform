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
});
