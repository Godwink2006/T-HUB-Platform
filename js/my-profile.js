function togglePassword(id) {
    const input = document.getElementById(id);
    input.type = input.type === "password" ? "text" : "password";
}

async function loadMyProfile() {
  // 1. Get current logged-in user session
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return;

  // 2. Fetch profile row for this specific user
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error) {
    console.error('Error fetching profile:', error.message);
    return;
  }

  // 3. Fill the form fields with current data
  document.getElementById('fullName').value = profile.full_name || '';
  document.getElementById('emailAddress').value = profile.email || user.email;
  document.getElementById('phoneNumber').value = profile.phone_number || '';
  
  if (profile.photo_url) {
    document.getElementById('myProfilePhoto').src = profile.photo_url;
  }
}