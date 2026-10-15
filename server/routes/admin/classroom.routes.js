import { Router } from 'express'
import { protect } from '../../middleware/auth.middleware.js'
import { authorizeRoles } from '../../middleware/role.middleware.js'
import { validateObjectId } from '../../middleware/validateObjectId.js'
import {
  listClassrooms,
  getClassroom,
  createClassroom,
  updateClassroom,
  updateClassroomStatus,
  deleteClassroom,
} from '../../controllers/admin/classroom.controller.js'
import {
  createClassroomValidator,
  updateClassroomValidator,
  updateStatusValidator,
} from '../../validators/admin/classroom.validator.js'

const router = Router()
router.use(protect)
router.use(authorizeRoles('admin'))

router.get('/', listClassrooms)
router.post('/', createClassroomValidator, createClassroom)
router.get('/:id', validateObjectId(), getClassroom)
router.put('/:id', validateObjectId(), updateClassroomValidator, updateClassroom)
router.patch('/:id/status', validateObjectId(), updateStatusValidator, updateClassroomStatus)
router.delete('/:id', validateObjectId(), deleteClassroom)

export default router
