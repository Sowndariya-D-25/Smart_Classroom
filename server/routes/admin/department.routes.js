import { Router } from 'express'
import { protect } from '../../middleware/auth.middleware.js'
import { authorizeRoles } from '../../middleware/role.middleware.js'
import { getDepartments } from '../../controllers/admin/department.controller.js'

const router = Router()
router.use(protect)
router.use(authorizeRoles('admin'))

router.get('/', getDepartments)

export default router
