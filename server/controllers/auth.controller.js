import asyncHandler from '../utils/asyncHandler.js'
import generateToken from '../utils/generateToken.js'
import sanitizeUser from '../utils/formatUser.js'
import User from '../models/User.js'
import Student from '../models/Student.js'
import Teacher from '../models/Teacher.js'
import Admin from '../models/Admin.js'

/**
 * Looks up the role-specific profile (Student/Teacher/Admin) linked to a
 * User, if one exists yet. Self-registered students won't have a Student
 * profile until an admin completes it (see register() below) — that's
 * expected, not an error, so this returns null rather than throwing.
 */
const getRoleProfile = async (user) => {
  switch (user.role) {
    case 'student':
      return Student.findOne({ user: user._id }).populate('course', 'name code')
    case 'teacher':
      return Teacher.findOne({ user: user._id }).populate('subjects', 'name code')
    case 'admin':
      return Admin.findOne({ user: user._id })
    default:
      return null
  }
}

// POST /api/auth/register
export const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body
  const cleanEmail = email ? String(email).trim().toLowerCase() : ''

  const existing = await User.findOne({ email: cleanEmail })
  if (existing) {
    res.status(409)
    throw new Error('An account with this email already exists')
  }

  // Public self-registration always creates a `student` account. Any
  // `role` field the client sends is ignored on purpose — see
  // docs/AUTHENTICATION.md for the reasoning. Teacher and admin accounts
  // are provisioned by the seed script or (in a later phase) an
  // authenticated admin-only endpoint, never by an anonymous request.
  const user = await User.create({ name: name ? String(name).trim() : '', email: cleanEmail, password, role: 'student' })

  const token = generateToken(user)
  res.status(201).json({
    success: true,
    message: 'Registration successful',
    data: { token, user: sanitizeUser(user) },
  })
})

// POST /api/auth/login
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body
  const cleanEmail = email ? String(email).trim().toLowerCase() : ''

  // password has `select: false` on the schema, so it must be explicitly
  // requested here — this is the one place in the app that needs it.
  const user = await User.findOne({ email: cleanEmail }).select('+password')

  // Same generic message whether the email doesn't exist or the password
  // is wrong, so a caller can't use this endpoint to enumerate accounts.
  if (!user || !(await user.comparePassword(password))) {
    res.status(401)
    throw new Error('Invalid email or password')
  }

  if (!user.isActive) {
    res.status(401)
    throw new Error('This account has been deactivated. Contact an administrator.')
  }

  user.lastLogin = new Date()
  await user.save()

  const token = generateToken(user)
  res.status(200).json({
    success: true,
    message: 'Login successful',
    data: { token, user: sanitizeUser(user) },
  })
})

// GET /api/auth/me
export const getMe = asyncHandler(async (req, res) => {
  const profile = await getRoleProfile(req.user)
  res.status(200).json({
    success: true,
    data: { user: sanitizeUser(req.user), profile: profile || null },
  })
})

// POST /api/auth/logout
export const logout = asyncHandler(async (req, res) => {
  if (req.user) {
    req.user.tokenVersion = (req.user.tokenVersion || 0) + 1
    await req.user.save()
  }
  res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  })
})
