import { Router } from 'express'
import { getDbStatus } from '../config/db.js'

const router = Router()

// GET /api/health - lets the frontend confirm the API (and DB) are reachable.
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Smart Classroom API is running',
    db: getDbStatus(),
    timestamp: new Date().toISOString(),
  })
})

// GET /api/health/ready - readiness probe reporting whether database is ready
router.get('/ready', (req, res) => {
  const isReady = getDbStatus() === 'connected'
  res.status(isReady ? 200 : 503).json({
    success: isReady,
    status: isReady ? 'ready' : 'not ready',
    db: getDbStatus(),
    timestamp: new Date().toISOString(),
  })
})

export default router
