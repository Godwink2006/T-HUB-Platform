const form = document.getElementById("systemUserForm");

form.addEventListener("submit", async (e) => {

    e.preventDefault();

     const saveButton = form.querySelector(".save-btn");

saveButton.disabled = true;
saveButton.textContent = "Creating...";

    try {
    const full_name = document.getElementById("fullName").value.trim();
    const email = document.getElementById("email").value.trim();
    const phone_number = document.getElementById("phoneNumber").value.trim();
    const password = document.getElementById("newPassword").value;
    const confirmPassword = document.getElementById("confirmPassword").value;
    const role = document.getElementById("role").value.toLowerCase();
    const status = document.getElementById("status").value.toLowerCase();

    // GET THE PHOTO FILE INPUT HERE
    const photoInput = document.getElementById("photo");
    let photoBase64 = null;

    if (photoInput && photoInput.files[0]) {
      photoBase64 = await fileToBase64(photoInput.files[0]);
    }

    if (password !== confirmPassword) {
        alert("Passwords do not match.");
        return;
    }

  const { data, error } = await window.supabaseClient.functions.invoke("create-user", {
        body: {
            full_name,
            email,
            phone_number,
            password,
            role,
            status,
            photo: photoBase64,
        },
    });

    if (error) {

    throw error;

}

 await loadSystemUsers();
alert(data.message);

form.reset();

 } catch (err) {
    console.error("FULL ERROR:", err);

    let message = err.message;

    if (err.context) {
        try {
            const errorBody = await err.context.json();

            console.error("EDGE FUNCTION RESPONSE:", errorBody);

            if (errorBody?.message) {
                message = errorBody.message;
            }
        } catch (parseError) {
            console.error("Could not read Edge Function response:", parseError);
        }
    }

    alert(message);

} finally {
    saveButton.disabled = false;
    saveButton.textContent = "Save";
}

  loadSystemUsers();
});

const systemUserModal = document.getElementById("systemUserModal");

const cancelSystemUserModal = document.getElementById("cancelSystemUserModal");

const openSystemUserModal = document.getElementById("addSystemUser");

const closeSystemUserModal = document.getElementById("closeSystemUserModal");

openSystemUserModal.addEventListener("click", ()=> {
systemUserModal.style.display="flex";

lockBodyScroll();
});

closeSystemUserModal.addEventListener("click", ()=> {
systemUserModal.style.display="none";

unLockBodyScroll();
});

cancelSystemUserModal.addEventListener("click", ()=> {
systemUserModal.style.display="none";

unLockBodyScroll();
});

window.addEventListener("click",(e)=> {
if(e.target===systemUserModal){
systemUserModal.style.display="none";

unLockBodyScroll();
}
});


const closeEditSystemUserModal = document.getElementById("closeEditSystemUserModal");
const cancelEditSystemUserModal = document.getElementById("cancelEditSystemUserModal");
const editSystemUserModal = document.getElementById("editSystemUserModal");
const editSystemUserButtons = document.querySelectorAll(".edit-SystemUser");

editSystemUserButtons.forEach(button=>{

button.addEventListener("click", ()=> {
editSystemUserModal.style.display="flex";

lockBodyScroll();
});

})

closeEditSystemUserModal.addEventListener("click", ()=> {
editSystemUserModal.style.display="none";

unLockBodyScroll();
});

cancelEditSystemUserModal.addEventListener("click", ()=> {
editSystemUserModal.style.display="none";

unLockBodyScroll();
});

window.addEventListener("click",(e)=> {
if(e.target===editSystemUserModal){
editSystemUserModal.style.display="none";

unLockBodyScroll();
}
});

const archiveSystemUserModal = document.getElementById("archiveSystemUserModal");

const archiveButtons = document.querySelectorAll(".archive-SystemUser");

const cancelArchive = document.getElementById("cancelArchive");

archiveButtons.forEach(button=>{

button.addEventListener("click", ()=> {
archiveSystemUserModal.style.display="flex";

lockBodyScroll();
});

})

cancelArchive.addEventListener("click", ()=> {
archiveSystemUserModal.style.display="none";

unLockBodyScroll();
});

window.addEventListener("click",(e)=> {

if(e.target===archiveSystemUserModal){
archiveSystemUserModal.style.display="none";

unLockBodyScroll();
}
});

function togglePassword(id) {
    const input = document.getElementById(id);
    input.type = input.type === "password" ? "text" : "password";
}

document.querySelector('.edit-SystemUser')?.addEventListener('click', () => {
  document.getElementById('editModal').style.display = 'block'; // or 'flex'
});

document.querySelector('.archive-SystemUser')?.addEventListener('click', () => {
  document.getElementById('archiveModal').style.display = 'block';
});


// system-users.js
async function loadSystemUsers() {
  // Select tbody inside table#usersTable
  const tableBody = document.querySelector("#usersTable tbody");
  if (!tableBody) return;

  // 1. Show loading state across all 7 columns
  tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center;">Loading users...</td></tr>`;

  // 2. Fetch profiles from Supabase
  const { data: users, error } = await supabaseClient
    .from("profiles")
    .select("id, full_name, email, phone_number, role, status, photo_url")
    .order("created_at", { ascending: false });

  if (error) {
    tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center;">Failed to load users.</td></tr>`;
    return;
  }

  if (!users || users.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center;">No users found.</td></tr>`;
    return;
  }

  // 3. Populate all 7 columns matching system-users.html
  tableBody.innerHTML = users
    .map(
      (user) => `
    <tr>
           <td>
          <img src="${user.photo_url ? user.photo_url : DEFAULT_AVATAR}" class="systemUser-photo" alt="Profile" onerror="this.onerror=null; this.src=DEFAULT_AVATAR;" />
        </td>
      <td>${user.full_name || "N/A"}</td>
      <td>${user.email || "N/A"}</td>
      <td>${user.phone_number || "N/A"}</td>
      <td>${user.role || "N/A"}</td>
      <td>
        <span class="systemUsers-status-${(user.status || 'inactive').toLowerCase()}">
          ${user.status || "Inactive"}
        </span>
      </td>
      <td>
        <button class="systemUsers-actions-btn edit-SystemUser" onclick="editUser('${user.id}')">
          <i class="fa-solid fa-pen"></i>
        </button>
        <button class="systemUsers-actions-btn archive-SystemUser" onclick="deleteUser('${user.id}')">
          <i class="fa-solid fa-box-archive"></i>
        </button>
      </td>
    </tr>
  `
    )
    .join("");
}

const DEFAULT_AVATAR = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128' width='128' height='128'><circle cx='64' cy='64' r='64' fill='%23E4E6EB'/><circle cx='64' cy='46' r='22' fill='%23B0B3B8'/><path d='M24 112c0-22 18-40 40-40s40 18 40 40' fill='%23B0B3B8'/></svg>";

// Helper to convert File to Base64
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });
}



// Example: Add 'async' to your submit event handler function
form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const photoInput = document.querySelector("#photo");
  let photoBase64 = null;

  if (photoInput && photoInput.files[0]) {
    // 'await' works here because the outer function is 'async'
    photoBase64 = await fileToBase64(photoInput.files[0]);
  }

  const payload = {
    full_name: "John Doe",
    email: "john@school.com",
    phone_number: "+1234567890",
    password: "Password123!@",
    role: "receptionist",
    status: "active",
    photo: photoBase64
  };

  // Now send payload to your Edge Function using fetch...
});

// Call on initial load
document.addEventListener("DOMContentLoaded", loadSystemUsers);