function togglePassword(id) {
  const input = document.getElementById(id);
  input.type = input.type === "password" ? "text" : "password";
}

async function loadMyProfile() {
  // 1. Get current logged-in user session
  const {
    data: { user },
    error: authError,
  } = await supabaseClient.auth.getUser();
  if (authError || !user) return;

  // 2. Fetch profile row for this specific user
  const { data: profile, error } = await supabaseClient
    .from("profiles")
    .select("photo_url, full_name, email, phone_number")
    .eq("id", user.id)
    .single();

  if (error) {
    console.error("Error fetching profile:", error.message);
    return;
  }

  // 3. Fill the form fields with current data
  document.getElementById("fullName").value = profile.full_name || "";
  document.getElementById("emailAddress").value = profile.email || user.email;
  document.getElementById("phoneNumber").value = profile.phone_number || "";

  if (profile.photo_url) {
    document.getElementById("profileAvatar").src = profile.photo_url;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadMyProfile();
});

let currentProfileData = null; // Store fetched data for reset

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
    showToast("Error fetching profile", "error");
    return;
  }

  // Save copy for reset functionality
  currentProfileData = {
    fullName: profile.full_name || "",
    email: profile.email || user.email || "",
    phone: profile.phone_number || "",
    photoUrl: profile.photo_url || DEFAULT_AVATAR,
  };

  populateProfileForm(currentProfileData);
}

const DEFAULT_AVATAR =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128' width='128' height='128'><circle cx='64' cy='64' r='64' fill='%23E4E6EB'/><circle cx='64' cy='46' r='22' fill='%23B0B3B8'/><path d='M24 112c0-22 18-40 40-40s40 18 40 40' fill='%23B0B3B8'/></svg>";

function populateProfileForm(data) {
  document.getElementById("fullName").value = data.fullName;
  document.getElementById("emailAddress").value = data.email;
  document.getElementById("phoneNumber").value = data.phone;
  document.getElementById("profileAvatar").src = data.photoUrl;
}

document.addEventListener("DOMContentLoaded", () => {
  loadMyProfile();

  // 1. Live image preview when choosing a file
  const fileInput = document.getElementById("myProfilePhoto");
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

  // 2. Handle Profile Reset button
  const profileForm =
    document.getElementById("fullName").closest("form") ||
    document.querySelector(".form-section");
  if (profileForm) {
    profileForm.addEventListener("reset", (e) => {
      e.preventDefault();
      if (currentProfileData) populateProfileForm(currentProfileData);
      if (fileInput) fileInput.value = "";
    });
  }
});

document.addEventListener("DOMContentLoaded", () => {
  loadMyProfile();

  // 1. Handle Profile Update Form Submit
  const profileForm = document.getElementById("myProfileForm");
  if (profileForm) {
    profileForm.addEventListener("submit", handleUpdateProfile);
  }

  // 2. Handle Live Image Preview
  const fileInput = document.getElementById("myProfilePhoto");
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


async function handleUpdateProfile(event) {
  if (event) event.preventDefault();

  const {
    data: { user },
  } = await supabaseClient.auth.getUser();
  if (!user) return;

  const fullName = document.getElementById("fullName").value.trim();
  const email = document.getElementById("emailAddress").value.trim();
  const phone = document.getElementById("phoneNumber").value.trim();
  const fileInput = document.getElementById("myProfilePhoto");

 // ✅ CORRECT: Added '#' for ID selection
const saveBtn = document.getElementById("saveProfileInfo");
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";
  }

  try {
    let photoUrl = currentProfileData?.photoUrl;

    // 1. Upload new photo if selected
    if (fileInput && fileInput.files[0]) {
      const file = fileInput.files[0];
      const compressedBlob = await compressImageToBlob(file, 800, 0.7); // standard compression
      const filePath = `${user.id}/${Date.now()}.jpg`;

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

    // 2. Update Database Row Directly
    const { error: updateError } = await supabaseClient
      .from("profiles")
      .update({
        full_name: fullName,
        phone_number: phone,
        email,
        photo_url: photoUrl,
      })
      .eq("id", user.id);

    if (updateError) throw updateError;

    // 3. Update Auth Email if changed
    if (email !== user.email) {
      const { error: emailError } = await supabaseClient.auth.updateUser({
        email,
      });
      if (emailError) throw emailError;
      showToast(
        "Profile updated! Please check your new email for verification.",
        "info",
      );
    } else {
      showToast("Profile updated successfully!", "success");
    }

    // Refresh state
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

async function handleChangePassword(event) {
  if (event) event.preventDefault();

  const newPassword = document.getElementById("newPassword").value;
  const confirmPassword = document.getElementById("confirmPassword").value;

  if (newPassword !== confirmPassword) {
    showToast("Passwords do not match.", "error");
    return;
  }

  if (newPassword.length < 6) {
    showToast("Password must be at least 6 characters.", "error");
    return;
  }

  try {
    // Direct Supabase Auth password update
    const { error } = await supabaseClient.auth.updateUser({
      password: newPassword,
    });

    if (error) throw error;

    showToast("Password updated successfully!", "success");

    // Clear password inputs
    document.getElementById("currentPassword").value = "";
    document.getElementById("newPassword").value = "";
    document.getElementById("confirmPassword").value = "";
  } catch (err) {
    showToast(err.message, "error");
  }
}
