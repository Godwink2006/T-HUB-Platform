const selectedParentStudentStorageKey = "tHubParentSelectedStudentId";
let parentAnnouncementRequestId = 0;

document.addEventListener("DOMContentLoaded", loadParentDashboard);

async function loadParentDashboard() {
  const container = document.getElementById("parentChildren");
  const client = window.supabaseClient;
  if (!container || !client) return;

  document
    .getElementById("parentSignOut")
    ?.addEventListener("click", async () => {
      await client.auth.signOut();
      sessionStorage.removeItem(selectedParentStudentStorageKey);
      window.location.replace("/index.html");
    });

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
      .select("id, full_name, role, status")
      .eq("id", user.id)
      .single();
    if (profileError) throw profileError;
    if (
      profile.role !== "parent" ||
      String(profile.status).toLowerCase() !== "active"
    ) {
      await client.auth.signOut();
      window.location.replace("/index.html");
      return;
    }

    document.getElementById("parentName").textContent =
      profile.full_name || "Parent";
    const { data: links, error: linksError } = await client
      .from("parent_student_links")
      .select("student_id, relationship")
      .eq("parent_user_id", user.id)
      .eq("status", "active");
    if (linksError) throw linksError;

    if (!links?.length) {
      container.innerHTML = ` <div class="empty-state-wrapper d-flex justify-content-center align-items: center w-100 py-7">
    <div class="empty-state-card text-center p-7 my-7">
      <div class="icon-wrapper mb-7">
        <i class="fa-solid fa-user-slash fa-2x"></i>
      </div>
      <h5 class="fw-semibold text-dark mb-2">No Students Linked</h5>
      <p class="parent-state text-muted mb-0">No students are linked to this account yet. Contact the school that invited you.</p>
    </div>
  </div>
`;
      sessionStorage.removeItem(selectedParentStudentStorageKey);
      container.setAttribute("aria-busy", "false");
      return;
    }

    const { data: students, error: studentsError } = await client
      .from("students")
      .select("id, student_id, school_id, profiles(full_name, photo_url)")
      .in("id", [...new Set(links.map((link) => link.student_id))]);
    if (studentsError) throw studentsError;

    const relationshipByStudent = new Map(
      links.map((link) => [link.student_id, link.relationship]),
    );
    const children = (students || [])
      .map((student) => ({
        ...student,
        relationship:
          relationshipByStudent.get(student.id) || "Parent/guardian",
        fullName: student.profiles?.full_name || "Student",
        photoUrl: student.profiles?.photo_url || "",
      }))
      .sort((a, b) => a.fullName.localeCompare(b.fullName));

    if (!children.length) {
      container.innerHTML =
        '<p class="parent-state">No linked student records are available. Contact the school to review the invitation.</p>';
      container.setAttribute("aria-busy", "false");
      return;
    }

    renderParentChildren(children);
    const previousSelection = sessionStorage.getItem(
      selectedParentStudentStorageKey,
    );
    if (children.some((child) => child.id === previousSelection)) {
      selectParentStudent(
        children.find((child) => child.id === previousSelection),
      );
    }
    container.setAttribute("aria-busy", "false");
  } catch (error) {
    console.error("Could not load parent dashboard:", error);
    container.innerHTML =
      '<p class="parent-state">The dashboard could not load. Refresh the page or contact the school.</p>';
    container.setAttribute("aria-busy", "false");
  }
}

function renderParentChildren(children) {
  const container = document.getElementById("parentChildren");
  container.innerHTML = children
    .map(
      (child) => `
    <article class="parent-child-card" data-student-id="${escapeParentPortal(child.id)}">
      <span class="parent-student-avatar-shell" data-student-avatar aria-hidden="true">
        <img class="parent-student-avatar" alt="" />
        <span class="parent-student-avatar-initials"></span>
      </span>
      <div class="parent-child-info">
        <strong>${escapeParentPortal(child.fullName)}</strong>
        <span>Student ID: ${escapeParentPortal(child.student_id || "Not assigned")}</span>
        <span>${escapeParentPortal(child.relationship)}</span>
      </div>
      <button type="button" data-select-student="${escapeParentPortal(child.id)}" aria-pressed="false">Choose student</button>
    </article>
  `,
    )
    .join("");

  container.querySelectorAll("[data-student-avatar]").forEach((image) => {
    const child = children.find(
      (item) =>
        item.id === image.closest("[data-student-id]")?.dataset.studentId,
    );
    setParentStudentPhoto(image, child?.photoUrl, child?.fullName || "Student");
  });

  container.querySelectorAll("[data-select-student]").forEach((button) => {
    button.addEventListener("click", () => {
      const selected = children.find(
        (child) => child.id === button.dataset.selectStudent,
      );
      if (selected) selectParentStudent(selected);
    });
  });
}

function selectParentStudent(student) {
  sessionStorage.setItem(selectedParentStudentStorageKey, student.id);
  document.querySelectorAll(".parent-child-card").forEach((card) => {
    const selected = card.dataset.studentId === student.id;
    card.classList.toggle("is-selected", selected);
    card
      .querySelector("button")
      ?.setAttribute("aria-pressed", String(selected));
    if (card.querySelector("button"))
      card.querySelector("button").textContent = selected
        ? "Selected"
        : "Choose student";
  });
  document.getElementById("selectedStudentName").textContent = student.fullName;
  document.getElementById("selectedStudentDetails").textContent =
    `Student ID: ${student.student_id || "Not assigned"}`;
  setParentStudentPhoto(
    document.getElementById("selectedStudentPhoto"),
    student.photoUrl,
    student.fullName,
  );
  document.getElementById("selectedStudentPanel").hidden = false;
  loadParentAnnouncements(student);
}

async function loadParentAnnouncements(student) {
  const container = document.getElementById("parentAnnouncements");
  if (!container) return;
  const requestId = ++parentAnnouncementRequestId;
  container.setAttribute("aria-busy", "true");
  container.innerHTML = '<p class="parent-state">Loading announcements…</p>';
  try {
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await window.supabaseClient
      .from("announcements")
      .select(
        "id, title, message, status, target_audience, expiry_date, created_at",
      )
      .eq("school_id", student.school_id)
      .or(`expiry_date.is.null,expiry_date.gte.${today}`)
      .order("created_at", { ascending: false });
    if (error) throw error;
    if (requestId !== parentAnnouncementRequestId) return;
    const visible = (data || []).filter(isParentAnnouncementVisible);
    if (!visible.length) {
      container.innerHTML =
        '<p class="parent-state">There are no current announcements for this student.</p>';
      return;
    }
    container.replaceChildren(
      ...visible.map((announcement) => {
        const article = document.createElement("article");
        article.className = "parent-announcement";
        article.dataset.status = ["Important", "Urgent"].includes(
          announcement.status,
        )
          ? announcement.status
          : "Normal";
        const title = document.createElement("h4");
        title.textContent = announcement.title || "Announcement";
        const message = document.createElement("p");
        message.textContent = announcement.message || "";
        const meta = document.createElement("div");
        meta.className = "parent-announcement-meta";
        meta.textContent = `${announcement.status || "Normal"} · ${announcement.created_at ? new Date(announcement.created_at).toLocaleDateString() : ""}`;
        article.append(title, message, meta);
        return article;
      }),
    );
  } catch (error) {
    if (requestId !== parentAnnouncementRequestId) return;
    console.error("Could not load parent announcements:", error);
    container.innerHTML =
      '<p class="parent-state">Announcements could not be loaded. Refresh the page or contact the school.</p>';
  } finally {
    if (requestId === parentAnnouncementRequestId)
      container.setAttribute("aria-busy", "false");
  }
}

function isParentAnnouncementVisible(announcement) {
  const audiences = String(announcement?.target_audience || "")
    .split(",")
    .map((item) => item.trim().toLowerCase().replace(/s$/, ""));
  return audiences.some((audience) =>
    ["all", "everyone", "student", "parent"].includes(audience),
  );
}

function setParentStudentPhoto(shell, photoUrl, name) {
  if (!shell) return;
  const image = shell.querySelector("img");
  const initials = shell.querySelector(".parent-student-avatar-initials");
  const firstLetters = String(name || "Student")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  if (initials) initials.textContent = firstLetters || "S";
  if (!image) return;
  image.alt = `${name || "Student"} photo`;
  image.hidden = true;
  image.removeAttribute("src");
  if (photoUrl) {
    try {
      const parsedPhotoUrl = new URL(photoUrl, window.location.href);
      if (["https:", "http:"].includes(parsedPhotoUrl.protocol)) {
        image.src = parsedPhotoUrl.href;
        image.hidden = false;
      }
    } catch {
      // Leave the styled initials placeholder when a profile photo URL is invalid.
    }
  }
  image.onerror = () => {
    image.onerror = null;
    image.hidden = true;
    image.removeAttribute("src");
  };
}

function escapeParentPortal(value) {
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
