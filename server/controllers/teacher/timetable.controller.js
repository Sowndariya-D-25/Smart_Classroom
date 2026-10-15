import asyncHandler from '../../utils/asyncHandler.js'
import currentDayOfWeek from '../../utils/dayOfWeek.js'
import { Timetable } from '../../models/index.js'

const POPULATE = [
  { path: 'subject', select: 'name code' },
  { path: 'course', select: 'name code' },
  { path: 'classroom', select: 'name code building' },
]

// GET /api/teacher/timetable — full weekly timetable, scoped to req.teacher._id.
export const getMyTimetable = asyncHandler(async (req, res) => {
  const entries = await Timetable.find({ teacher: req.teacher._id, isActive: true })
    .populate(POPULATE)
    .sort({ dayOfWeek: 1, startTime: 1 })

  res.json({ success: true, data: { items: entries } })
})

// GET /api/teacher/timetable/today
export const getTodayTimetable = asyncHandler(async (req, res) => {
  const today = currentDayOfWeek()
  const entries = await Timetable.find({ teacher: req.teacher._id, dayOfWeek: today, isActive: true })
    .populate(POPULATE)
    .sort({ startTime: 1 })

  res.json({ success: true, data: { items: entries, day: today } })
})
