import { Router } from 'express'
import { protect } from '../../middleware/auth.middleware.js'
import { authorizeRoles } from '../../middleware/role.middleware.js'
import { validateObjectId } from '../../middleware/validateObjectId.js'
import {
  getAdminReports,
  getAdminReportFilterOptions,
  getAdminReportSessionDetail,
  getAdminReportStudentDetail,
} from '../../controllers/admin/report.controller.js'

const router = Router()
router.use(protect)
router.use(authorizeRoles('admin'))

router.get('/', getAdminReports)
router.get('/options', getAdminReportFilterOptions)
router.get('/session/:id', validateObjectId(), getAdminReportSessionDetail)
router.get('/student/:id', validateObjectId(), getAdminReportStudentDetail)

export default router
