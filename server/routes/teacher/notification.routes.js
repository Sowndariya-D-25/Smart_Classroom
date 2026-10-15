import { Router } from 'express'
import { validateObjectId } from '../../middleware/validateObjectId.js'
import {
  getNotifications,
  getUnreadCount,
  getNotificationById,
  markAsRead,
  markAllAsRead,
} from '../../controllers/teacher/notification.controller.js'

const router = Router()

// All routes are already protected with protect + authorizeRoles('teacher') + loadTeacherProfile
// in server/routes/teacher/index.js
router.get('/', getNotifications)
router.get('/unread-count', getUnreadCount)
router.patch('/read-all', markAllAsRead)
router.get('/:id', validateObjectId(), getNotificationById)
router.patch('/:id/read', validateObjectId(), markAsRead)

export default router
