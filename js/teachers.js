const DEFAULT_AVATAR =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128' width='128' height='128'><circle cx='64' cy='64' r='64' fill='%23E4E6EB'/><circle cx='64' cy='46' r='22' fill='%23B0B3B8'/><path d='M24 112c0-22 18-40 40-40s40 18 40 40' fill='%23B0B3B8'/></svg>";

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
    });
  }

  // Close Add Teacher Modal
  const hideAddModal = () => (teacherModal.style.display = "none");
  if (closeTeacherModal)
    closeTeacherModal.addEventListener("click", hideAddModal);
  if (cancelTeacherModal)
    cancelTeacherModal.addEventListener("click", hideAddModal);

  // Close Edit Teacher Modal
  const hideEditModal = () => (editTeacherModal.style.display = "none");
  if (closeEditTeacherModal)
    closeEditTeacherModal.addEventListener("click", hideEditModal);
  if (cancelEditTeacherModal)
    cancelEditTeacherModal.addEventListener("click", hideEditModal);

  // Close View Teacher Modal
  const hideViewModal = () => (viewTeacherModal.style.display = "none");
  if (closeViewTeacherModal)
    closeViewTeacherModal.addEventListener("click", hideViewModal);
  if (closeViewBtn) closeViewBtn.addEventListener("click", hideViewModal);

  // Close Archive Teacher Modal
  const hideArchiveModal = () => (archiveTeacherModal.style.display = "none");
  if (cancelArchive) cancelArchive.addEventListener("click", hideArchiveModal);

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

  async function loadDepartmentDropdown() {
    const { data: departments, error } = await supabaseClient
      .from("departments")
      .select("id, name")
      .eq("status", "active");

    if (error) return;

    const selectEl = document.getElementById("teacherDepartment");
    selectEl.innerHTML = `<option value="">Select Department</option>`;

    departments.forEach((dept) => {
      const option = document.createElement("option");
      option.value = dept.id;
      option.textContent = dept.name;
      selectEl.appendChild(option);
    });
  }

  // ------------------------------------------------------------------
  // 3. Data Fetching & Dynamic Table Rendering
  // ------------------------------------------------------------------

  async function loadTeachers() {
    const tbody = document.querySelector(".teachers-table-card tbody");
    if (!tbody) return;

    try {
      // Query relational data joining profiles and teachers tables
      const { data: teachers, error } = await supabaseClient.from("teachers")
        .select(`
  id,
  staff_id,
  gender,
  qualification,
  address,
  date_of_birth,
  departments:department_id (
    id,
    name
  ),
  profiles:id (
    full_name,
    email,
    phone_number,
    status,
    photo_url
  )
`);

      if (error) throw error;

      tbody.innerHTML = "";

      if (!teachers || teachers.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;">No teachers found.</td></tr>`;
        return;
      }

      teachers.forEach((teacher) => {
        const profile = teacher.profiles || {};
        const tr = document.createElement("tr");

        tr.innerHTML = `
         <td>
  <img 
    src="${profile.photo_url || DEFAULT_AVATAR}" 
    class="teacher-photo" 
    alt="Photo" 
    onerror="this.onerror=null; this.src='${DEFAULT_AVATAR}';" 
  />
</td>
          <td>${teacher.staff_id || "-"}</td>
          <td>${profile.full_name || "-"}</td>
          <td>${teacher.gender || "-"}</td>
          <td>${teacher.departments?.name || "-"}</td>
          <td>${profile.email || "-"}</td>
          <td>${profile.phone_number || "-"}</td>
          <td>${teacher.qualification || "-"}</td>
          <td>
            <span class="teachers-status-${(profile.status || "active").toLowerCase()}">
              ${profile.status || "Active"}
            </span>
          </td>
          <td>
            <button class="teachers-actions-btn view" data-id="${teacher.id}">
              <i class="fa-solid fa-eye"></i>
            </button>
            <button class="teachers-actions-btn edit" data-id="${teacher.id}">
              <i class="fa-solid fa-pen"></i>
            </button>
            <button class="teachers-actions-btn archive" data-id="${teacher.id}">
              <i class="fa-solid fa-box-archive"></i>
            </button>
          </td>
        `;

        // Attach action handlers
        tr.querySelector(".view").addEventListener("click", () =>
          openViewModal(teacher),
        );
        tr.querySelector(".archive").addEventListener("click", () =>
          openArchiveModal(teacher.id),
        );

        tbody.appendChild(tr);
      });
    } catch (err) {
      console.error("Failed to fetch teachers:", err);
    }
  }

  // ------------------------------------------------------------------
  // 4. Action Handlers (View & Archive)
  // ------------------------------------------------------------------

  function openViewModal(teacher) {
    const profile = teacher.profiles || {};

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

    // Display Modal
    const viewTeacherModal = document.getElementById("viewTeacherModal");
    if (viewTeacherModal) {
      viewTeacherModal.style.display = "flex";
    }
  }

  function openArchiveModal(id) {
    selectedTeacherId = id;
    archiveTeacherModal.style.display = "flex";
  }

  if (confirmArchive) {
    confirmArchive.addEventListener("click", async () => {
      if (!selectedTeacherId) return;

      try {
        const { error } = await supabaseClient
          .from("profiles")
          .update({ status: "Inactive" })
          .eq("id", selectedTeacherId);

        if (error) throw error;

        hideArchiveModal();
        loadTeachers();
      } catch (err) {
        console.error("Archive operation failed:", err);
        alert("Failed to archive teacher record.");
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
});

// Helper function to reset form & image preview when modal closes
function resetTeacherForm() {
  if (teacherForm) teacherForm.reset();
  const previewImg = document.getElementById("teacherPhotoPreview");
  if (previewImg) previewImg.src = DEFAULT_AVATAR;
}
