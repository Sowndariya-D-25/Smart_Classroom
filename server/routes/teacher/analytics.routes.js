import { Router } from 'express'
import { getTeacherAnalyticsOverview } from '../../controllers/teacher/analytics.controller.js'

const router = Router()
router.get('/overview', getTeacherAnalyticsOverview)
export default router
