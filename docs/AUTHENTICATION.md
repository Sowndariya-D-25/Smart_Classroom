# Authentication & Authorization

Phase 3 adds real login/registration on top of the Phase 2 `User` model:
bcrypt password hashing, JWT-based sessions, and role-based authorization
enforced on the backend (not just hidden in the UI).

## Architecture

```
React (Login/Register pages)
      ↓
AuthContext (user, loading, isAuthenticated, login/register/logout)
      ↓
authService.js  →  api.js (Axios, attaches "Authorization: Bearer <token>")
      ↓
Express routes (server/routes/auth.routes.js)
      ↓
protect  (server/middleware/auth.middleware.js — verifies JWT, loads User)
      ↓
authorizeRoles(...)  (server/middleware/role.middleware.js — checks req.user.role)
      ↓
auth.controller.js  →  User model (bcrypt hash/compare)  →  MongoDB
```

## Why registration can't set role

`POST /api/auth/register` **always** creates a `student` account. Any
`role` field sent in the request body is silently ignored by
`auth.controller.js` — it's never read. This was a deliberate design
choice, not an oversight:

- If registration trusted a client-supplied `role`, anyone could send
  `{ "role": "admin" }` and grant themselves administrator access.
- Teacher and admin accounts require real-world provisioning (an
  employee ID, a department, being added by the institution) — they
  aren't something a public sign-up form should hand out.
- So: **students self-register**, and **teacher/admin accounts are
  created by the seed script** (Phase 2) or, in a later phase, by an
  authenticated admin-only "create user" endpoint. Never by an anonymous
  request.

A self-registered student gets a `User` document immediately (so they
can log in), but doesn't yet have a `Student` profile document
(studentId, course, section, etc.) — that's completed by an admin in
Phase 5's CRUD module. `GET /api/auth/me` reflects this: it returns
`profile: null` until that happens, rather than erroring.

## Password hashing

Hashing happens in **one place**: a `pre('save')` hook on the `User`
model (`server/models/User.js`).

```js
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next()
  const salt = await bcrypt.genSalt(10)
  this.password = await bcrypt.hash(this.password, salt)
  next()
})
```

Both `auth.controller.js` (`register`) and `seed/seed.js` pass a **plain**
password to `User.create(...)` / `new User(...).save()` and let this hook
hash it. Nothing else in the codebase calls `bcrypt.hash` directly — this
avoids the classic bug of accidentally hashing an already-hashed password
(which would make login impossible). `User.comparePassword(candidate)`
(also on the model) wraps `bcrypt.compare` for login.

## Login flow

1. `POST /api/auth/login` with `{ email, password }`.
2. `express-validator` checks both fields are present and email is
   well-formed (`validators/auth.validator.js`).
3. The controller looks up the user with `.select('+password')` — the
   schema marks `password` as `select: false`, so it's excluded from
   every other query by default and must be explicitly requested here.
4. `user.comparePassword(password)` checks the hash.
5. If the user doesn't exist **or** the password is wrong, the response
   is the same generic `401 Invalid email or password` either way — this
   stops the endpoint being used to check which emails have accounts.
6. If the account exists but `isActive: false`, a distinct `401` message
   is returned (deactivated accounts are a real, seed-supported state,
   not something to hide behind the generic message).
7. On success: `lastLogin` is updated, a JWT is issued, and the response
   returns `{ token, user }` — `user` is passed through
   `sanitizeUser()` (`server/utils/formatUser.js`), which only ever
   includes `id, name, email, role, phone, isActive, lastLogin`. The
   password hash never leaves the server.

## JWT

- Signed with `jsonwebtoken` using `JWT_SECRET` and `JWT_EXPIRES_IN` from
  environment variables — never hardcoded.
- Payload is intentionally minimal:
  ```json
  { "userId": "665f1...", "role": "student", "iat": ..., "exp": ... }
  ```
  No password hash, no face descriptors, no personal data — a JWT is
  base64-encoded, not encrypted, so anyone holding it can read the
  payload.
- **Storage & trade-off:** the frontend stores the token in
  `localStorage` (see `client/src/services/api.js`). This is simple and
  works well for an academic project, but it means the token is
  readable by any JavaScript running on the page — if the app ever had
  an XSS vulnerability, the token could be stolen. A production system
  handling sensitive data would typically use an `httpOnly` cookie
  instead, which JavaScript can't read at all. That's a reasonable
  future hardening step, noted here rather than implemented, to keep
  this phase's architecture simple and easy to explain in a viva.

## Middleware

**`protect`** (`server/middleware/auth.middleware.js`) — runs before any
protected route:
1. Reads `Authorization: Bearer <token>`. Missing → `401`.
2. `jwt.verify(token, JWT_SECRET)`. Invalid signature → `401` (via the
   Phase 1 centralized error handler's `JsonWebTokenError` case). Expired
   → `401` (`TokenExpiredError` case).
3. Loads the `User` by `decoded.userId`. Missing or `isActive: false` →
   `401`.
4. Attaches the full user document to `req.user` and calls `next()`.

**`authorizeRoles(...roles)`** (`server/middleware/role.middleware.js`) —
runs after `protect`, so `req.user` is already set:
```js
router.get('/admin/students', protect, authorizeRoles('admin'), listStudents)
```
If `req.user.role` isn't in the allowed list → `403 Forbidden`.

### Why this matters more than the frontend

`RoleRoute` on the frontend redirects a student who types
`/admin/dashboard` straight into their own dashboard — but that's a UX
nicety, not security. The actual boundary is `authorizeRoles(...)` on
the backend: even if someone bypasses the UI entirely and calls
`GET /api/auth/test/admin` directly with a valid student token, they get
`403`, not `200`. `server/tests/auth.test.js` proves this for
admin/teacher/student in every combination.

## API endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | none | Creates a `student` account, returns `{ token, user }` |
| POST | `/api/auth/login` | none | Verifies credentials, returns `{ token, user }` |
| GET | `/api/auth/me` | Bearer token | Returns `{ user, profile }` for the current session |
| GET | `/api/auth/test/admin` | Bearer token, `admin` only | **Dev-only**, verifies role authorization |
| GET | `/api/auth/test/teacher` | Bearer token, `admin`/`teacher` | **Dev-only** |
| GET | `/api/auth/test/student` | Bearer token, any role | **Dev-only** |

The three `/test/*` routes exist solely so `server/tests/auth.test.js`
can prove role authorization end-to-end over real HTTP. They're mounted
only when `NODE_ENV !== 'production'` (see `routes/auth.routes.js`) —
in a production deployment they don't exist at all.

## Frontend: AuthContext

`client/src/context/AuthContext.jsx` exposes `{ user, profile, loading,
isAuthenticated, login, register, logout, refreshUser }` via
`useAuth()`.

**Initialization:** on app start, if a token is in `localStorage`,
`AuthContext` calls `GET /api/auth/me` to verify it's still valid before
considering the user logged in. `loading` starts `true` and is always
set to `false` once that check resolves (success or failure) — the app
never gets stuck on a spinner. If the token is invalid/expired, it's
discarded and the user is treated as logged out.

**Mid-session expiry:** if a token expires while the tab is open, the
next API call gets a `401`. The Axios response interceptor in
`services/api.js` catches this (except for `/auth/login` and
`/auth/register`, so a *wrong password* doesn't get treated as a
*session expiry*), clears the stored token, and fires a
`scaap:unauthorized` window event; `AuthContext` listens for that event
and clears its state, which causes `ProtectedRoute` to redirect to
`/login` on the next render. No forced `window.location` redirect is
used, so there's no risk of a reload/redirect loop.

## Protected & role routes (frontend)

- `ProtectedRoute` (`client/src/routes/ProtectedRoute.jsx`) — redirects
  to `/login` if not authenticated; shows a loading screen while auth is
  initializing.
- `RoleRoute` (`client/src/routes/RoleRoute.jsx`) — nested inside
  `ProtectedRoute`; redirects to the user's own dashboard if their role
  isn't in the route's `allow` list.

```jsx
<Route element={<ProtectedRoute />}>
  <Route element={<RoleRoute allow={['admin']} />}>
    <Route path="/admin/dashboard" element={<AdminDashboard />} />
  </Route>
  ...
</Route>
```

## Demo credentials

Seeded in Phase 2, login-ready as of Phase 3 (password is the same for
every seeded account):

| Role | Email | Password |
|---|---|---|
| Admin | `admin@smartclassroom.local` | `Password123!` |
| Teacher | `teacher1@smartclassroom.local` (also `teacher2`, `teacher3`) | `Password123!` |
| Student | `student1@smartclassroom.local` … `student20@smartclassroom.local` | `Password123!` |

## Testing

```bash
npm run test:server
```
Runs everything under `server/tests/`:
- `models.validation.test.js` — offline schema checks (no DB).
- `models.integration.test.js` — Phase 2's DB-constraint tests.
- `auth.test.js` — **new.** Full HTTP-level auth flow via `supertest`
  against a real in-memory MongoDB (`mongodb-memory-server`): registration
  (valid, invalid email, weak password, missing fields, duplicate email,
  role-injection attempt), login (valid, wrong password, unknown email,
  deactivated account, generic error message), `/me` (no token, invalid
  token, expired token, valid token), and role authorization (every
  admin/teacher/student × test-route combination).

`mongodb-memory-server` downloads a real `mongod` binary the first time
any of these run — that needs an internet connection and doesn't work in
network-locked environments, but works normally on a development machine.

### Manual testing

**PowerShell:**
```powershell
# Login as a seeded student
$response = Invoke-RestMethod `
  -Uri "http://localhost:5000/api/auth/login" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"email":"student1@smartclassroom.local","password":"Password123!"}'

$response.data.token   # the JWT
$response.data.user    # safe user info, no password

# Use the token to call the protected /me endpoint
Invoke-RestMethod `
  -Uri "http://localhost:5000/api/auth/me" `
  -Method GET `
  -Headers @{ Authorization = "Bearer $($response.data.token)" }

# Confirm a student is forbidden from the admin-only test route
Invoke-RestMethod `
  -Uri "http://localhost:5000/api/auth/test/admin" `
  -Method GET `
  -Headers @{ Authorization = "Bearer $($response.data.token)" }
# → 403 Forbidden
```

**curl (Git Bash / WSL / macOS / Linux):**
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"student1@smartclassroom.local","password":"Password123!"}'

curl http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer <paste token here>"
```

**Browser:** open http://localhost:5173/login, sign in with any seeded
account above, and confirm you land on the matching `/admin`, `/teacher`,
or `/student` dashboard placeholder. Try typing another role's dashboard
URL directly — you'll be redirected back to your own.

**Postman:** import as three requests — `POST /api/auth/login` (JSON
body as above), then `GET /api/auth/me` and `GET /api/auth/test/admin`
with header `Authorization: Bearer {{token}}`, where `{{token}}` is set
from the login response (Postman's "Tests" tab can auto-extract it, or
paste it manually for a quick check).

## Security checklist (Phase 3)

- [x] Passwords hashed with bcrypt (never stored or returned in plain text)
- [x] JWT signed with a secret from `JWT_SECRET` (never hardcoded)
- [x] Token expiration honored (`JWT_EXPIRES_IN`); expired tokens rejected
- [x] Invalid credentials rejected with a generic message
- [x] Deactivated (`isActive: false`) accounts rejected at login
- [x] Every protected route requires a valid JWT (`protect` middleware)
- [x] Role checks enforced on the backend (`authorizeRoles`), not just hidden in the UI
- [x] No password hash ever appears in an API response
- [x] No sensitive data inside the JWT payload
- [x] Registration cannot be used to create an admin or teacher account
- [x] Consistent `{ success, message, data }` / `{ success, message, errors }` response shape
