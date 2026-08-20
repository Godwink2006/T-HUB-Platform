const termModal = document.getElementById("termModal");

const cancelTermModal = document.getElementById("cancelTermModal");

const openTermModal = document.getElementById("addTerm");

const closeTermModal = document.getElementById("closeTermModal");

openTermModal.addEventListener("click", () => {
  termModal.style.display = "flex";

  lockBodyScroll();
});

closeTermModal.addEventListener("click", () => {
  termModal.style.display = "none";

  unLockBodyScroll();
});

cancelTermModal.addEventListener("click", () => {
  termModal.style.display = "none";

  unLockBodyScroll();
});

window.addEventListener("click", (e) => {
  if (e.target === termModal) {
    termModal.style.display = "none";

    unLockBodyScroll();
  }
});

const closeEditTermModal = document.getElementById("closeEditTermModal");
const cancelEditTermModal = document.getElementById("cancelEditTermModal");
const editTermModal = document.getElementById("editTermModal");
const editTermButtons = document.querySelectorAll(".edit-term");

editTermButtons.forEach((button) => {
  button.addEventListener("click", () => {
    editTermModal.style.display = "flex";

    lockBodyScroll();
  });
});

closeEditTermModal.addEventListener("click", () => {
  editTermModal.style.display = "none";

  unLockBodyScroll();
});

cancelEditTermModal.addEventListener("click", () => {
  editTermModal.style.display = "none";

  unLockBodyScroll();
});

window.addEventListener("click", (e) => {
  if (e.target === editTermModal) {
    editTermModal.style.display = "none";

    unLockBodyScroll();
  }
});

const archiveTermModal = document.getElementById("archiveTermModal");

const archiveTermButtons = document.querySelectorAll(".archive-term");

const cancelTermArchive = document.getElementById("cancelTermArchive");

archiveTermButtons.forEach((button) => {
  button.addEventListener("click", () => {
    archiveTermModal.style.display = "flex";

    lockBodyScroll();
  });
});

cancelTermArchive.addEventListener("click", () => {
  archiveTermModal.style.display = "none";

  unLockBodyScroll();
});

window.addEventListener("click", (e) => {
  if (e.target === archiveTermModal) {
    archiveTermModal.style.display = "none";

    unLockBodyScroll();
  }
});
