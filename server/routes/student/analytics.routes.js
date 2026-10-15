import { Router } from 'express'
import { getStudentAnalyticsOverview } from '../../controllers/student/analytics.controller.js'

const router = Router()
router.get('/overview', getStudentAnalyticsOverview)
export default router
