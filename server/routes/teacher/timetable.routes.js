import { Router } from 'express'
import { getMyTimetable, getTodayTimetable } from '../../controllers/teacher/timetable.controller.js'

const router = Router()
router.get('/', getMyTimetable)
router.get('/today', getTodayTimetable)
export default router
