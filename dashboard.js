const filterBtn = document.querySelector(".filter-btn");
const filterMenu = document.querySelector(".filter-menu");
const customDate = document.querySelector(".custom-date");

const dateRangeModal = document.getElementById("dateRangeModal");
const closeDateModal = document.getElementById("closeDateModal");
const cancelDateModal = document.getElementById("cancelDateModal");

filterBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    if (filterMenu.style.display === "block") {

        filterMenu.style.display = "none";
    } else {
       filterMenu.style.display = "block";

    }
});

customDate.addEventListener("click", function (e) {
    e.preventDefault();

        filterMenu.style.display = "none";
     
       dateRangeModal.style.display = "flex";

       lockBodyScroll();
});

closeDateModal.addEventListener("click", function () {
     
       dateRangeModal.style.display = "none";

       unLockBodyScroll();
});

cancelDateModal.addEventListener("click", function () {
     
       dateRangeModal.style.display = "none";

       unLockBodyScroll();
});

window.addEventListener("click",(e)=> {
if(!filterBtn.contains(e.target) && 
   !filterMenu.contains(e.target)){

filterMenu.style.display="none";

}

if(e.target===dateRangeModal){
dateRangeModal.style.display="none";

unLockBodyScroll();
}
});

const announcementModal = document.getElementById("announcementModal");

const cancelAnnouncementModal = document.getElementById("cancelAnnouncementModal");

const openAnnouncementModal = document.getElementById("openAnnouncementModal");

const closeAnnouncementModal = document.getElementById("closeAnnouncementModal");

openAnnouncementModal.addEventListener("click", ()=> {
announcementModal.style.display="flex";

lockBodyScroll();
});

closeAnnouncementModal.addEventListener("click", ()=> {
announcementModal.style.display="none";

unLockBodyScroll();
});

cancelAnnouncementModal.addEventListener("click", ()=> {
announcementModal.style.display="none";

unLockBodyScroll();
});

window.addEventListener("click",(e)=> {
if(e.target===announcementModal){
announcementModal.style.display="none";

unLockBodyScroll();
}
});