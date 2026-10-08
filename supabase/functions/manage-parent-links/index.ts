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

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return respond({ success: false, message: "POST is required." }, 405);

  const authorization = request.headers.get("Authorization");
  if (!authorization) return respond({ success: false, message: "Sign in to manage parent links." }, 401);

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser();
  if (authError || !authData.user) return respond({ success: false, message: "Your session is invalid or expired." }, 401);

  const { data: staff, error: staffError } = await adminClient
    .from("profiles").select("role, status, school_id").eq("id", authData.user.id).single();
  if (staffError || !staff || !["admin", "accountant"].includes(staff.role) || String(staff.status).toLowerCase() !== "active") {
    return respond({ success: false, message: "Only active administrators and accountants can manage parent links." }, 403);
  }
  if (!staff.school_id) return respond({ success: false, message: "Your staff profile is not linked to a school." }, 400);

  try {
    const body = await request.json();
    if (body.action === "list") {
      const { data: links, error } = await adminClient.from("parent_student_links")
        .select("id, parent_user_id, student_id, parent_email, relationship")
        .eq("school_id", staff.school_id).eq("status", "active").order("created_at", { ascending: false });
      if (error) throw error;
      const studentIds = [...new Set((links || []).map((link) => link.student_id))];
      const parentIds = [...new Set((links || []).map((link) => link.parent_user_id))];
      let students = [];
      let parents = [];
      if (studentIds.length) {
        const result = await adminClient.from("students").select("id, student_id, profiles(full_name)").in("id", studentIds);
        if (result.error) throw result.error;
        students = result.data || [];
      }
      if (parentIds.length) {
        const result = await adminClient.from("profiles").select("id, full_name").in("id", parentIds);
        if (result.error) throw result.error;
        parents = result.data || [];
      }
      const studentById = new Map(students.map((student) => [student.id, student]));
      const parentById = new Map(parents.map((parent) => [parent.id, parent]));
      return respond({ success: true, links: (links || []).map((link) => ({
        id: link.id,
        parent_email: link.parent_email,
        parent_name: parentById.get(link.parent_user_id)?.full_name || "",
        student_name: studentById.get(link.student_id)?.profiles?.full_name || "Student",
        student_code: studentById.get(link.student_id)?.student_id || "",
        relationship: link.relationship,
      })) });
    }

    if (body.action === "unlink") {
      const linkId = typeof body.link_id === "string" ? body.link_id : "";
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(linkId)) {
        return respond({ success: false, message: "Choose a valid parent link." }, 400);
      }
      const { data: link, error: lookupError } = await adminClient.from("parent_student_links")
        .select("id").eq("id", linkId).eq("school_id", staff.school_id).eq("status", "active").maybeSingle();
      if (lookupError) throw lookupError;
      if (!link) return respond({ success: false, message: "That active parent link was not found in your school." }, 404);
      const { error: updateError } = await adminClient.from("parent_student_links")
        .update({ status: "revoked", updated_at: new Date().toISOString() })
        .eq("id", link.id).eq("school_id", staff.school_id).eq("status", "active");
      if (updateError) throw updateError;
      return respond({ success: true, message: "Parent access to this student has been removed." });
    }

    return respond({ success: false, message: "Choose a valid action." }, 400);
  } catch (error) {
    console.error("Parent link management failed:", error);
    return respond({ success: false, message: "Could not manage parent links. Try again or contact the system administrator." }, 500);
  }
});
