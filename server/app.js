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

// --- Core security & middleware ---
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
)

const configuredOrigins = (process.env.ALLOWED_ORIGINS || process.env.CLIENT_URL || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

const defaultDevOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173']
const allowedOrigins = Array.from(new Set([...defaultDevOrigins, ...configuredOrigins]))

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, server-to-server)
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
app.use(express.json({ limit: '2mb' })) // 2mb covers a few base64 face descriptors, not raw images
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'))
}

// --- Routes ---
app.get('/', (req, res) => {
  res.json({ success: true, message: 'Smart Classroom & Attendance Analytics API' })
})

app.use('/api/health', healthRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/teacher', teacherRoutes)
app.use('/api/student', studentRoutes)
app.use('/api/od-leave', odLeaveRoutes)

// Additional route groups (face, analytics, notifications, ...) are
// mounted here in later phases.

// --- Error handling (must be last) ---
app.use(notFound)
app.use(errorHandler)

export default app
