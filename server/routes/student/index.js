import { Router } from 'express'
import { protect } from '../../middleware/auth.middleware.js'
import { authorizeRoles } from '../../middleware/role.middleware.js'
import { loadStudentProfile } from '../../middleware/loadStudentProfile.js'
import attendanceRoutes from './attendance.routes.js'
import analyticsRoutes from './analytics.routes.js'
import subjectRoutes from './subject.routes.js'
import timetableRoutes from './timetable.routes.js'
import notificationRoutes from './notification.routes.js'
import profileRoutes from './profile.routes.js'
import dashboardRoutes from './dashboard.routes.js'

// Same pattern as routes/teacher/index.js: auth + role + profile
// resolution applied once for the whole /api/student group.
const router = Router()
router.use(protect)
router.use(authorizeRoles('student'))
router.use(loadStudentProfile)

router.use('/dashboard', dashboardRoutes)
router.use('/subjects', subjectRoutes)
router.use('/timetable', timetableRoutes)
router.use('/attendance', attendanceRoutes)
router.use('/analytics', analyticsRoutes)
router.use('/notifications', notificationRoutes)
router.use('/profile', profileRoutes)

export default router
