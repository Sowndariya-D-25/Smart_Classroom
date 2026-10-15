import { Router } from 'express'
import { protect } from '../../middleware/auth.middleware.js'
import { authorizeRoles } from '../../middleware/role.middleware.js'
import { loadTeacherProfile } from '../../middleware/loadTeacherProfile.js'

import dashboardRoutes from './dashboard.routes.js'
import subjectRoutes from './subject.routes.js'
import classRoutes from './class.routes.js'
import classroomRoutes from './classroom.routes.js'
import timetableRoutes from './timetable.routes.js'
import attendanceRoutes from './attendance.routes.js'
import analyticsRoutes from './analytics.routes.js'
import faceProfileRoutes from './faceProfile.routes.js'
import profileRoutes from './profile.routes.js'
import studentRoutes from './student.routes.js'
import notificationRoutes from './notification.routes.js'
import reportRoutes from './report.routes.js'
import courseRoutes from './course.routes.js'

// Applied once, here, for the whole /api/teacher group: must be logged
// in, must be a teacher, and must have a Teacher profile — every route
// below can then safely assume req.teacher is set and scoped correctly.
const router = Router()
router.use(protect)
router.use(authorizeRoles('teacher'))
router.use(loadTeacherProfile)

router.use('/dashboard', dashboardRoutes)
router.use('/subjects', subjectRoutes)
router.use('/classes', classRoutes)
router.use('/classrooms', classroomRoutes)
router.use('/timetable', timetableRoutes)
router.use('/attendance', attendanceRoutes)
router.use('/analytics', analyticsRoutes)
router.use('/face-profiles', faceProfileRoutes)
router.use('/profile', profileRoutes)
router.use('/students', studentRoutes)
router.use('/notifications', notificationRoutes)
router.use('/reports', reportRoutes)
router.use('/courses', courseRoutes)

export default router
