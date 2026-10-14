import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const timetableScript = await readFile(
  path.join(projectRoot, "js", "timetable.js"),
  "utf8",
);
const timetableStyles = await readFile(
  path.join(projectRoot, "css", "timetable.css"),
  "utf8",
);

test("timetable teacher selectors and lesson tables show staff IDs", () => {
  assert.match(timetableScript, /\.select\("id, full_name, teachers\(staff_id\)"\)/);
  assert.match(timetableScript, /Staff ID: \$\{getTeacherStaffId\(teacher\)\}/);
  assert.match(timetableScript, /Staff ID: \$\{escapeHTML\(getTeacherStaffId\(t\)\)\}/);
  assert.match(timetableScript, /teacher: `[\s\S]*Staff ID: \$\{escapeHTML\(teacherStaffId\)\}/);
});

test("view timetable loads and displays teacher staff IDs", () => {
  assert.match(
    timetableScript,
    /teacher:profiles!teacher_id \( full_name, teachers\(staff_id\) \)/,
  );
  assert.match(timetableScript, /Staff ID: \$\{escapeHTML\(teacherStaffId\)\}/);
  assert.match(timetableScript, /return teacherDetails\?\.staff_id \|\| "No ID found"/);
});

test("mobile timetable modals fit the viewport and scroll lesson tables horizontally", () => {
  assert.match(timetableStyles, /max-height: calc\(100dvh - 24px\)/);
  assert.match(timetableStyles, /\.timetable-table-card,[\s\S]*?overflow-x: auto/);
  assert.match(timetableStyles, /\.view-timetable-body[\s\S]*?overflow-x: hidden/);
});
