import { Router } from 'express'
import { listMySubjects } from '../../controllers/teacher/subject.controller.js'

const router = Router()
router.get('/', listMySubjects)
export default router
