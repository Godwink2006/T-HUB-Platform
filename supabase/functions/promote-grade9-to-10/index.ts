import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function respond(body: unknown, status = 200) {
  return Response.json(body, { status, headers: corsHeaders });
}

function getClassRelation(value: unknown): { name?: string; school_id?: string } | null {
  if (Array.isArray(value)) return (value[0] as { name?: string; school_id?: string }) ?? null;
  return (value as { name?: string; school_id?: string } | null) ?? null;
}

function isFirstTermName(name: string) {
  return /\b(?:1(?:st)?|first|one|i)\b/i.test(name);
}

function isSecondTermName(name: string) {
  return /\b(?:2(?:nd)?|second|two|ii)\b/i.test(name);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return respond({ success: false, message: "POST is required." }, 405);

  const authorization = request.headers.get("Authorization");
  if (!authorization) return respond({ success: false, message: "Missing authorization header." }, 401);

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authError } = await authClient.auth.getUser();
  if (authError || !authData.user) return respond({ success: false, message: "Invalid session." }, 401);

  const { data: adminProfile, error: profileError } = await adminClient
    .from("profiles")
    .select("role, status, school_id")
    .eq("id", authData.user.id)
    .single();

  if (profileError || !adminProfile || !["admin", "accountant"].includes(adminProfile.role) ||
      String(adminProfile.status).toLowerCase() !== "active") {
    return respond({ success: false, message: "Permission denied." }, 403);
  }

  if (!adminProfile.school_id) {
    return respond({ success: false, message: "Your profile is not linked to a school." }, 400);
  }

  const checkSchoolIsActive = async () => {
    const { data, error } = await authClient.rpc("is_school_active", {
      target_school_id: adminProfile.school_id,
    });
    if (error) throw new Error(`Could not verify the school's status: ${error.message}`);
    return data === true;
  };

  try {
    if (!(await checkSchoolIsActive())) {
      return respond({ success: false, message: "This school is inactive. Student promotion is unavailable until the school is reactivated." }, 403);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not verify the school's status.";
    console.error("School status check failed before promotion:", message);
    return respond({ success: false, message }, 503);
  }

  const createdAuthUserIds: string[] = [];

  try {
    const body = await request.json();
    const schoolId = adminProfile.school_id;
    const targetClassId = body.target_class_id ?? body.targetClassId;
    const feeStructureId = body.fee_structure_id ?? body.feeStructureId;
    const rawEnrollmentIds: string[] = Array.isArray(body.enrollment_ids)
      ? body.enrollment_ids
      : Array.isArray(body.enrollmentIds) ? body.enrollmentIds : [];
    const requestedStudentIds: string[] = [
      ...(body.student_id ? [body.student_id] : []),
      ...(Array.isArray(body.student_ids) ? body.student_ids : []),
      ...(Array.isArray(body.studentIds) ? body.studentIds : []),
    ];

    if (body.school_id && body.school_id !== schoolId) {
      return respond({ success: false, message: "Requested school does not match your profile." }, 403);
    }
    if (!targetClassId || !feeStructureId) {
      return respond({ success: false, message: "Target class and fee structure are required." }, 400);
    }
    if (rawEnrollmentIds.some((id) => typeof id !== "string" || !id)) {
      return respond({ success: false, message: "Enrollment IDs must be a list of non-empty IDs." }, 400);
    }
    const enrollmentIds = [...new Set(rawEnrollmentIds)];

    const { data: targetClass, error: classError } = await adminClient
      .from("classes")
      .select("id, name, school_id")
      .eq("id", targetClassId)
      .eq("school_id", schoolId)
      .maybeSingle();
    if (classError) throw new Error(`Could not load target class: ${classError.message}`);
    if (!targetClass) return respond({ success: false, message: "Target class was not found in your school." }, 404);
    if (!/10/.test(targetClass.name ?? "")) {
      return respond({ success: false, message: "Target class must be Grade 10." }, 400);
    }

    const { data: activeYear, error: yearError } = await adminClient
      .from("academic_years")
      .select("id, year_label")
      .eq("school_id", schoolId)
      .ilike("status", "active")
      .maybeSingle();
    if (yearError) throw new Error(`Could not load academic years: ${yearError.message}`);
    if (!activeYear) return respond({ success: false, message: "No active academic year found for this school." }, 400);

    const { data: schoolTerms, error: termError } = await adminClient
      .from("terms")
      .select("id, name")
      .eq("school_id", schoolId)
      .eq("academic_year_id", activeYear.id);
    if (termError) throw new Error(`Could not load terms: ${termError.message}`);
    const firstTerms = (schoolTerms ?? []).filter((term) => isFirstTermName(term.name ?? ""));
    const secondTerms = (schoolTerms ?? []).filter((term) => isSecondTermName(term.name ?? ""));
    if (!firstTerms?.length) {
      return respond({ success: false, message: "Could not find the 1st term for the active academic year." }, 400);
    }
    if (firstTerms.length > 1) {
      return respond({ success: false, message: "More than one first term matches this academic year." }, 409);
    }
    if (!secondTerms.length) {
      return respond({ success: false, message: "Could not find the 2nd term for the active academic year." }, 400);
    }
    if (secondTerms.length > 1) {
      return respond({ success: false, message: "More than one second term matches this academic year." }, 409);
    }
    const firstTermId = firstTerms[0].id;
    const secondTermId = secondTerms[0].id;

    const { data: feeStructure, error: feeError } = await adminClient
      .from("fee_structures")
      .select("id, school_id, class_id, academic_year_id, term_id, total_amount, status")
      .eq("id", feeStructureId)
      .eq("school_id", schoolId)
      .maybeSingle();
    if (feeError) throw new Error(`Could not load fee structure: ${feeError.message}`);
    if (!feeStructure) return respond({ success: false, message: "Fee structure not found in your school." }, 404);
    if (feeStructure.class_id !== targetClassId || feeStructure.academic_year_id !== activeYear.id ||
        feeStructure.term_id !== secondTermId || String(feeStructure.status).toLowerCase() !== "active") {
      return respond({ success: false, message: "Fee structure must be active and match the target class, year, and second term." }, 400);
    }

    const { data: feeItems, error: feeItemsError } = await adminClient
      .from("fee_structure_items")
      .select("id, fee_name, amount")
      .eq("fee_structure_id", feeStructureId);
    if (feeItemsError) throw new Error(`Could not load fee items: ${feeItemsError.message}`);
    const feeBreakdown = (feeItems ?? []).map((item) => ({
      id: item.id,
      fee_name: item.fee_name,
      amount: item.amount,
    }));

    const resolvedStudentIds = new Set<string>(requestedStudentIds);
    if (enrollmentIds.length) {
      const { data: sourceEnrollments, error: enrollmentError } = await adminClient
        .from("student_enrollments")
        .select("id, student_id, school_id, academic_year_id, term_id, classes(name, school_id)")
        .in("id", enrollmentIds)
        .eq("school_id", schoolId);
      if (enrollmentError) throw new Error(`Could not load source enrollments: ${enrollmentError.message}`);
      if (!sourceEnrollments || sourceEnrollments.length !== enrollmentIds.length) {
        return respond({ success: false, message: "One or more source enrollments were not found in your school." }, 404);
      }

      for (const enrollment of sourceEnrollments) {
        const sourceClass = getClassRelation(enrollment.classes);
        const gradeMatch = (sourceClass?.name ?? "").match(/\d+/);
        if (enrollment.academic_year_id !== activeYear.id ||
            (enrollment.term_id && enrollment.term_id !== firstTermId) ||
            sourceClass?.school_id !== schoolId || Number(gradeMatch?.[0]) !== 9) {
          return respond({ success: false, message: "Every selected student must be enrolled in Grade 9 in the active year and first term." }, 400);
        }
        resolvedStudentIds.add(enrollment.student_id);
      }
    }

    const studentIds = [...resolvedStudentIds];
    if (!studentIds.length) return respond({ success: false, message: "Select at least one student to promote." }, 400);
    if (studentIds.length > 1) {
      return respond({ success: false, message: "Promote one student per request so each receives distinct login credentials." }, 400);
    }

    const { data: studentRows, error: studentsError } = await adminClient
      .from("students")
      .select("id, school_id")
      .in("id", studentIds)
      .eq("school_id", schoolId);
    if (studentsError) throw new Error(`Could not load selected students: ${studentsError.message}`);
    if (!studentRows || studentRows.length !== studentIds.length) {
      return respond({ success: false, message: "One or more selected students do not belong to your school." }, 404);
    }

    const { data: existingEnrollments, error: duplicateCheckError } = await adminClient
      .from("student_enrollments")
      .select("id, student_id")
      .in("student_id", studentIds)
      .eq("school_id", schoolId)
      .eq("academic_year_id", feeStructure.academic_year_id)
      .eq("term_id", feeStructure.term_id);
    if (duplicateCheckError) throw new Error(`Could not check existing enrollments: ${duplicateCheckError.message}`);
    if (existingEnrollments?.length) {
      return respond({ success: false, message: "Student is already enrolled for this academic year and term." }, 409);
    }

    const email = typeof body.email === "string" ? body.email.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const phoneNumber = body.phone_number ?? body.phone ?? null;
    if (!email || !password) return respond({ success: false, message: "Email and password are required for the student account." }, 400);

    const studentId = studentIds[0];
    const { data: existingAuth, error: authLookupError } = await adminClient.auth.admin.getUserById(studentId);
    if (authLookupError && !/not found|user not found/i.test(authLookupError.message)) {
      throw new Error(`Could not check the student's Auth account: ${authLookupError.message}`);
    }
    if (existingAuth.user && existingAuth.user.email?.toLowerCase() !== email.toLowerCase()) {
      return respond({ success: false, message: "This student already has an Auth account with a different email." }, 409);
    }

    if (!existingAuth.user) {
      if (!(await checkSchoolIsActive())) {
        return respond({ success: false, message: "This school is inactive. Student promotion is unavailable until the school is reactivated." }, 403);
      }
      const { data: createdUser, error: createUserError } = await adminClient.auth.admin.createUser({
        id: studentId,
        email,
        password,
        email_confirm: true,
        user_metadata: { school_id: schoolId, role: "student" },
      });
      if (createUserError) throw new Error(`Auth creation failed: ${createUserError.message}`);
      if (createdUser.user?.id) createdAuthUserIds.push(createdUser.user.id);
    }

    if (!(await checkSchoolIsActive())) {
      throw new Error("This school became inactive before the promotion could be completed.");
    }

    const { error: promotionError } = await adminClient.rpc("promote_grade9_students_transaction", {
      p_school_id: schoolId,
      p_student_ids: studentIds,
      p_target_class_id: targetClassId,
      p_academic_year_id: feeStructure.academic_year_id,
      p_term_id: feeStructure.term_id,
      p_fee_structure_id: feeStructureId,
      p_total_amount: feeStructure.total_amount,
      p_fee_breakdown: feeBreakdown,
      p_email: email,
      p_phone_number: phoneNumber,
    });
    if (promotionError) throw new Error(`Promotion transaction failed: ${promotionError.message}`);

    return respond({ success: true, message: "Student promoted and assigned fees successfully." });
  } catch (error) {
    const rollbackErrors: string[] = [];
    for (const userId of createdAuthUserIds.reverse()) {
      const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
      if (deleteError) rollbackErrors.push(`Auth user ${userId}: ${deleteError.message}`);
    }

    const message = error instanceof Error ? error.message : "Internal server error.";
    console.error("Grade 9 to 10 promotion failed:", message, rollbackErrors);
    return respond({
      success: false,
      message: rollbackErrors.length
        ? `${message} Auth cleanup also failed; contact an administrator.`
        : message,
    }, 500);
  }
});
