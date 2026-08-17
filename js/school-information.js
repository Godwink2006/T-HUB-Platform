

let existingRecordId = null;

document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('schoolInformationForm');

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
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleFormSubmit(user.id);
    });
  }
});

/**
 * Checks if the user is logged in and possesses the 'admin' role.
 */
async function checkAdminAuth() {
  const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();

  if (sessionError || !session) {
    return { isAdmin: false, user: null };
  }

  const { data: profile, error: profileError } = await supabaseClient
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single();

  if (profileError || profile?.role !== 'admin') {
    return { isAdmin: false, user: session.user };
  }

  return { isAdmin: true, user: session.user };
}

/**
 * Disables form submission and input fields if user is not an admin.
 */
function disableFormInputs(form) {
  const inputs = form.querySelectorAll('input, select, textarea, button[type="submit"]');
  inputs.forEach((input) => {
    input.disabled = true;
  });

  // Hide the save button completely
const saveBtn = form.querySelector('.save-btn, button[type="submit"]');
if (saveBtn) {
  saveBtn.style.display = 'flex';
}

// Disable and hide the reset button
const resetBtn = form.querySelector('.reset-btn, button[type="reset"]');
if (resetBtn) {
  resetBtn.disabled = true;
  resetBtn.style.display = 'none';
}

}

/**
 * Loads existing school profile from Supabase and fills the form.
 */
async function loadSchoolProfile() {
  try {
    const { data, error } = await supabaseClient
      .from('school_profile')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    if (data) {
      existingRecordId = data.id;

      // Populate form fields matching your HTML element IDs
      // Replace line 84:
// setValue('schoolLogo', data.logo_url);

// With this:
const logoImg = document.getElementById('schoolLogoPreview');
if (logoImg && data.logo_url) {
  logoImg.src = data.logo_url;
}

      setValue('schoolName', data.school_name);
      setValue('schoolMotto', data.school_motto);
      setValue('schoolEmail', data.email);
      setValue('alternativePhone', data.alternative_phone);
      setValue('schoolWebsite', data.website);
      setValue('schoolAddress', data.address);
      setValue('schoolCity', data.city);
      setValue('schoolCountry', data.country);

      setValue('principalName', data.principal_name);
      setValue('principalEmail', data.principal_email);
      setValue('principalPhone', data.principal_phone);

      setValue('schoolType', data.school_type);
      setValue('educationLevel', data.education_level);
    }
  } catch (err) {
    console.error('Error loading school profile:', err.message);
  }
}

/**
 * Validates form inputs, uploads logo if present, and upserts data.
 */
async function handleFormSubmit(userId) {
  const formData = {
    school_name: getValue('schoolName').trim(),
    school_motto: getValue('schoolMotto').trim(),
    email: getValue('schoolEmail').trim(),
    alternative_phone: getValue('alternativePhone').trim(),
    website: getValue('schoolWebsite').trim(),
    address: getValue('schoolAddress').trim(),
    city: getValue('schoolCity').trim(),
    country: getValue('schoolCountry').trim(),
    principal_name: getValue('principalName').trim(),
    principal_email: getValue('principalEmail').trim(),
    principal_phone: getValue('principalPhone').trim(),
    school_type: getValue('schoolType'),
    education_level: getValue('educationLevel')
  };

  // --- CLIENT-SIDE VALIDATION ---
  if (!formData.school_name || !formData.email || !formData.address || 
      !formData.city || !formData.country || !formData.principal_name || 
      !formData.principal_email || !formData.principal_phone || 
      !formData.school_type || !formData.education_level) {
    alert('Please fill out all required fields.');
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(formData.email) || !emailRegex.test(formData.principal_email)) {
    alert('Please enter valid email addresses for the school and principal.');
    return;
  }

  try {
    // --- OPTIONAL LOGO UPLOAD ---
    const logoFile = document.getElementById('schoolLogo')?.files[0];
    if (logoFile) {
      const fileExt = logoFile.name.split('.').pop();
      const filePath = `school-logos/logo-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabaseClient
        .storage
        .from('avatars')
        .upload(filePath, logoFile, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabaseClient
        .storage
        .from('avatars')
        .getPublicUrl(filePath);

      formData.logo_url = publicUrlData.publicUrl;
    }

    // --- INSERT OR UPDATE ---
    let error;
    if (existingRecordId) {
      // Update existing record
      ({ error } = await supabaseClient
        .from('school_profile')
        .update({ ...formData, updated_at: new Date().toISOString() })
        .eq('id', existingRecordId));
    } else {
      // Insert new record
      const { data, error: insertErr } = await supabaseClient
        .from('school_profile')
        .insert([formData])
        .select()
        .single();

      error = insertErr;
      if (data) existingRecordId = data.id;
    }

    if (error) throw error;

    alert('School information saved successfully!');
  } catch (err) {
    console.error('Error saving profile:', err.message);
    alert('Failed to save settings: ' + err.message);
  }
}

// Helper utilities
function getValue(id) {
  const el = document.getElementById(id);
  return el ? el.value : '';
}

function setValue(id, val) {
  const el = document.getElementById(id);
  if (el && val !== null && val !== undefined) {
    el.value = val;
  }
}
