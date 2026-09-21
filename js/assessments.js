

function escapeHTML(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttribute(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatDateTime(isoString) {
  if (!isoString) return "N/A";
  const date = new Date(isoString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

let currentAssessments = [];


async function loadAssessments() {
  const tableBody = document.getElementById("assessmentsTableBody");
  if (!tableBody) return;

  try {
    if (!window.supabaseClient) {
      console.error("Supabase client is not initialized.");
      return;
    }

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

    currentAssessments = data || [];
    renderAssessmentTable(currentAssessments);
  } catch (err) {
    console.error("Error loading assessments:", err);
    if (typeof showToast === "function") {
      showToast("Unexpected error loading assessments.", "error");
    }
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; color: red; padding: 20px;">
          Error loading data.
        </td>
      </tr>
    `;
  }
}


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

  tableBody.innerHTML = assessments
    .map((item) => {
      const isInactive = item.status?.toLowerCase() === "inactive";
      const statusClass = isInactive
        ? "assessment-status-inactive"
        : "assessment-status-active";
      const statusLabel = isInactive ? "Inactive" : "Active";

      const rawName = item.name || "";

      return `
        <tr data-id="${item.id}">
         <td>${escapeHTML(item.name || "-")}</td>
          <td>${escapeHTML(item.description || "—")}</td>
          <td>${escapeHTML(item.maximum_marks ?? "-")}</td>
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

function openAssessmentModal() {
  const modal = document.getElementById("assessmentModal");

  if (!modal) return;

  modal.classList.add("active");
  document.body.style.overflow = "hidden";
}

function closeAssessmentModal() {
  const modal = document.getElementById("assessmentModal");

  if (!modal) return;

  const form = modal.querySelector("form");
  if (form) form.reset();

  modal.classList.remove("active");
  document.body.style.overflow = "";
}

function openEditAssessmentModal(id) {
  const modal = document.getElementById("editAssessmentModal");
  const form = document.getElementById("editAssessmentForm");

  if (!modal || !form || !id) return;

  const assessment = currentAssessments.find(
    (item) => String(item.id) === String(id),
  );
  if (!assessment) return;

  document.getElementById("editAssessmentId").value = assessment.id;
  document.getElementById("editAssessmentNameInput").value =
    assessment.name || "";
  document.getElementById("editAssessmentDescriptionInput").value =
    assessment.description || "";
  document.getElementById("editAssessmentMarksInput").value =
    assessment.maximum_marks;
  document.getElementById("editAssessmentStatusInput").value =
    assessment.status;

  const rawStatus = assessment.status || "";
  const normalizedStatus = rawStatus
    ? rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1).toLowerCase()
    : "";

  form.dataset.origDescription = assessment.description || "";
  form.dataset.origMarks = assessment.maximum_marks;
  form.dataset.origStatus = normalizedStatus;

  modal.dataset.id = id;
  modal.classList.add("active");
  document.body.style.overflow = "hidden";
}

function closeEditAssessmentModal() {
  const modal = document.getElementById("editAssessmentModal");

  if (!modal) return;

  const form = document.getElementById("editAssessmentForm");
  if (form) {
    form.reset();
    delete form.dataset.origDescription;
    delete form.dataset.origMarks;
    delete form.dataset.origStatus;
  }

  modal.classList.remove("active");
  document.body.style.overflow = "";
}

function openArchiveAssessmentModal(id, name) {
  const modal = document.getElementById("archiveAssessmentModal");
  if (!modal || !id) return;

  const nameElement = document.getElementById("archiveAssessmentName");
  if (nameElement) {
    nameElement.textContent = name || "this assessment";
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

document.addEventListener("DOMContentLoaded", () => {
  const notifyUser = (message, type = "error", targetInput = null) => {
    if (typeof showToast === "function") {
      showToast(message, type);
    } else {
      alert(message);
    }
    targetInput?.focus();
  };

  const confirmBtn = document.getElementById("confirmArchiveAssessment");
  const cancelBtn = document.getElementById("cancelArchiveAssessment");
  const archiveModal = document.getElementById("archiveAssessmentModal");

  if (cancelBtn && !cancelBtn.dataset.hasListener) {
    cancelBtn.dataset.hasListener = "true";
    cancelBtn.addEventListener("click", () => {
      if (typeof closeArchiveAssessmentModal === "function")
        closeArchiveAssessmentModal();
    });
  }

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

        if (!error && (!data || data.length === 0)) {
          notifyUser(
            "You do not have permission to archive assessments.",
            "error",
          );
          return;
        }

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

  loadAssessments();

  const tableBody = document.getElementById("assessmentsTableBody");
  if (!tableBody || tableBody.dataset.listenerAttached === "true") return;

  tableBody.dataset.listenerAttached = "true";

  tableBody.addEventListener("click", (e) => {
    const editBtn = event.target.closest(".edit-assessment");
    if (editBtn) {
      const id = editBtn.dataset.id;
      if (typeof openEditAssessmentModal === "function") {
        openEditAssessmentModal(id);
      }
      return;
    }

    const archiveBtn = e.target.closest(".archive-assessment");
    if (archiveBtn) {
      const id = archiveBtn.dataset.id;
      const rawName = archiveBtn.dataset.name || "";

      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = rawName;
      const name = tempDiv.textContent || tempDiv.innerText || "";
      if (id) openArchiveAssessmentModal(id, name);
    }
  });

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

        if (!error && (!data || data.length === 0)) {
          notifyUser(
            "You do not have permission to edit this assessment.",
            "error",
          );
          return;
        }

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

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;

    let modalClosed = false;
    allModalIds.forEach((id) => {
      const modal = document.getElementById(id);
      if (modal && modal.classList.contains("active")) {
        modal.classList.remove("active");
        modalClosed = true;
      }
    });

    if (modalClosed) {
      document.body.style.overflow = "";
    }
  });

  document
    .getElementById("backAcademicSettingsBtn")
    ?.addEventListener("click", () => {
      window.location.href = "settings.html";
    });

  loadCategories();

  document
    .getElementById("addCategoryBtn")
    ?.addEventListener("click", openCategoryModal);

  document
    .getElementById("closeCategoryModal")
    ?.addEventListener("click", closeCategoryModal);

  document
    .getElementById("cancelCategoryModal")
    ?.addEventListener("click", closeCategoryModal);

  const categoryForm = document.getElementById("categoryForm");

  if (categoryForm && !categoryForm.dataset.hasListener) {
    categoryForm.dataset.hasListener = "true";

    categoryForm.addEventListener("submit", async function (event) {
      event.preventDefault();

      const nameInput = document.getElementById("categoryNameInput");
      const marksInput = document.getElementById("categoryMarksInput");
      const statusSelect = document.getElementById("categoryStatusSelect");
      const descriptionInput = document.getElementById(
        "categoryDescriptionsInput",
      );

      const saveButton =
        event.submitter || categoryForm.querySelector('[type="submit"]');

      const name = nameInput?.value.trim();
      const rawMarks = marksInput?.value.trim();
      const marks = Number(rawMarks);
      const status = statusSelect?.value.trim();
      const description = descriptionInput?.value.trim() || null;

      if (!name) {
        return notifyUser("Category name is required.", "error", nameInput);
      }
      if (name.length > 100) {
        return notifyUser(
          "Category name must be 100 characters or less.",
          "error",
          nameInput,
        );
      }
      if (!rawMarks || !Number.isInteger(marks)) {
        return notifyUser(
          "Marks must be a valid whole number.",
          "error",
          marksInput,
        );
      }
      if (marks <= 0 || marks > 100) {
        return notifyUser(
          "Marks must be between 1 and 100.",
          "error",
          marksInput,
        );
      }
      if (!status) {
        return notifyUser("Please select a status.", "error", statusSelect);
      }

      const normalizedStatus =
        status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();

      try {
        if (saveButton) {
          saveButton.disabled = true;
          saveButton.textContent = "Saving...";
        }

        const { error } = await supabaseClient
          .from("assessment_categories")
          .insert([
            {
              name: name,
              marks: marks,
              status: normalizedStatus,
              description: description,
              is_archived: false,
            },
          ])
          .select()
          .single();

        if (error) {
          console.error("Supabase category insert error:", error);

          if (error.code === "23505") {
            notifyUser(
              "A category with this name already exists.",
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
              "You do not have permission to create categories.",
              "error",
            );
            return;
          }

          notifyUser("Failed to create category. Please try again.", "error");
          return;
        }

        notifyUser("Category created successfully.", "success");
        categoryForm.reset();
        closeCategoryModal();
        loadCategories();
      } catch (err) {
        console.error("Unexpected runtime error:", err);
        notifyUser(
          "Something went wrong while processing your request.",
          "error",
        );
      } finally {
        if (saveButton) {
          saveButton.disabled = false;
          saveButton.textContent = "Save Category";
        }
      }
    });
  }

  const allModalIds = [
    "assessmentModal",
    "editAssessmentModal",
    "archiveAssessmentModal",
    "categoryModal",
    "editCategoryModal",
    "archiveCategoryModal",
  ];

  allModalIds.forEach((id) => {
    const modal = document.getElementById(id);
    if (!modal) return;

    modal.addEventListener("click", (event) => {
      if (event.target === modal) {
        modal.classList.remove("active");
        document.body.style.overflow = "";
      }
    });
  });

  const categoriesTableBody = document.getElementById("categoriesTableBody");
  if (categoriesTableBody && !categoriesTableBody.dataset.hasListener) {
    categoriesTableBody.dataset.hasListener = "true";

    categoriesTableBody.addEventListener("click", (event) => {
      const editBtn = event.target.closest(".edit-category");
      if (editBtn) {
        openEditCategoryModal(editBtn.dataset.id);
        return;
      }

      const archiveBtn = event.target.closest(".archive-category");
      if (archiveBtn) {
        openArchiveCategoryModal(
          archiveBtn.dataset.id,
          archiveBtn.dataset.name,
        );
      }
    });
  }

  const editCategoryForm = document.getElementById("editCategoryForm");
  if (editCategoryForm && !editCategoryForm.dataset.hasListener) {
    editCategoryForm.dataset.hasListener = "true";

    editCategoryForm.addEventListener("submit", async function (event) {
      event.preventDefault();

      const idInput = document.getElementById("editCategoryId");
      const marksInput = document.getElementById("editCategoryMarksInput");
      const statusSelect = document.getElementById("editCategoryStatusSelect");
      const descriptionInput = document.getElementById(
        "editCategoryDescriptionInput",
      );

      const saveButton =
        event.submitter || editCategoryForm.querySelector('[type="submit"]');

      const categoryId = idInput?.value.trim();
      const rawMarks = marksInput?.value.trim();
      const marks = Number(rawMarks);
      const status = statusSelect?.value.trim();
      const description = descriptionInput?.value.trim() || null;

      if (!categoryId)
        return notifyUser("Invalid category reference ID.", "error");
      if (!rawMarks || !Number.isInteger(marks))
        return notifyUser(
          "Marks must be a valid whole number.",
          "error",
          marksInput,
        );
      if (marks <= 0 || marks > 100)
        return notifyUser(
          "Marks must be between 1 and 100.",
          "error",
          marksInput,
        );
      if (!status)
        return notifyUser("Please select a status.", "error", statusSelect);

      const normalizedStatus =
        status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();

      const origMarks = Number(editCategoryForm.dataset.origMarks);
      const origStatus = editCategoryForm.dataset.origStatus;
      const origDescription = editCategoryForm.dataset.origDescription || null;
      const baselineDesc = origDescription === "" ? null : origDescription;

      const hasChanges =
        marks !== origMarks ||
        normalizedStatus !== origStatus ||
        description !== baselineDesc;

      if (!hasChanges) {
        return notifyUser("No changes detected.", "info");
      }

      try {
        if (saveButton) {
          saveButton.disabled = true;
          saveButton.textContent = "Updating...";
        }

        const { data, error } = await supabaseClient
          .from("assessment_categories")
          .update({
            marks: marks,
            status: normalizedStatus,
            description: description,
          })
          .eq("id", categoryId)
          .select();

        if (!error && (!data || data.length === 0)) {
          notifyUser(
            "You do not have permission to edit this category.",
            "error",
          );
          return;
        }

        if (error) {
          console.error("Supabase update category error:", error);
          if (
            error.code === "42501" ||
            error.message?.toLowerCase().includes("permission")
          ) {
            notifyUser(
              "You do not have permission to edit this category.",
              "error",
            );
            return;
          }
          notifyUser("Failed to update category. Please try again.", "error");
          return;
        }

        notifyUser("Category updated successfully.", "success");
        closeEditCategoryModal();
        loadCategories();
      } catch (err) {
        console.error("Unexpected runtime error:", err);
        notifyUser(
          "Something went wrong while processing your request.",
          "error",
        );
      } finally {
        if (saveButton) {
          saveButton.disabled = false;
          saveButton.textContent = "Update Category";
        }
      }
    });
  }

  const confirmArchiveBtn = document.getElementById("confirmArchiveCategory");
  const cancelArchiveBtn = document.getElementById("cancelArchiveCategory");
  const archiveCategoryModal = document.getElementById("archiveCategoryModal");

  cancelArchiveBtn?.addEventListener("click", closeArchiveCategoryModal);
  document
    .getElementById("closeEditCategoryModal")
    ?.addEventListener("click", closeEditCategoryModal);
  document
    .getElementById("cancelEditCategoryModal")
    ?.addEventListener("click", closeEditCategoryModal);

  if (confirmArchiveBtn && !confirmArchiveBtn.dataset.hasListener) {
    confirmArchiveBtn.dataset.hasListener = "true";

    confirmArchiveBtn.addEventListener("click", async function () {
      const id = archiveCategoryModal?.dataset.id;
      if (!id) return;

      try {
        confirmArchiveBtn.disabled = true;
        confirmArchiveBtn.textContent = "Archiving...";

        const { data, error } = await supabaseClient
          .from("assessment_categories")
          .update({
            is_archived: true,
            status: "Inactive",
          })
          .eq("id", id)
          .select();

        if (!error && (!data || data.length === 0)) {
          notifyUser(
            "You do not have permission to archive this category.",
            "error",
          );
          return;
        }

        if (error) {
          console.error("Supabase category archive error:", error);
          notifyUser("Failed to archive category. Please try again.", "error");
          return;
        }

        notifyUser("Category archived successfully.", "success");
        closeArchiveCategoryModal();
        loadCategories();
      } catch (err) {
        console.error("Unexpected runtime error:", err);
        notifyUser(
          "Something went wrong while processing your request.",
          "error",
        );
      } finally {
        confirmArchiveBtn.disabled = false;
        confirmArchiveBtn.textContent = "Archive";
      }
    });
  }
});


let currentCategories = [];

async function loadCategories() {
  const tableBody = document.getElementById("categoriesTableBody");
  if (!tableBody) return;

  try {
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 2rem; color: #64748b;">
          <i class="fa-solid fa-spinner fa-spin" style="margin-right: 0.5rem;"></i>
          Loading categories...
        </td>
      </tr>
    `;

    const { data, error } = await supabaseClient
      .from("assessment_categories")
      .select("*")
      .eq("is_archived", false)
      .order("created_at", { ascending: true });

    if (error) {
      if (typeof showToast === "function") {
        showToast("Failed to load categories.", "error");
      }
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; color: red; padding: 20px;">
            Error loading categories data.
          </td>
        </tr>
      `;
      return;
    }

    currentCategories = data || [];
    renderCategoryTable(currentCategories);
  } catch (err) {
    console.error("Unexpected error loading categories:", err);
    if (typeof showToast === "function") {
      showToast("Unexpected error loading categories.", "error");
    }
  }
}


function renderCategoryTable(categories) {
  const tableBody = document.getElementById("categoriesTableBody");
  if (!tableBody) return;

  if (categories.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 20px;">
          No categories found.
        </td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = categories
    .map((item) => {
      const isInactive = item.status?.toLowerCase() === "inactive";
      const statusClass = isInactive
        ? "assessment-status-inactive"
        : "assessment-status-active";
      const statusLabel = isInactive ? "Inactive" : "Active";
      const rawName = item.name || "";

      return `
        <tr data-id="${item.id}">
          <td>${escapeHTML(item.name)}</td>
          <td>${escapeHTML(item.description) || "-"}</td>
          <td>${item.marks}</td>
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
                class="assessment-action-btn assessment-edit-btn edit-category"
                data-id="${item.id}"
                title="Edit Category"
              >
                <i class="fa-solid fa-pen"></i>
              </button>

              <button
                type="button"
                class="assessment-action-btn assessment-archive-btn archive-category"
                data-id="${item.id}"
                data-name="${escapeAttribute(rawName)}"
                title="Archive Category"
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


function openCategoryModal() {
  const modal = document.getElementById("categoryModal");
  if (!modal) return;

  modal.classList.add("active");
  document.body.style.overflow = "hidden";
}

function closeCategoryModal() {
  const modal = document.getElementById("categoryModal");
  if (!modal) return;

  const form = document.getElementById("categoryForm");
  if (form) form.reset();

  modal.classList.remove("active");
  document.body.style.overflow = "";
}


function openEditCategoryModal(id) {
  const modal = document.getElementById("editCategoryModal");
  const form = document.getElementById("editCategoryForm");

  if (!modal || !form || !id) return;

  const category = currentCategories.find(
    (item) => String(item.id) === String(id),
  );
  if (!category) return;

  const nameSelect = document.getElementById("editCategoryNameInput");
  if (nameSelect) {
    nameSelect.value = category.name || "";

    nameSelect.style.pointerEvents = "none";
    nameSelect.tabIndex = -1;
  }

  document.getElementById("editCategoryId").value = category.id;
  document.getElementById("editCategoryMarksInput").value = category.marks;
  document.getElementById("editCategoryStatusSelect").value = category.status;
  document.getElementById("editCategoryDescriptionInput").value =
    category.description || "";

  const rawStatus = category.status || "";
  const normalizedStatus = rawStatus
    ? rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1).toLowerCase()
    : "";

  form.dataset.origMarks = category.marks;
  form.dataset.origStatus = normalizedStatus;
  form.dataset.origDescription = category.description || "";

  modal.dataset.id = id;
  modal.classList.add("active");
  document.body.style.overflow = "hidden";
}

function closeEditCategoryModal() {
  const modal = document.getElementById("editCategoryModal");
  if (!modal) return;

  const nameSelect = document.getElementById("editCategoryNameInput");
  if (nameSelect) nameSelect.disabled = false;

  modal.classList.remove("active");
  document.body.style.overflow = "";
}

function openArchiveCategoryModal(id, name) {
  const modal = document.getElementById("archiveCategoryModal");
  if (!modal || !id) return;

  const nameElement = document.getElementById("archiveCategoryName");
  if (nameElement) {
    nameElement.textContent = name || "this category";
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

