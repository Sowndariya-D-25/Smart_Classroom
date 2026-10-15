# SOURCE CODE

---

## A.1 Project Structure

The project follows a decoupled, monorepo architecture separating the client-side single-page application (React.js + Vite) from the server-side RESTful API service (Express.js + Node.js + Mongoose).

```text
smart-classroom-attendance-portal/
├── package.json                          # Root monorepo workspace orchestration
├── package-lock.json                     # Monorepo lockfile
├── README.md                             # Architectural overview & getting started guide
├── docs/                                 # Institutional technical specifications
│   ├── ADMIN_MODULE.md                   # Administrative subsystem specifications
│   ├── ANALYTICS.md                      # Data warehousing & reporting engine rules
│   ├── ATTENDANCE_MANAGEMENT.md          # Attendance business rules & status definitions
│   ├── AUTHENTICATION.md                 # RBAC matrix & JWT lifecycle policies
│   ├── COMPUTER_VISION.md                # Face-api.js neural network pipeline specs
│   ├── DATABASE_SCHEMA.md                # Entity relationships & indexing strategies
│   ├── MAIN_UI_LAYOUT.md                 # Visual design system & token definitions
│   └── TEACHER_MODULE.md                 # Faculty workflow & session lifecycle rules
├── client/                               # Frontend Single-Page Application (React 19 + Vite)
│   ├── package.json                      # Client dependencies & build scripts
│   ├── vite.config.js                    # Vite bundler configuration & React plugin
│   ├── tailwind.config.js                # Tailwind CSS design system tokens
│   ├── index.html                        # HTML5 document root
│   ├── vercel.json                       # Vercel SPA routing rewrite rules
│   ├── public/                           # Static assets served from site root
│   │   ├── favicon.svg                   # Vector application favicon
│   │   ├── logo.png                      # Institutional brand identity
│   │   └── models/                       # Pre-trained face-api.js weight shards & manifests
│   │       ├── face_landmark_68_model-shard1
│   │       ├── face_landmark_68_model-weights_manifest.json
│   │       ├── face_recognition_model-shard1
│   │       ├── face_recognition_model-shard2
│   │       ├── face_recognition_model-weights_manifest.json
│   │       ├── tiny_face_detector_model-shard1
│   │       └── tiny_face_detector_model-weights_manifest.json
│   └── src/                              # Client application source code
│       ├── main.jsx                      # React 19 DOM bootstrap & root mounting
│       ├── App.jsx                       # Client-side router & route security wrappers
│       ├── index.css                     # Global stylesheets & typography definitions
│       ├── components/                   # Reusable UI presentation & composite elements
│       │   ├── common/                   # Base controls (StatCard, StatusBadge, EmptyState)
│       │   ├── layout/                   # Structural layouts (Sidebar, Header, PageContainer)
│       │   └── vision/                   # Vision UI (FaceCamera, FaceRecognitionStatus)
│       ├── context/                      # React Context providers (AuthContext, ToastContext)
│       ├── pages/                        # Role-based route view components
│       │   ├── Login.jsx                 # Centralized user authentication view
│       │   ├── Register.jsx              # Self-service student registration view
│       │   ├── admin/                    # Administrative views (Dashboard, Students, etc.)
│       │   ├── teacher/                  # Faculty views (FaceAttendance, Sessions, etc.)
│       │   └── student/                  # Student views (Dashboard, Attendance, OD/Leave)
│       ├── services/                     # Centralized Axios API communication layer
│       │   ├── api.js                    # Core Axios instance & request/response interceptors
│       │   ├── authService.js            # Authentication endpoints wrapper
│       │   ├── adminService.js           # Administrative resource API methods
│       │   └── teacherService.js         # Faculty session & attendance API methods
│       └── utils/                        # Frontend algorithmic helpers
│           ├── faceApiModels.js          # Model loader & TinyFaceDetector configurations
│           └── exportToExcel.js          # Tabular report spreadsheet generator
└── server/                               # Backend RESTful API Service (Express 5 + Mongoose 9)
    ├── package.json                      # Backend dependencies & runtime scripts
    ├── server.js                         # HTTP server initialization & graceful shutdown
    ├── app.js                            # Express app configuration & middleware pipeline
    ├── config/                           # Infrastructure configurations
    │   └── db.js                         # MongoDB connection manager & event listeners
    ├── models/                           # Mongoose data schemas & validation rules
    │   ├── index.js                      # Central barrel export for domain models
    │   ├── User.js                       # Core identity schema with bcrypt password hashing
    │   ├── Admin.js                      # Administrative personnel profile schema
    │   ├── Teacher.js                    # Faculty member profile schema
    │   ├── Student.js                    # Student profile & academic cohort schema
    │   ├── Course.js                     # Degree program schema
    │   ├── Subject.js                    # Academic subject & teacher allocation schema
    │   ├── Classroom.js                  # Physical room & facility schema
    │   ├── Timetable.js                  # Class schedule & slot allocation schema
    │   ├── AttendanceSession.js          # Class session lifecycle & audit record schema
    │   ├── Attendance.js                 # Individual student attendance mark schema
    │   ├── FaceProfile.js                # Biometric 128-d descriptor embedding schema
    │   ├── ODLeaveRequest.js             # On-Duty & Leave approval workflow schema
    │   └── Notification.js               # System notification event schema
    ├── middleware/                       # Request processing pipeline interceptors
    │   ├── auth.middleware.js            # JWT Bearer token verification & user population
    │   ├── role.middleware.js            # Role-Based Access Control (RBAC) guard
    │   ├── rateLimiter.js                # Express-rate-limit brute-force prevention guards
    │   ├── errorHandler.js               # Centralized exception formatter & status mapper
    │   └── validateObjectId.js           # Hexadecimal MongoDB ObjectId route sanitizer
    ├── controllers/                      # Business logic & request processing controllers
    │   ├── auth.controller.js            # User registration, authentication & session revocation
    │   ├── odLeave.controller.js         # Institutional leave application & review handlers
    │   ├── admin/                        # Administrative CRUD controllers
    │   │   ├── dashboard.controller.js   # Campus-wide statistics aggregator
    │   │   ├── student.controller.js     # Student records management & dependency audit
    │   │   ├── teacher.controller.js     # Faculty onboarding & assignment handlers
    │   │   └── report.controller.js      # Institutional compliance report generators
    │   ├── teacher/                      # Faculty operational controllers
    │   │   ├── attendance.controller.js  # Session management, roster generation & manual marking
    │   │   ├── faceRecognition.controller.js # Biometric matching & unknown face audit logger
    │   │   └── analytics.controller.js   # Class attendance analytics & deficit calculator
    │   └── student/                      # Student self-service controllers
    │       ├── dashboard.controller.js   # Personal academic standing & timetable summary
    │       └── attendance.controller.js  # Individual attendance history & shortfall alerts
    ├── routes/                           # Express REST endpoint routing hierarchies
    │   ├── auth.routes.js                # Authentication endpoints (/api/auth)
    │   ├── health.routes.js              # Liveness & readiness probes (/api/health)
    │   ├── odLeave.routes.js             # Excusal requests endpoints (/api/od-leave)
    │   ├── admin/                        # Admin routing tree (/api/admin/*)
    │   ├── teacher/                      # Teacher routing tree (/api/teacher/*)
    │   └── student/                      # Student routing tree (/api/student/*)
    ├── utils/                            # Backend algorithmic & utility modules
    │   ├── generateToken.js              # Cryptographic JWT signing helper
    │   ├── formatUser.js                 # Safe user object projection sanitizer
    │   ├── faceDistance.js               # Euclidean distance & ambiguity margin algorithms
    │   └── attendanceThreshold.js        # Cutoff constants & recovery class calculator
    ├── scripts/                          # Administrative CLI maintenance utilities
    │   └── createAdmin.js                # Initial root administrator provisioning script
    └── seed/                             # Development & demonstration dataset seeder
        └── seed.js                       # Relational demo data populator
```

**Listing A.1: Project Folder Structure of Smart Classroom and Attendance Analytics Portal**

The monorepo structure cleanly delineates responsibilities. The `client` directory houses an optimized React 19 application built via Vite, utilizing Tailwind CSS for styling and Recharts for statistical data visualization. The `server` directory contains a modular Express 5 application divided into models, controllers, routes, utilities, and middleware following the Model-View-Controller (MVC) architectural pattern.

---

## A.2 Backend Package Installation

The backend runs on Node.js (v18+ or v20+ recommended) using ECMAScript Modules (`"type": "module"`). Package dependencies are managed via NPM.

### File: `server/package.json`

```json
{
  "name": "smart-classroom-server",
  "version": "1.0.0",
  "description": "Backend REST API for the Smart Classroom & Attendance Analytics Portal",
  "main": "server.js",
  "type": "module",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "create-admin": "node scripts/createAdmin.js",
    "seed": "node seed/seed.js",
    "test": "node --test \"tests/*.test.js\""
  },
  "dependencies": {
    "bcryptjs": "^3.0.3",
    "cookie-parser": "^1.4.7",
    "cors": "^2.8.6",
    "dotenv": "^17.4.2",
    "express": "^5.2.1",
    "express-rate-limit": "^8.7.1",
    "express-validator": "^7.3.2",
    "helmet": "^8.3.0",
    "jsonwebtoken": "^9.0.3",
    "mongoose": "^9.9.3",
    "morgan": "^1.11.0"
  },
  "devDependencies": {
    "mongodb-memory-server": "^11.2.0",
    "nodemon": "^3.1.14",
    "supertest": "^7.2.2"
  }
}
```

### Installation and Execution Commands

```bash
# 1. Clone repository and navigate to root directory
git clone https://github.com/<USERNAME>/smart-classroom.git
cd smart-classroom

# 2. Install monorepo dependencies across client and server
npm run install:all

# 3. Provision root administrator account in MongoDB
npm run create-admin --prefix server

# 4. Optional: Populate demo courses, teachers, students, and timetable entries
npm run seed --prefix server

# 5. Execute production backend tests (Node test runner)
npm test --prefix server

# 6. Start development servers concurrently (Client on :5173, Server on :5000)
npm run dev

# 7. Production execution
cd server && npm start
```

**Listing A.2: Backend Installation and Execution Commands**

The backend package descriptor specifies essential production packages including `express` (web application framework), `mongoose` (MongoDB object data modeling), `jsonwebtoken` (stateless session security), `bcryptjs` (password hashing), `helmet` (HTTP security headers), and `express-rate-limit` (brute-force mitigation). Development dependencies include `nodemon` for active file monitoring during development and `mongodb-memory-server` alongside `supertest` for isolated integration testing.

---

## A.3 Database Connection

Database connectivity is managed through a singleton connection module using Mongoose. The module establishes a connection to MongoDB with bounded connection timeouts and registers event listeners for connection monitoring and health diagnostics.

### File: `server/config/db.js`

```javascript
import mongoose from 'mongoose'

// Tracks connection state so the /health route can report DB status
// without importing mongoose directly in the controller.
let isConnected = false

export const connectDB = async () => {
  const uri = process.env.MONGO_URI

  if (!uri) {
    console.error('MONGO_URI is not set. Add it to server/.env (see .env.example).')
    return
  }

  try {
    mongoose.connection.on('connected', () => {
      isConnected = true
      console.log(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`)
    })

    mongoose.connection.on('disconnected', () => {
      isConnected = false
      console.warn('MongoDB disconnected')
    })

    mongoose.connection.on('error', (err) => {
      isConnected = false
      console.error('MongoDB connection error:', err.message)
    })

    // Fail fast if MongoDB isn't reachable instead of hanging for the
    // driver's default 30s — the server should still come up so the
    // frontend can show a clear "database not connected" state.
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 })
  } catch (err) {
    isConnected = false
    console.error('Failed to connect to MongoDB:', err.message)
    console.error('The server will keep running so the frontend can still be demoed, but any DB-backed route will fail until MONGO_URI is reachable.')
  }
}

export const getDbStatus = () =>
  mongoose.connection.readyState === 1 || isConnected ? 'connected' : 'disconnected'

export default connectDB
```

**Listing A.3: MongoDB Connection**

The `connectDB` asynchronous function retrieves the database connection string from the environment configuration. It attaches event listeners to `mongoose.connection` to track real-time socket states (`connected`, `disconnected`, and `error`). The connection options configure `serverSelectionTimeoutMS: 10000` (10 seconds), preventing the Node.js event loop from hanging indefinitely during cloud cluster cold-starts or network interruptions. The exported `getDbStatus()` helper supplies connection status telemetry to the `/api/health` monitoring endpoints.

---

## A.4 Environment Variables

The application relies on decoupled environment variables for configuration across local development, testing, and production environments. Sensitive credentials are sanitized below with standard placeholders.

### File: `server/.env.example`

```ini
# MongoDB connection string
# Local:  mongodb://127.0.0.1:27017/smart-classroom
# Atlas:  mongodb+srv://<user>:<password>@<cluster>.mongodb.net/smart-classroom
MONGO_URI=<REDACTED_MONGODB_URI>

# Long, random string used to sign JWTs
JWT_SECRET=<REDACTED_JWT_SECRET>
JWT_EXPIRES_IN=7d

# Server Configuration
PORT=5000
NODE_ENV=development

# Frontend origin allowed by CORS
CLIENT_URL=<YOUR_FRONTEND_URL>
ALLOWED_ORIGINS=<YOUR_FRONTEND_URL>

# Default low-attendance warning threshold (percent)
LOW_ATTENDANCE_THRESHOLD=75

# Maximum face-descriptor distance (face-api.js) still considered a match.
# Production-tuned default: 0.50 (Lower = stricter)
FACE_MATCH_THRESHOLD=0.50

# Minimum Euclidean distance margin required between best and 2nd best candidate
FACE_MARGIN_THRESHOLD=0.08

# Bounded storage limit for unknown face detections per session
MAX_UNKNOWN_FACES=50

# Institutional Attendance Policy ('COUNT_AS_PRESENT' | 'EXCLUDE_FROM_TOTAL' | 'RECORD_ONLY')
OD_ATTENDANCE_POLICY=COUNT_AS_PRESENT
LEAVE_ATTENDANCE_POLICY=RECORD_ONLY
```

### File: `client/.env.example`

```ini
# Base URL of the backend REST API
VITE_API_URL=<YOUR_BACKEND_URL>/api
```

**Listing A.4: Environment Variable Configuration**

This configuration defines the runtime parameters required by both application tiers. `MONGO_URI` supplies the database connection string, `JWT_SECRET` dictates cryptographic signing parameters, `CLIENT_URL` governs Cross-Origin Resource Sharing (CORS) whitelists, and `FACE_MATCH_THRESHOLD` with `FACE_MARGIN_THRESHOLD` tune the sensitivity and ambiguity rejection parameters of the biometric matching engine.

---

## A.5 User Model

Authentication and base identity are unified in the `User` schema. Role-specific attributes for students (e.g., `studentId`, `rollNumber`, `course`, `semester`), teachers (e.g., `employeeId`, `subjects`), and administrators are stored in separate dedicated schemas (`Student`, `Teacher`, `Admin`) containing an ObjectId reference to their corresponding `User` document.

### File: `server/models/User.js`

```javascript
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

const { Schema } = mongoose

/**
 * Base authentication identity shared by every role. Role-specific data
 * (studentId, employeeId, permissions, ...) lives in Student / Teacher /
 * Admin, each of which references back to a User via `user`.
 */
const userSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      // Never returned by default (e.g. GET /students populating `user`).
      // Phase 3's auth controller explicitly .select('+password') at login.
      select: false,
    },
    role: {
      type: String,
      enum: {
        values: ['admin', 'teacher', 'student'],
        message: '{VALUE} is not a valid role',
      },
      required: [true, 'Role is required'],
    },
    phone: {
      type: String,
      trim: true,
      maxlength: [20, 'Phone number looks too long'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
      default: null,
    },
    tokenVersion: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
)

// Fast lookups by role. Email unique index is defined on schema field.
userSchema.index({ role: 1 })

// Defence in depth: password never serializes over the wire.
userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.password
    return ret
  },
})

// Hash the password whenever it's set/changed
userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) {
    return
  }

  const salt = await bcrypt.genSalt(10)
  this.password = await bcrypt.hash(this.password, salt)
})

// Requires the document to have been fetched with .select('+password').
userSchema.methods.comparePassword = function comparePassword(candidatePassword) {
  if (!candidatePassword || !this.password) {
    return Promise.resolve(false)
  }
  return bcrypt.compare(candidatePassword, this.password)
}

const User = mongoose.model('User', userSchema)

export default User
```

**Listing A.5: User Schema**

The schema defines attributes for account identity, role separation, and session management. Security measures include setting `select: false` on the `password` attribute so it is excluded from queries by default, and a `toJSON` transform that strips the password hash during serialization. The `tokenVersion` integer field enables server-side session invalidation on logout or password modification.

---

## A.6 Password Hashing and Registration

User registration normalizes input data, validates uniqueness constraints, forces the student role for self-service accounts, and relies on Mongoose middleware for cryptographic password hashing using `bcryptjs`.

### File: `server/controllers/auth.controller.js` (Registration Excerpt)

```javascript
import asyncHandler from '../utils/asyncHandler.js'
import generateToken from '../utils/generateToken.js'
import sanitizeUser from '../utils/formatUser.js'
import User from '../models/User.js'

// POST /api/auth/register
export const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body
  const cleanEmail = email ? String(email).trim().toLowerCase() : ''

  const existing = await User.findOne({ email: cleanEmail })
  if (existing) {
    res.status(409)
    throw new Error('An account with this email already exists')
  }

  // Public self-registration always creates a `student` account. Any
  // `role` field the client sends is ignored on purpose — see
  // docs/AUTHENTICATION.md for the reasoning. Teacher and admin accounts
  // are provisioned by the seed script or an authenticated admin-only endpoint.
  const user = await User.create({
    name: name ? String(name).trim() : '',
    email: cleanEmail,
    password, // Handled by userSchema.pre('save') with bcrypt salt factor 10
    role: 'student',
  })

  const token = generateToken(user)
  res.status(201).json({
    success: true,
    message: 'Registration successful',
    data: { token, user: sanitizeUser(user) },
  })
})
```

**Listing A.6: Registration Controller with Password Hashing**

The `register` controller processes registration requests by sanitizing the incoming email and checking for account duplication. Privileged roles (`teacher` and `admin`) cannot be self-assigned; the controller forces `role: 'student'`. The plaintext password is passed to `User.create()`, which triggers the schema's `pre('save')` hook (`userSchema.pre('save')` in `server/models/User.js`), generating a 10-round salt and producing an irreversible bcrypt hash before database insertion.

---

## A.7 Login and JWT Generation

The login flow verifies user credentials, prevents account enumeration through uniform error messages, confirms account activation status, updates the last login timestamp, and delegates JWT creation to a dedicated utility.

### File: `server/controllers/auth.controller.js` (Login Excerpt)

```javascript
import asyncHandler from '../utils/asyncHandler.js'
import generateToken from '../utils/generateToken.js'
import sanitizeUser from '../utils/formatUser.js'
import User from '../models/User.js'

// POST /api/auth/login
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body
  const cleanEmail = email ? String(email).trim().toLowerCase() : ''

  // password has `select: false` on the schema, so it must be explicitly
  // requested here — this is the one place in the app that needs it.
  const user = await User.findOne({ email: cleanEmail }).select('+password')

  // Same generic message whether the email doesn't exist or the password
  // is wrong, so a caller can't use this endpoint to enumerate accounts.
  if (!user || !(await user.comparePassword(password))) {
    res.status(401)
    throw new Error('Invalid email or password')
  }

  if (!user.isActive) {
    res.status(401)
    throw new Error('This account has been deactivated. Contact an administrator.')
  }

  user.lastLogin = new Date()
  await user.save()

  const token = generateToken(user)
  res.status(200).json({
    success: true,
    message: 'Login successful',
    data: { token, user: sanitizeUser(user) },
  })
})
```

### Supporting Helper: `server/utils/generateToken.js`

```javascript
import jwt from 'jsonwebtoken'

// JWT payload is intentionally minimal — just enough to identify who's
// calling and enforce role checks. Never put password hashes, face
// descriptors, or other sensitive data in a token.
export const generateToken = (user) =>
  jwt.sign(
    {
      userId: user._id.toString(),
      role: user.role,
      tokenVersion: typeof user.tokenVersion === 'number' ? user.tokenVersion : 0,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    },
  )

export default generateToken
```

**Listing A.7: Login Controller and JWT Generation**

The login controller invokes `select('+password')` to fetch the hashed credential. Password verification is performed through `user.comparePassword(password)`. Uniform error reporting (`401 Invalid email or password`) mitigates timing and account enumeration attacks. The `generateToken` helper constructs a signed JSON Web Token encoding `userId`, `role`, and `tokenVersion` with a 7-day expiration period.

---

## A.8 Authentication Middleware

Protected API endpoints are guarded by two chained middleware functions: `protect`, which verifies the JWT Bearer header and session validity, and `authorizeRoles`, which enforces Role-Based Access Control (RBAC).

### File: `server/middleware/auth.middleware.js`

```javascript
import jwt from 'jsonwebtoken'
import asyncHandler from '../utils/asyncHandler.js'
import User from '../models/User.js'

/**
 * Verifies the `Authorization: Bearer <token>` header, loads the user it
 * belongs to, and attaches it to req.user for downstream handlers/role
 * middleware.
 */
export const protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization
  const token = header && header.startsWith('Bearer ') ? header.split(' ')[1] : null

  if (!token) {
    res.status(401)
    throw new Error('Not authorized, no token provided')
  }

  const decoded = jwt.verify(token, process.env.JWT_SECRET)

  const user = await User.findById(decoded.userId)
  if (!user) {
    res.status(401)
    throw new Error('Not authorized, user no longer exists')
  }
  if (!user.isActive) {
    res.status(401)
    throw new Error('Not authorized, this account has been deactivated')
  }

  // Session revocation validation
  if (
    decoded.tokenVersion !== undefined &&
    user.tokenVersion !== undefined &&
    decoded.tokenVersion !== user.tokenVersion
  ) {
    res.status(401)
    throw new Error('Session has expired or has been revoked. Please log in again.')
  }

  req.user = user
  next()
})

export default protect
```

### File: `server/middleware/role.middleware.js`

```javascript
/**
 * Role-based authorization. Must run after `protect` (needs req.user).
 *
 * Usage:
 *   router.get('/admin/students', protect, authorizeRoles('admin'), listStudents)
 *   router.get('/reports', protect, authorizeRoles('admin', 'teacher'), listReports)
 */
export const authorizeRoles =
  (...allowedRoles) =>
  (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      res.status(403)
      throw new Error('Forbidden: you do not have permission to access this resource')
    }
    next()
  }

export default authorizeRoles
```

**Listing A.8: JWT Authentication and Authorization Middleware**

The `protect` middleware parses the HTTP `Authorization` request header, extracts the bearer token, and verifies its digital signature using `process.env.JWT_SECRET`. It compares `decoded.tokenVersion` against `user.tokenVersion` to invalidate active tokens immediately upon logout. The `authorizeRoles` higher-order function checks the authenticated user's role against permissible roles, terminating unauthorized requests with an HTTP 403 Forbidden status.

---

## A.9 Create API

The attendance session creation endpoint represents a complete creation operation incorporating role verification, input validation, scheduling conflict detection, and academic roster assembly.

### File: `server/controllers/teacher/attendance.controller.js` (Creation Excerpt)

```javascript
// POST /api/teacher/attendance/sessions
// Body: { subject, classroom, date, period, startTime, endTime, department, section }
export const createSession = asyncHandler(async (req, res) => {
  const { subject, classroom, date, period, startTime, endTime, department, section } = req.body
  const teacherId = req.teacher._id

  if (startTime && endTime && endTime <= startTime) {
    res.status(400)
    throw new Error('endTime must be later than startTime')
  }

  const parsedDate = new Date(date)
  if (isNaN(parsedDate.getTime())) {
    res.status(400)
    throw new Error('Invalid date provided for attendance session')
  }

  // Ownership verification: subject must be assigned to THIS teacher
  const subjectDoc = await Subject.findOne({ _id: subject, teachers: teacherId, isActive: true })
  if (!subjectDoc) {
    res.status(403)
    throw new Error('You are not assigned to this subject')
  }

  // Facility conflict check: room cannot be double-booked for the same period
  if (classroom) {
    const classroomConflict = await AttendanceSession.findOne({
      classroom,
      date: parsedDate,
      period,
      status: { $in: ['Scheduled', 'Active'] },
      teacher: { $ne: teacherId },
    })
    if (classroomConflict) {
      res.status(409)
      throw new Error('Selected classroom is already occupied by another session for this period')
    }
  }

  const cleanSection = section?.trim().toUpperCase() || 'A'
  const cleanDepartment = department?.trim() || subjectDoc.department

  // Duplicate session check for teacher, subject, date, and period
  const startOfDay = new Date(parsedDate)
  startOfDay.setUTCHours(0, 0, 0, 0)
  const endOfDay = new Date(parsedDate)
  endOfDay.setUTCHours(23, 59, 59, 999)

  const duplicate = await AttendanceSession.findOne({
    teacher: teacherId,
    subject,
    date: { $gte: startOfDay, $lte: endOfDay },
    period: Number(period),
    status: { $in: ['Scheduled', 'Active', 'Completed'] },
  })
  if (duplicate) {
    res.status(409)
    throw new Error('Attendance has already been created for this time slot.')
  }

  const session = await AttendanceSession.create({
    teacher: teacherId,
    subject,
    classroom: classroom || null,
    department: cleanDepartment,
    section: cleanSection,
    date: parsedDate,
    period: Number(period) || 1,
    startTime: startTime || undefined,
    endTime: endTime || undefined,
    status: 'Active',
  })

  const populated = await session.populate(SESSION_POPULATE)
  const roster = await getRoster(subjectDoc.course, { department: session.department, section: session.section })

  res.status(201).json({
    success: true,
    message: 'Attendance session started successfully',
    data: { session: populated, roster },
  })
})
```

- **Route:** `POST /api/teacher/attendance/sessions`
- **Access Control:** `protect`, `authorizeRoles('teacher')`, `loadTeacherProfile`

**Listing A.9: Create API Implementation**

This endpoint handles session creation for faculty. It validates timestamps and checks subject assignment permissions to prevent unauthorized access. It checks for room collisions (`status: { $in: ['Scheduled', 'Active'] }`) and duplicate sessions before persisting an `AttendanceSession` document with an `Active` status. It then populates relational references and returns the target student roster.

---

## A.10 Read API

The session query endpoint demonstrates read operations, featuring teacher scoping, multi-criteria filtering, pagination, relational population, and real-time attendance aggregation.

### File: `server/controllers/teacher/attendance.controller.js` (Read Excerpt)

```javascript
// GET /api/teacher/attendance/sessions — history scoped to req.teacher._id
export const listSessions = asyncHandler(async (req, res) => {
  const pagination = parsePagination(req.query)
  const filter = { teacher: req.teacher._id }

  if (req.query.subject) filter.subject = req.query.subject
  if (req.query.status) filter.status = req.query.status
  if (req.query.from || req.query.to) {
    filter.date = {}
    if (req.query.from) filter.date.$gte = new Date(req.query.from)
    if (req.query.to) filter.date.$lte = new Date(req.query.to)
  }

  const [sessions, total] = await Promise.all([
    AttendanceSession.find(filter)
      .populate(SESSION_POPULATE)
      .sort({ date: -1, createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit),
    AttendanceSession.countDocuments(filter),
  ])

  const sessionIds = sessions.map((s) => s._id)

  // Aggregate records by session in a single database roundtrip
  const attendanceAgg = await Attendance.aggregate([
    { $match: { session: { $in: sessionIds } } },
    {
      $group: {
        _id: '$session',
        count: { $sum: 1 },
        presentCount: { $sum: { $cond: [{ $eq: ['$status', 'Present'] }, 1, 0] } },
        lateCount: { $sum: { $cond: [{ $eq: ['$status', 'Late'] }, 1, 0] } },
        absentCount: { $sum: { $cond: [{ $eq: ['$status', 'Absent'] }, 1, 0] } },
        presentOrLate: { $sum: { $cond: [{ $in: ['$status', ['Present', 'Late']] }, 1, 0] } },
      },
    },
  ])

  const attendanceMap = new Map()
  for (const row of attendanceAgg) {
    attendanceMap.set(row._id.toString(), row)
  }

  const items = sessions.map((session) => {
    const attData = attendanceMap.get(session._id.toString()) || {
      count: 0,
      presentCount: 0,
      lateCount: 0,
      absentCount: 0,
      presentOrLate: 0,
    }
    return {
      _id: session._id,
      session,
      presentCount: attData.presentCount,
      totalMarked: attData.count,
    }
  })

  res.json({
    success: true,
    data: { items, pagination: buildPaginationMeta(pagination, total) },
  })
})
```

- **Route:** `GET /api/teacher/attendance/sessions`
- **Access Control:** `protect`, `authorizeRoles('teacher')`, `loadTeacherProfile`

**Listing A.10: Read API Implementation**

The controller queries attendance history scoped to the authenticated instructor (`req.teacher._id`), applying optional filters for date ranges and subject identifiers. To avoid N+1 query overhead, it executes a MongoDB aggregation pipeline using `$match`, `$group`, and `$cond` operators to batch compute counts for present, late, and absent marks across the current page.

---

## A.11 Update API

Student record modification demonstrates transactional updates across related schemas, ensuring email and student ID uniqueness across documents without altering encrypted credentials.

### File: `server/controllers/admin/student.controller.js` (Update Excerpt)

```javascript
// PUT /api/admin/students/:id
export const updateStudent = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.params.id).populate('user')
  if (!student) {
    res.status(404)
    throw new Error('Student not found')
  }

  const { name, email, studentId, department, year, section, gender, phone, course } = req.body

  const cleanEmail = email ? String(email).trim().toLowerCase() : ''
  if (cleanEmail && cleanEmail !== student.user.email) {
    const emailTaken = await User.findOne({ email: cleanEmail, _id: { $ne: student.user._id } })
    if (emailTaken) {
      res.status(409)
      throw new Error('An account with this email already exists')
    }
    student.user.email = cleanEmail
  }

  if (name) student.user.name = name
  if (phone !== undefined) student.user.phone = phone

  if (studentId && studentId.toUpperCase() !== student.studentId) {
    const idTaken = await Student.findOne({ studentId: studentId.toUpperCase(), _id: { $ne: student._id } })
    if (idTaken) {
      res.status(409)
      throw new Error('A student with this Student ID already exists')
    }
    student.studentId = studentId.toUpperCase()
  }

  if (course) student.course = course
  if (department) student.department = String(department).trim()
  if (section) student.section = String(section).trim().toUpperCase()
  if (gender !== undefined) student.gender = gender

  // Password is intentionally never touched here — editing a profile
  // must never blank out or change the account's password.
  await student.user.save()
  await student.save()

  const populated = await student.populate([
    { path: 'user', select: '-password' },
    { path: 'course', select: 'name code department' },
  ])

  res.json({
    success: true,
    message: 'Student updated successfully',
    data: { student: populated },
  })
})
```

- **Route:** `PUT /api/admin/students/:id`
- **Access Control:** `protect`, `authorizeRoles('admin')`

**Listing A.11: Update API Implementation**

The `updateStudent` controller handles synchronized updates across the `Student` profile and its parent `User` record. It performs conflict checks to ensure that modified email addresses or student identifiers do not collide with other accounts (`_id: { $ne: ... }`). The account password field is excluded from this operation, preventing accidental resets or hashing errors during administrative profile edits.

---

## A.12 Delete API

The deletion implementation uses a coordinated multi-collection cleanup strategy with data integrity checks that prevent the removal of records tied to historical attendance data.

### File: `server/controllers/admin/student.controller.js` (Deletion Excerpt)

```javascript
// DELETE /api/admin/students/:id
// Permanent deletion: deletes FaceProfile, Student, and linked User if safe.
// Dependent record check: prevents orphaning historical attendance records.
export const deleteStudent = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.params.id)
  if (!student) {
    res.status(404)
    throw new Error('Student not found')
  }

  const userId = student.user
  const studentId = student._id

  // 1. Dependency check: do not orphan historical attendance records
  const attendanceCount = await Attendance.countDocuments({ student: studentId })
  if (attendanceCount > 0) {
    res.status(409)
    throw new Error(
      `Cannot delete student with existing attendance records (${attendanceCount} found). Please deactivate the student instead to preserve historical records.`
    )
  }

  // 2. Coordinated deletion: FaceProfile, Student, User
  try {
    await FaceProfile.deleteOne({ student: studentId })
    await Student.findByIdAndDelete(studentId)
    if (userId) {
      await User.findByIdAndDelete(userId)
    }
  } catch (err) {
    res.status(500)
    throw new Error('Failed to complete student deletion: ' + err.message)
  }

  res.json({
    success: true,
    message: 'Student permanently deleted',
  })
})
```

- **Route:** `DELETE /api/admin/students/:id`
- **Access Control:** `protect`, `authorizeRoles('admin')`

**Listing A.12: Delete API Implementation**

This handler verifies that no attendance records reference the target student before proceeding (`Attendance.countDocuments()`). If records exist, the operation halts with an HTTP 409 Conflict status to maintain historical attendance integrity. For students without attendance history, it performs a coordinated cascade deletion removing the `FaceProfile` biometric descriptor, the `Student` record, and the underlying `User` account.

---

## A.13 Express Routes

Routes map HTTP methods and endpoints to their respective validation chains, security middlewares, and controller handlers.

### File: `server/routes/teacher/attendance.routes.js`

```javascript
import { Router } from 'express'
import { validateObjectId } from '../../middleware/validateObjectId.js'
import {
  createSession,
  getSession,
  markAttendance,
  completeSession,
  listSessions,
  getClassAttendance,
} from '../../controllers/teacher/attendance.controller.js'
import { recognizeFace } from '../../controllers/teacher/faceRecognition.controller.js'
import { createSessionValidator, markAttendanceValidator } from '../../validators/teacher/attendance.validator.js'
import { recognizeFaceValidator } from '../../validators/teacher/faceRecognition.validator.js'

const router = Router()

router.get('/sessions', listSessions)
router.post('/sessions', createSessionValidator, createSession)
router.get('/sessions/:id', validateObjectId(), getSession)
router.post('/sessions/:id/mark', validateObjectId(), markAttendanceValidator, markAttendance)
router.post('/sessions/:id/complete', validateObjectId(), completeSession)
router.post('/sessions/:id/recognize', validateObjectId(), recognizeFaceValidator, recognizeFace)
router.get('/class/:subjectId', validateObjectId('subjectId'), getClassAttendance)

export default router
```

### File: `server/routes/auth.routes.js`

```javascript
import { Router } from 'express'
import { register, login, getMe, logout } from '../controllers/auth.controller.js'
import { registerValidator, loginValidator } from '../validators/auth.validator.js'
import { protect } from '../middleware/auth.middleware.js'
import { loginLimiter, registerLimiter } from '../middleware/rateLimiter.js'

const router = Router()

router.post('/register', registerLimiter, registerValidator, register)
router.post('/login', loginLimiter, loginValidator, login)
router.get('/me', protect, getMe)
router.post('/logout', protect, logout)

export default router
```

**Listing A.13: Express Route Definitions**

These route definitions establish HTTP mappings, input validation rules, and middleware chains. In `attendance.routes.js`, parameters are sanitized using `validateObjectId()`, request bodies are checked with `express-validator` rules, and requests are routed to operational handlers including `recognizeFace` and `completeSession`. In `auth.routes.js`, the `/login` and `/register` endpoints are protected by rate limiters to mitigate brute-force attacks.

---

## A.14 Main Server File

The backend is initialized in two modular files: `app.js` builds the Express application, security middleware, and routing tree; while `server.js` starts the HTTP listener, initiates the database connection, and manages graceful shutdowns.

### File: `server/app.js`

```javascript
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import cookieParser from 'cookie-parser'

import healthRoutes from './routes/health.routes.js'
import authRoutes from './routes/auth.routes.js'
import adminRoutes from './routes/admin/index.js'
import teacherRoutes from './routes/teacher/index.js'
import studentRoutes from './routes/student/index.js'
import odLeaveRoutes from './routes/odLeave.routes.js'
import { notFound, errorHandler } from './middleware/errorHandler.js'

const app = express()

// Trust first proxy hop (e.g. Render, reverse proxy) for rate limiting & IP extraction
app.set('trust proxy', 1)

// --- Core security & middleware ---
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
)

const configuredOrigins = [
  ...(process.env.ALLOWED_ORIGINS || '').split(','),
  ...(process.env.CLIENT_URL || '').split(','),
]
  .map((s) => s.trim().replace(/\/+$/, ''))
  .filter(Boolean)

const defaultDevOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173']
const allowedOrigins = Array.from(new Set([...defaultDevOrigins, ...configuredOrigins]))

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true)
      if (allowedOrigins.includes(origin)) return callback(null, true)
      if (
        process.env.NODE_ENV !== 'production' &&
        /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
      ) {
        return callback(null, true)
      }
      return callback(new Error('Not allowed by CORS'))
    },
    credentials: true,
  }),
)
app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'))
}

// --- Routes ---
app.use('/api/health', healthRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/teacher', teacherRoutes)
app.use('/api/student', studentRoutes)
app.use('/api/od-leave', odLeaveRoutes)

// --- Error handling (must be last) ---
app.use(notFound)
app.use(errorHandler)

export default app
```

### File: `server/server.js`

```javascript
import dotenv from 'dotenv'
dotenv.config()

import mongoose from 'mongoose'
import app from './app.js'
import { connectDB, getDbStatus } from './config/db.js'

const PORT = process.env.PORT || 5000

let server

const startServer = async () => {
  try {
    await connectDB()
  } catch (err) {
    console.error('Database connection failed on startup:', err.message)
    if (process.env.NODE_ENV === 'production') {
      process.exit(1)
    }
  }

  server = app.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`)
    console.log(`Database status: ${getDbStatus()}`)
  })

  const gracefulShutdown = async (signal) => {
    console.log(`\nReceived ${signal}. Shutting down gracefully...`)
    if (server) {
      server.close(async () => {
        if (mongoose.connection.readyState !== 0) {
          await mongoose.connection.close(false)
        }
        process.exit(0)
      })
    }
  }

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
  process.on('SIGINT', () => gracefulShutdown('SIGINT'))
}

startServer()
```

**Listing A.14: Express Server Configuration**

The server setup configures security headers using `helmet`, enables proxy header resolution with `app.set('trust proxy', 1)`, and sets up dynamic CORS handling to support cross-domain frontend communication. Body parsers are set to a 2MB limit to accommodate base64-encoded face embeddings. The application mounts API routes under the `/api` prefix, finishes with centralized error handling middleware, and registers process signal handlers (`SIGINT`, `SIGTERM`) for graceful server and database teardowns.

---

## A.15 React Login Component

The authentication view manages login form state, delegates credential verification to the authentication context, handles role-based routing, and displays granular API error responses.

### File: `client/src/pages/Login.jsx`

```jsx
import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { FiEye, FiEyeOff, FiArrowLeft, FiLoader } from 'react-icons/fi'
import { useAuth } from '../context/AuthContext'
import FormField, { inputClass } from '../components/FormField'

const ROLE_HOME = {
  admin: '/admin/dashboard',
  teacher: '/teacher/dashboard',
  student: '/student/dashboard',
}

export default function Login() {
  const { user, isAuthenticated, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [form, setForm] = useState({ email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && user?.role) {
      navigate(ROLE_HOME[user.role] || '/', { replace: true })
    }
  }, [isAuthenticated, user, navigate])

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const loggedUser = await login(form)
      const redirectTo = location.state?.from?.pathname || ROLE_HOME[loggedUser.role] || '/'
      navigate(redirectTo, { replace: true })
    } catch (err) {
      if (!err.response) {
        setError('Unable to connect to the server. Please check your network connection.')
      } else if (err.response.status === 401) {
        setError(err.response.data?.message || 'Invalid email or password.')
      } else if (err.response.status === 403) {
        setError(err.response.data?.message || 'Your account is inactive.')
      } else {
        setError(err.response.data?.message || 'Could not sign in. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-[#F7FAF7] text-ink">
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <h1 className="text-2xl font-bold tracking-tight text-ink mb-2">Welcome back</h1>
          <p className="text-sm text-slate-500 mb-6">Enter your credentials to access your portal</p>

          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField label="Institutional Email" htmlFor="email" required>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={form.email}
                onChange={handleChange}
                placeholder="name@institution.edu"
                className={inputClass}
              />
            </FormField>

            <FormField label="Password" htmlFor="password" required>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={form.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className={`${inputClass} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                </button>
              </div>
            </FormField>

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex justify-center items-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 transition disabled:opacity-50"
            >
              {submitting ? <FiLoader className="animate-spin" size={16} /> : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
```

**Listing A.15: React Login Component**

The login interface coordinates user input, triggers authentication requests through the `useAuth()` hook, and routes users based on their role (`/admin/dashboard`, `/teacher/dashboard`, `/student/dashboard`). It provides user feedback during submission with inline spinner icons and handles API response errors, displaying specific messaging for network failures, unauthorized access (401), and account deactivation (403).

---

## A.16 Admin Dashboard Logic

The administrator dashboard uses React hooks and service abstractions to retrieve statistical metrics, attendance trends, departmental distributions, and low-attendance warnings.

### File: `client/src/pages/admin/AdminDashboard.jsx` (Data Fetching Excerpt)

```jsx
import { useEffect, useState } from 'react'
import { FiUsers, FiUserCheck, FiBook, FiCalendar, FiCheckSquare } from 'react-icons/fi'
import { useToast } from '../../context/ToastContext'
import { getDashboardStats } from '../../services/adminService'
import StatCard from '../../components/common/StatCard'

export default function AdminDashboard() {
  const toast = useToast()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchStats = () => {
    setLoading(true)
    setError(null)
    getDashboardStats()
      .then((data) => {
        setStats(data)
      })
      .catch((err) => {
        const msg = err.response?.data?.message || 'Could not load dashboard statistics.'
        setError(msg)
        toast.error(msg)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchStats()
  }, [])

  return (
    <div className="space-y-6">
      {/* KPI Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title="Total Students"
          value={stats?.students?.total ?? 0}
          description={`${stats?.students?.active ?? 0} active students`}
          icon={FiUsers}
          loading={loading}
        />
        <StatCard
          title="Total Teachers"
          value={stats?.teachers?.total ?? 0}
          description={`${stats?.teachers?.active ?? 0} active teachers`}
          icon={FiUserCheck}
          loading={loading}
        />
        <StatCard
          title="Active Courses"
          value={stats?.courses?.total ?? 0}
          description={`${stats?.courses?.active ?? 0} running`}
          icon={FiBook}
          loading={loading}
        />
        <StatCard
          title="Subjects"
          value={stats?.subjects?.total ?? 0}
          description={`${stats?.subjects?.active ?? 0} assigned`}
          icon={FiCalendar}
          loading={loading}
        />
        <StatCard
          title="Today's Attendance"
          value={stats?.todayAttendance?.percentage ? `${stats.todayAttendance.percentage}%` : 'N/A'}
          description={`${stats?.todayAttendance?.present ?? 0} present today`}
          icon={FiCheckSquare}
          loading={loading}
        />
      </div>
    </div>
  )
}
```

### Supporting Service: `client/src/services/adminService.js`

```javascript
import api from './api'

export async function getDashboardStats() {
  const res = await api.get('/admin/dashboard/stats')
  return res.data.data
}
```

**Listing A.16: Admin Dashboard Data Fetching**

The component uses a `useEffect` lifecycle hook to call `getDashboardStats()` from `adminService.js`. When the promise resolves, it stores statistical aggregations in local component state. It then renders a five-column KPI card grid visualizing total student rosters, active faculty counts, running degree courses, active subject allocations, and daily campus attendance percentages.

---

## A.17 REST API Request and Response Examples

These examples illustrate typical client-server interactions during user authentication and biometric attendance recording.

### Listing A.17(a): REST API Request Example

#### 1. User Authentication Request

```http
POST /api/auth/login HTTP/1.1
Host: api.smartclassroom.institution.edu
Content-Type: application/json
Accept: application/json

{
  "email": "faculty.smith@institution.edu",
  "password": "<REDACTED_PASSWORD>"
}
```

#### 2. Biometric Attendance Verification Request

```http
POST /api/teacher/attendance/sessions/65f2c418e987b12d34a56c78/recognize HTTP/1.1
Host: api.smartclassroom.institution.edu
Authorization: Bearer <REDACTED_JWT_TOKEN>
Content-Type: application/json
Accept: application/json

{
  "descriptor": [
    -0.084125, 0.124581, -0.012459, 0.045129, -0.098741,
    0.032145, -0.054123, 0.087452, -0.021456, 0.065412,
    /* ... 128 finite IEEE-754 floating-point coordinates ... */
  ],
  "commit": true
}
```

### Listing A.17(b): REST API Response Example

#### 1. Successful Authentication Response (`200 OK`)

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "<REDACTED_JWT_TOKEN>",
    "user": {
      "_id": "65f1a2b3c4d5e6f7a8b9c0d1",
      "name": "Prof. Alan Smith",
      "email": "faculty.smith@institution.edu",
      "role": "teacher",
      "phone": "+1-555-019-2834",
      "isActive": true,
      "lastLogin": "2026-10-15T18:30:00.000Z"
    }
  }
}
```

#### 2. Confirmed Face Match & Attendance Recorded Response (`200 OK`)

```json
{
  "success": true,
  "message": "Recognized John Doe (STU-001) with 89% confidence",
  "data": {
    "matched": true,
    "alreadyMarked": false,
    "student": {
      "_id": "65f1a3a4c4d5e6f7a8b9c0d2",
      "studentId": "STU-001",
      "rollNumber": "21CS042",
      "name": "John Doe",
      "department": "CSE",
      "section": "A"
    },
    "attendance": {
      "_id": "65f2c8a9e987b12d34a56e99",
      "session": "65f2c418e987b12d34a56c78",
      "student": "65f1a3a4c4d5e6f7a8b9c0d2",
      "status": "Present",
      "method": "face",
      "confidence": 0.89,
      "timestamp": "2026-10-15T09:15:22.418Z"
    },
    "metrics": {
      "distance": 0.3821,
      "margin": 0.1452,
      "confidence": 0.89
    }
  }
}
```

**Listing A.17: REST API Request and Response Examples**

These HTTP traces show actual API request formats alongside their corresponding server responses. Authentication produces a stateless JWT and returns a sanitized user identity object. The biometric recognition endpoint accepts a 128-dimensional descriptor array, checks it against enrolled student profiles, and returns the matched student's details, distance metrics, and the newly created `Attendance` record.

---

## A.18 Face-Recognition Matching

The face-recognition pipeline spans client-side pre-trained neural network inferencing (using `face-api.js`) and server-side biometric vector matching.

### File: `client/src/utils/faceApiModels.js` (Model Loading)

```javascript
import * as faceapi from 'face-api.js'

// Model weight files are served statically from client/public/models/*
const MODEL_URL = '/models'
let loadPromise = null

export function loadFaceApiModels() {
  if (!loadPromise) {
    loadPromise = Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]).catch((err) => {
      loadPromise = null
      throw err
    })
  }
  return loadPromise
}

export function getDetectorOptions(options = {}) {
  const inputSize = options.inputSize || 320
  const scoreThreshold = typeof options.scoreThreshold === 'number' ? options.scoreThreshold : 0.60
  return new faceapi.TinyFaceDetectorOptions({ inputSize, scoreThreshold })
}
```

### File: `client/src/components/vision/FaceCamera.jsx` (Client Extraction Excerpt)

```javascript
// Real-time inferencing loop
const detections = await faceapi
  .detectAllFaces(video, getDetectorOptions())
  .withFaceLandmarks()
  .withFaceDescriptors()

if (detections.length === 1) {
  const single = detections[0]
  // Extract 128-element embedding and emit to attendance controller
  onFaceDetected?.(Array.from(single.descriptor), {
    box: single.detection.box,
    score: single.detection.score,
  })
}
```

### File: `server/utils/faceDistance.js` (Vector Math & Matching Engine)

```javascript
export const FACE_MATCH_THRESHOLD = Number(process.env.FACE_MATCH_THRESHOLD) || 0.50
export const FACE_MARGIN_THRESHOLD = Number(process.env.FACE_MARGIN_THRESHOLD) || 0.08
export const DESCRIPTOR_LENGTH = 128

export function isValidDescriptor(value) {
  return (
    Array.isArray(value) &&
    value.length === DESCRIPTOR_LENGTH &&
    value.every((n) => typeof n === 'number' && Number.isFinite(n))
  )
}

export function euclideanDistance(a, b) {
  if (!isValidDescriptor(a) || !isValidDescriptor(b)) return Infinity
  let sum = 0
  for (let i = 0; i < DESCRIPTOR_LENGTH; i += 1) {
    const diff = a[i] - b[i]
    sum += diff * diff
  }
  return Math.sqrt(sum)
}

export function evaluateProfileDistance(descriptor, profile) {
  const validSamples = profile.descriptors.filter(isValidDescriptor)
  if (validSamples.length === 0) return { effectiveDistance: Infinity }

  const distances = validSamples.map((sample) => euclideanDistance(descriptor, sample))
  const minDistance = Math.min(...distances)
  const meanDistance = distances.reduce((a, b) => a + b, 0) / distances.length

  // Conservative multi-sample aggregation: resists false positives from single outliers
  const effectiveDistance = distances.length === 1 ? minDistance : Math.max(minDistance, (minDistance + meanDistance) / 2)
  return { effectiveDistance, bestSampleDistance: minDistance }
}

export function evaluateFaceMatch(descriptor, profiles, options = {}) {
  const threshold = options.threshold || FACE_MATCH_THRESHOLD
  const marginThreshold = options.marginThreshold || FACE_MARGIN_THRESHOLD

  const evaluated = []
  for (const profile of profiles || []) {
    const stats = evaluateProfileDistance(descriptor, profile)
    if (Number.isFinite(stats.effectiveDistance)) {
      evaluated.push({ profile, distance: stats.effectiveDistance })
    }
  }

  if (evaluated.length === 0) return { isMatch: false, reason: 'NO_VALID_CANDIDATES' }

  evaluated.sort((a, b) => a.distance - b.distance)
  const best = evaluated[0]
  const second = evaluated.length > 1 ? evaluated[1] : null
  const margin = second ? Number((second.distance - best.distance).toFixed(4)) : null

  // Rule 1: Distance must be strictly beneath threshold
  if (best.distance > threshold) {
    return { isMatch: false, reason: 'DISTANCE_TOO_HIGH' }
  }

  // Rule 2: Ambiguity margin requirement when 2+ candidates exist
  if (second && margin < marginThreshold) {
    return { isMatch: false, reason: 'AMBIGUOUS_MARGIN' }
  }

  return { isMatch: true, bestCandidate: best, distance: best.distance, margin }
}
```

### File: `server/controllers/teacher/faceRecognition.controller.js` (Audit Logging Excerpt)

```javascript
// Unknown Face Audit Logging (Prevents unverified faces from marking attendance)
if (!evalResult.isMatch) {
  if (shouldCommit) {
    session.unknownFaces.push({
      count: 1,
      confidence: 0,
      detectedAt: new Date(),
    })
    if (session.unknownFaces.length > MAX_UNKNOWN_FACES) {
      session.unknownFaces = session.unknownFaces.slice(-MAX_UNKNOWN_FACES)
    }
    await session.save()
  }
  return res.status(200).json({
    success: true,
    data: { matched: false, reason: evalResult.reason },
  })
}
```

**Listing A.18: Face-Recognition Matching Logic**

The vision pipeline runs client-side face detection using pre-trained weights (`TinyFaceDetector`, `FaceLandmark68Net`, and `FaceRecognitionNet`), extracting 128-element facial descriptor vectors from real-time webcam streams. The backend verifies the descriptor and computes Euclidean distances against registered students. Matches require a distance under `FACE_MATCH_THRESHOLD` (0.50) and an ambiguity gap over `FACE_MARGIN_THRESHOLD` (0.08) compared to the second-best candidate. Unrecognized faces are logged to an audit list (`session.unknownFaces`) and cannot mark attendance.

---

## A.19 Attendance Percentage Calculation

Institutional policy dictates that a student's attendance percentage is calculated using eligible session counts, counting both Present and Late marks toward attendance, handling On-Duty (OD) according to configured institutional policy, and calculating consecutive class recovery targets.

### File: `server/utils/attendanceThreshold.js`

```javascript
// Configurable institutional threshold and policy cutoffs
export const LOW_ATTENDANCE_THRESHOLD = Number(process.env.LOW_ATTENDANCE_THRESHOLD) || 75
export const OD_ATTENDANCE_POLICY = process.env.OD_ATTENDANCE_POLICY || 'COUNT_AS_PRESENT'
export const LEAVE_ATTENDANCE_POLICY = process.env.LEAVE_ATTENDANCE_POLICY || 'RECORD_ONLY'

/**
 * Formulates the student's attendance percentage.
 * Formula: P = round((Attended Sessions / Total Conducted Sessions) * 100)
 */
export function calculateAttendancePercentage(attended, totalSessions) {
  if (!totalSessions || totalSessions <= 0) return null
  return Math.round((attended / totalSessions) * 100)
}

/**
 * Flags attendance falling below the institutional warning cutoff (75%).
 * Null or undefined percentage indicates no conducted classes and is not flagged.
 */
export function isLowAttendance(percentage) {
  if (percentage === null || percentage === undefined) return false
  return percentage < LOW_ATTENDANCE_THRESHOLD
}

/**
 * Calculates the minimum consecutive classes a student must attend to reach
 * the required attendance target (e.g. 75%).
 *
 * Exact Formula: x = ceil((P * T - 100 * A) / (100 - P))
 * Where:
 *   P = Target percentage (e.g., 75)
 *   T = Total eligible sessions conducted
 *   A = Eligible attended sessions (Present + Late + Approved OD)
 *
 * @param {number} attended - Number of classes attended
 * @param {number} totalSessions - Total classes conducted
 * @param {number} targetPercentage - Target cutoff percentage (default: 75)
 * @returns {number|null} Minimum consecutive classes required
 */
export function calculateConsecutiveClassesNeeded(
  attended,
  totalSessions,
  targetPercentage = LOW_ATTENDANCE_THRESHOLD,
) {
  if (totalSessions == null || totalSessions <= 0) return null
  const target = Number(targetPercentage) || 75
  if (target <= 0) return 0
  if (target >= 100) return attended >= totalSessions ? 0 : Infinity

  const safeAttended = Math.max(0, Number(attended) || 0)
  const safeTotal = Math.max(0, Number(totalSessions) || 0)

  // Target already satisfied check: A * 100 >= P * T
  if (safeAttended * 100 >= target * safeTotal) {
    return 0
  }

  // Integer arithmetic eliminates IEEE-754 floating-point inaccuracies
  const numerator = target * safeTotal - 100 * safeAttended
  const denominator = 100 - target
  const needed = Math.ceil(numerator / denominator)
  return Math.max(1, needed)
}
```

### File: `server/controllers/teacher/attendance.controller.js` (Aggregation Logic Excerpt)

```javascript
// Attendance Aggregation Rule (docs/ATTENDANCE_MANAGEMENT.md):
// Present and Late both count as attended. Approved OD is counted per institutional policy.
const attended = stats.present + stats.late + (OD_ATTENDANCE_POLICY === 'COUNT_AS_PRESENT' ? stats.od : 0)
const percentage = totalSessions > 0 ? Math.round((attended / totalSessions) * 100) : null
const isDeficit = isLowAttendance(percentage)
const recoveryNeeded = calculateConsecutiveClassesNeeded(attended, totalSessions, LOW_ATTENDANCE_THRESHOLD)
```

**Listing A.19: Attendance Percentage Calculation**

The attendance calculation system evaluates attendance using the formula:

$$\text{Percentage} = \left\lfloor \frac{\text{Attended Sessions}}{\text{Total Sessions}} \times 100 + 0.5 \right\rfloor$$

`Present` and `Late` marks both count toward the numerator. Approved On-Duty (OD) records are counted based on `OD_ATTENDANCE_POLICY` (`COUNT_AS_PRESENT`), while unexcused `Absent` and standard `Leave` marks count solely toward the denominator. If no sessions have been conducted, the system returns `null` ("N/A"), avoiding false deficit warnings. When a student falls below 75%, `calculateConsecutiveClassesNeeded()` applies integer arithmetic ($x = \lceil \frac{P \cdot T - 100 \cdot A}{100 - P} \rceil$) to calculate how many consecutive classes they must attend to return to good standing.
