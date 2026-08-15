const studentModal = document.getElementById("studentModal");

const cancelStudentModal = document.getElementById("cancelStudentModal");

const openStudentModal = document.getElementById("addStudent");

const closeStudentModal = document.getElementById("closeStudentModal");



const viewStudentModal = document.getElementById("viewStudentModal");

const archiveStudentModal = document.getElementById("archiveStudentModal");

const viewButtons = document.querySelectorAll(".view");

const archiveButtons = document.querySelectorAll(".archive");

const closeViewStudentModal = document.getElementById("closeViewStudentModal");

const closeViewBtn = document.getElementById("closeViewBtn");

const cancelArchive = document.getElementById("cancelArchive");




const closeEditStudentModal = document.getElementById("closeEditStudentModal");
const cancelEditStudentModal = document.getElementById("cancelEditStudentModal");
const editStudentModal = document.getElementById("editStudentModal");
const editButtons = document.querySelectorAll(".edit");

editButtons.forEach(button=>{

button.addEventListener("click", ()=> {
editStudentModal.style.display="flex";

lockBodyScroll();
});

})

closeEditStudentModal.addEventListener("click", ()=> {
editStudentModal.style.display="none";

unLockBodyScroll();
});

cancelEditStudentModal.addEventListener("click", ()=> {
editStudentModal.style.display="none";

unLockBodyScroll();
});

window.addEventListener("click",(e)=> {
if(e.target===editStudentModal){
editStudentModal.style.display="none";

unLockBodyScroll();
}
});


viewButtons.forEach(button=>{

button.addEventListener("click", ()=> {
viewStudentModal.style.display="flex";

lockBodyScroll();
});

})

closeViewStudentModal.addEventListener("click", ()=> {
viewStudentModal.style.display="none";

unLockBodyScroll();
});

closeViewBtn.addEventListener("click", ()=> {
viewStudentModal.style.display="none";

unLockBodyScroll();
});

archiveButtons.forEach(button=>{

button.addEventListener("click", ()=> {
archiveStudentModal.style.display="flex";

lockBodyScroll();
});

})

cancelArchive.addEventListener("click", ()=> {
archiveStudentModal.style.display="none";

unLockBodyScroll();
});

openStudentModal.addEventListener("click", ()=> {
studentModal.style.display="flex";

lockBodyScroll();
});

closeStudentModal.addEventListener("click", ()=> {
studentModal.style.display="none";

unLockBodyScroll();
});

cancelStudentModal.addEventListener("click", ()=> {
studentModal.style.display="none";

unLockBodyScroll();
});

window.addEventListener("click",(e)=> {
if(e.target===studentModal){
studentModal.style.display="none";

unLockBodyScroll();
}
});

window.addEventListener("click",(e)=> {
if(e.target===viewStudentModal){
viewStudentModal.style.display="none";

unLockBodyScroll();
}

if(e.target===archiveStudentModal){
archiveStudentModal.style.display="none";

unLockBodyScroll();
}
});