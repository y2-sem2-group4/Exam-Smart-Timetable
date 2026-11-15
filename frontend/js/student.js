// 1. Mock data (simulating what the backend will eventually give us)
const mockExams = [
    { module: "CS101", date: "2024-05-10", room: "Hall A", status: "confirmed" },
    { module: "CS102", date: "2024-05-12", room: "Hall B", status: "clash" },
    { module: "CS103", date: "2024-05-15", room: "TBC", status: "pending" }
];

// 2. STU-02: Helper function to create a status badge
function createStatusBadge(status) {
    const normalised = (status || "pending").toLowerCase().trim();
    const config = {
        confirmed: { modifier: "badge-confirmed", label: "Confirmed" },
        clash:     { modifier: "badge-clash",     label: "Clash Flagged" },
        pending:   { modifier: "badge-pending",   label: "Pending" },
    };

    const { modifier, label } = config[normalised] || config.pending;

    const span = document.createElement("span");
    span.className = `badge ${modifier}`;
    span.textContent = label;
    return span;
}

// 3. Render the table
const tbody = document.getElementById("timetable-body");

mockExams.forEach(exam => {
    const row = document.createElement("tr");

    // Module column
    const moduleCell = document.createElement("td");
    moduleCell.textContent = exam.module;
    row.appendChild(moduleCell);

    // Date column
    const dateCell = document.createElement("td");
    dateCell.textContent = exam.date;
    row.appendChild(dateCell);

    // Room column
    const roomCell = document.createElement("td");
    roomCell.textContent = exam.room;
    row.appendChild(roomCell);

    // Status column (Hooking in the badge here!)
    const statusCell = document.createElement("td");
    statusCell.appendChild(createStatusBadge(exam.status));
    row.appendChild(statusCell);

    tbody.appendChild(row);
});