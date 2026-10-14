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

test("admins can load drafted attendance while other staff remain submitted-only", async () => {
  const source = await readFile(path.join(projectRoot, "js", "attendance.js"), "utf8");
  const functionSource = source.match(
    /function shouldFilterAttendanceToSubmitted\(role\) \{[\s\S]*?\n\}/,
  )?.[0];
  assert.ok(functionSource, "attendance workflow visibility helper exists");

  const context = vm.createContext({});
  vm.runInContext(
    `${functionSource}\nglobalThis.shouldFilter = shouldFilterAttendanceToSubmitted;`,
    context,
  );

  assert.equal(context.shouldFilter("admin"), false);
  assert.equal(context.shouldFilter("ADMIN"), false);
  assert.equal(context.shouldFilter("teacher"), false);
  assert.equal(context.shouldFilter("accountant"), true);
  assert.equal(context.shouldFilter("receptionist"), true);
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

test("attendance edit modal shows record creator identity and has no date-clear button", async () => {
  const source = await readFile(path.join(projectRoot, "js", "attendance.js"), "utf8");
  const html = await readFile(path.join(projectRoot, "html", "attendance.html"), "utf8");
  const css = await readFile(path.join(projectRoot, "css", "attendance.css"), "utf8");

  assert.match(html, /id="editAttendanceCreator"/);
  assert.doesNotMatch(html, /clearDateFilterBtn/);
  assert.doesNotMatch(source, /clearDateFilterBtn/);
  assert.doesNotMatch(css, /clearDateFilterBtn/);
  assert.match(source, /\.select\([\s\S]*?profiles:teacher_id\(full_name, photo_url, teachers\(staff_id\)\)/);
  assert.match(source, /creatorElement\.innerHTML =/);
  assert.match(source, /No ID found/);
});

test("take-attendance roster displays each student's school ID and profile photo", async () => {
  const source = await readFile(path.join(projectRoot, "js", "attendance.js"), "utf8");
  const rosterFunction = source.match(
    /async function loadRosterIntoModal\(classId\) \{[\s\S]*?\n\}/,
  )?.[0];
  assert.ok(rosterFunction, "attendance roster loader exists");
  assert.match(rosterFunction, /\.from\("profiles"\)[\s\S]*?\.select\("id, photo_url"\)/);
  assert.match(rosterFunction, /student\.student_id \|\| "Not assigned"/);
  assert.match(rosterFunction, /Student ID: \$\{studentCode\}/);
  assert.match(rosterFunction, /getAttendancePhotoUrl\(studentPhotoById\.get\(student\.id\)\)/);
  assert.match(rosterFunction, /class="app-person-avatar"/);
});

test("take-attendance modal displays the current teacher photo and staff ID", async () => {
  const source = await readFile(path.join(projectRoot, "js", "attendance.js"), "utf8");
  const html = await readFile(path.join(projectRoot, "html", "attendance.html"), "utf8");

  assert.match(source, /\.select\("full_name, school_id, photo_url, teachers\(staff_id\)"\)/);
  assert.match(source, /teacherStaffId: profile\?\.teachers\?\.staff_id/);
  assert.match(source, /teacherPhotoUrl: profile\?\.photo_url/);
  assert.match(source, /Staff ID: \$\{escapeHtml\(currentAttendanceSession\.teacherStaffId/);
  assert.match(source, /getAttendancePhotoUrl\(currentAttendanceSession\.teacherPhotoUrl\)/);
  assert.ok(html.includes('id="stModalTeacherName"'));
});

test("attendance modals fit within small screens and keep their content scrollable", async () => {
  const css = await readFile(path.join(projectRoot, "css", "attendance.css"), "utf8");
  const mobileStyles = css.slice(css.lastIndexOf("@media screen and (max-width: 768px)"));

  assert.match(mobileStyles, /width:\s*calc\(100vw - 24px\)/);
  assert.match(mobileStyles, /max-height:\s*calc\(100dvh - 24px\)/);
  assert.match(mobileStyles, /#editAttendanceModal \.edit-draft-modal-content/);
  assert.match(mobileStyles, /\.studentAttendance-modal-body,[\s\S]*?min-height:\s*0;/);
  assert.match(mobileStyles, /\.studentAttendance-modal-body \.studentAttendance-table-card,[\s\S]*?overflow:\s*auto;/);
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
