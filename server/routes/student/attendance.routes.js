import { Router } from 'express'
import { getMySummary, getMyHistory } from '../../controllers/student/attendance.controller.js'

const router = Router()
router.get('/', getMySummary)
router.get('/history', getMyHistory)
export default router
