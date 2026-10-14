import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("borrower selection includes active same-school profiles except parents", async () => {
  const source = await readFile(path.join(projectRoot, "js", "library.js"), "utf8");
  const functionSource = source.match(
    /function filterBorrowerProfiles\(profiles, searchTerm = ""\) \{[\s\S]*?\n\}/,
  )?.[0];
  assert.ok(functionSource, "borrower profile filter exists");

  const context = vm.createContext({});
  vm.runInContext(
    `${functionSource}\nglobalThis.filter = filterBorrowerProfiles;`,
    context,
  );

  const profiles = [
    { id: "student-1", full_name: "Student One", role: "student", status: "active", students: { student_id: "ST-001" } },
    { id: "teacher-1", full_name: "Teacher One", email: "teacher@example.test", role: "teacher", status: "active" },
    { id: "parent-1", full_name: "Parent One", role: "parent", status: "active" },
    { id: "inactive-1", full_name: "Inactive User", role: "teacher", status: "inactive" },
  ];

  assert.deepEqual(
    Array.from(context.filter(profiles), (profile) => profile.id),
    ["student-1", "teacher-1"],
  );
  assert.equal(context.filter(profiles, "teacher@example.test").length, 1);
  assert.equal(context.filter(profiles, "ST-001").length, 1);
  assert.equal(context.filter(profiles, "parent").length, 0);
});

test("checkout borrower list is school-scoped and borrowing history stays user-scoped", async () => {
  const library = await readFile(path.join(projectRoot, "js", "library.js"), "utf8");
  const books = await readFile(path.join(projectRoot, "js", "books.js"), "utf8");

  assert.match(library, /\.from\("profiles"\)[\s\S]{0,220}\.eq\("school_id", userProfile\.school_id\)/);
  assert.match(library, /\.select\("id, full_name, email, role, status, students\(student_id\)"\)/);
  assert.match(library, /\.select\(`\*, profiles \( full_name, role, photo_url, students \( student_id \) \)`\)/);
  assert.match(library, /loadTransferredStudentIdentitySnapshots/);
  assert.match(library, /identitySnapshot\?\.student_name_snapshot/);
  assert.match(library, /class="app-person-avatar"/);
  assert.match(books, /\.eq\("borrower_id", user\.id\)/);
});

test("borrower photo URLs only allow HTTP(S) sources and otherwise use the default avatar", async () => {
  const source = await readFile(path.join(projectRoot, "js", "library.js"), "utf8");
  const functionSource = source.match(
    /function getBorrowerPhotoUrl\(photoUrl\) \{[\s\S]*?\n\}/,
  )?.[0];
  assert.ok(functionSource, "borrower photo URL helper exists");

  const context = vm.createContext({
    URL,
    window: {
      location: { href: "https://school.example.test/html/library.html" },
      DEFAULT_PROFILE_AVATAR: "default-avatar.svg",
    },
    console: { warn() {} },
  });
  vm.runInContext(`${functionSource}\nglobalThis.getPhoto = getBorrowerPhotoUrl;`, context);

  assert.equal(context.getPhoto("https://cdn.example.test/avatar.jpg"), "https://cdn.example.test/avatar.jpg");
  assert.equal(context.getPhoto("javascript:alert(1)"), "default-avatar.svg");
  assert.equal(context.getPhoto(null), "default-avatar.svg");
});
