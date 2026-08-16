const addRecordPayment = document.getElementById("addRecordPayment");
const addRecordPaymentModal = document.getElementById("addRecordPaymentModal");
const closeAddRecordPaymentModal = document.getElementById("closeAddRecordPaymentModal");

const cancelAddRecordPaymentModal = document.getElementById("cancelAddRecordPaymentModal");

addRecordPayment.addEventListener("click", () => {
    addRecordPaymentModal.style.display = "flex";
});

cancelAddRecordPaymentModal.addEventListener("click", () => {
    addRecordPaymentModal.style.display = "none";
});

closeAddRecordPaymentModal.addEventListener("click", () => {
    addRecordPaymentModal.style.display = "none";
});

window.addEventListener("click",(e)=> {
if(e.target===addRecordPaymentModal){
addRecordPaymentModal.style.display="none";

}
});

const viewPaymentModal = document.getElementById("viewPaymentModal");
const viewButtons = document.querySelectorAll(".view");
const closeViewPaymentModal = document.getElementById("closeViewPaymentModal");
const closeViewBtn = document.getElementById("closeViewBtn");

viewButtons.forEach(button=>{

button.addEventListener("click", ()=> {
viewPaymentModal.style.display="flex";

lockBodyScroll();
});

})

closeViewPaymentModal.addEventListener("click", ()=> {
viewPaymentModal.style.display="none";

unLockBodyScroll();
});

closeViewBtn.addEventListener("click", ()=> {
viewPaymentModal.style.display="none";

unLockBodyScroll();
});

window.addEventListener("click",(e)=> {
if(e.target===viewPaymentModal){
viewPaymentModal.style.display="none";

unLockBodyScroll();
}
});
