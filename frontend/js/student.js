const API_BASE_URL = window.API_BASE_URL || "";

document.addEventListener("DOMContentLoaded", () => {
    const searchForm = document.getElementById("student-search-form");
    const searchInput = document.getElementById("student-search-input");
    const studentIdDisplay = document.getElementById("student-id-display");
    const errorBanner = document.getElementById("error-banner");
    const errorMessage = document.getElementById("error-message");
    const loadingState = document.getElementById("loading-state");
    const emptyState = document.getElementById("empty-state");
    const examTable = document.getElementById("exam-table");
    const examTbody = document.getElementById("exam-tbody");

    const initialStudentNo = new URLSearchParams(window.location.search).get("student_no") || "";
    if (searchInput) searchInput.value = initialStudentNo;
    if (initialStudentNo) loadTimetable(initialStudentNo);
    else showError("Enter a student number to view a timetable.");

    searchForm?.addEventListener("submit", event => {
        event.preventDefault();
        const studentNo = searchInput.value.trim();
        if (studentNo) {
            window.history.replaceState({}, "", `?student_no=${encodeURIComponent(studentNo)}`);
            loadTimetable(studentNo);
        }
    });

    async function loadTimetable(studentNo) {
        if (studentIdDisplay) studentIdDisplay.textContent = studentNo;
        if (loadingState) {
            loadingState.textContent = `Loading timetable for Student ID: ${studentNo}...`;
            loadingState.style.display = "block";
        }
        try {
            const response = await fetch(
                `${API_BASE_URL}/api/timetable/${encodeURIComponent(studentNo)}/`
            );
            const data = await response.json().catch(() => ({}));
            if (response.status === 404) throw new Error("Admission number not found");
            if (!response.ok) throw new Error(data.error || "Unable to load timetable.");
            renderTimetable(data.exams || []);
        } catch (error) {
            showError(error.message || "Unable to load timetable. Please try again.");
        }
    }

    function renderTimetable(exams) {
        if (loadingState) loadingState.style.display = "none";
        if (errorBanner) errorBanner.style.display = "none";

        if (!exams.length) {
            if (emptyState) emptyState.style.display = "block";
            if (examTable) examTable.style.display = "none";
            return;
        }

        if (emptyState) emptyState.style.display = "none";
        if (examTable) examTable.style.display = "table";
        if (!examTbody) return;

        examTbody.replaceChildren();
        exams.forEach(exam => {
            const row = document.createElement("tr");
            [
                exam.unit_code || "TBC",
                exam.unit_name || "TBC",
                exam.exam_date || "TBC",
                formatTimeRange(exam.start_time, exam.end_time),
                exam.room_name || "TBC",
            ].forEach(value => {
                const cell = document.createElement("td");
                cell.textContent = value;
                row.appendChild(cell);
            });

            const statusCell = document.createElement("td");
            statusCell.appendChild(createStatusBadge(exam.status, exam.clash_reason));
            row.appendChild(statusCell);
            examTbody.appendChild(row);
        });
    }

    function showError(message) {
        if (loadingState) loadingState.style.display = "none";
        if (examTable) examTable.style.display = "none";
        if (emptyState) emptyState.style.display = "none";
        if (errorBanner) errorBanner.style.display = "block";
        if (errorMessage) errorMessage.textContent = message;
    }
});

function formatTimeRange(startTime, endTime) {
    if (!startTime || !endTime) return "TBC";
    return `${startTime.slice(0, 5)} - ${endTime.slice(0, 5)}`;
}

function createStatusBadge(status, clashReason) {
    const normalised = (status || "").toLowerCase().trim();
    const config = {
        scheduled: { modifier: "badge-scheduled", label: "Scheduled" },
        pending_review: { modifier: "badge-pending_review", label: "Clash Flagged" },
        resolved: { modifier: "badge-resolved", label: "Resolved" },
    };
    const fallback = Boolean(clashReason) ? "pending_review" : "scheduled";
    const { modifier, label } = config[normalised] || config[fallback];
    const span = document.createElement("span");
    span.className = `badge ${modifier}`;
    span.textContent = label;
    return span;
}