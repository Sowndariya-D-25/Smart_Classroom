import { Router } from 'express'
import { validateObjectId } from '../../middleware/validateObjectId.js'
import { recognizeFace } from '../../controllers/teacher/faceRecognition.controller.js'
import { recognizeFaceValidator } from '../../validators/teacher/faceRecognition.validator.js'

const router = Router()

// Mounted at /api/teacher/attendance/sessions/:id/recognize (see attendance.routes.js)
router.post('/:id/recognize', validateObjectId(), recognizeFaceValidator, recognizeFace)

export default router
