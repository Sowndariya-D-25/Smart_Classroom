import { Router } from 'express'
import { protect } from '../../middleware/auth.middleware.js'
import { authorizeRoles } from '../../middleware/role.middleware.js'
import { validateObjectId } from '../../middleware/validateObjectId.js'
import {
  listStudents,
  getStudent,
  createStudent,
  updateStudent,
  updateStudentStatus,
  deleteStudent,
  getStudentSections,
} from '../../controllers/admin/student.controller.js'
import {
  createStudentValidator,
  updateStudentValidator,
  updateStatusValidator,
  listStudentsValidator,
} from '../../validators/admin/student.validator.js'

const router = Router()

// Every route below requires a valid JWT AND the admin role — this is
// the real security boundary, not the frontend hiding the sidebar link.
router.use(protect)
router.use(authorizeRoles('admin'))

router.get('/sections', getStudentSections)
router.get('/', listStudentsValidator, listStudents)
router.post('/', createStudentValidator, createStudent)
router.get('/:id', validateObjectId(), getStudent)
router.put('/:id', validateObjectId(), updateStudentValidator, updateStudent)
router.patch('/:id/status', validateObjectId(), updateStatusValidator, updateStudentStatus)
router.delete('/:id', validateObjectId(), deleteStudent)

export default router
