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

// Admin personal account & security routes
router.get('/', getAdminProfile)
router.put('/', updateAdminProfile)
router.put('/password', changeAdminPassword)
router.patch('/password', changeAdminPassword)

export default router
