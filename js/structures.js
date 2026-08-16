const addAddItem = document.getElementById("addAddItem");
const addItemModal = document.getElementById("addItemModal");
const closeAddItemModal = document.getElementById("closeAddItemModal");

const cancelAddItemModal = document.getElementById("cancelAddItemModal");

addAddItem.addEventListener("click", () => {
    addItemModal.style.display = "flex";
});

cancelAddItemModal.addEventListener("click", () => {
    addItemModal.style.display = "none";
});

closeAddItemModal.addEventListener("click", () => {
    addItemModal.style.display = "none";
});

window.addEventListener("click",(e)=> {
if(e.target===addItemModal){
addItemModal.style.display="none";

}
});


const editItemModal = document.getElementById("editItemModal");
const closeEditItemModal = document.getElementById("closeEditItemModal");
const editItemButtons = document.querySelectorAll(".edit-addItem");
const cancelEditItemModal = document.getElementById("cancelEditItemModal");

cancelEditItemModal.addEventListener("click", () => {
    editItemModal.style.display = "none";
});

closeEditItemModal.addEventListener("click", () => {
    editItemModal.style.display = "none";
});

window.addEventListener("click",(e)=> {
if(e.target===editItemModal){
editItemModal.style.display="none";

}
});

editItemButtons.forEach(button=>{

button.addEventListener("click", ()=> {
editItemModal.style.display="flex";

});

})

const deleteItemModal = document.getElementById("deleteItemModal");
const deleteButtons = document.querySelectorAll(".delete-addItem");
const cancelDelete = document.getElementById("cancelDelete");

deleteButtons.forEach(button=>{

button.addEventListener("click", ()=> {
deleteItemModal.style.display="flex";

});

})

cancelDelete.addEventListener("click", ()=> {
deleteItemModal.style.display="none";

});

window.addEventListener("click",(e)=> {

if(e.target===deleteItemModal){
deleteItemModal.style.display="none";

}
});

const structureModal = document.getElementById("structureModal");

const cancelStructureModal = document.getElementById("cancelStructureModal");

const openStructureModal = document.getElementById("addStructure");

const closeStructureModal = document.getElementById("closeStructureModal");

const openEditStructureModal = document.getElementById("addEditStructure");

openEditStructureModal.addEventListener("click", ()=> {
addItemModal.style.display="flex";

lockBodyScroll();
});

openStructureModal.addEventListener("click", ()=> {
structureModal.style.display="flex";

lockBodyScroll();
});

closeStructureModal.addEventListener("click", ()=> {
structureModal.style.display="none";

unLockBodyScroll();
});

cancelStructureModal.addEventListener("click", ()=> {
structureModal.style.display="none";

unLockBodyScroll();
});

window.addEventListener("click",(e)=> {
if(e.target===structureModal){
structureModal.style.display="none";

unLockBodyScroll();
}
});

const viewStructureModal = document.getElementById("viewStructureModal");
const viewButtons = document.querySelectorAll(".view");
const closeViewStructureModal = document.getElementById("closeViewStructureModal");
const closeViewBtn = document.getElementById("closeViewBtn");

viewButtons.forEach(button=>{

button.addEventListener("click", ()=> {
viewStructureModal.style.display="flex";

lockBodyScroll();
});

})

closeViewStructureModal.addEventListener("click", ()=> {
viewStructureModal.style.display="none";

unLockBodyScroll();
});

closeViewBtn.addEventListener("click", ()=> {
viewStructureModal.style.display="none";

unLockBodyScroll();
});

window.addEventListener("click",(e)=> {
if(e.target===viewStructureModal){
viewStructureModal.style.display="none";

unLockBodyScroll();
}
});

const archiveStructureModal = document.getElementById("archiveStructureModal");
const archiveButtons = document.querySelectorAll(".archive");
const cancelArchiveStructure = document.getElementById("cancelArchiveStructure")

archiveButtons.forEach(button=>{

button.addEventListener("click", ()=> {
archiveStructureModal.style.display="flex";

lockBodyScroll();
});

})

cancelArchiveStructure.addEventListener("click", ()=> {
archiveStructureModal.style.display="none";

unLockBodyScroll();
});

window.addEventListener("click",(e)=> {

if(e.target===archiveStructureModal){
archiveStructureModal.style.display="none";

unLockBodyScroll();
}
});

const closeEditStructureModal = document.getElementById("closeEditStructureModal");
const cancelEditStructureModal = document.getElementById("cancelEditStructureModal");
const editStructureModal = document.getElementById("editStructureModal");
const editButtons = document.querySelectorAll(".edit");

editButtons.forEach(button=>{

button.addEventListener("click", ()=> {
editStructureModal.style.display="flex";

lockBodyScroll();
});

})

closeEditStructureModal.addEventListener("click", ()=> {
editStructureModal.style.display="none";

unLockBodyScroll();
});

cancelEditStructureModal.addEventListener("click", ()=> {
editStructureModal.style.display="none";

unLockBodyScroll();
});

window.addEventListener("click",(e)=> {
if(e.target===editStructureModal){
editStructureModal.style.display="none";

unLockBodyScroll();
}
});