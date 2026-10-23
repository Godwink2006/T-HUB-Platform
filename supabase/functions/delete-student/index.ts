import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return typeof error === "string" && error.trim()
    ? error
    : "Student deletion failed. Check the Edge Function logs for details.";
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ success: false, message: "Method not allowed." }, 405);
  }

  const authorization = request.headers.get("Authorization");
  if (!authorization) {
    return jsonResponse({ success: false, message: "Missing authorization header." }, 401);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let authUserDeleted = false;
  let studentId = "";

  try {
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return jsonResponse({ success: false, message: "Your session is invalid. Sign in again." }, 401);
    }

    const { data: adminProfile, error: profileError } = await adminClient
      .from("profiles")
      .select("role, status, school_id")
      .eq("id", user.id)
      .maybeSingle();

    if (
      profileError ||
      !adminProfile ||
      adminProfile.role !== "admin" ||
      adminProfile.status !== "active" ||
      !adminProfile.school_id
    ) {
      return jsonResponse({ success: false, message: "Only an active school admin can delete students." }, 403);
    }

    const { data: schoolIsActive, error: schoolStatusError } = await userClient.rpc(
      "is_school_active",
      { target_school_id: adminProfile.school_id },
    );
    if (schoolStatusError) {
      throw new Error(`Could not verify the school's status: ${schoolStatusError.message}`);
    }
    if (schoolIsActive !== true) {
      return jsonResponse({
        success: false,
        message: "This school is inactive. Student deletion is unavailable until the school is reactivated.",
      }, 403);
    }

    let body: { student_id?: unknown };
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ success: false, message: "Request body must be valid JSON." }, 400);
    }

    studentId = typeof body.student_id === "string" ? body.student_id : "";
    if (!uuidPattern.test(studentId)) {
      return jsonResponse({ success: false, message: "A valid student ID is required." }, 400);
    }

    const { data: targetProfile, error: targetError } = await adminClient
      .from("profiles")
      .select("id, full_name, photo_url")
      .eq("id", studentId)
      .eq("school_id", adminProfile.school_id)
      .eq("role", "student")
      .maybeSingle();

    if (targetError || !targetProfile) {
      return jsonResponse({ success: false, message: "Student not found in your school." }, 404);
    }

    const { data: preflight, error: preflightError } = await userClient.rpc(
      "admin_delete_student_data",
      {
        p_student_id: studentId,
        p_school_id: adminProfile.school_id,
        p_execute: false,
      },
    );

    if (preflightError) throw preflightError;
    if (!preflight?.can_delete) {
      return jsonResponse({
        success: false,
        message: "This profile is still referenced by staff or transfer administration records.",
        blockers: preflight?.blockers || [],
      }, 409);
    }

    // A student may have a login account or only a school profile. Check Auth
    // by the shared profile ID; an email or current class is not a reliable signal.
    const { data: authResult, error: authLookupError } = await adminClient.auth.admin
      .getUserById(studentId);

    if (authLookupError && authLookupError.status !== 404) {
      throw new Error(`Could not check the student's login account: ${authLookupError.message}`);
    }

    // Auth is a separate service and cannot participate in the database
    // transaction. Complete the atomic database deletion first so an RPC
    // failure never removes the student's login while leaving their records.
    const { data: deletionResult, error: deletionError } = await userClient.rpc(
      "admin_delete_student_data",
      {
        p_student_id: studentId,
        p_school_id: adminProfile.school_id,
        p_execute: true,
      },
    );

    if (deletionError) {
      return jsonResponse({
        success: false,
        partial: false,
        auth_account_deleted: false,
        message: deletionError.message,
      }, 409);
    }

    if (authResult?.user) {
      const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(studentId);
      if (deleteAuthError) {
        return jsonResponse({
          success: false,
          partial: true,
          student_records_deleted: true,
          auth_account_deleted: false,
          message: "Student records were deleted, but the login account could not be removed. Contact the system administrator to finish account cleanup.",
        }, 502);
      }
      authUserDeleted = true;
    }

    const warnings: string[] = [];
    const photoUrl = targetProfile.photo_url;
    if (typeof photoUrl === "string") {
      try {
        const photoPath = new URL(photoUrl).pathname;
        const bucketMarker = "/storage/v1/object/public/avatars/";
        const markerIndex = photoPath.indexOf(bucketMarker);
        if (markerIndex >= 0) {
          const objectPath = decodeURIComponent(photoPath.slice(markerIndex + bucketMarker.length));
          if (objectPath.startsWith(`student-${studentId}-`)) {
            const { error: storageError } = await adminClient.storage
              .from("avatars")
              .remove([objectPath]);
            if (storageError) warnings.push("Student was deleted, but their avatar file could not be removed.");
          }
        }
      } catch (storageError) {
        console.error("Could not remove student avatar:", storageError);
        warnings.push("Student was deleted, but their avatar file could not be removed.");
      }
    }

    return jsonResponse({
      success: true,
      message: "Student and linked records deleted.",
      student: deletionResult,
      auth_account_deleted: authUserDeleted,
      warnings,
    });
  } catch (error) {
    console.error("Student deletion failed:", error);
    return jsonResponse({
      success: false,
      partial: authUserDeleted,
      auth_account_deleted: authUserDeleted,
      message: getErrorMessage(error),
    }, 500);
  }
});
