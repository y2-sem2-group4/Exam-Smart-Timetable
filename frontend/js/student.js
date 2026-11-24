/* Exam Smart Timetable - student portal (read-only). */

const API_BASE_URL = window.API_BASE_URL || "";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/* Same three badges as the admin dashboard (FR-08):
   scheduled      -> Scheduled
   pending_review (or any clash_reason) -> Pending Review
   resolved       -> Resolved
   anything else  -> Pending (neutral grey) */
const STATUS = {
    scheduled: { cls: "badge-scheduled", label: "Scheduled", note: "" },
    pending_review: {
        cls: "badge-pending_review",
        label: "Pending Review",
        note: "This exam may be rescheduled. Check back soon.",
    },
    resolved: {
        cls: "badge-resolved",
        label: "Resolved",
        note: "A clash was fixed. These details are up to date.",
    },
    unknown: { cls: "badge-pending", label: "Pending", note: "Details are still being confirmed." },
};

function statusKey(status, clashReason) {
    const normalised = (status || "").toLowerCase().trim();
    if (normalised === "pending_review" || String(clashReason || "").trim()) return "pending_review";
    if (normalised === "scheduled" || normalised === "resolved") return normalised;
    return "unknown";
}

/* ---------- Date / time helpers (local time, no timezone shifts) ---------- */

function parseDate(iso) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
    if (!match) return null;
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function formatDate(iso) {
    const date = parseDate(iso);
    if (!date) return "TBC";
    return `${DAYS[date.getDay()]}, ${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

function formatTimeRange(startTime, endTime) {
    if (!startTime || !endTime) return "TBC";
    return `${startTime.slice(0, 5)}\u2013${endTime.slice(0, 5)}`;
}

function toDateTime(iso, time) {
    const date = parseDate(iso);
    if (!date || !time) return null;
    const [hours, minutes] = time.split(":");
    date.setHours(Number(hours), Number(minutes), 0, 0);
    return date;
}

function sortExams(exams) {
    const key = exam => `${exam.exam_date || "9999-99-99"} ${exam.start_time || "99:99"}`;
    return [...exams].sort((a, b) => key(a).localeCompare(key(b)));
}

function relativeDay(start, now) {
    if (start <= now) return "In progress";
    const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const days = Math.round((startDay - today) / 86400000);
    if (days === 0) return "Today";
    if (days === 1) return "Tomorrow";
    return `In ${days} days`;
}

/* ---------- Page logic ---------- */

document.addEventListener("DOMContentLoaded", () => {
    const $ = id => document.getElementById(id);
    const searchForm = $("student-search-form");
    const searchInput = $("student-search-input");
    const searchButton = $("search-btn");
    const errorBanner = $("error-banner");
    const errorMessage = $("error-message");
    const loadingState = $("loading-state");
    const emptyState = $("empty-state");
    const results = $("results");
    const summary = $("results-summary");
    const nextExam = $("next-exam");
    const examTbody = $("exam-tbody");

    let requestId = 0; // ignores out-of-date responses if the student searches twice quickly

    const initialStudentNo = new URLSearchParams(window.location.search).get("student_no") || "";
    searchInput.value = initialStudentNo;
    if (initialStudentNo) loadTimetable(initialStudentNo);
    else showError("Enter an admission number to view a timetable.");

    searchForm.addEventListener("submit", event => {
        event.preventDefault();
        const studentNo = searchInput.value.trim();
        if (!studentNo) return;
        window.history.replaceState({}, "", `?student_no=${encodeURIComponent(studentNo)}`);
        loadTimetable(studentNo);
    });

    function resetView() {
        errorBanner.classList.add("hidden"); // clears any stale error before a new search
        emptyState.classList.add("hidden");
        results.classList.add("hidden");
        nextExam.classList.add("hidden");
    }

    async function loadTimetable(studentNo) {
        const thisRequest = ++requestId;
        resetView();
        loadingState.textContent = `Loading timetable for ${studentNo}\u2026`;
        loadingState.classList.remove("hidden");
        searchButton.disabled = true;

        try {
            const response = await fetch(
                `${API_BASE_URL}/api/timetable/${encodeURIComponent(studentNo)}/`
            );
            const data = await response.json().catch(() => ({}));
            if (thisRequest !== requestId) return;
            if (response.status === 404) {
                throw new Error("Admission number not found. Check it and try again.");
            }
            if (!response.ok) throw new Error(data.error || "Unable to load timetable.");
            renderTimetable(studentNo, data.exams || []);
        } catch (error) {
            if (thisRequest !== requestId) return;
            showError(error.message || "Unable to load timetable. Please try again.");
        } finally {
            if (thisRequest === requestId) searchButton.disabled = false;
        }
    }

    function renderTimetable(studentNo, exams) {
        loadingState.classList.add("hidden");
        errorBanner.classList.add("hidden");

        if (!exams.length) {
            emptyState.classList.remove("hidden");
            return;
        }

        const sorted = sortExams(exams);
        const now = new Date();
        const upcoming = sorted.find(exam => {
            const end = toDateTime(exam.exam_date, exam.end_time);
            return end && end >= now;
        });

        summary.textContent = `${sorted.length} ${sorted.length === 1 ? "exam" : "exams"} for ${studentNo}`;
        examTbody.replaceChildren();
        sorted.forEach(exam => examTbody.appendChild(buildRow(exam, exam === upcoming, now)));
        renderNextExam(upcoming, now);
        results.classList.remove("hidden");
    }

    function renderNextExam(exam, now) {
        if (!exam) {
            nextExam.classList.add("hidden");
            return;
        }
        const start = toDateTime(exam.exam_date, exam.start_time);
        $("next-title").textContent = `${exam.unit_code || "TBC"} \u2013 ${exam.unit_name || "TBC"}`;
        $("next-when").textContent =
            `${formatDate(exam.exam_date)} \u00B7 ${formatTimeRange(exam.start_time, exam.end_time)}`;
        const meta = [`Room: ${exam.room_name || "TBC"}`];
        if (start) meta.unshift(relativeDay(start, now));
        if (statusKey(exam.status, exam.clash_reason) === "pending_review") meta.push("may be rescheduled");
        $("next-meta").textContent = meta.join(" \u00B7 ");
        nextExam.classList.remove("hidden");
    }

    function buildRow(exam, isNext, now) {
        const row = document.createElement("tr");
        row.setAttribute("role", "row");
        const end = toDateTime(exam.exam_date, exam.end_time);
        if (isNext) row.classList.add("is-next");
        else if (end && end < now) row.classList.add("is-past");

        [
            ["Course code", exam.unit_code || "TBC"],
            ["Course name", exam.unit_name || "TBC"],
            ["Date", formatDate(exam.exam_date)],
            ["Time", formatTimeRange(exam.start_time, exam.end_time)],
            ["Room", exam.room_name || "TBC"],
        ].forEach(([label, value]) => {
            const cell = document.createElement("td");
            cell.setAttribute("role", "cell");
            cell.dataset.label = label;
            cell.textContent = value;
            row.appendChild(cell);
        });

        const statusCell = document.createElement("td");
        statusCell.setAttribute("role", "cell");
        statusCell.dataset.label = "Status";
        const info = STATUS[statusKey(exam.status, exam.clash_reason)];
        const badge = document.createElement("span");
        badge.className = `badge ${info.cls}`;
        badge.textContent = info.label;
        statusCell.appendChild(badge);
        if (info.note) {
            const note = document.createElement("span");
            note.className = "flag-note";
            note.textContent = info.note;
            statusCell.appendChild(note);
        }
        row.appendChild(statusCell);
        return row;
    }

    function showError(message) {
        loadingState.classList.add("hidden");
        emptyState.classList.add("hidden");
        results.classList.add("hidden");
        errorMessage.textContent = message;
        errorBanner.classList.remove("hidden");
    }
});
