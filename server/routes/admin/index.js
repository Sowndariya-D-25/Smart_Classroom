import { Router } from 'express'
import dashboardRoutes from './dashboard.routes.js'
import studentRoutes from './student.routes.js'
import teacherRoutes from './teacher.routes.js'
import subjectRoutes from './subject.routes.js'
import courseRoutes from './course.routes.js'
import classroomRoutes from './classroom.routes.js'
import announcementRoutes from './announcement.routes.js'
import timetableRoutes from './timetable.routes.js'
import attendanceRoutes from './attendance.routes.js'
import analyticsRoutes from './analytics.routes.js'
import reportRoutes from './report.routes.js'
import settingsRoutes from './settings.routes.js'
import profileRoutes from './profile.routes.js'
import departmentRoutes from './department.routes.js'

// Every sub-router applies its own protect + authorizeRoles('admin') —
// see each file. Aggregated here just to keep app.js's route mounting
// to one line per resource group.
const router = Router()

router.use('/dashboard', dashboardRoutes)
router.use('/students', studentRoutes)
router.use('/teachers', teacherRoutes)
router.use('/subjects', subjectRoutes)
router.use('/courses', courseRoutes)
router.use('/classrooms', classroomRoutes)
router.use('/announcements', announcementRoutes)
router.use('/timetable', timetableRoutes)
router.use('/attendance', attendanceRoutes)
router.use('/analytics', analyticsRoutes)
router.use('/reports', reportRoutes)
router.use('/settings', settingsRoutes)
router.use('/profile', profileRoutes)
router.use('/departments', departmentRoutes)


export default router
