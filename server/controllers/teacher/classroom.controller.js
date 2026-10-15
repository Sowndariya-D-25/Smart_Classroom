import asyncHandler from '../../utils/asyncHandler.js'
import { Classroom } from '../../models/index.js'

/**
 * GET /api/teacher/classrooms
 *
 * Teachers need to pick a classroom when starting an attendance session,
 * but classrooms aren't owned by a teacher (they're a shared, admin-
 * managed resource — same Classroom model Phase 5's Admin > Classrooms
 * page already uses). This just exposes a read-only, teacher-accessible
 * listing of the active ones — no new model, no duplicated data.
 *
 * This intentionally does NOT go through Timetable: a teacher should be
 * able to choose any active classroom for a manual session, not only
 * ones that already have a scheduled Timetable entry (Timetable/Admin
 * scheduling is a later phase — see docs/TEACHER_MODULE.md).
 */
export const listActiveClassrooms = asyncHandler(async (req, res) => {
  const classrooms = await Classroom.find({ isActive: true })
    .select('name code building capacity hasCamera')
    .sort({ name: 1 })

  res.json({ success: true, data: { items: classrooms } })
})
