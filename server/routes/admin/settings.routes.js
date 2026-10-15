import { Router } from 'express'
import { protect } from '../../middleware/auth.middleware.js'
import { authorizeRoles } from '../../middleware/role.middleware.js'
import {
  getAdminProfile,
  updateAdminProfile,
  changeAdminPassword,
} from '../../controllers/admin/settings.controller.js'

const router = Router()
router.use(protect)
router.use(authorizeRoles('admin'))

router.get('/profile', getAdminProfile)
router.put('/profile', updateAdminProfile)
router.put('/password', changeAdminPassword)

export default router
