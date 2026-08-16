const departmentModal = document.getElementById("departmentModal");

const cancelDepartmentModal = document.getElementById("cancelDepartmentModal");

const openDepartmentModal = document.getElementById("addDepartment");

const closeDepartmentModal = document.getElementById("closeDepartmentModal");

openDepartmentModal.addEventListener("click", ()=> {
departmentModal.style.display="flex";

lockBodyScroll();
});

closeDepartmentModal.addEventListener("click", ()=> {
departmentModal.style.display="none";

unLockBodyScroll();
});

cancelDepartmentModal.addEventListener("click", ()=> {
departmentModal.style.display="none";

unLockBodyScroll();
});

window.addEventListener("click",(e)=> {
if(e.target===departmentModal){
departmentModal.style.display="none";

unLockBodyScroll();
}
});


const closeEditDepartmentModal = document.getElementById("closeEditDepartmentModal");
const cancelEditDepartmentModal = document.getElementById("cancelEditDepartmentModal");
const editDepartmentModal = document.getElementById("editDepartmentModal");
const editDepartmentButtons = document.querySelectorAll(".edit-Department");

editDepartmentButtons.forEach(button=>{

button.addEventListener("click", ()=> {
editDepartmentModal.style.display="flex";

lockBodyScroll();
});

})

closeEditDepartmentModal.addEventListener("click", ()=> {
editDepartmentModal.style.display="none";

unLockBodyScroll();
});

cancelEditDepartmentModal.addEventListener("click", ()=> {
editDepartmentModal.style.display="none";

unLockBodyScroll();
});

window.addEventListener("click",(e)=> {
if(e.target===editDepartmentModal){
editDepartmentModal.style.display="none";

unLockBodyScroll();
}
});

const archiveDepartmentModal = document.getElementById("archiveDepartmentModal");

const archiveButtons = document.querySelectorAll(".archive-Department");

const cancelArchive = document.getElementById("cancelArchive");

archiveButtons.forEach(button=>{

button.addEventListener("click", ()=> {
archiveDepartmentModal.style.display="flex";

lockBodyScroll();
});

})

cancelArchive.addEventListener("click", ()=> {
archiveDepartmentModal.style.display="none";

unLockBodyScroll();
});

window.addEventListener("click",(e)=> {

if(e.target===archiveDepartmentModal){
archiveDepartmentModal.style.display="none";

unLockBodyScroll();
}
});