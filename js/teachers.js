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

  // Helper: Convert File to Base64 String
  const convertToBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });

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
        alert("Passwords do not match.");
        return;
      }

      const submitBtn = teacherForm.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = "Saving...";

      try {
        // Collect Input Data
        const inputs = teacherForm.querySelectorAll("input, select, textarea");
        const formData = {};

        // Parse profile photo if selected
        const photoInput = teacherForm.querySelector('input[type="file"]');
        let photoBase64 = null;
        if (photoInput && photoInput.files.length > 0) {
          photoBase64 = await convertToBase64(photoInput.files[0]);
        }

        // Map inputs matching Edge Function payload attributes
        const firstName = teacherForm
          .querySelector('input[placeholder="Enter first name"]')
          .value.trim();
        const lastName = teacherForm
          .querySelector('input[placeholder="Enter last name"]')
          .value.trim();

        const payload = {
          staff_id: teacherForm
            .querySelector('input[placeholder="Enter staff ID"]')
            .value.trim(),
          full_name: `${firstName} ${lastName}`.trim(),
          gender: teacherForm.querySelectorAll("select")[0].value,
          date_of_birth:
            teacherForm.querySelectorAll('input[type="date"]')[0].value,
          department: teacherForm.querySelectorAll("select")[1].value,
          qualification: teacherForm.querySelectorAll("select")[2].value,
          phone_number: teacherForm
            .querySelector('input[type="tel"]')
            .value.trim(),
          email: teacherForm.querySelector('input[type="email"]').value.trim(),
          employment_date:
            teacherForm.querySelectorAll('input[type="date"]')[1].value,
          address: teacherForm.querySelector("textarea").value.trim(),
          status: teacherForm.querySelectorAll("select")[3].value,
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

        if (error || !data.success) {
          throw new Error(
            data?.message || error?.message || "Failed to create teacher.",
          );
        }

        alert("Teacher created successfully!");
        teacherForm.reset();
        hideAddModal();
        loadTeachers();
      } catch (err) {
        console.error("Error creating teacher:", err);
        alert(err.message || "An error occurred.");
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Save Teacher";
      }
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
          department,
          qualification,
          employment_date,
          address,
          date_of_birth,
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
          <td><img src="${profile.photo_url || "images/profile.png"}" class="teacher-photo" alt="Photo" /></td>
          <td>${teacher.staff_id || "N/A"}</td>
          <td>${profile.full_name || "N/A"}</td>
          <td>${teacher.gender || "N/A"}</td>
          <td>${teacher.department || "N/A"}</td>
          <td>${profile.email || "N/A"}</td>
          <td>${profile.phone_number || "N/A"}</td>
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
          <td>${teacher.qualification || "N/A"}</td>
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
    document.getElementById("viewTeacherName").textContent =
      profile.full_name || "N/A";
    document.querySelector(".view-teacher-photo").src =
      profile.photo_url || "images/profile.png";

    const detailsGrid = document.querySelectorAll(".details-item p");
    if (detailsGrid.length >= 9) {
      detailsGrid[0].textContent = teacher.staff_id || "N/A";
      detailsGrid[1].textContent = teacher.gender || "N/A";
      detailsGrid[2].textContent = teacher.date_of_birth || "N/A";
      detailsGrid[3].textContent = teacher.department || "N/A";
      detailsGrid[4].textContent = teacher.qualification || "N/A";
      detailsGrid[5].textContent = profile.phone_number || "N/A";
      detailsGrid[6].textContent = profile.email || "N/A";
      detailsGrid[7].textContent = teacher.employment_date || "N/A";
      detailsGrid[8].textContent = teacher.address || "N/A";
    }

    viewTeacherModal.style.display = "flex";
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
          .update({ status: "retired" })
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
});
