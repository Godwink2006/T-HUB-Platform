const attendanceModal = document.getElementById("attendanceModal");

const cancelAttendanceModal = document.getElementById("cancelAttendanceModal");

const openAttendanceModal = document.getElementById("addAttendance");

const closeAttendanceModal = document.getElementById("closeAttendanceModal");

openAttendanceModal.addEventListener("click", ()=> {
attendanceModal.style.display="flex";

lockBodyScroll();
});

closeAttendanceModal.addEventListener("click", ()=> {
attendanceModal.style.display="none";

unLockBodyScroll();
});

cancelAttendanceModal.addEventListener("click", ()=> {
attendanceModal.style.display="none";

unLockBodyScroll();
});

window.addEventListener("click",(e)=> {
if(e.target===attendanceModal){
attendanceModal.style.display="none";

unLockBodyScroll();
}
});

const openStudentAttendanceModal = document.getElementById("loadStudentAttendance");

openStudentAttendanceModal.addEventListener("click", ()=> {
studentAttendanceModal.style.display="flex";

lockBodyScroll();
});

const studentAttendanceModal = document.getElementById("studentAttendanceModal");

const cancelStudentAttendanceModal = document.getElementById("cancelStudentAttendanceModal");

const closeStudentAttendanceModal = document.getElementById("closeStudentAttendanceModal");

closeStudentAttendanceModal.addEventListener("click", ()=> {
studentAttendanceModal.style.display="none";

unLockBodyScroll();
});

cancelStudentAttendanceModal.addEventListener("click", ()=> {
studentAttendanceModal.style.display="none";

unLockBodyScroll();
});

window.addEventListener("click",(e)=> {
if(e.target===studentAttendanceModal){
studentAttendanceModal.style.display="none";

unLockBodyScroll();
}
});

const viewAttendanceModal = document.getElementById("viewAttendanceModal");
const viewButtons = document.querySelectorAll(".view");
const closeViewAttendanceModal = document.getElementById("closeViewAttendanceModal");
const closeViewBtn = document.getElementById("closeViewBtn");

viewButtons.forEach(button=>{

button.addEventListener("click", ()=> {
viewAttendanceModal.style.display="flex";

lockBodyScroll();
});

})

closeViewAttendanceModal.addEventListener("click", ()=> {
viewAttendanceModal.style.display="none";

unLockBodyScroll();
});

closeViewBtn.addEventListener("click", ()=> {
viewAttendanceModal.style.display="none";

unLockBodyScroll();
});

window.addEventListener("click",(e)=> {
if(e.target===viewAttendanceModal){
viewAttendanceModal.style.display="none";

unLockBodyScroll();
}
});