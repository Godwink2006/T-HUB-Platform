import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

// Offline end-to-end workflow test. Every API response comes from the
// in-memory mock below; this file never reads .env or calls the real network.
const API_URL = "https://supabase-mock.invalid";
const ANON_KEY = "mock-publishable-key";
const SERVICE_KEY = "mock-service-role-key";

function createMockDatabase() {
  const tables = new Map();
  const usersByEmail = new Map();
  const usersById = new Map();
  const tokens = new Map();
  const table = (name) => {
    if (!tables.has(name)) tables.set(name, []);
    return tables.get(name);
  };
  const rowId = () => randomUUID();

  function json(data, status = 200) {
    return new Response(data === null ? null : JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }

  function requestContext(request) {
    const apiKey = request.headers.get("apikey");
    const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const isService = apiKey === SERVICE_KEY;
    return { isService, user: tokens.get(bearer) ?? null };
  }

  function error(message, status = 400, code = "MOCK_ERROR") {
    return json({ message, code }, status);
  }

  function insertRow(name, value) {
    const row = { id: rowId(), ...value };
    table(name).push(row);
    return row;
  }

  function hasRole(context, role) {
    if (context.isService) return true;
    return context.user?.role === role;
  }

  async function handle(request) {
    const url = new URL(request.url);
    const context = requestContext(request);
    const body = request.method === "GET" || request.method === "HEAD"
      ? null
      : await request.json().catch(() => null);

    if (url.pathname === "/auth/v1/admin/users" && request.method === "POST") {
      if (!context.isService) return error("Service key required", 401);
      const user = {
        id: rowId(),
        email: body.email,
        password: body.password,
        user_metadata: body.user_metadata ?? {},
      };
      usersByEmail.set(user.email, user);
      usersById.set(user.id, user);
      return json({ user }, 201);
    }

    if (url.pathname === "/auth/v1/token" && request.method === "POST") {
      const user = usersByEmail.get(body?.email);
      if (!user || user.password !== body?.password) return error("Invalid login credentials", 400);
      const profile = table("profiles").find((item) => item.id === user.id);
      if (!profile) return error("User profile is missing", 400);
      const accessToken = `mock-access-${rowId()}`;
      const sessionUser = {
        id: user.id,
        email: user.email,
        role: profile.role,
        school_id: profile.school_id,
      };
      tokens.set(accessToken, sessionUser);
      return json({ access_token: accessToken, token_type: "bearer", user: sessionUser });
    }

    if (!url.pathname.startsWith("/rest/v1/")) return error("Unknown mock route", 404);
    const resource = url.pathname.slice("/rest/v1/".length);

    if (resource === "rpc/save_attendance_with_records" && request.method === "POST") {
      if (!hasRole(context, "teacher")) return error("Teacher auth required", 403);
      const payload = body;
      const school = table("schools").find((item) => item.id === payload.p_school_id);
      const classRow = table("classes").find((item) => item.id === payload.p_class_id);
      const student = table("students").find((item) => item.id === payload.p_records?.[0]?.student_id);
      if (!school || !classRow || !student || classRow.school_id !== school.id || student.school_id !== school.id) {
        return error("Attendance references must belong to the same school", 400);
      }
      const attendance = insertRow("attendance", {
        school_id: school.id,
        class_id: classRow.id,
        subject_id: payload.p_subject_id,
        assessment_id: payload.p_assessment_id,
        teacher_id: context.user.id,
        academic_year_id: payload.p_academic_year_id,
        term_id: payload.p_term_id,
        date: payload.p_date,
        status: payload.p_status,
      });
      for (const record of payload.p_records ?? []) {
        insertRow("attendance_records", {
          attendance_id: attendance.id,
          student_id: record.student_id,
          status: record.status,
          school_id: school.id,
        });
      }
      return json(attendance.id);
    }

    if (resource === "rpc/record_itemized_payment" && request.method === "POST") {
      if (!hasRole(context, "accountant")) return error("Accountant auth required", 403);
      const fee = table("student_fees").find((item) => item.id === body.p_student_fee_id);
      const allocations = body.p_allocations ?? [];
      const amount = Number(body.p_amount);
      if (!fee || fee.student_id !== body.p_student_id || fee.school_id !== context.user.school_id) {
        return error("Fee ledger is unavailable to this accountant", 404);
      }
      if (amount <= 0 || allocations.reduce((sum, item) => sum + Number(item.amount), 0) !== amount) {
        return error("Payment allocations must equal the payment amount", 400);
      }
      const transaction = insertRow("payment_transactions", {
        school_id: fee.school_id,
        student_fee_id: fee.id,
        student_id: fee.student_id,
        amount,
        payment_method: body.p_payment_method,
        reference_number: body.p_reference_number,
        notes: body.p_notes,
      });
      for (const allocation of allocations) {
        insertRow("payment_allocations", {
          payment_transaction_id: transaction.id,
          fee_item_id: allocation.fee_item_id,
          amount: Number(allocation.amount),
          school_id: fee.school_id,
        });
      }
      fee.total_paid += amount;
      fee.balance = fee.total_fees - fee.total_paid;
      fee.status = fee.balance <= 0 ? "Paid" : "Partially Paid";
      return json(transaction.id);
    }

    const tableName = resource.split("?")[0];
    const query = new URLSearchParams(url.search);
    if (request.method !== "POST") return error("Mock supports POST routes only", 405);
    const rows = Array.isArray(body) ? body : [body];
    const created = [];

    for (const value of rows) {
      if (!context.isService) {
        if (tableName === "student_enrollments" && !hasRole(context, "admin")) {
          return error("Admin auth required for enrollment", 403);
        }
        if (["fee_structures", "fee_structure_items", "student_fees"].includes(tableName) && !hasRole(context, "admin")) {
          return error("Admin auth required for fee setup", 403);
        }
        if (tableName === "book_borrowings" && (!hasRole(context, "student") || value.borrower_id !== context.user.id)) {
          return error("A student can only borrow as their own profile", 403);
        }
      }

      if (tableName === "profiles" && query.has("on_conflict")) {
        const existing = table("profiles").find((item) => item.id === value.id);
        if (existing) Object.assign(existing, value);
        else table("profiles").push(value);
        created.push(existing ?? value);
        continue;
      }

      if (tableName === "student_enrollments") {
        const student = table("students").find((item) => item.id === value.student_id);
        const classRow = table("classes").find((item) => item.id === value.class_id);
        if (!student || !classRow || student.school_id !== value.school_id || classRow.school_id !== value.school_id) {
          return error("Enrollment references must belong to the same school", 400);
        }
      }

      if (tableName === "fee_structure_items") {
        const parent = table("fee_structures").find((item) => item.id === value.fee_structure_id);
        if (!parent || parent.school_id !== value.school_id) return error("Fee item must belong to its fee structure", 400);
      }
      if (tableName === "student_fees") {
        const student = table("students").find((item) => item.id === value.student_id);
        if (!student || student.school_id !== value.school_id) return error("Fee ledger student must belong to the school", 400);
        value.balance = Number(value.total_fees) - Number(value.total_paid);
      }
      if (tableName === "book_borrowings") {
        const book = table("books").find((item) => item.id === value.book_id);
        if (!book || book.school_id !== value.school_id || book.available_copies < 1) return error("Book is unavailable", 400);
        book.available_copies -= 1;
      }

      created.push(insertRow(tableName, value));
    }

    const preference = request.headers.get("prefer") ?? "";
    if (preference.includes("return=minimal")) return json(null, 201);
    if (!preference.includes("return=representation")) return json(null, 201);
    const selection = query.get("select");
    const responseRows = selection
      ? created.map((row) => Object.fromEntries(selection.split(",").map((key) => [key, row[key]])))
      : created;
    return json(responseRows, 201);
  }

  return { handle, tables, usersById };
}

const mockDatabase = createMockDatabase();

async function api(path, { token = ANON_KEY, method = "GET", body, prefer } = {}) {
  const isService = token === SERVICE_KEY;
  const headers = new Headers({
    apikey: isService ? SERVICE_KEY : ANON_KEY,
    "Content-Type": "application/json",
    ...(isService ? {} : { Authorization: `Bearer ${token}` }),
    ...(prefer ? { Prefer: prefer } : {}),
  });
  const request = new Request(new URL(path, API_URL), {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const response = await mockDatabase.handle(request);
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(`${method} ${path} returned ${response.status}: ${JSON.stringify(data)}`);
  return data;
}

async function insert(table, values, token = SERVICE_KEY, select = "*") {
  const rows = await api(`/rest/v1/${table}?select=${encodeURIComponent(select)}`, {
    token,
    method: "POST",
    body: values,
    prefer: "return=representation",
  });
  assert.ok(Array.isArray(rows) && rows.length, `Insert into ${table} returned no row`);
  return rows[0];
}

async function createUser(schoolId, role, suffix) {
  const email = `test-${role}-${suffix}@example.test`;
  const password = `offline-${randomUUID()}-A9!`;
  const created = await api("/auth/v1/admin/users", {
    token: SERVICE_KEY,
    method: "POST",
    body: { email, password, email_confirm: true, user_metadata: { full_name: `Test ${role}` } },
  });
  const user = created.user;
  await api("/rest/v1/profiles?on_conflict=id", {
    token: SERVICE_KEY,
    method: "POST",
    body: { id: user.id, full_name: `Test ${role}`, email, role, status: "active", school_id: schoolId },
    prefer: "resolution=merge-duplicates,return=minimal",
  });
  return { id: user.id, email, password };
}

async function signIn(credentials) {
  const session = await api("/auth/v1/token?grant_type=password", {
    method: "POST",
    body: { email: credentials.email, password: credentials.password },
  });
  assert.ok(session.access_token, `Authentication failed for ${credentials.email}`);
  return { token: session.access_token, userId: session.user.id };
}

async function createDummySchool() {
  const suffix = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const school = await insert("schools", {
    code: `IT-${suffix}`,
    school_name: `Offline Integration School ${suffix}`,
    status: "Active",
  }, SERVICE_KEY, "id,code,school_name");
  return { ...school, suffix };
}

async function createFixture(school) {
  const { id: schoolId, suffix } = school;
  const [adminCredentials, teacherCredentials, accountantCredentials, studentCredentials] = await Promise.all([
    createUser(schoolId, "admin", suffix),
    createUser(schoolId, "teacher", suffix),
    createUser(schoolId, "accountant", suffix),
    createUser(schoolId, "student", suffix),
  ]);

  await insert("teachers", { id: teacherCredentials.id, staff_id: `IT-${suffix}`, school_id: schoolId }, SERVICE_KEY, "id");
  const academicYear = await insert("academic_years", {
    year_label: `IT ${suffix}`, status: "Active", school_id: schoolId,
  }, SERVICE_KEY, "id");
  const term = await insert("terms", {
    academic_year_id: academicYear.id,
    name: `IT Term ${suffix}`,
    start_date: "2026-01-01",
    end_date: "2026-12-31",
    status: "Active",
    school_id: schoolId,
  }, SERVICE_KEY, "id");
  const schoolClass = await insert("classes", {
    name: `IT Class ${suffix}`,
    school_level: "Junior Secondary",
    capacity: 30,
    status: "active",
    school_id: schoolId,
  }, SERVICE_KEY, "id");
  const subject = await insert("subjects", {
    name: `IT Subject ${suffix}`, status: "Active", school_id: schoolId,
  }, SERVICE_KEY, "id");
  const assessment = await insert("assessments", {
    name: `IT Assessment ${suffix}`,
    maximum_marks: 100,
    status: "Active",
    school_id: schoolId,
  }, SERVICE_KEY, "id");
  const book = await insert("books", {
    book_code: `IT-${suffix}`,
    title: `Integration Book ${suffix}`,
    author: "Offline Test",
    total_copies: 1,
    available_copies: 1,
    status: "active",
    school_id: schoolId,
  }, SERVICE_KEY, "id");
  await insert("students", {
    id: studentCredentials.id,
    student_id: `IT-${suffix}`,
    school_id: schoolId,
    class_id: schoolClass.id,
    academic_year_id: academicYear.id,
    admission_date: "2026-01-01",
  }, SERVICE_KEY, "id");

  return {
    admin: adminCredentials,
    teacher: teacherCredentials,
    accountant: accountantCredentials,
    student: studentCredentials,
    classId: schoolClass.id,
    academicYearId: academicYear.id,
    termId: term.id,
    subjectId: subject.id,
    assessmentId: assessment.id,
    bookId: book.id,
  };
}

test("offline end-to-end workflow: auth, enrollment, attendance, fees, payment, and borrowing", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = () => {
    throw new Error("Offline integration test attempted a real network request");
  };

  try {
    const school = await createDummySchool();
    const fixture = await createFixture(school);
    const admin = await signIn(fixture.admin);
    const teacher = await signIn(fixture.teacher);
    const accountant = await signIn(fixture.accountant);
    const student = await signIn(fixture.student);
    assert.equal(student.userId, fixture.student.id);

    const enrollment = await insert("student_enrollments", {
      school_id: school.id,
      student_id: student.userId,
      class_id: fixture.classId,
      academic_year_id: fixture.academicYearId,
      term_id: fixture.termId,
      enrollment_status: "Normal",
    }, admin.token, "id,student_id,enrollment_status");
    assert.equal(enrollment.student_id, student.userId);

    const attendanceId = await api("/rest/v1/rpc/save_attendance_with_records", {
      token: teacher.token,
      method: "POST",
      body: {
        p_attendance_id: null,
        p_school_id: school.id,
        p_class_id: fixture.classId,
        p_subject_id: fixture.subjectId,
        p_period_id: null,
        p_assessment_id: fixture.assessmentId,
        p_teacher_id: teacher.userId,
        p_academic_year_id: fixture.academicYearId,
        p_term_id: fixture.termId,
        p_date: "2026-06-15",
        p_status: "submitted",
        p_records: [{ student_id: student.userId, status: "Present" }],
      },
    });
    assert.ok(attendanceId);
    assert.equal(mockDatabase.tables.get("attendance_records")[0].status, "Present");

    const feeStructure = await insert("fee_structures", {
      school_id: school.id,
      academic_year_id: fixture.academicYearId,
      term_id: fixture.termId,
      class_id: fixture.classId,
      status: "Active",
      total_amount: 1000,
    }, admin.token, "id");
    const feeItem = await insert("fee_structure_items", {
      school_id: school.id,
      fee_structure_id: feeStructure.id,
      fee_name: `Integration fee ${school.suffix}`,
      amount: 1000,
    }, admin.token, "id,fee_name,amount");
    const studentFee = await insert("student_fees", {
      school_id: school.id,
      student_id: student.userId,
      class_id: fixture.classId,
      academic_year_id: fixture.academicYearId,
      term_id: fixture.termId,
      fee_structure_id: feeStructure.id,
      total_fees: 1000,
      total_paid: 0,
      status: "Unpaid",
      fee_breakdown: [{ id: feeItem.id, name: feeItem.fee_name, amount: 1000 }],
    }, admin.token, "id,total_fees,total_paid");

    const transactionId = await api("/rest/v1/rpc/record_itemized_payment", {
      token: accountant.token,
      method: "POST",
      body: {
        p_student_fee_id: studentFee.id,
        p_student_id: student.userId,
        p_amount: 250,
        p_payment_method: "Cash",
        p_reference_number: `itest-${school.suffix}`,
        p_notes: "Offline mock integration workflow",
        p_allocations: [{ fee_item_id: feeItem.id, amount: 250 }],
      },
    });
    assert.ok(transactionId);
    assert.equal(mockDatabase.tables.get("student_fees")[0].total_paid, 250);
    assert.equal(mockDatabase.tables.get("payment_allocations")[0].amount, 250);

    const borrowing = await insert("book_borrowings", {
      school_id: school.id,
      book_id: fixture.bookId,
      borrower_id: student.userId,
      due_date: "2026-06-22",
      status: "borrowed",
    }, student.token, "id,book_id,borrower_id,status");
    assert.equal(borrowing.borrower_id, student.userId);
    assert.equal(borrowing.status, "borrowed");
    assert.equal(mockDatabase.tables.get("books")[0].available_copies, 0);
  } finally {
    globalThis.fetch = realFetch;
  }
});
