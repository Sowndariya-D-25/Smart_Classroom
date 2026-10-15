import { Router } from 'express'
import { listActiveCourses } from '../../controllers/teacher/course.controller.js'

const router = Router()
router.get('/', listActiveCourses)

export default router
