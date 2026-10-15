import { Router } from 'express'
import { protect } from '../../middleware/auth.middleware.js'
import { authorizeRoles } from '../../middleware/role.middleware.js'
import { validateObjectId } from '../../middleware/validateObjectId.js'
import {
  getAttendanceStats,
  listAttendanceSessions,
  getAttendanceFilterOptions,
  getAttendanceSessionDetail,
  deleteAttendanceSession,
  deleteAttendanceRecord,
} from '../../controllers/admin/attendance.controller.js'

const router = Router()
router.use(protect)
router.use(authorizeRoles('admin'))

router.get('/', listAttendanceSessions)
router.get('/stats', getAttendanceStats)
router.get('/sessions', listAttendanceSessions)
router.get('/options', getAttendanceFilterOptions)
router.get('/sessions/:id', validateObjectId(), getAttendanceSessionDetail)
router.delete('/sessions/:id', validateObjectId(), deleteAttendanceSession)
router.delete('/records/:id', validateObjectId(), deleteAttendanceRecord)

export default router
