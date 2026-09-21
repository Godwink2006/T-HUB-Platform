const gradeModal = document.getElementById("gradeModal");

const cancelGradeModal = document.getElementById("cancelGradeModal");

const openGradeModal = document.getElementById("addGrade");

const closeGradeModal = document.getElementById("closeGradeModal");

openGradeModal.addEventListener("click", ()=> {
gradeModal.style.display="flex";

lockBodyScroll();
});

closeGradeModal.addEventListener("click", ()=> {
gradeModal.style.display="none";

unLockBodyScroll();
});

cancelGradeModal.addEventListener("click", ()=> {
gradeModal.style.display="none";

unLockBodyScroll();
});

window.addEventListener("click",(e)=> {
if(e.target===gradeModal){
gradeModal.style.display="none";

unLockBodyScroll();
}
});

const openEnterGradeModal = document.getElementById("loadEnterGrade");

openEnterGradeModal.addEventListener("click", ()=> {
enterGradeModal.style.display="flex";

lockBodyScroll();
});

const enterGradeModal = document.getElementById("enterGradeModal");

const cancelEnterGradeModal = document.getElementById("cancelEnterGradeModal");

const closeEnterGradeModal = document.getElementById("closeEnterGradeModal");

closeEnterGradeModal.addEventListener("click", ()=> {
enterGradeModal.style.display="none";

unLockBodyScroll();
});

cancelEnterGradeModal.addEventListener("click", ()=> {
enterGradeModal.style.display="none";

unLockBodyScroll();
});

window.addEventListener("click",(e)=> {
if(e.target===enterGradeModal){
enterGradeModal.style.display="none";

unLockBodyScroll();
}
});

const viewGradeModal = document.getElementById("viewGradeModal");
const viewButtons = document.querySelectorAll(".view");
const closeViewGradeModal = document.getElementById("closeViewGradeModal");
const closeViewBtn = document.getElementById("closeViewBtn");

viewButtons.forEach(button=>{

button.addEventListener("click", ()=> {
viewGradeModal.style.display="flex";

lockBodyScroll();
});

})

closeViewGradeModal.addEventListener("click", ()=> {
viewGradeModal.style.display="none";

unLockBodyScroll();
});

closeViewBtn.addEventListener("click", ()=> {
viewGradeModal.style.display="none";

unLockBodyScroll();
});

window.addEventListener("click",(e)=> {
if(e.target===viewGradeModal){
viewGradeModal.style.display="none";

unLockBodyScroll();
}
});

const closeEditGradeModal = document.getElementById("closeEditGradeModal");
const cancelEditGradeModal = document.getElementById("cancelEditGradeModal");
const editGradeModal = document.getElementById("editGradeModal");
const editGradeButtons = document.querySelectorAll(".edit");

editGradeButtons.forEach(button=>{

button.addEventListener("click", ()=> {
editGradeModal.style.display="flex";

lockBodyScroll();
});

})

closeEditGradeModal.addEventListener("click", ()=> {
editGradeModal.style.display="none";

unLockBodyScroll();
});

cancelEditGradeModal.addEventListener("click", ()=> {
editGradeModal.style.display="none";

unLockBodyScroll();
});

window.addEventListener("click",(e)=> {
if(e.target===editGradeModal){
editGradeModal.style.display="none";

unLockBodyScroll();
}
});

