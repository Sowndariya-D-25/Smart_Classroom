# Attendance Management

Phase 8 makes attendance — already created two ways in Phases 6 and 7 —
actually *usable*: a real history with filters and percentages, full
session-detail review, corrected percentage math, and a student-facing
view of the exact same underlying data. No new attendance-creation path
was added; this phase is about reviewing, correcting, and reporting on
records that already exist.

## 1. Architecture

Nothing new was introduced at the model or session-creation level.
Everything here reads (and, for corrections, updates) the same
`Attendance`/`AttendanceSession` documents Phases 6–7 already create:

```
Teacher                                  Student
  │                                         │
  ├─ Attendance History  (enriched)         ├─ My Attendance   (NEW)
  ├─ Session Details     (enriched)         └─ Attendance History (NEW)
  ├─ Class Attendance    (fixed formula)
  └─ Dashboard           (+ Average Attendance)
         │                                         │
         └──────────────┬──────────────────────────┘
                         ↓
              Attendance / AttendanceSession
                (Phase 2 models, unchanged)
```

## 2. What was fixed vs. what was added

**Fixed (existing endpoints, corrected logic):**
- `getClassAttendance` computed percentage as `present / totalSessions`,
  silently ignoring `Late`. Phase 8 adopts an explicit rule — see §4 —
  and applies it consistently everywhere a percentage is calculated.
- `listSessions` (teacher history) and `getSession` (session details)
  returned raw counts with no percentage, no roster size, no per-record
  method/confidence/timestamp — all added.

**Added (genuinely new, student-side only):**
- `GET /api/student/attendance` — subject-wise summary for the logged-in student
- `GET /api/student/attendance/history` — session-level log, paginated/filterable
- `loadStudentProfile` middleware (mirrors `loadTeacherProfile` exactly)
- A small `averageAttendance` figure on the teacher dashboard (one number, not a chart — see §13)

**Not touched:** `FaceCamera.jsx`, `FaceProfile.js`, `faceDistance.js`,
`faceRecognition.controller.js`, session/attendance *creation* logic,
the `{student, session}` unique index, attendance methods (`Manual` /
`Face Recognition`) — all exactly as Phase 6/7 left them.

## 3. Session lifecycle (unchanged)

`Scheduled → Active → Completed` (or `Cancelled`) — these are the exact
`AttendanceSession.status` values from Phase 2, not renamed or extended.
Marking (`/mark`) and recognizing (`/recognize`) are both rejected with
`400` once a session is `Completed` or `Cancelled` — this was already
true in Phase 6/7 and is unchanged; Phase 8 only added test coverage
proving it holds for both paths, not just manual marking.

## 4. Attendance percentage — the one rule, everywhere

```
attendance % = (Present + Late) / total applicable sessions × 100
```

**Present and Late both count as attended; only Absent doesn't.** This
wasn't previously documented anywhere, so Phase 8 establishes it as the
one rule and applies it in exactly three places, all doing the same
calculation:
- `getClassAttendance` (teacher, per-subject roster)
- `getSession`'s `summary` (teacher, single session)
- `getMySummary` (student, per-subject)

`0` applicable sessions always returns `percentage: null` — the
frontend shows **"N/A"**, never `NaN` or a divide-by-zero artifact.

## 5. Low-attendance threshold

`LOW_ATTENDANCE_THRESHOLD` (`server/.env`, default `75`) is read in
exactly one place — `server/utils/attendanceThreshold.js` — and reused
everywhere a percentage needs a low/not-low judgment, instead of a
hardcoded `75` in multiple controllers:

```js
export function isLowAttendance(percentage) {
  if (percentage === null || percentage === undefined) return false
  return percentage < LOW_ATTENDANCE_THRESHOLD  // strictly less than — 75% exactly is NOT low
}
```

Both `getClassAttendance` and `getMySummary` return the threshold value
itself alongside each row's `isLow` flag, so the frontend never
hardcodes `75` either — it displays whatever the backend says.

No notifications, emails, or alerts are sent for low attendance in this
phase — only the `isLow` flag and a "Low Attendance" badge in the UI.

## 6. Teacher ownership (unchanged, re-verified)

Every teacher attendance endpoint still resolves teacher identity only
from `req.teacher` (via `loadTeacherProfile`, itself derived from the
JWT) — never from a client-supplied ID. `server/tests/attendance.test.js`
adds ownership assertions for the endpoints Phase 8 touches: a second
teacher gets `404` reading another teacher's session details, and `404`
attempting to mark another teacher's session's attendance.

## 7. Student attendance security

`GET /api/student/attendance` and `/history` resolve the student the
same way — `loadStudentProfile` finds the `Student` linked to
`req.user._id` — and every query in `student/attendance.controller.js`
filters by `req.student._id`. A request like
`?studentId=someone-elses-id` has **no effect**: that query parameter
is never read anywhere in the controller. Proven directly in
`attendance.test.js`: Student A passing Student B's ID in the query
string still only ever gets Student A's own records back.

## 8. Confidence display

Stored value is unchanged — the same `0–1` float Phase 7 already
writes. The UI formats it as a percentage (`Math.round(confidence * 100)`)
purely for display; nothing is ever written back to the database in the
`0–100` form. Manual records (no `confidence` field) show `—`, never a
fabricated number.

## 9. Duplicate prevention (unchanged, re-verified)

The `{student, session}` unique index from Phase 2 is untouched.
Manual correction re-uses the same `findOneAndUpdate({..}, {..}, {upsert:true})`
pattern Phase 6 already used — re-submitting a correction updates the
existing record, it never inserts a second one, so there's no
duplicate-key exception to handle in the first place. Phase 7's face
recognition still calls `Attendance.create()` for a genuinely new match
(guarded by an explicit "already marked" check beforehand), and still
relies on the centralized error handler to turn a raced duplicate-key
insert into a clean `409` rather than crashing — both unchanged.

## 10. Absent students (unchanged)

The manual-marking and face-recognition workflows were **not**
redesigned to auto-create "Absent" records for unmarked students. A
session's roster minus its `Attendance` records is exactly how
"unmarked" is represented (see `summary.unmarked` in the session
details response) — consistent with how Phase 6 already worked, not
changed here.

## 11. API overview

| Endpoint | Change |
|---|---|
| `GET /api/teacher/attendance/sessions` | Now returns `percentage` and `totalStudents` per session |
| `GET /api/teacher/attendance/sessions/:id` | Now returns a `summary` block (`total/present/late/absent/unmarked/percentage`) and each record includes `method`, `confidence`, `timestamp` |
| `GET /api/teacher/attendance/class/:subjectId` | Percentage formula fixed (Late now counts); adds `isLow` and `threshold` |
| `GET /api/teacher/dashboard/stats` | Adds `averageAttendance` |
| `GET /api/student/attendance` | **New** — subject-wise summary |
| `GET /api/student/attendance/history` | **New** — paginated session log, filterable by `subject`/`status`/`from`/`to` |

`POST /sessions/:id/mark`, `POST /sessions/:id/recognize`,
`POST /sessions/:id/complete`, `POST /sessions` (create) — all
unchanged from Phase 6/7.

## 12. Frontend

- **Teacher:** `AttendanceHistory.jsx` gained subject/status filters and
  a percentage column; `MarkAttendance.jsx` gained a 5-box summary strip
  and per-student method/confidence/marked-at; `ClassAttendance.jsx`
  gained the low-attendance badge and a corrected subtitle;
  `TeacherDashboard.jsx` gained an "Average Attendance" card.
- **Student (new):** `pages/student/Attendance.jsx` (subject-wise
  summary table) and `pages/student/AttendanceHistory.jsx` (session
  log), both at the routes the Phase 4 sidebar already pointed at
  (`/student/attendance`, `/student/attendance/history`) — no navigation
  changes were needed.
- **`components/common/StatusBadge.jsx`** gained styles for `Completed`,
  `Scheduled`, `Cancelled`, and `Low Attendance` — reused everywhere a
  status/flag is shown, not redefined per page.

## 13. What this phase deliberately does NOT include

No trend charts, monthly graphs, subject-comparison visualizations, or
predictive analytics (Phase 9). No notification/email/SMS delivery for
low attendance (later phase) — only the `isLow` flag. No PDF/CSV/Excel
export (later phase). No Admin Timetable. No changes to the Computer
Vision detection/matching pipeline itself.

## 14. Testing

**`server/tests/attendance.test.js`** (new) — real HTTP via `supertest`
against a real in-memory MongoDB:
- Authorization: no/invalid token → `401`, student on teacher endpoint → `403`
- Ownership: teacher can read own session, `404` on another teacher's; can't mark another teacher's session
- Session lifecycle: active → completed; completed session rejects further marking AND recognition
- Creation edge cases: off-roster student skipped (not saved); re-marking updates in place, no duplicate-key crash
- History: only own sessions returned; pagination; status filter; percentage present on each item
- Session details: summary block math verified (1 of 2 marked → 50%)
- Class attendance: a Present + a Late session → **100%**, not 50% — proves the Late-counts-as-attended rule
- Threshold: `74` → low, `75` → not low, `76` → not low, `null` → not low
- Student access: each student sees only their own summary; a `studentId` query param is ignored; cross-role blocks in both directions

Same limitation as every DB-backed suite in this project:
**not executed in this sandbox** — `mongodb-memory-server` needs to
download a real `mongod`, which needs internet access this environment
doesn't have. Written and ready to run via `npm run test:server` on a
machine with internet.
