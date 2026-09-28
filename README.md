# Exam Smart Timetable

A system that automatically detects and resolves student exam schedule conflicts and optimises room allocations.

**Course:** BBT 2103 Software Engineering | Strathmore University | Group D, Group 4
**Team:** Edith, Lenny, Craig, Daniel, June, Angel

---

## What this is

Admins log exams. The system automatically checks every new exam against existing ones — flags it if it clashes with another exam sharing a student, or if the room's too small. Admins fix flagged exams. Students check their own timetable, read-only, no login needed.

Full breakdown of requirements and modules: see the SRS & Work Plan doc.

---

## Tech Stack

| Layer | Tech |
|---|---|
| Backend | Django (Python) — returns JSON only, no HTML templates |
| Frontend | Vanilla HTML/CSS/JS — calls the backend via `fetch()` |
| Database | Supabase (PostgreSQL) |
| Version control | GitHub — see `CONTRIBUTING.md` for branching/PR rules |

**Why backend and frontend are split like this:** the backend team doesn't touch frontend files, the frontend team doesn't touch Django. Backend only needs to expose JSON endpoints; frontend only needs to know what shape of data comes back and where to fetch it from.

---

## Folder Structure

```
Exam-Smart-Timetable/
├── backend/
│   ├── manage.py
│   ├── config/               # Django project settings, root URLs
│   ├── scheduler/
│   │   ├── models.py         # Student, Room, Exam, Enrollment
│   │   ├── views.py          # returns JSON, not HTML
│   │   ├── urls.py
│   │   ├── services.py       # clash-detection logic lives here
│   │   └── tests.py
│   └── requirements.txt
├── frontend/
│   ├── admin/
│   │   ├── dashboard.html
│   │   ├── exam-form.html
│   │   └── clash-review.html
│   ├── student/
│   │   └── timetable.html
│   ├── css/
│   │   └── style.css
│   └── js/
│       ├── admin.js
│       └── student.js
├── CONTRIBUTING.md
└── README.md
```

---

## Getting Set Up Locally

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Add your Supabase connection details to `config/settings.py` (ask Edith or Lenny for the credentials — never commit them directly, use a `.env` file instead).

```bash
python manage.py migrate
python manage.py runserver
```

Backend runs at `http://localhost:8000`.

### Frontend

No build step — it's plain HTML/CSS/JS. Open the relevant `.html` file directly in your browser, or run a simple local server:

```bash
cd frontend
python -m http.server 5500
```

Frontend runs at `http://localhost:5500`.

**Note:** because frontend and backend run on different ports, the browser will block API calls by default (CORS). Backend team handles this via `django-cors-headers` — if you're on frontend and getting blocked requests, that's not something you need to fix yourself, flag it instead.

---

## API Endpoints (backend team fills this in as they're built)

| Endpoint | Method | Returns | Status |
|---|---|---|---|
| `/api/exams/` | GET | List of all exams | TBD |
| `/api/exams/` | POST | Create new exam (admin only) | TBD |
| `/api/exams/<id>/` | PUT | Update/reassign exam (admin only) | TBD |
| `/api/timetable/<student_no>/` | GET | One student's exams | TBD |

Backend team: update this table as each endpoint goes live, so frontend isn't guessing.

---

## Contributing

Branching rules, commit format, PR process, and what "done" means before merging — see [`CONTRIBUTING.md`](./CONTRIBUTING.md). Read it before your first PR.

---

## Team & Modules

| Module | Owners | Covers |
|---|---|---|
| Backend Core | Edith, Lenny | Models, clash-detection logic, database |
| Admin Interface | Craig, Daniel | Exam logging, dashboard, clash review |
| Student Interface | June, Angel | Read-only timetable lookup |