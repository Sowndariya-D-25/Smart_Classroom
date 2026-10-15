import { Router } from 'express'
import { validateObjectId } from '../../middleware/validateObjectId.js'
import {
  createSession,
  getSession,
  markAttendance,
  completeSession,
  listSessions,
  getClassAttendance,
} from '../../controllers/teacher/attendance.controller.js'
import { recognizeFace } from '../../controllers/teacher/faceRecognition.controller.js'
import { createSessionValidator, markAttendanceValidator } from '../../validators/teacher/attendance.validator.js'
import { recognizeFaceValidator } from '../../validators/teacher/faceRecognition.validator.js'

const router = Router()

router.get('/sessions', listSessions)
router.post('/sessions', createSessionValidator, createSession)
router.get('/sessions/:id', validateObjectId(), getSession)
router.post('/sessions/:id/mark', validateObjectId(), markAttendanceValidator, markAttendance)
router.post('/sessions/:id/complete', validateObjectId(), completeSession)
// Computer Vision (Phase 7): recognize a face against this session's
// roster and mark attendance. Kept in this same file, alongside the
// other session routes, rather than mounted from a second router at the
// same '/attendance' prefix — one file, one place to look.
router.post('/sessions/:id/recognize', validateObjectId(), recognizeFaceValidator, recognizeFace)
router.get('/class/:subjectId', validateObjectId('subjectId'), getClassAttendance)

export default router
