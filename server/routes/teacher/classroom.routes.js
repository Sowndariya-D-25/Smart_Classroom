import { Router } from 'express'
import { listActiveClassrooms } from '../../controllers/teacher/classroom.controller.js'

const router = Router()
router.get('/', listActiveClassrooms)
export default router
