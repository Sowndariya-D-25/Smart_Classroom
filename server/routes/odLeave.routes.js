import express from 'express'
import { protect } from '../middleware/auth.middleware.js'
import { authorizeRoles } from '../middleware/role.middleware.js'
import { loadStudentProfile } from '../middleware/loadStudentProfile.js'
import { validateObjectId } from '../middleware/validateObjectId.js'
import {
  submitRequest,
  getMyRequests,
  getReviewerRequests,
  reviewRequest,
  getSessionExceptions,
} from '../controllers/odLeave.controller.js'

const router = express.Router()

// Student routes
router.post('/apply', protect, authorizeRoles('student'), loadStudentProfile, submitRequest)
router.get('/my-requests', protect, authorizeRoles('student'), loadStudentProfile, getMyRequests)

// Reviewer routes (Teacher & Admin)
router.get('/requests', protect, authorizeRoles('teacher', 'admin'), getReviewerRequests)
router.patch('/:id/review', protect, authorizeRoles('teacher', 'admin'), validateObjectId('id'), reviewRequest)
router.get('/session-exceptions/:sessionId', protect, authorizeRoles('teacher', 'admin'), validateObjectId('sessionId'), getSessionExceptions)

export default router
