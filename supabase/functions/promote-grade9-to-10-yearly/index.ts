import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

type ClassRelation = {
  name?: string | null;
  school_id?: string | null;
};

function respond(body: unknown, status = 200) {
  return Response.json(body, { status, headers: corsHeaders });
}

function getClassRelation(value: unknown): ClassRelation | null {
  if (Array.isArray(value)) {
    return (value[0] as ClassRelation | undefined) ?? null;
  }

  return (value as ClassRelation | null) ?? null;
}

function matchesFirstTerm(name: string) {
  return /\b(?:1(?:st)?|first|term\s*1|semester\s*1|one|i)\b/i.test(name);
}

function getGradeNumber(className: string) {
  const match = className.match(/\d+/);
  return match ? Number(match[0]) : null;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return respond({ success: false, message: "POST is required." }, 405);
  }

  const authorization = request.headers.get("Authorization");
  if (!authorization) {
    return respond(
      { success: false, message: "Missing authorization header." },
      401,
    );
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    global: {
      headers: { Authorization: authorization },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data: authData, error: authError } = await authClient.auth.getUser();

  if (authError || !authData.user) {
    return respond({ success: false, message: "Invalid session." }, 401);
  }

  const { data: adminProfile, error: profileError } = await adminClient
    .from("profiles")
    .select("role, status, school_id")
    .eq("id", authData.user.id)
    .single();

  const allowedRoles = ["admin", "accountant"];
  const role = String(adminProfile?.role ?? "").toLowerCase();
  const profileStatus = String(adminProfile?.status ?? "").toLowerCase();

  if (
    profileError ||
    !adminProfile ||
    !allowedRoles.includes(role) ||
    profileStatus !== "active"
  ) {
    return respond({ success: false, message: "Permission denied." }, 403);
  }

  const schoolId = adminProfile.school_id;

  if (!schoolId) {
    return respond(
      {
        success: false,
        message: "Your profile is not linked to a school.",
      },
      400,
    );
  }

  const { data: schoolIsActive, error: schoolStatusError } =
  await authClient.rpc("is_school_active", {
    target_school_id: schoolId,
  });

if (schoolStatusError) {
  console.error("Could not verify school status:", schoolStatusError.message);
  return respond(
    { success: false, message: "Could not verify the school's status. Try again." },
    503,
  );
}

if (schoolIsActive !== true) {
  return respond(
    { success: false, message: "This school is inactive. Student promotion is unavailable until it is reactivated." },
    403,
  );
}

  let body: Record<string, unknown>;

  try {
    body = await request.json();
  } catch {
    return respond({ success: false, message: "Request body must be valid JSON." }, 400);
  }

  const createdAuthUserIds: string[] = [];

  try {
    const requestedSchoolId = body.school_id;
    if (requestedSchoolId && requestedSchoolId !== schoolId) {
      return respond(
        {
          success: false,
          message: "Requested school does not match your profile.",
        },
        403,
      );
    }

    const rawEnrollmentIds = Array.isArray(body.enrollment_ids)
      ? body.enrollment_ids
      : Array.isArray(body.enrollmentIds)
        ? body.enrollmentIds
        : [];

    if (
      rawEnrollmentIds.length !== 1 ||
      rawEnrollmentIds.some((id) => typeof id !== "string" || !id)
    ) {
      return respond(
        {
          success: false,
          message: "Provide exactly one valid Grade 9 enrollment ID.",
        },
        400,
      );
    }

    const sourceEnrollmentId = rawEnrollmentIds[0] as string;
    const targetAcademicYearId =
      body.target_academic_year_id ?? body.targetAcademicYearId;
    const targetClassId = body.target_class_id ?? body.targetClassId;
    const feeStructureId =
      body.fee_structure_id ?? body.feeStructureId;

    if (
      typeof targetAcademicYearId !== "string" ||
      !targetAcademicYearId ||
      typeof targetClassId !== "string" ||
      !targetClassId ||
      typeof feeStructureId !== "string" ||
      !feeStructureId
    ) {
      return respond(
        {
          success: false,
          message:
            "Target academic year, Grade 10 class, and fee structure are required.",
        },
        400,
      );
    }

    const email =
      typeof body.email === "string" ? body.email.trim() : "";
    const password =
      typeof body.password === "string" ? body.password : "";
    const phoneValue = body.phone_number ?? body.phone ?? null;
    const phoneNumber =
      typeof phoneValue === "string" ? phoneValue.trim() || null : null;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return respond(
        { success: false, message: "A valid student email is required." },
        400,
      );
    }

    if (password.length < 12) {
      return respond(
        {
          success: false,
          message: "The student password must be at least 12 characters.",
        },
        400,
      );
    }

    const { data: sourceEnrollment, error: sourceEnrollmentError } =
      await adminClient
        .from("student_enrollments")
        .select(
          "id, student_id, school_id, academic_year_id, term_id, classes(name, school_id)",
        )
        .eq("id", sourceEnrollmentId)
        .eq("school_id", schoolId)
        .maybeSingle();

    if (sourceEnrollmentError) {
      throw new Error(
        `Could not load source enrollment: ${sourceEnrollmentError.message}`,
      );
    }

    if (!sourceEnrollment) {
      return respond(
        {
          success: false,
          message: "The selected enrollment was not found in your school.",
        },
        404,
      );
    }

    const sourceClass = getClassRelation(sourceEnrollment.classes);

    if (
      sourceClass?.school_id !== schoolId ||
      getGradeNumber(sourceClass?.name ?? "") !== 9
    ) {
      return respond(
        {
          success: false,
          message:
            "The selected student must have a Grade 9 enrollment in your school.",
        },
        400,
      );
    }

    const studentId = sourceEnrollment.student_id;

    const { data: student, error: studentError } = await adminClient
      .from("students")
      .select("id, school_id")
      .eq("id", studentId)
      .eq("school_id", schoolId)
      .maybeSingle();

    if (studentError) {
      throw new Error(`Could not load student: ${studentError.message}`);
    }

    if (!student) {
      return respond(
        {
          success: false,
          message: "The selected student does not belong to this school.",
        },
        404,
      );
    }

    const { data: targetYear, error: targetYearError } = await adminClient
      .from("academic_years")
      .select("id, year_label, school_id, status")
      .eq("id", targetAcademicYearId)
      .eq("school_id", schoolId)
      .ilike("status", "active")
      .maybeSingle();

    if (targetYearError) {
      throw new Error(
        `Could not load target academic year: ${targetYearError.message}`,
      );
    }

    if (!targetYear) {
      return respond(
        {
          success: false,
          message: "The target academic year must be active and belong to your school.",
        },
        404,
      );
    }

    if (sourceEnrollment.academic_year_id === targetYear.id) {
      return respond(
        {
          success: false,
          message:
            "The student must be promoted from an academic year different from the active target year.",
        },
        400,
      );
    }

    const { data: targetTerms, error: targetTermsError } = await adminClient
      .from("terms")
      .select("id, name")
      .eq("school_id", schoolId)
      .eq("academic_year_id", targetYear.id);

    if (targetTermsError) {
      throw new Error(
        `Could not load target-year terms: ${targetTermsError.message}`,
      );
    }

    const targetFirstTerms = (targetTerms ?? []).filter((term) =>
      matchesFirstTerm(term.name ?? "")
    );

    if (targetFirstTerms.length !== 1) {
      return respond(
        {
          success: false,
          message:
            "The target academic year must have exactly one first term.",
        },
        409,
      );
    }

    const targetFirstTermId = targetFirstTerms[0].id;

    const { data: targetClass, error: targetClassError } = await adminClient
      .from("classes")
      .select("id, name, school_id, status")
      .eq("id", targetClassId)
      .eq("school_id", schoolId)
      .maybeSingle();

    if (targetClassError) {
      throw new Error(
        `Could not load target class: ${targetClassError.message}`,
      );
    }

    if (!targetClass) {
      return respond(
        {
          success: false,
          message: "Target class was not found in your school.",
        },
        404,
      );
    }

    if (
      String(targetClass.status).toLowerCase() !== "active" ||
      getGradeNumber(targetClass.name ?? "") !== 10
    ) {
      return respond(
        {
          success: false,
          message: "Target class must be an active Grade 10 class.",
        },
        400,
      );
    }

    const { data: feeStructure, error: feeError } = await adminClient
      .from("fee_structures")
      .select(
        "id, school_id, class_id, academic_year_id, term_id, total_amount, status",
      )
      .eq("id", feeStructureId)
      .eq("school_id", schoolId)
      .maybeSingle();

    if (feeError) {
      throw new Error(`Could not load fee structure: ${feeError.message}`);
    }

    if (!feeStructure) {
      return respond(
        {
          success: false,
          message: "Fee structure was not found in your school.",
        },
        404,
      );
    }

    if (
      feeStructure.class_id !== targetClass.id ||
      feeStructure.academic_year_id !== targetYear.id ||
      feeStructure.term_id !== targetFirstTermId ||
      String(feeStructure.status).toLowerCase() !== "active"
    ) {
      return respond(
        {
          success: false,
          message:
            "Fee structure must be active and match the target Grade 10 class, target year, and first term.",
        },
        400,
      );
    }

    const { data: existingEnrollment, error: duplicateCheckError } =
      await adminClient
        .from("student_enrollments")
        .select("id")
        .eq("student_id", studentId)
        .eq("school_id", schoolId)
        .eq("academic_year_id", targetYear.id)
        .eq("term_id", targetFirstTermId)
        .maybeSingle();

    if (duplicateCheckError) {
      throw new Error(
        `Could not check for an existing target enrollment: ${duplicateCheckError.message}`,
      );
    }

    if (existingEnrollment) {
      return respond(
        {
          success: false,
          message:
            "This student is already enrolled in the target year and first term.",
        },
        409,
      );
    }

    const { data: existingAuth, error: authLookupError } =
      await adminClient.auth.admin.getUserById(studentId);

    if (
      authLookupError &&
      !/not found|user not found/i.test(authLookupError.message)
    ) {
      throw new Error(
        `Could not check the student's Auth account: ${authLookupError.message}`,
      );
    }

    if (
      existingAuth.user &&
      existingAuth.user.email?.toLowerCase() !== email.toLowerCase()
    ) {
      return respond(
        {
          success: false,
          message:
            "This student already has an Auth account with a different email.",
        },
        409,
      );
    }

    if (!existingAuth.user) {
      const { data: createdUser, error: createUserError } =
        await adminClient.auth.admin.createUser({
          id: studentId,
          email,
          password,
          email_confirm: true,
          user_metadata: {
            school_id: schoolId,
            role: "student",
          },
        });

      if (createUserError) {
        throw new Error(`Student Auth account creation failed: ${createUserError.message}`);
      }

      if (createdUser.user?.id) {
        createdAuthUserIds.push(createdUser.user.id);
      }
    }

    // The database transaction revalidates the source and target records and
    // atomically creates the new enrollment and fee record.
    // public.promote_grade9_students_to_new_academic_year_transaction(
    //   p_school_id uuid,
    //   p_source_enrollment_id uuid,
    //   p_student_id uuid,
    //   p_source_academic_year_id uuid,
    //   p_target_class_id uuid,
    //   p_target_academic_year_id uuid,
    //   p_target_term_id uuid,
    //   p_fee_structure_id uuid,
    //   p_email text,
    //   p_phone_number text
    // )
    const { data: promotionResult, error: promotionError } =
      await adminClient.rpc(
        "promote_grade9_students_to_new_academic_year_transaction",
        {
          p_school_id: schoolId,
          p_source_enrollment_id: sourceEnrollment.id,
          p_student_id: studentId,
          p_source_academic_year_id: sourceEnrollment.academic_year_id,
          p_target_class_id: targetClass.id,
          p_target_academic_year_id: targetYear.id,
          p_target_term_id: targetFirstTermId,
          p_fee_structure_id: feeStructure.id,
          p_email: email,
          p_phone_number: phoneNumber,
        },
      );

    if (promotionError) {
      throw new Error(`Yearly promotion transaction failed: ${promotionError.message}`);
    }

    if (!promotionResult?.success) {
      throw new Error(
        promotionResult?.message ?? "Yearly promotion transaction failed.",
      );
    }

    return respond({
      success: true,
      message: "Student promoted to Grade 10 for the new academic year.",
      student_id: studentId,
      target_academic_year_id: targetYear.id,
      target_class_id: targetClass.id,
      target_term_id: targetFirstTermId,
    });
  } catch (error) {
    const rollbackErrors: string[] = [];

    for (const userId of createdAuthUserIds.reverse()) {
      const { error: deleteError } =
        await adminClient.auth.admin.deleteUser(userId);

      if (deleteError) {
        rollbackErrors.push(`Auth user ${userId}: ${deleteError.message}`);
      }
    }

    const message =
      error instanceof Error ? error.message : "Internal server error.";

    console.error(
      "Yearly Grade 9 to 10 promotion failed:",
      message,
      rollbackErrors,
    );

    return respond(
      {
        success: false,
        message: rollbackErrors.length
          ? `${message} Auth cleanup also failed; contact an administrator.`
          : message,
      },
      500,
    );
  }
});
