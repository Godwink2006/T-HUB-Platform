function togglePassword(id) {
  const input = document.getElementById(id);
  input.type = input.type === "password" ? "text" : "password";
}

const DEFAULT_AVATAR =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128' width='128' height='128'><circle cx='64' cy='64' r='64' fill='%23E4E6EB'/><circle cx='64' cy='46' r='22' fill='%23B0B3B8'/><path d='M24 112c0-22 18-40 40-40s40 18 40 40' fill='%23B0B3B8'/></svg>";

let currentProfileData = null; // Store fetched data for form resets

// 1. Fetch user data and populate form
async function loadMyProfile() {
  const {
    data: { user },
    error: authError,
  } = await supabaseClient.auth.getUser();

  if (authError || !user) return;

  const { data: profile, error } = await supabaseClient
    .from("profiles")
    .select("photo_url, full_name, email, phone_number")
    .eq("id", user.id)
    .single();

  if (error) {
    if (typeof showToast === "function")
      showToast("Error fetching profile", "error");
    return;
  }

  // Cache baseline data for reset operations
  currentProfileData = {
    fullName: profile.full_name || "",
    email: user.email || profile.email || "", // Fallback to auth.users email
    phone: profile.phone_number || "",
    photoUrl: profile.photo_url || DEFAULT_AVATAR,
  };

  populateProfileForm(currentProfileData);
}

function populateProfileForm(data) {
  document.getElementById("fullName").value = data.fullName;
  document.getElementById("emailAddress").value = data.email;
  document.getElementById("phoneNumber").value = data.phone;
  document.getElementById("profileAvatar").src = data.photoUrl;
}

// 2. Compress images client-side before storage upload
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
            blob ? resolve(blob) : reject(new Error("Canvas encoding failed."));
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

async function handleUpdateProfile(event) {
  if (event) event.preventDefault();

  const {
    data: { user },
  } = await supabaseClient.auth.getUser();
  if (!user) return;

  const fullName = document.getElementById("fullName").value.trim();
  const email = document.getElementById("emailAddress").value.trim();
  const fileInput = document.getElementById("myProfilePhoto");
  const phoneInput = document.getElementById("phoneNumber").value.trim();
  const saveBtn = document.getElementById("saveProfileInfo");

  const avatarFile = fileInput && fileInput.files ? fileInput.files[0] : null;

  // 1. Change detection
  const origName = currentProfileData?.fullName ?? "";
  const origEmail = currentProfileData?.email ?? "";
  const origPhone = currentProfileData?.phone ?? "";

  const hasTextChanged =
    fullName !== origName || email !== origEmail || phoneInput !== origPhone;

  const hasNewFile = Boolean(avatarFile);

  if (!hasTextChanged && !hasNewFile) {
    showToast("No changes detected.", "info");
    return;
  }

  // Place this right above "try {"
  const validationError = validateProfileInputs(fullName, email, phoneInput);
  if (validationError) {
    showToast(validationError, "error");
    return;
  }

  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";
  }

  try {
    let photoUrl = currentProfileData?.photoUrl;

    // 1. Handle Photo (Use fixed file name so it overwrites, and ONLY run if a new file was chosen)
    if (fileInput && fileInput.files[0]) {
      const file = fileInput.files[0];
      const compressedBlob = await compressImageToBlob(file, 800, 0.7);

      // Fixed path per user: Always overwrites 'avatar.jpg' instead of adding Date.now()
      const filePath = `${user.id}/avatar.jpg`;

      const { error: uploadError } = await supabaseClient.storage
        .from("avatars")
        .upload(filePath, compressedBlob, {
          contentType: "image/jpeg",
          upsert: true, // Overwrites existing file with the same name
        });

      if (uploadError) throw uploadError;

      // Add a timestamp query parameter to bypass browser caching when updated
      const { data: urlData } = supabaseClient.storage
        .from("avatars")
        .getPublicUrl(filePath);

      photoUrl = `${urlData.publicUrl}?t=${Date.now()}`;
    }

    // 2. Update Supabase Auth ONLY if email changed
    if (email !== user.email) {
      const { error: authError } = await supabaseClient.auth.updateUser({
        email,
      });
      if (authError) throw authError;
    }

    // 3. Update Your Database Table ('profiles')
    const { error: updateError } = await supabaseClient
      .from("profiles")
      .update({
        full_name: fullName,
        phone_number: phoneInput,
        email: email,
        photo_url: photoUrl,
      })
      .eq("id", user.id);

    if (updateError) throw updateError;

    // 4. Feedback
    if (email !== user.email) {
      showToast(
        "Profile saved! Check your new email for a verification link.",
        "info",
      );
    } else {
      showToast("Profile updated successfully!", "success");
    }

    await loadMyProfile();
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save Changes";
    }
  }
}

function validateProfileInputs(fullName, email, phone) {
  // 1. Full Name Validation (2-4 words, 3-100 characters)
  if (!fullName || fullName.length < 3 || fullName.length > 100) {
    return "Invalid full name length (must be 3-100 characters).";
  }
  const words = fullName.split(/\s+/);
  if (words.length < 2 || words.length > 4) {
    return "Full name must contain between 2 and 4 words.";
  }

  // 2. Email Validation (Must end with @gmail.com)
  const emailRegex = /^[a-zA-Z0-9._-]+@gmail\.com$/;
  if (!email || !emailRegex.test(email)) {
    return "Email must be a valid @gmail.com address.";
  }

  // 3. Phone Validation (Must start with 077 or 088 and be 10 digits)
  if (!phone || !/^(077|088)\d{7}$/.test(phone)) {
    return "Invalid phone number. Must start with 077 or 088 and contain 10 digits.";
  }

  return null; // Passes validation
}

// 4. Single DOM Initialization Block
document.addEventListener("DOMContentLoaded", () => {
  loadMyProfile();

  const profileForm = document.getElementById("myProfileForm");
  const fileInput = document.getElementById("myProfilePhoto");

  if (profileForm) {
    profileForm.addEventListener("submit", handleUpdateProfile);

    // Form Reset Listener
    profileForm.addEventListener("reset", (e) => {
      e.preventDefault();
      if (currentProfileData) populateProfileForm(currentProfileData);
      if (fileInput) fileInput.value = "";
    });
  }

  // Live Image Preview
  if (fileInput) {
    fileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          document.getElementById("profileAvatar").src = event.target.result;
        };
        reader.readAsDataURL(file);
      }
    });
  }
});

document.addEventListener("DOMContentLoaded", () => {
  const passwordForm = document.getElementById("changeMyPassword");
  if (passwordForm) {
    passwordForm.addEventListener("submit", handleChangePassword);
  }
});

async function handleChangePassword(event) {
  if (event) event.preventDefault();

  const currentPassword = document.getElementById("currentPassword").value;
  const newPassword = document.getElementById("newPassword").value;
  const confirmPassword = document.getElementById("confirmPassword").value;
  const saveBtn = document.querySelector("#changeMyPassword .save-btn");

  if (!currentPassword) {
    showToast("Please enter your current password.", "error");
    return;
  }

  if (newPassword !== confirmPassword) {
    showToast("New passwords do not match.", "error");
    return;
  }

  if (newPassword.length < 6) {
    showToast("Password must be at least 6 characters.", "error");
    return;
  }

  // Execute password complexity validation
  const validation = validatePasswordRequirements(newPassword);
  if (!validation.isValid) {
    showToast(validation.message, "error");
    return;
  }

  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = "Updating...";
  }

  try {
    // ✅ CORRECT (Combine into one single object):
    const { error } = await supabaseClient.auth.updateUser({
      password: newPassword,
      current_password: currentPassword,
    });
    if (error) throw error;

    showToast("Password updated successfully!", "success");
    document.getElementById("changeMyPassword").reset();
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save Changes";
    }
  }
}

function validatePasswordRequirements(password) {
  if (!password) {
    return { isValid: false, message: "Password is required." };
  }

  // Length must be between 12 and 20 characters
  if (password.length < 12 || password.length > 20) {
    return {
      isValid: false,
      message: "Password must be between 12 and 20 characters long.",
    };
  }

  // Must not contain whitespace
  if (/\s/.test(password)) {
    return { isValid: false, message: "Password must not contain spaces." };
  }

  // Must contain at least one uppercase letter
  if (!/[A-Z]/.test(password)) {
    return {
      isValid: false,
      message: "Password must include at least one uppercase letter.",
    };
  }

  // Must contain at least one lowercase letter
  if (!/[a-z]/.test(password)) {
    return {
      isValid: false,
      message: "Password must include at least one lowercase letter.",
    };
  }

  // Must contain at least one special character
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return {
      isValid: false,
      message: "Password must include at least one special character.",
    };
  }

  return { isValid: true, message: "" };
}
