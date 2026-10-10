function togglePassword(id) {
  const input = document.getElementById(id);
  input.type = input.type === "password" ? "text" : "password";
}

const form = document.getElementById("loginForm");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const loginButton = form.querySelector(".login-btn");

  loginButton.disabled = true;
  loginButton.textContent = "Signing In...";

  try {
    const email = document.getElementById("email").value.trim().toLowerCase();
    const password = document.getElementById("password").value;

    const { data, error } = await window.supabaseClient.auth.signInWithPassword(
      {
        email,
        password,
      },
    );

    if (error) {
      throw error;
    }

    const {
      data: { session },
    } = await window.supabaseClient.auth.getSession();

    if (!session) {
      throw new Error("No session found.");
    }

    const { data: profile, error: profileError } = await window.supabaseClient
      .from("profiles")
      .select("*")
      .eq("id", data.user.id)
      .maybeSingle();

    if (profileError) {
      console.error(profileError);
      throw new Error(profileError.message || "Failed to fetch user profile.");
    }

    // If profile is null, RLS blocked it due to subscription/tier restrictions
    if (!profile) {
      await window.supabaseClient.auth.signOut();
      throw new Error(
        "Access denied: Your school's subscription plan does not support this role.",
      );
    }

    if (profile.status !== "active") {
      await window.supabaseClient.auth.signOut();
      throw new Error(
        "Your account has been deactivated. Contact the system administrator.",
      );
    }

    showToast("Login successful!", "success");

    const destination =
      profile.role === "parent"
        ? "/html/parent-dashboard.html"
        : "/html/dashboard.html";

    setTimeout(() => {
      window.location.replace(destination);
    }, 800);
  } catch (err) {
    showToast(err.message, "error");
    console.error(err);
  } finally {
    loginButton.disabled = false;
    loginButton.textContent = "Login";
  }
});
