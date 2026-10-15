import { Router } from 'express'
import { protect } from '../../middleware/auth.middleware.js'
import { authorizeRoles } from '../../middleware/role.middleware.js'
import { validateObjectId } from '../../middleware/validateObjectId.js'
import {
  listTimetable,
  getTimetableOptions,
  getTimetableEntry,
  createTimetableEntry,
  updateTimetableEntry,
  deleteTimetableEntry,
} from '../../controllers/admin/timetable.controller.js'

const router = Router()
router.use(protect)
router.use(authorizeRoles('admin'))

router.get('/', listTimetable)
router.get('/options', getTimetableOptions)
router.get('/:id', validateObjectId(), getTimetableEntry)
router.post('/', createTimetableEntry)
router.put('/:id', validateObjectId(), updateTimetableEntry)
router.delete('/:id', validateObjectId(), deleteTimetableEntry)

export default router
