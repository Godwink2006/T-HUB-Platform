const assignModal = document.getElementById("assignModal");

const cancelAssignModal = document.getElementById("cancelAssignModal");

const openAssignModal = document.getElementById("addAssign");

const closeAssignModal = document.getElementById("closeAssignModal");

openAssignModal.addEventListener("click", ()=> {
assignModal.style.display="flex";

lockBodyScroll();
});

closeAssignModal.addEventListener("click", ()=> {
assignModal.style.display="none";

unLockBodyScroll();
});

cancelAssignModal.addEventListener("click", ()=> {
assignModal.style.display="none";

unLockBodyScroll();
});

window.addEventListener("click",(e)=> {
if(e.target===assignModal){
assignModal.style.display="none";

unLockBodyScroll();
}
});


const closeEditAssignModal = document.getElementById("closeEditAssignModal");
const cancelEditAssignModal = document.getElementById("cancelEditAssignModal");
const editAssignModal = document.getElementById("editAssignModal");
const editButtons = document.querySelectorAll(".edit");

editButtons.forEach(button=>{

button.addEventListener("click", ()=> {
editAssignModal.style.display="flex";

lockBodyScroll();
});

})

closeEditAssignModal.addEventListener("click", ()=> {
editAssignModal.style.display="none";

unLockBodyScroll();
});

cancelEditAssignModal.addEventListener("click", ()=> {
editAssignModal.style.display="none";

unLockBodyScroll();
});

window.addEventListener("click",(e)=> {
if(e.target===editAssignModal){
editAssignModal.style.display="none";

unLockBodyScroll();
}
});

const viewAssignModal = document.getElementById("viewAssignModal");

const archiveAssignModal = document.getElementById("archiveAssignModal");

const viewButtons = document.querySelectorAll(".view");

const archiveButtons = document.querySelectorAll(".archive");

const closeViewAssignModal = document.getElementById("closeViewAssignModal");

const closeViewBtn = document.getElementById("closeViewBtn");

const cancelArchive = document.getElementById("cancelArchive");

viewButtons.forEach(button=>{

button.addEventListener("click", ()=> {
viewAssignModal.style.display="flex";

lockBodyScroll();
});

})

closeViewAssignModal.addEventListener("click", ()=> {
viewAssignModal.style.display="none";

unLockBodyScroll();
});

closeViewBtn.addEventListener("click", ()=> {
viewAssignModal.style.display="none";

unLockBodyScroll();
});

archiveButtons.forEach(button=>{

button.addEventListener("click", ()=> {
archiveAssignModal.style.display="flex";

lockBodyScroll();
});

})

cancelArchive.addEventListener("click", ()=> {
archiveAssignModal.style.display="none";

unLockBodyScroll();
});

window.addEventListener("click",(e)=> {
if(e.target===viewAssignModal){
viewAssignModal.style.display="none";

unLockBodyScroll();
}

if(e.target===archiveAssignModal){
archiveAssignModal.style.display="none";

unLockBodyScroll();
}
});