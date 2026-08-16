const classModal = document.getElementById("classModal");

const cancelClassModal = document.getElementById("cancelClassModal");

const openClassModal = document.getElementById("addClass");

const closeClassModal = document.getElementById("closeClassModal");

openClassModal.addEventListener("click", ()=> {
classModal.style.display="flex";

lockBodyScroll();
});

closeClassModal.addEventListener("click", ()=> {
classModal.style.display="none";

unLockBodyScroll();
});

cancelClassModal.addEventListener("click", ()=> {
classModal.style.display="none";

unLockBodyScroll();
});

window.addEventListener("click",(e)=> {
if(e.target===classModal){
classModal.style.display="none";

unLockBodyScroll();
}
});


const closeEditClassModal = document.getElementById("closeEditClassModal");
const cancelEditClassModal = document.getElementById("cancelEditClassModal");
const editClassModal = document.getElementById("editClassModal");
const editButtons = document.querySelectorAll(".edit");

editButtons.forEach(button=>{

button.addEventListener("click", ()=> {
editClassModal.style.display="flex";

lockBodyScroll();
});

})

closeEditClassModal.addEventListener("click", ()=> {
editClassModal.style.display="none";

unLockBodyScroll();
});

cancelEditClassModal.addEventListener("click", ()=> {
editClassModal.style.display="none";

unLockBodyScroll();
});

window.addEventListener("click",(e)=> {
if(e.target===editClassModal){
editClassModal.style.display="none";

unLockBodyScroll();
}
});

const viewClassModal = document.getElementById("viewClassModal");

const archiveClassModal = document.getElementById("archiveClassModal");

const viewButtons = document.querySelectorAll(".view");

const archiveButtons = document.querySelectorAll(".archive");

const closeViewClassModal = document.getElementById("closeViewClassModal");

const closeViewBtn = document.getElementById("closeViewBtn");

const cancelArchive = document.getElementById("cancelArchive");

viewButtons.forEach(button=>{

button.addEventListener("click", ()=> {
viewClassModal.style.display="flex";

lockBodyScroll();
});

})

closeViewClassModal.addEventListener("click", ()=> {
viewClassModal.style.display="none";

unLockBodyScroll();
});

closeViewBtn.addEventListener("click", ()=> {
viewClassModal.style.display="none";

unLockBodyScroll();
});

archiveButtons.forEach(button=>{

button.addEventListener("click", ()=> {
archiveClassModal.style.display="flex";

lockBodyScroll();
});

})

cancelArchive.addEventListener("click", ()=> {
archiveClassModal.style.display="none";

unLockBodyScroll();
});

window.addEventListener("click",(e)=> {
if(e.target===viewClassModal){
viewClassModal.style.display="none";

unLockBodyScroll();
}

if(e.target===archiveClassModal){
archiveClassModal.style.display="none";

unLockBodyScroll();
}
});