# Computer Vision — Face Registration & Recognition

Phase 7 adds an **additional** attendance method — face recognition —
on top of Phase 6's manual attendance workflow. Manual marking still
works exactly as before; this is a second way to mark the same
`Attendance` records, not a replacement.

## 1. Architecture

```
Browser (face-api.js: detection + descriptor generation, runs locally)
      ↓ (128-length descriptor array only — never an image)
Express (protect → authorizeRoles('teacher') → loadTeacherProfile)
      ↓
routes/teacher/attendance.routes.js
  — /sessions, /sessions/:id, /sessions/:id/mark, /sessions/:id/complete
    (Phase 6, manual) and /sessions/:id/recognize (Phase 7, this file too)
    all live in ONE route file, registered once — no route is ever
    mounted from two places.
      ↓
Ownership check (student's course ↔ teacher's subjects)
      ↓
Compare against ONLY this session's roster's FaceProfiles
      ↓
Distance ≤ FACE_MATCH_THRESHOLD? → mark Attendance (method: 'Face Recognition')
```

**Where matching happens — and why:** all face *detection* and
*descriptor generation* run in the browser (that's what face-api.js
does, client-side, using TensorFlow.js). The browser never receives
another student's stored descriptor and never does the *matching*
itself — it sends one descriptor to the backend, and the backend
compares it only against the descriptors of students already known to
be on the current session's roster. This was a deliberate choice over
browser-side matching: matching in the browser would require shipping
some subset of the class's stored biometric descriptors to that
browser, which is unnecessary exposure for data this sensitive. See §8.

## 2. Camera workflow (`components/vision/FaceCamera.jsx`)

1. Load 3 face-api.js models (once, cached): `tiny_face_detector`,
   `face_landmark_68`, `face_recognition`.
2. Request `getUserMedia` camera permission.
3. Every 700ms: run detection on the current video frame.
   - **0 faces** → "No face detected. Please position your face inside
     the camera frame."
   - **2+ faces** → "Multiple faces detected. Only one face should be
     visible." — no descriptor is ever emitted in this case.
   - **exactly 1 face** → landmarks are used to align it, a 128-length
     descriptor is generated, and it's handed to the calling page via
     `onFaceDetected(descriptor)`.
4. On unmount (navigating away, closing the tab) or when the page marks
   itself inactive: `stream.getTracks().forEach(track => track.stop())`
   — the webcam is never left running in the background.

The "one face at a time" rule is enforced once, inside `FaceCamera`,
not re-implemented in every page that uses it.

## 3. Face registration

**Flow:** Teacher → My Classes → **Register Faces** → pick a student
from that subject's roster (`/teacher/classes/:subjectId/faces`) →
**Register** (`/teacher/students/:studentId/face`) → camera opens →
capture 1–5 samples (recommended 3, from slightly different angles) →
**Register Face**.

- The student picker only ever shows students actually enrolled in the
  teacher's own subject — a teacher can't type an arbitrary student ID
  into this flow even if they wanted to, and the backend independently
  re-checks this (see §6).
- `POST /api/teacher/face-profiles` re-registering a student **updates**
  their existing `FaceProfile` document rather than creating a second
  one — "one profile per student" (already enforced by Phase 2's unique
  index) is preserved.
- Nothing is saved until at least one valid descriptor has been
  captured; the "Register Face" button is disabled until then.

## 4. Face recognition (attendance)

**Flow:** an **Active** attendance session (Phase 6, unchanged) →
Mark Attendance page → **Start Face Recognition**
(`/teacher/attendance/session/:id/face`) → camera runs continuously →
each detected single face is sent for matching → result shown → repeat
for the next student.

For each detection tick with exactly one face:
1. `POST /api/teacher/attendance/sessions/:id/recognize` with the descriptor.
2. Backend loads the session (ownership-checked, same as Phase 6's
   `loadOwnedSession`) and its roster (same `getRoster` used by manual
   marking — reused, not reimplemented).
3. Backend loads `FaceProfile` documents **only** for students on that
   roster, computes Euclidean distance from the submitted descriptor to
   each stored sample, and takes the closest.
4. **Distance > `FACE_MATCH_THRESHOLD`** → "Face not recognized. Please
   register this student before taking attendance." Nothing is written.
5. **Match, already marked this session** → "Attendance already
   marked." Nothing new is written (no duplicate).
6. **Match, not yet marked** → an `Attendance` record is created:
   `status: 'Present'`, `method: 'Face Recognition'`, `confidence`
   (0–1, derived from the distance). "Attendance marked successfully."

After a result (match or no-match), the frontend pauses re-submitting
for 2.5s so the same still-visible face isn't sent again every 700ms
while its result is on screen.

## 5. Why recognition can never cross into another class

This is the single most important security property of this phase, and
it's true **by construction**, not by an extra check bolted on after
the fact:

```js
const roster = await getRoster(session.subject.course?._id)   // THIS session's students only
const rosterIds = roster.map((s) => s._id)
const profiles = await FaceProfile.find({ student: { $in: rosterIds }, ... })  // only their profiles
// ...compare `descriptor` against `profiles` — nothing else was ever loaded
```

A face belonging to a real, registered student who simply isn't
enrolled in *this* session's subject can never "match", because their
`FaceProfile` was never part of the comparison set — not because a
match was found and then rejected. `server/tests/faceRecognition.test.js`
has a test proving exactly this (a descriptor that's a near-perfect
match for a real stored profile still comes back `matched: false` when
that student isn't on the roster).

## 6. Ownership & ID validation

- `registerFace` looks up the `Student`, then checks
  `teacherCanAccessStudent(teacherId, student)` — true only if the
  teacher has an active `Subject` whose `course` matches the student's
  `course`. A `studentId` for a student outside every subject this
  teacher teaches is rejected `403`, regardless of what the frontend
  sent.
- `recognizeFace` reuses `loadOwnedSession` — a session belonging to
  another teacher returns `404` (indistinguishable from "doesn't
  exist"), exactly like Phase 6's manual-attendance endpoints.
- Every `:id`/`:studentId`/`:subjectId` path parameter is validated as a
  well-formed ObjectId (`validateObjectId` middleware, Phase 5) before
  any query runs — malformed IDs get a clean `400`, not a stack trace.

## 7. Descriptor validation

`POST /api/teacher/face-profiles` and the `/recognize` endpoint both
validate every descriptor before it touches the database
(`validators/teacher/faceProfile.validator.js`):
- must be an array of **exactly 128** elements (the face-api.js
  recognition model's output size)
- every element must be a JS `number` and `Number.isFinite` (rejects
  `NaN`, `Infinity`, `null`, strings, etc.)
- registration allows 1–10 samples per submission

## 8. Descriptor storage & privacy

- **No raw photographs are stored.** Only the numeric descriptor (a
  128-length float vector) that face-api.js's recognition model
  produces — this is the same design Phase 2's `FaceProfile` model
  already had, unchanged in this phase.
- **No broad face-data endpoint exists.** There is no
  `GET /api/face-profiles` that returns descriptors to a browser. The
  only read is `GET /api/teacher/face-profiles/status/:studentId`,
  which returns whether a face is registered and when — never the
  descriptor itself.
- **Matching is scoped, not global** — see §5.
- Face descriptors are biometric-related data. This is an academic
  project; a real deployment handling real students' biometric data
  should have explicit consent collection, a data-retention policy, and
  likely falls under biometric-data-specific regulations in many
  jurisdictions — worth knowing even though it's out of scope to
  implement here.

## 9. Matching threshold

`FACE_MATCH_THRESHOLD` (`server/.env`, default `0.6`) is the one place
this number lives (`server/utils/faceDistance.js`). Lower = stricter
(fewer false positives, more "not recognized" results); face-api.js's
own examples use ~0.6 as a typical same-person cutoff for its
recognition model. Confidence is normalized against this same threshold
(`confidence = clamp(1 - distance/threshold, 0, 1)`), so a distance
right at the threshold always reads as confidence `0` and a
near-perfect match reads as confidence close to `1`, regardless of what
the threshold is set to. This is a heuristic, not a guarantee — face
recognition is never 100% accurate, which is exactly why manual
attendance remains fully available alongside it.

## 10. Model files

```
client/public/models/
  tiny_face_detector_model-weights_manifest.json
  tiny_face_detector_model-shard1
  face_landmark_68_model-weights_manifest.json
  face_landmark_68_model-shard1
  face_recognition_model-weights_manifest.json
  face_recognition_model-shard1
  face_recognition_model-shard2
```

Downloaded once from face-api.js's own repository
(`justadudewhohacks/face-api.js`, `weights/` folder) and committed into
`client/public/`, which Vite serves from the site root — so the app
never depends on a third-party CDN staying online. If these files are
ever missing or corrupted, `FaceCamera` catches the load failure and
shows **"Face recognition models could not be loaded. Please check the
model files."** — it never fails silently.

## 11. Troubleshooting

| Symptom | Likely cause |
|---|---|
| "Face recognition models could not be loaded" | `client/public/models/` is missing/incomplete, or the dev server isn't serving `public/` correctly |
| "Camera permission is required..." | Browser denied camera access — check the site permission in browser settings |
| Face never says "detected" | Poor lighting, face too far from camera, or `scoreThreshold` in `utils/faceApiModels.js` is too strict for your webcam |
| Always "not recognized" for a real match | Try re-registering with more samples/better lighting; consider raising `FACE_MATCH_THRESHOLD` slightly (e.g. `0.65`) |
| Recognizes the wrong person | Lower `FACE_MATCH_THRESHOLD` (stricter matching), and register more/better samples for the confused students |
| Camera turns on but status stays stuck on "Requesting camera access…" forever | **Fixed** — this was a real bug in an earlier version: the detection loop called `.withFaceDescriptor()` (singular) after `detectAllFaces()`, but that method only exists on the `detectSingleFace()` chain (`detectAllFaces()`'s landmarks task only exposes the plural `.withFaceDescriptors()`). Calling a method that doesn't exist threw a `TypeError` on every single detection tick, and with no `try/catch` around it, the error was silently swallowed as an unhandled promise rejection — so `report()` was never called again after `'requesting-camera'`, even though the camera itself was working fine. Fixed in `FaceCamera.jsx` by using `.withFaceDescriptors()` and wrapping the detection call in `try/catch` (now reports an `'error'` status and logs to the console instead of hanging silently if this class of bug ever recurs). |
| `Route not found - /api/teacher/attendance/sessions/:id/recognize` | **Fixed** — the recognize route was originally registered from a second `Router()` instance mounted at the same `/attendance` prefix as the main attendance routes. That's valid Express and worked when tested directly, but it's an easy setup to get out of sync (e.g. one file edited without the other, or a route file not re-imported after an edit). Consolidated: `/sessions/:id/recognize` is now defined directly inside `routes/teacher/attendance.routes.js` alongside every other session route, and the separate `faceRecognition.routes.js` file was removed — one file, one registration, nothing to fall out of sync. |

## 12. Testing

**`server/tests/faceRecognition.test.js`** (new) — real HTTP via
`supertest` against a real in-memory MongoDB, using **deterministic
mock 128-length descriptor vectors** (actual browser face-api.js
detection cannot run in a Node test environment):
- Authorization: no token → `401`, student → `403`, teacher → allowed
- Registration validation: valid descriptor accepted; empty, wrong-length,
  and NaN/Infinity-smuggling descriptors all rejected `400`;
  re-registration updates the same profile (still exactly one per student)
- Registration ownership: a teacher cannot register a face for a student
  outside their own course
- Recognition: a close descriptor matches and creates a `Present`/`Face
  Recognition` record; a far descriptor doesn't match and creates
  nothing; recognizing the same student twice creates no duplicate;
  a descriptor matching a real profile **outside the roster** still
  comes back unmatched (§5); recognition on another teacher's session
  → `404`; recognition on a completed session → `400`; malformed
  descriptor → `400` before any query runs
- Regression: manual attendance marking still works; `GET
  /api/teacher/classrooms` still returns active classrooms with zero
  Timetable data (the Phase 6 classroom fix, re-verified here)

### Testing limitations — read before trusting a "passed" claim

- **Live browser camera testing was NOT performed.** This response was
  generated in a sandboxed environment with no camera and no browser —
  nobody has looked at an actual video feed, actual face detection
  accuracy, or actual lighting/angle behavior. The camera/detection code
  was written carefully and follows face-api.js's documented API, but
  it has not been visually verified.
- **`server/tests/faceRecognition.test.js` was NOT executed** in this
  environment. Like every DB-backed test suite in this project, it
  needs `mongodb-memory-server` to download a real `mongod` binary,
  which needs internet access this sandbox doesn't have.
- What **was** verified directly: the distance/confidence math
  (`utils/faceDistance.js`) was run standalone with hand-computed
  vectors and produced correct results; every changed/new file passed
  `node --check`; the full app loads and responds correctly to
  unauthenticated/malformed requests on every new endpoint; the frontend
  builds with zero errors.
