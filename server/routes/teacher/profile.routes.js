import { Router } from 'express'
import { getMyProfile, updateMyProfile, changeTeacherPassword } from '../../controllers/teacher/profile.controller.js'
import { updateProfileValidator } from '../../validators/teacher/profile.validator.js'

const router = Router()
router.get('/', getMyProfile)
router.put('/', updateProfileValidator, updateMyProfile)
router.put('/password', changeTeacherPassword)
router.patch('/password', changeTeacherPassword)
export default router
