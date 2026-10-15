import asyncHandler from '../../utils/asyncHandler.js'
import { User, Admin } from '../../models/index.js'
import { LOW_ATTENDANCE_THRESHOLD } from '../../utils/attendanceThreshold.js'

// GET /api/admin/settings/profile
export const getAdminProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
  const admin = await Admin.findOne({ user: req.user._id })

  if (!user) {
    res.status(404)
    throw new Error('User not found')
  }

  res.json({
    success: true,
    data: {
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone || '',
        role: user.role,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt,
      },
      admin: admin
        ? {
            _id: admin._id,
            employeeId: admin.employeeId,
            department: admin.department || '',
            permissions: admin.permissions || [],
            isActive: admin.isActive,
          }
        : null,
      system: {
        attendanceThreshold: LOW_ATTENDANCE_THRESHOLD,
        academicYear: '2026-2027',
        defaultSemester: 3,
        environment: process.env.NODE_ENV || 'development',
      },
    },
  })
})

// PUT /api/admin/settings/profile
export const updateAdminProfile = asyncHandler(async (req, res) => {
  const { name, phone, department } = req.body

  const user = await User.findById(req.user._id)
  if (!user) {
    res.status(404)
    throw new Error('User not found')
  }

  if (name) user.name = name.trim()
  if (phone !== undefined) user.phone = phone.trim()
  await user.save()

  if (department !== undefined) {
    await Admin.findOneAndUpdate(
      { user: user._id },
      { department: department.trim() },
      { new: true, upsert: true },
    )
  }

  const updatedAdmin = await Admin.findOne({ user: user._id })

  res.json({
    success: true,
    message: 'Profile updated successfully',
    data: {
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
      admin: updatedAdmin,
    },
  })
})

// PUT /api/admin/settings/password
export const changeAdminPassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body

  if (!currentPassword || !newPassword) {
    res.status(400)
    throw new Error('Please provide both current and new password')
  }

  if (newPassword.length < 8) {
    res.status(400)
    throw new Error('New password must be at least 8 characters')
  }

  if (confirmPassword && newPassword !== confirmPassword) {
    res.status(400)
    throw new Error('New passwords do not match')
  }

  const user = await User.findById(req.user._id).select('+password')
  if (!user) {
    res.status(404)
    throw new Error('User not found')
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
