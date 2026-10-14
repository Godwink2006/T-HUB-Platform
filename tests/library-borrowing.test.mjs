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

test("library inventory filters by search text, department, and active status", async () => {
  const source = await readFile(path.join(projectRoot, "js", "library.js"), "utf8");
  const html = await readFile(path.join(projectRoot, "html", "library.html"), "utf8");
  const functionSource = source.match(
    /function matchesLibraryBookFilters\(book, query = "", department = "", status = ""\) \{[\s\S]*?\n\}/,
  )?.[0];
  assert.ok(functionSource, "library book filter helper exists");

  const context = vm.createContext({});
  vm.runInContext(
    `${functionSource}\nglobalThis.matches = matchesLibraryBookFilters;`,
    context,
  );

  const activeBook = {
    search: "BK-001 The Example Book Writer Arts",
    department: "Arts",
    status: "active",
  };
  assert.equal(context.matches(activeBook, "example", "arts", "active"), true);
  assert.equal(context.matches(activeBook, "missing", "", ""), false);
  assert.equal(context.matches(activeBook, "", "", "inactive"), false);
  assert.equal(context.matches(activeBook, "", "science", ""), false);
  assert.match(html, /id="libraryBookSearch"/);
  assert.match(html, /id="libraryDepartmentFilter"/);
  assert.match(html, /id="libraryStatusFilter"/);
  assert.match(html, /<option value="active">Active<\/option>/);
  assert.match(html, /<option value="inactive">Inactive<\/option>/);
  assert.doesNotMatch(html, /<option>Borrow<\/option>|<option>Return<\/option>/);
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

test("book catalog availability is derived from total copies minus active borrowings", async () => {
  const source = await readFile(path.join(projectRoot, "js", "books.js"), "utf8");
  const functionSource = source.match(
    /function getAvailableBookCopies\(book, activeBorrowings\) \{[\s\S]*?\n\}/,
  )?.[0];
  assert.ok(functionSource, "book availability calculator exists");

  const context = vm.createContext({});
  vm.runInContext(`${functionSource}\nglobalThis.getAvailable = getAvailableBookCopies;`, context);

  const book = { id: "book-1", total_copies: 3, available_copies: 2 };
  const borrowings = [
    { book_id: "book-1" },
    { book_id: "book-1" },
    { book_id: "book-1" },
    { book_id: "book-2" },
  ];
  assert.equal(context.getAvailable(book, borrowings), 0);
  assert.equal(context.getAvailable({ ...book, total_copies: 5 }, borrowings), 2);
  assert.equal(context.getAvailable({ ...book, total_copies: 1 }, borrowings), 0);
});

test("user book history loads book description and borrower profile details", async () => {
  const source = await readFile(path.join(projectRoot, "js", "books.js"), "utf8");
  assert.match(source, /\.from\("profiles"\)[\s\S]{0,200}photo_url, role, students\(student_id\), teachers\(staff_id\)/);
  assert.match(source, /\.select\(`\*, books \( title, book_code, description \)`\)/);
  assert.match(source, /book\.description/);
  assert.match(source, /profile\.role/);
  assert.match(source, /function getBorrowerIdentity\(profile, student = null\)/);
  assert.match(source, /role === "student" && student\?\.student_id/);
  assert.match(source, /role === "teacher" && teacher\?\.staff_id/);
  assert.doesNotMatch(source, /Profile ID/);
  assert.match(source, /class="app-person-avatar"/);
  assert.match(source, /\.eq\("borrower_id", user\.id\)/);
});

test("borrower history identifies students and teachers with their school IDs only", async () => {
  const source = await readFile(path.join(projectRoot, "js", "books.js"), "utf8");
  const functionSource = source.match(
    /function getBorrowerIdentity\(profile, student = null\) \{[\s\S]*?\n\}/,
  )?.[0];
  assert.ok(functionSource, "role-specific borrower identity helper exists");

  const context = vm.createContext({});
  vm.runInContext(`${functionSource}\nglobalThis.getIdentity = getBorrowerIdentity;`, context);

  assert.deepEqual(
    JSON.parse(JSON.stringify(context.getIdentity(
      { role: "student" },
      { student_id: "ST-102" },
    ))),
    { label: "Student ID", value: "ST-102" },
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(context.getIdentity(
      { role: "teacher", teachers: { staff_id: "T-014" } },
    ))),
    { label: "Staff ID", value: "T-014" },
  );
  assert.equal(context.getIdentity({ role: "admin", id: "raw-profile-uuid" }), null);
});

test("user profile photos only accept HTTP(S) URLs or the trusted default avatar", async () => {
  const source = await readFile(path.join(projectRoot, "js", "books.js"), "utf8");
  const functionSource = source.match(
    /function getSafeProfilePhotoUrl\(photoUrl\) \{[\s\S]*?\n\}/,
  )?.[0];
  assert.ok(functionSource, "safe profile photo helper exists");

  const context = vm.createContext({
    URL,
    window: {
      location: { href: "https://school.example.test/html/books.html" },
      DEFAULT_PROFILE_AVATAR: "data:image/svg+xml,default",
    },
    console: { warn() {} },
  });
  vm.runInContext(
    `${functionSource}\nglobalThis.getPhoto = getSafeProfilePhotoUrl;`,
    context,
  );

  assert.equal(context.getPhoto("https://cdn.example.test/avatar.jpg"), "https://cdn.example.test/avatar.jpg");
  assert.equal(context.getPhoto("javascript:alert(1)"), "data:image/svg+xml,default");
  assert.equal(context.getPhoto(context.window.DEFAULT_PROFILE_AVATAR), "data:image/svg+xml,default");
});
