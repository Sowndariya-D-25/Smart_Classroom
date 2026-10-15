# Database Schema — Smart Classroom & Attendance Analytics Portal

This document explains the 12 Mongoose models added in Phase 2, how they
relate to each other, and the key constraints (validation + indexes) each
one enforces at the database level.

All models live in `server/models/`, one file per model, and are
re-exported from `server/models/index.js` for convenient importing.

## Design principles

- **User vs role profile.** Login/auth data (`email`, `password`, `role`)
  lives only on `User`. `Student`, `Teacher`, and `Admin` each hold a
  `user` reference and only role-specific fields — no duplicated email or
  password. This means Phase 3's auth system only has to touch `User`.
- **References, not embedding.** Relationships use `ObjectId` references
  (e.g. `Student.course` points at a `Course`), not copied/embedded
  documents, so data isn't duplicated and stays consistent when something
  changes.
- **Soft delete via `isActive`.** Nearly every model has an `isActive`
  flag instead of being hard-deleted. A student, teacher, subject, or
  classroom leaving the system gets deactivated so historical attendance
  records that reference it stay intact and meaningful — deleting the
  document outright would silently break every `Attendance` record
  pointing at it.
- **Database-enforced constraints, not just app logic.** Anything that
  must never happen twice (duplicate email, duplicate attendance for the
  same student in the same session, etc.) is backed by a MongoDB unique
  index, not just a check in a controller.

## Models

### User (`server/models/User.js`)
The shared identity for every person in the system.

| Field | Notes |
|---|---|
| `name`, `email`, `password`, `role` | Required. `role` ∈ `admin, teacher, student`. `email` is unique + lowercased. |
| `password` | `select: false` — never returned by a normal query; Phase 3's login controller opts in with `.select('+password')`. |
| `phone`, `isActive`, `lastLogin` | Optional / bookkeeping. |

Indexes: `email` (unique), `role`.

### Student (`server/models/Student.js`)
Academic profile for a student. `user` and `studentId` are each unique
(one Student per User, one Student per ID). `rollNumber` is only unique
**within a course** (`{course, rollNumber}` compound unique index) since
two different courses can both have a "roll no. 1".

References: `user → User`, `course → Course`, `faceProfile → FaceProfile`.

### Teacher (`server/models/Teacher.js`)
`user` and `employeeId` are each unique. `subjects` is an array of
`Subject` references — a teacher can teach more than one subject.

### Admin (`server/models/Admin.js`)
`user` and `employeeId` are each unique. `permissions` is a validated
array of strings (e.g. `manage_students`, `view_analytics`) drawn from a
fixed list exported as `ADMIN_PERMISSIONS`.

### Course (`server/models/Course.js`)
An academic program, e.g. "B.E. Computer Science and Engineering".
`code` is unique. Referenced by `Student.course` and `Subject.course`.

### Subject (`server/models/Subject.js`)
A subject taught within a course, e.g. "Data Structures". `code` is
unique. `teachers` is an array of `Teacher` references; `course` is
required.

### Classroom (`server/models/Classroom.js`)
A physical room. `code` is unique, `capacity` must be a positive number.
`hasCamera` / `cameraId` are placeholders the Phase 7 Computer Vision
work will use to know which rooms have a camera configured — no hardware
integration happens in Phase 2.

### Timetable (`server/models/Timetable.js`)
A weekly recurring class slot. `startTime`/`endTime` are validated
`HH:MM` 24-hour strings, and a custom validator ensures `endTime` is
later than `startTime`. `dayOfWeek` is restricted to Monday–Saturday.
A compound unique index on `{teacher, dayOfWeek, startTime, academicYear}`
stops a teacher from being double-booked in the same slot.

### AttendanceSession (`server/models/AttendanceSession.js`)
One camera-based (or manual) attendance-taking event — the "run" that
produces many `Attendance` records. `status` moves through
`Scheduled → Active → Completed` (or `Cancelled`). `detectedStudents` is
the list of students the session recognized; `unknownFaces` stores only
a **count + confidence + timestamp** per unrecognized-face sighting —
never a photo.

### Attendance (`server/models/Attendance.js`)
The most important model. One record = one student's attendance status
for one session.

- `status` ∈ `Present, Absent, Late`
- `method` ∈ `Face Recognition, Manual`
- `confidence` is a **0–1** float (not 0–100), only meaningful when
  `method === 'Face Recognition'`
- **Duplicate prevention:** `{student, session}` has a unique compound
  index, so MongoDB itself rejects a second attendance record for the
  same student in the same session — this cannot be bypassed by a bug in
  the API layer.

Also indexed: `student`, `subject`, `teacher`, `date`, `status`, and the
compound `{student, subject, date}` used by attendance-percentage queries.

### FaceProfile (`server/models/FaceProfile.js`)
Stores face **descriptors** — numeric vectors produced by a face
embedding model (e.g. face-api.js's 128-length descriptor) — never raw
photographs. `student` is unique, so re-registering a student's face
overwrites `descriptors` on the same document rather than creating a
second one ("one active face profile per student"). A `pre('save')` hook
keeps `sampleCount` and `lastUpdated` in sync with `descriptors`
automatically. `modelVersion` records which embedding model produced the
vectors, so descriptors never get compared against an incompatible model
version later.

### Notification (`server/models/Notification.js`)
`type` ∈ `LOW_ATTENDANCE, ATTENDANCE_MARKED, CLASS_REMINDER, ANNOUNCEMENT, SYSTEM`.
Indexed on `recipient`, `isRead`, and `createdAt` (descending, for "most
recent first" feeds), plus a compound `{recipient, isRead}` index for the
common "my unread notifications" query.

## Relationship map

```
User ──1:1── Student ──*:1── Course
              │
              └──1:1── FaceProfile

User ──1:1── Teacher ──*:*── Subject ──*:1── Course

User ──1:1── Admin

Timetable ──*:1── Course / Subject / Teacher / Classroom

AttendanceSession ──*:1── Teacher / Subject / Classroom
       │
       └──*── Attendance ──*:1── Student / Subject / Teacher / Classroom / (markedBy) User

User ──1:*── Notification (as recipient)
```

## Duplicate attendance prevention (how it actually works)

1. `attendanceSchema.index({ student: 1, session: 1 }, { unique: true })`
   creates a compound unique index in MongoDB.
2. If the API ever tries to insert a second `Attendance` document for the
   same `student` + `session` pair (whether from a bug, a retried
   request, or a second face match in the same session), MongoDB rejects
   the insert with a duplicate-key error (`E11000`) — the app's error
   handler (`middleware/errorHandler.js`, already in place from Phase 1)
   turns that into a clean `409 Duplicate value` response once the CRUD
   API is built in a later phase.
3. `server/tests/models.integration.test.js` proves this: it inserts one
   attendance record and asserts that inserting the same
   `{student, session}` pair again throws.

## Seed data

`server/seed/seed.js` (`npm run seed`) populates a fully-connected demo
dataset — every reference points at a real, just-created document:

| Collection | Count | Notes |
|---|---|---|
| Course | 1 | "B.E. Computer Science and Engineering" |
| Classroom | 3 | 2 with `hasCamera: true` |
| User + Admin | 1 | `admin@smartclassroom.local` |
| User + Teacher | 3 | `teacher1..3@smartclassroom.local` |
| User + Student | 20 | `student1..20@smartclassroom.local` |
| Subject | 5 | Round-robin assigned to the 3 teachers |
| FaceProfile | ~14 | ~70% of students, random-but-realistic 128-length descriptor vectors (not real faces) |
| Timetable | 5 | One weekly slot per subject |
| AttendanceSession | 20 | 4 completed sessions per subject, spread across recent dates |
| Attendance | 400 | Every student × every session (20 × 20), status/method/confidence generated per rules below |
| Notification | 6 | 2 `LOW_ATTENDANCE` (students), 3 `CLASS_REMINDER` (teachers), 1 `SYSTEM` (admin) |

Attendance generation rule per student per session: ~72% `Present` (Face
Recognition, confidence 0.78–0.99), ~10% `Absent` (Face Recognition, no
match, `confidence: null`), ~18% `Late` (Manual, teacher-corrected). This
gives every subject a realistic, non-uniform attendance percentage for
Phase 9's analytics work.

**Demo login (password `Password123!` for everyone — login itself ships
in Phase 3):**
- Admin: `admin@smartclassroom.local`
- Teachers: `teacher1@smartclassroom.local`, `teacher2@...`, `teacher3@...`
- Students: `student1@smartclassroom.local` through `student20@...`

**Seed behavior:** the script deletes and re-inserts all documents in the
12 collections this app owns, and refuses to run when `NODE_ENV=production`.
It's meant to be run repeatedly during development — every run gives you
a clean, consistent dataset. It never touches any collection outside this
app's own 12 models.
