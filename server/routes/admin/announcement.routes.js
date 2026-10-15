import { Router } from 'express'
import { protect } from '../../middleware/auth.middleware.js'
import { authorizeRoles } from '../../middleware/role.middleware.js'
import { validateObjectId } from '../../middleware/validateObjectId.js'
import {
  getAnnouncements,
  getAnnouncementById,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  togglePublish,
} from '../../controllers/admin/announcement.controller.js'

const router = Router()
router.use(protect)
router.use(authorizeRoles('admin'))

router.get('/', getAnnouncements)
router.post('/', createAnnouncement)
router.get('/:id', validateObjectId(), getAnnouncementById)
router.put('/:id', validateObjectId(), updateAnnouncement)
router.delete('/:id', validateObjectId(), deleteAnnouncement)
router.patch('/:id/publish', validateObjectId(), togglePublish)

export default router
