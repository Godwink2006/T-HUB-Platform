const form = document.getElementById("systemUserForm");

// Updated helper: returns a compressed Blob ready for Supabase Storage
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

        // Maintain aspect ratio while resizing
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        // Convert canvas directly to a binary Blob (image/jpeg)
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error("Canvas encoding failed."));
            }
          },
          "image/jpeg", // Convert all uploads to compressed JPEG
          quality, // 0.7 = 70% quality (great compression ratio)
        );
      };

      img.onerror = (err) => reject(err);
    };

    reader.onerror = (err) => reject(err);
  });
}

// Form Submit Handler
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const saveButton = form.querySelector(".save-btn");

  // FIX 1: Validate passwords BEFORE starting loading state or try block
  const password = document.getElementById("newPassword").value;
  const confirmPassword = document.getElementById("confirmPassword").value;

  if (password !== confirmPassword) {
    showToast("Passwords do not match.", "error");
    return; // Safely stops without locking the button
  }

  saveButton.disabled = true;
  saveButton.textContent = "Creating...";

  try {
    const full_name = document.getElementById("fullName").value.trim();
    const email = document.getElementById("email").value.trim();
    const phone_number = document.getElementById("phoneNumber").value.trim();
    const role = document.getElementById("role").value.toLowerCase();
    const status = document.getElementById("status").value.toLowerCase();

    const photoInput = document.getElementById("photo");

    // FIX 2: Properly declare photoBase64 variable
    let photoBase64 = null;

    if (photoInput && photoInput.files[0]) {
      saveButton.textContent = "Compressing photo...";

      // Compress to Blob
      const compressedBlob = await compressImageToBlob(
        photoInput.files[0],
        800,
        0.7,
      );

      // FIX 3: Convert Blob to Base64 using the defined helper
      photoBase64 = await blobToBase64(compressedBlob);
    }

    saveButton.textContent = "Creating user...";

    // Invoke Deno Edge Function
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
    await loadSystemUsers();
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
});

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result); // Returns full "data:image/jpeg;base64,..."
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

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

// Global variable to store the snapshot
let originalUserData = null;

async function editUser(userId) {
  targetUserToEdit = userId;

  // Fetch the latest user profile data from Supabase
  const { data: user, error } = await supabaseClient
    .from("profiles")
    .select("full_name, phone_number, role, status, photo_url")
    .eq("id", userId)
    .single();

  if (error || !user) {
    showToast("Could not load user details.", "error");
    return;
  }

  const fullNameValue = user.full_name || "";
  const phoneValue = user.phone_number || "";
  const statusValue = user.status || "";
  const roleValue = user.role || "";

  // Populate the edit modal form fields
  document.getElementById("editFullName").value = fullNameValue;
  document.getElementById("editPhone").value = phoneValue;
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

  document.getElementById("editStatus").value = statusValue;

  const roleInput = document.getElementById("editRole");
  if (roleInput) {
    roleInput.value = roleValue;
  }

  // Inside editUser():
const photoUrlValue = user.photo_url || null;

  // AFTER:
  originalUserData = {
    fullName: fullNameValue,
    phone: phoneValue,
    role: roleValue, // <-- ADD THIS
    status: statusValue,
    photoUrl: photoUrlValue, // <-- Add this property
  };

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

async function handleUpdateUser(event) {
  if (event && event.preventDefault) event.preventDefault();

  const userId = targetUserToEdit;
  if (!userId) return;

  const fullNameInput = document.getElementById("editFullName");
  const phoneInput = document.getElementById("editPhone");
  const statusInput = document.getElementById("editStatus");
  const roleInput = document.getElementById("editRole"); // Added Role field
  const fileInput = document.getElementById("editAvatarInput");

  // 2. Extract and format values (Force Lowercase for Role & Status)
  const fullName = fullNameInput ? fullNameInput.value.trim() : "";
  const phone = phoneInput ? phoneInput.value.trim() : "";
  const status = statusInput ? statusInput.value.trim().toLowerCase() : "";

  // Fallback to original role if role input doesn't exist on the form
  const rawRole = roleInput ? roleInput.value : (originalUserData?.role ?? "");
  const role = rawRole.trim().toLowerCase();

  const avatarFile = fileInput && fileInput.files ? fileInput.files[0] : null;

  const origName = originalUserData?.fullName ?? "";
  const origPhone = originalUserData?.phone ?? "";
  const origStatus = originalUserData?.status ?? "";
  const origRole = originalUserData?.role ?? "";

  // Check for changes
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
  if (editSystemButton) {
    editSystemButton.disabled = true;
    editSystemButton.textContent = "Updating...";
  }

  try {
    // Line 53 fix:
    let photoUrl =
      originalUserData?.photoUrl || originalUserData?.photo_url || null;

    if (hasNewFile) {
      if (editSystemButton)
        editSystemButton.textContent = "Compressing photo...";

      const compressedBlob = await compressImageToBlob(avatarFile, 800, 0.7);
      const filePath = `${userId}/${Date.now()}.jpg`;

      if (editSystemButton) editSystemButton.textContent = "Uploading photo...";

      const { error: uploadError } = await supabaseClient.storage
        .from("avatars")
        .upload(filePath, compressedBlob, {
          contentType: "image/jpeg",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabaseClient.storage
        .from("avatars")
        .getPublicUrl(filePath);

      photoUrl = urlData.publicUrl;
    }

    if (editSystemButton) editSystemButton.textContent = "Updating profile...";

    // Invoke Deno Edge Function with aligned key names
    const { data, error } = await supabaseClient.functions.invoke(
      "admin-update-user",
      {
        body: {
          userId,
          full_name: fullName,
          phone_number: phone,
          role: role, // <-- Sending lowercase role ("admin", "teacher", etc.)
          status: status, // <-- Sending lowercase status ("active", "inactive")
          photoUrl: photoUrl,
        },
      },
    );

    // 2. Check for Edge Function errors (HTTP 400/500)
    if (error) {
      let errorMessage = "Failed to update user.";

      // Extract custom JSON message from Edge Function
      if (error.context) {
        try {
          const errorBody = await error.context.json();
          if (errorBody?.message) {
            errorMessage = errorBody.message; // e.g., "Invalid role or status provided."
          }
        } catch (e) {
          /* Fallback if body parsing fails */
        }
      }

      // Throwing here sends execution straight to catch(err)
      throw new Error(errorMessage);
    }

    // 3. Handle explicit success = false responses (HTTP 200 edge cases)
    if (data && data.success === false) {
      throw new Error(data.message || "Failed to update user.");
    }

    // 4. Success Toast
    showToast(data.message || "User updated successfully!", "success");

    // Close modal & reload UI
    const modal = document.getElementById("editSystemUserModal");
    if (modal) modal.style.display = "none";
    if (typeof unLockBodyScroll === "function") unLockBodyScroll();
    await loadSystemUsers();

    targetUserToEdit = null;
    originalUserData = null;
  } catch (err) {
    // 5. HERE IS YOUR SHOWTOAST FOR ERRORS!
    // It receives the exact error message thrown from above.
    showToast(err.message, "error");
  } finally {
    if (editSystemButton) {
      editSystemButton.disabled = false;
      editSystemButton.textContent = "Update User";
    }
  }
}
// Call on initial load
document.addEventListener("DOMContentLoaded", loadSystemUsers);
