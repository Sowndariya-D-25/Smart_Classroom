import { Router } from 'express'
import { validateObjectId } from '../../middleware/validateObjectId.js'
import {
  getAttendanceReport,
  getFilterOptions,
  getDailySessionDetail,
  getStudentDetailReport,
} from '../../controllers/teacher/report.controller.js'

const router = Router()

// All routes here run with protect + authorizeRoles('teacher') + loadTeacherProfile
router.get('/filter-options', getFilterOptions)
router.get('/', getAttendanceReport)
router.get('/session/:id', validateObjectId(), getDailySessionDetail)
router.get('/student/:id', validateObjectId(), getStudentDetailReport)

export default router
