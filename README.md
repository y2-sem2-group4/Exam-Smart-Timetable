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

### Demo walkthrough

Load repeatable demo data and create a local administrator account:

```bash
python manage.py seed_demo
python manage.py createsuperuser
```

After logging in at `/frontend/admin/login.html`, use **Find student** on the
dashboard to enter an admission number and open that student's live timetable.
The student portal remains available without login from the landing page.

### Frontend

No build step — it's plain HTML/CSS/JS. Django serves the frontend during local
development, so after starting the backend open:

`http://localhost:8000/`

The homepage links to the student and administrator portals. The admin pages
require a successful staff login and redirect back to `login.html` when no
admin session exists. The student timetable does not require login:

`http://localhost:8000/frontend/student/timetable.html?student_no=ST001`

The frontend is mounted at `/frontend/`; Django's built-in admin remains at
`/admin/`. There is no need to run Live Server as well.

Alternatively, to run the frontend independently:

```bash
cd frontend
python -m http.server 5500
```

Frontend runs at `http://localhost:5500`.

### Deploying on Render

This repository includes [`render.yaml`](./render.yaml), which deploys the
Django backend and frontend as one Render web service. The frontend is served
by Django at `/frontend/`, so a separate static-site service is not required.

1. Push the repository to GitHub.
2. In Render, choose **New → Blueprint** and select the repository.
3. Keep the blueprint settings and create the service.
4. In the service's environment variables, set `DATABASE_URL` to your
   Supabase/PostgreSQL connection string. Do not commit this value.
5. Redeploy if you changed an environment variable.

Render runs these commands automatically:

```text
pip install -r requirements.txt
python manage.py collectstatic --noinput
python manage.py migrate
gunicorn ESTBackend.wsgi:application
```

After deployment, open:

```text
https://<your-render-service>.onrender.com/frontend/student/timetable.html?student_no=ST001
```

The root URL serves the landing homepage. The admin dashboard uses the live
login, units, rooms, exams, and reassign endpoints; create a Django staff user
before logging in. The student timetable/API is public and read-only.

For a custom domain, add it to `ALLOWED_HOSTS` and
`CSRF_TRUSTED_ORIGINS` in Render (for example,
`ALLOWED_HOSTS=.onrender.com,example.com` and
`CSRF_TRUSTED_ORIGINS=https://*.onrender.com,https://example.com`).

**Note:** because frontend and backend run on different ports, the browser will block API calls by default (CORS). Backend team handles this via `django-cors-headers` — if you're on frontend and getting blocked requests, that's not something you need to fix yourself, flag it instead.

---

## API Endpoints (backend team fills this in as they're built)

| Endpoint | Method | Returns | Status |
|---|---|---|---|
| `/api/exams/` | GET | List of all exams | 200 |
| `/api/exams/` | POST | Create new exam (admin only) | 201 / 403 |
| `/api/exams/?status=pending_review` | GET | Filter exams by status | 200 |
| `/api/exams/<id>/reassign/` | PATCH | Reassign exam (admin only) | 200 / 403 |
| `/api/units/` | GET | List units for admin forms | 200 |
| `/api/rooms/` | GET | List rooms for admin forms | 200 |
| `/api/admin/login/` | POST | Start an admin session | 200 / 401 |
| `/api/timetable/<student_no>/` | GET | One student's enrolled exams | 200 / 404 / 500 |

The student timetable endpoint is public and read-only. Unknown admission numbers
return `404 Not Found`; mutation methods return `405 Method Not Allowed`. A successful
response has this shape:

```json
{
  "admission_number": "ST001",
  "exams": [
    {
      "unit_code": "MAT101",
      "unit_name": "Maths",
      "room_name": "Room A",
      "exam_date": "2026-12-01",
      "start_time": "09:00:00",
      "end_time": "11:00:00",
      "status": "scheduled",
      "clash_reason": null
    }
  ]
}
```

Backend statuses are `scheduled`, `pending_review`, and `resolved`. The student
client maps `scheduled` and `resolved` to **Confirmed**, `pending_review` or any
non-empty `clash_reason` to **Clash Flagged**, and unknown statuses to **Pending**.
An unassigned room is returned as `null`; the student client displays it as `TBC`.

### Connecting the clients

Start the backend from `backend/`:

```bash
python manage.py runserver
```

Start the frontend from `frontend/`:

```bash
python -m http.server 5500
```

Open the student page with the admission number in the query string:
`http://localhost:5500/student/timetable.html?student_no=ST001`.
`frontend/js/student.js` calls `/api/timetable/ST001/` when served by Django.
If the frontend runs on another host or port, set `window.API_BASE_URL` before
loading `student.js`. The backend accepts JSON admin requests at
`/api/exams/`; POST requests require an authenticated staff user.

Backend team: update this table as each endpoint goes live, so frontend isn't guessing.

### Loading demo data

Create an administrator explicitly; the project never seeds a superuser or
password:

```bash
cd backend
python manage.py createsuperuser
python manage.py seed_demo
```

`seed_demo` is safe to run more than once. It creates sample students, units,
rooms, enrolments, and exams demonstrating a shared-student clash, a
room-capacity clash, and a valid back-to-back pair. For Render's free tier,
run these commands locally with `DATABASE_URL` set to the Supabase database,
then log in to `/admin/` with the superuser you created.

---

## Contributing

Branching rules, commit format, PR process, and what "done" means before merging — see [`CONTRIBUTING.md`](./CONTRIBUTING.md). Read it before your first PR.

---

## Team & Modules

| Module | Owners | Covers |
|---|---|---|
| Backend Core | Edith, Lenny | Models, clash-detection logic, database |
| Admin Interface | Angel, Daniel | Exam logging, dashboard, clash review |
| Student Interface | June, Craig | Read-only timetable lookup |
