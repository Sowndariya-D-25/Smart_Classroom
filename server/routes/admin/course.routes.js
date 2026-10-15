import { Router } from 'express'
import { protect } from '../../middleware/auth.middleware.js'
import { authorizeRoles } from '../../middleware/role.middleware.js'
import { validateObjectId } from '../../middleware/validateObjectId.js'
import {
  listCourses,
  getCourse,
  createCourse,
  updateCourse,
  updateCourseStatus,
  deleteCourse,
} from '../../controllers/admin/course.controller.js'
import {
  createCourseValidator,
  updateCourseValidator,
  updateStatusValidator,
} from '../../validators/admin/course.validator.js'

const router = Router()
router.use(protect)
router.use(authorizeRoles('admin'))

router.get('/', listCourses)
router.post('/', createCourseValidator, createCourse)
router.get('/:id', validateObjectId(), getCourse)
router.put('/:id', validateObjectId(), updateCourseValidator, updateCourse)
router.patch('/:id/status', validateObjectId(), updateStatusValidator, updateCourseStatus)
router.delete('/:id', validateObjectId(), deleteCourse)

export default router
