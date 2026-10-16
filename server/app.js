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

const isAllowedOrigin = (origin) => {
  if (!origin) return true
  const cleanOrigin = origin.trim().replace(/\/+$/, '')

  // Match explicitly configured origins (case-insensitive)
  if (allowedOrigins.some((o) => o.toLowerCase() === cleanOrigin.toLowerCase())) {
    return true
  }

  // Automatically allow all valid Vercel deployment domains (production, preview, branch)
  try {
    const parsed = new URL(cleanOrigin)
    if (
      parsed.protocol === 'https:' &&
      (parsed.hostname === 'vercel.app' || parsed.hostname.endsWith('.vercel.app'))
    ) {
      return true
    }
  } catch {
    // Malformed origin
  }

  // Allow localhost in non-production environments
  if (
    process.env.NODE_ENV !== 'production' &&
    /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(cleanOrigin)
  ) {
    return true
  }

  return false
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        return callback(null, true)
      }
      console.warn(`[CORS] Blocked request from origin: "${origin}". Add it to CLIENT_URL or ALLOWED_ORIGINS in Render.`)
      return callback(null, false)
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
