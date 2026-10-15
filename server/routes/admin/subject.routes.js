import { Router } from 'express'
import { protect } from '../../middleware/auth.middleware.js'
import { authorizeRoles } from '../../middleware/role.middleware.js'
import { validateObjectId } from '../../middleware/validateObjectId.js'
import {
  listSubjects,
  getSubject,
  createSubject,
  updateSubject,
  updateSubjectStatus,
  deleteSubject,
} from '../../controllers/admin/subject.controller.js'
import {
  createSubjectValidator,
  updateSubjectValidator,
  updateStatusValidator,
} from '../../validators/admin/subject.validator.js'

const router = Router()
router.use(protect)
router.use(authorizeRoles('admin'))

router.get('/', listSubjects)
router.post('/', createSubjectValidator, createSubject)
router.get('/:id', validateObjectId(), getSubject)
router.put('/:id', validateObjectId(), updateSubjectValidator, updateSubject)
router.patch('/:id/status', validateObjectId(), updateStatusValidator, updateSubjectStatus)
router.delete('/:id', validateObjectId(), deleteSubject)

export default router
