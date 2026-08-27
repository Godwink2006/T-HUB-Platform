// =========================================================
// ASSESSMENT MODAL CONTROLS
// =========================================================

function openAssessmentModal() {
  const modal = document.getElementById("assessmentModal");

  if (!modal) return;

  modal.classList.add("active");
  document.body.style.overflow = "hidden";
}

function closeAssessmentModal() {
  const modal = document.getElementById("assessmentModal");

  if (!modal) return;

  modal.classList.remove("active");
  document.body.style.overflow = "";
}

function openEditAssessmentModal(id) {
  const modal = document.getElementById("editAssessmentModal");

  if (!modal) return;

  // Later we can load the assessment from Supabase here.
  console.log("Edit assessment:", id);

  modal.dataset.id = id;
  modal.classList.add("active");
  document.body.style.overflow = "hidden";
}

function closeEditAssessmentModal() {
  const modal = document.getElementById("editAssessmentModal");

  if (!modal) return;

  modal.classList.remove("active");
  document.body.style.overflow = "";
}

function openArchiveAssessmentModal(id, name) {
  const modal = document.getElementById("archiveAssessmentModal");

  if (!modal) return;

  const nameElement = document.getElementById("archiveAssessmentName");

  if (nameElement) {
    nameElement.textContent = name;
  }

  modal.dataset.id = id;

  modal.classList.add("active");
  document.body.style.overflow = "hidden";
}

function closeArchiveAssessmentModal() {
  const modal = document.getElementById("archiveAssessmentModal");

  if (!modal) return;

  modal.classList.remove("active");
  document.body.style.overflow = "";
}

// =========================================================
// CATEGORY MODALS
// =========================================================

function openCategoryModal() {
  const modal = document.getElementById("categoryModal");

  if (!modal) return;

  modal.classList.add("active");
  document.body.style.overflow = "hidden";
}

function closeCategoryModal() {
  const modal = document.getElementById("categoryModal");

  if (!modal) return;

  modal.classList.remove("active");
  document.body.style.overflow = "";
}

function openEditCategoryModal(id) {
  const modal = document.getElementById("editCategoryModal");

  if (!modal) return;

  console.log("Edit category:", id);

  modal.dataset.id = id;
  modal.classList.add("active");
  document.body.style.overflow = "hidden";
}

function closeEditCategoryModal() {
  const modal = document.getElementById("editCategoryModal");

  if (!modal) return;

  modal.classList.remove("active");
  document.body.style.overflow = "";
}

function openArchiveCategoryModal(id, name) {
  const modal = document.getElementById("archiveCategoryModal");

  if (!modal) return;

  const nameElement = document.getElementById("archiveCategoryName");

  if (nameElement) {
    nameElement.textContent = name;
  }

  modal.dataset.id = id;

  modal.classList.add("active");
  document.body.style.overflow = "hidden";
}

function closeArchiveCategoryModal() {
  const modal = document.getElementById("archiveCategoryModal");

  if (!modal) return;

  modal.classList.remove("active");
  document.body.style.overflow = "";
}

// =========================================================
// PAGE EVENT LISTENERS
// =========================================================

document.addEventListener("DOMContentLoaded", () => {
  // -------------------------
  // Assessment Add
  // -------------------------

  document
    .getElementById("addAssessmentBtn")
    ?.addEventListener("click", openAssessmentModal);

  document
    .getElementById("closeAssessmentModal")
    ?.addEventListener("click", closeAssessmentModal);

  document
    .getElementById("cancelAssessmentModal")
    ?.addEventListener("click", closeAssessmentModal);

  // -------------------------
  // Assessment Edit
  // -------------------------

  document
    .getElementById("closeEditAssessmentModal")
    ?.addEventListener("click", closeEditAssessmentModal);

  document
    .getElementById("cancelEditAssessmentModal")
    ?.addEventListener("click", closeEditAssessmentModal);

  // -------------------------
  // Assessment Archive
  // -------------------------

  document
    .getElementById("cancelArchiveAssessment")
    ?.addEventListener("click", closeArchiveAssessmentModal);

  // -------------------------
  // Category Add
  // -------------------------

  document
    .getElementById("addCategoryBtn")
    ?.addEventListener("click", openCategoryModal);

  document
    .getElementById("closeCategoryModal")
    ?.addEventListener("click", closeCategoryModal);

  document
    .getElementById("cancelCategoryModal")
    ?.addEventListener("click", closeCategoryModal);

  // -------------------------
  // Category Edit
  // -------------------------

  document
    .getElementById("closeEditCategoryModal")
    ?.addEventListener("click", closeEditCategoryModal);

  document
    .getElementById("cancelEditCategoryModal")
    ?.addEventListener("click", closeEditCategoryModal);

  // -------------------------
  // Category Archive
  // -------------------------

  document
    .getElementById("cancelArchiveCategory")
    ?.addEventListener("click", closeArchiveCategoryModal);

  // =======================================================
  // BACKDROP CLICK
  // =======================================================

  const modalIds = [
    "assessmentModal",
    "editAssessmentModal",
    "archiveAssessmentModal",
    "categoryModal",
    "editCategoryModal",
    "archiveCategoryModal",
  ];

  modalIds.forEach((id) => {
    const modal = document.getElementById(id);

    if (!modal) return;

    modal.addEventListener("click", (event) => {
      if (event.target === modal) {
        modal.classList.remove("active");
        document.body.style.overflow = "";
      }
    });
  });

  // =======================================================
  // ESCAPE KEY
  // =======================================================

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;

    modalIds.forEach((id) => {
      const modal = document.getElementById(id);

      if (modal?.classList.contains("active")) {
        modal.classList.remove("active");
      }
    });

    document.body.style.overflow = "";
  });
});
