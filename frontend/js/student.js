const API_BASE_URL = window.API_BASE_URL || "http://localhost:8000";

document.addEventListener("DOMContentLoaded", async () => {
    const studentNo = new URLSearchParams(window.location.search).get("student_no");
    const studentIdDisplay = document.getElementById("student-id-display");
    const errorBanner = document.getElementById("error-banner");
    const errorMessage = document.getElementById("error-message");
    const loadingState = document.getElementById("loading-state");
    const emptyState = document.getElementById("empty-state");
    const examTable = document.getElementById("exam-table");
    const examTbody = document.getElementById("exam-tbody");

    if (studentIdDisplay) {
        studentIdDisplay.textContent = studentNo || "unknown";
    }

    if (!studentNo) {
        showError("Enter a student number to view a timetable.");
        return;
    }

    try {
        const response = await fetch(
            `${API_BASE_URL}/api/timetable/${encodeURIComponent(studentNo)}/`
        );
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Unable to load timetable.");
        }

        renderTimetable(data.exams || []);
    } catch (error) {
        showError(error.message || "Unable to load timetable. Please try again.");
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
    const hasClash = Boolean(clashReason) || normalised === "pending_review";
    const config = {
        confirmed: { modifier: "badge-confirmed", label: "Confirmed" },
        clash: { modifier: "badge-clash", label: "Clash Flagged" },
        pending: { modifier: "badge-pending", label: "Pending" },
    };

    const badgeStatus = hasClash
        ? "clash"
        : normalised === "scheduled" || normalised === "resolved"
            ? "confirmed"
            : "pending";
    const { modifier, label } = config[badgeStatus];
    const span = document.createElement("span");
    span.className = `badge ${modifier}`;
    span.textContent = label;
    return span;
}