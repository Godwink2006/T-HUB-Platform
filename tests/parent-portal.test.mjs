import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const jsPath = path.join(projectRoot, "js", "parent-records.js");
const sqlPath = path.join(projectRoot, "supabase", "parent_portal_data_access.sql");

async function loadParentRecordHelpers() {
  const source = await readFile(jsPath, "utf8");
  const context = vm.createContext({ document: { addEventListener() {} }, Intl, URLSearchParams });
  vm.runInContext(`${source}\nglobalThis.helpers = { parentEscape, parseBreakdown, renderFeesAndPayments, parentRecordState };`, context);
  return context.helpers;
}

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

test("parent data SQL scopes sensitive reads to active child links and blocks parent writes", async () => {
  const sql = await readFile(sqlPath, "utf8");
  for (const policy of ["parent_portal_students_select_scope", "parent_portal_enrollments_select_scope", "parent_portal_fees_select_scope", "parent_portal_payments_select_scope", "parent_portal_attendance_records_select_scope", "parent_portal_grade_records_select_scope"]) {
    assert.ok(sql.includes(`"${policy}"`), `missing restrictive parent policy ${policy}`);
  }
  assert.ok(sql.includes("as restrictive for select"), "must narrow existing permissive school policies for parents");
  assert.ok(sql.includes("parent_portal_read_only_' || table_name || '_' || op"), "must prevent parents from writing school records");
  assert.ok(sql.includes("link.status = 'active'"), "inactive or revoked links must not authorize reads");
  assert.ok(sql.includes("private.current_profile_role()"), "role checks must avoid recursive profiles RLS queries");
  const droppedPolicies = [...sql.matchAll(/drop policy if exists "([^"]+)"/gi)].map((match) => match[1]);
  assert.ok(droppedPolicies.length > 0);
  assert.ok(droppedPolicies.every((name) => name.startsWith("parent_portal_")), "only policies owned by this patch may be replaced");
  assert.ok(!/alter table public\\.[a-z_]+ enable row level security/i.test(sql), "do not toggle existing table RLS configuration");
  assert.ok(!sql.includes('"Users can view their own profile row"'), "do not replace any existing profile policy");
});
