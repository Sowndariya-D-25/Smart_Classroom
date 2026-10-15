import jwt from 'jsonwebtoken'
import asyncHandler from '../utils/asyncHandler.js'
import User from '../models/User.js'

/**
 * Verifies the `Authorization: Bearer <token>` header, loads the user it
 * belongs to, and attaches it to req.user for downstream handlers/role
 * middleware. This is the actual security boundary for every protected
 * route — the frontend hiding a link is not a substitute for this.
 */
export const protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization
  const token = header && header.startsWith('Bearer ') ? header.split(' ')[1] : null

  if (!token) {
    res.status(401)
    throw new Error('Not authorized, no token provided')
  }

  // jwt.verify throws JsonWebTokenError (invalid/malformed) or
  // TokenExpiredError (expired) — both are mapped to 401 by the
  // centralized error handler from Phase 1, so we just let them propagate.
  const decoded = jwt.verify(token, process.env.JWT_SECRET)

  const user = await User.findById(decoded.userId)
  if (!user) {
    res.status(401)
    throw new Error('Not authorized, user no longer exists')
  }
  if (!user.isActive) {
    res.status(401)
    throw new Error('Not authorized, this account has been deactivated')
  }

  if (
    decoded.tokenVersion !== undefined &&
    user.tokenVersion !== undefined &&
    decoded.tokenVersion !== user.tokenVersion
  ) {
    res.status(401)
    throw new Error('Session has expired or has been revoked. Please log in again.')
  }

  req.user = user
  next()
})

export default protect
