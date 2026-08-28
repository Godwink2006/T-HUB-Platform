/* =======================================================
   ASSESSMENTS MODULE (LOAD, RENDER & EVENT DELEGATION)
   ======================================================= */

function escapeHTML(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ADDED: Prevents quote break-outs inside data-* attributes
function escapeAttribute(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Utility to format timestamps nicely
function formatDateTime(isoString) {
  if (!isoString) return "N/A";
  const date = new Date(isoString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
// Global state cache for in-memory operations
let currentAssessments = [];

/**
 * Fetch assessments from Supabase and update local state
 */
async function loadAssessments() {
  const tableBody = document.getElementById("assessmentsTableBody");
  if (!tableBody) return;

  try {
    // Optional loading indicator state
    tableBody.innerHTML = `
      <tr>
         <td colspan="7" style="text-align: center; padding: 2rem; color: #64748b;">
        <i class="fa-solid fa-spinner fa-spin" style="margin-right: 0.5rem;"></i>
        Loading assessments...
      </td>
      </tr>
    `;

    const { data, error } = await supabaseClient
      .from("assessments")
      .select("*")
      .eq("is_archive", false)
      .order("created_at", { ascending: true });

    if (error) {
      // AFTER: Type check to avoid runtime failure
      if (typeof showToast === "function") {
        showToast("Failed to load assessments.", "error");
      }
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; color: red; padding: 20px;">
            Error loading data.
          </td>
        </tr>
      `;
      return;
    }

    // Cache the data globally
    currentAssessments = data || [];
    renderAssessmentTable(currentAssessments);
  } catch (err) {
    // To this:
    showToast("Unexpected error loading assessments.", "error");
  }
}

/**
 * Render assessment records into the table DOM
 * @param {Array} assessments
 */
function renderAssessmentTable(assessments) {
  const tableBody = document.getElementById("assessmentsTableBody");
  if (!tableBody) return;

  if (assessments.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 20px;">
          No assessments found.
        </td>
      </tr>
    `;
    return;
  }

  // Generate HTML rows matching your markup standard
  tableBody.innerHTML = assessments
    .map((item) => {
      const isInactive = item.status?.toLowerCase() === "inactive";
      const statusClass = isInactive
        ? "assessment-status-inactive"
        : "assessment-status-active";
      const statusLabel = isInactive ? "Inactive" : "Active";

      // Add this line right above your return statement in map():
      const rawName = item.name || "";

      return `
        <tr data-id="${item.id}">
          <td>${escapeHTML(item.name || "")}</td>
          <td>${escapeHTML(item.description || "—")}</td>
          <td>${item.maximum_marks}</td>
          <td>
            <span class="assessment-status ${statusClass}">
              ${statusLabel}
            </span>
          </td>
           <td>${formatDateTime(item.created_at)}</td>
        <td>${formatDateTime(item.updated_at)}</td>
          <td>
            <div class="assessment-actions">
              <button
                type="button"
                class="assessment-action-btn assessment-edit-btn edit-assessment"
                data-id="${item.id}"
                title="Edit Assessment"
              >
                <i class="fa-solid fa-pen"></i>
              </button>

              <button
                type="button"
                class="assessment-action-btn assessment-archive-btn archive-assessment"
                data-id="${item.id}"
data-name="${escapeAttribute(rawName)}"
                title="Archive Assessment"
              >
                <i class="fa-solid fa-box-archive"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

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

function openEditAssessmentModal(id) {
  const modal = document.getElementById("editAssessmentModal");
  const form = document.getElementById("editAssessmentForm");

  if (!modal || !form || !id) return;

  // Find record in cached state (handles number/string ID mismatches)
  const assessment = currentAssessments.find(
    (item) => String(item.id) === String(id),
  );
  if (!assessment) return;

  // Populate form fields matching your HTML IDs
  document.getElementById("editAssessmentId").value = assessment.id;
  document.getElementById("editAssessmentNameInput").value =
    assessment.name || "";
  document.getElementById("editAssessmentDescriptionInput").value =
    assessment.description || "";
  document.getElementById("editAssessmentMarksInput").value =
    assessment.maximum_marks;
  document.getElementById("editAssessmentStatusInput").value =
    assessment.status;

  // Save baseline state on form dataset for change detection
  const rawStatus = assessment.status || "";
  const normalizedStatus = rawStatus
    ? rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1).toLowerCase()
    : "";

  form.dataset.origDescription = assessment.description || "";
  form.dataset.origMarks = assessment.maximum_marks;
  form.dataset.origStatus = normalizedStatus;

  // Display modal
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
  if (!modal || !id) return;

  const nameElement = document.getElementById("archiveAssessmentName");
  if (nameElement) {
    nameElement.textContent = name || "this assessment";
  }

  // Store target assessment ID on modal dataset
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
  // Reusable notification helper
  const notifyUser = (message, type = "error", targetInput = null) => {
    if (typeof showToast === "function") {
      showToast(message, type);
    } else {
      alert(message);
    }
    targetInput?.focus();
  };

  /* =========================================================
     ARCHIVE ASSESSMENT CONFIRMATION LISTENER
     ========================================================= */
  const confirmBtn = document.getElementById("confirmArchiveAssessment");
  const cancelBtn = document.getElementById("cancelArchiveAssessment");
  const archiveModal = document.getElementById("archiveAssessmentModal");

  // Wire Cancel Button
  if (cancelBtn && !cancelBtn.dataset.hasListener) {
    cancelBtn.dataset.hasListener = "true";
    cancelBtn.addEventListener("click", () => {
      if (typeof closeArchiveAssessmentModal === "function")
        closeArchiveAssessmentModal();
    });
  }

  // Wire Confirm Archive Button
  if (confirmBtn && !confirmBtn.dataset.hasListener) {
    confirmBtn.dataset.hasListener = "true";

    confirmBtn.addEventListener("click", async function () {
      const id = archiveModal?.dataset.id;
      if (!id) return;

      try {
        confirmBtn.disabled = true;
        confirmBtn.textContent = "Archiving...";

        const { data, error } = await supabaseClient
          .from("assessments")
          .update({
            is_archive: true,
            status: "Inactive",
          })
          .eq("id", id)
          .select();

        // Fix 1: Handle RLS silent policy rejection (0 rows updated)
        if (!error && (!data || data.length === 0)) {
          notifyUser(
            "You do not have permission to archive assessments.",
            "error",
          );
          return;
        }

        // Fix 2: Broaden permission error code checks (42501, 403, PGRST301)
        if (error) {
          console.error("Supabase archive error:", error);

          const isPermissionErr =
            error.code === "42501" ||
            error.code === "PGRST301" ||
            error.status === 403 ||
            error.message?.toLowerCase().includes("permission") ||
            error.message
              ?.toLowerCase()
              .includes("violates row-level security");

          if (isPermissionErr) {
            notifyUser(
              "You do not have permission to archive assessments.",
              "error",
            );
            return;
          }

          notifyUser(
            "Failed to archive assessment. Please try again.",
            "error",
          );
          return;
        }

        notifyUser("Assessment archived successfully.", "success");

        if (typeof closeArchiveAssessmentModal === "function") {
          closeArchiveAssessmentModal();
        }

        if (typeof loadAssessments === "function") {
          loadAssessments();
        }
      } catch (err) {
        console.error("Unexpected runtime error:", err);
        notifyUser(
          "Something went wrong while processing your request.",
          "error",
        );
      } finally {
        confirmBtn.disabled = false;
        confirmBtn.textContent = "Archive";
      }
    });
  }

  /* =======================================================
     MODAL CONTROLS (ADD & EDIT)
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

  document
    .getElementById("closeEditAssessmentModal")
    ?.addEventListener("click", closeEditAssessmentModal);

  document
    .getElementById("cancelEditAssessmentModal")
    ?.addEventListener("click", closeEditAssessmentModal);

  // 1. Initial Data Load
  loadAssessments();

  // 2. Delegate Edit and Archive button clicks on the table body
  const tableBody = document.getElementById("assessmentsTableBody");
  if (tableBody && !tableBody.dataset.hasListener) {
    tableBody.dataset.hasListener = "true";

    tableBody.addEventListener("click", (event) => {
      // Handle Edit Click
      const editBtn = event.target.closest(".edit-assessment");
      if (editBtn) {
        const id = editBtn.dataset.id;
        if (typeof openEditAssessmentModal === "function") {
          openEditAssessmentModal(id);
        }
        return;
      }

      // Handle Archive Click
      const archiveBtn = event.target.closest(".archive-assessment");
      if (archiveBtn) {
        const id = archiveBtn.dataset.id;
        const name = archiveBtn.dataset.name;
        if (typeof openArchiveAssessmentModal === "function") {
          openArchiveAssessmentModal(id, name);
        }
      }
    });
  }

  /* =======================================================
     ADD ASSESSMENT FORM SUBMISSION
     ======================================================= */
  const assessmentForm = document.getElementById("assessmentForm");

  if (assessmentForm && !assessmentForm.dataset.hasListener) {
    assessmentForm.dataset.hasListener = "true";

    assessmentForm.addEventListener("submit", async function (event) {
      event.preventDefault();

      const nameInput = document.getElementById("assessmentNameInput");
      const descriptionInput = document.getElementById(
        "assessmentDescriptionInput",
      );
      const marksInput = document.getElementById("assessmentMarksInput");
      const statusInput = document.getElementById("assessmentStatusInput");

      const saveButton =
        event.submitter || assessmentForm.querySelector('[type="submit"]');

      const name = nameInput?.value.trim();
      const description = descriptionInput?.value.trim() || null;
      const rawMarks = marksInput?.value.trim();
      const marks = Number(rawMarks);
      const status = statusInput?.value.trim();

      if (!name)
        return notifyUser("Assessment name is required.", "error", nameInput);
      if (name.length > 100)
        return notifyUser(
          "Assessment name must be 100 characters or less.",
          "error",
          nameInput,
        );
      if (!rawMarks || !Number.isInteger(marks))
        return notifyUser(
          "Maximum marks must be a valid whole number.",
          "error",
          marksInput,
        );
      if (marks <= 0 || marks > 100)
        return notifyUser(
          "Maximum marks must be between 1 and 100.",
          "error",
          marksInput,
        );
      if (!status)
        return notifyUser(
          "Please select an assessment status.",
          "error",
          statusInput,
        );

      const normalizedStatus =
        status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();

      try {
        if (saveButton) {
          saveButton.disabled = true;
          saveButton.textContent = "Saving...";
        }

        const { error } = await supabaseClient
          .from("assessments")
          .insert([
            {
              name: name,
              description: description,
              maximum_marks: marks,
              status: normalizedStatus,
              is_archive: false,
            },
          ])
          .select()
          .single();

        if (error) {
          console.error("Supabase insert error:", error);

          if (error.code === "23505") {
            notifyUser(
              "An assessment with this name already exists.",
              "error",
              nameInput,
            );
            return;
          }
          if (
            error.code === "42501" ||
            error.message?.toLowerCase().includes("permission")
          ) {
            notifyUser(
              "You do not have permission to create an assessment.",
              "error",
            );
            return;
          }
          notifyUser("Failed to create assessment. Please try again.", "error");
          return;
        }

        notifyUser("Assessment created successfully.", "success");
        assessmentForm.reset();

        if (typeof closeAssessmentModal === "function") closeAssessmentModal();
        if (typeof loadAssessments === "function") loadAssessments();
      } catch (error) {
        console.error("Unexpected runtime error:", error);
        notifyUser(
          "Something went wrong while processing your request.",
          "error",
        );
      } finally {
        if (saveButton) {
          saveButton.disabled = false;
          saveButton.textContent = "Save Assessment";
        }
      }
    });
  }

  /* =======================================================
     EDIT ASSESSMENT FORM SUBMISSION
     ======================================================= */
  const editAssessmentForm = document.getElementById("editAssessmentForm");

  if (editAssessmentForm && !editAssessmentForm.dataset.hasListener) {
    editAssessmentForm.dataset.hasListener = "true";

    const nameInput = document.getElementById("editAssessmentNameInput");
    if (nameInput) {
      nameInput.readOnly = true;
      nameInput.classList.add("readonly-input");
    }

    editAssessmentForm.addEventListener("submit", async function (event) {
      event.preventDefault();

      const idInput = document.getElementById("editAssessmentId");
      const descriptionInput = document.getElementById(
        "editAssessmentDescriptionInput",
      );
      const marksInput = document.getElementById("editAssessmentMarksInput");
      const statusInput = document.getElementById("editAssessmentStatusInput");

      const saveButton =
        event.submitter || editAssessmentForm.querySelector('[type="submit"]');

      const assessmentId = idInput?.value.trim();
      const rawMarks = marksInput?.value.trim();
      const marks = Number(rawMarks);
      const status = statusInput?.value.trim();

      if (!assessmentId) {
        return notifyUser("Invalid assessment reference ID.", "error");
      }

      if (!rawMarks || !Number.isInteger(marks)) {
        return notifyUser(
          "Maximum marks must be a valid whole number.",
          "error",
          marksInput,
        );
      }
      if (marks <= 0 || marks > 100) {
        return notifyUser(
          "Maximum marks must be between 1 and 100.",
          "error",
          marksInput,
        );
      }
      if (!status) {
        return notifyUser(
          "Please select an assessment status.",
          "error",
          statusInput,
        );
      }

      const normalizedStatus =
        status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();

      // 1. Prepare inputs & baseline comparisons
      const description = descriptionInput?.value.trim() || null;
      const originalDescription =
        editAssessmentForm.dataset.origDescription || null;

      const baselineDesc =
        originalDescription === "" ? null : originalDescription;
      const originalMarks = Number(editAssessmentForm.dataset.origMarks);
      const originalStatus = editAssessmentForm.dataset.origStatus;

      const hasChanges =
        description !== baselineDesc ||
        marks !== originalMarks ||
        normalizedStatus !== originalStatus;

      if (!hasChanges) {
        notifyUser("No changes detected.", "info");

        return;
      }

      try {
        if (saveButton) {
          saveButton.disabled = true;
          saveButton.textContent = "Updating...";
        }

        const { data, error } = await supabaseClient
          .from("assessments")
          .update({
            description: description,
            maximum_marks: marks,
            status: normalizedStatus,
          })
          .eq("id", assessmentId)
          .select();

        // 1. Check if RLS blocked the update silently (0 rows updated)
        if (!error && (!data || data.length === 0)) {
          notifyUser(
            "You do not have permission to edit this assessment.",
            "error",
          );
          return;
        }

        // 2. Check for explicit permission errors from Supabase
        if (error) {
          console.error("Supabase update error:", error);

          const isPermissionErr =
            error.code === "42501" ||
            error.code === "PGRST301" ||
            error.status === 403 ||
            error.message?.toLowerCase().includes("permission") ||
            error.message
              ?.toLowerCase()
              .includes("violates row-level security");

          if (isPermissionErr) {
            notifyUser(
              "You do not have permission to edit this assessment.",
              "error",
            );
            return;
          }

          notifyUser("Failed to update assessment. Please try again.", "error");
          return;
        }

        notifyUser("Assessment updated successfully.", "success");
        editAssessmentForm.reset();

        if (typeof closeEditAssessmentModal === "function") {
          closeEditAssessmentModal();
        }
        if (typeof loadAssessments === "function") {
          loadAssessments();
        }
      } catch (error) {
        console.error("Unexpected runtime error:", error);
        notifyUser(
          "Something went wrong while processing your request.",
          "error",
        );
      } finally {
        if (saveButton) {
          saveButton.disabled = false;
          saveButton.textContent = "Update Assessment";
        }
      }
    });
  }

  /* =======================================================
     BACKDROP CLICK & ESCAPE KEY CLOSE HANDLERS
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
      if (event.target === modal) {
        modal.classList.remove("active");
        document.body.style.overflow = "";
      }
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;

    modalIds.forEach((id) => {
      const modal = document.getElementById(id);
      if (modal && modal.classList.contains("active")) {
        modal.classList.remove("active");
      }
    });

    document.body.style.overflow = "";
  });

  /* =======================================================
     NAVIGATION
     ======================================================= */
  document
    .getElementById("backAcademicSettingsBtn")
    ?.addEventListener("click", () => {
      window.location.href = "settings.html";
    });
});
