import { Router } from 'express'
import {
  getStudentNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} from '../../controllers/student/notification.controller.js'
import { validateObjectId } from '../../middleware/validateObjectId.js'

const router = Router()

router.get('/', getStudentNotifications)
router.get('/unread-count', getUnreadCount)
router.patch('/read-all', markAllNotificationsRead)
router.patch('/:id/read', validateObjectId(), markNotificationRead)

export default router
