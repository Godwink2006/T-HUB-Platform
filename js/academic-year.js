const academicYearModal = document.getElementById("academicYearModal");

const cancelAcademicYearModal = document.getElementById(
  "cancelAcademicYearModal",
);

const openAcademicYearModal = document.getElementById("addAcademicYear");

const closeAcademicYearModal = document.getElementById(
  "closeAcademicYearModal",
);

openAcademicYearModal.addEventListener("click", () => {
  academicYearModal.style.display = "flex";

  lockBodyScroll();
});

closeAcademicYearModal.addEventListener("click", () => {
  academicYearModal.style.display = "none";

  unLockBodyScroll();
});

cancelAcademicYearModal.addEventListener("click", () => {
  academicYearModal.style.display = "none";

  unLockBodyScroll();
});

window.addEventListener("click", (e) => {
  if (e.target === academicYearModal) {
    academicYearModal.style.display = "none";

    unLockBodyScroll();
  }
});

const closeEditAcademicYearModal = document.getElementById(
  "closeEditAcademicYearModal",
);
const cancelEditAcademicYearModal = document.getElementById(
  "cancelEditAcademicYearModal",
);
const editAcademicYearModal = document.getElementById("editAcademicYearModal");
const editAcademicYearButtons = document.querySelectorAll(".edit-academicYear");

editAcademicYearButtons.forEach((button) => {
  button.addEventListener("click", () => {
    editAcademicYearModal.style.display = "flex";

    lockBodyScroll();
  });
});

closeEditAcademicYearModal.addEventListener("click", () => {
  editAcademicYearModal.style.display = "none";

  unLockBodyScroll();
});

cancelEditAcademicYearModal.addEventListener("click", () => {
  editAcademicYearModal.style.display = "none";

  unLockBodyScroll();
});

window.addEventListener("click", (e) => {
  if (e.target === editAcademicYearModal) {
    editAcademicYearModal.style.display = "none";

    unLockBodyScroll();
  }
});

const archiveAcademicYearModal = document.getElementById(
  "archiveAcademicYearModal",
);

const archiveButtons = document.querySelectorAll(".archive-AcademicYear");

const cancelArchive = document.getElementById("cancelArchive");

archiveButtons.forEach((button) => {
  button.addEventListener("click", () => {
    archiveAcademicYearModal.style.display = "flex";

    lockBodyScroll();
  });
});

cancelArchive.addEventListener("click", () => {
  archiveAcademicYearModal.style.display = "none";

  unLockBodyScroll();
});

window.addEventListener("click", (e) => {
  if (e.target === archiveAcademicYearModal) {
    archiveAcademicYearModal.style.display = "none";

    unLockBodyScroll();
  }
});
