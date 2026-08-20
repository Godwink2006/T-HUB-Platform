// Add this global variable at the very top of your JS file
let originalSchoolData = {};

async function compressImageToBlob(file, maxWidth = 800, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target.result;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) =>
            blob ? resolve(blob) : reject(new Error("Canvas export failed")),
          "image/jpeg",
          quality,
        );
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}

let existingRecordId = null;

async function checkAdminAuth() {
  const {
    data: { session },
    error: sessionError,
  } = await supabaseClient.auth.getSession();

  if (sessionError || !session) {
    return { isAdmin: false, user: null };
  }

  const { data: profile, error: profileError } = await supabaseClient
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .single();

  if (profileError || profile?.role !== "admin") {
    return { isAdmin: false, user: session.user };
  }

  return { isAdmin: true, user: session.user };
}

/**
 * Disables form submission and input fields if user is not an admin.
 */
function disableFormInputs(form) {
  const inputs = form.querySelectorAll(
    'input, select, textarea, button[type="submit"]',
  );
  inputs.forEach((input) => {
    input.disabled = true;
  });

  // Hide the save button completely
  const saveBtn = form.querySelector('.save-btn, button[type="submit"]');
  if (saveBtn) {
    saveBtn.style.display = "none";
  }

  // Disable and hide the reset button
  const resetBtn = form.querySelector('.reset-btn, button[type="reset"]');
  if (resetBtn) {
    resetBtn.disabled = true;
    resetBtn.style.display = "none";
  }

  // Hide the logo file input for non-admins
  const logoInput = document.getElementById("schoolLogo"); // or the ID of your file input
  if (logoInput) {
    logoInput.style.display = "none";
  }
}

/**
 * Loads existing school profile from Supabase and fills the form.
 */
async function loadSchoolProfile() {
  try {
    const { data, error } = await supabaseClient
      .from("school_profile")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    if (data) {
      existingRecordId = data.id;

      // Populate form fields matching your HTML element IDs
      // Replace line 84:
      // setValue('schoolLogo', data.logo_url);

      // With this:
      const logoImg = document.getElementById("schoolLogoPreview");
      if (logoImg && data.logo_url) {
        logoImg.src = data.logo_url;
      }

      setValue("schoolName", data.school_name);
      setValue("schoolMotto", data.school_motto);
      setValue("schoolEmail", data.email);
      setValue("alternativePhone", data.alternative_phone);
      setValue("schoolWebsite", data.website);
      setValue("schoolAddress", data.address);
      setValue("schoolCity", data.city);
      setValue("schoolCountry", data.country);

      setValue("principalName", data.principal_name);
      setValue("principalEmail", data.principal_email);
      setValue("principalPhone", data.principal_phone);

      setValue("schoolType", data.school_type);
      setValue("educationLevel", data.education_level);
    }

    originalSchoolData = { ...data };
  } catch (err) {
    console.error("Error loading school profile:", err.message);
  }
}

/**
 * Validates form inputs, uploads logo if present, and upserts data.
 */
async function handleFormSubmit() {
  const formData = {
    school_name: getValue("schoolName").trim(),
    school_motto: getValue("schoolMotto").trim(),
    email: getValue("schoolEmail").trim(),
    alternative_phone: getValue("alternativePhone").trim(),
    website: getValue("schoolWebsite").trim(),
    address: getValue("schoolAddress").trim(),
    city: getValue("schoolCity").trim(),
    country: getValue("schoolCountry").trim(),
    principal_name: getValue("principalName").trim(),
    principal_email: getValue("principalEmail").trim(),
    principal_phone: getValue("principalPhone").trim(),
    school_type: getValue("schoolType"),
    education_level: getValue("educationLevel"),
  };

  const logoFile = document.getElementById("schoolLogo")?.files[0];

  // --- 1. CHANGE DETECTION VALIDATION ---
  let hasChanges = false;
  if (logoFile) {
    hasChanges = true;
  } else {
    for (const key in formData) {
      const originalValue = (originalSchoolData[key] ?? "").toString().trim();
      if (formData[key] !== originalValue) {
        hasChanges = true;
        break;
      }
    }
  }

  if (!hasChanges) {
    showToast("No changes detected.", "info");
    return;
  }

  // --- CLIENT-SIDE VALIDATION ---
  if (
    !formData.school_name ||
    !formData.email ||
    !formData.address ||
    !formData.city ||
    !formData.country ||
    !formData.principal_name ||
    !formData.principal_email ||
    !formData.principal_phone ||
    !formData.school_type ||
    !formData.education_level
  ) {
    showToast("Please fill out all required fields.", "error");
    return;
  }

  // --- 3. GMAIL DOMAIN VALIDATION ---
  const gmailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;
  if (!gmailRegex.test(formData.email)) {
    showToast("School email must end with @gmail.com", "error");
    return;
  }

  if (!gmailRegex.test(formData.principal_email)) {
    showToast("Principal email must end with @gmail.com", "error");
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (
    !emailRegex.test(formData.email) ||
    !emailRegex.test(formData.principal_email)
  ) {
    showToast(
      "Please enter valid email addresses for the school and principal.",
      "error",
    );
    return;
  }

  // --- PHONE NUMBER VALIDATION (E.g., 10 digits starting with 077/088) ---
  const phoneRegex = /^(077|088)\d{7}$/;
  if (
    formData.alternative_phone &&
    !phoneRegex.test(formData.alternative_phone)
  ) {
    showToast(
      "Alternative phone number must start with 077 or 088 and contain 10 digits.",
      "error",
    );
    return;
  }

  if (!phoneRegex.test(formData.principal_phone)) {
    showToast(
      "Principal phone number must start with 077 or 088 and contain 10 digits.",
      "error",
    );
    return;
  }

  // --- 1. COUNTRY VALIDATION ---
  if (formData.country.toLowerCase() !== "liberia") {
    showToast("Country must be Liberia.", "error");
    return;
  }

  // --- 2. WEBSITE VALIDATION (Must start with https://) ---
  if (formData.website && !formData.website.startsWith("https://")) {
    showToast("School website URL must start with https://", "error");
    return;
  }

  const saveBtn = document.querySelector(
    '#schoolInformationForm .save-btn, #schoolInformationForm button[type="submit"]',
  );

  try {
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = "Saving...";
    }

    const logoFile = document.getElementById("schoolLogo")?.files[0];
    if (logoFile) {
      const compressedBlob = await compressImageToBlob(logoFile, 800, 0.7);
      // Fixed path per school profile so it overwrites instead of creating new files
      const filePath = `school-logos/logo-main.jpg`;

      const { error: uploadError } = await supabaseClient.storage
        .from("avatars")
        .upload(filePath, compressedBlob, {
          contentType: "image/jpeg",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabaseClient.storage
        .from("avatars")
        .getPublicUrl(filePath);

      // Bust cache via timestamp parameter so updated image renders immediately
      formData.logo_url = `${publicUrlData.publicUrl}?t=${Date.now()}`;
    }

    // --- INSERT OR UPDATE ---
    let error;
    if (existingRecordId) {
      // Update existing record
      ({ error } = await supabaseClient
        .from("school_profile")
        .update({ ...formData, updated_at: new Date().toISOString() })
        .eq("id", existingRecordId));
    } else {
      // Insert new record
      const { data, error: insertErr } = await supabaseClient
        .from("school_profile")
        .insert([formData])
        .select()
        .single();

      error = insertErr;
      if (data) existingRecordId = data.id;
    }

    if (error) throw error;

    // Update local baseline so subsequent submits don't trigger "No changes detected" prematurely
    originalSchoolData = { ...originalSchoolData, ...formData };

    showToast("School information saved successfully!", "success");
  } catch (err) {
    console.error("Error saving profile:", err.message);
    showToast("Failed to save settings: " + err.message, "error");
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save Changes";
    }
  }
}

// Helper utilities
function getValue(id) {
  const el = document.getElementById(id);
  return el ? el.value : "";
}

function setValue(id, val) {
  const el = document.getElementById(id);
  if (el && val !== null && val !== undefined) {
    el.value = val;
  }
}

/**
 * Restores the form fields and logo preview back to the saved database state.
 */
function resetToOriginalData() {
  if (!originalSchoolData || Object.keys(originalSchoolData).length === 0) {
    return;
  }

  // Restore Text / Select Inputs
  setValue("schoolName", originalSchoolData.school_name);
  setValue("schoolMotto", originalSchoolData.school_motto);
  setValue("schoolEmail", originalSchoolData.email);
  setValue("alternativePhone", originalSchoolData.alternative_phone);
  setValue("schoolWebsite", originalSchoolData.website);
  setValue("schoolAddress", originalSchoolData.address);
  setValue("schoolCity", originalSchoolData.city);
  setValue("schoolCountry", originalSchoolData.country);

  setValue("principalName", originalSchoolData.principal_name);
  setValue("principalEmail", originalSchoolData.principal_email);
  setValue("principalPhone", originalSchoolData.principal_phone);

  setValue("schoolType", originalSchoolData.school_type);
  setValue("educationLevel", originalSchoolData.education_level);

  // Clear File Input selection
  const logoInput = document.getElementById("schoolLogo");
  if (logoInput) {
    logoInput.value = "";
  }

  // Restore original logo preview image
  const logoImg = document.getElementById("schoolLogoPreview");
  if (logoImg && originalSchoolData.logo_url) {
    logoImg.src = originalSchoolData.logo_url;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("schoolInformationForm");

  // 1. Check Session & Admin Role
  const { isAdmin, user } = await checkAdminAuth();

  // Disable write inputs for non-admin viewers
  if (!isAdmin) {
    disableFormInputs(form);
  }

  // 2. Load existing school profile data
  await loadSchoolProfile();

  // 3. Handle Form Submission
  if (form && isAdmin) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      await handleFormSubmit();
    });

    // --- ADD RESET EVENT LISTENER HERE ---
    form.addEventListener("reset", (e) => {
      e.preventDefault(); // Stop default browser clear behavior
      resetToOriginalData();
    });
  }

  const logoInput = document.getElementById("schoolLogo");
const logoPreview = document.getElementById("schoolLogoPreview");

if (logoInput && logoPreview) {
  logoInput.addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      
      // When the reader finishes reading the file, update the image src
      reader.onload = (e) => {
        logoPreview.src = e.target.result;
      };
      
      // Read the image file as a Data URL
      reader.readAsDataURL(file);
    }
  });
}
});
