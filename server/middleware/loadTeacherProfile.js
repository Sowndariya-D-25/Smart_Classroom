import asyncHandler from '../utils/asyncHandler.js'
import Teacher from '../models/Teacher.js'

/**
 * Resolves the Teacher profile for the authenticated user and attaches
 * it to req.teacher. Runs after protect + authorizeRoles('teacher').
 *
 * This is the ONE place teacher identity is resolved from the JWT/User —
 * every teacher controller uses req.teacher._id to scope its queries,
 * and NEVER trusts a teacherId sent from the client. That's what makes
 * "Teacher A can't see Teacher B's data" actually true.
 */
export const loadTeacherProfile = asyncHandler(async (req, res, next) => {
  const teacher = await Teacher.findOne({ user: req.user._id })
  if (!teacher) {
    res.status(404)
    throw new Error('No teacher profile is linked to this account yet. Contact an administrator.')
  }
  req.teacher = teacher
  next()
})

export default loadTeacherProfile
