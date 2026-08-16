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
        },
    });

    if (error) {

    throw error;

}

alert(data.message);

form.reset();

systemUserModal.style.display = "none";

unlockBodyScroll();

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