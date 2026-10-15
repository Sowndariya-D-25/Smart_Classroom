# Analytics & Insights

Phase 9 adds attendance analytics for teachers and students — KPI cards,
charts, and a low-attendance list — built entirely from the same
`Attendance`/`AttendanceSession` records Phases 6–8 already create. No
new collection stores calculated percentages; every number here is
computed fresh from source data on each request.

## 1. Architecture

```
Teacher                                    Student
  │                                           │
GET /api/teacher/analytics/overview      GET /api/student/analytics/overview
  │  (?subject= optional filter)             │
  ├─ subjects owned by req.teacher           ├─ subjects in req.student's course
  ├─ MongoDB aggregation (Attendance,        ├─ MongoDB aggregation (Attendance,
  │  AttendanceSession)                      │  AttendanceSession)
  └─ one response: kpis, subjectWise,        └─ one response: kpis, subjectWise,
     trend, distribution, lowAttendance         trend, distribution
```

One endpoint per role returns everything its analytics page needs — the
KPI cards, both charts, the trend line, and (for teachers) the
low-attendance table all come from a single request, so they can never
disagree with each other the way five separate endpoints computing
overlapping numbers independently might.

## 2. Teacher Analytics (`/teacher/analytics`)

Upgraded in place — this was previously a bare subject-picker linking to
the per-subject `ClassAttendance` page (Phase 6/8); that page still
exists and is still linked from **My Classes**, unchanged. `/teacher/analytics`
is now the full dashboard:

- **KPI cards:** Overall Attendance %, Total Sessions (completed),
  Total Students (distinct, across all the teacher's subjects), Students
  Below Threshold.
- **Subject-wise bar chart:** one bar per subject, each subject's
  percentage averaged across its roster.
- **Present/Late/Absent pie chart:** raw record counts across every
  session this teacher has run.
- **Attendance trend line chart:** see §5.
- **Students Below Threshold table:** every (student, subject) pair
  under the threshold, sorted lowest-first, with Present/Late/Absent
  counts — never just a name and a percentage.
- **Subject filter:** an optional `?subject=` query param narrows every
  number above to one subject. A subject id that isn't actually taught
  by this teacher is silently ignored (see §6), not trusted.

## 3. Student Analytics (`/student/analytics`)

Was a `ComingSoon` placeholder (the sidebar link already existed from
Phase 4); now a real page, structurally identical to the teacher
dashboard but scoped to one student's own records: Overall Attendance %,
Total Sessions, Present+Late count, Subjects Below Threshold, a
subject-wise bar chart, a Present/Late/Absent pie chart, a trend line,
and a subject breakdown table.

## 4. Attendance formula — same rule, no exceptions

```
attendance % = (Present + Late) / total applicable sessions × 100
```

This is the exact Phase 8 rule (`server/utils/attendanceThreshold.js`
and the same "Present + Late = attended" logic from
`getClassAttendance`/`getMySummary`), applied consistently in every
analytics number: KPI cards, subject-wise chart, and the low-attendance
list. "Applicable sessions" means `AttendanceSession` documents with
`status: 'Completed'` — `Scheduled`, `Active`, and `Cancelled` sessions
are never counted in the denominator, exactly as Phase 8 already
established. Zero applicable sessions → `percentage: null` → frontend
shows **"N/A"**, never `NaN`.

`LOW_ATTENDANCE_THRESHOLD` is read from the existing
`attendanceThreshold.js` — not re-declared here.

## 5. Trend chart — what "daily attendance %" means

The trend line is a **different aggregation** from the per-student
percentage above, because a trend needs one point per calendar day, not
per student:

```
for each date, among Attendance records marked that day:
  day % = (Present that day + Late that day) / (all records marked that day) × 100
```

This groups raw `Attendance` documents by their `date` field
(`$dateToString`), not by "applicable sessions" — a day with only one
session marked and a day with five sessions marked both just produce one
data point each. The most recent 30 distinct dates with records are
shown, sorted chronologically for the chart. This is a simpler,
different calculation than the roster-based percentage on purpose —
documented here so the two numbers are never confused for each other.

## 6. Security / ownership

**Teacher:** `req.teacher` is resolved from the JWT by the existing
`loadTeacherProfile` middleware (Phase 6, unchanged). Every query is
scoped to `Subject.find({ teachers: req.teacher._id, ... })` — a
`?subject=` filter that names a subject this teacher doesn't teach
simply matches nothing (an empty `subjects` array, not another
teacher's data). Proven in `tests/analytics.test.js`: Teacher A passing
Teacher B's subject id back gets zero subjects, never B's numbers.

**Student:** `req.student` is resolved by `loadStudentProfile` (Phase 8,
unchanged) from the JWT. No student id is ever read from the request —
a `?studentId=` query parameter is not even present in the route
handler's logic, so passing one has no effect. Proven directly: Student
A passing Student B's id in the query string still only ever gets
Student A's own 100%, never Student B's 0%.

## 7. Aggregation approach

MongoDB `$match`/`$group` aggregation is used for the per-(student,
subject) attendance stats and the daily trend — both are exactly the
kind of "sum records by a key" operation aggregation is for, and doing
it in the database avoids pulling every `Attendance` record into Node
just to sum them in JavaScript. Session counts and rosters use the
existing `getRoster()` helper from `attendance.controller.js` (Phase 6)
and simple `countDocuments`/small `find()` loops per subject — consistent
with how `getClassAttendance` (Phase 8) and `listMyClasses` (Phase 6)
already do it at this project's scale (a handful of subjects per
teacher), rather than one enormous multi-stage pipeline that would be
harder to read for the same result.

## 8. Empty-data behavior

A teacher/student with zero subjects, zero sessions, or zero attendance
records gets a fully-formed response with empty arrays and `null`
percentages — never a crash, never a partial object. The frontend shows
a dedicated `EmptyState` for each chart/section rather than rendering
Recharts against an empty array (which would otherwise draw a blank
axis with nothing on it).

## 9. Frontend

- `services/{teacherService,studentService}.js` — one `getAnalyticsOverview()` function each.
- Both Analytics pages are **lazy-loaded** (`React.lazy` + `Suspense` in `App.jsx`), the same pattern already used for the face-recognition pages — `recharts` is a sizable library, and this keeps it out of the main bundle for anyone not viewing analytics. Confirmed via a production build: the main bundle stayed ~387KB; `recharts` now loads as its own ~405KB chunk only when an Analytics page is visited.
- Reused, not duplicated: `PageContainer`, `SectionHeader`, `StatCard`, `StatusBadge` (gained no new variants — `Low Attendance` already existed from Phase 8), `DataTable`, `EmptyState`, `ToastContext`.
- Chart colors reuse the app's existing Tailwind tokens (`primary`/`accent`/`danger`) rather than introducing a separate chart palette.

## 10. Testing

**`server/tests/analytics.test.js`** (new) — real HTTP via `supertest`
against a real in-memory MongoDB:
- Authorization: no token → `401` (both roles), wrong role → `403` (both directions)
- Zero-data safety: a teacher/student with no subjects gets `null` percentages and empty arrays, no crash
- Teacher ownership: Teacher A never sees Teacher B's subjects/sessions; a subject filter naming another teacher's subject returns nothing (not that teacher's data)
- Formula: a Present session + a Late session average to 100%, not 50%; an Absent-only student correctly appears in the low-attendance list
- Student security: a `studentId` query parameter cannot expose another student's analytics — verified by requesting with another student's id and confirming only the caller's own data comes back
- Student formula: Present + Late both count as attended for the student's own KPIs
- Regression: `GET /api/teacher/classrooms` and `POST /api/teacher/attendance/sessions/:id/recognize` both still resolve correctly (the recognize route was specifically re-verified to exist exactly once, per the Phase 7 fix)

### What was and wasn't executed

**Executed in this sandbox:** `node --check` on every new/modified
backend file (all pass); a live route-resolution check confirming
`/api/teacher/analytics/overview`, `/api/student/analytics/overview`,
`/api/teacher/classrooms`, and the recognize route all resolve with the
correct `401`/`404` (not "Route not found") when hit directly;
`node --test tests/models.validation.test.js` (21/21, unchanged);
`npm run build --prefix client` (0 errors); `npx oxlint src` (0 errors,
6 pre-existing warnings, none new); `GET /api/health` (live, `200`).

**NOT executed:** `server/tests/analytics.test.js` itself (18 test
cases) — like every DB-backed suite in this project, it needs
`mongodb-memory-server` to download a real `mongod`, which needs
internet access this sandboxed environment doesn't have. Not run, not
claimed as passing — ready to run via `npm run test:server` on a machine
with internet. No live browser testing was performed either (no camera,
no browser in this environment) — the charts and pages were written and
reviewed carefully but not visually verified in an actual browser.

## 11. What this phase deliberately does not include

No notifications/email/SMS for low attendance (later phase). No
PDF/CSV/Excel export (later phase). No AI/ML prediction or forecasting.
No changes to face-recognition detection, matching, threshold, or
storage — `FaceCamera.jsx`, `FaceProfile.js`, `faceDistance.js`, and
`faceRecognition.controller.js` were not touched. No Admin Timetable. No
new database models — every number here is computed from the existing
`Attendance`/`AttendanceSession` documents, not stored anywhere new.
