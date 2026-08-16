const subjectModal = document.getElementById("subjectModal");

const cancelSubjectModal = document.getElementById("cancelSubjectModal");

const openSubjectModal = document.getElementById("addSubject");

const closeSubjectModal = document.getElementById("closeSubjectModal");

openSubjectModal.addEventListener("click", ()=> {
subjectModal.style.display="flex";

lockBodyScroll();
});

closeSubjectModal.addEventListener("click", ()=> {
subjectModal.style.display="none";

unLockBodyScroll();
});

cancelSubjectModal.addEventListener("click", ()=> {
subjectModal.style.display="none";

unLockBodyScroll();
});

window.addEventListener("click",(e)=> {
if(e.target===subjectModal){
subjectModal.style.display="none";

unLockBodyScroll();
}
});


const closeEditSubjectModal = document.getElementById("closeEditSubjectModal");
const cancelEditSubjectModal = document.getElementById("cancelEditSubjectModal");
const editSubjectModal = document.getElementById("editSubjectModal");
const editButtons = document.querySelectorAll(".edit");

editButtons.forEach(button=>{

button.addEventListener("click", ()=> {
editSubjectModal.style.display="flex";

lockBodyScroll();
});

})

closeEditSubjectModal.addEventListener("click", ()=> {
editSubjectModal.style.display="none";

unLockBodyScroll();
});

cancelEditSubjectModal.addEventListener("click", ()=> {
editSubjectModal.style.display="none";

unLockBodyScroll();
});

window.addEventListener("click",(e)=> {
if(e.target===editSubjectModal){
editSubjectModal.style.display="none";

unLockBodyScroll();
}
});

const viewSubjectModal = document.getElementById("viewSubjectModal");

const archiveSubjectModal = document.getElementById("archiveSubjectModal");

const viewButtons = document.querySelectorAll(".view");

const archiveButtons = document.querySelectorAll(".archive");

const closeViewSubjectModal = document.getElementById("closeViewSubjectModal");

const closeViewBtn = document.getElementById("closeViewBtn");

const cancelArchive = document.getElementById("cancelArchive");

viewButtons.forEach(button=>{

button.addEventListener("click", ()=> {
viewSubjectModal.style.display="flex";

lockBodyScroll();
});

})

closeViewSubjectModal.addEventListener("click", ()=> {
viewSubjectModal.style.display="none";

unLockBodyScroll();
});

closeViewBtn.addEventListener("click", ()=> {
viewSubjectModal.style.display="none";

unLockBodyScroll();
});

archiveButtons.forEach(button=>{

button.addEventListener("click", ()=> {
archiveSubjectModal.style.display="flex";

lockBodyScroll();
});

})

cancelArchive.addEventListener("click", ()=> {
archiveSubjectModal.style.display="none";

unLockBodyScroll();
});

window.addEventListener("click",(e)=> {
if(e.target===viewSubjectModal){
viewSubjectModal.style.display="none";

unLockBodyScroll();
}

if(e.target===archiveSubjectModal){
archiveSubjectModal.style.display="none";

unLockBodyScroll();
}
});