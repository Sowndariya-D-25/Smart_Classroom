# Admin Module

Phase 5 adds real, MongoDB-backed CRUD for the five resources an admin
manages: Students, Teachers, Subjects, Courses, and Classrooms — plus a
dashboard stats endpoint that replaced the Phase 4 hardcoded numbers.

## 1. Architecture

```
Sidebar link (Phase 4, unchanged)
  → React page (pages/admin/{Students,Teachers,Subjects,Courses,Classrooms}.jsx)
    → useAdminList hook (search/filter/pagination state)
    → adminService.js (Axios calls)
      → Express route (routes/admin/*.routes.js)
        → protect  (Phase 3, unchanged)
        → authorizeRoles('admin')  (Phase 3, unchanged)
        → express-validator chain (validators/admin/*.validator.js)
        → controller (controllers/admin/*.controller.js)
          → Mongoose model (Phase 2, unchanged)
```

Every admin route file starts with:
```js
router.use(protect)
router.use(authorizeRoles('admin'))
```
before any CRUD route is defined — this is the actual security boundary,
not the frontend `RoleRoute`.

## 2. API endpoints

| Resource | Endpoints |
|---|---|
| Dashboard | `GET /api/admin/dashboard/stats` |
| Students | `GET /POST /api/admin/students` · `GET /PUT /api/admin/students/:id` · `PATCH /api/admin/students/:id/status` · `DELETE /api/admin/students/:id` |
| Teachers | same shape at `/api/admin/teachers` |
| Subjects | same shape at `/api/admin/subjects` |
| Courses | same shape at `/api/admin/courses` |
| Classrooms | same shape at `/api/admin/classrooms` |

List endpoints (`GET .../students`, etc.) accept `?search=&page=&limit=&sortBy=&order=` plus resource-specific filters (`status`, `department`, `year`, `section`, `semester`, `building` — only where the schema actually has that field). `PATCH .../:id/status` takes `{ isActive: boolean }`. `DELETE` performs a soft delete (see §6).

## 3. Search, pagination, sorting

- **Pagination** (`server/utils/pagination.js`): `page`/`limit` are clamped (`limit` 1–100, default 10). Response includes `{ page, limit, total, totalPages }`.
- **Sorting** is **whitelisted per resource** (`parseSort(query, allowedFields, defaultSort)`) — a `sortBy` value that isn't in the list is ignored in favor of the default sort, so a client can never pass an arbitrary field/operator into a Mongoose sort.
- **Search** runs on the backend, case-insensitive, never in the browser. Students/Teachers search across a field on the model itself (`studentId`/`employeeId`) **and** the linked `User`'s `name`/`email` — done as one small lookup query (`utils/searchHelpers.js`) rather than an aggregation pipeline, which is simpler to read and fast enough at this project's scale.

## 4. Validation & duplicate handling

Every create/update route runs an `express-validator` chain
(`validators/admin/*.validator.js`) before the controller runs at all —
same `validate` → `{ success:false, errors:[{field,message}] }` shape as
Phase 3's auth validators (kept as a separate copy in
`utils/validateRequest.js` so `auth.validator.js` itself is untouched).

Duplicate emails/IDs/codes are checked explicitly before writing (so the
error message is specific — "this Student ID" vs. "this email") and the
unique Mongoose indexes from Phase 2 are the backstop if two requests
race. Both paths return `409 Conflict`.

Malformed `:id` params are rejected with `400` by `validateObjectId`
middleware before any database query runs.

## 5. Auth-critical detail: creating a User + a profile is not atomic

Creating a student or teacher means creating **two** documents: a `User`
(for login) and a `Student`/`Teacher` (the profile). If the second write
fails — e.g. a roll-number collision that slipped past the pre-check —
the controller deletes the `User` it just created before re-throwing the
error, so a failed "Add Student" never leaves a dangling login-capable
account with no profile behind it.

```js
const user = await User.create({ name, email, password, role: 'student' })
try {
  const student = await Student.create({ user: user._id, ... })
} catch (err) {
  await User.deleteOne({ _id: user._id })
  throw err
}
```

Password hashing is untouched from Phase 3: the controller passes a
**plain** password to `User.create(...)` and the model's `pre('save')`
hook hashes it — never hashed manually here, avoiding double-hashing.

Role is **always hardcoded** in the controller (`role: 'student'` /
`role: 'teacher'`) — any `role` field in the request body is ignored, so
neither form can be used to create an admin account.

## 6. Deletion strategy: soft delete only

`DELETE /api/admin/{resource}/:id` never removes a document. It sets
`isActive: false` (and for Students/Teachers, also `isActive: false` on
the linked `User`, so a deactivated person can no longer log in). This
was a deliberate choice, not a shortcut:

- Students are referenced by `Attendance`, `FaceProfile`, and
  `AttendanceSession`. Subjects/Classrooms/Courses are referenced by
  `Timetable`, `Attendance`, and `AttendanceSession`. Hard-deleting any
  of them would orphan those references.
- `PATCH .../:id/status` and `DELETE .../:id` are intentionally
  equivalent (`DELETE` is `PATCH { isActive: false }` under the hood) —
  both exist because the spec asked for a `DELETE` endpoint, but neither
  one destroys data.
- The frontend never fires this on a single click — `ConfirmDialog`
  always asks first (see §9).

Every list endpoint still returns inactive records by default (filter
with `?status=active` to hide them), and the `isActive` column is always
visible in the table, so deactivated records aren't silently invisible
to an admin who needs to reactivate one.

## 7. Dashboard statistics

`GET /api/admin/dashboard/stats` runs 10 `countDocuments()` queries in
parallel (`Promise.all`) — total and active count for each of Students,
Teachers, Subjects, Courses, Classrooms — and the Phase 4
`AdminDashboard.jsx` now renders these instead of the hardcoded
`1,250 / 48 / 32 / 24` demo numbers. The timetable preview and activity
feed on that same page are **still** hardcoded placeholder data (clearly
labeled in both the code and the UI) — they depend on Timetable/
Attendance features that are out of scope for this phase.

## 8. Frontend architecture

- **`services/adminService.js`** — one `resourceService(key, basePath)` factory produces `{ list, get, create, update, updateStatus, remove }` for all five resources, so there's one implementation of "call this REST shape" instead of five.
- **`hooks/useAdminList.js`** — shared search (debounced via `hooks/useDebounce.js`) + filter + pagination + fetch state, reused by all five list pages instead of being rewritten five times. Changing search or a filter resets to page 1 automatically.
- **`context/ToastContext.jsx`** — minimal toast notification system (no library) for success/error feedback after create/update/status-change actions.
- **`components/admin/`** — `AdminPageHeader`, `SearchInput`, `FilterBar`, `DataTable`, `Pagination`, `AdminFormModal`, `ConfirmDialog`. Each resource page composes these instead of hand-rolling its own table/modal/pagination markup.
- **`DataTable`** wraps its `<table>` in `overflow-x-auto` inside its own card, so a wide table scrolls horizontally within itself on mobile rather than widening the whole page.

## 9. UX details the spec called out specifically

- **Delete confirmation:** every status change (activate/deactivate) goes through `ConfirmDialog` — never fires on the first click.
- **Success/error feedback:** every create/update/status action shows a toast (`"Student created successfully."` / `"Unable to delete classroom."` etc.), pulling the specific message from the API response when there is one.
- **Loading states:** `DataTable` shows a spinner while `loading` is true and a distinct "no records" empty state when a search/filter returns nothing — never a blank table.
- **Password safety:** the Edit forms never include a password field at all, so there's no code path that could accidentally blank out or overwrite a password during a profile edit.

## 10. Security checklist

- [x] Every admin route requires a valid JWT (`protect`)
- [x] Every admin route requires `role: 'admin'` (`authorizeRoles('admin')`) — verified for teacher/student/no-token/invalid-token against every resource in `tests/admin.test.js`
- [x] No password ever returned (User is populated with an explicit safe field list, never the raw document)
- [x] Registration/creation can never assign `role: 'admin'` from client input
- [x] Malformed ObjectIds rejected with `400` before hitting the database
- [x] Pagination `limit` capped at 100
- [x] Sort fields whitelisted per resource — no raw client string reaches a Mongoose sort/query operator
- [x] Duplicate email/ID/code return `409` with a specific message
- [x] Errors never leak stack traces, Mongo internals, or JWT details (same centralized handler as Phase 1/3)

## 11. Testing

**`server/tests/admin.test.js`** (new) covers, over real HTTP via `supertest` against a real in-memory MongoDB:
- Role authorization for **every one of the 5 resources**: admin allowed, teacher `403`, student `403`, no token `401`, invalid token `401` (25 assertions total, one full matrix pass)
- Dashboard stats return real counts
- Student: create, duplicate studentId → `409`, pagination metadata, update without touching password hash, deactivate also blocks login, malformed id → `400`
- Teacher: create with role forced to `teacher`, role-injection attempt ignored, duplicate employeeId → `409`, update
- Subject: create linked to a course, duplicate code → `409`, update
- Course: create + list, update
- Classroom: create + list, duplicate code → `409`, non-positive capacity rejected, update

Like every prior phase's DB-backed suite, this needs `mongodb-memory-server` to download a real `mongod` — internet access this sandbox doesn't have. See the root README/response for exactly what was and wasn't executed here.

## 12. Future integration points

- **Phase 6 (Teacher Module):** `Subject.teachers` and `Teacher.subjects` set up here are what "my subjects" will query.
- **Phase 8/9 (Attendance/Analytics):** `Student`/`Subject`/`Classroom` records created here are what real attendance sessions and analytics will reference — nothing about their shape needs to change.
- **Phase 7 (Computer Vision):** `Classroom.hasCamera`/`cameraId`, editable here, is what the attendance session flow will check before offering camera-based attendance for a room.
- The `ComingSoon` wildcard route still covers `/admin/timetable`, `/admin/attendance`, `/admin/analytics`, `/admin/reports`, `/admin/notifications`, `/admin/settings` — untouched by this phase.
