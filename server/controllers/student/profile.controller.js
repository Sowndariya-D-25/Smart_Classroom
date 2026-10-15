import asyncHandler from '../../utils/asyncHandler.js'
import { User, Student } from '../../models/index.js'
import { canonicalDepartment } from '../../utils/academicFilter.js'

// GET /api/student/profile
// Retrieves authenticated student's personal, academic, and account data
export const getStudentProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('-password').lean()
  const student = await Student.findOne({ user: req.user._id })
    .populate('course', 'name code department durationYears')
    .populate('classroom', 'name code building')
    .populate('faceProfile', 'faceDescriptor createdAt')
    .lean()

  if (!user || !student) {
    res.status(404)
    throw new Error('Student profile not found')
  }

  const rawYear = student.year != null ? Number(student.year) : 1
  const yearOrdinal =
    rawYear === 1 ? '1st Year' : rawYear === 2 ? '2nd Year' : rawYear === 3 ? '3rd Year' : `${rawYear}th Year`

  res.json({
    success: true,
    data: {
      personal: {
        name: user.name,
        email: user.email,
        phone: student.phone || user.phone || '',
        dateOfBirth: student.dateOfBirth || null,
        gender: student.gender || 'Not specified',
      },
      academic: {
        studentId: student.studentId,
        rollNumber: student.rollNumber,
        department: canonicalDepartment(student.department || 'CSE'),
        course: student.course ? `${student.course.name} (${student.course.code})` : '—',
        courseCode: student.course?.code || '',
        year: rawYear,
        yearLabel: yearOrdinal,
        semester: rawYear ? rawYear * 2 - 1 : 1,
        section: student.section || 'A',
        classroom: student.classroom ? `${student.classroom.name} (${student.classroom.code})` : 'Assigned per class',
        hasFaceRegistered: Boolean(student.faceProfile),
      },
      account: {
        role: user.role,
        isActive: student.isActive !== false && user.isActive !== false,
        memberSince: user.createdAt,
        lastLogin: user.lastLogin,
      },
    },
  })
})

// PUT /api/student/profile
// Allows editing personal contact info only (name, phone)
// Academic fields are protected from student modification
export const updateStudentProfile = asyncHandler(async (req, res) => {
  const { name, phone } = req.body
  const userId = req.user._id

  const user = await User.findById(userId)
  const student = await Student.findOne({ user: userId })

  if (!user || !student) {
    res.status(404)
    throw new Error('Student profile not found')
  }

  if (name && name.trim()) {
    user.name = name.trim()
  }

  if (phone !== undefined) {
    user.phone = phone.trim()
    student.phone = phone.trim()
  }

  await Promise.all([user.save(), student.save()])

  res.json({
    success: true,
    message: 'Profile updated successfully',
    data: {
      name: user.name,
      email: user.email,
      phone: student.phone || user.phone || '',
    },
  })
})

// PUT /api/student/password
// Changes student password with bcrypt current password verification
export const changeStudentPassword = asyncHandler(async (req, res) => {
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
