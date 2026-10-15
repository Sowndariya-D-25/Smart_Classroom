import { Router } from 'express'
import {
  getStudentProfile,
  updateStudentProfile,
  changeStudentPassword,
} from '../../controllers/student/profile.controller.js'

const router = Router()

router.get('/', getStudentProfile)
router.put('/', updateStudentProfile)
router.put('/password', changeStudentPassword)

export default router
