import asyncHandler from '../../utils/asyncHandler.js'
import { Course } from '../../models/index.js'
import { canonicalDepartment } from '../../utils/academicFilter.js'

/**
 * GET /api/teacher/courses
 *
 * Exposes a read-only list of active academic courses for teachers to
 * select when registering students or viewing course affiliations.
 * Shared, admin-managed resource — same Course model used across the system,
 * parallel to GET /api/teacher/classrooms.
 */
export const listActiveCourses = asyncHandler(async (req, res) => {
  const courses = await Course.find({ isActive: true })
    .select('name code department duration description')
    .sort({ name: 1 })

  const items = courses.map((c) => {
    const obj = c.toObject()
    return {
      ...obj,
      department: canonicalDepartment(obj.department),
    }
  })

  res.json({ success: true, data: { items } })
})

