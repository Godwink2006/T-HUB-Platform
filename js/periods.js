const periodModal = document.getElementById("periodModal");

const cancelPeriodModal = document.getElementById("cancelPeriodModal");

const openPeriodModal = document.getElementById("addPeriod");

const closePeriodModal = document.getElementById("closePeriodModal");

openPeriodModal.addEventListener("click", ()=> {
periodModal.style.display="flex";

lockBodyScroll();
});

closePeriodModal.addEventListener("click", ()=> {
periodModal.style.display="none";

unLockBodyScroll();
});

cancelPeriodModal.addEventListener("click", ()=> {
periodModal.style.display="none";

unLockBodyScroll();
});

window.addEventListener("click",(e)=> {
if(e.target===periodModal){
periodModal.style.display="none";

unLockBodyScroll();
}
});


const closeEditPeriodModal = document.getElementById("closeEditPeriodModal");
const cancelEditPeriodModal = document.getElementById("cancelEditPeriodModal");
const editPeriodModal = document.getElementById("editPeriodModal");
const editPeriodButtons = document.querySelectorAll(".edit-Period");

editPeriodButtons.forEach(button=>{

button.addEventListener("click", ()=> {
editPeriodModal.style.display="flex";

lockBodyScroll();
});

})

closeEditPeriodModal.addEventListener("click", ()=> {
editPeriodModal.style.display="none";

unLockBodyScroll();
});

cancelEditPeriodModal.addEventListener("click", ()=> {
editPeriodModal.style.display="none";

unLockBodyScroll();
});

window.addEventListener("click",(e)=> {
if(e.target===editPeriodModal){
editPeriodModal.style.display="none";

unLockBodyScroll();
}
});

const archivePeriodModal = document.getElementById("archivePeriodModal");

const archiveButtons = document.querySelectorAll(".archive-Period");

const cancelArchive = document.getElementById("cancelArchive");

archiveButtons.forEach(button=>{

button.addEventListener("click", ()=> {
archivePeriodModal.style.display="flex";

lockBodyScroll();
});

})

cancelArchive.addEventListener("click", ()=> {
archivePeriodModal.style.display="none";

unLockBodyScroll();
});

window.addEventListener("click",(e)=> {

if(e.target===archivePeriodModal){
archivePeriodModal.style.display="none";

unLockBodyScroll();
}
});