import crypto from 'crypto'
import mongoose from 'mongoose'
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

// GET /api/auth/setup/status
export const getSetupStatus = asyncHandler(async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(200).json({
      success: true,
      message: 'Database connection is not ready. Please verify your MongoDB configuration in Render.',
      data: {
        setupAvailable: false,
        adminExists: null,
        hasSetupKey: Boolean(process.env.ADMIN_SETUP_KEY?.trim()),
        dbConnected: false,
        message: 'Database connection is not ready. Please verify your MongoDB configuration in Render and MongoDB Atlas network access.',
      },
    })
  }

  const serverSetupKey = process.env.ADMIN_SETUP_KEY?.trim()
  const hasSetupKey = Boolean(serverSetupKey)

  const adminUserExists = await User.exists({ role: 'admin' })
  const adminProfileExists = await Admin.exists({})
  const adminExists = Boolean(adminUserExists || adminProfileExists)

  const setupAvailable = hasSetupKey && !adminExists

  let message = 'Admin setup is available.'
  if (!hasSetupKey) {
    message = 'ADMIN_SETUP_KEY is not configured on the server. Admin setup is disabled.'
  } else if (adminExists) {
    message = 'An administrator account already exists. Admin setup is locked.'
  }

  res.status(200).json({
    success: true,
    data: {
      setupAvailable,
      adminExists,
      hasSetupKey,
      dbConnected: true,
      message,
    },
  })
})

// POST /api/auth/setup
export const setupAdmin = asyncHandler(async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    res.status(503)
    throw new Error('Database connection is not ready. Please verify your MongoDB configuration.')
  }

  const serverSetupKey = process.env.ADMIN_SETUP_KEY?.trim()
  if (!serverSetupKey) {
    res.status(503)
    throw new Error('Admin setup is disabled. ADMIN_SETUP_KEY is not configured on the server.')
  }

  const { name, email, password, setupKey, department } = req.body

  const clientKey = String(setupKey || '').trim()
  const keyBuf = Buffer.from(clientKey)
  const serverBuf = Buffer.from(serverSetupKey)

  if (keyBuf.length !== serverBuf.length || !crypto.timingSafeEqual(keyBuf, serverBuf)) {
    res.status(403)
    throw new Error('Invalid admin setup key.')
  }

  const existingAdminUser = await User.exists({ role: 'admin' })
  const existingAdminProfile = await Admin.exists({})
  if (existingAdminUser || existingAdminProfile) {
    res.status(409)
    throw new Error('An administrator account already exists. Admin registration is closed.')
  }

  const cleanEmail = email ? String(email).trim().toLowerCase() : ''
  const existingUser = await User.findOne({ email: cleanEmail })
  if (existingUser) {
    res.status(409)
    throw new Error('An account with this email already exists.')
  }

  let user
  try {
    // User.pre('save') handles bcrypt hashing automatically
    user = await User.create({
      name: name ? String(name).trim() : 'Administrator',
      email: cleanEmail,
      password,
      role: 'admin',
    })

    let employeeId = 'ADM-001'
    const existingEmp = await Admin.findOne({ employeeId })
    if (existingEmp) {
      const count = await Admin.countDocuments()
      employeeId = `ADM-${String(count + 1).padStart(3, '0')}`
    }

    await Admin.create({
      user: user._id,
      employeeId,
      department: department && String(department).trim() ? String(department).trim() : 'CSE',
    })
  } catch (err) {
    if (user && user._id) {
      await User.findByIdAndDelete(user._id).catch(() => {})
    }
    throw err
  }

  res.status(201).json({
    success: true,
    message: 'Administrator account created successfully. You can now log in.',
    data: {
      user: sanitizeUser(user),
    },
  })
})

