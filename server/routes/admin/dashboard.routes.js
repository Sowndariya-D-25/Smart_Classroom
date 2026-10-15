import { Router } from 'express'
import { protect } from '../../middleware/auth.middleware.js'
import { authorizeRoles } from '../../middleware/role.middleware.js'
import { getDashboardStats } from '../../controllers/admin/dashboard.controller.js'

const router = Router()
router.use(protect)
router.use(authorizeRoles('admin'))

router.get('/', getDashboardStats)
router.get('/stats', getDashboardStats)

export default router
