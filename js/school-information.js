let originalSchoolData = {};
let schoolInformationUser = null;

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
  if (!window.supabaseClient) {
    throw new Error("The database client is unavailable.");
  }

  const { data, error: userError } = await window.supabaseClient.auth.getUser();
  if (userError) throw userError;
  const user = data?.user;

  if (!user) {
    const error = new Error("Your session has expired. Sign in again.");
    error.status = 401;
    throw error;
  }

  const { data: profile, error: profileError } = await window.supabaseClient
    .from("profiles")
    .select("role, school_id, status")
    .eq("id", user.id)
    .single();
  if (profileError) throw profileError;

  const role = String(profile?.role || "").trim().toLowerCase();
  let isGraduatedStudent = false;
  if (role === "student") {
    let enrollmentQuery = window.supabaseClient
      .from("student_enrollments")
      .select("enrollment_status")
      .eq("student_id", user.id);

    if (profile.school_id) {
      enrollmentQuery = enrollmentQuery.eq("school_id", profile.school_id);
    }

    const { data: enrollments, error: enrollmentError } = await enrollmentQuery;
    if (enrollmentError) throw enrollmentError;
    isGraduatedStudent = (enrollments || []).some((enrollment) =>
      ["graduated", "transferred", "transfered"].includes(
        String(enrollment.enrollment_status || "").trim().toLowerCase(),
      ),
    );
  }

  return {
    isAdmin: role === "admin" && String(profile?.status || "active").toLowerCase() === "active",
    isGraduatedStudent,
    profile,
    user,
  };
}

function showSchoolInformationMessage(message, type = "info") {
  const notice = document.getElementById("schoolInformationNotice");
  if (notice) {
    notice.textContent = message;
    notice.dataset.type = type;
    notice.hidden = false;
  }
  if (type === "error" && typeof showToast === "function") showToast(message, "error");
}

function schoolInformationErrorMessage(error, action = "load") {
  const code = String(error?.code || "").toLowerCase();
  const status = Number(error?.status || error?.statusCode || 0);
  const diagnostic = `${error?.message || ""} ${error?.details || ""}`.toLowerCase();

  if (status === 401 || /invalid jwt|session.*expired|refresh token/.test(diagnostic)) {
    return "Your session has expired. Sign in again, then reopen School Information.";
  }
  if (/school.{0,30}inactive|inactive.{0,30}school/.test(diagnostic)) {
    return "This school is inactive. You can view its information, but changes are unavailable until the school is active.";
  }
  if (code === "42501" || status === 403 || /row-level security|permission denied|not authorized|access denied/.test(diagnostic)) {
    return action === "save"
      ? "School information could not be saved because your account or school does not have permission to make changes."
      : "You do not have permission to load some school information. Contact your school administrator for help.";
  }
  if (/failed to fetch|network|connection|timeout/.test(diagnostic)) {
    return `Could not connect to ${action === "save" ? "save" : "load"} school information. Check your internet connection and try again.`;
  }
  if (code === "pgrst116") return "The requested school information could not be found.";
  return action === "save"
    ? "School information could not be saved. Please try again."
    : "School information could not be loaded. Refresh the page or contact your school administrator.";
}

function enableFormInputs(form) {
  if (!form) return;

  const inputs = form.querySelectorAll("input, select, textarea, button");
  inputs.forEach((input) => {
    input.disabled = false;
  });

  const buttonsToShow = form.querySelectorAll(
    '.save-btn, .reset-btn, button[type="submit"], button[type="reset"]',
  );
  buttonsToShow.forEach((btn) => {
    btn.style.display = "";
  });

  const logoWrapper = document.getElementById("changeSchoolLogo");
  if (logoWrapper) {
    logoWrapper.style.display = "";
  }

  const changeLogoBtn = document.querySelector(
    '.upload-btn, label[for="schoolLogo"]',
  );
  if (changeLogoBtn) {
    changeLogoBtn.style.display = "";
  }
}

function disableFormInputs(form) {
  if (!form) return;

  const inputs = form.querySelectorAll("input, select, textarea, button");
  inputs.forEach((input) => {
    input.disabled = true;
  });

  const buttonsToHide = form.querySelectorAll(
    '.save-btn, .reset-btn, button[type="submit"], button[type="reset"]',
  );
  buttonsToHide.forEach((btn) => {
    btn.style.display = "none";
  });

  const logoWrapper = document.getElementById("changeSchoolLogo");
  if (logoWrapper) {
    logoWrapper.style.display = "none";
  }

  const changeLogoBtn = document.querySelector(
    '.upload-btn, label[for="schoolLogo"]',
  );
  if (changeLogoBtn) {
    changeLogoBtn.style.display = "none";
  }
}

async function initFormProtection() {
  const form =
    document.getElementById("schoolProfileForm") ||
    document.querySelector("form");
  const loader = document.getElementById("formLoader");

  if (!form) return;

  const { isAdmin } = await checkAdminAuth();

  if (isAdmin) {
    enableFormInputs(form);
  } else {
    disableFormInputs(form);
  }

  if (loader) {
    loader.style.display = "none";
  }

  form.classList.add("auth-ready");
}

async function loadSchoolProfile() {
  try {
    const user = schoolInformationUser;
    if (!user) return;

    const { data: userProfile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("school_id")
      .eq("id", user.id)
      .single();
    if (profileError) throw profileError;

    if (!userProfile?.school_id) {
      showSchoolInformationMessage("Your account is not linked to a school.", "error");
      return;
    }

    const { data, error } = await supabaseClient
      .from("schools")
      .select("*")
      .eq("id", userProfile.school_id)
      .maybeSingle();

    if (error) throw error;

    if (data) {
      existingRecordId = data.id;

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
    console.error("Error loading school profile:", err);
    showSchoolInformationMessage(schoolInformationErrorMessage(err), "error");
  }
}

async function handleFormSubmit() {
  const formData = {
    school_name: getValue("schoolName").trim(),
    school_motto: getValue("schoolMotto").trim(),
    email: getValue("schoolEmail").trim(),
    alternative_phone: getValue("alternativePhone").trim(),
    website: getValue("schoolWebsite").trim(),
    address: getValue("schoolAddress").trim(),
    city: getValue("city")
      ? getValue("city").trim()
      : getValue("schoolCity").trim(),
    country: getValue("country")
      ? getValue("country").trim()
      : getValue("schoolCountry").trim(),
    principal_name: getValue("principalName").trim(),
    principal_email: getValue("principalEmail").trim(),
    principal_phone: getValue("principalPhone").trim(),
    school_type: getValue("schoolType"),
    education_level: getValue("educationLevel"),
  };

  const logoInput = document.getElementById("schoolLogo");
  const logoFile = logoInput?.files[0];

  let hasChanges = Boolean(logoFile);
  const changedFields = [];
  if (logoFile) changedFields.push("School Logo");

  for (const key in formData) {
    const currentValue = formData[key] ?? "";
    const originalValue = originalSchoolData[key] ?? "";

    if (currentValue.toString().trim() !== originalValue.toString().trim()) {
      hasChanges = true;

      changedFields.push(key.replace(/_/g, " "));
    }
  }

  if (!hasChanges) {
    showToast("No changes detected.", "info");
    return;
  }

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

  if (formData.country.toLowerCase() !== "liberia") {
    showToast("Country must be Liberia.", "error");
    return;
  }

  if (formData.website && !formData.website.startsWith("https://")) {
    showToast("School website URL must start with https://", "error");
    return;
  }

  const saveBtn = document.querySelector(
    '#schoolInformationForm .save-btn, #schoolInformationForm button[type="submit"]',
  );
  let uploadedLogoPath = null;

  try {
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = "Saving...";
    }

    if (logoFile && existingRecordId) {
      const compressedBlob = await compressImageToBlob(logoFile, 800, 0.7);

      // Keep each uploaded logo at its own path so audit history can still
      // display the previous image after a later logo change.
      const versionId =
        globalThis.crypto?.randomUUID?.() ||
        `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const filePath = `school-logos/${existingRecordId}/${versionId}.jpg`;

      const { error: uploadError } = await supabaseClient.storage
        .from("avatars")
        .upload(filePath, compressedBlob, {
          contentType: "image/jpeg",
          upsert: false,
        });

      if (uploadError) throw uploadError;
      uploadedLogoPath = filePath;

      const { data: publicUrlData } = supabaseClient.storage
        .from("avatars")
        .getPublicUrl(filePath);

      formData.logo_url = `${publicUrlData.publicUrl}?t=${Date.now()}`;
    }

    let savedRecord;
    let error;
    const isNewRecord = !existingRecordId;

    if (existingRecordId) {
      const { data, error: updateErr } = await supabaseClient
        .from("schools")
        .update({ ...formData, updated_at: new Date().toISOString() })
        .eq("id", existingRecordId)
        .select()
        .maybeSingle();

      error = updateErr;
      savedRecord = data;
    } else {
      const { data, error: insertErr } = await supabaseClient
        .from("schools")
        .insert([formData])
        .select()
        .single();

      error = insertErr;
      savedRecord = data;
    }

    if (error) throw error;

    if (existingRecordId && !savedRecord) {
      if (uploadedLogoPath) {
        const { error: cleanupError } = await supabaseClient.storage
          .from("avatars")
          .remove([uploadedLogoPath]);
        if (cleanupError) {
          console.error("Could not remove the unused school logo upload:", cleanupError);
        }
        uploadedLogoPath = null;
      }
      showToast(
        "School information was not saved. This school may be inactive or your account may not have permission to update it.",
        "error",
      );
      return;
    }

    if (savedRecord) {
      existingRecordId = savedRecord.id;

      originalSchoolData = { ...savedRecord };
      uploadedLogoPath = null;
    }

    if (logoInput) {
      logoInput.value = "";
    }

    showToast("School information saved successfully!", "success");

    if (typeof logActivity === "function" && savedRecord) {
      const schoolId = savedRecord.id;
      let activityMessage = "School information updated";

      if (isNewRecord) {
        activityMessage = `School profile initialized: ${savedRecord.school_name || "New School"}`;
      } else if (changedFields.length > 0) {
        const formattedFields = changedFields
          .map((f) => f.charAt(0).toUpperCase() + f.slice(1))
          .join(", ");
        activityMessage = `School details updated: ${formattedFields}`;
      }

      await logActivity(schoolId, activityMessage, "purple", "Everyone");
    }
  } catch (err) {
    console.error("Error saving profile:", err);

    if (uploadedLogoPath) {
      const { error: cleanupError } = await supabaseClient.storage
        .from("avatars")
        .remove([uploadedLogoPath]);
      if (cleanupError) {
        console.error("Could not remove the unused school logo upload:", cleanupError);
      }
    }

    showSchoolInformationMessage(schoolInformationErrorMessage(err, "save"), "error");
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save Changes";
    }
  }
}

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

function resetToOriginalData() {
  if (!originalSchoolData || Object.keys(originalSchoolData).length === 0) {
    return;
  }

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

  const logoInput = document.getElementById("schoolLogo");
  if (logoInput) {
    logoInput.value = "";
  }

  const logoImg = document.getElementById("schoolLogoPreview");
  if (logoImg && originalSchoolData.logo_url) {
    logoImg.src = originalSchoolData.logo_url;
  }
}
document.addEventListener("DOMContentLoaded", async () => {
  const form =
    document.getElementById("schoolInformationForm") ||
    document.getElementById("schoolProfileForm") ||
    document.querySelector("form");
  const loader = document.getElementById("formLoader");

  let access = { isAdmin: false, isGraduatedStudent: false, user: null };
  try {
    access = await checkAdminAuth();
    schoolInformationUser = access.user;
  } catch (error) {
    console.error("Could not determine School Information access:", error);
    showSchoolInformationMessage(schoolInformationErrorMessage(error), "error");
  }

  if (access.isAdmin) enableFormInputs(form);
  else disableFormInputs(form);

  if (access.isGraduatedStudent) {
    const page = document.getElementById("schoolInformationPage");
    page?.classList.add("graduated-school-access");
    if (form) {
      form.style.display = "none";
      form.classList.add("auth-ready");
    }
    if (loader) loader.style.display = "none";
    showSchoolInformationMessage(
      "School Information is unavailable because your enrollment is marked as graduated or transferred. Contact your school administrator if you think this is a mistake.",
    );
    return;
  }

  await loadSchoolProfile();

  if (loader) loader.style.display = "none";
  if (form) form.classList.add("auth-ready");

  if (form && access.isAdmin) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      await handleFormSubmit();
    });

    form.addEventListener("reset", (e) => {
      e.preventDefault();
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
        reader.onload = (e) => {
          logoPreview.src = e.target.result;
        };
        reader.readAsDataURL(file);
      } else {
        logoPreview.src = originalSchoolData.logo_url || "";
      }
    });
  }
});
