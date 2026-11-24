# Exam Smart Timetable

A web system that automatically detects exam clashes (room too small, room double-booked, a student sitting two exams at once) and lets administrators fix them, while students look up their own read-only timetable.

**Course:** BBT 2103 Software Engineering | Strathmore University | Group D
**Team:** Edith, Lenny, Craig, Daniel, June, Angel

---

## What it does

- **Admins** log in, log exams (unit, date, start/end time, room), see every exam on a dashboard, and fix flagged exams on a clash-review screen (change room, date or time, or ask the system to suggest free rooms that are big enough).
- **The system** checks every exam it saves against all the others and marks problems as **Pending Review**. When an admin fixes the cause, it re-checks and marks the exam **Resolved**.
- **Students** type their admission number and see only their own exams. No account, no editing.

Requirements and work plan: see the SRS & Work Plan document.

---

## Quick start (about 3 minutes)

Requires Python 3.8 to 3.12. No database setup is needed for local use: without `DATABASE_URL` the app uses a local SQLite file.

```bash
cd backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env              # Windows: copy .env.example .env

python manage.py migrate
python manage.py seed_demo --admin-username admin --admin-password "choose-a-password"
python manage.py runserver
```

Then open **http://localhost:8000/**. That one address serves the whole app (landing page, student portal, admin portal and the API). There is nothing else to start: no Live Server, no second port.

| Page | URL |
|---|---|
| Landing page | http://localhost:8000/ |
| Student timetable | http://localhost:8000/frontend/student/timetable.html?student_no=ST001 |
| Admin login | http://localhost:8000/frontend/admin/login.html |
| Django admin (users, raw data) | http://localhost:8000/admin/ |

Run `python manage.py seed_demo` without the admin options if you only want the sample data and plan to create a staff user yourself with `python manage.py createsuperuser`.

---

## Architecture

```
Browser (vanilla HTML / CSS / JS)
   |  fetch() + JSON, same origin
   v
Django views  (timetable/views.py)   JSON endpoints under /api/, staff session + CSRF
   |
   v
services.py                          all clash-detection rules
   |
   v
PostgreSQL (Supabase) / SQLite       via the Django ORM
```

Django serves the frontend files too (at `/frontend/`), so the pages and the API share one origin. That is why no CORS configuration is needed and why there is a single deployment. The frontend never runs on its own port.

| Layer | Tech |
|---|---|
| Backend | Django 4.2, plain JSON views (no templates) |
| Frontend | Vanilla HTML / CSS / JS, no build step |
| Database | PostgreSQL on Supabase in production; SQLite for local use and tests |
| Hosting | Render (see `render.yaml`) |
| CI/CD | GitHub Actions: tests on every push, Render deploy on merge to `main` |

### Folder structure

```
Exam-Smart-Timetable/
├── backend/
│   ├── manage.py
│   ├── requirements.txt
│   ├── .env.example
│   ├── test_exams.csv               # sample file for import_exams
│   ├── ESTBackend/                  # Django project (settings, root URLs)
│   └── timetable/
│       ├── models.py                # Student, Unit, Room, Enrolment, Exam
│       ├── services.py              # clash detection lives here
│       ├── views.py                 # JSON endpoints
│       ├── urls.py
│       ├── tests.py
│       └── management/commands/     # seed_demo, import_exams
├── frontend/
│   ├── index.html                   # landing page
│   ├── admin/                       # login, dashboard, exam-form, clash
│   ├── student/timetable.html
│   ├── css/                         # style.css, admin.css
│   └── js/                          # admin.js, student.js
├── .github/workflows/main.yml       # CI/CD
├── render.yaml                      # Render blueprint
├── CONTRIBUTING.md
└── README.md
```

---

## Clash rules

An exam is flagged **Pending Review** (with a plain-English reason) when any of these is true:

1. **Room too small:** students enrolled in the unit are more than the room's capacity (exactly equal is fine).
2. **Room double-booked:** another exam in the same room overlaps in time on the same date.
3. **Shared student:** another exam overlaps in time and at least one student is enrolled in both units. Overlapping exams with no shared students are fine.

Back-to-back exams (09:00 to 11:00, then 11:00 to 13:00) do **not** overlap. When a clash is found, **both** exams are flagged. When an exam is re-checked or reassigned, the system re-evaluates the pending exams on the affected dates, so the partner exam resolves automatically once the cause is gone.

**Statuses:** Scheduled (grey), Pending Review (yellow), Resolved (green). The same three badges appear on the admin and student pages.

---

## Demo walkthrough

`seed_demo` creates this data (dates are in December 2026):

| Exam | When | Room | Result |
|---|---|---|---|
| MAT101 | 1 Dec 09:00-11:00 | Demo Hall (100) | Pending Review: room booked + shared student with PHY101 |
| PHY101 | 1 Dec 10:00-12:00 | Demo Hall (100) | Pending Review: same reasons |
| CSC101 | 2 Dec 09:00-11:00 | Demo Lab (0) | Pending Review: room too small |
| ENG101 | 3 Dec 09:00-11:00 | Demo Room (50) | Scheduled |
| MAT101 | 3 Dec 11:00-13:00 | Demo Room (50) | Scheduled (back-to-back with ENG101, not a clash) |

Students: `ST001` (MAT101 and PHY101), `ST002` (CSC101), `ST003` (ENG101).

1. Open the student page for `ST001`: three exams, two with the **Pending Review** badge.
2. Log in as the admin: the dashboard shows 5 exams and 3 pending.
3. Open **Clash review**, find CSC101, click **Suggest rooms** (it selects the smallest free room that fits), then **Save and re-check**. It becomes **Resolved**.
4. Fix the MAT101/PHY101 clash by giving PHY101 a new date (for example 2 Dec). Both exams resolve.
5. Reload the student page for `ST002` to see the **Resolved** badge.
6. On **Log exam**, add an exam in an occupied room and time to see the clash banner appear.

---

## API reference

All endpoints are under `/api/` and return JSON. Write endpoints need a logged-in staff user and a CSRF token (the frontend gets one from `/api/csrf/`).

| Endpoint | Method | Who | Purpose | Responses |
|---|---|---|---|---|
| `/api/csrf/` | GET | anyone | Get a CSRF token | 200 |
| `/api/admin/login/` | POST | anyone | Log in with `{username, password}` (staff only) | 200 / 401 / 400 |
| `/api/admin/session/` | GET | anyone | `{authenticated: true/false}` | 200 |
| `/api/logout/` | POST | anyone | End the session | 200 |
| `/api/exams/` | GET | anyone | List exams. Optional `?status=pending_review` | 200 |
| `/api/exams/` | POST | staff | Create an exam and run clash detection | 201 / 400 / 403 |
| `/api/exams/<id>/reassign/` | PATCH | staff | Change room, date, time or unit, then re-check. `{}` just re-checks | 200 / 400 / 403 |
| `/api/exams/<id>/suggest-room/` | GET | staff | Free rooms big enough for this exam, smallest first | 200 / 403 / 404 |
| `/api/units/` | GET | anyone | List units | 200 |
| `/api/rooms/` | GET | anyone | List rooms | 200 |
| `/api/timetable/<admission_number>/` | GET | anyone | One student's exams (read-only; any write method is rejected) | 200 / 404 / 500 |

Create an exam (`POST /api/exams/`):

```json
{ "unit_id": 1, "room_id": 2, "exam_date": "2026-12-10", "start_time": "09:00", "end_time": "11:00" }
```

```json
{ "message": "Exam created", "status": "pending_review", "clash_reason": "Room too small (Cap: 0, Enrolled: 1)", "clash": true }
```

Validation errors return `400` with `{"error": "..."}`, for example an end time not after the start time, or an exam date in the past. The past-date rule applies when creating an exam or moving it to a different date; an exam whose date has passed can still be re-checked or have its room changed.

Student timetable response:

```json
{
  "admission_number": "ST001",
  "exams": [
    {
      "id": 1,
      "unit_code": "MAT101",
      "unit_name": "Mathematics",
      "room_name": "Demo Hall",
      "exam_date": "2026-12-01",
      "start_time": "09:00:00",
      "end_time": "11:00:00",
      "status": "pending_review",
      "clash_reason": "Room already booked by PHY101 | Student clash with PHY101"
    }
  ]
}
```

`room_name` is `null` when no room is assigned (the student page shows "TBC").

---

## Management commands

```bash
python manage.py seed_demo [--admin-username NAME --admin-password PASS]
python manage.py import_exams path/to/file.csv
```

- `seed_demo` is safe to run repeatedly. It creates no users unless both admin options are given.
- `import_exams` bulk-loads exams from a CSV with the headers `unit_code,room_name,exam_date,start_time,end_time` (see `backend/test_exams.csv`). Every imported exam goes through clash detection. Units and rooms must already exist.

---

## Configuration

Set in `backend/.env` locally, or in the Render dashboard in production (see `backend/.env.example`).

| Variable | Purpose | Default |
|---|---|---|
| `DJANGO_DEBUG` | `True` for local development, `false` in production | `True` |
| `DJANGO_SECRET_KEY` | Required when `DJANGO_DEBUG` is false | dev-only key |
| `DATABASE_URL` | PostgreSQL / Supabase connection string. Required in production | local SQLite file |
| `ALLOWED_HOSTS` | Comma-separated hosts | `localhost,127.0.0.1,testserver` |
| `CSRF_TRUSTED_ORIGINS` | Needed on hosted HTTPS domains | none |

Never commit `.env` or credentials.

---

## Testing

```bash
cd backend
python manage.py test
```

43 automated tests cover the clash rules (overlap, back-to-back, capacity boundary, shared students, same room), permissions, the student endpoint, login/logout, validation, database rules (cascade and set-null) and the seed command. They use SQLite and relative dates, so they run anywhere without setup. GitHub Actions runs them on every push.

---

## Deploying on Render

`render.yaml` deploys the backend and frontend together as one web service.

1. Push the repository to GitHub.
2. In Render choose **New → Blueprint** and select the repository.
3. Set the `DATABASE_URL` environment variable to your PostgreSQL / Supabase connection string.
4. Deploy. Render runs `pip install -r requirements.txt`, `collectstatic`, `migrate`, then `gunicorn ESTBackend.wsgi:application`.
5. To seed demo data into the hosted database, run `seed_demo` locally with `DATABASE_URL` pointing at it (use the same connection string).

The root URL serves the landing page. Merges to `main` redeploy through the GitHub Actions deploy hook (`RENDER_DEPLOY_HOOK` secret).

On Render's free plan the service sleeps when idle, so the first request after a quiet period can take about a minute. Open the site a few minutes before a demo.

For a custom domain, add it to `ALLOWED_HOSTS` and `CSRF_TRUSTED_ORIGINS`.

---

## Known limitations

- `GET /api/exams/` is public (it lists exam times and rooms but no student data). Only changes require a staff login, as in the SRS.
- Room suggestions use the exam's current date and time and do not consider shared-student clashes.
- Editing a clash-free exam through the admin form marks it **Resolved** rather than **Scheduled**.

---

## Contributing

Branching rules, commit format, PR process and what "done" means: see [`CONTRIBUTING.md`](./CONTRIBUTING.md).

---

## Team & modules

| Module | Owners | Covers |
|---|---|---|
| Backend Core | Edith, Lenny | Models, clash-detection logic, API, database |
| Admin Interface | Craig, Daniel | Login, dashboard, exam form, clash review |
| Student Interface | June, Angel | Read-only timetable lookup, status badges |
