document.addEventListener("DOMContentLoaded", initializeParentPasswordSetup);

async function initializeParentPasswordSetup() {
  const client = window.supabaseClient;
  const form = document.getElementById("parentPasswordForm");
  if (!client || !form) return;

  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) {
    setParentPasswordMessage("This invitation link is invalid or expired. Ask the school to send a new invitation.", true);
    form.hidden = true;
    return;
  }

  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("role, status")
    .eq("id", user.id)
    .single();
  if (profileError || profile?.role !== "parent" || String(profile.status).toLowerCase() !== "active") {
    setParentPasswordMessage("This invitation is not linked to an active parent account. Contact the school.", true);
    form.hidden = true;
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const password = document.getElementById("parentNewPassword").value;
    const confirmation = document.getElementById("parentConfirmPassword").value;
    if (password !== confirmation) {
      setParentPasswordMessage("The passwords do not match.", true);
      return;
    }

    const button = document.getElementById("saveParentPassword");
    button.disabled = true;
    setParentPasswordMessage("Saving your password…");
    try {
      const { error: updateError } = await client.auth.updateUser({ password });
      if (updateError) throw updateError;
      setParentPasswordMessage("Password saved. Opening your dashboard…", false, true);
      window.location.replace("/html/parent-dashboard.html");
    } catch (updateError) {
      setParentPasswordMessage(updateError.message || "Could not save your password. Try again.", true);
      button.disabled = false;
    }
  });
}

function setParentPasswordMessage(message, isError = false, isSuccess = false) {
  const element = document.getElementById("parentPasswordMessage");
  if (!element) return;
  element.textContent = message;
  element.classList.toggle("is-error", isError);
  element.classList.toggle("is-success", isSuccess);
}
