const roomModal = document.getElementById("roomModal");

const cancelRoomModal = document.getElementById("cancelRoomModal");

const openRoomModal = document.getElementById("addRoom");

const closeRoomModal = document.getElementById("closeRoomModal");

openRoomModal.addEventListener("click", ()=> {
roomModal.style.display="flex";

lockBodyScroll();
});

closeRoomModal.addEventListener("click", ()=> {
roomModal.style.display="none";

unLockBodyScroll();
});

cancelRoomModal.addEventListener("click", ()=> {
roomModal.style.display="none";

unLockBodyScroll();
});

window.addEventListener("click",(e)=> {
if(e.target===roomModal){
roomModal.style.display="none";

unLockBodyScroll();
}
});


const closeEditRoomModal = document.getElementById("closeEditRoomModal");
const cancelEditRoomModal = document.getElementById("cancelEditRoomModal");
const editRoomModal = document.getElementById("editRoomModal");
const editRoomButtons = document.querySelectorAll(".edit-Room");

editRoomButtons.forEach(button=>{

button.addEventListener("click", ()=> {
editRoomModal.style.display="flex";

lockBodyScroll();
});

})

closeEditRoomModal.addEventListener("click", ()=> {
editRoomModal.style.display="none";

unLockBodyScroll();
});

cancelEditRoomModal.addEventListener("click", ()=> {
editRoomModal.style.display="none";

unLockBodyScroll();
});

window.addEventListener("click",(e)=> {
if(e.target===editRoomModal){
editRoomModal.style.display="none";

unLockBodyScroll();
}
});

const archiveRoomModal = document.getElementById("archiveRoomModal");

const archiveButtons = document.querySelectorAll(".archive-Room");

const cancelArchive = document.getElementById("cancelArchive");

archiveButtons.forEach(button=>{

button.addEventListener("click", ()=> {
archiveRoomModal.style.display="flex";

lockBodyScroll();
});

})

cancelArchive.addEventListener("click", ()=> {
archiveRoomModal.style.display="none";

unLockBodyScroll();
});

window.addEventListener("click",(e)=> {

if(e.target===archiveRoomModal){
archiveRoomModal.style.display="none";

unLockBodyScroll();
}
});