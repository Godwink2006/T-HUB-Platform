

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

        const { data, error } = await window.supabaseClient.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            throw error;
        }

        const {
  data: { session },
} = await window.supabaseClient.auth.getSession();

console.log("SESSION:", session);

if (!session) {
  alert("No session found.");
}

        const { data: profile, error: profileError } = await window.supabaseClient
            .from("profiles")
            .select("*")
            .eq("id", data.user.id)
            .single();

       if (profileError) {
    console.error(profileError);

    throw new Error(profileError.message);
}

        if (profile.status !== "active") {
            await window.supabaseClient.auth.signOut();

            throw new Error(
                "Your account has been deactivated. Contact the system administrator."
            );
        }

        window.location.href = "/html/dashboard.html";

    } catch (err) {
        alert(err.message);
        console.error(err);
    } finally {
        loginButton.disabled = false;
        loginButton.textContent = "Login";
    }
});