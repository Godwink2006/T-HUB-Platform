let parentInviteStudents = [];
document.addEventListener("DOMContentLoaded", initializeParentInvitations);

async function initializeParentInvitations() {
  const client = window.supabaseClient;
  const form = document.getElementById("parentInviteForm");
  const select = document.getElementById("parentStudentSelect");
  const search = document.getElementById("parentStudentSearch");
  if (!client || !form || !select || !search) return;

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
    parentInviteStudents = [...(students || [])].sort((a, b) =>
      String(a.profiles?.full_name || "").localeCompare(String(b.profiles?.full_name || ""), undefined, { sensitivity: "base" }),
    );
    renderParentInviteStudentOptions(select, search.value);
    search.addEventListener("input", () => renderParentInviteStudentOptions(select, search.value));
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
    const select = document.getElementById("parentStudentSelect");
    select.selectedIndex = 0;
    renderParentInviteStudentOptions(select, "");
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

function filterParentInviteStudents(students, query) {
  const normalizedQuery = String(query || "").trim().toLocaleLowerCase();
  if (!normalizedQuery) return [...students];
  return students.filter((student) => {
    const searchableText = `${student.profiles?.full_name || ""} ${student.student_id || ""}`.toLocaleLowerCase();
    return searchableText.includes(normalizedQuery);
  });
}

function renderParentInviteStudentOptions(select, query) {
  const selectedId = select.value;
  const filteredStudents = filterParentInviteStudents(parentInviteStudents, query);
  select.replaceChildren(new Option("Choose a student", ""));
  filteredStudents.forEach((student) => {
    const name = student.profiles?.full_name || "Student";
    const label = student.student_id ? `${name} · ${student.student_id}` : name;
    select.add(new Option(label, student.id));
  });
  if (!filteredStudents.length) {
    const emptyOption = new Option("No students match your search", "");
    emptyOption.disabled = true;
    select.add(emptyOption);
  }
  if (filteredStudents.some((student) => student.id === selectedId)) select.value = selectedId;
}

function escapeParentInvite(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}
