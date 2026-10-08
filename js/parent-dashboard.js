const selectedParentStudentStorageKey = "tHubParentSelectedStudentId";

document.addEventListener("DOMContentLoaded", loadParentDashboard);

async function loadParentDashboard() {
  const container = document.getElementById("parentChildren");
  const client = window.supabaseClient;
  if (!container || !client) return;

  document.getElementById("parentSignOut")?.addEventListener("click", async () => {
    await client.auth.signOut();
    sessionStorage.removeItem(selectedParentStudentStorageKey);
    window.location.replace("/index.html");
  });

  try {
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) {
      window.location.replace("/index.html");
      return;
    }

    const { data: profile, error: profileError } = await client
      .from("profiles")
      .select("id, full_name, role, status")
      .eq("id", user.id)
      .single();
    if (profileError) throw profileError;
    if (profile.role !== "parent" || String(profile.status).toLowerCase() !== "active") {
      await client.auth.signOut();
      window.location.replace("/index.html");
      return;
    }

    document.getElementById("parentName").textContent = profile.full_name || "Parent";
    const { data: links, error: linksError } = await client
      .from("parent_student_links")
      .select("student_id, relationship")
      .eq("parent_user_id", user.id)
      .eq("status", "active");
    if (linksError) throw linksError;

    if (!links?.length) {
      container.innerHTML = '<p class="parent-state">No students are linked to this account yet. Contact the school that invited you.</p>';
      sessionStorage.removeItem(selectedParentStudentStorageKey);
      container.setAttribute("aria-busy", "false");
      return;
    }

    const { data: students, error: studentsError } = await client
      .from("students")
      .select("id, student_id, school_id, profiles(full_name)")
      .in("id", [...new Set(links.map((link) => link.student_id))]);
    if (studentsError) throw studentsError;

    const relationshipByStudent = new Map(links.map((link) => [link.student_id, link.relationship]));
    const children = (students || []).map((student) => ({
      ...student,
      relationship: relationshipByStudent.get(student.id) || "Parent/guardian",
      fullName: student.profiles?.full_name || "Student",
    })).sort((a, b) => a.fullName.localeCompare(b.fullName));

    if (!children.length) {
      container.innerHTML = '<p class="parent-state">No linked student records are available. Contact the school to review the invitation.</p>';
      container.setAttribute("aria-busy", "false");
      return;
    }

    renderParentChildren(children);
    const previousSelection = sessionStorage.getItem(selectedParentStudentStorageKey);
    if (children.some((child) => child.id === previousSelection)) {
      selectParentStudent(children.find((child) => child.id === previousSelection));
    }
    container.setAttribute("aria-busy", "false");
  } catch (error) {
    console.error("Could not load parent dashboard:", error);
    container.innerHTML = '<p class="parent-state">The dashboard could not load. Refresh the page or contact the school.</p>';
    container.setAttribute("aria-busy", "false");
  }
}

function renderParentChildren(children) {
  const container = document.getElementById("parentChildren");
  container.innerHTML = children.map((child) => `
    <article class="parent-child-card" data-student-id="${escapeParentPortal(child.id)}">
      <div class="parent-child-info">
        <strong>${escapeParentPortal(child.fullName)}</strong>
        <span>Student ID: ${escapeParentPortal(child.student_id || "Not assigned")}</span>
        <span>${escapeParentPortal(child.relationship)}</span>
      </div>
      <button type="button" data-select-student="${escapeParentPortal(child.id)}" aria-pressed="false">Choose student</button>
    </article>
  `).join("");

  container.querySelectorAll("[data-select-student]").forEach((button) => {
    button.addEventListener("click", () => {
      const selected = children.find((child) => child.id === button.dataset.selectStudent);
      if (selected) selectParentStudent(selected);
    });
  });
}

function selectParentStudent(student) {
  sessionStorage.setItem(selectedParentStudentStorageKey, student.id);
  document.querySelectorAll(".parent-child-card").forEach((card) => {
    const selected = card.dataset.studentId === student.id;
    card.classList.toggle("is-selected", selected);
    card.querySelector("button")?.setAttribute("aria-pressed", String(selected));
    if (card.querySelector("button")) card.querySelector("button").textContent = selected ? "Selected" : "Choose student";
  });
  document.getElementById("selectedStudentName").textContent = student.fullName;
  document.getElementById("selectedStudentDetails").textContent = `Student ID: ${student.student_id || "Not assigned"}`;
  document.getElementById("selectedStudentPanel").hidden = false;
}

function escapeParentPortal(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}
