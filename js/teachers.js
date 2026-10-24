const DEFAULT_AVATAR =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128' width='128' height='128'><circle cx='64' cy='64' r='64' fill='%23E4E6EB'/><circle cx='64' cy='46' r='22' fill='%23B0B3B8'/><path d='M24 112c0-22 18-40 40-40s40 18 40 40' fill='%23B0B3B8'/></svg>";
let cachedDepartments = [];

function teacherErrorMessage(error, action = "load") {
  const code = String(error?.code || error?.name || "").toLowerCase();
  const status = Number(error?.status || error?.statusCode || 0);
  const diagnostic = `${code} ${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`.toLowerCase();

  if (status === 401 || code === "pgrst301" || /invalid jwt|session.*expired|refresh token/.test(diagnostic)) {
    return "Your session has expired. Sign in again, then reopen Teachers.";
  }
  if (/school.{0,30}inactive|inactive.{0,30}school/.test(diagnostic)) {
    return "This school is inactive. Teacher records can be viewed, but changes are unavailable until the school is reactivated.";
  }
  if (code === "42501" || status === 403 || /row-level security|permission denied|not authorized|unauthorized|access denied|insufficient privilege/.test(diagnostic)) {
    if (action === "load" || action === "view") {
      return "You do not have permission to view teacher records. Contact your school administrator for access.";
    }
    if (action === "departments") {
      return "You do not have permission to load department options. Contact your school administrator.";
    }
    if (action === "photo") {
      return "You do not have permission to upload this teacher’s photo. Contact your school administrator.";
    }
    return `You do not have permission to ${action} teacher records. Contact your school administrator.`;
  }
  if (/failed to fetch|fetch failed|network|connection|timeout|timed out/.test(diagnostic)) {
    const operation = {
      load: "loaded",
      view: "loaded",
      departments: "loaded",
      photo: "uploaded",
      create: "created",
      update: "saved",
    }[action] || "processed";
    return `Teacher information could not be ${operation} because the connection failed. Check your internet connection and try again.`;
  }
  if (code === "23505" || /duplicate key|already exists|unique constraint/.test(diagnostic)) {
    return "That staff ID or email is already in use. Check the details and try again.";
  }
  if (code === "23503" || /foreign key|violates.*constraint/.test(diagnostic)) {
    return "The selected department or linked record is no longer available. Refresh the page and try again.";
  }
  if (code === "23514" || code === "22p02" || /invalid input|invalid date|check constraint/.test(diagnostic)) {
    return "Some teacher information is invalid. Review the fields and try again.";
  }
  if (status === 413 || /file.{0,20}(too large|exceeds)|payload too large/.test(diagnostic)) {
    return "The photo is too large. Choose a smaller image and try again.";
  }
  if (status === 415 || /unsupported media|invalid mime|file type/.test(diagnostic)) {
    return "That photo format is not supported. Choose an image file and try again.";
  }
  if (action === "photo" && /canvas|image|file/.test(diagnostic)) {
    return "The teacher photo could not be processed. Choose another image and try again.";
  }
  if (code === "pgrst116") {
    return action === "view"
      ? "This teacher record could not be found. Refresh the list and try again."
      : "The requested teacher record could not be found.";
  }

  const appMessage = String(error?.message || "").trim();
  if (appMessage && !/\b(?:postgrest|postgres|sqlstate|row-level security|failed to fetch|permission denied|edge function returned|\b(?:select|insert|update|delete)\b.*\b(?:table|relation)\b)\b/i.test(appMessage)) {
    return appMessage;
  }
  const messages = {
    load: "Teacher records could not be loaded. Please try again.",
    view: "Teacher details could not be loaded. Please try again.",
    departments: "Department options could not be loaded. Check your connection and try again.",
    create: "The teacher could not be added. Check the information and try again.",
    update: "Teacher changes could not be saved. Please try again.",
  };
  return messages[action] || "The request could not be completed. Please try again.";
}

function showTeacherError(error, action = "load") {
  const message = teacherErrorMessage(error, action);
  console.error(`Teachers page ${action} error:`, error);
  if (typeof showToast === "function") showToast(message, "error");
  return message;
}

function filterTeachersTable() {
  const searchQuery =
    document.getElementById("teacherSearchInput")?.value.trim().toLowerCase() ||
    "";
  const selectedDepartment =
    document.getElementById("teacherDepartmentFilter")?.value || "";
  const selectedStatus =
    document.getElementById("teacherStatusFilter")?.value?.toLowerCase() || "";

  const tbody = document.querySelector(".teachers-table-card tbody");
  if (!tbody) return;

  const filteredTeachers = currentTeachersList.filter((teacher) => {
    const profile = teacher.profiles || {};

    let deptId = teacher.department_id || teacher.departments?.id;
    if (Array.isArray(teacher.departments)) deptId = teacher.departments[0]?.id;

    const matchesDept =
      !selectedDepartment || String(deptId) === String(selectedDepartment);

    const teacherStatus = (profile.status || "active").toLowerCase();
    const matchesStatus = !selectedStatus || teacherStatus === selectedStatus;

    const staffId = (teacher.staff_id || "").toLowerCase();
    const name = (profile.full_name || "").toLowerCase();
    const email = (profile.email || "").toLowerCase();

    const matchesSearch =
      !searchQuery ||
      staffId.includes(searchQuery) ||
      name.includes(searchQuery) ||
      email.includes(searchQuery);

    return matchesDept && matchesStatus && matchesSearch;
  });

  if (filteredTeachers.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No matching teachers found.</td></tr>`;
    return;
  }

  tbody.innerHTML = filteredTeachers
    .map((teacher) => {
      const profile = teacher.profiles || {};
      const photoUrl = profile.photo_url || DEFAULT_AVATAR;

      return `
      <tr>
        <td>
          <span class="app-person-cell">
          <img
            src="${escapeHTML(photoUrl)}"
            class="teacher-photo"
            alt="${escapeHTML(profile.full_name || "Teacher")}"
            loading="lazy"
            onerror="this.onerror=null; this.src=DEFAULT_AVATAR;"
          />
            <span class="app-person-meta">
              <span>${escapeHTML(profile.full_name || "-")}</span>
              <small class="app-person-id">Staff ID: ${escapeHTML(teacher.staff_id || "-")}</small>
            </span>
          </span>
        </td>
        <td>${escapeHTML(teacher.gender || "-")}</td>
        <td>${escapeHTML(profile.email || "-")}</td>
        <td>
          <span class="teachers-status-${String(profile.status || "active").toLowerCase() === "inactive" ? "inactive" : "active"}">
            ${escapeHTML(profile.status || "Active")}
          </span>
        </td>
        <td>
          <button class="teachers-actions-btn view" data-id="${escapeHTML(teacher.id)}"><i class="fa-solid fa-eye"></i></button>
          <button class="teachers-actions-btn edit" data-id="${escapeHTML(teacher.id)}"><i class="fa-solid fa-pen"></i></button>
        </td>
      </tr>`;
    })
    .join("");
}

function setupTeacherToolbarFilters() {
  const searchInput = document.getElementById("teacherSearchInput");
  const departmentSelect = document.getElementById("teacherDepartmentFilter");
  const statusSelect = document.getElementById("teacherStatusFilter");

  if (statusSelect) {
    statusSelect.innerHTML = `
      <option value="">All Status</option>
      <option value="active">Active</option>
      <option value="inactive">Inactive</option>
    `;
  }

  if (departmentSelect) {
    const uniqueDepartments = new Map();

    currentTeachersList.forEach((teacher) => {
      let deptObj = teacher.departments;
      if (Array.isArray(deptObj)) deptObj = deptObj[0];

      if (deptObj && deptObj.id && deptObj.name) {
        uniqueDepartments.set(deptObj.id, deptObj.name);
      } else if (teacher.department_id) {
        uniqueDepartments.set(
          teacher.department_id,
          `Department ${teacher.department_id}`,
        );
      }
    });

    let optionsHtml = '<option value="">All Department</option>';
    uniqueDepartments.forEach((deptName, deptId) => {
      optionsHtml += `<option value="${deptId}">${deptName}</option>`;
    });

    departmentSelect.innerHTML = optionsHtml;
  }

  if (searchInput) searchInput.addEventListener("input", filterTeachersTable);
  if (departmentSelect)
    departmentSelect.addEventListener("change", filterTeachersTable);
  if (statusSelect)
    statusSelect.addEventListener("change", filterTeachersTable);
}

async function loadDepartmentDropdown(
  selectId = "teacherDepartment",
  forceRefresh = false,
) {
  const selectEl = document.getElementById(selectId);
  if (!selectEl) return false;

  try {
    if (forceRefresh) {
      cachedDepartments = [];
    }

    if (cachedDepartments.length === 0) {
      const { data: departments, error } = await supabaseClient
        .from("departments")
        .select("id, name")
        .order("name", { ascending: true });

      if (error) throw error;
      cachedDepartments = departments || [];
    }

    selectEl.innerHTML = `<option value="">Select Department</option>`;
    cachedDepartments.forEach((dept) => {
      const option = document.createElement("option");
      option.value = dept.id;
      option.textContent = dept.name;
      selectEl.appendChild(option);
    });
    return true;
  } catch (error) {
    showTeacherError(error, "departments");
    return false;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const addTeacherBtn = document.getElementById("addTeacher");
  const teacherModal = document.getElementById("teacherModal");
  const closeTeacherModal = document.getElementById("closeTeacherModal");
  const cancelTeacherModal = document.getElementById("cancelTeacherModal");
  const teacherForm = document.getElementById("teacherForm");

  const viewTeacherModal = document.getElementById("viewTeacherModal");
  const closeViewTeacherModal = document.getElementById(
    "closeViewTeacherModal",
  );
  const closeViewBtn = document.getElementById("closeViewBtn");

  const menuToggle = document.getElementById("menuToggle");
  const sidebarOverlay = document.getElementById("sidebarOverlay");
  const sidebar = document.querySelector(".sidebar");

  if (addTeacherBtn) {
    addTeacherBtn.addEventListener("click", () => {
      loadDepartmentDropdown();
      teacherForm.reset();
      teacherModal.style.display = "flex";
      lockBodyScroll();
    });
  }

  const hideAddModal = () => {
    teacherModal.style.display = "none";
    unLockBodyScroll();

    const teacherPhotoPreview = document.getElementById("teacherPhotoPreview");
    const teacherPhotoFileName = document.getElementById(
      "teacherPhotoFileName",
    );
    if (teacherPhotoPreview) teacherPhotoPreview.src = DEFAULT_AVATAR;
    if (teacherPhotoFileName)
      teacherPhotoFileName.textContent = "No file chosen";
  };

  if (closeTeacherModal)
    closeTeacherModal.addEventListener("click", hideAddModal);
  if (cancelTeacherModal)
    cancelTeacherModal.addEventListener("click", hideAddModal);

  const hideViewModal = () => {
    viewTeacherModal.style.display = "none";
    unLockBodyScroll();
  };
  if (closeViewTeacherModal)
    closeViewTeacherModal.addEventListener("click", hideViewModal);
  if (closeViewBtn) closeViewBtn.addEventListener("click", hideViewModal);

  window.togglePassword = function (inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const isPassword = input.type === "password";
    input.type = isPassword ? "text" : "password";
  };

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
          photoBase64 = await compressToBase64(photoInput.files[0], 800, 0.7);
        }

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

        const { data: sessionData, error: sessionError } =
          await supabaseClient.auth.getSession();
        if (sessionError || !sessionData.session) {
          throw new Error("User session expired. Please log in again.");
        }

        const { data, error } = await supabaseClient.functions.invoke(
          "create-teacher",
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
        showTeacherError(err, "create");
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Save Teacher";
      }
    });
  }

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

  [
    document.getElementById("teacherModal"),
    document.getElementById("editTeacherModal"),
    document.getElementById("viewTeacherModal"),
  ].forEach((modal) => {
    if (!modal) return;
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.style.display = "none";
        unLockBodyScroll();
      }
    });
  });

  loadTeachers();
  loadDepartmentDropdown();
  setupTeacherToolbarFilters();
});

function openViewModal(teacher) {
  const profile = teacher.profiles || {};

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

  document.getElementById("viewTeacherName").textContent =
    profile.full_name || "-";
  const photoEl = document.getElementById("viewTeacherPhoto");
  photoEl.src = profile.photo_url || DEFAULT_AVATAR;
  photoEl.onerror = function () {
    this.onerror = null;
    this.src = DEFAULT_AVATAR;
  };

  const statusElement = document.getElementById("viewTeacherStatus");
  const currentStatus = profile.status || teacher.status || "Active";
  statusElement.textContent = currentStatus;
  statusElement.className = `view-teacher-status ${currentStatus.toLowerCase()}`;

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

  document.getElementById("viewTeacherCreatedAt").textContent = formatDate(
    teacher.created_at || profile.created_at,
  );
  document.getElementById("viewTeacherUpdatedAt").textContent = formatDate(
    teacher.updated_at || profile.updated_at,
  );

  const viewTeacherModal = document.getElementById("viewTeacherModal");
  if (viewTeacherModal) {
    viewTeacherModal.style.display = "flex";
    lockBodyScroll();
  }
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

function resetTeacherForm() {
  if (teacherForm) teacherForm.reset();
  const previewImg = document.getElementById("teacherPhotoPreview");
  if (previewImg) previewImg.src = DEFAULT_AVATAR;
}

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
  const resolvedId = teacher.id || teacher.profiles?.id;
  selectedTeacherId = resolvedId;

  const editForm = document.getElementById("editTeacherForm");
  if (editForm) {
    editForm.dataset.teacherId = resolvedId;
  }

  const profile = teacher.profiles || {};

  await loadDepartmentDropdown("editTeacherDepartment");

  const fullNameParts = (profile.full_name || "").trim().split(" ");
  const firstName = fullNameParts[0] || "";
  const lastName = fullNameParts.slice(1).join(" ") || "";

  const setInputValue = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val || "";
  };

  setInputValue("editTeacherStaffId", teacher.staff_id);
  setInputValue("editTeacherFirstName", firstName);
  setInputValue("editTeacherLastName", lastName);
  setInputValue("editTeacherGender", teacher.gender);
  setInputValue("editTeacherDob", teacher.date_of_birth);

  let deptId = teacher.department_id || "";
  if (!deptId && teacher.departments) {
    if (Array.isArray(teacher.departments) && teacher.departments.length > 0) {
      deptId = teacher.departments[0].id;
    } else if (typeof teacher.departments === "object") {
      deptId = teacher.departments.id;
    }
  }

  setInputValue("editTeacherDepartment", deptId);
  setInputValue("editTeacherQualification", teacher.qualification);
  setInputValue("editTeacherPhone", profile.phone_number);

  const statusValue = profile.status || teacher.status || "Active";
  const formattedStatus =
    statusValue.charAt(0).toUpperCase() + statusValue.slice(1).toLowerCase();
  setInputValue("editTeacherStatus", formattedStatus);

  setInputValue("editTeacherAddress", teacher.address);

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

  originalTeacherData = {
    firstName,
    lastName,
    gender: teacher.gender || "",
    date_of_birth: teacher.date_of_birth || "",
    department_id: deptId,
    qualification: teacher.qualification || "",
    phone_number: profile.phone_number || "",
    status: formattedStatus,
    address: teacher.address || "",
    photo_url: profile.photo_url || "",
  };

  const editTeacherModal = document.getElementById("editTeacherModal");
  if (editTeacherModal) {
    editTeacherModal.style.display = "flex";
    lockBodyScroll();
  }
}

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
      const avatarFile =
        photoInput && photoInput.files && photoInput.files.length > 0
          ? photoInput.files[0]
          : null;

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

      const hasDataChanged =
        originalTeacherData &&
        Object.keys(currentValues).some(
          (key) =>
            (currentValues[key] || "") !== (originalTeacherData[key] || ""),
        );
      const hasNewPhoto = avatarFile !== null;

      if (!hasDataChanged && !hasNewPhoto) {
        showToast("No changes detected.", "info");
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = "Updating...";

      let photoUrl = originalTeacherData?.photo_url || null;

      if (avatarFile) {
        submitBtn.textContent = "Compressing photo...";
        const compressedBlob = await compressImageToBlob(avatarFile, 800, 0.7);

        if (compressedBlob) {
          submitBtn.textContent = "Uploading photo...";
          const versionId =
            globalThis.crypto?.randomUUID?.() ||
            `${Date.now()}-${Math.random().toString(36).slice(2)}`;
          const filePath = `${teacherId}/${versionId}.jpg`;

          const { error: uploadError } = await supabaseClient.storage
            .from("avatars")
            .upload(filePath, compressedBlob, {
              contentType: "image/jpeg",
              upsert: false,
            });

          if (uploadError) {
            uploadError.teacherAction = "photo";
            throw uploadError;
          }

          const { data: urlData } = supabaseClient.storage
            .from("avatars")
            .getPublicUrl(filePath);

          photoUrl = `${urlData.publicUrl}?t=${Date.now()}`;
        }
      }

      submitBtn.textContent = "Saving changes...";

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
        photoUrl: photoUrl,
      };

      const { data: sessionData, error: sessionError } =
        await supabaseClient.auth.getSession();

      if (sessionError || !sessionData.session) {
        throw new Error("Session expired. Please log in again.");
      }

      const { data, error } = await supabaseClient.functions.invoke(
        "update-teacher",
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
          } catch (e) {}
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
      showTeacherError(err, err.teacherAction || "update");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Update Teacher";
    }
  });
}

let currentTeachersList = [];

async function loadTeachers() {
  const tbody = document.querySelector(".teachers-table-card tbody");
  if (!tbody) return;

  renderTeachersTableLoading();

  try {
    const { data: teachers, error } = await supabaseClient
      .from("teachers")
      .select(
        `
    id, staff_id, gender, qualification, address, date_of_birth, created_at, updated_at,
    departments:department_id ( id, name ),
    profiles:id ( full_name, email, phone_number, status, photo_url )
  `,
      );

    if (error) throw error;

    currentTeachersList = teachers || [];

    setupTeacherToolbarFilters();

    if (currentTeachersList.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No teachers found.</td></tr>`;
      return;
    }

    setTimeout(() => {
      const rowsHtml = currentTeachersList
        .map((teacher) => {
          const profile = teacher.profiles || {};
          const photoUrl = profile.photo_url || DEFAULT_AVATAR;

          return `
          <tr>
            <td>
              <span class="app-person-cell">
              <img
                src="${escapeHTML(photoUrl)}"
                class="teacher-photo"
                alt="${escapeHTML(profile.full_name || "Teacher")}"
                loading="lazy"
                onerror="this.onerror=null; this.src=DEFAULT_AVATAR;"
              />
                <span class="app-person-meta">
                  <span>${escapeHTML(profile.full_name || "-")}</span>
                  <small class="app-person-id">Staff ID: ${escapeHTML(teacher.staff_id || "-")}</small>
                </span>
              </span>
            </td>
            <td>${escapeHTML(teacher.gender || "-")}</td>
            <td>${escapeHTML(profile.email || "-")}</td>
            <td>
              <span class="teachers-status-${String(profile.status || "active").toLowerCase() === "inactive" ? "inactive" : "active"}">
                ${escapeHTML(profile.status || "Active")}
              </span>
            </td>
            <td>
              <button class="teachers-actions-btn view" data-id="${escapeHTML(teacher.id)}"><i class="fa-solid fa-eye"></i></button>
              <button class="teachers-actions-btn edit" data-id="${escapeHTML(teacher.id)}"><i class="fa-solid fa-pen"></i></button>
            </td>
          </tr>`;
        })
        .join("");

      tbody.innerHTML = rowsHtml;
    }, 50);
  } catch (err) {
    console.error("Failed to fetch teachers:", err);
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 5;
    cell.className = "teachers-load-error";
    const message = document.createElement("p");
    message.textContent = teacherErrorMessage(err, "load");
    const retryButton = document.createElement("button");
    retryButton.type = "button";
    retryButton.className = "teachers-retry-btn";
    retryButton.textContent = "Try again";
    retryButton.addEventListener("click", () => loadTeachers(), { once: true });
    cell.append(message, retryButton);
    row.appendChild(cell);
    tbody.replaceChildren(row);
  }
}

document
  .querySelector(".teachers-table-card tbody")
  ?.addEventListener("click", (e) => {
    const btn = e.target.closest(".teachers-actions-btn");
    if (!btn) return;

    const teacherId = btn.dataset.id;
    const teacher = currentTeachersList.find((t) => t.id === teacherId);
    if (!teacher) return;

    if (btn.classList.contains("view")) {
      openViewModal(teacher);
    } else if (btn.classList.contains("edit")) {
      openEditModal(teacher);
    }
  });

function renderTeachersTableLoading() {
  const tbody = document.querySelector(".teachers-table-card tbody");
  if (!tbody) return;

  tbody.innerHTML = `
    <tr>
      <td colspan="5" style="text-align: center; padding: 2rem; color: #64748b;">
        <i class="fa-solid fa-spinner fa-spin" style="margin-right: 0.5rem;"></i>
        Loading teachers...
      </td>
    </tr>
  `;
}
