/* =========================================================
ASSESSMENT MODAL CONTROLS
========================================================= */

/* =========================================================
OPEN ADD ASSESSMENT MODAL
========================================================= */

function openAssessmentModal() {
  const modal = document.getElementById("assessmentModal");

  if (!modal) return;

  modal.classList.add("active");
  document.body.style.overflow = "hidden";
}

/* =========================================================
CLOSE ADD ASSESSMENT MODAL
========================================================= */

function closeAssessmentModal() {
  const modal = document.getElementById("assessmentModal");

  if (!modal) return;

  modal.classList.remove("active");
  document.body.style.overflow = "";
}

/* =========================================================
OPEN EDIT ASSESSMENT MODAL
========================================================= */

function openEditAssessmentModal(id) {
  const modal = document.getElementById("editAssessmentModal");

  if (!modal) return;

  console.log("Edit assessment:", id);

  modal.dataset.id = id;

  modal.classList.add("active");
  document.body.style.overflow = "hidden";
}

/* =========================================================
CLOSE EDIT ASSESSMENT MODAL
========================================================= */

function closeEditAssessmentModal() {
  const modal = document.getElementById("editAssessmentModal");

  if (!modal) return;

  modal.classList.remove("active");
  document.body.style.overflow = "";
}

/* =========================================================
OPEN ARCHIVE ASSESSMENT MODAL
========================================================= */

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

/* =========================================================
CLOSE ARCHIVE ASSESSMENT MODAL
========================================================= */

function closeArchiveAssessmentModal() {
  const modal = document.getElementById("archiveAssessmentModal");

  if (!modal) return;

  modal.classList.remove("active");
  document.body.style.overflow = "";
}

/* =========================================================
DOM READY
========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  /* =======================================================
ADD ASSESSMENT
======================================================= */

  document
    .getElementById("addAssessment")
    ?.addEventListener("click", openAssessmentModal);

  document
    .getElementById("closeAssessmentModal")
    ?.addEventListener("click", closeAssessmentModal);

  document
    .getElementById("cancelAssessmentModal")
    ?.addEventListener("click", closeAssessmentModal);

  /* =======================================================
EDIT ASSESSMENT
======================================================= */

  document
    .getElementById("closeEditAssessmentModal")
    ?.addEventListener("click", closeEditAssessmentModal);

  document
    .getElementById("cancelEditAssessmentModal")
    ?.addEventListener("click", closeEditAssessmentModal);

  /* =======================================================
ARCHIVE ASSESSMENT
======================================================= */

  document
    .getElementById("cancelArchiveAssessment")
    ?.addEventListener("click", closeArchiveAssessmentModal);

  /* =======================================================
ASSESSMENT EDIT BUTTONS
Event delegation supports dynamically loaded rows.
======================================================= */

  document
    .getElementById("assessmentsTableBody")
    ?.addEventListener("click", (event) => {
      const editButton = event.target.closest(".edit-assessment");

      if (!editButton) return;

      const id = editButton.dataset.id;

      if (!id) return;

      openEditAssessmentModal(id);
    });

  /* =======================================================
ASSESSMENT ARCHIVE BUTTONS
Event delegation supports dynamically loaded rows.
======================================================= */

  document
    .getElementById("assessmentsTableBody")
    ?.addEventListener("click", (event) => {
      const archiveButton = event.target.closest(".archive-assessment");

      if (!archiveButton) return;

      const id = archiveButton.dataset.id;

      const name = archiveButton.dataset.name || "this assessment";

      if (!id) return;

      openArchiveAssessmentModal(id, name);
    });

  /* =======================================================
ADD ASSESSMENT FORM
======================================================= */

  document
    .getElementById("assessmentForm")
    ?.addEventListener("submit", (event) => {
      event.preventDefault();

      const name = document.getElementById("assessmentNameInput")?.value.trim();

      const description = document
        .getElementById("assessmentDescriptionInput")
        ?.value.trim();

      const marks = document.getElementById("assessmentMarksInput")?.value;

      const status = document.getElementById("assessmentStatusInput")?.value;

      if (!name || !marks || !status) {
        return;
      }

      console.log("Create assessment:", {
        name,
        description,
        marks,
        status,
      });

      /*
    Supabase insert will go here later.

    Example:

    await supabase
      .from("assessments")
      .insert({
        name,
        description,
        maximum_marks: Number(marks),
        status
      });
  */

      closeAssessmentModal();
    });

  /* =======================================================
EDIT ASSESSMENT FORM
======================================================= */

  document
    .getElementById("editAssessmentForm")
    ?.addEventListener("submit", (event) => {
      event.preventDefault();

      const id = document.getElementById("editAssessmentId")?.value;

      const name = document
        .getElementById("editAssessmentNameInput")
        ?.value.trim();

      const description = document
        .getElementById("editAssessmentDescriptionInput")
        ?.value.trim();

      const marks = document.getElementById("editAssessmentMarksInput")?.value;

      const status = document.getElementById(
        "editAssessmentStatusInput",
      )?.value;

      if (!id || !name || !marks || !status) {
        return;
      }

      console.log("Update assessment:", {
        id,
        name,
        description,
        marks,
        status,
      });

      /*
    Supabase update will go here later.

    Example:

    await supabase
      .from("assessments")
      .update({
        name,
        description,
        maximum_marks: Number(marks),
        status
      })
      .eq("id", id);
  */

      closeEditAssessmentModal();
    });

  /* =======================================================
CONFIRM ARCHIVE ASSESSMENT
======================================================= */

  document
    .getElementById("confirmArchiveAssessment")
    ?.addEventListener("click", () => {
      const modal = document.getElementById("archiveAssessmentModal");

      if (!modal) return;

      const id = modal.dataset.id;

      if (!id) return;

      console.log("Archive assessment:", id);

      /*
    Supabase archive will go here later.

    Example:

    await supabase
      .from("assessments")
      .update({
        status: "Inactive"
      })
      .eq("id", id);
  */

      closeArchiveAssessmentModal();
    });

  /* =======================================================
BACKDROP CLICK
======================================================= */

  const modalIds = [
    "assessmentModal",
    "editAssessmentModal",
    "archiveAssessmentModal",
  ];

  modalIds.forEach((id) => {
    const modal = document.getElementById(id);

    if (!modal) return;

    modal.addEventListener("click", (event) => {
      if (event.target !== modal) return;

      modal.classList.remove("active");

      document.body.style.overflow = "";
    });
  });

  /* =======================================================
ESCAPE KEY
======================================================= */

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;

    modalIds.forEach((id) => {
      const modal = document.getElementById(id);

      if (!modal) return;

      if (modal.classList.contains("active")) {
        modal.classList.remove("active");
      }
    });

    document.body.style.overflow = "";
  });

  /* =======================================================
BACK TO ACADEMIC SETTINGS
======================================================= */

  document
    .getElementById("backAcademicSettingsBtn")
    ?.addEventListener("click", () => {
      window.location.href = "settings.html";
    });
});
