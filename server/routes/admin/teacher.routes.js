import { Router } from 'express'
import { protect } from '../../middleware/auth.middleware.js'
import { authorizeRoles } from '../../middleware/role.middleware.js'
import { validateObjectId } from '../../middleware/validateObjectId.js'
import {
  listTeachers,
  getTeacher,
  createTeacher,
  updateTeacher,
  updateTeacherStatus,
  deleteTeacher,
} from '../../controllers/admin/teacher.controller.js'
import {
  createTeacherValidator,
  updateTeacherValidator,
  updateStatusValidator,
} from '../../validators/admin/teacher.validator.js'

const router = Router()
router.use(protect)
router.use(authorizeRoles('admin'))

router.get('/', listTeachers)
router.post('/', createTeacherValidator, createTeacher)
router.get('/:id', validateObjectId(), getTeacher)
router.put('/:id', validateObjectId(), updateTeacherValidator, updateTeacher)
router.patch('/:id/status', validateObjectId(), updateStatusValidator, updateTeacherStatus)
router.delete('/:id', validateObjectId(), deleteTeacher)

export default router
