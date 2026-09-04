// Global Constants & State
const DEFAULT_AVATAR =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128' width='128' height='128'><circle cx='64' cy='64' r='64' fill='%23E4E6EB'/><circle cx='64' cy='46' r='22' fill='%23B0B3B8'/><path d='M24 112c0-22 18-40 40-40s40 18 40 40' fill='%23B0B3B8'/></svg>";

let cachedClasses = [];
let cachedAcademicYears = [];

// Helper to determine if a class is eligible for portal access (Grades 10, 11, 12)
function isEligibleClass(classId) {
  const selectedClass = cachedClasses.find((c) => c.id === classId);
  if (!selectedClass) return false;
  const name = selectedClass.name || selectedClass.class_name || "";
  return /(?:10|11|12|Grade\s*(?:10|11|12))/i.test(name);
}

document.addEventListener("DOMContentLoaded", () => {
  // DOM Elements
  const addStudentBtn =
    document.getElementById("addStudent") ||
    document.getElementById("addStudentBtn");
  const studentModal = document.getElementById("studentModal");
  const closeStudentModal = document.getElementById("closeStudentModal");
  const cancelStudentModal = document.getElementById("cancelStudentModal");
  const studentForm = document.getElementById("studentForm");

  const viewStudentModal = document.getElementById("viewStudentModal");
  const closeViewStudentModal = document.getElementById(
    "closeViewStudentModal",
  );
  const closeViewBtn = document.getElementById("closeViewBtn");

  const archiveStudentModal = document.getElementById("archiveStudentModal");
  const cancelArchive = document.getElementById("cancelArchive");

  const editStudentModal = document.getElementById("editStudentModal");
  const closeEditStudentModal = document.getElementById(
    "closeEditStudentModal",
  );
  const cancelEditStudentModal = document.getElementById(
    "cancelEditStudentModal",
  );

  const studentClassSelect = document.getElementById("studentClass");
  const studentAcademicYearSelect = document.getElementById(
    "studentAcademicYear",
  );
  const studentAdmissionDate = document.getElementById("studentAdmissionDate");

  const studentPhotoInput = document.getElementById("studentPhoto");
  const studentPhotoPreview = document.getElementById("studentPhotoPreview");
  const studentPhotoFileName = document.getElementById("studentPhotoFileName");

  // Load static or initial dropdowns on page load
  loadStudentDropdowns();

  // ------------------------------------------------------------------
  // 1. Static Event Listeners for Modals & Action Buttons
  // ------------------------------------------------------------------
  document.querySelectorAll(".edit").forEach((button) => {
    button.addEventListener("click", () => {
      if (editStudentModal) editStudentModal.style.display = "flex";
      if (typeof lockBodyScroll === "function") lockBodyScroll();
    });
  });

  if (closeEditStudentModal) {
    closeEditStudentModal.addEventListener("click", () => {
      if (editStudentModal) editStudentModal.style.display = "none";
      if (typeof unLockBodyScroll === "function") unLockBodyScroll();
    });
  }

  if (cancelEditStudentModal) {
    cancelEditStudentModal.addEventListener("click", () => {
      if (editStudentModal) editStudentModal.style.display = "none";
      if (typeof unLockBodyScroll === "function") unLockBodyScroll();
    });
  }

  document.querySelectorAll(".view").forEach((button) => {
    button.addEventListener("click", () => {
      if (viewStudentModal) viewStudentModal.style.display = "flex";
      if (typeof lockBodyScroll === "function") lockBodyScroll();
    });
  });

  if (closeViewStudentModal) {
    closeViewStudentModal.addEventListener("click", () => {
      if (viewStudentModal) viewStudentModal.style.display = "none";
      if (typeof unLockBodyScroll === "function") unLockBodyScroll();
    });
  }

  if (closeViewBtn) {
    closeViewBtn.addEventListener("click", () => {
      if (viewStudentModal) viewStudentModal.style.display = "none";
      if (typeof unLockBodyScroll === "function") unLockBodyScroll();
    });
  }

  document.querySelectorAll(".archive").forEach((button) => {
    button.addEventListener("click", () => {
      if (archiveStudentModal) archiveStudentModal.style.display = "flex";
      if (typeof lockBodyScroll === "function") lockBodyScroll();
    });
  });

  if (cancelArchive) {
    cancelArchive.addEventListener("click", () => {
      if (archiveStudentModal) archiveStudentModal.style.display = "none";
      if (typeof unLockBodyScroll === "function") unLockBodyScroll();
    });
  }

  // Backdrop click handler for all modals
  window.addEventListener("click", (e) => {
    if (e.target === editStudentModal) {
      editStudentModal.style.display = "none";
      if (typeof unLockBodyScroll === "function") unLockBodyScroll();
    }
    if (e.target === studentModal) {
      hideStudentModal();
    }
    if (e.target === viewStudentModal) {
      viewStudentModal.style.display = "none";
      if (typeof unLockBodyScroll === "function") unLockBodyScroll();
    }
    if (e.target === archiveStudentModal) {
      archiveStudentModal.style.display = "none";
      if (typeof unLockBodyScroll === "function") unLockBodyScroll();
    }
  });

  // ------------------------------------------------------------------
  // 2. Load Dropdowns (Active Classes & Active Academic Years)
  // ------------------------------------------------------------------
  async function loadStudentDropdowns() {
    try {
      // Fetch Active Classes
      const { data: classData, error: classError } = await supabaseClient
        .from("classes")
        .select("id, name, status")
        .eq("status", "active")
        .order("name", { ascending: true });

      if (classError) throw classError;
      cachedClasses = classData || [];

      if (studentClassSelect) {
        studentClassSelect.innerHTML = `<option value="">Select class</option>`;
        cachedClasses.forEach((cls) => {
          const opt = document.createElement("option");
          opt.value = cls.id;
          opt.textContent = cls.name;
          studentClassSelect.appendChild(opt);
        });
      }

      // Fetch Active Academic Years
      const { data: yearData, error: yearError } = await supabaseClient
        .from("academic_years")
        .select("id, year_label, status")
        .eq("status", "Active")
        .order("year_label", { ascending: false });

      if (yearError) throw yearError;
      cachedAcademicYears = yearData || [];

      if (studentAcademicYearSelect) {
        studentAcademicYearSelect.innerHTML = `<option value="">Select academic year</option>`;
        cachedAcademicYears.forEach((yr) => {
          const opt = document.createElement("option");
          opt.value = yr.id;
          // Fixed: mapped yr.year_label instead of non-existent yr.name
          opt.textContent = yr.year_label;
          studentAcademicYearSelect.appendChild(opt);
        });
      }
    } catch (err) {
      console.error("Error loading student dropdowns:", err);
      if (typeof showToast === "function") {
        showToast(
          "Failed to load options for class or academic year.",
          "error",
        );
      }
    }
  }

  // ------------------------------------------------------------------
  // 3. Dynamic Password & Date Visibility Handlers
  // ------------------------------------------------------------------
  function updatePasswordVisibility() {
    const selectedClassId = studentClassSelect ? studentClassSelect.value : "";
    const passwordFields = document.querySelectorAll(
      "#newPassword, #confirmPassword",
    );

    const eligible = isEligibleClass(selectedClassId);

    passwordFields.forEach((field) => {
      const container = field.closest(".form-group");
      if (container) {
        container.style.display = eligible ? "block" : "none";
      }
      if (eligible) {
        field.setAttribute("required", "required");
      } else {
        field.removeAttribute("required");
        field.value = "";
      }
    });
  }

  if (studentClassSelect) {
    studentClassSelect.addEventListener("change", updatePasswordVisibility);
  }

  function setAdmissionDateToToday() {
    if (studentAdmissionDate) {
      const today = new Date().toISOString().split("T")[0];
      studentAdmissionDate.value = today;
    }
  }

  const hideStudentModal = () => {
    if (studentModal) studentModal.style.display = "none";
    if (typeof unLockBodyScroll === "function") unLockBodyScroll();
    if (studentForm) studentForm.reset();

    if (studentPhotoPreview) studentPhotoPreview.src = DEFAULT_AVATAR;
    if (studentPhotoFileName)
      studentPhotoFileName.textContent = "No file chosen";

    updatePasswordVisibility();
  };

  if (addStudentBtn) {
    addStudentBtn.addEventListener("click", async () => {
      await loadStudentDropdowns();
      if (studentForm) studentForm.reset();
      setAdmissionDateToToday();
      updatePasswordVisibility();
      if (studentModal) studentModal.style.display = "flex";
      if (typeof lockBodyScroll === "function") lockBodyScroll();
    });
  }

  if (closeStudentModal)
    closeStudentModal.addEventListener("click", hideStudentModal);
  if (cancelStudentModal)
    cancelStudentModal.addEventListener("click", hideStudentModal);

  // ------------------------------------------------------------------
  // 4. Photo Upload Preview Handler
  // ------------------------------------------------------------------
  if (studentPhotoInput) {
    studentPhotoInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) {
        if (studentPhotoFileName) studentPhotoFileName.textContent = file.name;

        const reader = new FileReader();
        reader.onload = (event) => {
          if (studentPhotoPreview)
            studentPhotoPreview.src = event.target.result;
        };
        reader.readAsDataURL(file);
      } else {
        if (studentPhotoFileName)
          studentPhotoFileName.textContent = "No file chosen";
        if (studentPhotoPreview) studentPhotoPreview.src = DEFAULT_AVATAR;
      }
    });
  }

  // ------------------------------------------------------------------
  // 5. Submit Form
  // ------------------------------------------------------------------
  if (studentForm) {
    studentForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const selectedClassId = studentClassSelect.value;
      const requiresPassword = isEligibleClass(selectedClassId);

      const newPassword = document.getElementById("newPassword").value;
      const confirmPassword = document.getElementById("confirmPassword").value;

      if (requiresPassword) {
        if (!newPassword) {
          if (typeof showToast === "function")
            showToast(
              "Password is required for Grades 10, 11, and 12.",
              "error",
            );
          return;
        }
        if (newPassword !== confirmPassword) {
          if (typeof showToast === "function")
            showToast("Passwords do not match.", "error");
          return;
        }
      }

      const submitBtn = document.getElementById("saveStudentBtn");
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Saving...";
      }

      try {
        let photoBase64 = null;

        if (
          studentPhotoInput &&
          studentPhotoInput.files.length > 0 &&
          typeof compressToBase64 === "function"
        ) {
          photoBase64 = await compressToBase64(
            studentPhotoInput.files[0],
            800,
            0.7,
          );
        }

        const firstName = document
          .getElementById("studentFirstName")
          .value.trim();
        const lastName = document
          .getElementById("studentLastName")
          .value.trim();

        const payload = {
          student_custom_id: document
            .getElementById("studentCustomId")
            .value.trim(),
          email: document.getElementById("studentEmail").value.trim(),
          first_name: firstName,
          last_name: lastName,
          full_name: `${firstName} ${lastName}`.trim(),
          gender: document.getElementById("studentGender").value,
          date_of_birth: document.getElementById("studentDob").value,
          class_id: selectedClassId,
          academic_year_id: document.getElementById("studentAcademicYear")
            .value,
          admission_date: document.getElementById("studentAdmissionDate").value,
          status: document.getElementById("studentStatus").value,
          address: document.getElementById("studentAddress").value.trim(),
          medical_notes: document
            .getElementById("studentMedicalNotes")
            .value.trim(),
          photo: photoBase64,
          role: "student",
          password: requiresPassword ? newPassword : null,
        };

        const { data: sessionData, error: sessionError } =
          await supabaseClient.auth.getSession();
        if (sessionError || !sessionData.session) {
          throw new Error("User session expired. Please log in again.");
        }

        const { data, error } = await supabaseClient.functions.invoke(
          "create-student",
          {
            body: payload,
            headers: {
              Authorization: `Bearer ${sessionData.session.access_token}`,
            },
          },
        );

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
              "Failed to create student.",
          );
        }

        if (data && !data.success) {
          throw new Error(data.message || "Failed to create student.");
        }

        if (typeof showToast === "function")
          showToast("Student created successfully!", "success");
        hideStudentModal();
        if (typeof loadStudents === "function") loadStudents();
      } catch (err) {
        console.error("Error creating student:", err);
        if (typeof showToast === "function")
          showToast(err.message || "An error occurred.", "error");
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "Save student";
        }
      }
    });
  }
});
