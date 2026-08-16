const addLesson = document.getElementById("addLesson");
const lessonModal = document.getElementById("lessonModal");
const closeLessonModal = document.getElementById("closeLessonModal");

const cancelLessonModal = document.getElementById("cancelLessonModal");

const addLessonEdit = document.getElementById("addLessonEdit");

addLesson.addEventListener("click", () => {
    lessonModal.style.display = "flex";
});

addLessonEdit.addEventListener("click", () => {
    lessonModal.style.display = "flex";
});

cancelLessonModal.addEventListener("click", () => {
    lessonModal.style.display = "none";
});

closeLessonModal.addEventListener("click", () => {
    lessonModal.style.display = "none";
});

window.addEventListener("click",(e)=> {
if(e.target===lessonModal){
lessonModal.style.display="none";

}
});





const editLessonModal = document.getElementById("editLessonModal");
const closeEditLessonModal = document.getElementById("closeEditLessonModal");
const editLessonButtons = document.querySelectorAll(".edit-lesson");
const cancelEditLessonModal = document.getElementById("cancelEditLessonModal");

cancelEditLessonModal.addEventListener("click", () => {
    editLessonModal.style.display = "none";
});

closeEditLessonModal.addEventListener("click", () => {
    editLessonModal.style.display = "none";
});

window.addEventListener("click",(e)=> {
if(e.target===editLessonModal){
editLessonModal.style.display="none";

}
});

editLessonButtons.forEach(button=>{

button.addEventListener("click", ()=> {
editLessonModal.style.display="flex";

});

})

const deleteLessonModal = document.getElementById("deleteLessonModal");
const deleteButtons = document.querySelectorAll(".delete-lesson");
const cancelDelete = document.getElementById("cancelDelete");

deleteButtons.forEach(button=>{

button.addEventListener("click", ()=> {
deleteLessonModal.style.display="flex";

});

})

cancelDelete.addEventListener("click", ()=> {
deleteLessonModal.style.display="none";

});

window.addEventListener("click",(e)=> {

if(e.target===deleteLessonModal){
deleteLessonModal.style.display="none";

}
});




const timetableModal = document.getElementById("timetableModal");

const cancelTimetableModal = document.getElementById("cancelTimetableModal");

const openTimetableModal = document.getElementById("addTimetable");

const closeTimetableModal = document.getElementById("closeTimetableModal");

openTimetableModal.addEventListener("click", ()=> {
timetableModal.style.display="flex";

lockBodyScroll();
});

closeTimetableModal.addEventListener("click", ()=> {
timetableModal.style.display="none";

unLockBodyScroll();
});

cancelTimetableModal.addEventListener("click", ()=> {
timetableModal.style.display="none";

unLockBodyScroll();
});

window.addEventListener("click",(e)=> {
if(e.target===timetableModal){
timetableModal.style.display="none";

unLockBodyScroll();
}
});



const archiveTimetableModal = document.getElementById("archiveTimetableModal");
const archiveButtons = document.querySelectorAll(".archive");
const cancelArchiveTimetable = document.getElementById("cancelArchiveTimetable")

archiveButtons.forEach(button=>{

button.addEventListener("click", ()=> {
archiveTimetableModal.style.display="flex";

lockBodyScroll();
});

})

cancelArchiveTimetable.addEventListener("click", ()=> {
archiveTimetableModal.style.display="none";

unLockBodyScroll();
});

window.addEventListener("click",(e)=> {

if(e.target===archiveTimetableModal){
archiveTimetableModal.style.display="none";

unLockBodyScroll();
}
});


const viewTimetableModal = document.getElementById("viewTimetableModal");
const viewButtons = document.querySelectorAll(".view");
const closeViewTimetableModal = document.getElementById("closeViewTimetableModal");
const closeViewBtn = document.getElementById("closeViewBtn");

viewButtons.forEach(button=>{

button.addEventListener("click", ()=> {
viewTimetableModal.style.display="flex";

lockBodyScroll();
});

})

closeViewTimetableModal.addEventListener("click", ()=> {
viewTimetableModal.style.display="none";

unLockBodyScroll();
});

closeViewBtn.addEventListener("click", ()=> {
viewTimetableModal.style.display="none";

unLockBodyScroll();
});

window.addEventListener("click",(e)=> {
if(e.target===viewTimetableModal){
viewTimetableModal.style.display="none";

unLockBodyScroll();
}
});

const closeEditTimetableModal = document.getElementById("closeEditTimetableModal");
const cancelEditTimetableModal = document.getElementById("cancelEditTimetableModal");
const editTimetableModal = document.getElementById("editTimetableModal");
const editButtons = document.querySelectorAll(".edit");

editButtons.forEach(button=>{

button.addEventListener("click", ()=> {
editTimetableModal.style.display="flex";

lockBodyScroll();
});

})

closeEditTimetableModal.addEventListener("click", ()=> {
editTimetableModal.style.display="none";

unLockBodyScroll();
});

cancelEditTimetableModal.addEventListener("click", ()=> {
editTimetableModal.style.display="none";

unLockBodyScroll();
});

window.addEventListener("click",(e)=> {
if(e.target===editTimetableModal){
editTimetableModal.style.display="none";

unLockBodyScroll();
}
});