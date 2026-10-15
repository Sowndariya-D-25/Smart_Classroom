import { Router } from 'express'
import {
  getMySubjects,
  getMySubjectDetail,
} from '../../controllers/student/subject.controller.js'
import { validateObjectId } from '../../middleware/validateObjectId.js'

const router = Router()

router.get('/', getMySubjects)
router.get('/:id', validateObjectId(), getMySubjectDetail)

export default router
