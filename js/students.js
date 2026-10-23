const DEFAULT_AVATAR =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128' width='128' height='128'><circle cx='64' cy='64' r='64' fill='%23E4E6EB'/><circle cx='64' cy='46' r='22' fill='%23B0B3B8'/><path d='M24 112c0-22 18-40 40-40s40 18 40 40' fill='%23B0B3B8'/></svg>";

let canDeleteStudents = false;
let pendingStudentDeleteId = null;
let studentDeleteTrigger = null;

function renderStudentsTable(studentsToRender) {
  const tableBody = document.getElementById("studentsTableBody");
  if (!tableBody) return;

  if (!studentsToRender || studentsToRender.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 20px; color: #64748b;">
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
      const photoSrc = escapeHTML(profile.photo_url ? profile.photo_url : DEFAULT_AVATAR);
      const status = (profile.status || "active").toLowerCase();
      const statusClass =
        status === "active"
          ? "students-status-active"
          : "students-status-inactive";

      return `
      <tr>
        <td>
          <span class="app-person-cell">
          <img
            src="${photoSrc}"
            class="student-photo"
            alt="${escapeHTML(profile.full_name || "Student")}"
            onerror="this.onerror=null; this.src='${DEFAULT_AVATAR}';"
          />
            <span class="app-person-meta">
              <span>${escapeHTML(profile.full_name || "N/A")}</span>
              <small class="app-person-id">Student ID: ${escapeHTML(student.student_id || "N/A")}</small>
            </span>
          </span>
        </td>
        <td>${escapeHTML(student.gender || "N/A")}</td>
        <td>${escapeHTML(className)}</td>
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
          ${canDeleteStudents ? `<button class="students-actions-btn delete" type="button" data-student-id="${escapeHTML(student.id)}" aria-label="Delete ${escapeHTML(profile.full_name || "student")}" title="Delete student"><i class="fa-solid fa-trash" aria-hidden="true"></i></button>` : ""}
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

    const matchesSearch =
      !searchVal ||
      fullName.includes(searchVal) ||
      studentCustomId.includes(searchVal);

    const studentClassName = student.classes?.name || "";
    const matchesClass =
      !selectedClassName || studentClassName === selectedClassName;

    const studentStatus = (profile.status || "active").toLowerCase();
    const matchesStatus = !selectedStatus || studentStatus === selectedStatus;

    return matchesSearch && matchesClass && matchesStatus;
  });

  renderStudentsTable(filtered);
}

document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("studentSearchInput");
  const classFilter = document.getElementById("studentClassFilter");
  const statusFilter = document.getElementById("studentStatusFilter");

  if (searchInput) searchInput.addEventListener("input", filterStudents);
  if (classFilter) classFilter.addEventListener("change", filterStudents);
  if (statusFilter) statusFilter.addEventListener("change", filterStudents);

  document.getElementById("studentsTableBody")?.addEventListener("click", (event) => {
    const deleteButton = event.target.closest(".students-actions-btn.delete");
    if (deleteButton) openStudentDeleteConfirmation(deleteButton.dataset.studentId);
  });
});

let cachedClasses = [];
let cachedAcademicYears = [];

window.togglePassword = function (inputId, button) {
  const input = document.getElementById(inputId);
  if (!input) return;

  const isVisible = input.type === "text";
  input.type = isVisible ? "password" : "text";

  if (button) {
    button.setAttribute("aria-pressed", String(!isVisible));
    button.setAttribute(
      "aria-label",
      isVisible ? "Show password" : "Hide password",
    );
  }
};

function isEligibleClass(classId) {
  const selectedClass = cachedClasses.find((c) => c.id === classId);
  if (!selectedClass) return false;
  const name = selectedClass.name || selectedClass.class_name || "";
  return /(?:10|11|12|Grade\s*(?:10|11|12))/i.test(name);
}

function compressToBase64(file, maxWidth = 800, quality = 0.7) {
  return new Promise((resolve, reject) => {
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

function compressImageToBlob(file, maxWidth = 800, quality = 0.7) {
  return new Promise((resolve, reject) => {
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

  loadStudentDropdowns();
  loadStudentDeletePermission();

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
  });

  async function loadStudentDropdowns() {
    try {
      const classSelectEl =
        studentClassSelect ||
        document.getElementById("studentClassSelect") ||
        document.getElementById("studentClass");

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

        updatePasswordVisibility();
      }

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

  function updatePasswordVisibility() {
    const classSelectEl =
      studentClassSelect ||
      document.getElementById("studentClassSelect") ||
      document.getElementById("studentClass");

    const selectedClassId = classSelectEl ? classSelectEl.value : "";

    const eligible =
      typeof isEligibleClass === "function" && isEligibleClass(selectedClassId);

    const emailEl = document.getElementById("studentEmail");
    const passEl = document.getElementById("newPassword");
    const confirmEl = document.getElementById("confirmPassword");
    const roleEl = document.getElementById("studentRole");
    const phoneEl = document.getElementById("studentPhone");

    const fields = [emailEl, passEl, confirmEl, roleEl, phoneEl].filter(
      Boolean,
    );

    fields.forEach((field) => {
      const container = field.closest(".form-group") || field.parentElement;

      if (eligible) {
        if (container) container.style.display = "";
        field.setAttribute("required", "required");

        if (field.id === "studentRole" && !field.value) {
          field.value = "student";
        }
      } else {
        if (container) container.style.display = "none";
        field.removeAttribute("required");

        if (field.id !== "studentRole") {
          field.value = "";
        }
      }
    });
  }

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

        const statusValue =
          rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1).toLowerCase();

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

        if (isEligible) {
          payload.email = emailInput;
          payload.role = "student";
          payload.password = newPassword;
          payload.phone_number = phoneInput;
        }

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

async function loadStudentDeletePermission() {
  try {
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) return;

    const { data: profile, error } = await supabaseClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (error) throw error;
    canDeleteStudents = profile?.role === "admin";
    if (window.allStudentsCache) filterStudents();
  } catch (error) {
    console.error("Could not check student deletion access:", error);
  }
}

function openStudentDeleteConfirmation(studentId) {
  if (!canDeleteStudents) return;
  const student = (window.allStudentsCache || []).find((item) => item.id === studentId);
  const dialog = document.getElementById("studentDeleteConfirm");
  const message = document.getElementById("studentDeleteMessage");
  const cancelButton = document.getElementById("cancelStudentDelete");
  if (!student || !dialog || !message || !cancelButton) return;

  const name = student.profiles?.full_name || "this student";
  const code = student.student_id ? ` (${student.student_id})` : "";
  message.textContent = `Permanently delete ${name}${code}? This also removes linked attendance, grades, enrollment, fees, payments, parent links, borrowing history, transfer history, and any student login. This cannot be undone.`;
  studentDeleteTrigger = document.activeElement;
  pendingStudentDeleteId = studentId;
  dialog.hidden = false;
  if (typeof lockBodyScroll === "function") lockBodyScroll();
  cancelButton.focus();
}

function closeStudentDeleteConfirmation(restoreFocus = true) {
  const dialog = document.getElementById("studentDeleteConfirm");
  if (!dialog) return;
  dialog.hidden = true;
  pendingStudentDeleteId = null;
  if (typeof unLockBodyScroll === "function") unLockBodyScroll();
  if (restoreFocus && studentDeleteTrigger?.isConnected) studentDeleteTrigger.focus();
  studentDeleteTrigger = null;
}

document.addEventListener("DOMContentLoaded", () => {
  const dialog = document.getElementById("studentDeleteConfirm");
  const cancelButton = document.getElementById("cancelStudentDelete");
  const confirmButton = document.getElementById("confirmStudentDelete");

  cancelButton?.addEventListener("click", () => closeStudentDeleteConfirmation());
  dialog?.addEventListener("click", (event) => {
    if (event.target === dialog) closeStudentDeleteConfirmation();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !dialog?.hidden) closeStudentDeleteConfirmation();
  });

  confirmButton?.addEventListener("click", async () => {
    const studentId = pendingStudentDeleteId;
    if (!canDeleteStudents || !studentId) return;

    confirmButton.disabled = true;
    confirmButton.textContent = "Deleting...";

    try {
      const { data, error } = await supabaseClient.functions.invoke("delete-student", {
        body: { student_id: studentId },
      });

      if (error) {
        let message = error.message || "Failed to delete student.";
        if (error.context) {
          try {
            const responseBody = await error.context.json();
            message = responseBody.message || message;
            if (Array.isArray(responseBody.blockers) && responseBody.blockers.length) {
              message += ` ${responseBody.blockers.join(" ")}`;
            }
          } catch {
            // Use the function error message when there is no JSON response.
          }
        }
        throw new Error(message);
      }

      if (!data?.success) throw new Error(data?.message || "Failed to delete student.");

      closeStudentDeleteConfirmation(false);
      if (typeof showToast === "function") {
        const warning = Array.isArray(data.warnings) ? data.warnings.join(" ") : "";
        showToast(warning || "Student and linked records deleted.", warning ? "error" : "success");
      }
      await loadStudentsTable();
    } catch (error) {
      console.error("Student deletion failed:", error);
      if (typeof showToast === "function") showToast(error.message || "Failed to delete student.", "error");
    } finally {
      confirmButton.disabled = false;
      confirmButton.textContent = "Delete student";
    }
  });
});

const STUDENTS_PAGE_SIZE = 30;
let studentsOffset = 0;
let studentsHasMore = false;
let studentsLoading = false;

async function loadStudentsTable(options = {}) {
  const tableBody = document.getElementById("studentsTableBody");
  if (!tableBody) return;
  const append = options.append === true;
  const nextButton = document.getElementById("nextStudentsPage");

  if (studentsLoading || (append && !studentsHasMore)) return;
  studentsLoading = true;

  if (!append) {
    studentsOffset = 0;
    studentsHasMore = false;
    window.allStudentsCache = [];
    if (nextButton) {
      nextButton.hidden = true;
      nextButton.disabled = false;
      nextButton.textContent = "Next";
    }
    tableBody.innerHTML = `
      <tr>
       <td colspan="5" style="text-align: center; padding: 2rem; color: #64748b;">
          <i class="fa-solid fa-spinner fa-spin" style="margin-right: 0.5rem;"></i>
          Loading students...
        </td>
      </tr>
    `;
  } else if (nextButton) {
    nextButton.disabled = true;
    nextButton.textContent = "Loading...";
  }

  try {
    const { data: page, error } = await supabaseClient
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
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(studentsOffset, studentsOffset + STUDENTS_PAGE_SIZE);

    if (error) throw error;

    const students = page || [];
    const visibleStudents = students.slice(0, STUDENTS_PAGE_SIZE);
    studentsHasMore = students.length > STUDENTS_PAGE_SIZE;
    studentsOffset += visibleStudents.length;

    if (!append && visibleStudents.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; padding: 20px;">
            No students found.
          </td>
        </tr>
      `;
      return;
    }

    window.allStudentsCache = append
      ? (window.allStudentsCache || []).concat(visibleStudents)
      : visibleStudents;

    populateClassFilterDropdown();
    filterStudents();
  } catch (err) {
    console.error("Error fetching students:", err);
    if (!append) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; color: red; padding: 20px;">
            Failed to load students: ${escapeHTML(err.message || "Unknown error")}
          </td>
        </tr>
      `;
    } else if (typeof showToast === "function") {
      showToast("Could not load more students.", "error");
    }
  } finally {
    studentsLoading = false;
    if (nextButton) {
      nextButton.hidden = !studentsHasMore;
      nextButton.disabled = false;
      nextButton.textContent = "Next";
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  document
    .getElementById("nextStudentsPage")
    ?.addEventListener("click", () => loadStudentsTable({ append: true }));
});

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

async function viewStudent(id) {
  let student = null;

  try {
    const { data, error } = await supabaseClient
      .from("students")
      .select(
        `
        *,
        profiles (*),
        classes:class_id (name),
        academic_years:academic_year_id (year_label)
      `,
      )
      .eq("id", id)
      .single();

    if (!error && data) {
      student = data;
    }
  } catch (err) {
    console.warn(
      "Could not fetch fresh student from network, checking cache...",
      err,
    );
  }

  if (!student) {
    student = (window.allStudentsCache || []).find((s) => s.id === id);
  }

  if (!student) {
    console.error("Student not found for ID:", id);
    showToast("Student record not found.", "error");
    return;
  }

  const profile = student.profiles || {};

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

  const statusElement = document.getElementById("viewStudentStatus");
  const rawStatus = (profile.status || "active").toLowerCase();
  if (statusElement) {
    statusElement.textContent =
      rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1);
    statusElement.className = `view-student-status ${rawStatus === "active" ? "status-active" : "status-inactive"}`;
  }

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
  document.getElementById("viewStudentCreatedAt").textContent = formatDate(
    student.created_at || profile.created_at,
  );
  document.getElementById("viewStudentUpdatedAt").textContent = formatDate(
    student.updated_at || profile.updated_at,
  );

  const viewStudentModal = document.getElementById("viewStudentModal");
  if (viewStudentModal) {
    viewStudentModal.style.display = "flex";
    if (typeof lockBodyScroll === "function") lockBodyScroll();
  }
}

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

let initialStudentData = {};

function editStudent(id) {
  const student = (window.allStudentsCache || []).find((s) => s.id === id);
  if (!student) {
    console.error("Student not found for ID:", id);
    return;
  }

  const profile = student.profiles || {};

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

  const status = (profile.status || "active").toLowerCase();
  const statusFormatted = status === "active" ? "Active" : "Inactive";
  document.getElementById("editStudentStatus").value = statusFormatted;

  document.getElementById("editStudentAddress").value = student.address || "";
  document.getElementById("editStudentMedicalNotes").value =
    student.medical_notes || "";

  const previewImg = document.getElementById("editStudentPhotoPreview");
  if (previewImg) {
    previewImg.src = profile.photo_url || DEFAULT_AVATAR;
  }

  const photoFileName = document.getElementById("editStudentPhotoFileName");
  if (photoFileName) {
    photoFileName.textContent = "No file chosen";
  }

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

function closeEditStudentModal() {
  const modal = document.getElementById("editStudentModal");
  if (modal) {
    modal.style.display = "none";
    if (typeof unlockBodyScroll === "function") unlockBodyScroll();
  }
  document.getElementById("editStudentForm")?.reset();
}

document.addEventListener("DOMContentLoaded", () => {
  document
    .getElementById("closeEditStudentModal")
    ?.addEventListener("click", closeEditStudentModal);
  document
    .getElementById("cancelEditStudentModal")
    ?.addEventListener("click", closeEditStudentModal);

  const editPhotoInput = document.getElementById("editStudentPhoto");
  editPhotoInput?.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      document.getElementById("editStudentPhotoFileName").textContent =
        file.name;

      const previewEl = document.getElementById("editStudentPhotoPreview");
      if (previewEl) {
        previewEl.src = URL.createObjectURL(file);
      }
    }
  });

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
          student_id: studentDbId,
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

  if (editPhotoInput) editPhotoInput.value = "";

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
