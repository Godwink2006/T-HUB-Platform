import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("teacher assignments provide a subject filter instead of a teacher filter", async () => {
  const html = await readFile(
    path.join(projectRoot, "html", "teacher-assignment.html"),
    "utf8",
  );
  const source = await readFile(
    path.join(projectRoot, "js", "teacher-assignment.js"),
    "utf8",
  );

  assert.match(html, /id="filterSubject"[^>]*aria-label="Filter by subject"/);
  assert.match(html, /<option value="">All Subjects<\/option>/);
  assert.doesNotMatch(html, /filterTeacher|All Teachers/);
  assert.doesNotMatch(source, /filterTeacher|All Teachers/);
  assert.match(source, /subjectsMap\.set\(item\.subjects\.id, item\.subjects\.name\)/);
});

test("assignment filtering uses subject, class, year, and status selections", async () => {
  const source = await readFile(
    path.join(projectRoot, "js", "teacher-assignment.js"),
    "utf8",
  );
  const functionSource = source.match(
    /function filterAssignments\(\) \{[\s\S]*?\n\}/,
  )?.[0];
  assert.ok(functionSource, "assignment filter function exists");

  const filterValues = {
    assignSearchInput: "",
    filterSubject: "subject-1",
    filterClass: "",
    filterAcademicYear: "",
    filterStatus: "",
  };
  const context = vm.createContext({
    document: {
      getElementById(id) {
        return { value: filterValues[id] || "" };
      },
    },
    globalAssignmentsData: [
      { subjects: { id: "subject-1", name: "Math" }, profiles: { id: "teacher-1" } },
      { subjects: { id: "subject-2", name: "Science" }, profiles: { id: "teacher-1" } },
    ],
    renderAssignmentsTable(rows) {
      context.rendered = rows;
    },
  });
  vm.runInContext(functionSource, context);
  vm.runInContext("filterAssignments()", context);

  assert.equal(context.rendered.length, 1);
  assert.equal(context.rendered[0].subjects.id, "subject-1");
});

test("assignment table includes teacher photo and staff ID with an unavailable-ID fallback", async () => {
  const source = await readFile(
    path.join(projectRoot, "js", "teacher-assignment.js"),
    "utf8",
  );

  assert.match(
    source,
    /profiles!teacher_id\s*\([\s\S]*?photo_url,[\s\S]*?teachers\s*\(\s*staff_id\s*\)/,
  );
  assert.match(source, /class="app-person-avatar teacher-assignment-avatar"/);
  assert.match(source, /Staff ID: \$\{escapeHTML\(teacherStaffId\)\}/);
  assert.match(source, /assign\.profiles\?\.teachers\?\.staff_id \|\| "No ID found"/);
});
