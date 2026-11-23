const USE_MOCK_DATA = true;

const API_BASE_URL = "http://localhost:8000/api/";

const STORAGE_KEY = "examSmartAdminExams";
const AUTH_KEY = "examSmartAdminAuthenticated";

let csrfToken = "";

/* =========================================================
   MOCK DATA
========================================================= */

const rooms = [
    { id: 1, name: "Room A", capacity: 100 },
    { id: 2, name: "Room B", capacity: 60 },
    { id: 3, name: "Room C", capacity: 40 },
    { id: 4, name: "Lab 1", capacity: 50 },
    { id: 5, name: "Lab 2", capacity: 80 }
];

const initialExams = [
    {
        id: 1,
        unit_code: "BBIT 2101",
        unit_name: "Introduction to Programming",
        exam_date: "2026-11-25",
        start_time: "09:00",
        end_time: "11:00",
        room_name: "Room A",
        enrolled: 80,
        status: "scheduled",
        clash_reason: ""
    },
    {
        id: 2,
        unit_code: "BBIT 2202",
        unit_name: "Database Management Systems",
        exam_date: "2026-11-25",
        start_time: "09:00",
        end_time: "11:00",
        room_name: "Room A",
        enrolled: 120,
        status: "pending_review",
        clash_reason: "Room capacity exceeded and room is already occupied."
    },
    {
        id: 3,
        unit_code: "BBIT 2303",
        unit_name: "Systems Analysis and Design",
        exam_date: "2026-11-26",
        start_time: "14:00",
        end_time: "16:00",
        room_name: "Room B",
        enrolled: 45,
        status: "scheduled",
        clash_reason: ""
    },
    {
        id: 4,
        unit_code: "BBIT 2404",
        unit_name: "Web Application Development",
        exam_date: "2026-11-27",
        start_time: "10:00",
        end_time: "12:00",
        room_name: "Lab 1",
        enrolled: 35,
        status: "resolved",
        clash_reason: ""
    }
];


/* =========================================================
   GENERAL HELPER FUNCTIONS
========================================================= */

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        };

        return entities[character];
    });
}

function formatDate(dateString) {
    if (!dateString) return "";

    const date = new Date(`${dateString}T00:00:00`);

    return date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}

function formatStatus(status) {
    const labels = {
        scheduled: "Scheduled",
        pending_review: "Pending Review",
        resolved: "Resolved"
    };

    return labels[status] || status;
}

function timeToMinutes(time) {
    if (!time) return 0;

    const [hours, minutes] = time.split(":").map(Number);

    return hours * 60 + minutes;
}

function minutesToTime(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function showMessage(element, message, type = "error") {
    if (!element) return;

    element.textContent = message;
    element.className = `message ${type}`;
    element.style.display = "block";
}

function hideMessage(element) {
    if (!element) return;

    element.style.display = "none";
}


/* =========================================================
   API HELPER FUNCTIONS
========================================================= */

async function getCSRFToken() {
    if (USE_MOCK_DATA) return "";

    const response = await fetch(`${API_BASE_URL}auth/csrf/`, {
        credentials: "include"
    });

    if (!response.ok) {
        throw new Error("Could not obtain CSRF token.");
    }

    const data = await response.json();

    csrfToken = data.csrfToken || data.csrf_token || "";

    return csrfToken;
}

async function apiRequest(endpoint, options = {}) {
    const headers = {
        "Content-Type": "application/json",
        ...(options.headers || {})
    };

    if (options.method && options.method !== "GET") {
        if (!csrfToken) {
            await getCSRFToken();
        }

        headers["X-CSRFToken"] = csrfToken;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
        credentials: "include"
    });

    if (response.status === 204) {
        return null;
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(
            data.detail ||
            data.message ||
            "Something went wrong. Please try again."
        );
    }

    return data;
}


/* =========================================================
   AUTHENTICATION
========================================================= */

async function loginAdmin(username, password) {
    if (USE_MOCK_DATA) {
        if (username === "admin" && password === "admin123") {
            sessionStorage.setItem(AUTH_KEY, "true");
            return true;
        }

        throw new Error("Invalid username or password.");
    }

    await getCSRFToken();

    await apiRequest("auth/login/", {
        method: "POST",
        body: JSON.stringify({ username, password })
    });

    return true;
}

async function verifyAdminSession() {
    if (USE_MOCK_DATA) {
        return sessionStorage.getItem(AUTH_KEY) === "true";
    }

    try {
        const user = await apiRequest("auth/me/");

        return user && user.is_staff === true;
    } catch (error) {
        return false;
    }
}

async function logoutAdmin() {
    if (!USE_MOCK_DATA) {
        try {
            await apiRequest("auth/logout/", {
                method: "POST",
                body: JSON.stringify({})
            });
        } catch (error) {
            console.error("Logout error:", error);
        }
    }

    sessionStorage.removeItem(AUTH_KEY);

    window.location.href = "login.html";
}

async function checkAdminAccess() {
    const page = window.location.pathname.split("/").pop();

    const isLoginPage = page === "login.html" || page === "";

    const authenticated = await verifyAdminSession();

    if (!authenticated && !isLoginPage) {
        window.location.href = "login.html";
        return false;
    }

    if (authenticated && isLoginPage) {
        window.location.href = "dashboard.html";
        return false;
    }

    return true;
}

function initializeLogout() {
    const logoutButton = document.getElementById("logoutBtn");

    if (logoutButton) {
        logoutButton.addEventListener("click", logoutAdmin);
    }
}


/* =========================================================
   EXAM DATA SERVICE
========================================================= */

function initializeMockData() {
    if (!localStorage.getItem(STORAGE_KEY)) {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(initialExams)
        );
    }
}

async function getExams() {
    if (USE_MOCK_DATA) {
        initializeMockData();

        return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    }

    const data = await apiRequest("exams/");

    return Array.isArray(data) ? data : data.results || [];
}

async function saveExam(exam) {
    if (USE_MOCK_DATA) {
        const exams = await getExams();

        if (exam.id) {
            const index = exams.findIndex(
                item => String(item.id) === String(exam.id)
            );

            if (index !== -1) {
                exams[index] = { ...exams[index], ...exam };
            } else {
                exams.push(exam);
            }
        } else {
            exam.id = Date.now();
            exams.push(exam);
        }

        localStorage.setItem(STORAGE_KEY, JSON.stringify(exams));

        return exam;
    }

    const isEditing = Boolean(exam.id);

    const endpoint = isEditing
        ? `exams/${exam.id}/`
        : "exams/";

    return await apiRequest(endpoint, {
        method: isEditing ? "PUT" : "POST",
        body: JSON.stringify(exam)
    });
}

async function deleteExam(id) {
    if (USE_MOCK_DATA) {
        const exams = await getExams();

        const updated = exams.filter(
            exam => String(exam.id) !== String(id)
        );

        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

        return true;
    }

    await apiRequest(`exams/${id}/`, {
        method: "DELETE"
    });

    return true;
}


/* =========================================================
   CLASH DETECTION - MOCK MODE
========================================================= */

function detectClash(exam) {
    const allExams = JSON.parse(
        localStorage.getItem(STORAGE_KEY) || "[]"
    );

    const selectedRoom = rooms.find(
        room => room.name === exam.room_name
    );

    if (selectedRoom && Number(exam.enrolled) > selectedRoom.capacity) {
        return {
            hasClash: true,
            reason: `Room capacity exceeded. ${exam.enrolled} students are enrolled, but ${selectedRoom.name} holds only ${selectedRoom.capacity}.`
        };
    }

    const conflictingExam = allExams.find(existing => {
        if (String(existing.id) === String(exam.id)) {
            return false;
        }

        if (existing.status === "resolved") {
            return false;
        }

        if (
            existing.exam_date !== exam.exam_date ||
            existing.room_name !== exam.room_name
        ) {
            return false;
        }

        const newStart = timeToMinutes(exam.start_time);
        const newEnd = timeToMinutes(exam.end_time);

        const existingStart = timeToMinutes(existing.start_time);
        const existingEnd = timeToMinutes(existing.end_time);

        return newStart < existingEnd && newEnd > existingStart;
    });

    if (conflictingExam) {
        return {
            hasClash: true,
            reason: `Room is already booked for ${conflictingExam.unit_code} during this time.`
        };
    }

    return {
        hasClash: false,
        reason: ""
    };
}


/* =========================================================
   LOGIN PAGE
========================================================= */

function initializeLogin() {
    const loginForm = document.getElementById("loginForm");

    if (!loginForm) return;

    const errorElement = document.getElementById("loginError");

    loginForm.addEventListener("submit", async event => {
        event.preventDefault();

        hideMessage(errorElement);

        const username = document.getElementById("username").value.trim();
        const password = document.getElementById("password").value;

        if (!username || !password) {
            showMessage(
                errorElement,
                "Please enter your username and password."
            );

            return;
        }

        const submitButton = loginForm.querySelector(
            'button[type="submit"]'
        );

        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = "Logging in...";
        }

        try {
            await loginAdmin(username, password);

            window.location.href = "dashboard.html";
        } catch (error) {
            showMessage(errorElement, error.message);
        } finally {
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = "Login";
            }
        }
    });
}


/* =========================================================
   DASHBOARD
========================================================= */

async function initializeDashboard() {
    const tableBody = document.getElementById("examTableBody");

    if (!tableBody) return;

    const filter = document.getElementById("statusFilter");

    if (filter) {
        filter.addEventListener("change", updateDashboard);
    }

    tableBody.addEventListener("click", async event => {
        const deleteButton = event.target.closest(".delete-exam");

        if (deleteButton) {
            const id = deleteButton.dataset.id;

            if (confirm("Are you sure you want to delete this exam?")) {
                try {
                    await deleteExam(id);
                    await updateDashboard();
                } catch (error) {
                    alert(error.message);
                }
            }
        }
    });

    await updateDashboard();
}

async function updateDashboard() {
    try {
        const exams = await getExams();

        const filter = document.getElementById("statusFilter");

        const selectedStatus = filter ? filter.value : "all";

        const filteredExams = selectedStatus === "all"
            ? exams
            : exams.filter(exam => exam.status === selectedStatus);

        renderTable(filteredExams);

        updateDashboardCounts(exams);

    } catch (error) {
        console.error(error);

        const tableBody = document.getElementById("examTableBody");

        if (tableBody) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6">Unable to load exams.</td>
                </tr>
            `;
        }
    }
}

function renderTable(exams) {
    const tableBody = document.getElementById("examTableBody");

    if (!tableBody) return;

    if (exams.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6">No exams found.</td>
            </tr>
        `;

        return;
    }

    tableBody.innerHTML = exams.map(exam => `
        <tr>
            <td>
                <strong>${escapeHTML(exam.unit_code)}</strong><br>
                <small>${escapeHTML(exam.unit_name)}</small>
            </td>

            <td>${escapeHTML(formatDate(exam.exam_date))}</td>

            <td>
                ${escapeHTML(exam.start_time)}
                -
                ${escapeHTML(exam.end_time)}
            </td>

            <td>${escapeHTML(exam.room_name)}</td>

            <td>
                <span class="status-badge ${escapeHTML(exam.status)}">
                    ${escapeHTML(formatStatus(exam.status))}
                </span>
            </td>

            <td>
                <a href="exam-form.html?id=${encodeURIComponent(exam.id)}"
                   class="edit-btn">
                    Edit
                </a>

                <button
                    type="button"
                    class="delete-exam"
                    data-id="${escapeHTML(exam.id)}">
                    Delete
                </button>
            </td>
        </tr>
    `).join("");
}

function updateDashboardCounts(exams) {
    const total = exams.length;

    const scheduled = exams.filter(
        exam => exam.status === "scheduled"
    ).length;

    const pending = exams.filter(
        exam => exam.status === "pending_review"
    ).length;

    const resolved = exams.filter(
        exam => exam.status === "resolved"
    ).length;

    const totalElement = document.getElementById("totalExams");
    const scheduledElement = document.getElementById("scheduledExams");
    const pendingElement = document.getElementById("pendingExams");
    const resolvedElement = document.getElementById("resolvedExams");
    const clashCount = document.getElementById("clashCount");

    if (totalElement) totalElement.textContent = total;
    if (scheduledElement) scheduledElement.textContent = scheduled;
    if (pendingElement) pendingElement.textContent = pending;
    if (resolvedElement) resolvedElement.textContent = resolved;
    if (clashCount) clashCount.textContent = pending;
}


/* =========================================================
   EXAM FORM
========================================================= */

async function initializeExamForm() {
    const form = document.getElementById("examForm");

    if (!form) return;

    const params = new URLSearchParams(window.location.search);
    const examId = params.get("id");

    const warning = document.getElementById("clashWarning");
    const warningText = document.getElementById("clashWarningText");

    const title = document.getElementById("formTitle");

    if (title) {
        title.textContent = examId ? "Edit Exam" : "Log New Exam";
    }

    const roomSelect = document.getElementById("room");

    if (roomSelect) {
        roomSelect.innerHTML = `
            <option value="">Select a room</option>
            ${rooms.map(room => `
                <option value="${escapeHTML(room.name)}">
                    ${escapeHTML(room.name)} - ${room.capacity} seats
                </option>
            `).join("")}
        `;
    }

    if (examId) {
        try {
            const exams = await getExams();

            const exam = exams.find(
                item => String(item.id) === String(examId)
            );

            if (!exam) {
                alert("Exam not found.");
                window.location.href = "dashboard.html";
                return;
            }

            document.getElementById("unit").value =
                exam.unit_code || "";

            document.getElementById("examDate").value =
                exam.exam_date || "";

            document.getElementById("startTime").value =
                exam.start_time || "";

            document.getElementById("endTime").value =
                exam.end_time || "";

            document.getElementById("room").value =
                exam.room_name || "";

        } catch (error) {
            alert(error.message);
            return;
        }
    }

    form.addEventListener("submit", async event => {
        event.preventDefault();

        hideMessage(warning);

        const unitCode = document.getElementById("unit").value.trim();
        const examDate = document.getElementById("examDate").value;
        const startTime = document.getElementById("startTime").value;
        const endTime = document.getElementById("endTime").value;
        const roomName = document.getElementById("room").value;

        if (
            !unitCode ||
            !examDate ||
            !startTime ||
            !endTime ||
            !roomName
        ) {
            showMessage(
                warning,
                "Please fill in all the required fields."
            );

            return;
        }

        if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
            showMessage(
                warning,
                "End time must be later than start time."
            );

            return;
        }

        const exams = await getExams();

        const existingExam = examId
            ? exams.find(item => String(item.id) === String(examId))
            : null;

        const exam = {
            id: examId || undefined,
            unit_code: unitCode,
            unit_name: existingExam?.unit_name || unitCode,
            exam_date: examDate,
            start_time: startTime,
            end_time: endTime,
            room_name: roomName,
            enrolled: existingExam?.enrolled || 50,
            status: existingExam?.status || "scheduled",
            clash_reason: existingExam?.clash_reason || ""
        };

        const submitButton = form.querySelector(
            'button[type="submit"]'
        );

        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = "Saving...";
        }

        try {
            if (USE_MOCK_DATA) {
                const clash = detectClash(exam);

                exam.status = clash.hasClash
                    ? "pending_review"
                    : "scheduled";

                exam.clash_reason = clash.reason;
            }

            const savedExam = await saveExam(exam);

            if (
                savedExam.status === "pending_review" &&
                savedExam.clash_reason
            ) {
                showMessage(
                    warning,
                    `Exam saved, but requires review: ${savedExam.clash_reason}`,
                    "warning"
                );

                return;
            }

            alert("Exam saved successfully!");

            window.location.href = "dashboard.html";

        } catch (error) {
            showMessage(warning, error.message);
        } finally {
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = "Save Exam";
            }
        }
    });
}


/* =========================================================
   CLASH REVIEW PAGE
========================================================= */

async function initializeClashPage() {
    const container = document.getElementById("clashContainer");

    if (!container) return;

    container.addEventListener("click", async event => {
        const button = event.target.closest(".save-recheck");

        if (!button) return;

        const card = button.closest(".clash-card");

        const id = card.dataset.id;

        const room = card.querySelector(".new-room").value;
        const date = card.querySelector(".new-date").value;
        const startTime = card.querySelector(".new-time").value;

        if (!room || !date || !startTime) {
            alert("Please complete all reassignment fields.");
            return;
        }

        try {
            button.disabled = true;
            button.textContent = "Checking...";

            const exams = await getExams();

            const exam = exams.find(
                item => String(item.id) === String(id)
            );

            if (!exam) {
                throw new Error("Exam not found.");
            }

            const duration =
                timeToMinutes(exam.end_time) -
                timeToMinutes(exam.start_time);

            const endMinutes = timeToMinutes(startTime) + duration;

            if (endMinutes > 1440) {
                throw new Error(
                    "The new exam time cannot extend past midnight."
                );
            }

            const updatedExam = {
                ...exam,
                room_name: room,
                exam_date: date,
                start_time: startTime,
                end_time: minutesToTime(endMinutes)
            };

            const result = await reassignExam(updatedExam);

            if (result.status === "resolved") {
                alert("Clash resolved successfully!");
            } else {
                alert(
                    result.clash_reason ||
                    "The exam still has a clash. Please choose another slot."
                );
            }

            await renderClashes();

        } catch (error) {
            alert(error.message);
        } finally {
            button.disabled = false;
            button.textContent = "Save & Re-check";
        }
    });

    await renderClashes();
}

async function renderClashes() {
    const container = document.getElementById("clashContainer");

    if (!container) return;

    try {
        const exams = await getExams();

        const clashes = exams.filter(
            exam => exam.status === "pending_review"
        );

        const count = document.getElementById("clashPageCount");

        if (count) {
            count.textContent = clashes.length;
        }

        if (clashes.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>No pending clashes</h3>
                    <p>All exams are currently resolved.</p>
                </div>
            `;

            return;
        }

        container.innerHTML = clashes.map(exam => `
            <div class="clash-card" data-id="${escapeHTML(exam.id)}">

                <div class="clash-details">
                    <h3>
                        ${escapeHTML(exam.unit_code)}
                        - ${escapeHTML(exam.unit_name)}
                    </h3>

                    <p>
                        <strong>Current date:</strong>
                        ${escapeHTML(formatDate(exam.exam_date))}
                    </p>

                    <p>
                        <strong>Current time:</strong>
                        ${escapeHTML(exam.start_time)}
                        -
                        ${escapeHTML(exam.end_time)}
                    </p>

                    <p>
                        <strong>Current room:</strong>
                        ${escapeHTML(exam.room_name)}
                    </p>

                    <p class="clash-reason">
                        <strong>Reason:</strong>
                        ${escapeHTML(exam.clash_reason || "Requires review")}
                    </p>
                </div>

                <div class="reassignment-form">

                    <h4>Reassign Exam</h4>

                    <label>New Room</label>

                    <select class="new-room" required>
                        <option value="">Select room</option>

                        ${rooms.map(room => `
                            <option value="${escapeHTML(room.name)}">
                                ${escapeHTML(room.name)}
                                (${room.capacity} seats)
                            </option>
                        `).join("")}

                    </select>

                    <label>New Date</label>

                    <input
                        type="date"
                        class="new-date"
                        value="${escapeHTML(exam.exam_date)}"
                        required
                    >

                    <label>New Start Time</label>

                    <input
                        type="time"
                        class="new-time"
                        value="${escapeHTML(exam.start_time)}"
                        required
                    >

                    <button type="button" class="save-recheck">
                        Save & Re-check
                    </button>

                </div>

            </div>
        `).join("");

    } catch (error) {
        console.error(error);

        container.innerHTML = `
            <p>Unable to load pending clashes.</p>
        `;
    }
}


/* =========================================================
   REASSIGN AND RE-CHECK EXAM
========================================================= */

async function reassignExam(exam) {
    if (USE_MOCK_DATA) {
        const clash = detectClash(exam);

        exam.status = clash.hasClash
            ? "pending_review"
            : "resolved";

        exam.clash_reason = clash.reason;

        await saveExam(exam);

        return exam;
    }

    return await apiRequest(
        `exams/${exam.id}/reassign/`,
        {
            method: "POST",
            body: JSON.stringify({
                room_name: exam.room_name,
                exam_date: exam.exam_date,
                start_time: exam.start_time,
                end_time: exam.end_time
            })
        }
    );
}


/* =========================================================
   APPLICATION INITIALIZATION
========================================================= */

document.addEventListener("DOMContentLoaded", async () => {
    const hasAccess = await checkAdminAccess();

    if (!hasAccess) return;

    initializeLogout();

    initializeLogin();

    initializeDashboard();

    initializeExamForm();

    initializeClashPage();
});