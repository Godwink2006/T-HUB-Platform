const teacherModal = document.getElementById("teacherModal");

const cancelTeacherModal = document.getElementById("cancelTeacherModal");

const openTeacherModal = document.getElementById("addTeacher");

const closeTeacherModal = document.getElementById("closeTeacherModal");



const viewTeacherModal = document.getElementById("viewTeacherModal");

const archiveTeacherModal = document.getElementById("archiveTeacherModal");

const viewButtons = document.querySelectorAll(".view");

const archiveButtons = document.querySelectorAll(".archive");

const closeViewTeacherModal = document.getElementById("closeViewTeacherModal");

const closeViewBtn = document.getElementById("closeViewBtn");

const cancelArchive = document.getElementById("cancelArchive");




const closeEditTeacherModal = document.getElementById("closeEditTeacherModal");
const cancelEditTeacherModal = document.getElementById("cancelEditTeacherModal");
const editTeacherModal = document.getElementById("editTeacherModal");
const editButtons = document.querySelectorAll(".edit");

editButtons.forEach(button=>{

button.addEventListener("click", ()=> {
editTeacherModal.style.display="flex";

lockBodyScroll();
});

})

closeEditTeacherModal.addEventListener("click", ()=> {
editTeacherModal.style.display="none";

unLockBodyScroll();
});

cancelEditTeacherModal.addEventListener("click", ()=> {
editTeacherModal.style.display="none";

unLockBodyScroll();
});

window.addEventListener("click",(e)=> {
if(e.target===editTeacherModal){
editTeacherModal.style.display="none";

unLockBodyScroll();
}
});


viewButtons.forEach(button=>{

button.addEventListener("click", ()=> {
viewTeacherModal.style.display="flex";

lockBodyScroll();
});

})

closeViewTeacherModal.addEventListener("click", ()=> {
viewTeacherModal.style.display="none";

unLockBodyScroll();
});

closeViewBtn.addEventListener("click", ()=> {
viewTeacherModal.style.display="none";

unLockBodyScroll();
});

archiveButtons.forEach(button=>{

button.addEventListener("click", ()=> {
archiveTeacherModal.style.display="flex";

lockBodyScroll();
});

})

cancelArchive.addEventListener("click", ()=> {
archiveTeacherModal.style.display="none";

unLockBodyScroll();
});

openTeacherModal.addEventListener("click", ()=> {
teacherModal.style.display="flex";

lockBodyScroll();
});

closeTeacherModal.addEventListener("click", ()=> {
teacherModal.style.display="none";

unLockBodyScroll();
});

cancelTeacherModal.addEventListener("click", ()=> {
teacherModal.style.display="none";

unLockBodyScroll();
});

window.addEventListener("click",(e)=> {
if(e.target===teacherModal){
teacherModal.style.display="none";

unLockBodyScroll();
}
});

window.addEventListener("click",(e)=> {
if(e.target===viewTeacherModal){
viewTeacherModal.style.display="none";

unLockBodyScroll();
}

if(e.target===archiveTeacherModal){
archiveTeacherModal.style.display="none";

unLockBodyScroll();
}
});

function togglePassword(id) {
    const input = document.getElementById(id);
    input.type = input.type === "password" ? "text" : "password";
}