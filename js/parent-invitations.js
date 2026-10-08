document.addEventListener("DOMContentLoaded", initializeParentInvitations);

async function initializeParentInvitations() {
  const client = window.supabaseClient;
  const form = document.getElementById("parentInviteForm");
  const select = document.getElementById("parentStudentSelect");
  if (!client || !form || !select) return;

  try {
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) {
      window.location.replace("/index.html");
      return;
    }
    const { data: profile, error: profileError } = await client
      .from("profiles")
      .select("role, status, school_id")
      .eq("id", user.id)
      .single();
    if (profileError) throw profileError;
    if (!(["admin", "accountant"].includes(profile.role) && String(profile.status).toLowerCase() === "active")) {
      document.getElementById("parentInviteMessage").textContent = "Only active administrators and accountants can invite parents.";
      form.hidden = true;
      return;
    }

    const { data: students, error: studentsError } = await client
      .from("students")
      .select("id, student_id, profiles(full_name)")
      .eq("school_id", profile.school_id);
    if (studentsError) throw studentsError;
    const sortedStudents = [...(students || [])].sort((a, b) =>
      String(a.profiles?.full_name || "").localeCompare(String(b.profiles?.full_name || ""), undefined, { sensitivity: "base" }),
    );
    select.innerHTML = '<option value="">Choose a student</option>' + sortedStudents.map((student) => {
      const name = student.profiles?.full_name || "Student";
      return `<option value="${escapeParentInvite(student.id)}">${escapeParentInvite(name)}${student.student_id ? ` · ${escapeParentInvite(student.student_id)}` : ""}</option>`;
    }).join("");
  } catch (error) {
    console.error("Could not initialize parent invitations:", error);
    showParentInviteMessage("Could not load students. Refresh the page or contact an administrator.", true);
    return;
  }

  form.addEventListener("submit", sendParentInvitation);
}

async function sendParentInvitation(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;

  const client = window.supabaseClient;
  const button = document.getElementById("sendParentInvite");
  const body = Object.fromEntries(new FormData(form).entries());
  body.email = String(body.email || "").trim().toLowerCase();
  showParentInviteMessage("Sending the invitation…");
  button.disabled = true;

  try {
    const { data, error } = await client.functions.invoke("invite-parent", { body });
    if (error || !data?.success) throw new Error(data?.message || error?.message || "The invitation could not be sent.");
    showParentInviteMessage(data.message, false, true);
    form.reset();
    document.getElementById("parentStudentSelect").selectedIndex = 0;
  } catch (error) {
    let message = error?.message || "The invitation could not be sent.";
    if (error?.context) {
      try {
        const details = await error.context.json();
        message = details.message || message;
      } catch { /* Keep the Functions client error. */ }
    }
    showParentInviteMessage(message, true);
  } finally {
    button.disabled = false;
  }
}

function showParentInviteMessage(message, isError = false, isSuccess = false) {
  const element = document.getElementById("parentInviteMessage");
  if (!element) return;
  element.textContent = message;
  element.classList.toggle("is-error", isError);
  element.classList.toggle("is-success", isSuccess);
}

function escapeParentInvite(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}
