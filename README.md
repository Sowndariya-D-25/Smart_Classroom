# Smart Classroom & Attendance Analytics Portal

A full-stack MERN application for camera-based classroom attendance and
attendance analytics, for admins, teachers, and students.

> **Status:** Phase 9 — Analytics complete. This README will grow with
> each phase (see `docs/` and the phase list below).

## Tech stack

- **Frontend:** React 19 + Vite, React Router, Axios, Tailwind CSS, Recharts, lucide-react, face-api.js (added in Phase 7)
- **Backend:** Node.js, Express 5, MongoDB, Mongoose, JWT, bcryptjs, express-validator
- **Computer Vision:** browser-based face detection/recognition (face-api.js) calling a backend `/api/face/*` service backed by MongoDB

## Project structure

```
smart-classroom-attendance/
├── client/          # React + Vite frontend
│   └── src/
│       ├── components/  layouts/  pages/  routes/
│       ├── services/    hooks/    context/
│       └── utils/       constants/
├── server/          # Express backend
│   ├── config/  controllers/  middleware/  models/
│   ├── routes/  services/  utils/  validators/  seed/
│   ├── app.js       # Express app + middleware + route mounting
│   └── server.js    # Entry point
├── docs/            # Architecture, API, and database documentation
├── .gitignore
├── package.json     # Root convenience scripts (runs client + server together)
└── README.md
```

## Prerequisites

- Node.js 18+ and npm
- MongoDB running locally (`mongodb://127.0.0.1:27017`) **or** a MongoDB Atlas connection string

## Getting started

```bash
# 1. Install dependencies (root, client, and server)
npm run install:all

# 2. Configure environment variables
cp server/.env.example server/.env
cp client/.env.example client/.env
# then edit server/.env and set MONGO_URI / JWT_SECRET as needed

# 3. Run both frontend and backend together
npm run dev
```

- Frontend: http://localhost:5173
- Backend health check: http://localhost:5000/api/health

You can also run them separately:

```bash
npm run dev:server   # http://localhost:5000
npm run dev:client   # http://localhost:5173
```

The landing page at `http://localhost:5173` pings `/api/health` and shows
whether the API and MongoDB are reachable — useful for confirming the stack
is wired correctly before moving to later phases.

## Environment variables

**server/.env**

| Variable | Description | Example |
|---|---|---|
| `MONGO_URI` | MongoDB connection string | `mongodb://127.0.0.1:27017/smart-classroom` |
| `JWT_SECRET` | Secret used to sign JWTs | a long random string |
| `JWT_EXPIRES_IN` | Token lifetime | `7d` |
| `PORT` | API port | `5000` |
| `NODE_ENV` | `development` or `production` | `development` |
| `CLIENT_URL` | Frontend origin, used for CORS | `http://localhost:5173` |
| `LOW_ATTENDANCE_THRESHOLD` | Default low-attendance % warning | `75` |

**client/.env**

| Variable | Description | Example |
|---|---|---|
| `VITE_API_URL` | Base URL of the backend API | `http://localhost:5000/api` |

Never commit `.env` files — only `.env.example` files are tracked in git.

## Database (Phase 2)

12 Mongoose models under `server/models/` — `User`, `Student`, `Teacher`,
`Admin`, `Course`, `Subject`, `Classroom`, `Timetable`, `Attendance`,
`AttendanceSession`, `FaceProfile`, `Notification`. Full field-by-field
documentation, relationships, and how duplicate-attendance prevention is
enforced at the database level: **[docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md)**.

### Seed the database

```bash
cp server/.env.example server/.env   # if you haven't already
npm run seed
```

This connects to `MONGO_URI`, clears the app's own collections, and
inserts a fully-connected demo dataset (1 admin, 3 teachers, 20 students,
1 course, 5 subjects, 3 classrooms, a timetable, 20 attendance sessions,
400 attendance records, face profiles, and notifications). It refuses to
run when `NODE_ENV=production` and never touches anything outside this
app's own collections. Safe to re-run any time during development.

**Demo accounts** (password `Password123!` for all — login itself ships
in Phase 3, so these can't be used to sign in yet, but the accounts and
their hashed passwords already exist in the database):

| Role | Email |
|---|---|
| Admin | `admin@smartclassroom.local` |
| Teacher | `teacher1@smartclassroom.local` (also `teacher2`, `teacher3`) |
| Student | `student1@smartclassroom.local` through `student20@smartclassroom.local` |

### Database tests

```bash
npm run test:server
```

Runs two suites under `server/tests/`:
- `models.validation.test.js` — schema-level validation (required fields,
  enums, ranges), runs instantly with **no database needed**.
- `models.integration.test.js` — real-database constraints (unique
  emails, duplicate-attendance prevention, etc.) using an in-memory
  MongoDB via `mongodb-memory-server`. **The first run downloads a real
  `mongod` binary and needs an internet connection.**

## Authentication (Phase 3)

Full JWT-based auth: registration, login, `/me`, bcrypt password hashing,
and role-based authorization enforced on the **backend** (the frontend's
route guards are a UX convenience, not the security boundary). Full
write-up, JWT structure, and the reasoning behind every design decision:
**[docs/AUTHENTICATION.md](docs/AUTHENTICATION.md)**.

- `POST /api/auth/register` — public, always creates a `student` account
- `POST /api/auth/login` — returns `{ token, user }`
- `GET /api/auth/me` — requires `Authorization: Bearer <token>`, returns `{ user, profile }`

**Try it (PowerShell):**
```powershell
npm run dev            # if not already running
npm run seed            # if you haven't already

$res = Invoke-RestMethod -Uri "http://localhost:5000/api/auth/login" -Method POST `
  -ContentType "application/json" `
  -Body '{"email":"student1@smartclassroom.local","password":"Password123!"}'
Invoke-RestMethod -Uri "http://localhost:5000/api/auth/me" -Method GET `
  -Headers @{ Authorization = "Bearer $($res.data.token)" }
```

Or open http://localhost:5173/login in a browser and sign in with any
seeded account below.

**Demo credentials** (same accounts as Phase 2's seed, now able to log in):

| Role | Email | Password |
|---|---|---|
| Admin | `admin@smartclassroom.local` | `Password123!` |
| Teacher | `teacher1@smartclassroom.local` (also `teacher2`, `teacher3`) | `Password123!` |
| Student | `student1@smartclassroom.local` … `student20@smartclassroom.local` | `Password123!` |

## Main UI Layout (Phase 4)

A reusable dashboard shell (sidebar + navbar + page container) now wraps
every authenticated page, with role-specific navigation and three real
(demo-data) dashboards. Full architecture, responsive behavior, and
exactly which values are still hardcoded placeholders vs. real data:
**[docs/MAIN_UI_LAYOUT.md](docs/MAIN_UI_LAYOUT.md)**.

- Desktop: fixed sidebar. Mobile: hamburger → slide-in drawer with overlay.
- Sidebar links that don't have a real page yet render a "Coming soon" placeholder — nothing is broken, nothing is faked as real data.
- Demo credentials, login flow, and role-based redirect are unchanged from Phase 3 (see above).

## Admin Module (Phase 5)

Real MongoDB-backed CRUD for Students, Teachers, Subjects, Courses, and
Classrooms — search, pagination, filters, validation, duplicate
handling, soft-delete/deactivation, and backend-enforced admin-only
authorization on every endpoint. Full architecture, API table, and the
soft-delete reasoning: **[docs/ADMIN_MODULE.md](docs/ADMIN_MODULE.md)**.

- `/admin/students`, `/admin/teachers`, `/admin/subjects`, `/admin/courses`, `/admin/classrooms` are now real pages (not "Coming soon").
- The Admin Dashboard's 4 stat cards now show real MongoDB counts via `GET /api/admin/dashboard/stats`.
- Every `/api/admin/*` route requires a valid JWT **and** `role: admin` — verified for every resource in `server/tests/admin.test.js`.

## Teacher Module (Phase 6)

Teachers now have a real workflow: view assigned subjects/classes/
timetable, run manual attendance sessions, review a basic per-subject
attendance breakdown, and edit their own profile. Every endpoint is
scoped to the logged-in teacher on the backend — a teacher can never
read or modify another teacher's data, even by editing a URL. Full
architecture and the ownership-security model:
**[docs/TEACHER_MODULE.md](docs/TEACHER_MODULE.md)**.

- `/teacher/subjects`, `/teacher/classes`, `/teacher/timetable`, `/teacher/attendance`, `/teacher/attendance/start`, `/teacher/analytics`, `/teacher/profile` are now real pages.
- Attendance is **manual only** in this phase — no camera, no face recognition (that's Phase 7).
- Every `/api/teacher/*` route requires a valid JWT **and** `role: teacher`, verified in `server/tests/teacher.test.js` alongside a two-teacher ownership matrix.

## Computer Vision — Face Recognition Attendance (Phase 7)

Face recognition is now a **second attendance method alongside manual
marking** (not a replacement) — a teacher can register students' faces
and then use the camera to mark attendance automatically during an
active session. Runs entirely with `face-api.js` in the browser for
detection/descriptor generation; the backend does the matching, scoped
strictly to the current session's roster. Full architecture, the
security model behind "a recognized face can't cross into another
class," and honest testing-limitation notes:
**[docs/COMPUTER_VISION.md](docs/COMPUTER_VISION.md)**.

- `/teacher/classes/:subjectId/faces` (pick a student) → `/teacher/students/:studentId/face` (register, capture samples with the camera)
- From an active session's Mark Attendance page → **Start Face Recognition** → `/teacher/attendance/session/:id/face`
- No raw photos are stored — only 128-length face descriptors, in the existing `FaceProfile` model (unchanged schema)
- `GET /api/teacher/classrooms` (the Phase 6 fix) is unaffected and still works

## Attendance Management (Phase 8)

Attendance — created two ways since Phase 6/7 — is now fully reviewable
and reportable: a real filterable history, full session-detail review
with a live summary, a corrected percentage formula applied
consistently everywhere, and a student-facing view of the same
underlying data. Full breakdown of what was fixed vs. genuinely new,
and the one attendance-percentage rule used everywhere:
**[docs/ATTENDANCE_MANAGEMENT.md](docs/ATTENDANCE_MANAGEMENT.md)**.

- **Rule:** `attendance % = (Present + Late) / total applicable sessions × 100` — applied identically in teacher class-attendance, session details, and student summary.
- **New for students:** `/student/attendance` (subject-wise %) and `/student/attendance/history` (session log) — each student only ever sees their own records, enforced server-side.
- `LOW_ATTENDANCE_THRESHOLD` (`server/.env`, default `75`) is read from one place and reused everywhere — never hardcoded per page.
- Computer Vision (Phase 7) and the attendance-creation paths (Phase 6) are untouched — this phase is about reviewing/correcting/reporting existing records, not creating them differently.

## Analytics & Insights (Phase 9)

Teacher and student attendance dashboards — KPI cards, subject-wise and
Present/Late/Absent charts, a daily attendance trend, and (for teachers)
a sorted list of students below the low-attendance threshold. Everything
is computed live from the existing `Attendance`/`AttendanceSession`
data via MongoDB aggregation — nothing new is stored. Full breakdown of
the formula, the trend-chart aggregation, and the ownership/security
model: **[docs/ANALYTICS.md](docs/ANALYTICS.md)**.

- `/teacher/analytics` (upgraded from a subject-picker into a full dashboard) and `/student/analytics` (was a "Coming soon" placeholder, now real).
- Same `(Present + Late) / total applicable sessions × 100` rule from Phase 8, applied identically everywhere — no second formula was introduced.
- Both pages are lazy-loaded (`recharts` only fetched when actually visited) so the rest of the app's bundle size is unaffected.
- Face recognition, the classroom fix, and attendance creation/correction are all unaffected — re-verified live, not just assumed.

## Development phases

- [x] **Phase 1 — Project Setup**
- [x] **Phase 2 — Database Architecture**
- [x] **Phase 3 — Authentication & Authorization**
- [x] **Phase 4 — Main UI Layout**
- [x] **Phase 5 — Admin Module**
- [x] **Phase 6 — Teacher Module**
- [x] **Phase 7 — Computer Vision**
- [x] **Phase 8 — Attendance Management**
- [x] **Phase 9 — Analytics** (this commit)
- [ ] Phase 10 — Notifications
- [ ] Phase 11 — Reports (CSV/print export)
- [ ] Phase 12 — Testing & Error Handling
- [ ] Phase 13 — Final UI Polish
- [ ] Phase 14 — Deployment
- [ ] Phase 15 — Final Documentation

---

Say **CONTINUE** to move to **Phase 10 — Notifications**.
