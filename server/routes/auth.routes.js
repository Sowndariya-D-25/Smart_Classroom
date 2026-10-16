import { Router } from 'express'
import { register, login, getMe, logout, getSetupStatus, setupAdmin } from '../controllers/auth.controller.js'
import { registerValidator, loginValidator, adminSetupValidator } from '../validators/auth.validator.js'
import { protect } from '../middleware/auth.middleware.js'
import { authorizeRoles } from '../middleware/role.middleware.js'
import { loginLimiter, registerLimiter } from '../middleware/rateLimiter.js'

const router = Router()

router.get('/setup/status', getSetupStatus)
router.post('/setup', registerLimiter, adminSetupValidator, setupAdmin)
router.post('/register', registerLimiter, registerValidator, register)
router.post('/login', loginLimiter, loginValidator, login)
router.get('/me', protect, getMe)
router.post('/logout', protect, logout)

// --- Test-only routes ---
// Strictly mounted only when running automated tests (NODE_ENV === 'test').
// Never mounted in development, staging, or production.
if (process.env.NODE_ENV === 'test') {
  router.get('/test/admin', protect, authorizeRoles('admin'), (req, res) => {
    res.json({ success: true, message: 'Admin-only route reached', role: req.user.role })
  })
  router.get('/test/teacher', protect, authorizeRoles('admin', 'teacher'), (req, res) => {
    res.json({ success: true, message: 'Teacher route reached', role: req.user.role })
  })
  router.get('/test/student', protect, authorizeRoles('admin', 'teacher', 'student'), (req, res) => {
    res.json({ success: true, message: 'Student route reached', role: req.user.role })
  })
}

export default router
