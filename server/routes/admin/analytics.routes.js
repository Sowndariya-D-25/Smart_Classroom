import { Router } from 'express'
import { protect } from '../../middleware/auth.middleware.js'
import { authorizeRoles } from '../../middleware/role.middleware.js'
import { getAdminAnalyticsOverview } from '../../controllers/admin/analytics.controller.js'

const router = Router()
router.use(protect)
router.use(authorizeRoles('admin'))

router.get('/', getAdminAnalyticsOverview)
router.get('/overview', getAdminAnalyticsOverview)

export default router
