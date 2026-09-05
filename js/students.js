// Global Constants & State
const DEFAULT_AVATAR =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128' width='128' height='128'><circle cx='64' cy='64' r='64' fill='%23E4E6EB'/><circle cx='64' cy='46' r='22' fill='%23B0B3B8'/><path d='M24 112c0-22 18-40 40-40s40 18 40 40' fill='%23B0B3B8'/></svg>";

/**
 * Renders an array of student objects into the DOM table
 */
function renderStudentsTable(studentsToRender) {
  const tableBody = document.getElementById("studentsTableBody");
  if (!tableBody) return;

  if (!studentsToRender || studentsToRender.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 20px; color: #64748b;">
          No students found matching the criteria.
        </td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = studentsToRender
    .map((student) => {
      const profile = student.profiles || {};
      const className = student.classes?.name || "N/A";
      const photoSrc = profile.photo_url ? profile.photo_url : DEFAULT_AVATAR;
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
            onerror="this.onerror=null; this.src='${DEFAULT_AVATAR}';"
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
}

function populateClassFilterDropdown() {
  const classFilterSelect = document.getElementById("studentClassFilter");
  if (!classFilterSelect) return;

  const currentSelection = classFilterSelect.value;
  classFilterSelect.innerHTML = '<option value="">All Classes</option>';

  const students = window.allStudentsCache || [];
  const uniqueClasses = new Set();

  students.forEach((student) => {
    if (student.classes && student.classes.name) {
      uniqueClasses.add(student.classes.name);
    }
  });

  // Sort class names alphabetically
  const sortedClasses = Array.from(uniqueClasses).sort((a, b) =>
    a.localeCompare(b),
  );

  sortedClasses.forEach((className) => {
    const option = document.createElement("option");
    option.value = className;
    option.textContent = className;
    classFilterSelect.appendChild(option);
  });

  if (uniqueClasses.has(currentSelection)) {
    classFilterSelect.value = currentSelection;
  }
}

/**
 * Filters the students based on search input, class selection, and status selection
 */
function filterStudents() {
  const searchVal = (document.getElementById("studentSearchInput")?.value || "")
    .trim()
    .toLowerCase();
  const selectedClassName =
    document.getElementById("studentClassFilter")?.value || "";
  const selectedStatus = (
    document.getElementById("studentStatusFilter")?.value || ""
  )
    .trim()
    .toLowerCase();

  const students = window.allStudentsCache || [];

  const filtered = students.filter((student) => {
    const profile = student.profiles || {};
    const fullName = (profile.full_name || "").toLowerCase();
    const studentCustomId = (student.student_id || "").toLowerCase();

    // 1. Search Query Match (Name or Student Custom ID)
    const matchesSearch =
      !searchVal ||
      fullName.includes(searchVal) ||
      studentCustomId.includes(searchVal);

    // 2. Class Filter Match
    const studentClassName = student.classes?.name || "";
    const matchesClass =
      !selectedClassName || studentClassName === selectedClassName;

    // 3. Status Filter Match
    const studentStatus = (profile.status || "active").toLowerCase();
    const matchesStatus = !selectedStatus || studentStatus === selectedStatus;

    return matchesSearch && matchesClass && matchesStatus;
  });

  // Render the filtered subset
  renderStudentsTable(filtered);
}
// Attach event listeners to toolbar inputs
document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("studentSearchInput");
  const classFilter = document.getElementById("studentClassFilter");
  const statusFilter = document.getElementById("studentStatusFilter");

  if (searchInput) searchInput.addEventListener("input", filterStudents);
  if (classFilter) classFilter.addEventListener("change", filterStudents);
  if (statusFilter) statusFilter.addEventListener("change", filterStudents);
});

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
        .eq("status", "active")
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
    const phoneEl = document.getElementById("studentPhone");

    const fields = [emailEl, passEl, confirmEl, roleEl, phoneEl].filter(
      Boolean,
    );

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
      if (studentModal) studentModal.style.display = "flex";
      if (typeof lockBodyScroll === "function") lockBodyScroll();
      await loadStudentDropdowns();
      if (studentForm) studentForm.reset();
      setAdmissionDateToToday();
      updatePasswordVisibility();
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

        const phoneInput =
          document.getElementById("studentPhone")?.value.trim() || "";

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
          phone_number: phoneInput,
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
          payload.phone_number = phoneInput;
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
        if (typeof loadStudentsTable === "function") loadStudentsTable();
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

  loadStudentsTable();
});

async function loadStudentsTable() {
  const tableBody = document.getElementById("studentsTableBody");
  if (!tableBody) return;

  // Render loading state
  tableBody.innerHTML = `
    <tr>
     <td colspan="7" style="text-align: center; padding: 2rem; color: #64748b;">
        <i class="fa-solid fa-spinner fa-spin" style="margin-right: 0.5rem;"></i>
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
        school_id,
        student_id,
        gender,
        date_of_birth,
        admission_date,
        address,
        medical_notes,
        created_at,
        updated_at,
        profiles (
          full_name,
          photo_url,
          status,
          phone_number,
          email,
          created_at,
          updated_at
        ),
        classes (
          name
        ),
        academic_years (
          year_label
        )
      `,
      )
      .eq("is_archived", false)
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

    // Cache students globally so openViewStudentModal can locate them by ID
    window.allStudentsCache = students;

    populateClassFilterDropdown();
    filterStudents();

    // Build table rows
    tableBody.innerHTML = students
      .map((student) => {
        const profile = student.profiles || {};
        const className = student.classes?.name || "N/A";
        // Determine the primary source
        const photoSrc = profile.photo_url ? profile.photo_url : DEFAULT_AVATAR;
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
              onerror="this.onerror=null; this.src='${DEFAULT_AVATAR}';"
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

// Helper function to format ISO timestamps
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

function viewStudent(id) {
  const student = (window.allStudentsCache || []).find((s) => s.id === id);
  if (student) {
    openViewStudentModal(student);
  } else {
    console.error("Student not found in cache for ID:", id);
  }
}

function openViewStudentModal(student) {
  const profile = student.profiles || {};

  // Profile Header Elements
  document.getElementById("viewStudentName").textContent =
    profile.full_name || "-";

  const photoEl = document.getElementById("viewStudentPhoto");
  if (photoEl) {
    photoEl.src = profile.photo_url || DEFAULT_AVATAR;
    photoEl.onerror = function () {
      this.onerror = null;
      this.src = DEFAULT_AVATAR;
    };
  }

  // Status Badge Handling
  const statusElement = document.getElementById("viewStudentStatus");
  const rawStatus = (profile.status || "active").toLowerCase();

  if (statusElement) {
    statusElement.textContent =
      rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1);

    // Map status to designated CSS badge classes
    const badgeClass =
      rawStatus === "active" ? "status-active" : "status-inactive";

    statusElement.className = `view-student-status ${badgeClass}`;
  }

  // Grid Details Elements
  document.getElementById("viewStudentCustomId").textContent =
    student.student_id || "-";
  document.getElementById("viewStudentGender").textContent =
    student.gender || "-";
  document.getElementById("viewStudentDob").textContent = formatDate(
    student.date_of_birth,
  );
  document.getElementById("viewStudentClass").textContent =
    student.classes?.name || "-";
  document.getElementById("viewStudentAcademicYear").textContent =
    student.academic_years?.year_label || "-";
  document.getElementById("viewStudentAdmissionDate").textContent = formatDate(
    student.admission_date,
  );
  document.getElementById("viewStudentPhone").textContent =
    profile.phone_number || "-";
  document.getElementById("viewStudentEmail").textContent =
    profile.email || "-";
  document.getElementById("viewStudentAddress").textContent =
    student.address || "-";
  document.getElementById("viewStudentMedicalNotes").textContent =
    student.medical_notes || "-";

  // Created At and Updated At Timestamps
  document.getElementById("viewStudentCreatedAt").textContent = formatDate(
    student.created_at || profile.created_at,
  );
  document.getElementById("viewStudentUpdatedAt").textContent = formatDate(
    student.updated_at || profile.updated_at,
  );

  // Display Modal
  const viewStudentModal = document.getElementById("viewStudentModal");
  if (viewStudentModal) {
    viewStudentModal.style.display = "flex";
    if (typeof lockBodyScroll === "function") lockBodyScroll();
  }
}

// Modal Close Handlers
function closeViewStudentModal() {
  const viewStudentModal = document.getElementById("viewStudentModal");
  if (viewStudentModal) {
    viewStudentModal.style.display = "none";
    if (typeof unlockBodyScroll === "function") unlockBodyScroll();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  document
    .getElementById("closeViewStudentModal")
    ?.addEventListener("click", closeViewStudentModal);
  document
    .getElementById("closeViewBtn")
    ?.addEventListener("click", closeViewStudentModal);
});

// ------------------------------------------------------------------
// Edit Student Logic
// ------------------------------------------------------------------
let initialStudentData = {};
// 1. Open Edit Modal and Populate Fields
function editStudent(id) {
  const student = (window.allStudentsCache || []).find((s) => s.id === id);
  if (!student) {
    console.error("Student not found for ID:", id);
    return;
  }

  const profile = student.profiles || {};

  // AFTER
  const fullName = (profile.full_name || "").trim();
  const spaceIndex = fullName.indexOf(" ");
  let firstName = fullName;
  let lastName = "";
  if (spaceIndex !== -1) {
    firstName = fullName.substring(0, spaceIndex);
    lastName = fullName.substring(spaceIndex + 1);
  }

  document.getElementById("editStudentDbId").value = student.id;
  document.getElementById("editStudentFirstName").value = firstName;
  document.getElementById("editStudentLastName").value = lastName;
  document.getElementById("editStudentGender").value = student.gender || "";
  document.getElementById("editStudentDob").value = student.date_of_birth || "";
  document.getElementById("editStudentAdmissionDate").value =
    student.admission_date || "";

  // Normalize Status
  const status = (profile.status || "active").toLowerCase();
  const statusFormatted = status === "active" ? "Active" : "Inactive";
  document.getElementById("editStudentStatus").value = statusFormatted;

  document.getElementById("editStudentAddress").value = student.address || "";
  document.getElementById("editStudentMedicalNotes").value =
    student.medical_notes || "";

  // Set Profile Photo Preview
  const previewImg = document.getElementById("editStudentPhotoPreview");
  if (previewImg) {
    previewImg.src = profile.photo_url || DEFAULT_AVATAR;
  }

  const photoFileName = document.getElementById("editStudentPhotoFileName");
  if (photoFileName) {
    photoFileName.textContent = "No file chosen";
  }

  // ADD THIS: Save initial values for change checking
  initialStudentData = {
    firstName: firstName,
    lastName: lastName,
    gender: student.gender || "",
    dateOfBirth: student.date_of_birth || "",
    admissionDate: student.admission_date || "",
    status: statusFormatted,
    address: (student.address || "").trim(),
    medicalNotes: (student.medical_notes || "").trim(),
  };

  const modal = document.getElementById("editStudentModal");
  if (modal) {
    modal.style.display = "flex";
    if (typeof lockBodyScroll === "function") lockBodyScroll();
  }
}

// 2. Close Modal Helper
function closeEditStudentModal() {
  const modal = document.getElementById("editStudentModal");
  if (modal) {
    modal.style.display = "none";
    if (typeof unlockBodyScroll === "function") unlockBodyScroll();
  }
  document.getElementById("editStudentForm")?.reset();
}

document.addEventListener("DOMContentLoaded", () => {
  // Modal Event Listeners
  document
    .getElementById("closeEditStudentModal")
    ?.addEventListener("click", closeEditStudentModal);
  document
    .getElementById("cancelEditStudentModal")
    ?.addEventListener("click", closeEditStudentModal);

  // Profile Photo Live Preview
  const editPhotoInput = document.getElementById("editStudentPhoto");
  editPhotoInput?.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      document.getElementById("editStudentPhotoFileName").textContent =
        file.name;
      // AFTER
      const previewEl = document.getElementById("editStudentPhotoPreview");
      if (previewEl) {
        previewEl.src = URL.createObjectURL(file);
      }
    }
  });

  // 3. Form Submit Event Handler
  const editForm = document.getElementById("editStudentForm");
  if (editForm) {
    editForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const firstName = document
        .getElementById("editStudentFirstName")
        .value.trim();
      const lastName = document
        .getElementById("editStudentLastName")
        .value.trim();
      const gender = document.getElementById("editStudentGender").value;
      const dateOfBirth = document.getElementById("editStudentDob").value;
      const admissionDate = document.getElementById(
        "editStudentAdmissionDate",
      ).value;
      const status = document.getElementById("editStudentStatus").value;
      const address = document
        .getElementById("editStudentAddress")
        .value.trim();
      const medicalNotes = document
        .getElementById("editStudentMedicalNotes")
        .value.trim();
      const hasNewPhoto = editPhotoInput && editPhotoInput.files.length > 0;

      // Check if any field or photo has actually changed
      const hasChanges =
        hasNewPhoto ||
        firstName !== initialStudentData.firstName ||
        lastName !== initialStudentData.lastName ||
        gender !== initialStudentData.gender ||
        dateOfBirth !== initialStudentData.dateOfBirth ||
        admissionDate !== initialStudentData.admissionDate ||
        status !== initialStudentData.status ||
        address !== initialStudentData.address ||
        medicalNotes !== initialStudentData.medicalNotes;

      // Exit early if no changes are detected
      if (!hasChanges) {
        if (typeof showToast === "function") {
          showToast("No changes detected.", "info");
        }
        return;
      }

      const submitBtn = document.getElementById("saveEditStudentBtn");
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Updating...";
      }

      try {
        const studentDbId = document.getElementById("editStudentDbId").value;
        let photoBase64 = null;

        if (
          editPhotoInput &&
          editPhotoInput.files.length > 0 &&
          typeof compressToBase64 === "function"
        ) {
          photoBase64 = await compressToBase64(
            editPhotoInput.files[0],
            800,
            0.7,
          );
        }

        const firstName = document
          .getElementById("editStudentFirstName")
          .value.trim();
        const lastName = document
          .getElementById("editStudentLastName")
          .value.trim();

        const payload = {
          student_id: studentDbId, // Table primary key / profile UUID
          first_name: firstName,
          last_name: lastName,
          full_name: `${firstName} ${lastName}`.trim(),
          gender: document.getElementById("editStudentGender").value,
          date_of_birth: document.getElementById("editStudentDob").value,
          admission_date: document.getElementById("editStudentAdmissionDate")
            .value,
          status: document.getElementById("editStudentStatus").value,
          address: document.getElementById("editStudentAddress").value.trim(),
          medical_notes: document
            .getElementById("editStudentMedicalNotes")
            .value.trim(),
          photo: photoBase64,
        };

        const { data: sessionData, error: sessionError } =
          await supabaseClient.auth.getSession();
        if (sessionError || !sessionData.session) {
          throw new Error("User session expired. Please log in again.");
        }

        const { data, error } = await supabaseClient.functions.invoke(
          "update-student",
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
              "Failed to update student.",
          );
        }

        if (data && !data.success) {
          throw new Error(data.message || "Failed to update student.");
        }

        if (typeof showToast === "function") {
          showToast("Student updated successfully!", "success");
        }
        closeEditStudentModal();
        if (typeof loadStudentsTable === "function") loadStudentsTable();
      } catch (err) {
        console.error("Error updating student:", err);
        if (typeof showToast === "function") {
          showToast(err.message || "An error occurred.", "error");
        }
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "Update Student";
        }
      }
    });
  }
});

function populateEditStudentModal(student) {
  document.getElementById("editStudentDbId").value = student.id || "";
  document.getElementById("editStudentFirstName").value =
    student.first_name || "";
  document.getElementById("editStudentLastName").value =
    student.last_name || "";
  document.getElementById("editStudentGender").value = student.gender || "";
  document.getElementById("editStudentDob").value = student.date_of_birth || "";
  document.getElementById("editStudentAdmissionDate").value =
    student.admission_date || "";
  document.getElementById("editStudentStatus").value = student.status || "";
  document.getElementById("editStudentAddress").value = student.address || "";
  document.getElementById("editStudentMedicalNotes").value =
    student.medical_notes || "";

  // Reset photo input file selector
  if (editPhotoInput) editPhotoInput.value = "";

  // Snapshot initial values for change detection
  initialStudentData = {
    firstName: (student.first_name || "").trim(),
    lastName: (student.last_name || "").trim(),
    gender: (student.gender || "").trim(),
    dateOfBirth: (student.date_of_birth || "").trim(),
    admissionDate: (student.admission_date || "").trim(),
    status: (student.status || "").trim(),
    address: (student.address || "").trim(),
    medicalNotes: (student.medical_notes || "").trim(),
  };
}

// ------------------------------------------------------------------
// Direct Database Archive Student Logic
// ------------------------------------------------------------------

// 1. Open Archive Modal & Set Name
window.archiveStudent = function (studentId) {
  const student = (window.allStudentsCache || []).find(
    (s) => s.id === studentId,
  );
  if (!student) {
    console.error("Student not found for ID:", studentId);
    return;
  }

  const studentName = student.profiles?.full_name || "this student";

  document.getElementById("archiveStudentId").value = studentId;
  document.getElementById("archiveStudentName").textContent = studentName;

  const modal = document.getElementById("archiveStudentModal");
  if (modal) {
    modal.style.display = "flex";
    if (typeof lockBodyScroll === "function") lockBodyScroll();
  }
};

// 2. Close Modal Helper
function closeArchiveStudentModal() {
  const modal = document.getElementById("archiveStudentModal");
  if (modal) {
    modal.style.display = "none";
    if (typeof unlockBodyScroll === "function") unlockBodyScroll();
  }
  document.getElementById("archiveStudentId").value = "";
}

document.addEventListener("DOMContentLoaded", () => {
  // Modal Action Listeners
  document
    .getElementById("cancelArchive")
    ?.addEventListener("click", closeArchiveStudentModal);

  // 3. Perform Direct Database Update
  const confirmBtn = document.getElementById("confirmArchive");
  confirmBtn?.addEventListener("click", async () => {
    const studentId = document.getElementById("archiveStudentId").value;
    if (!studentId) return;

    confirmBtn.disabled = true;
    confirmBtn.textContent = "Archiving...";

    try {
      // Step A: Update status to 'inactive' in profiles
      const { error: profileError } = await supabaseClient
        .from("profiles")
        .update({ status: "inactive" })
        .eq("id", studentId);

      if (profileError) throw profileError;

      // Step B: Set is_archived = true in students
      const { error: studentError } = await supabaseClient
        .from("students")
        .update({ is_archived: true })
        .eq("id", studentId);

      if (studentError) throw studentError;

      // Verification Step: Check if local cache reflects update
      if (Array.isArray(window.allStudentsCache)) {
        window.allStudentsCache = window.allStudentsCache.filter(
          (s) => s.id !== studentId,
        );
      }

      if (typeof showToast === "function") {
        showToast("Student archived successfully.", "success");
      }

      closeArchiveStudentModal();

      // Refresh table UI
      if (typeof loadStudentsTable === "function") {
        loadStudentsTable();
      }
    } catch (err) {
      console.error("Archive operation failed:", err);

      // Handle RLS permission rejection (42501 code or standard message)
      if (
        err.code === "42501" ||
        (err.message &&
          err.message.toLowerCase().includes("row-level security")) ||
        (err.message && err.message.toLowerCase().includes("permission denied"))
      ) {
        if (typeof showToast === "function") {
          showToast(
            "Permission denied: Only Admins and Accountants can archive students.",
            "error",
          );
        } else {
          alert(
            "Permission denied: Only Admins and Accountants can archive students.",
          );
        }
      } else {
        if (typeof showToast === "function") {
          showToast(err.message || "Failed to archive student.", "error");
        }
      }
    } finally {
      confirmBtn.disabled = false;
      confirmBtn.textContent = "Archive";
    }
  });
});
