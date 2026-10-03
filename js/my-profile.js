function togglePassword(id) {
  const input = document.getElementById(id);
  input.type = input.type === "password" ? "text" : "password";
}

const DEFAULT_AVATAR =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128' width='128' height='128'><circle cx='64' cy='64' r='64' fill='%23E4E6EB'/><circle cx='64' cy='46' r='22' fill='%23B0B3B8'/><path d='M24 112c0-22 18-40 40-40s40 18 40 40' fill='%23B0B3B8'/></svg>";

let currentProfileData = null;

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

  let avatarUrl = profile.photo_url || DEFAULT_AVATAR;
  if (profile.photo_url && !profile.photo_url.includes("?t=")) {
    avatarUrl = `${profile.photo_url}?t=${Date.now()}`;
  }

  currentProfileData = {
    fullName: profile.full_name || "",
    email: user.email || profile.email || "",
    phone: profile.phone_number || "",
    photoUrl: profile.photo_url || DEFAULT_AVATAR,
  };

  populateProfileForm(currentProfileData);

  checkProfileChanges();
}

function populateProfileForm(data) {
  document.getElementById("fullName").value = data.fullName;
  document.getElementById("emailAddress").value = data.email;
  document.getElementById("phoneNumber").value = data.phone;
  document.getElementById("profileAvatar").src = data.photoUrl;
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

    if (fileInput && fileInput.files[0]) {
      const file = fileInput.files[0];
      const compressedBlob = await compressImageToBlob(file, 800, 0.7);

      const filePath = `${user.id}/avatar.jpg`;

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

      photoUrl = `${urlData.publicUrl}?t=${Date.now()}`;
    }

    const isEmailChanging = email !== user.email;
    if (isEmailChanging) {
      const { error: authError } = await supabaseClient.auth.updateUser({
        email,
      });
      if (authError) throw authError;
    }

    const { error: updateError } = await supabaseClient
      .from("profiles")
      .update({
        full_name: fullName,
        phone_number: phoneInput,
        photo_url: photoUrl,
      })
      .eq("id", user.id);

    if (updateError) {
      if (updateError.code === "23505") {
        if (
          updateError.message?.includes("phone_number") ||
          updateError.details?.includes("phone_number")
        ) {
          showToast(
            "That phone number is already registered to another account.",
            "error",
          );
          return;
        }

        showToast("An account with these details already exists.", "error");
        return;
      }

      throw updateError;
    }

    if (isEmailChanging) {
      showToast(
        "Profile saved! Check your new email address to confirm the change.",
        "info",
      );
    } else {
      showToast("Profile updated successfully!", "success");
    }

    await loadMyProfile();

    if (fileInput) fileInput.value = "";
    checkProfileChanges();
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save Changes";
    }
  }
}

function checkProfileChanges() {
  const saveBtn = document.getElementById("saveProfileInfo");
  if (!saveBtn) return;

  saveBtn.disabled = false;
}

function validateProfileInputs(fullName, email, phone) {
  if (!fullName || fullName.length < 3 || fullName.length > 100) {
    return "Invalid full name length (must be 3-100 characters).";
  }
  const words = fullName.split(/\s+/);
  if (words.length < 2 || words.length > 4) {
    return "Full name must contain between 2 and 4 words.";
  }

  const emailRegex = /^[a-zA-Z0-9._-]+@gmail\.com$/;
  if (!email || !emailRegex.test(email)) {
    return "Email must be a valid @gmail.com address.";
  }

  if (!phone || !/^(077|088)\d{7}$/.test(phone)) {
    return "Invalid phone number. Must start with 077 or 088 and contain 10 digits.";
  }

  return null;
}

document.addEventListener("DOMContentLoaded", () => {
  loadMyProfile();

  const profileForm = document.getElementById("myProfileForm");
  const fileInput = document.getElementById("myProfilePhoto");

  if (profileForm) {
    profileForm.addEventListener("submit", handleUpdateProfile);

    profileForm.addEventListener("reset", (e) => {
      e.preventDefault();
      if (currentProfileData) populateProfileForm(currentProfileData);
      if (fileInput) fileInput.value = "";
    });
  }

  const passwordForm = document.getElementById("changeMyPassword");
  if (passwordForm) {
    passwordForm.addEventListener("submit", handleChangePassword);
  }

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

  document
    .getElementById("fullName")
    ?.addEventListener("input", checkProfileChanges);
  document
    .getElementById("emailAddress")
    ?.addEventListener("input", checkProfileChanges);
  document
    .getElementById("phoneNumber")
    ?.addEventListener("input", checkProfileChanges);
  document
    .getElementById("myProfilePhoto")
    ?.addEventListener("change", checkProfileChanges);
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

  if (password.length < 12 || password.length > 20) {
    return {
      isValid: false,
      message: "Password must be between 12 and 20 characters long.",
    };
  }

  if (/\s/.test(password)) {
    return { isValid: false, message: "Password must not contain spaces." };
  }

  if (!/[A-Z]/.test(password)) {
    return {
      isValid: false,
      message: "Password must include at least one uppercase letter.",
    };
  }

  if (!/[a-z]/.test(password)) {
    return {
      isValid: false,
      message: "Password must include at least one lowercase letter.",
    };
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return {
      isValid: false,
      message: "Password must include at least one special character.",
    };
  }

  return { isValid: true, message: "" };
}

document.addEventListener("DOMContentLoaded", async function () {
  const saveBtn = document.getElementById("saveProfileInfo");

  const {
    data: { user },
    error: authError,
  } = await supabaseClient.auth.getUser();

  if (authError || !user) {
    console.error("User not logged in");
    return;
  }

  const { data: enrollment, error: dbError } = await supabaseClient
    .from("student_enrollments")
    .select("school_id, enrollment_status")
    .eq("student_id", user.id);

  if (dbError || !enrollment) {
    console.error("Could not fetch enrollment information", dbError);
    return;
  }

  const isRestrictedType = enrollment.some(
    (enrollment) =>
      enrollment.enrollment_status === "Graduated" ||
      enrollment.enrollment_status === "Transfered",
  );

  if (isRestrictedType) {
    saveBtn.style.display = "none";
  }
});
