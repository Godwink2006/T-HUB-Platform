function togglePassword(id) {
  const input = document.getElementById(id);
  input.type = input.type === "password" ? "text" : "password";
}

const DEFAULT_AVATAR =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128' width='128' height='128'><circle cx='64' cy='64' r='64' fill='%23E4E6EB'/><circle cx='64' cy='46' r='22' fill='%23B0B3B8'/><path d='M24 112c0-22 18-40 40-40s40 18 40 40' fill='%23B0B3B8'/></svg>";

let currentProfileData = null;
let myProfileDetailsReadOnly = false;

function getMyProfileErrorMessage(error, context = "profile", action = "update") {
  const code = String(error?.code || "").toLowerCase();
  const status = Number(error?.status || error?.statusCode || 0);
  const diagnostic = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`.toLowerCase();

  if (/school.{0,30}inactive|inactive.{0,30}school|school is not active/.test(diagnostic)) {
    return "This school is inactive, so this change is not allowed right now. Contact your school administrator for help.";
  }
  if (
    code === "42501" ||
    status === 403 ||
    /row-level security|permission denied|insufficient privilege|not authorized|unauthorized|access denied|not allowed/.test(diagnostic)
  ) {
    if (action === "load") {
      return `Could not load your ${context} because your account does not have permission. Contact your school administrator if you need help.`;
    }
    if (context === "password") {
      return "Your account is not allowed to change the password here. Sign in again or contact support for help.";
    }
    return "Your profile could not be saved because your account or school does not have permission for this change. Contact your school administrator if you need help.";
  }
  if (
    status === 401 ||
    code === "pgrst301" ||
    /invalid jwt|session.*expired|refresh token/.test(diagnostic)
  ) {
    return "Your session has expired. Sign in again and retry.";
  }
  if (/failed to fetch|network|connection|timeout|timed out/.test(diagnostic)) {
    return `Could not connect to ${action} your ${context}. Check your internet connection and try again.`;
  }
  if (code === "pgrst116") {
    return "Your profile could not be found. Sign in again or contact your school administrator.";
  }
  if (
    code === "23505" ||
    code === "email_exists" ||
    code === "user_already_exists" ||
    /already registered|email.*already|phone_number/.test(diagnostic)
  ) {
    if (/phone_number|phone number/.test(diagnostic)) {
      return "That phone number is already registered to another account.";
    }
    return "An account with that email address already exists. Use a different email address.";
  }
  if (code === "invalid_credentials" || /invalid login credentials|current password.*incorrect|password.*incorrect/.test(diagnostic)) {
    return "The current password is incorrect. Check it and try again.";
  }
  if (/same password|different from the old password/.test(diagnostic)) {
    return "Choose a new password that is different from your current password.";
  }
  if (code === "same_password") {
    return "Choose a new password that is different from your current password.";
  }
  if (/weak password|password should be at least|password.*too short/.test(diagnostic)) {
    return "That password does not meet the security requirements. Choose a stronger password and try again.";
  }
  if (/email rate limit|rate limit/.test(diagnostic)) {
    return "Too many attempts were made. Wait a little while, then try again.";
  }
  if (/file size|payload too large|object.*too large/.test(diagnostic) || status === 413) {
    return "The profile photo is too large. Choose a smaller image and try again.";
  }
  return `Could not update your ${context}. Please try again.`;
}

function showMyProfileError(error, context = "profile", action = "update") {
  console.error(`My Profile ${context} error:`, error);
  const message = getMyProfileErrorMessage(error, context, action);
  if (typeof showToast === "function") showToast(message, "error");
  return message;
}

async function loadMyProfile() {
  try {
    const { data, error: authError } = await supabaseClient.auth.getUser();
    if (authError) throw authError;
    const user = data?.user;

    if (!user) {
      showMyProfileError({ status: 401 }, "profile", "load");
      return;
    }

    const { data: profile, error } = await supabaseClient
      .from("profiles")
      .select("photo_url, full_name, email, phone_number")
      .eq("id", user.id)
      .single();

    if (error) {
      showMyProfileError(error, "profile", "load");
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
      photoUrl: avatarUrl,
    };

    populateProfileForm(currentProfileData);

    checkProfileChanges();
  } catch (error) {
    showMyProfileError(error, "profile", "load");
  }
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
  if (myProfileDetailsReadOnly) {
      showToast(
        "Graduated or transferred students cannot edit profile information.",
        "error",
      );
    return;
  }

  let user;
  try {
    const { data, error } = await supabaseClient.auth.getUser();
    if (error) throw error;
    user = data?.user;
    if (!user) {
      showMyProfileError({ status: 401 }, "profile");
      return;
    }
  } catch (error) {
    showMyProfileError(error, "profile");
    return;
  }

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

  let uploadedAvatarPath = null;
  let emailUpdateRequested = false;

  try {
    let photoUrl = currentProfileData?.photoUrl;

    if (fileInput && fileInput.files[0]) {
      const file = fileInput.files[0];
      const compressedBlob = await compressImageToBlob(file, 800, 0.7);

      const versionId =
        globalThis.crypto?.randomUUID?.() ||
        `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const filePath = `${user.id}/${versionId}.jpg`;

      const { error: uploadError } = await supabaseClient.storage
        .from("avatars")
        .upload(filePath, compressedBlob, {
          contentType: "image/jpeg",
          upsert: false,
        });

      if (uploadError) throw uploadError;
      uploadedAvatarPath = filePath;

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
      emailUpdateRequested = true;
    }

    const { data: updatedProfile, error: updateError } = await supabaseClient
      .from("profiles")
      .update({
        full_name: fullName,
        phone_number: phoneInput,
        photo_url: photoUrl,
      })
      .eq("id", user.id)
      .select("id");

    if (updateError) throw updateError;

    if (!updatedProfile || updatedProfile.length === 0) {
      const noProfileRowError = new Error("Profile update returned no rows.");
      noProfileRowError.code = "42501";
      throw noProfileRowError;
    }

    uploadedAvatarPath = null;

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
    if (uploadedAvatarPath) {
      try {
        const { error: cleanupError } = await supabaseClient.storage
          .from("avatars")
          .remove([uploadedAvatarPath]);
        if (cleanupError) {
          console.error("Could not remove unused profile photo upload:", cleanupError);
        }
      } catch (cleanupError) {
        console.error("Could not remove unused profile photo upload:", cleanupError);
      }
    }

    let message = getMyProfileErrorMessage(err, "profile");
    if (emailUpdateRequested) {
      message = `Your email change request was sent, but the rest of your profile could not be saved. ${message}`;
    }
    console.error("My Profile save error:", err);
    showToast(message, "error");
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

  const emailRegex = /^[a-zA-Z0-9._+-]+@gmail\.com$/i;
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
    showMyProfileError(err, "password");
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
  if (!saveBtn) return;

  try {
    const { data, error: authError } = await supabaseClient.auth.getUser();
    if (authError) throw authError;
    const user = data?.user;

    if (!user) {
      showMyProfileError({ status: 401 }, "enrollment information", "load");
      return;
    }

    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("role, school_id")
      .eq("id", user.id)
      .single();
    if (profileError) throw profileError;

    if (String(profile?.role || "").trim().toLowerCase() !== "student") {
      saveBtn.style.display = "flex";
      return;
    }

    let enrollmentQuery = supabaseClient
      .from("student_enrollments")
      .select("enrollment_status")
      .eq("student_id", user.id);
    if (profile.school_id) {
      enrollmentQuery = enrollmentQuery.eq("school_id", profile.school_id);
    }
    const { data: enrollment, error: dbError } = await enrollmentQuery;

    if (dbError) {
      showMyProfileError(dbError, "enrollment information", "load");
      return;
    }

    const isRestrictedType = (enrollment || []).some((record) =>
      ["graduated", "transferred", "transfered"].includes(
        String(record.enrollment_status || "").trim().toLowerCase(),
      ),
    );

    if (isRestrictedType) {
      myProfileDetailsReadOnly = true;
      const profileSection = document.getElementById("profileInformationSection");
      profileSection?.classList.add("graduated-profile-readonly");

      const notice = document.getElementById("profileInformationNotice");
      if (notice) {
        notice.textContent =
          "Your enrollment is marked as graduated or transferred. Profile details are read-only; you can still change your password below.";
        notice.hidden = false;
      }

      ["fullName", "emailAddress", "phoneNumber", "myProfilePhoto"].forEach((id) => {
        const field = document.getElementById(id);
        if (field) field.disabled = true;
      });
      saveBtn.style.display = "none";
      document
        .getElementById("resetProfileInfo")
        ?.style.setProperty("display", "none", "important");
      document
        .getElementById("profilePhotoActions")
        ?.style.setProperty("display", "none", "important");
    } else {
      saveBtn.style.display = "flex";
    }
  } catch (error) {
    showMyProfileError(error, "enrollment information", "load");
  }
});

document.addEventListener("DOMContentLoaded", async () => {
  const backBtn = document.getElementById("backBtn");
  if (!backBtn) return;

  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("from") === "parent") {
    backBtn.onclick = () => {
      window.location.href = "parent-dashboard.html";
    };
    return;
  }

  try {
    const { data, error: authError } = await supabaseClient.auth.getUser();
    if (authError) throw authError;
    const user = data?.user;

    if (user) {
      const { data: profile, error } = await supabaseClient
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      if (error) showMyProfileError(error, "profile", "load");

      const role = profile?.role?.toLowerCase();

      backBtn.onclick = () => {
        if (role === "parent") {
          window.location.replace("parent-dashboard.html"); // Prevents back-swipe
        } else {
          window.location.replace("settings.html");
        }
      };
    } else {
      backBtn.onclick = () => {
        window.location.replace("settings.html");
      };
    }
  } catch (err) {
    showMyProfileError(err, "profile", "load");
    backBtn.onclick = () => {
      window.location.href = "settings.html";
    };
  }
});
