import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const appSiteUrl = Deno.env.get("APP_SITE_URL");

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function respond(body: unknown, status = 200) {
  return Response.json(body, { status, headers: corsHeaders });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return respond({ success: false, message: "POST is required." }, 405);

  const authorization = request.headers.get("Authorization");
  if (!authorization) return respond({ success: false, message: "Sign in to invite a parent." }, 401);

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser();
  if (authError || !authData.user) return respond({ success: false, message: "Your session is invalid or expired." }, 401);

  const { data: staff, error: staffError } = await adminClient
    .from("profiles")
    .select("role, status, school_id")
    .eq("id", authData.user.id)
    .single();
  if (staffError || !staff || !["admin", "accountant"].includes(staff.role) ||
      String(staff.status).toLowerCase() !== "active") {
    return respond({ success: false, message: "Only active school administrators and accountants can invite parents." }, 403);
  }
  if (!staff.school_id) return respond({ success: false, message: "Your staff profile is not linked to a school." }, 400);
  if (!appSiteUrl) return respond({ success: false, message: "Parent invitations are not configured. Contact the system administrator." }, 503);

  let invitedAuthUserId: string | null = null;
  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const fullName = typeof body.full_name === "string" ? body.full_name.trim() : "";
    const studentId = typeof body.student_id === "string" ? body.student_id.trim() : "";
    const relationship = ["Parent", "Guardian", "Other"].includes(body.relationship)
      ? body.relationship
      : "Parent";

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return respond({ success: false, message: "Enter a valid parent email address." }, 400);
    }
    if (!fullName || fullName.length > 120) {
      return respond({ success: false, message: "Enter the parent's name (up to 120 characters)." }, 400);
    }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(studentId)) {
      return respond({ success: false, message: "Choose a valid student." }, 400);
    }

    const { data: student, error: studentError } = await adminClient
      .from("students")
      .select("id, school_id")
      .eq("id", studentId)
      .eq("school_id", staff.school_id)
      .maybeSingle();
    if (studentError) throw new Error(`Could not verify the student: ${studentError.message}`);
    if (!student) return respond({ success: false, message: "That student is not in your school." }, 404);

    const { data: existingLink, error: linkLookupError } = await adminClient
      .from("parent_student_links")
      .select("parent_user_id")
      .eq("parent_email", email)
      .limit(1)
      .maybeSingle();
    if (linkLookupError) throw new Error(`Could not check existing parent links: ${linkLookupError.message}`);

    let parentUserId = existingLink?.parent_user_id ?? null;
    let isNewAuthUser = false;
    if (parentUserId) {
      const { data: parentProfile, error: parentError } = await adminClient
        .from("profiles")
        .select("role, status")
        .eq("id", parentUserId)
        .single();
      if (parentError || parentProfile?.role !== "parent" || String(parentProfile.status).toLowerCase() !== "active") {
        return respond({ success: false, message: "The existing account linked to this email is not an active parent account." }, 409);
      }
    } else {
      const { data: invitation, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
        data: { full_name: fullName },
        redirectTo: new URL("/html/parent-set-password.html", appSiteUrl).toString(),
      });
      if (inviteError || !invitation.user) {
        const message = /already|registered|exists/i.test(inviteError?.message || "")
          ? "This email already has an account. Ask an administrator to verify that account before linking it as a parent."
          : inviteError?.message || "The invitation could not be sent.";
        return respond({ success: false, message }, 409);
      }
      parentUserId = invitation.user.id;
      invitedAuthUserId = parentUserId;
      isNewAuthUser = true;

      const { error: profileError } = await adminClient.from("profiles").upsert({
        id: parentUserId,
        full_name: fullName,
        role: "parent",
        status: "active",
        school_id: staff.school_id,
      }, { onConflict: "id" });
      if (profileError) throw new Error(`The parent account was invited, but its profile could not be created: ${profileError.message}`);
    }

    const { error: linkError } = await adminClient.from("parent_student_links").upsert({
      parent_user_id: parentUserId,
      student_id: student.id,
      school_id: staff.school_id,
      parent_email: email,
      relationship,
      status: "active",
      approved_by: authData.user.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: "student_id,parent_email" });
    if (linkError) throw new Error(`The parent account exists, but the student link could not be saved: ${linkError.message}`);

    invitedAuthUserId = null;
    return respond({
      success: true,
      invited: isNewAuthUser,
      message: isNewAuthUser
        ? "Invitation sent. The parent can set a password from their email and sign in to the parent dashboard."
        : "This student was added to the existing parent account.",
    });
  } catch (error) {
    if (invitedAuthUserId) {
      const { error: cleanupError } = await adminClient.auth.admin.deleteUser(invitedAuthUserId);
      if (cleanupError) console.error("Could not remove incomplete invited account:", cleanupError.message);
    }
    const message = error instanceof Error ? error.message : "The parent invitation failed.";
    console.error("Parent invitation failed:", message);
    return respond({ success: false, message }, 500);
  }
});
