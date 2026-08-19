const form = document.getElementById("systemUserForm");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const saveButton = form.querySelector(".save-btn");

  saveButton.disabled = true;
  saveButton.textContent = "Creating...";

  try {
    const full_name = document.getElementById("fullName").value.trim();
    const email = document.getElementById("email").value.trim();
    const phone_number = document.getElementById("phoneNumber").value.trim();
    const password = document.getElementById("newPassword").value;
    const confirmPassword = document.getElementById("confirmPassword").value;
    const role = document.getElementById("role").value.toLowerCase();
    const status = document.getElementById("status").value.toLowerCase();

    // GET THE PHOTO FILE INPUT HERE
    const photoInput = document.getElementById("photo");
    let photoBase64 = null;

    if (photoInput && photoInput.files[0]) {
      // 'await' works here because the outer function is 'async'
      photoBase64 = await compressAndConvertToBase64(
        photoInput.files[0],
        800,
        0.7,
      );
    }

    if (password !== confirmPassword) {
      showToast("Passwords do not match.", "error");
      return;
    }

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

    if (error) {
      throw error;
    }

    await loadSystemUsers();
    showToast(data?.message || "User created successfully!", "success");

    form.reset();
  } catch (err) {
    let message = err.message;

    if (err.context) {
      try {
        const errorBody = await err.context.json();

        if (errorBody?.message) {
          message = errorBody.message;
        }
      } catch (parseError) {}
    }

    showToast(message, "error");
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = "Save";
  }
  loadSystemUsers();
});

const systemUserModal = document.getElementById("systemUserModal");

const cancelSystemUserModal = document.getElementById("cancelSystemUserModal");

const openSystemUserModal = document.getElementById("addSystemUser");

const closeSystemUserModal = document.getElementById("closeSystemUserModal");

openSystemUserModal.addEventListener("click", () => {
  systemUserModal.style.display = "flex";

  lockBodyScroll();
});

closeSystemUserModal.addEventListener("click", () => {
  systemUserModal.style.display = "none";

  unLockBodyScroll();
});

cancelSystemUserModal.addEventListener("click", () => {
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

editSystemUserButtons.forEach((button) => {
  button.addEventListener("click", () => {
    editSystemUserModal.style.display = "flex";

    lockBodyScroll();
  });
});

closeEditSystemUserModal.addEventListener("click", () => {
  editSystemUserModal.style.display = "none";

  unLockBodyScroll();
});

cancelEditSystemUserModal.addEventListener("click", () => {
  editSystemUserModal.style.display = "none";

  unLockBodyScroll();
});

window.addEventListener("click", (e) => {
  if (e.target === editSystemUserModal) {
    editSystemUserModal.style.display = "none";

    unLockBodyScroll();
  }
});

const archiveSystemUserModal = document.getElementById(
  "archiveSystemUserModal",
);

const archiveButtons = document.querySelectorAll(".archive-SystemUser");

const cancelArchive = document.getElementById("cancelArchive");

archiveButtons.forEach((button) => {
  button.addEventListener("click", () => {
    archiveSystemUserModal.style.display = "flex";

    lockBodyScroll();
  });
});

cancelArchive.addEventListener("click", () => {
  archiveSystemUserModal.style.display = "none";

  unLockBodyScroll();
});

window.addEventListener("click", (e) => {
  if (e.target === archiveSystemUserModal) {
    archiveSystemUserModal.style.display = "none";

    unLockBodyScroll();
  }
});

function togglePassword(id) {
  const input = document.getElementById(id);
  input.type = input.type === "password" ? "text" : "password";
}

// Global function called by onclick="editUser('${user.id}')"
function editUser(userId) {
  const modal = document.getElementById("editSystemUserModal"); // Match your HTML modal ID
  if (modal) {
    modal.style.display = "flex";
    if (typeof lockBodyScroll === "function") lockBodyScroll();
    // Option to fetch/populate user data using userId
  }
}

function deleteUser(userId) {
  targetUserToArchive = userId; // Store the ID globally for the confirmation button
  const modal = document.getElementById("archiveSystemUserModal");
  if (modal) {
    modal.style.display = "flex";
    if (typeof lockBodyScroll === "function") lockBodyScroll();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const confirmArchiveBtn = document.getElementById("confirmArchiveBtn");

  if (confirmArchiveBtn) {
    confirmArchiveBtn.addEventListener("click", async () => {
      if (targetUserToArchive) {
        await archiveUser(targetUserToArchive);
        targetUserToArchive = null; // Reset after archiving
      }
    });
  }
});

// Close listeners for static buttons (Cancel/X icons inside modals)
document.addEventListener("DOMContentLoaded", () => {
  const closeEditBtn = document.getElementById("closeEditSystemUserModal");
  const cancelEditBtn = document.getElementById("cancelEditSystemUserModal");
  const editModal = document.getElementById("editSystemUserModal");

  const cancelArchiveBtn = document.getElementById("cancelArchive");
  const archiveModal = document.getElementById("archiveSystemUserModal");

  const closeModal = (modal) => {
    if (modal) modal.style.display = "none";
    if (typeof unLockBodyScroll === "function") unLockBodyScroll();
  };

  if (closeEditBtn)
    closeEditBtn.addEventListener("click", () => closeModal(editModal));
  if (cancelEditBtn)
    cancelEditBtn.addEventListener("click", () => closeModal(editModal));
  if (cancelArchiveBtn)
    cancelArchiveBtn.addEventListener("click", () => closeModal(archiveModal));
});

// system-users.js
async function loadSystemUsers() {
  // Select tbody inside table#usersTable
  const tableBody = document.querySelector("#usersTable tbody");
  if (!tableBody) return;

  // 1. Get current filter & search values from DOM
  const searchInput = document.getElementById("searchInput");
  const roleFilter = document.getElementById("roleFilter");
  const statusFilter = document.getElementById("statusFilter");

  const searchTerm = searchInput ? searchInput.value.trim() : "";
  const roleValue = roleFilter ? roleFilter.value.toLowerCase() : "";
  const statusValue = statusFilter ? statusFilter.value.toLowerCase() : "";

  // 1. Show loading state across all 7 columns
  tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center;">Loading users...</td></tr>`;

  // 3. Build dynamic Supabase query
  let query = supabaseClient
    .from("profiles")
    .select(
      "id, full_name, email, phone_number, role, status, photo_url, is_archived",
    )
    .eq("is_archived", false)
    .not("role", "in", '("admin")')
    .order("created_at", { ascending: false });

  // Apply search across full_name, email, or phone_number
  if (searchTerm) {
    query = query.or(
      `full_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,phone_number.ilike.%${searchTerm}%`,
    );
  }

  // Apply role filter (ignore default placeholder option)
  if (roleValue && roleValue !== "role") {
    query = query.ilike("role", roleValue);
  }

  // Apply status filter (ignore default placeholder option)
  if (statusValue && statusValue !== "status") {
    query = query.ilike("status", statusValue);
  }

  // Order results
  query = query.order("created_at", { ascending: false });

  // Execute query
  const { data: users, error } = await query;

  if (error) {
    tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center;">Failed to load users.</td></tr>`;
    return;
  }

  if (!users || users.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center;">No users found.</td></tr>`;
    return;
  }

  // 3. Populate all 7 columns matching system-users.html
  tableBody.innerHTML = users
    .map(
      (user) => `
    <tr>
           <td>
          <img src="${user.photo_url ? user.photo_url : DEFAULT_AVATAR}" class="systemUser-photo" alt="Profile" onerror="this.onerror=null; this.src=DEFAULT_AVATAR;" />
        </td>
      <td>${user.full_name || "N/A"}</td>
      <td>${user.email || "N/A"}</td>
      <td>${user.phone_number || "N/A"}</td>
      <td>${user.role || "N/A"}</td>
      <td>
        <span class="systemUsers-status-${(user.status || "inactive").toLowerCase()}">
          ${user.status || "Inactive"}
        </span>
      </td>
      <td>
        <button class="systemUsers-actions-btn edit-SystemUser" onclick="editUser('${user.id}')">
          <i class="fa-solid fa-pen"></i>
        </button>
        <button class="systemUsers-actions-btn archive-SystemUser" onclick="deleteUser('${user.id}')">
          <i class="fa-solid fa-box-archive"></i>
        </button>
      </td>
    </tr>
  `,
    )
    .join("");
}

// 5. Initialize listeners on page load
document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("searchInput");
  const roleFilter = document.getElementById("roleFilter");
  const statusFilter = document.getElementById("statusFilter");

  if (searchInput) searchInput.addEventListener("input", loadSystemUsers);
  if (roleFilter) roleFilter.addEventListener("change", loadSystemUsers);
  if (statusFilter) statusFilter.addEventListener("change", loadSystemUsers);

  // Initial load
  loadSystemUsers();
});

const DEFAULT_AVATAR =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128' width='128' height='128'><circle cx='64' cy='64' r='64' fill='%23E4E6EB'/><circle cx='64' cy='46' r='22' fill='%23B0B3B8'/><path d='M24 112c0-22 18-40 40-40s40 18 40 40' fill='%23B0B3B8'/></svg>";

// Helper to convert File to Base64
function compressAndConvertToBase64(file, maxWidth = 800, quality = 0.7) {
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

        resolve(canvas.toDataURL("image/jpeg", quality));
      };

      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}

let targetUserToArchive = null;

async function archiveUser(targetUserId) {
  try {
    // 1. Verify Active Session
    const {
      data: { session },
      error: sessionError,
    } = await supabaseClient.auth.getSession();

    if (sessionError || !session) {
      showToast("Your session has expired. Please log in again.", "error");
      window.location.href = "index.html";
      return;
    }

    // 2. Prevent Self-Archiving
    if (session.user.id === targetUserId) {
      showToast("You cannot archive your own admin account.", "error");
      return;
    }

    // 3. Verify Admin Role & Account Status
    const { data: adminProfile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("role, is_archived, status")
      .eq("id", session.user.id)
      .single();

    if (profileError || !adminProfile) {
      showToast("Unable to verify user permissions.", "error");
      return;
    }

    if (
      adminProfile.role !== "admin" ||
      adminProfile.is_archived ||
      adminProfile.status !== "active"
    ) {
      showToast(
        "Access denied: You do not have permission to perform this action.",
        "error",
      );
      return;
    }

    // 4. Perform Soft Delete / Archive
    const { error: updateError } = await supabaseClient
      .from("profiles")
      .update({ is_archived: true, status: "inactive" })
      .eq("id", targetUserId);

    if (updateError) {
      console.error("Archive error:", updateError.message);
      showToast("Failed to archive user. Check database policies.", "error");
      return;
    }

    // 5. Success UI Handling
    showToast("User successfully archived.", "success");
    document.getElementById("archiveSystemUserModal").style.display = "none";
    if (typeof unLockBodyScroll === "function") unLockBodyScroll();

    // Refresh user list table
    if (typeof loadSystemUsers === "function") loadSystemUsers();
  } catch (err) {
    console.error("Unexpected error during archive operation:", err);
  }
}

// Function to populate edit modal with user profile data
async function editUser(userId) {
  targetUserToEdit = userId;

  const { data: user, error } = await supabaseClient
    .from("profiles")
    .select("full_name, email, phone_number, role, status, photo_url")
    .eq("id", userId)
    .single();

  if (error || !user) return;

  // Set avatar preview safely
  const previewImg = document.getElementById("editAvatarPreview");
  if (previewImg) {
    previewImg.src = user.photo_url || "assets/default-avatar.png";
  }

  // Clear hidden file input and reset file label
  const fileInput = document.getElementById("editAvatarInput");
  const fileNameText = document.getElementById("fileNameDisplay");
  if (fileInput) fileInput.value = "";
  if (fileNameText) fileNameText.textContent = "No new file chosen";

  // Display Modal
  const modal = document.getElementById("editSystemUserModal");
  if (modal) modal.style.display = "flex";
}

// Live preview handler when a new file is selected
document.addEventListener("DOMContentLoaded", () => {
  const fileInput = document.getElementById("editAvatarInput");
  const fileNameText = document.getElementById("fileNameDisplay");
  const previewImg = document.getElementById("editAvatarPreview");

  if (fileInput) {
    fileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) {
        // Update label with file name
        if (fileNameText) fileNameText.textContent = file.name;

        // Render live preview locally without uploading yet
        const reader = new FileReader();
        reader.onload = (event) => {
          if (previewImg) previewImg.src = event.target.result;
        };
        reader.readAsDataURL(file);
      }
    });
  }
});

async function editUser(userId) {
  targetUserToEdit = userId;

  // Fetch the latest user profile data from Supabase
  const { data: user, error } = await supabaseClient
    .from("profiles")
    .select("full_name, phone_number, status, photo_url")
    .eq("id", userId)
    .single();

  if (error || !user) {
    showToast("Could not load user details.", "error");
    return;
  }

  // Populate the edit modal form fields
  document.getElementById("editFullName").value = user.full_name || "";
  document.getElementById("editPhone").value = user.phone_number || "";
  // ✅ CORRECT: Update an <img> preview element instead of the file input
  const avatarPreview = document.getElementById("editAvatarPreview");
  if (avatarPreview) {
    avatarPreview.src = user.photo_url || DEFAULT_AVATAR; // Fallback image
  }

  // Clear the file input so it is ready for a new file upload if selected
  const fileInput = document.getElementById("editAvatarInput");
  if (fileInput) {
    fileInput.value = "";
  }
  document.getElementById("editStatus").value = user.status || "";

  // Open the modal
  const modal = document.getElementById("editSystemUserModal");
  if (modal) {
    modal.style.display = "flex";
    if (typeof lockBodyScroll === "function") lockBodyScroll();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const updateSystemUserBtn = document.getElementById("updateSystemUserBtn");

  if (updateSystemUserBtn) {
    updateSystemUserBtn.addEventListener("click", async () => {
      if (targetUserToEdit) {
        await handleUpdateUser();
      }
    });
  }
});
let targetUserToEdit = null;

async function handleUpdateUser(event) {
  const editSystemButton = document.getElementById("updateSystemUserBtn");

  editSystemButton.disabled = true;
  editSystemButton.textContent = "Updating...";

  try {
    const userId = targetUserToEdit;
    const fullName = document.getElementById("editFullName").value.trim();
    const phone = document.getElementById("editPhone").value.trim();
    const status = document.getElementById("editStatus").value;
    const fileInput = document.getElementById("editAvatarInput");
    const avatarFile = fileInput ? fileInput.files[0] : null;

    let photoUrl;

    // 1. Upload photo to storage IF selected
    if (avatarFile) {
      // Extract file extension first
      const fileExt = avatarFile.name.split(".").pop();
      const filePath = `${userId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabaseClient.storage
        .from("avatars")
        .upload(filePath, avatarFile, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabaseClient.storage
        .from("avatars")
        .getPublicUrl(filePath);

      photoUrl = urlData.publicUrl;
    }

    // 2. Invoke Deno Edge Function with full_name included
    const { data, error } = await supabaseClient.functions.invoke(
      "admin-update-user",
      {
        body: {
          userId,
          fullName,
          phone,
          status,
          photoUrl,
        },
      },
    );

    if (error || data?.error) {
      throw new Error(error?.message || data?.error);
    }

    showToast("User updated successfully!", "success");

    // Close modal & reload user table
    const modal = document.getElementById("editSystemUserModal");
    if (modal) modal.style.display = "none";
    if (typeof unLockBodyScroll === "function") unLockBodyScroll();
    await loadSystemUsers();

    targetUserToEdit = null;
  } catch (err) {
    showToast("Failed to update user: " + err.message, "error");
  } finally {
    editSystemButton.disabled = false;
    editSystemButton.textContent = "Update User";
  }
}

// Call on initial load
document.addEventListener("DOMContentLoaded", loadSystemUsers);
