const DEFAULT_AVATAR =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128' width='128' height='128'><circle cx='64' cy='64' r='64' fill='%23E4E6EB'/><circle cx='64' cy='46' r='22' fill='%23B0B3B8'/><path d='M24 112c0-22 18-40 40-40s40 18 40 40' fill='%23B0B3B8'/></svg>";
let cachedDepartments = [];

async function loadDepartmentDropdown(selectId = "teacherDepartment") {
  const selectEl = document.getElementById(selectId);
  if (!selectEl) return;

  // Use cached data if available
  if (cachedDepartments.length === 0) {
    const { data: departments, error } = await supabaseClient
      .from("departments")
      .select("id, name")
      .eq("status", "active");

    if (error) return;
    cachedDepartments = departments || [];
  }

  selectEl.innerHTML = `<option value="">Select Department</option>`;
  cachedDepartments.forEach((dept) => {
    const option = document.createElement("option");
    option.value = dept.id;
    option.textContent = dept.name;
    selectEl.appendChild(option);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  // DOM Elements
  const addTeacherBtn = document.getElementById("addTeacher");
  const teacherModal = document.getElementById("teacherModal");
  const closeTeacherModal = document.getElementById("closeTeacherModal");
  const cancelTeacherModal = document.getElementById("cancelTeacherModal");
  const teacherForm = document.getElementById("teacherForm");

  const editTeacherModal = document.getElementById("editTeacherModal");
  const closeEditTeacherModal = document.getElementById(
    "closeEditTeacherModal",
  );
  const cancelEditTeacherModal = document.getElementById(
    "cancelEditTeacherModal",
  );

  const viewTeacherModal = document.getElementById("viewTeacherModal");
  const closeViewTeacherModal = document.getElementById(
    "closeViewTeacherModal",
  );
  const closeViewBtn = document.getElementById("closeViewBtn");

  const archiveTeacherModal = document.getElementById("archiveTeacherModal");
  const cancelArchive = document.getElementById("cancelArchive");
  const confirmArchive = document.getElementById("confirmArchive");

  const menuToggle = document.getElementById("menuToggle");
  const sidebarOverlay = document.getElementById("sidebarOverlay");
  const sidebar = document.querySelector(".sidebar");

  let selectedTeacherId = null;

  // ------------------------------------------------------------------
  // 1. Navigation & Modal Controls
  // ------------------------------------------------------------------

  // Mobile Menu Toggle
  if (menuToggle && sidebarOverlay && sidebar) {
    menuToggle.addEventListener("click", () => {
      sidebar.classList.toggle("open");
      sidebarOverlay.classList.toggle("active");
    });

    sidebarOverlay.addEventListener("click", () => {
      sidebar.classList.remove("open");
      sidebarOverlay.classList.remove("active");
    });
  }

  // Open Add Teacher Modal
  if (addTeacherBtn) {
    addTeacherBtn.addEventListener("click", () => {
      // 1. Populate active departments into <select>
      loadDepartmentDropdown();
      teacherForm.reset();
      teacherModal.style.display = "flex";
      lockBodyScroll();
    });
  }

  // Close Add Teacher Modal
  const hideAddModal = () => {
    teacherModal.style.display = "none";
    unLockBodyScroll();
  };
  if (closeTeacherModal)
    closeTeacherModal.addEventListener("click", hideAddModal);
  if (cancelTeacherModal)
    cancelTeacherModal.addEventListener("click", hideAddModal);

  // Close View Teacher Modal
  const hideViewModal = () => {
    viewTeacherModal.style.display = "none";
    unLockBodyScroll();
  };
  if (closeViewTeacherModal)
    closeViewTeacherModal.addEventListener("click", hideViewModal);
  if (closeViewBtn) closeViewBtn.addEventListener("click", hideViewModal);

  // Compress file and return compressed Base64 String
  function compressToBase64(file, maxWidth = 800, quality = 0.7) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);

      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;

        img.onload = () => {
          let width = img.width;
          let height = img.height;

          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);

          // Convert canvas output directly to JPEG Base64
          const compressedBase64 = canvas.toDataURL("image/jpeg", quality);
          resolve(compressedBase64);
        };

        img.onerror = (err) => reject(err);
      };

      reader.onerror = (err) => reject(err);
    });
  }

  // Global helper function for toggling password visibility inline
  window.togglePassword = function (inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const isPassword = input.type === "password";
    input.type = isPassword ? "text" : "password";
  };
  // ------------------------------------------------------------------
  // 2. Submit Add Teacher Form (Invoking Edge Function)
  // ------------------------------------------------------------------

  if (teacherForm) {
    teacherForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const newPassword = document.getElementById("newPassword").value;
      const confirmPassword = document.getElementById("confirmPassword").value;

      if (newPassword !== confirmPassword) {
        showToast("Passwords do not match.", "error");
        return;
      }

      const submitBtn = teacherForm.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = "Saving...";

      try {
        const photoInput = document.getElementById("teacherPhoto");
        let photoBase64 = null;

        if (photoInput && photoInput.files.length > 0) {
          // Compresses image to max width 800px at 70% JPEG quality
          photoBase64 = await compressToBase64(photoInput.files[0], 800, 0.7);
        }

        // Read values directly using specific IDs
        const firstName = document
          .getElementById("teacherFirstName")
          .value.trim();
        const lastName = document
          .getElementById("teacherLastName")
          .value.trim();

        const payload = {
          staff_id: document.getElementById("teacherStaffId").value.trim(),
          full_name: `${firstName} ${lastName}`.trim(),
          gender: document.getElementById("teacherGender").value,
          date_of_birth: document.getElementById("teacherDob").value,
          department_id: document.getElementById("teacherDepartment").value,
          qualification: document.getElementById("teacherQualification").value,
          phone_number: document.getElementById("teacherPhone").value.trim(),
          email: document.getElementById("teacherEmail").value.trim(),
          address: document.getElementById("teacherAddress").value.trim(),
          status: document.getElementById("teacherStatus").value,
          photo: photoBase64,
          password: newPassword,
        };

        // Get Session JWT token for authentication
        const { data: sessionData, error: sessionError } =
          await supabaseClient.auth.getSession();
        if (sessionError || !sessionData.session) {
          throw new Error("User session expired. Please log in again.");
        }

        // Invoke Edge Function
        const { data, error } = await supabaseClient.functions.invoke(
          "create-teacher",
          {
            body: payload,
            headers: {
              Authorization: `Bearer ${sessionData.session.access_token}`,
            },
          },
        );

        // Extract custom error message from Edge Function non-2xx response
        if (error) {
          let serverMessage = null;
          if (error.context) {
            try {
              const bodyText = await error.context.text();
              const jsonBody = JSON.parse(bodyText);
              serverMessage = jsonBody.message;
            } catch (e) {
              console.error("Failed to parse error body:", e);
            }
          }
          throw new Error(
            serverMessage ||
              data?.message ||
              error.message ||
              "Failed to create teacher.",
          );
        }

        if (data && !data.success) {
          throw new Error(data.message || "Failed to create teacher.");
        }

        showToast("Teacher created successfully!", "success");
        teacherForm.reset();
        hideAddModal();
        loadTeachers();
      } catch (err) {
        console.error("Error creating teacher:", err);
        showToast(err.message || "An error occurred.", "error");
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Save Teacher";
      }
    });
  }

  // Initial Data Fetch
  loadTeachers();
  loadDepartmentDropdown();
});

document.addEventListener("DOMContentLoaded", () => {
  const teacherPhotoInput = document.getElementById("teacherPhoto");
  const teacherPhotoPreview = document.getElementById("teacherPhotoPreview");
  const teacherPhotoFileName = document.getElementById("teacherPhotoFileName");

  if (teacherPhotoInput) {
    teacherPhotoInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) {
        if (teacherPhotoFileName) {
          teacherPhotoFileName.textContent = file.name;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
          if (teacherPhotoPreview) {
            teacherPhotoPreview.src = event.target.result;
          }
        };
        reader.readAsDataURL(file);
      } else {
        if (teacherPhotoFileName) {
          teacherPhotoFileName.textContent = "No file chosen";
        }
        if (teacherPhotoPreview) {
          teacherPhotoPreview.src = DEFAULT_AVATAR;
        }
      }
    });
  }

  // Close modals when clicking directly on the backdrop/overlay
  [
    teacherModal,
    editTeacherModal,
    viewTeacherModal,
    archiveTeacherModal,
  ].forEach((modal) => {
    if (!modal) return;
    modal.addEventListener("click", (e) => {
      // Only close if the click occurred directly on the backdrop overlay, not inside the modal content box
      if (e.target === modal) {
        modal.style.display = "none";
        unLockBodyScroll();
      }
    });
  });
});

// ------------------------------------------------------------------
// 4. Action Handlers (View & Archive)
// ------------------------------------------------------------------
function openViewModal(teacher) {
  const profile = teacher.profiles || {};

  // Helper function to format ISO timestamps into readable strings
  const formatDate = (dateString) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Profile Header Elements
  document.getElementById("viewTeacherName").textContent =
    profile.full_name || "-";
  const photoEl = document.getElementById("viewTeacherPhoto");
  photoEl.src = profile.photo_url || DEFAULT_AVATAR;
  photoEl.onerror = function () {
    this.onerror = null;
    this.src = DEFAULT_AVATAR;
  };

  // Status Badge Handling
  const statusElement = document.getElementById("viewTeacherStatus");
  const currentStatus = profile.status || teacher.status || "Active";
  statusElement.textContent = currentStatus;
  statusElement.className = `view-teacher-status ${currentStatus.toLowerCase()}`;

  // Grid Details Elements
  document.getElementById("viewTeacherStaffId").textContent =
    teacher.staff_id || "-";
  document.getElementById("viewTeacherGender").textContent =
    teacher.gender || "-";
  document.getElementById("viewTeacherDob").textContent =
    teacher.date_of_birth || "-";
  document.getElementById("viewTeacherDepartment").textContent =
    teacher.departments?.name || teacher.department || "-";
  document.getElementById("viewTeacherQualification").textContent =
    teacher.qualification || "-";
  document.getElementById("viewTeacherPhone").textContent =
    profile.phone_number || "-";
  document.getElementById("viewTeacherEmail").textContent =
    profile.email || "-";
  document.getElementById("viewTeacherAddress").textContent =
    teacher.address || "-";

  // Created At and Updated At Timestamps
  document.getElementById("viewTeacherCreatedAt").textContent = formatDate(
    teacher.created_at || profile.created_at,
  );
  document.getElementById("viewTeacherUpdatedAt").textContent = formatDate(
    teacher.updated_at || profile.updated_at,
  );

  // Display Modal
  const viewTeacherModal = document.getElementById("viewTeacherModal");
  if (viewTeacherModal) {
    viewTeacherModal.style.display = "flex";
    lockBodyScroll();
  }
}

// Close Archive Teacher Modal
const hideArchiveModal = () => {
  const archiveTeacherModal = document.getElementById("archiveTeacherModal");
  if (archiveTeacherModal) {
    archiveTeacherModal.style.display = "none";
  }
  unLockBodyScroll();
};

const cancelArchive = document.getElementById("cancelArchive");
if (cancelArchive) {
  cancelArchive.addEventListener("click", hideArchiveModal);
}

function openArchiveModal(id, teacherName = "this teacher") {
  selectedTeacherId = id;

  const nameElement = document.getElementById("archiveTeacherName");
  if (nameElement) {
    nameElement.textContent = teacherName;
  }

  const archiveTeacherModal = document.getElementById("archiveTeacherModal");
  if (archiveTeacherModal) {
    archiveTeacherModal.style.display = "flex";
    lockBodyScroll();
  }
}

const confirmArchive = document.getElementById("confirmArchive");
if (confirmArchive) {
  confirmArchive.addEventListener("click", async () => {
    if (!selectedTeacherId) {
      showToast("No teacher selected for archiving.", "error");
      return;
    }

    confirmArchive.disabled = true;
    confirmArchive.textContent = "Archiving...";

    try {
      // 1. Mark teacher as archived in `teachers` table
      const { error: teacherErr } = await supabaseClient
        .from("teachers")
        .update({
          is_archived: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedTeacherId);

      if (teacherErr) throw teacherErr;

      // 2. Mark profile as archived and set status to inactive
      const { error: profileErr } = await supabaseClient
        .from("profiles")
        .update({
          status: "inactive",
          is_archived: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedTeacherId);

      if (profileErr) throw profileErr;

      showToast("Teacher archived successfully!", "success");
      hideArchiveModal();
      loadTeachers();
    } catch (err) {
      console.error("Archive operation failed:", err);
      showToast(err.message || "Failed to archive teacher record.", "error");
    } finally {
      confirmArchive.disabled = false;
      confirmArchive.textContent = "Archive";
    }
  });
}

// Helper function to reset form & image preview when modal closes
function resetTeacherForm() {
  if (teacherForm) teacherForm.reset();
  const previewImg = document.getElementById("teacherPhotoPreview");
  if (previewImg) previewImg.src = DEFAULT_AVATAR;
}

// File Upload Preview Listener
const editPhotoInput = document.getElementById("editTeacherPhoto");
if (editPhotoInput) {
  editPhotoInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      document.getElementById("editTeacherPhotoFileName").textContent =
        file.name;
      const reader = new FileReader();
      reader.onload = (event) => {
        document.getElementById("editTeacherPhotoPreview").src =
          event.target.result;
      };
      reader.readAsDataURL(file);
    }
  });
}

// Close Edit Teacher Modal
const hideEditModal = () => {
  editTeacherModal.style.display = "none";
  unLockBodyScroll();
};
if (closeEditTeacherModal)
  closeEditTeacherModal.addEventListener("click", hideEditModal);
if (cancelEditTeacherModal)
  cancelEditTeacherModal.addEventListener("click", hideEditModal);

let originalTeacherData = null;

async function openEditModal(teacher) {
  // Resolve ID across potential schema variants (prefers teacher.id, falls back to profile.id)
  const resolvedId = teacher.id || teacher.profiles?.id;
  selectedTeacherId = resolvedId;

  // Set the dataset attribute on the form element
  const editForm = document.getElementById("editTeacherForm");
  if (editForm) {
    editForm.dataset.teacherId = resolvedId;
  }

  const profile = teacher.profiles || {};

  // Populate Department dropdown with active departments
  await loadDepartmentDropdown("editTeacherDepartment");

  // Parse Name Split
  const fullNameParts = (profile.full_name || "").trim().split(" ");
  const firstName = fullNameParts[0] || "";
  const lastName = fullNameParts.slice(1).join(" ") || "";

  // Assign Field Values
  document.getElementById("editTeacherStaffId").value = teacher.staff_id || "";
  document.getElementById("editTeacherFirstName").value = firstName;
  document.getElementById("editTeacherLastName").value = lastName;
  document.getElementById("editTeacherGender").value = teacher.gender || "";
  document.getElementById("editTeacherDob").value = teacher.date_of_birth || "";

  // Extract Department ID
  let deptId = teacher.department_id || "";
  if (!deptId && teacher.departments) {
    if (Array.isArray(teacher.departments) && teacher.departments.length > 0) {
      deptId = teacher.departments[0].id;
    } else if (typeof teacher.departments === "object") {
      deptId = teacher.departments.id;
    }
  }

  document.getElementById("editTeacherDepartment").value = deptId || "";
  document.getElementById("editTeacherQualification").value =
    teacher.qualification || "";
  document.getElementById("editTeacherPhone").value =
    profile.phone_number || "";

  // Normalize Status value matching
  const statusValue = profile.status || teacher.status || "Active";
  const statusSelect = document.getElementById("editTeacherStatus");
  statusSelect.value =
    statusValue.charAt(0).toUpperCase() + statusValue.slice(1).toLowerCase();

  document.getElementById("editTeacherAddress").value = teacher.address || "";

  // Set Photo Preview
  const previewImg = document.getElementById("editTeacherPhotoPreview");
  if (previewImg) {
    previewImg.src = profile.photo_url || DEFAULT_AVATAR;
  }
  const photoFileNameEl = document.getElementById("editTeacherPhotoFileName");
  if (photoFileNameEl) {
    photoFileNameEl.textContent = "No new file chosen";
  }
  const photoInput = document.getElementById("editTeacherPhoto");
  if (photoInput) {
    photoInput.value = "";
  }

  // Store Baseline State for Change Detection
  originalTeacherData = {
    firstName,
    lastName,
    gender: teacher.gender || "",
    date_of_birth: teacher.date_of_birth || "",
    department_id: deptId,
    qualification: teacher.qualification || "",
    phone_number: profile.phone_number || "",
    status: statusSelect.value,
    address: teacher.address || "",
    photo_url: profile.photo_url || "",
  };

  // Display Edit Modal
  const editTeacherModal = document.getElementById("editTeacherModal");
  if (editTeacherModal) {
    editTeacherModal.style.display = "flex";
    lockBodyScroll();
  }
}

// Edit Form Submit Listener
const editTeacherForm = document.getElementById("editTeacherForm");
if (editTeacherForm) {
  editTeacherForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const teacherId = editTeacherForm.dataset.teacherId || selectedTeacherId;

    if (!teacherId) {
      showToast("Invalid teacher selection.", "error");
      return;
    }

    const submitBtn = editTeacherForm.querySelector('button[type="submit"]');

    try {
      const firstName = document
        .getElementById("editTeacherFirstName")
        .value.trim();
      const lastName = document
        .getElementById("editTeacherLastName")
        .value.trim();
      const photoInput = document.getElementById("editTeacherPhoto");

      let photoBase64 = null;
      if (photoInput && photoInput.files.length > 0) {
        // Compress image using the same configuration as the create handler
        photoBase64 = await compressToBase64(photoInput.files[0], 800, 0.7);
      }

      // Collect current form input state
      const currentValues = {
        firstName,
        lastName,
        gender: document.getElementById("editTeacherGender").value,
        date_of_birth: document.getElementById("editTeacherDob").value,
        department_id: document.getElementById("editTeacherDepartment").value,
        qualification: document.getElementById("editTeacherQualification")
          .value,
        phone_number: document.getElementById("editTeacherPhone").value.trim(),
        status: document.getElementById("editTeacherStatus").value,
        address: document.getElementById("editTeacherAddress").value.trim(),
      };

      // Detect if user made any modified inputs or provided a new image
      const hasPhotoChanged = photoBase64 !== null;
      const hasDataChanged =
        originalTeacherData &&
        Object.keys(currentValues).some(
          (key) => currentValues[key] !== originalTeacherData[key],
        );

      if (!hasDataChanged && !hasPhotoChanged) {
        showToast("No changes detected.", "info");
        hideEditModal();
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = "Updating...";

      // Construct Payload aligned with backend conventions
      const payload = {
        teacher_id: teacherId,
        full_name: `${firstName} ${lastName}`.trim(),
        gender: currentValues.gender,
        date_of_birth: currentValues.date_of_birth,
        department_id: currentValues.department_id || null,
        qualification: currentValues.qualification,
        phone_number: currentValues.phone_number,
        status: currentValues.status,
        address: currentValues.address,
        photo: photoBase64,
      };

      // Retrieve Session JWT Token for Auth Header
      const { data: sessionData, error: sessionError } =
        await supabaseClient.auth.getSession();

      if (sessionError || !sessionData.session) {
        throw new Error("Session expired. Please log in again.");
      }

      // Invoke 'update-teacher' Edge Function
      const { data, error } = await supabaseClient.functions.invoke(
        "update-teacher",
        {
          body: payload,
          headers: {
            Authorization: `Bearer ${sessionData.session.access_token}`,
          },
        },
      );

      // Extract custom server response error messages
      if (error) {
        let serverMessage = null;
        if (error.context) {
          try {
            const bodyText = await error.context.text();
            const jsonBody = JSON.parse(bodyText);
            serverMessage = jsonBody.message;
          } catch (e) {
            console.error("Failed to parse edit error body:", e);
          }
        }
        throw new Error(
          serverMessage ||
            data?.message ||
            error.message ||
            "Failed to update teacher.",
        );
      }

      if (data && !data.success) {
        throw new Error(data.message || "Failed to update teacher.");
      }

      showToast("Teacher updated successfully!", "success");
      hideEditModal();
      loadTeachers();
    } catch (err) {
      console.error("Error updating teacher:", err);
      showToast(err.message || "An error occurred during update.", "error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Update Teacher";
    }
  });
}

// ------------------------------------------------------------------
// 3. Data Fetching & Dynamic Table Rendering
// ------------------------------------------------------------------

let currentTeachersList = [];

async function loadTeachers() {
  const tbody = document.querySelector(".teachers-table-card tbody");
  if (!tbody) return;

  // Render spinner instantly
  renderTeachersTableLoading();

  try {
    const { data: teachers, error } = await supabaseClient
      .from("teachers")
      .select(
        `
    id, staff_id, gender, qualification, address, date_of_birth, created_at, updated_at, is_archived,
    departments:department_id ( id, name ),
    profiles:id ( full_name, email, phone_number, status, photo_url )
  `,
      )
      .eq("is_archived", false);
    if (error) throw error;

    currentTeachersList = teachers || [];

    if (currentTeachersList.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;">No teachers found.</td></tr>`;
      return;
    }

    // Yield execution so spinner renders smoothly before heavy table insertion
    setTimeout(() => {
      const rowsHtml = currentTeachersList
        .map((teacher) => {
          const profile = teacher.profiles || {};
          return `
          <tr>
            <td>
              <img 
                src="${profile.photo_url || DEFAULT_AVATAR}" 
                class="teacher-photo" 
                alt="Photo" 
                loading="lazy" 
                onerror="this.onerror=null; this.src='${DEFAULT_AVATAR}';" 
              />
            </td>
            <td>${teacher.staff_id || "-"}</td>
            <td>${profile.full_name || "-"}</td>
            <td>${teacher.gender || "-"}</td>
            <td>${profile.email || "-"}</td>
            <td>
              <span class="teachers-status-${(profile.status || "active").toLowerCase()}">
                ${profile.status || "Active"}
              </span>
            </td>
            <td>
              <button class="teachers-actions-btn view" data-id="${teacher.id}"><i class="fa-solid fa-eye"></i></button>
              <button class="teachers-actions-btn edit" data-id="${teacher.id}"><i class="fa-solid fa-pen"></i></button>
            <button class="teachers-actions-btn archive" data-id="${teacher.id}" data-name="${teacher.profiles?.full_name || "this teacher"}">
  <i class="fa-solid fa-box-archive"></i>
</button>
            </td>
          </tr>`;
        })
        .join("");

      tbody.innerHTML = rowsHtml;
    }, 50);
  } catch (err) {
    console.error("Failed to fetch teachers:", err);
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color: #ef4444;">Failed to load teachers.</td></tr>`;
  }
}

// Event Delegation for Table Actions
document
  .querySelector(".teachers-table-card tbody")
  ?.addEventListener("click", (e) => {
    const btn = e.target.closest(".teachers-actions-btn");
    if (!btn) return;

    const teacherId = btn.dataset.id;
    const teacher = currentTeachersList.find((t) => t.id === teacherId);
    if (!teacher) return;

    if (btn.classList.contains("view")) openViewModal(teacher);
    else if (btn.classList.contains("edit")) openEditModal(teacher);
    else if (btn.classList.contains("archive")) openArchiveModal(teacherId);
  });

document.addEventListener("click", (e) => {
  const archiveBtn = e.target.closest(".teachers-actions-btn.archive");
  if (archiveBtn) {
    const id = archiveBtn.dataset.id;
    const name = archiveBtn.dataset.name;
    openArchiveModal(id, name);
  }
});

// Helper function to render loading state in the teachers table
function renderTeachersTableLoading() {
  const tbody = document.querySelector(".teachers-table-card tbody");
  if (!tbody) return;

  tbody.innerHTML = `
    <tr>
      <td colspan="7" style="text-align: center; padding: 2rem; color: #64748b;">
        <i class="fa-solid fa-spinner fa-spin" style="margin-right: 0.5rem;"></i>
        Loading teachers...
      </td>
    </tr>
  `;
}
