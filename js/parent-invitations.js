let parentInviteStudents = [];
let parentInviteLinks = [];
document.addEventListener("DOMContentLoaded", initializeParentInvitations);

async function initializeParentInvitations() {
  setupParentUnlinkDialog();

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

function setupParentUnlinkDialog() {
  const dialog = document.getElementById("parentUnlinkDialog");
  if (!dialog) return;

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close("cancel");
  });
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
    const message = document.createElement("p");
    message.className = "parent-state is-error";
    message.textContent = `Error: ${error.message}`;
    list.replaceChildren(message);
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

  const DEFAULT_AVATAR =
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128' width='44' height='44'><circle cx='64' cy='64' r='64' fill='%23E4E6EB'/><circle cx='64' cy='46' r='22' fill='%23B0B3B8'/><path d='M24 112c0-22 18-40 40-40s40 18 40 40' fill='%23B0B3B8'/></svg>";

  list.replaceChildren(
    ...links.map((link) => {
      const row = document.createElement("div");
      row.className = "parent-link-row";

      // 1. Stacked Avatars (Parent with small Student badge)
      const avatarStack = document.createElement("div");
      avatarStack.className = "parent-student-avatar-stack";
      avatarStack.style.cssText =
        "position: relative; width: 44px; height: 44px; flex-shrink: 0;";

      const parentAvatar = document.createElement("img");
      parentAvatar.src = link.parent_photo || DEFAULT_AVATAR;
      parentAvatar.alt = link.parent_name || "Parent";
      parentAvatar.title = `Parent: ${link.parent_name || link.parent_email}`;
      parentAvatar.style.cssText =
        "width: 44px; height: 44px; border-radius: 50%; object-fit: cover; display: block;";

      const studentAvatar = document.createElement("img");
      studentAvatar.src = link.student_photo || DEFAULT_AVATAR;
      studentAvatar.alt = link.student_name || "Student";
      studentAvatar.title = `Student: ${link.student_name || "Student"}`;
      studentAvatar.style.cssText =
        "position: absolute; bottom: -2px; right: -2px; width: 22px; height: 22px; border-radius: 50%; object-fit: cover; border: 0.5px solid #ffffff; box-shadow: 0 1px 3px rgba(0,0,0,0.2); background-color: #f1f5f9;";

      avatarStack.append(parentAvatar, studentAvatar);

      // 2. Details (Declared BEFORE row.append)
      const details = document.createElement("div");

      const parent = document.createElement("strong");
      parent.textContent = link.parent_name || link.parent_email || "Parent";

      const contactInfo = document.createElement("small");
      contactInfo.style.cssText =
        "display: block; color: #64748b; font-size: 13px;";
      contactInfo.textContent = [link.parent_email, link.parent_phone]
        .filter(Boolean)
        .join(" · ");

      const student = document.createElement("span");
      student.textContent = `${link.student_name || "Student"}${link.student_code ? ` · ${link.student_code}` : ""} · ${link.relationship || "Parent"}`;

      details.append(parent, contactInfo, student);

      // 3. Unlink Button
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Unlink";
      button.setAttribute(
        "aria-label",
        `Unlink ${parent.textContent} from ${link.student_name || "student"}`,
      );
      button.addEventListener("click", () => unlinkParentStudent(link, button));

      // 4. Assemble row in correct order
      row.append(avatarStack, details, button);
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
    link.parent_phone,
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
  body.phone = (
    document.getElementById("parentPhone")?.value ||
    body.phone ||
    ""
  ).trim();

  // Print to console to prove it's being sent
  console.log("PAYLOAD SENT TO EDGE FUNCTION:", body);
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
    await loadParentLinks();
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
