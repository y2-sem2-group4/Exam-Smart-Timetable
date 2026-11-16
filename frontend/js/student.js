document.addEventListener("DOMContentLoaded", () => {
    // Extract student_no from the URL path, or default to "12345" for local testing
    const pathSegments = window.location.pathname.split("/").filter(Boolean);
    let studentNo = pathSegments[pathSegments.length - 1];
    
    // Fallback for local testing so it loads valid data instead of "timetable.html"
    if (!studentNo || studentNo === "timetable.html" || studentNo === "student") {
        studentNo = "12345"; // Change to "999" anytime to test the error state!
    }

    const studentIdDisplay = document.getElementById("student-id-display");
    const errorBanner = document.getElementById("error-banner");
    const errorMessage = document.getElementById("error-message");
    const examTable = document.getElementById("exam-table");
    const examTbody = document.getElementById("exam-tbody");

    if (studentIdDisplay) {
        studentIdDisplay.textContent = studentNo;
    }

    // Mock Database of student exams (Placeholder until backend API is plugged in)
    const mockDatabase = {
        "12345": [
            { code: "BBT 2103", name: "Software Engineering", date: "2026-12-03", time: "09:00 AM", room: "MSB 2", status: "confirmed" },
            { code: "ICS 1104", name: "Discrete Mathematics", date: "2026-12-05", time: "02:00 PM", room: "LH 1", status: "clash" }
        ],
        "67890": [
            { code: "BBT 2102", name: "Advanced Database Systems", date: "2026-12-04", time: "09:00 AM", room: "Lab A", status: "confirmed" }
        ]
    };

    // Validate student number and render data or error
    if (studentNo && mockDatabase[studentNo]) {
        if (errorBanner) errorBanner.style.display = "none";
        if (examTable) examTable.style.display = "table";
        
        const exams = mockDatabase[studentNo];
        if (examTbody) {
            examTbody.innerHTML = "";

            exams.forEach(exam => {
                const row = document.createElement("tr");
                row.innerHTML = `
                    <td>${exam.code}</td>
                    <td>${exam.name}</td>
                    <td>${exam.date}</td>
                    <td>${exam.time}</td>
                    <td>${exam.room}</td>
                    <td><span class="badge badge-${exam.status}">${exam.status}</span></td>
                `;
                examTbody.appendChild(row);
            });
        }
    } else {
        // Clean error state for invalid student number
        if (examTable) examTable.style.display = "none";
        if (errorBanner) errorBanner.style.display = "block";
        if (errorMessage) {
            errorMessage.textContent = `Error: Student number "${studentNo}" was not found in the system.`;
        }
    }
});