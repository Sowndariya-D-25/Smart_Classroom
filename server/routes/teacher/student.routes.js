import { Router } from 'express'
import { validateObjectId } from '../../middleware/validateObjectId.js'
import {
  listTeacherStudents,
  getTeacherStudent,
  registerStudentWithFace,
} from '../../controllers/teacher/student.controller.js'

const router = Router()

router.get('/', listTeacherStudents)
router.get('/:id', validateObjectId(), getTeacherStudent)
router.post('/register', registerStudentWithFace)

export default router
