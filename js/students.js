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

// Compress file and return compressed Base64 String
function compressToBase64(file, maxWidth = 800, quality = 0.7) {
  return new Promise((resolve, reject) => {
    // Guard against null, undefined, or non-file values
    if (!file || !(file instanceof Blob || file instanceof File)) {
      return resolve(null);
    }

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

        const compressedBase64 = canvas.toDataURL("image/jpeg", quality);
        resolve(compressedBase64);
      };

      img.onerror = (err) => reject(err);
    };

    reader.onerror = (err) => reject(err);
  });
}

// Updated helper: returns a compressed Blob ready for Supabase Storage
function compressImageToBlob(file, maxWidth = 800, quality = 0.7) {
  return new Promise((resolve, reject) => {
    // Guard against null, undefined, or non-file values
    if (!file || !(file instanceof Blob || file instanceof File)) {
      return resolve(null);
    }

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

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error("Canvas encoding failed."));
            }
          },
          "image/jpeg",
          quality,
        );
      };

      img.onerror = (err) => reject(err);
    };

    reader.onerror = (err) => reject(err);
  });
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

  async function loadStudentDropdowns() {
    try {
      const classSelectEl =
        studentClassSelect ||
        document.getElementById("studentClassSelect") ||
        document.getElementById("studentClass");

      // Get current logged in user's profile to retrieve school_id
      const {
        data: { user },
      } = await supabaseClient.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabaseClient
        .from("profiles")
        .select("school_id")
        .eq("id", user.id)
        .single();

      if (!profile || !profile.school_id) return;

      // Query ONLY classes matching the user's school_id
      const { data: classes, error } = await supabaseClient
        .from("classes")
        .select("id, name")
        .eq("school_id", profile.school_id)
        .order("name", { ascending: true });

      if (error) throw error;

      cachedClasses = classes || [];

      if (classSelectEl) {
        classSelectEl.innerHTML = `<option value="">Select class</option>`;
        cachedClasses.forEach((c) => {
          const option = document.createElement("option");
          option.value = c.id;
          option.textContent = c.name;
          classSelectEl.appendChild(option);
        });

        // Sync field visibility as soon as classes load
        updatePasswordVisibility();
      }

      // Fetch Active Academic Years
      const { data: yearData, error: yearError } = await supabaseClient
        .from("academic_years")
        .select("id, year_label, status")
        .eq("status", "Active")
        .order("year_label", { ascending: false });

      if (yearError) throw yearError;
      cachedAcademicYears = yearData || [];

      const yearSelectEl =
        studentAcademicYearSelect ||
        document.getElementById("studentAcademicYear");

      if (yearSelectEl) {
        yearSelectEl.innerHTML = `<option value="">Select academic year</option>`;
        cachedAcademicYears.forEach((yr) => {
          const opt = document.createElement("option");
          opt.value = yr.id;
          opt.textContent = yr.year_label;
          yearSelectEl.appendChild(opt);
        });
      }
    } catch (err) {
      console.error("Error loading student dropdowns:", err);
    }
  }

  // Dynamic Email, Password & Role Visibility Handler
  function updatePasswordVisibility() {
    // Get the current DOM element dynamically every execution
    const classSelectEl =
      studentClassSelect ||
      document.getElementById("studentClassSelect") ||
      document.getElementById("studentClass");

    const selectedClassId = classSelectEl ? classSelectEl.value : "";

    // Check eligibility using cachedClasses lookup
    const eligible =
      typeof isEligibleClass === "function" && isEligibleClass(selectedClassId);

    // Explicitly select form fields
    const emailEl = document.getElementById("studentEmail");
    const passEl = document.getElementById("newPassword");
    const confirmEl = document.getElementById("confirmPassword");
    const roleEl = document.getElementById("studentRole");

    const fields = [emailEl, passEl, confirmEl, roleEl].filter(Boolean);

    fields.forEach((field) => {
      // Find wrapper container (.form-group or parent)
      const container = field.closest(".form-group") || field.parentElement;

      if (eligible) {
        if (container) container.style.display = ""; // Reset inline display to CSS default
        field.setAttribute("required", "required");

        // Restore default role value if empty
        if (field.id === "studentRole" && !field.value) {
          field.value = "student";
        }
      } else {
        if (container) container.style.display = "none";
        field.removeAttribute("required");

        // Reset non-role values when hidden
        if (field.id !== "studentRole") {
          field.value = "";
        }
      }
    });
  }

  // Bind change event using dynamic element lookup
  const classDropdown =
    studentClassSelect ||
    document.getElementById("studentClassSelect") ||
    document.getElementById("studentClass");

  if (classDropdown) {
    classDropdown.addEventListener("change", updatePasswordVisibility);
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

      const classSelectEl =
        studentClassSelect ||
        document.getElementById("studentClassSelect") ||
        document.getElementById("studentClass");
      const selectedClassId = classSelectEl ? classSelectEl.value : "";

      const requiresPassword =
        typeof isEligibleClass === "function" &&
        isEligibleClass(selectedClassId);

      const newPassword = document.getElementById("newPassword")?.value || "";
      const confirmPassword =
        document.getElementById("confirmPassword")?.value || "";

      if (requiresPassword) {
        if (!newPassword) {
          if (typeof showToast === "function") {
            showToast(
              "Password is required for Grades 10, 11, and 12.",
              "error",
            );
          }
          return;
        }
        if (newPassword !== confirmPassword) {
          if (typeof showToast === "function") {
            showToast("Passwords do not match.", "error");
          }
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

        // Input extraction targeting HTML IDs
        const firstName =
          document.getElementById("studentFirstName")?.value.trim() || "";
        const lastName =
          document.getElementById("studentLastName")?.value.trim() || "";
        const studentId =
          document.getElementById("studentCustomId")?.value.trim() ||
          document.getElementById("studentId")?.value.trim() ||
          "";

        const academicYearEl =
          document.getElementById("studentAcademicYear") ||
          document.getElementById("studentAcademicYearSelect");
        const academicYearId = academicYearEl ? academicYearEl.value : "";

        const dob =
          document.getElementById("studentDob")?.value ||
          document.getElementById("studentDateOfBirth")?.value ||
          "";

        const rawStatus =
          document.getElementById("studentStatus")?.value || "Active";
        // Capitalize first letter to match DB Enums ("Active" / "Inactive")
        const statusValue =
          rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1).toLowerCase();

        // Determine portal eligibility
        const isEligible =
          typeof isEligibleClass === "function" &&
          isEligibleClass(selectedClassId);

        const emailInput =
          document.getElementById("studentEmail")?.value.trim() || "";

        const payload = {
          student_id: studentId,
          first_name: firstName,
          last_name: lastName,
          full_name: `${firstName} ${lastName}`.trim(),
          class_id: selectedClassId,
          academic_year_id: academicYearId,
          date_of_birth: dob,
          gender: document.getElementById("studentGender")?.value || "",
          admission_date:
            document.getElementById("studentAdmissionDate")?.value || "",
          status: statusValue,
          address:
            document.getElementById("studentAddress")?.value.trim() || "",
          medical_notes:
            document.getElementById("studentMedicalNotes")?.value.trim() || "",
          photo: photoBase64,
        };

        // Attaching Auth details for eligible grades
        if (isEligible) {
          payload.email = emailInput;
          payload.role = "student";
          payload.password = newPassword;
        }

        console.log("PAYLOAD VERIFICATION:", payload);

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

        if (typeof showToast === "function") {
          showToast("Student created successfully!", "success");
        }
        if (typeof hideStudentModal === "function") hideStudentModal();
        if (typeof loadStudents === "function") loadStudents();
      } catch (err) {
        console.error("Error creating student:", err);
        if (typeof showToast === "function") {
          showToast(err.message || "An error occurred.", "error");
        }
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "Save student";
        }
      }
    });
  }
});

async function loadStudentsTable() {
  const tableBody = document.getElementById("studentsTableBody");
  if (!tableBody) return;

  // Render loading state
  tableBody.innerHTML = `
    <tr>
      <td colspan="7" style="text-align: center; padding: 20px;">
        Loading students...
      </td>
    </tr>
  `;

  try {
    // Fetch students with joined profile and class data
    const { data: students, error } = await supabaseClient
      .from("students")
      .select(
        `
        id,
        student_id,
        gender,
        profiles!inner (
          full_name,
          photo_url,
          status
        ),
        classes (
          name
        )
      `,
      )
      .order("created_at", { ascending: false });

    if (error) throw error;

    if (!students || students.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 20px;">
            No students found.
          </td>
        </tr>
      `;
      return;
    }

    // Build table rows
    tableBody.innerHTML = students
      .map((student) => {
        const profile = student.profiles || {};
        const className = student.classes?.name || "N/A";
        const photoSrc = profile.photo_url || "images/profile.png";
        const status = (profile.status || "active").toLowerCase();
        const statusClass =
          status === "active"
            ? "students-status-active"
            : "students-status-inactive";

        return `
        <tr>
          <td>
            <img 
              src="${photoSrc}" 
              class="student-photo" 
              alt="${profile.full_name || "Student"}" 
              onerror="this.src='images/profile.png'"
            />
          </td>
          <td>${student.student_id || "N/A"}</td>
          <td>${profile.full_name || "N/A"}</td>
          <td>${student.gender || "N/A"}</td>
          <td>${className}</td>
          <td>
            <span class="${statusClass}">${status.charAt(0).toUpperCase() + status.slice(1)}</span>
          </td>
          <td>
            <button class="students-actions-btn view" onclick="viewStudent('${student.id}')">
              <i class="fa-solid fa-eye"></i>
            </button>
            <button class="students-actions-btn edit" onclick="editStudent('${student.id}')">
              <i class="fa-solid fa-pen"></i>
            </button>
            <button class="students-actions-btn archive" onclick="archiveStudent('${student.id}')">
              <i class="fa-solid fa-box-archive"></i>
            </button>
          </td>
        </tr>
      `;
      })
      .join("");
  } catch (err) {
    console.error("Error fetching students:", err);
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; color: red; padding: 20px;">
          Failed to load students: ${err.message}
        </td>
      </tr>
    `;
  }
}

// Call function on page load
document.addEventListener("DOMContentLoaded", () => {
  loadStudentsTable();
});
