let parentInviteStudents = [];
let parentInviteLinks = [];
document.addEventListener("DOMContentLoaded", initializeParentInvitations);

async function initializeParentInvitations() {
  const client = window.supabaseClient;
  const form = document.getElementById("parentInviteForm");
  const select = document.getElementById("parentStudentSelect");
  const search = document.getElementById("parentStudentSearch");
  if (!client || !form || !select || !search) return;

  try {
    const {
      data: { user },
      error: authError,
    } = await client.auth.getUser();
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
    if (
      !(
        ["admin", "accountant"].includes(profile.role) &&
        String(profile.status).toLowerCase() === "active"
      )
    ) {
      document.getElementById("parentInviteMessage").textContent =
        "Only active administrators and accountants can invite parents.";
      form.hidden = true;
      return;
    }

    const { data: students, error: studentsError } = await client
      .from("students")
      .select("id, student_id, profiles(full_name)")
      .eq("school_id", profile.school_id);
    if (studentsError) throw studentsError;
    parentInviteStudents = [...(students || [])].sort((a, b) =>
      String(a.profiles?.full_name || "").localeCompare(
        String(b.profiles?.full_name || ""),
        undefined,
        { sensitivity: "base" },
      ),
    );
    renderParentInviteStudentOptions(select, search.value);
    search.addEventListener("input", () =>
      renderParentInviteStudentOptions(select, search.value),
    );
    document
      .getElementById("parentLinkSearch")
      ?.addEventListener("input", (event) =>
        renderParentLinks(event.currentTarget.value),
      );
    await loadParentLinks();
  } catch (error) {
    console.error("Could not initialize parent invitations:", error);
    showParentInviteMessage(
      "Could not load students. Refresh the page or contact an administrator.",
      true,
    );
    return;
  }

  form.addEventListener("submit", sendParentInvitation);
}

async function loadParentLinks() {
  const list = document.getElementById("parentLinksList");
  if (!list) return;
  list.setAttribute("aria-busy", "true");
  try {
    const { data, error } = await window.supabaseClient.functions.invoke(
      "manage-parent-links",
      {
        body: { action: "list" },
      },
    );
    if (error) {
      let detailedMsg = error.message;
      try {
        // If the error response contains JSON data from the Edge Function
        const errContext = await error.context?.json();
        if (errContext?.message) detailedMsg = errContext.message;
      } catch (_) {}
      throw new Error(detailedMsg);
    }
    if (!data?.success)
      throw new Error(data?.message || "Could not load parent links.");

    parentInviteLinks = data.links || [];
    const search = document.getElementById("parentLinkSearch");
    if (search) search.hidden = parentInviteLinks.length === 0;
    renderParentLinks(search?.value || "");
  } catch (error) {
    console.error("Could not load parent links:", error);
    // This will now display the exact error message (like your tier 403 error) right on the screen
    list.innerHTML = `<p class="parent-state" style="color: grey;">Error: ${error.message}</p>`;
  } finally {
    list.setAttribute("aria-busy", "false");
  }
}

function renderParentLinks(query = "") {
  const list = document.getElementById("parentLinksList");
  if (!list) return;
  if (!parentInviteLinks.length) {
    list.innerHTML =
      '<p class="parent-state">No active parent links for this school.</p>';
    return;
  }
  const links = parentInviteLinks.filter((link) =>
    matchesParentLinkSearch(link, query),
  );
  if (!links.length) {
    list.innerHTML =
      '<p class="parent-state">No parent links match your search.</p>';
    return;
  }
  list.replaceChildren(
    ...links.map((link) => {
      const row = document.createElement("div");
      row.className = "parent-link-row";
      const details = document.createElement("div");
      const parent = document.createElement("strong");
      parent.textContent = link.parent_name || link.parent_email || "Parent";
      const student = document.createElement("span");
      student.textContent = `${link.student_name || "Student"}${link.student_code ? ` · ${link.student_code}` : ""} · ${link.relationship || "Parent"}`;
      details.append(parent, student);
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Unlink";
      button.setAttribute(
        "aria-label",
        `Unlink ${parent.textContent} from ${link.student_name || "student"}`,
      );
      button.addEventListener("click", () => unlinkParentStudent(link, button));
      row.append(details, button);
      return row;
    }),
  );
}

function matchesParentLinkSearch(link, query) {
  const normalizedQuery = String(query || "")
    .trim()
    .toLocaleLowerCase();
  if (!normalizedQuery) return true;
  const searchableText = [
    link.parent_name,
    link.parent_email,
    link.student_name,
    link.student_code,
    link.relationship,
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase();
  return searchableText.includes(normalizedQuery);
}

async function unlinkParentStudent(link, button) {
  const parentLabel = link.parent_name || link.parent_email || "this parent";
  if (!(await confirmParentUnlink(link))) return;
  button.disabled = true;
  try {
    const { data, error } = await window.supabaseClient.functions.invoke(
      "manage-parent-links",
      {
        body: { action: "unlink", link_id: link.id },
      },
    );
    if (error) {
      let detailedMsg = error.message;
      try {
        const errContext = await error.context?.json();
        if (errContext?.message) detailedMsg = errContext.message;
      } catch (_) {}
      throw new Error(detailedMsg);
    }

    if (!data?.success) {
      throw new Error(data?.message || "Could not unlink the parent.");
    }

    showParentInviteMessage(data.message || "Parent unlinked.", false, true);
    await loadParentLinks();
  } catch (error) {
    console.error("Unlink failed:", error);
    showParentInviteMessage(error.message, true, true); // Displays the exact error message on your UI
  }

  button.disabled = false;
}

function confirmParentUnlink(link) {
  const dialog = document.getElementById("parentUnlinkDialog");
  const message = document.getElementById("parentUnlinkMessage");
  if (!dialog || !message || typeof dialog.showModal !== "function")
    return Promise.resolve(false);
  const parent = link.parent_name || link.parent_email || "this parent";
  const student = link.student_name || "this student";
  message.textContent = `Remove ${parent}'s access to ${student}? They will no longer be able to view this student's school records.`;
  return new Promise((resolve) => {
    dialog.addEventListener(
      "close",
      () => resolve(dialog.returnValue === "confirm"),
      { once: true },
    );
    dialog.showModal();
  });
}

async function sendParentInvitation(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;

  const client = window.supabaseClient;
  const button = document.getElementById("sendParentInvite");
  const body = Object.fromEntries(new FormData(form).entries());
  body.email = String(body.email || "")
    .trim()
    .toLowerCase();
  showParentInviteMessage("Sending the invitation…");
  button.disabled = true;

  try {
    const { data, error } = await client.functions.invoke("invite-parent", {
      body,
    });
    if (error) {
      let detailedMsg = error.message;
      try {
        const errContext = await error.context?.json();
        if (errContext?.message) detailedMsg = errContext.message;
      } catch (_) {}
      throw new Error(detailedMsg);
    }

    if (!data?.success) {
      throw new Error(data?.message || "The invitation could not be sent.");
    }

    showParentInviteMessage(data.message, false, true);
    form.reset();
    const select = document.getElementById("parentStudentSelect");
    select.selectedIndex = 0;
    renderParentInviteStudentOptions(select, "");
  } catch (error) {
    let message = error?.message || "The invitation could not be sent.";
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
  const normalizedQuery = String(query || "")
    .trim()
    .toLocaleLowerCase();
  if (!normalizedQuery) return [...students];
  return students.filter((student) => {
    const searchableText =
      `${student.profiles?.full_name || ""} ${student.student_id || ""}`.toLocaleLowerCase();
    return searchableText.includes(normalizedQuery);
  });
}

function renderParentInviteStudentOptions(select, query) {
  const selectedId = select.value;
  const filteredStudents = filterParentInviteStudents(
    parentInviteStudents,
    query,
  );
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
  if (filteredStudents.some((student) => student.id === selectedId))
    select.value = selectedId;
}

function escapeParentInvite(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character],
  );
}
