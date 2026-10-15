import asyncHandler from '../utils/asyncHandler.js'
import Student from '../models/Student.js'

/**
 * Mirrors loadTeacherProfile.js exactly, for the student side: resolves
 * the Student profile for the authenticated user and attaches it to
 * req.student. Every student-facing controller uses req.student._id to
 * scope its queries — never a studentId read from the client (query
 * string, body, or otherwise). This is what makes
 * "Student A can only ever see Student A's attendance" true.
 */
export const loadStudentProfile = asyncHandler(async (req, res, next) => {
  const student = await Student.findOne({ user: req.user._id })
  if (!student) {
    res.status(404)
    throw new Error('No student profile is linked to this account yet. Contact an administrator.')
  }
  req.student = student
  next()
})

export default loadStudentProfile
