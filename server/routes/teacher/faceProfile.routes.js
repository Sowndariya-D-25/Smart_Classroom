import { Router } from 'express'
import { validateObjectId } from '../../middleware/validateObjectId.js'
import { registerFace, getFaceStatus } from '../../controllers/teacher/faceProfile.controller.js'
import { registerFaceValidator } from '../../validators/teacher/faceProfile.validator.js'

const router = Router()

router.post('/', registerFaceValidator, registerFace)
router.get('/status/:studentId', validateObjectId('studentId'), getFaceStatus)

export default router
