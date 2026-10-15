# Teacher Module

Phase 6 gives teachers a real (non-face-recognition) workflow: see their
assigned subjects/classes/timetable, run manual attendance sessions, and
review a basic attendance breakdown. **No computer vision, camera, or
face matching is implemented in this phase** — see §12.

## 1. Architecture

```
Sidebar link (Phase 4, unchanged)
  → React page (pages/teacher/*.jsx)
    → teacherService.js (Axios calls)
      → Express route (routes/teacher/*.routes.js)
        → protect              (Phase 3, unchanged)
        → authorizeRoles('teacher')  (Phase 3, unchanged)
        → loadTeacherProfile   (NEW — resolves req.teacher from req.user)
        → express-validator chain (for writes)
        → controller (controllers/teacher/*.controller.js)
          → Mongoose model (Phase 2, unchanged)
```

`routes/teacher/index.js` applies `protect`, `authorizeRoles('teacher')`,
and `loadTeacherProfile` **once**, for the whole `/api/teacher` group —
every route under it can assume `req.teacher` is set and scoped to the
logged-in teacher.

## 2. What counts as a "class" in this schema

Phase 2 doesn't have a separate "class"/"batch" model — a `Subject`
belongs to a `Course`, and a `Student` belongs to a `Course` (+ year/
section), but nothing scopes a `Subject` to a specific section. The
existing Phase 2 seed data already reflects this: every seeded
`Attendance` record spans the *entire* course roster for a subject, not
a section-scoped subset.

Phase 6 follows that same model rather than inventing a new one:

- **My Subjects** (`/teacher/subjects`) — the `Subject` documents in
  `teacher.subjects`.
- **My Classes** (`/teacher/classes`) — the same subjects, enriched with
  the student count (`Student.countDocuments({ course: subject.course })`)
  and the classroom(s) it meets in per `Timetable`. In this schema, a
  teacher's "class" *is* their subject — this page just shows more about
  each one.
- **A session's roster** = every active `Student` in the subject's
  `course`. No `section` field was added to `AttendanceSession` to
  avoid a schema change that the existing data model doesn't otherwise
  support — see §8.

### 2.1 Classroom selection — not tied to Timetable

Starting an attendance session requires picking a classroom
(`AttendanceSession.classroom`), but classrooms aren't owned by a
teacher or scoped by subject — they're the same shared, admin-managed
`Classroom` list from Phase 5's Admin → Classrooms page. `GET
/api/teacher/classrooms` exposes that list read-only to any
authenticated teacher (`isActive: true` only), independent of whether
Admin → Timetable (not yet built) has any entries.

This was a deliberate fix: an earlier version of this page derived
classroom choices from `Timetable` records, which meant the dropdown was
empty for any teacher whose classes hadn't been scheduled into the
timetable yet — a real usability bug, not an empty-data edge case, since
starting a manual session shouldn't require a timetable entry to exist
first. `My Classes`' "Classroom(s)" column *is* still derived from
`Timetable` on purpose (it's showing *scheduled* meeting rooms, which is
genuinely timetable data) — the UI now says "Not scheduled yet" there
instead of a bare blank, with a note explaining that this is separate
from the classroom picker on the attendance-start page.

## 3. API endpoints

All under `/api/teacher`, all requiring a teacher JWT:

| Endpoint | Description |
|---|---|
| `GET /dashboard/stats` | Subject/class counts, today's class count, sessions completed |
| `GET /subjects` | Search + paginate the teacher's own subjects |
| `GET /classes` | Same subjects, enriched with roster size + classrooms |
| `GET /classrooms` | Active classrooms (shared resource — see §2.1) |
| `GET /timetable` | Full weekly timetable |
| `GET /timetable/today` | Just today's slots (server computes the day — never trusts a client-supplied day name) |
| `GET /attendance/sessions` | Session history, paginated, filterable by subject/status/date range |
| `POST /attendance/sessions` | Start a new manual session (`{ subject, classroom, date, period, startTime, endTime }`) |
| `GET /attendance/sessions/:id` | Session details + roster + any existing marks |
| `POST /attendance/sessions/:id/mark` | Save/update attendance (`{ records: [{ student, status, remarks }] }`) |
| `POST /attendance/sessions/:id/complete` | Lock the session (no more edits) |
| `GET /attendance/class/:subjectId` | Per-student present/absent/late counts + percentage for one subject |
| `GET /profile` | Own profile (User + Teacher fields) |
| `PUT /profile` | Update `name`, `phone`, `department`, `designation` only |

## 4. Ownership security — how "Teacher A can't touch Teacher B's data" is actually enforced

Every one of the ownership rules below is enforced **in the controller**, not just by which links the sidebar shows:

- **Identity never comes from the client.** `loadTeacherProfile` looks up `Teacher.findOne({ user: req.user._id })` from the verified JWT and sets `req.teacher`. No controller ever reads a `teacherId` from `req.body` or `req.params`.
- **Subjects/Classes/Timetable are always queried with `teacher: req.teacher._id` (or `teachers: req.teacher._id` for the array field) baked into the Mongoose filter** — there's no code path that returns another teacher's rows.
- **Creating a session validates ownership of the subject first:** `Subject.findOne({ _id: subject, teachers: teacherId })` — if that comes back empty, the request is rejected `403` before anything is created, regardless of what the client claims the subject is.
- **Reading/marking/completing a session** all go through `loadOwnedSession(id, teacherId)`, which loads the session and checks `session.teacher.equals(teacherId)`. A mismatch returns `404` — the same response as "doesn't exist" — so a teacher probing IDs can't even tell whether another teacher's session exists.
- **Marking attendance validates each student is actually on that subject's roster** (`course` match) before saving — a crafted `studentId` for an unrelated student is silently skipped and reported back in `data.skipped`, never saved.
- Every one of these is exercised in `server/tests/teacher.test.js` with two real teachers (A and B) and asserting B gets `403`/`404` against A's resources.

## 5. Manual attendance workflow

```
Teacher picks a Subject + Classroom + Date + Period
        ↓
POST /attendance/sessions  (ownership checked, duplicate-session checked)
        ↓
AttendanceSession created with status: 'Active'
        ↓
GET /attendance/sessions/:id  → roster (course-enrolled students) + any existing marks
        ↓
Teacher marks each student Present / Absent / Late (AttendanceStatusSelector)
        ↓
POST /attendance/sessions/:id/mark  → upserts one Attendance doc per student
        ↓
(repeatable — re-marking updates the same doc, never creates a duplicate)
        ↓
POST /attendance/sessions/:id/complete  → status: 'Completed', locked from further edits
```

**This is 100% manual.** There is no camera access, no `face-api.js`, no
face descriptor capture or matching anywhere in this phase's code. The
"Take Attendance" button starts a session the teacher fills in by hand.

### Duplicate prevention, preserved

The Phase 2 unique index `{ student: 1, session: 1 }` on `Attendance` is
untouched. `markAttendance` uses `findOneAndUpdate(..., { upsert: true })`
rather than `create()`, so re-submitting (e.g. the teacher corrects a
mistake before completing the session) **updates** the existing record
instead of colliding with that index. `server/tests/teacher.test.js`
proves this: marking a student twice with different statuses leaves
exactly one `Attendance` document, with the latest status.

## 6. Attendance percentage

`GET /attendance/class/:subjectId` computes, per student:

```
percentage = present sessions / total completed sessions × 100
```

`totalSessions` counts only `AttendanceSession` documents with
`status: 'Completed'` for that subject+teacher. When it's `0`,
`percentage` is returned as `null` and the frontend shows **"N/A"** —
never `NaN` or `Infinity`.

## 7. Frontend architecture

- **`services/teacherService.js`** — one function per endpoint, mirroring `adminService.js`'s pattern.
- **Reused, not duplicated:** `PageContainer`, `SectionHeader`, `StatCard`, `EmptyState`, `StatusBadge`, `ToastContext`, and the Admin module's `DataTable`/`Pagination`/`SearchInput`/`useAdminList` hook — none of these were rewritten for the Teacher Module.
- **New, teacher-specific:** `components/teacher/AttendanceStatusSelector.jsx` (the Present/Late/Absent 3-way toggle) and 9 pages under `pages/teacher/`.
- Every page fetches with `loading`/error handling via `useToast()` — none hardcode teacher identity; `user` from `useAuth()` is only ever used for display.

## 8. Database changes

**None.** Every Phase 2 model, field, index, and relationship is exactly
as it was. The roster-by-course design (§2) and the choice not to add a
`section` field to `AttendanceSession` were deliberate ways to build the
full manual-attendance workflow **without** touching the schema — see
§2 for the reasoning.

## 9. Testing

**`server/tests/teacher.test.js`** (new), over real HTTP via `supertest`
against a real in-memory MongoDB:
- Authorization: no token → `401`, invalid token → `401`, student → `403`, teacher → `200`
- Dashboard stats structure
- Subjects/Classes/Timetable: two teachers, each only sees their own
- Attendance: create for own subject (`201`), create for another teacher's subject (`403`), invalid subject ID (`403`), read another teacher's session by ID (`404`), duplicate session same subject/date/period (`409`), mark + re-mark same student → exactly one `Attendance` doc with the latest status
- Profile: retrieve own profile (no password leaked), update allowed fields, role-change attempt via profile update is silently ignored

Like every DB-backed suite in this project, running it needs
`mongodb-memory-server` to download a real `mongod` — this sandbox has
no internet access to do that. See the response accompanying this
delivery for exactly what was and wasn't executed here.

## 10. Seed data

No seed changes were needed. Phase 2's seed already creates 3 teachers
with subjects assigned round-robin, a shared course all students belong
to, and timetable entries per subject — enough relationships to exercise
every feature in this phase (multiple teachers, each with real subjects,
classes, and a timetable) without adding or duplicating data.

## 11. Future Computer Vision integration (Phase 7 — not built here)

This phase was structured so Phase 7 can add camera-based recognition
without rewriting the attendance flow:

- `StartAttendance.jsx` creates the same `AttendanceSession` a camera
  flow would use — Phase 7 can add a "Start Camera Attendance" option
  alongside the existing manual form without touching the session model.
- `MarkAttendance.jsx`'s roster + status-per-student shape is exactly
  what a face-recognition pass would need to pre-fill (recognized faces
  → `Present`, rest stay for manual review) — the manual selectors
  become the *correction* UI rather than being replaced.
- `AttendanceSession.detectedStudents` and `unknownFaces` (defined back
  in Phase 2, unused until now) are exactly where Phase 7's recognition
  results will be written.
- `markAttendance`'s upsert-based save already tolerates being called
  more than once for the same session, which a camera pass doing
  incremental recognition will need.

## 12. Explicitly NOT implemented in Phase 6

> **Update (Phase 7):** face recognition described as future work below
> has since been implemented — see
> [docs/COMPUTER_VISION.md](COMPUTER_VISION.md). It's an **additional**
> attendance method alongside the manual workflow documented above, not
> a replacement; everything in this document is still accurate for the
> manual path.


Face recognition, `face-api.js`, camera access, `FaceProfile`
registration or matching, computer vision of any kind, AI attendance
prediction, the full analytics engine (Phase 9), notifications backend
(Phase 10), reports/PDF export (Phase 11), deployment (Phase 14).
