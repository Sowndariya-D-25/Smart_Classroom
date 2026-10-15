import { Router } from 'express'
import { getStudentDashboardStats } from '../../controllers/student/dashboard.controller.js'

const router = Router()

router.get('/summary', getStudentDashboardStats)

export default router
