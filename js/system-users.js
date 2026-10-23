const form = document.getElementById("systemUserForm");

function systemUserErrorMessage(error, action = "update") {
  const code = String(error?.code || error?.error_code || "").toLowerCase();
  const status = Number(error?.status || error?.statusCode || error?.context?.status || 0);
  const diagnostic = `${code} ${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`.toLowerCase();

  if (/school.{0,30}inactive|inactive.{0,30}school/.test(diagnostic)) {
    return "This school is inactive, so system users cannot be changed right now. Contact your school administrator.";
  }
  if (
    code === "42501" ||
    status === 403 ||
    code === "forbidden" ||
    /row-level security|permission denied|insufficient privilege|not authorized|unauthorized|access denied|not allowed|admin only|only admins?|only.*admin|administrator required|requires? admin/.test(diagnostic)
  ) {
    return action === "load"
      ? "You do not have permission to view system users. Contact your school administrator."
      : "You do not have permission to manage system users. Contact your school administrator.";
  }
  if (status === 401 || code === "pgrst301" || /invalid jwt|session.*expired|refresh token/.test(diagnostic)) {
    return "Your session has expired. Sign in again and retry.";
  }
  if (/failed to fetch|fetch failed|failed to send a request|network|connection|timeout|timed out/.test(diagnostic)) {
    return `Could not connect to ${action === "load" ? "load" : "save"} system users. Check your internet connection and try again.`;
  }
  if (/phone_number|phone number/.test(diagnostic) && /duplicate|already exists|unique|23505/.test(`${code} ${diagnostic}`)) {
    return "That phone number is already assigned to another user.";
  }
  if (code === "23505" || code === "email_exists" || code === "user_already_exists" || /already registered|user already exists|already in use|email.*already exists/.test(diagnostic)) {
    return "A user with this email address already exists. Use a different email address.";
  }
  if (/weak password|password.*too short|password should be at least/.test(diagnostic)) {
    return "The password does not meet the security requirements. Choose a stronger password and try again.";
  }
  if (/file size|payload too large|object.*too large/.test(diagnostic) || status === 413) {
    return "The photo is too large. Choose a smaller image and try again.";
  }
  if (/canvas|compress|image decode|failed to process.*photo/.test(diagnostic)) {
    return "The photo could not be processed. Choose a different image and try again.";
  }
  if (/function.*(not found|unavailable)|deployment.*not found/.test(diagnostic) || status === 404) {
    return "The user management service is unavailable right now. Contact your administrator.";
  }
  return action === "load"
    ? "System users could not be loaded. Please try again."
    : action === "create"
      ? "The user could not be created. Check the details and try again."
      : "The user could not be updated. Please try again.";
}

async function getSystemUserErrorMessage(error, action) {
  if (error?.context && typeof error.context.json === "function") {
    try {
      const body = await error.context.json();
      if (body && typeof body === "object") {
        error = {
          code: body.code || body.error_code || error.code,
          status: body.status || error.status || error.statusCode,
          message: body.message || body.error || error.message,
          details: body.details || error.details,
          hint: body.hint || error.hint,
        };
      }
    } catch (parseError) {
      // Use the original function error when its response isn't JSON.
    }
  }
  return systemUserErrorMessage(error, action);
}

function compressImageToBlob(file, maxWidth = 800, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;

      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error("Canvas encoding failed."));
            }
          },
          "image/jpeg",
          quality,
        );
      };

      img.onerror = (err) => reject(err);
    };

    reader.onerror = (err) => reject(err);
  });
}

const addFileInput = document.getElementById("addAvatarInput");
const addFileNameText = document.getElementById("addFileNameDisplay");
const addPreviewImg = document.getElementById("addAvatarPreview");

if (addFileInput) {
  addFileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      if (addFileNameText) addFileNameText.textContent = file.name;

      const reader = new FileReader();
      reader.onload = (event) => {
        if (addPreviewImg) addPreviewImg.src = event.target.result;
      };
      reader.readAsDataURL(file);
    }
  });
}

function resetAddUserPreview() {
  const addPreviewImg = document.getElementById("addAvatarPreview");
  const addFileNameText = document.getElementById("addFileNameDisplay");

  if (addPreviewImg) addPreviewImg.src = "assets/default-avatar.png";
  if (addFileNameText) addFileNameText.textContent = "No file chosen";
}

form?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const saveButton = form.querySelector(".save-btn");

  const password = document.getElementById("newPassword").value;
  const confirmPassword = document.getElementById("confirmPassword").value;

  if (password !== confirmPassword) {
    showToast("Passwords do not match.", "error");
    return;
  }

  saveButton.disabled = true;
  saveButton.textContent = "Creating...";

  try {
    const full_name = document.getElementById("fullName").value.trim();
    const email = document.getElementById("email").value.trim();
    const phone_number = document.getElementById("phoneNumber").value.trim();
    const role = document.getElementById("role").value.toLowerCase();
    const status = document.getElementById("status").value.toLowerCase();

    const photoInput = document.getElementById("addAvatarInput");

    let photoBase64 = null;

    if (photoInput && photoInput.files[0]) {
      saveButton.textContent = "Compressing photo...";

      const compressedBlob = await compressImageToBlob(
        photoInput.files[0],
        800,
        0.7,
      );

      photoBase64 = await blobToBase64(compressedBlob);
    }

    saveButton.textContent = "Creating user...";

    const { data, error } = await window.supabaseClient.functions.invoke(
      "create-user",
      {
        body: {
          full_name,
          email,
          phone_number,
          password,
          role,
          status,
          photo: photoBase64,
        },
      },
    );

    if (error) throw error;

    showToast(data?.message || "User created successfully!", "success");

    form.reset();

    const avatarPreview = document.getElementById("addAvatarPreview");
    if (avatarPreview) {
      avatarPreview.src = DEFAULT_AVATAR;
    }
    const fileNameText = document.getElementById("addFileNameDisplay");
    if (fileNameText) {
      fileNameText.textContent = "No file chosen";
    }

    await loadSystemUsers();
  } catch (err) {
    console.error("System user creation failed:", err);
    showToast(await getSystemUserErrorMessage(err, "create"), "error");
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = "Save";
  }
});

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

const systemUserModal = document.getElementById("systemUserModal");

const cancelSystemUserModal = document.getElementById("cancelSystemUserModal");

const openSystemUserModal = document.getElementById("addSystemUser");

const closeSystemUserModal = document.getElementById("closeSystemUserModal");

openSystemUserModal?.addEventListener("click", () => {
  systemUserModal.style.display = "flex";

  const avatarPreview = document.getElementById("addAvatarPreview");
  if (avatarPreview) {
    avatarPreview.src = DEFAULT_AVATAR;
  }

  const fileNameText = document.getElementById("addFileNameDisplay");
  if (fileNameText) {
    fileNameText.textContent = "No file chosen";
  }

  lockBodyScroll();
});

closeSystemUserModal?.addEventListener("click", () => {
  systemUserModal.style.display = "none";

  unLockBodyScroll();
});

cancelSystemUserModal?.addEventListener("click", () => {
  systemUserModal.style.display = "none";

  unLockBodyScroll();
});

window.addEventListener("click", (e) => {
  if (e.target === systemUserModal) {
    systemUserModal.style.display = "none";

    unLockBodyScroll();
  }
});

const closeEditSystemUserModal = document.getElementById(
  "closeEditSystemUserModal",
);
const cancelEditSystemUserModal = document.getElementById(
  "cancelEditSystemUserModal",
);
const editSystemUserModal = document.getElementById("editSystemUserModal");
const editSystemUserButtons = document.querySelectorAll(".edit-SystemUser");

closeEditSystemUserModal?.addEventListener("click", () => {
  editSystemUserModal.style.display = "none";

  unLockBodyScroll();
});

cancelEditSystemUserModal?.addEventListener("click", () => {
  editSystemUserModal.style.display = "none";

  unLockBodyScroll();
});

window.addEventListener("click", (e) => {
  if (e.target === editSystemUserModal) {
    editSystemUserModal.style.display = "none";

    unLockBodyScroll();
  }
});

function togglePassword(id) {
  const input = document.getElementById(id);
  input.type = input.type === "password" ? "text" : "password";
}

document.addEventListener("DOMContentLoaded", () => {
  const closeEditBtn = document.getElementById("closeEditSystemUserModal");
  const cancelEditBtn = document.getElementById("cancelEditSystemUserModal");
  const editModal = document.getElementById("editSystemUserModal");

  const closeModal = (modal) => {
    if (modal) modal.style.display = "none";
    if (typeof unLockBodyScroll === "function") unLockBodyScroll();
  };

  if (closeEditBtn)
    closeEditBtn.addEventListener("click", () => closeModal(editModal));
  if (cancelEditBtn)
    cancelEditBtn.addEventListener("click", () => closeModal(editModal));
});

async function loadSystemUsers() {
  renderTableLoading();

  const tableBody = document.querySelector("#usersTable tbody");
  if (!tableBody) return;

  const searchInput = document.getElementById("searchInput");
  const roleFilter = document.getElementById("roleFilter");
  const statusFilter = document.getElementById("statusFilter");

  const searchTerm = searchInput ? searchInput.value.trim() : "";
  const roleValue = roleFilter ? roleFilter.value.toLowerCase() : "";
  const statusValue = statusFilter ? statusFilter.value.toLowerCase() : "";

  try {
    let query = supabaseClient
      .from("profiles")
      .select(
        "id, full_name, email, phone_number, role, status, photo_url, created_at, updated_at",
      )
      .in("role", ["librarian", "accountant", "receptionist"]);

    if (searchTerm) {
      query = query.or(
        `full_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,phone_number.ilike.%${searchTerm}%`,
      );
    }

    if (roleValue && roleValue !== "role") {
      query = query.ilike("role", roleValue);
    }

    if (statusValue && statusValue !== "status") {
      query = query.ilike("status", statusValue);
    }

    query = query.order("created_at", { ascending: false });

    const { data: users, error } = await query;
    if (error) throw error;

    if (!users || users.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center;">No users found.</td></tr>`;
      return;
    }

    tableBody.innerHTML = users
      .map(
        (user) => `
    <tr>
      <td>
        <span class="app-person-cell">
          <img src="${escapeHTML(user.photo_url ? user.photo_url : DEFAULT_AVATAR)}" class="systemUser-photo" alt="${escapeHTML(user.full_name || "User")}" onerror="this.onerror=null; this.src=DEFAULT_AVATAR;" />
          <span class="app-person-meta">
            <span>${escapeHTML(user.full_name || "-")}</span>
            <small class="app-person-id">${escapeHTML(user.email || "Email not set")}</small>
          </span>
        </span>
        </td>
      <td>${escapeHTML(user.phone_number || "-")}</td>
      <td>${escapeHTML(user.role || "-")}</td>
       <td>${formatDateTime(user.created_at)}</td>
      <td>${formatDateTime(user.updated_at)}</td>
      <td>
        <span class="systemUsers-status-${String(user.status || "inactive").toLowerCase() === "active" ? "active" : "inactive"}">
          ${escapeHTML(user.status || "Inactive")}
        </span>
      </td>
      <td>
        <button class="systemUsers-actions-btn edit-SystemUser" onclick="editUser('${escapeHTML(user.id)}')">
          <i class="fa-solid fa-pen"></i>
        </button>
      </td>
    </tr>
  `,
      )
      .join("");
  } catch (error) {
    console.error("System users load failed:", error);
    const message = systemUserErrorMessage(error, "load");
    tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 1.5rem;">${escapeHTML(message)}<br><button type="button" onclick="loadSystemUsers()" style="margin-top: 0.75rem;">Try again</button></td></tr>`;
  }
}

function formatDateTime(isoString) {
  if (!isoString) return "N/A";
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return "N/A";

  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function renderTableLoading() {
  const tableBody = document.querySelector("#usersTable tbody");
  if (!tableBody) return;

  tableBody.innerHTML = `
    <tr>
      <td colspan="7" style="text-align: center; padding: 2rem; color: #64748b;">
        <i class="fa-solid fa-spinner fa-spin" style="margin-right: 0.5rem;"></i>
        Loading system users...
      </td>
    </tr>
  `;
}

document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("searchInput");
  const roleFilter = document.getElementById("roleFilter");
  const statusFilter = document.getElementById("statusFilter");

  if (searchInput) searchInput.addEventListener("input", loadSystemUsers);
  if (roleFilter) roleFilter.addEventListener("change", loadSystemUsers);
  if (statusFilter) statusFilter.addEventListener("change", loadSystemUsers);

  loadSystemUsers();
});

const DEFAULT_AVATAR =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128' width='128' height='128'><circle cx='64' cy='64' r='64' fill='%23E4E6EB'/><circle cx='64' cy='46' r='22' fill='%23B0B3B8'/><path d='M24 112c0-22 18-40 40-40s40 18 40 40' fill='%23B0B3B8'/></svg>";

let targetUserToEdit = null;
let originalUserData = null;

async function editUser(userId) {
  targetUserToEdit = userId;

  try {
    const { data: user, error } = await supabaseClient
      .from("profiles")
      .select("full_name, email, phone_number, role, status, photo_url")
      .eq("id", userId)
      .single();

    if (error) throw error;
    if (!user) {
      showToast("This user could not be found. Refresh the list and try again.", "error");
      return;
    }

    const fullNameValue = user.full_name || "";
    const phoneValue = user.phone_number || "";
    const statusValue = user.status || "";
    const roleValue = user.role || "";
    const photoUrlValue = user.photo_url || null;

    const fullNameInput = document.getElementById("editFullName");
    const phoneInput = document.getElementById("editPhone");
    const emailInput = document.getElementById("editEmail");
    const statusInput = document.getElementById("editStatus");
    const roleInput = document.getElementById("editRole");

    if (fullNameInput) fullNameInput.value = fullNameValue;
    if (phoneInput) phoneInput.value = phoneValue;
    if (emailInput) emailInput.value = user.email || "";
    if (statusInput) statusInput.value = statusValue;
    if (roleInput) roleInput.value = roleValue;

    const avatarPreview = document.getElementById("editAvatarPreview");
    if (avatarPreview) {
      avatarPreview.src = photoUrlValue || "assets/default-avatar.png";
    }

    const fileInput = document.getElementById("editAvatarInput");
    const fileNameText = document.getElementById("fileNameDisplay");
    if (fileInput) fileInput.value = "";
    if (fileNameText) fileNameText.textContent = "No new file chosen";

    originalUserData = {
      fullName: fullNameValue,
      phone: phoneValue,
      role: roleValue,
      status: statusValue,
      photoUrl: photoUrlValue,
    };

    const modal = document.getElementById("editSystemUserModal");
    if (modal) {
      modal.style.display = "flex";
      if (typeof lockBodyScroll === "function") lockBodyScroll();
    }
  } catch (error) {
    console.error("Could not load system user details:", error);
    showToast(await getSystemUserErrorMessage(error, "load"), "error");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const fileInput = document.getElementById("editAvatarInput");
  const fileNameText = document.getElementById("fileNameDisplay");
  const previewImg = document.getElementById("editAvatarPreview");

  if (fileInput) {
    fileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) {
        if (fileNameText) fileNameText.textContent = file.name;

        const reader = new FileReader();
        reader.onload = (event) => {
          if (previewImg) previewImg.src = event.target.result;
        };
        reader.readAsDataURL(file);
      }
    });
  }

  const updateSystemUserBtn = document.getElementById("updateSystemUserBtn");
  if (updateSystemUserBtn) {
    updateSystemUserBtn.addEventListener("click", async () => {
      if (targetUserToEdit) {
        await handleUpdateUser();
      }
    });
  }
});

async function handleUpdateUser(event) {
  if (event && event.preventDefault) event.preventDefault();

  const userId = targetUserToEdit;
  if (!userId) return;

  const fullNameInput = document.getElementById("editFullName");
  const phoneInput = document.getElementById("editPhone");
  const statusInput = document.getElementById("editStatus");
  const roleInput = document.getElementById("editRole");
  const fileInput = document.getElementById("editAvatarInput");

  const fullName = fullNameInput ? fullNameInput.value.trim() : "";
  const phone = phoneInput ? phoneInput.value.trim() : "";
  const status = statusInput ? statusInput.value.trim().toLowerCase() : "";

  const rawRole = roleInput ? roleInput.value : (originalUserData?.role ?? "");
  const role = rawRole.trim().toLowerCase();

  const avatarFile = fileInput && fileInput.files ? fileInput.files[0] : null;

  const origName = (originalUserData?.fullName ?? "").trim();
  const origPhone = (originalUserData?.phone ?? "").trim();
  const origStatus = (originalUserData?.status ?? "").trim().toLowerCase();
  const origRole = (originalUserData?.role ?? "").trim().toLowerCase();

  const hasTextChanged =
    fullName !== origName ||
    phone !== origPhone ||
    status !== origStatus ||
    role !== origRole;

  const hasNewFile = avatarFile !== null && avatarFile !== undefined;

  if (!hasTextChanged && !hasNewFile) {
    showToast("No changes detected.", "info");
    return;
  }

  const editSystemButton = document.getElementById("updateSystemUserBtn");
  let uploadedPhotoPath = null;
  if (editSystemButton) {
    editSystemButton.disabled = true;
    editSystemButton.textContent = "Updating...";
  }

  try {
    let photoUrl =
      originalUserData?.photoUrl || originalUserData?.photo_url || null;

    if (hasNewFile) {
      if (editSystemButton)
        editSystemButton.textContent = "Compressing photo...";

      const compressedBlob = await compressImageToBlob(avatarFile, 800, 0.7);
      const versionId =
        globalThis.crypto?.randomUUID?.() ||
        `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const filePath = `${userId}/${versionId}.jpg`;

      if (editSystemButton) editSystemButton.textContent = "Uploading photo...";

      const { error: uploadError } = await supabaseClient.storage
        .from("avatars")
        .upload(filePath, compressedBlob, {
          contentType: "image/jpeg",
          upsert: false,
        });

      if (uploadError) throw uploadError;
      uploadedPhotoPath = filePath;

      const { data: urlData } = supabaseClient.storage
        .from("avatars")
        .getPublicUrl(filePath);

      photoUrl = `${urlData.publicUrl}?t=${Date.now()}`;
    }

    if (editSystemButton) editSystemButton.textContent = "Updating profile...";

    const { data, error } = await supabaseClient.functions.invoke(
      "admin-update-user",
      {
        body: {
          userId,
          full_name: fullName,
          phone_number: phone,
          role: role,
          status: status,
          photoUrl: photoUrl,
        },
      },
    );

    if (error) throw error;

    if (data && data.success === false) {
      const functionError = new Error(data.message || "Failed to update user.");
      functionError.code = data.code || data.error_code;
      functionError.status = data.status;
      throw functionError;
    }

    uploadedPhotoPath = null;

    showToast(data.message || "User updated successfully!", "success");

    const modal = document.getElementById("editSystemUserModal");
    if (modal) modal.style.display = "none";
    if (typeof unLockBodyScroll === "function") unLockBodyScroll();
    await loadSystemUsers();

    targetUserToEdit = null;
    originalUserData = null;
  } catch (err) {
    if (uploadedPhotoPath) {
      try {
        const { error: cleanupError } = await supabaseClient.storage
          .from("avatars")
          .remove([uploadedPhotoPath]);
        if (cleanupError) {
          console.error("Could not remove unused system user photo:", cleanupError);
        }
      } catch (cleanupError) {
        console.error("Could not remove unused system user photo:", cleanupError);
      }
    }
    console.error("System user update failed:", err);
    showToast(await getSystemUserErrorMessage(err, "update"), "error");
  } finally {
    if (editSystemButton) {
      editSystemButton.disabled = false;
      editSystemButton.textContent = "Update User";
    }
  }
}
