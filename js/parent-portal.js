document.addEventListener("DOMContentLoaded", () => {
  const signOutButton = document.getElementById("parentSignOut");
  const dialog = document.getElementById("parentSignOutDialog");
  const cancelButton = document.getElementById("cancelParentSignOut");
  const confirmButton = document.getElementById("confirmParentSignOut");
  const message = document.getElementById("parentSignOutMessage");

  if (!signOutButton || !dialog || !cancelButton || !confirmButton) return;

  signOutButton.addEventListener("click", () => {
    if (message) message.textContent = "";
    dialog.showModal();
    cancelButton.focus();
  });

  cancelButton.addEventListener("click", () => dialog.close());

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });

  dialog.addEventListener("close", () => {
    if (message) message.textContent = "";
  });

  confirmButton.addEventListener("click", async () => {
    const client = window.supabaseClient;
    const originalText = confirmButton.textContent;
    if (!client) {
      if (message) message.textContent = "Sign out is unavailable. Please refresh and try again.";
      return;
    }

    confirmButton.disabled = true;
    cancelButton.disabled = true;
    confirmButton.textContent = "Signing out…";
    if (message) message.textContent = "";

    try {
      const { error } = await client.auth.signOut();
      if (error) throw error;

      window.clearAuthContext?.();
      sessionStorage.removeItem("tHubParentSelectedStudentId");
      window.location.replace("/index.html");
    } catch (error) {
      console.error("Parent sign out failed:", error);
      if (message) {
        message.textContent = error.message || "Could not sign out. Please try again.";
      }
      confirmButton.disabled = false;
      cancelButton.disabled = false;
      confirmButton.textContent = originalText;
    }
  });
});
