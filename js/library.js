const addBorrow = document.getElementById("addBorrow");
const addBorrowModal = document.getElementById("addBorrowModal");
const closeAddBorrowModal = document.getElementById("closeAddBorrowModal");

const cancelAddBorrowModal = document.getElementById("cancelAddBorrowModal");

addBorrow.addEventListener("click", () => {
    addBorrowModal.style.display = "flex";
});

cancelAddBorrowModal.addEventListener("click", () => {
    addBorrowModal.style.display = "none";
});

closeAddBorrowModal.addEventListener("click", () => {
    addBorrowModal.style.display = "none";
});

window.addEventListener("click",(e)=> {
if(e.target===addBorrowModal){
addBorrowModal.style.display="none";

}
});



const addReturnBorrow = document.getElementById("addReturnBorrow");
const returnBorrowModal = document.getElementById("returnBorrowModal");
const closeReturnBorrowModal = document.getElementById("closeReturnBorrowModal");

const cancelReturnBorrowModal = document.getElementById("cancelReturnBorrowModal");

addReturnBorrow.addEventListener("click", () => {
    returnBorrowModal.style.display = "flex";
});

cancelReturnBorrowModal.addEventListener("click", () => {
    returnBorrowModal.style.display = "none";
});

closeReturnBorrowModal.addEventListener("click", () => {
    returnBorrowModal.style.display = "none";
});

window.addEventListener("click",(e)=> {
if(e.target===returnBorrowModal){
returnBorrowModal.style.display="none";

}
});


const bookModal = document.getElementById("bookModal");

const cancelBookModal = document.getElementById("cancelBookModal");

const openBookModal = document.getElementById("addBook");

const closeBookModal = document.getElementById("closeBookModal");


openBookModal.addEventListener("click", ()=> {
bookModal.style.display="flex";

lockBodyScroll();
});

closeBookModal.addEventListener("click", ()=> {
bookModal.style.display="none";

unLockBodyScroll();
});

cancelBookModal.addEventListener("click", ()=> {
bookModal.style.display="none";

unLockBodyScroll();
});

window.addEventListener("click",(e)=> {
if(e.target===bookModal){
bookModal.style.display="none";

unLockBodyScroll();
}
});

const viewBookModal = document.getElementById("viewBookModal");
const viewButtons = document.querySelectorAll(".view");
const closeViewBookModal = document.getElementById("closeViewBookModal");

const closeViewBtn = document.getElementById("closeViewBtn");

viewButtons.forEach(button=>{

button.addEventListener("click", ()=> {
viewBookModal.style.display="flex";

lockBodyScroll();
});

})

closeViewBookModal.addEventListener("click", ()=> {
viewBookModal.style.display="none";

unLockBodyScroll();
});

closeViewBtn.addEventListener("click", ()=> {
viewBookModal.style.display="none";

unLockBodyScroll();
});

window.addEventListener("click",(e)=> {
if(e.target===viewBookModal){
viewBookModal.style.display="none";

unLockBodyScroll();
}
});

const closeEditBookModal = document.getElementById("closeEditBookModal");
const cancelEditBookModal = document.getElementById("cancelEditBookModal");
const editBookModal = document.getElementById("editBookModal");
const editButtons = document.querySelectorAll(".edit");

editButtons.forEach(button=>{

button.addEventListener("click", ()=> {
editBookModal.style.display="flex";

lockBodyScroll();
});

})

closeEditBookModal.addEventListener("click", ()=> {
editBookModal.style.display="none";

unLockBodyScroll();
});

cancelEditBookModal.addEventListener("click", ()=> {
editBookModal.style.display="none";

unLockBodyScroll();
});

window.addEventListener("click",(e)=> {
if(e.target===editBookModal){
editBookModal.style.display="none";

unLockBodyScroll();
}
});

const archiveButtons = document.querySelectorAll(".archive");
const cancelArchive = document.getElementById("cancelArchive");
const archiveBookModal = document.getElementById("archiveBookModal");

archiveButtons.forEach(button=>{

button.addEventListener("click", ()=> {
archiveBookModal.style.display="flex";

lockBodyScroll();
});

})

cancelArchive.addEventListener("click", ()=> {
archiveBookModal.style.display="none";

unLockBodyScroll();
});

window.addEventListener("click",(e)=> {

if(e.target===archiveBookModal){
archiveBookModal.style.display="none";

unLockBodyScroll();
}
});
