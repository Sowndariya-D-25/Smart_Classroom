import { Router } from 'express'
import { validateObjectId } from '../../middleware/validateObjectId.js'
import { listMyClasses, getClassRoster } from '../../controllers/teacher/class.controller.js'

const router = Router()
router.get('/', listMyClasses)
router.get('/:subjectId/students', validateObjectId('subjectId'), getClassRoster)
export default router
