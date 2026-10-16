const ADMIN_PAGE_SIZE = 15;
let adminRows = [];
let adminSchools = [];
let adminPage = 1;
let selectedAdmin = null;

(async function initAdminAccounts() {
  const ctx = await window.requireSuperAdmin();
  if (!ctx) return;
  populateSidebarUser(ctx.cpAdmin);
  bindAdminEvents();
  await loadAdminAccounts();
})();

function bindAdminEvents() {
  [
    "adminSearch",
    "adminSchoolFilter",
    "adminRoleFilter",
    "adminStatusFilter",
  ].forEach((id) =>
    document
      .getElementById(id)
      ?.addEventListener(id === "adminSearch" ? "input" : "change", () => {
        adminPage = 1;
        renderAdminAccounts();
      }),
  );

  document
    .getElementById("openAddAdminModal")
    ?.addEventListener("click", () => {
      document.getElementById("addAdminForm")?.reset();
      openModal("addAdminModal");
    });
  document
    .getElementById("addAdminForm")
    ?.addEventListener("submit", createAdminAccount);
  document
    .getElementById("editAdminForm")
    ?.addEventListener("submit", saveAdminAccount);
  document
    .getElementById("resetPasswordForm")
    ?.addEventListener("submit", resetAdminPassword);
}

async function loadAdminAccounts() {
  setAdminLoading();
  try {
    const [profilesResult, superAdminsResult, schoolsResult] =
      await Promise.all([
        window.supabaseClient
          .from("profiles")
          .select("*")
          .order("created_at", { ascending: false }),
        window.supabaseClient
          .from("cp_admins")
          .select("*")
          .order("created_at", { ascending: false }),
        window.supabaseClient
          .from("schools")
          .select("id, school_name")
          .order("school_name"),
      ]);

    if (profilesResult.error) throw profilesResult.error;
    if (superAdminsResult.error) throw superAdminsResult.error;
    if (schoolsResult.error) throw schoolsResult.error;

    adminSchools = schoolsResult.data || [];
    const schoolsById = Object.fromEntries(
      adminSchools.map((school) => [school.id, school.school_name]),
    );
    const profiles = (profilesResult.data || []).filter((row) =>
      [
        "admin",
        "accountant",
        "librarian",
        "super_admin",
        "super-admin",
      ].includes(String(row.role || "").toLowerCase()),
    );
    const byId = new Map(
      profiles.map((row) => [
        row.id,
        {
          ...row,
          source: "profiles",
          display_role: row.role,
          school_name: schoolsById[row.school_id] || "",
        },
      ]),
    );

    (superAdminsResult.data || []).forEach((row) => {
      const previous = byId.get(row.id);
      byId.set(row.id, {
        ...(previous || {}),
        ...row,
        id: row.id,
        source: "cp_admins",
        display_name: row.full_name || previous?.full_name || row.email,
        display_role: "super-admin",
        status: row.status || previous?.status || "active",
        school_name: "—",
      });
    });

    adminRows = [...byId.values()];
    updateAdminStats();
    populateSchoolFilters();
    renderAdminAccounts();
  } catch (error) {
    console.error("loadAdminAccounts error:", error);
    document.getElementById("adminsTableBody").innerHTML =
      `<tr><td colspan="6"><div class="empty-state"><i class="fa-solid fa-circle-exclamation"></i><p>Could not load admin accounts: ${adminEsc(error.message)}</p></div></td></tr>`;
    window.showToast("Failed to load admin accounts.", "error");
  }
}

function updateAdminStats() {
  const set = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = window.formatNumber(value);
  };
  set("stat-total-admins", adminRows.length);
  set(
    "stat-school-admins",
    adminRows.filter((row) => row.source === "profiles").length,
  );
  set(
    "stat-super-admins",
    adminRows.filter((row) => row.source === "cp_admins").length,
  );
  set(
    "stat-suspended-admins",
    adminRows.filter((row) =>
      ["suspended", "inactive"].includes(
        String(row.status || "").toLowerCase(),
      ),
    ).length,
  );
}

function populateSchoolFilters() {
  for (const id of [
    "adminSchoolFilter",
    "addAdminSchoolSelect",
    "editAdminSchoolSelect",
  ]) {
    const select = document.getElementById(id);
    if (!select) continue;
    const placeholder =
      id === "adminSchoolFilter" ? "All Schools" : "— Select School —";
    const currentValue = select.value;
    select.innerHTML =
      `<option value="">${placeholder}</option>` +
      adminSchools
        .map(
          (school) =>
            `<option value="${adminEsc(school.id)}">${adminEsc(school.school_name)}</option>`,
        )
        .join("");
    select.value = currentValue;
  }
}

function getFilteredAdmins() {
  const search = document
    .getElementById("adminSearch")
    .value.trim()
    .toLowerCase();
  const school = document.getElementById("adminSchoolFilter").value;
  const role = document.getElementById("adminRoleFilter").value.toLowerCase();
  const status = document
    .getElementById("adminStatusFilter")
    .value.toLowerCase();
  return adminRows.filter((row) => {
    const rowRole = String(row.display_role || row.role || "")
      .toLowerCase()
      .replaceAll("-", "_");
    return (
      (!search ||
        `${row.full_name || row.display_name || ""} ${row.email || ""}`
          .toLowerCase()
          .includes(search)) &&
      (!school || row.school_id === school) &&
      (!role || rowRole === role) &&
      (!status || String(row.status || "").toLowerCase() === status)
    );
  });
}

function renderAdminAccounts() {
  const tbody = document.getElementById("adminsTableBody");
  const filtered = getFilteredAdmins();
  const start = (adminPage - 1) * ADMIN_PAGE_SIZE;
  const pageRows = filtered.slice(start, start + ADMIN_PAGE_SIZE);
  if (!pageRows.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="fa-solid fa-user-gear"></i><h3>No admin accounts found</h3><p>Adjust your filters or add an account.</p></div></td></tr>`;
  } else {
    tbody.innerHTML = pageRows
      .map((row) => {
        const name = row.full_name || row.display_name || "Unnamed admin";
        const role = String(row.display_role || row.role || "admin");
        const badgeClass = role.toLowerCase().replaceAll("-", "_");
        const state = String(row.status || "active").toLowerCase();
        const lastLogin =
          row.last_login_at || row.last_sign_in_at || row.last_login;
        const safeId = adminEsc(row.id);
        const canEdit = row.source === "profiles";
        const photoUrl = row.avatar_url || row.photo_url || row.profile_photo || row.image_url || row.picture;
        const avatar = photoUrl
          ? `<img class="admin-avatar" src="${adminEsc(photoUrl)}" alt="${adminEsc(name)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement('div'), { className: 'admin-avatar', textContent: '${adminEsc(adminInitials(name))}' }))">`
          : `<div class="admin-avatar">${adminEsc(adminInitials(name))}</div>`;
        return `<tr>
        <td><div class="admin-cell">${avatar}<div class="admin-info"><strong>${adminEsc(name)}</strong><small>${adminEsc(row.email || "")}</small></div></div></td>
        <td>${adminEsc(row.school_name || "—")}</td>
        <td><span class="role-badge role-${adminEsc(badgeClass)}">${adminEsc(adminRoleName(role))}</span></td>
        <td><span class="badge badge-${adminEsc(adminBadge(state))}">${adminEsc(adminTitle(state))}</span></td>
        <td>${lastLogin ? adminEsc(window.formatDateTime(lastLogin)) : "—"}</td>
        <td><div style="display:flex;gap:6px;">
          <button class="btn btn-secondary btn-sm btn-icon" type="button" data-edit-admin="${safeId}" ${canEdit ? "" : "disabled"} title="${canEdit ? "Edit" : "Super-admin account editing requires protected backend support"}"><i class="fa-solid fa-pen"></i></button>
          ${canEdit ? `<button class="btn btn-secondary btn-sm btn-icon" type="button" data-reset-admin="${safeId}" title="Reset password"><i class="fa-solid fa-key"></i></button>` : ""}
        </div></td>
      </tr>`;
      })
      .join("");
    tbody
      .querySelectorAll("[data-edit-admin]")
      .forEach((button) =>
        button.addEventListener("click", () =>
          openEditAdmin(button.dataset.editAdmin),
        ),
      );
    tbody
      .querySelectorAll("[data-reset-admin]")
      .forEach((button) =>
        button.addEventListener("click", () =>
          openResetAdmin(button.dataset.resetAdmin),
        ),
      );
  }

  const totalPages = Math.ceil(filtered.length / ADMIN_PAGE_SIZE);
  const from = filtered.length ? start + 1 : 0;
  const to = Math.min(start + ADMIN_PAGE_SIZE, filtered.length);
  document.getElementById("paginationInfo").textContent = filtered.length
    ? `Showing ${from}–${to} of ${filtered.length}`
    : "No results";
  const controls = document.getElementById("paginationControls");
  controls.innerHTML =
    totalPages > 1
      ? `<button class="page-btn" data-page="${adminPage - 1}" ${adminPage === 1 ? "disabled" : ""}>‹</button>
      ${Array.from({ length: totalPages }, (_, index) => `<button class="page-btn ${index + 1 === adminPage ? "active" : ""}" data-page="${index + 1}">${index + 1}</button>`).join("")}
      <button class="page-btn" data-page="${adminPage + 1}" ${adminPage === totalPages ? "disabled" : ""}>›</button>`
      : "";
  controls.querySelectorAll("[data-page]").forEach((button) =>
    button.addEventListener("click", () => {
      adminPage = Number(button.dataset.page);
      renderAdminAccounts();
    }),
  );
}

function openEditAdmin(id) {
  selectedAdmin = adminRows.find(
    (row) => row.id === id && row.source === "profiles",
  );
  if (!selectedAdmin) return;
  document.getElementById("editAdminName").value =
    selectedAdmin.full_name || "";
  document.getElementById("editAdminEmail").value = selectedAdmin.email || "";
  document.getElementById("editAdminPhone").value =
    selectedAdmin.phone_number || selectedAdmin.phone || "";
  document.getElementById("editAdminRole").value = String(
    selectedAdmin.role || "admin",
  ).replaceAll("-", "_");
  document.getElementById("editAdminSchoolSelect").value =
    selectedAdmin.school_id || "";
  document.getElementById("editAdminStatus").value = String(
    selectedAdmin.status || "active",
  ).toLowerCase();
  openModal("editAdminModal");
}

async function saveAdminAccount(event) {
  event.preventDefault();
  if (!selectedAdmin || selectedAdmin.source !== "profiles") return;
  const nextRole = document.getElementById("editAdminRole").value;
  if (
    (selectedAdmin.role === "super_admin" ||
      selectedAdmin.role === "super-admin" ||
      nextRole === "super_admin") &&
    nextRole !== String(selectedAdmin.role).replaceAll("-", "_")
  ) {
    window.showToast(
      "Super-admin role changes must be performed through the protected admin provisioning service.",
      "warning",
    );
    return;
  }
  const button =
    event.submitter ||
    document.querySelector('[type="submit"][form="editAdminForm"]');
  if (button) button.disabled = true;
  try {
    const { error } = await window.supabaseClient
      .from("profiles")
      .update({
        full_name: document.getElementById("editAdminName").value.trim(),
        phone_number: document.getElementById("editAdminPhone").value.trim(),
        role: nextRole,
        school_id:
          document.getElementById("editAdminSchoolSelect").value || null,
        status: document.getElementById("editAdminStatus").value,
      })
      .eq("id", selectedAdmin.id);
    if (error) throw error;
    window.showToast("Admin account updated.", "success");
    closeModal("editAdminModal");
    await loadAdminAccounts();
  } catch (error) {
    console.error("saveAdminAccount error:", error);
    window.showToast(`Could not update account: ${error.message}`, "error");
  } finally {
    if (button) button.disabled = false;
  }
}

async function createAdminAccount(event) {
  event.preventDefault();
  const name = document.getElementById("addAdminName").value.trim();
  const email = document.getElementById("addAdminEmail").value.trim();
  const password = document.getElementById("addAdminPassword").value;
  const confirmation = document.getElementById("addAdminPasswordConfirm").value;
  if (password.length < 8)
    return window.showToast(
      "Password must be at least 8 characters.",
      "warning",
    );
  if (password !== confirmation)
    return window.showToast("Passwords do not match.", "warning");
  const button =
    event.submitter ||
    document.querySelector('[type="submit"][form="addAdminForm"]');
  if (button) button.disabled = true;
  try {
    const { data, error } = await window.supabaseClient.functions.invoke(
      "create-admin-account",
      {
        body: {
          full_name: name,
          email,
          phone_number: document.getElementById("addAdminPhone").value.trim(),
          role: document.getElementById("addAdminRole").value,
          school_id:
            document.getElementById("addAdminSchoolSelect").value || null,
          password,
        },
      },
    );
    if (error) {
      let message = error.message;
      if (error.context instanceof Response) {
        try {
          const response = await error.context.clone().json();
          if (typeof response?.error === "string") message = response.error;
        } catch (parseError) {
          console.warn(
            "Could not read admin creation error response:",
            parseError,
          );
        }
      }
      throw new Error(message);
    }
    if (data?.error) throw new Error(data.error);
    window.showToast("Admin account created.", "success");
    closeModal("addAdminModal");
    event.target.reset();
    await loadAdminAccounts();
  } catch (error) {
    console.error("createAdminAccount error:", error);
    window.showToast(
      error.message?.includes("Function not found")
        ? "Account is not created."
        : `Could not create account: ${error.message}`,
      "error",
      7000,
    );
  } finally {
    if (button) button.disabled = false;
  }
}

function openResetAdmin(id) {
  selectedAdmin = adminRows.find(
    (row) => row.id === id && row.source === "profiles",
  );
  if (!selectedAdmin) return;
  document.getElementById("resetAdminNameLabel").textContent =
    selectedAdmin.full_name || selectedAdmin.email || "this account";
  document.getElementById("resetPasswordForm").reset();
  openModal("resetPasswordModal");
}

async function resetAdminPassword(event) {
  event.preventDefault();
  if (!selectedAdmin) return;
  const password = document.getElementById("resetNewPassword").value;
  if (password.length < 8)
    return window.showToast(
      "Password must be at least 8 characters.",
      "warning",
    );
  if (password !== document.getElementById("resetConfirmPassword").value) {
    return window.showToast("Passwords do not match.", "warning");
  }
  const button =
    event.submitter ||
    document.querySelector('[type="submit"][form="resetPasswordForm"]');
  if (button) button.disabled = true;
  try {
    const { data, error } = await window.supabaseClient.functions.invoke(
      "create-admin-account",
      {
        body: { action: "reset-password", user_id: selectedAdmin.id, password },
      },
    );
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    window.showToast("Password reset successfully.", "success");
    closeModal("resetPasswordModal");
  } catch (error) {
    console.error("resetAdminPassword error:", error);
    window.showToast(`Could not reset password: ${error.message}`, "error");
  } finally {
    if (button) button.disabled = false;
  }
}

function setAdminLoading() {
  document.getElementById("adminsTableBody").innerHTML =
    `<tr><td colspan="6"><div class="empty-state"><i class="fa-solid fa-spinner fa-spin"></i><p>Loading admin accounts...</p></div></td></tr>`;
}

function adminEsc(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
}
function adminInitials(value) {
  return (
    String(value)
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "A"
  );
}
function adminRoleName(value) {
  return (
    {
      super_admin: "Super Admin",
      "super-admin": "Super Admin",
      admin: "School Admin",
    }[String(value).toLowerCase()] ||
    String(value)
      .replaceAll("_", " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
  );
}
function adminTitle(value) {
  return String(value).replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function adminBadge(value) {
  return (
    {
      active: "active",
      suspended: "inactive",
      inactive: "inactive",
      pending: "pending",
    }[value] || "expired"
  );
}
