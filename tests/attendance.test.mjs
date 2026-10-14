import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("attendance filters cover class, subject, academic year, semester, status, and date", async () => {
  const source = await readFile(path.join(projectRoot, "js", "attendance.js"), "utf8");
  const html = await readFile(path.join(projectRoot, "html", "attendance.html"), "utf8");
  const functionSource = source.match(
    /function matchesAttendanceFilters\(item, filters\) \{[\s\S]*?\n\}/,
  )?.[0];
  assert.ok(functionSource, "attendance filter helper exists");

  const context = vm.createContext({});
  vm.runInContext(
    `${functionSource}\nglobalThis.matches = matchesAttendanceFilters;`,
    context,
  );

  const session = {
    class_id: "class-1",
    subject_id: "subject-1",
    academic_year_id: "year-1",
    term_id: "term-1",
    status: "submitted",
    date: "2026-10-14",
    classes: { id: "class-1", name: "Grade 10" },
    subjects: { id: "subject-1", name: "Mathematics" },
    academic_years: { id: "year-1", year_label: "2026/2027" },
    terms: { id: "term-1", name: "Semester 1" },
  };
  const filters = {
    search: "mathematics",
    classId: "class-1",
    subjectId: "subject-1",
    academicYearId: "year-1",
    semesterId: "term-1",
    status: "submitted",
    date: "2026-10-14",
  };

  assert.equal(context.matches(session, filters), true);
  for (const [filterName, value] of Object.entries({
    classId: "class-2",
    subjectId: "subject-2",
    academicYearId: "year-2",
    semesterId: "term-2",
    status: "drafted",
    date: "2026-10-13",
    search: "history",
  })) {
    assert.equal(context.matches(session, { ...filters, [filterName]: value }), false);
  }

  for (const id of [
    "attendanceSubjectFilter",
    "attendanceAcademicYearFilter",
    "attendanceSemesterFilter",
    "attendanceStatusFilter",
  ]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
});

test("attendance history uses transfer photo snapshots and teacher staff identity", async () => {
  const source = await readFile(path.join(projectRoot, "js", "attendance.js"), "utf8");
  const utils = await readFile(path.join(projectRoot, "js", "utils.js"), "utf8");
  const html = await readFile(path.join(projectRoot, "html", "attendance.html"), "utf8");

  assert.match(utils, /student_code_snapshot, student_photo_snapshot/);
  assert.match(source, /snapshot\?\.student_photo_snapshot/);
  assert.match(source, /profiles:teacher_id\(full_name, photo_url, teachers\(staff_id\)\)/);
  assert.match(source, /Staff ID: \$\{escapeHtml\(teacherStaffId\)\}/);
  assert.match(html, /id="viewModalTeacherName"/);
});

test("attendance transfer snapshots are readable only for a teacher's own school sessions", async () => {
  const policy = await readFile(
    path.join(
      projectRoot,
      "supabase",
      "attendance_teacher_transfer_snapshot_access.sql",
    ),
    "utf8",
  );

  assert.match(policy, /on public\.student_enrollments[\s\S]*?for select[\s\S]*?to authenticated/i);
  assert.match(policy, /school_id = public\.get_auth_user_school_id\(\)/i);
  assert.match(policy, /lower\(coalesce\(public\.get_auth_user_role\(\), ''\)\) = 'teacher'/i);
  assert.match(policy, /attendance_session\.teacher_id = \(select auth\.uid\(\)\)/i);
  assert.match(policy, /attendance_record\.school_id = student_enrollments\.school_id/i);
});
