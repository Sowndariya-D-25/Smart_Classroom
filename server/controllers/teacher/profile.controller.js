import asyncHandler from '../../utils/asyncHandler.js'
import { User } from '../../models/index.js'
import { canonicalDepartment } from '../../utils/academicFilter.js'

const POPULATE_USER = 'name email phone isActive lastLogin role'
const POPULATE_SUBJECTS = 'name code'

// GET /api/teacher/profile
export const getMyProfile = asyncHandler(async (req, res) => {
  const teacher = await req.teacher.populate([
    { path: 'user', select: POPULATE_USER },
    { path: 'subjects', select: POPULATE_SUBJECTS },
  ])
  if (teacher.department) {
    teacher.department = canonicalDepartment(teacher.department)
  }
  res.json({ success: true, data: { teacher } })
})

// PUT /api/teacher/profile
// Admin-controlled fields: department, designation, role, status, email, employeeId
// are explicitly excluded from teacher update requests.
export const updateMyProfile = asyncHandler(async (req, res) => {
  const { name, phone } = req.body
  const teacher = await req.teacher.populate('user')

  if (name !== undefined) teacher.user.name = String(name).trim()
  if (phone !== undefined) {
    teacher.user.phone = String(phone).trim()
    teacher.phone = String(phone).trim()
  }

  await teacher.user.save()
  await teacher.save()

  const populated = await teacher.populate([
    { path: 'user', select: POPULATE_USER },
    { path: 'subjects', select: POPULATE_SUBJECTS },
  ])
  if (populated.department) {
    populated.department = canonicalDepartment(populated.department)
  }
  res.json({ success: true, message: 'Profile updated successfully', data: { teacher: populated } })
})

// PUT /api/teacher/profile/password
export const changeTeacherPassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body

  if (!currentPassword || !newPassword) {
    res.status(400)
    throw new Error('Please provide both current and new passwords')
  }

  if (newPassword.length < 8) {
    res.status(400)
    throw new Error('New password must be at least 8 characters long')
  }

  if (confirmPassword && newPassword !== confirmPassword) {
    res.status(400)
    throw new Error('New passwords do not match')
  }

  const user = await User.findById(req.user._id).select('+password')
  if (!user) {
    res.status(404)
    throw new Error('User account not found')
  }

  const isMatch = await user.comparePassword(currentPassword)
  if (!isMatch) {
    res.status(400)
    throw new Error('Current password is incorrect')
  }

  user.password = newPassword
  await user.save()

  res.json({
    success: true,
    message: 'Password changed successfully',
  })
})

