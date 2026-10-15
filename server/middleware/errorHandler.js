// Centralized error handling. Every controller should either call next(err)
// or throw inside an async handler wrapped by asyncHandler (utils/asyncHandler.js).

export const notFound = (req, res, next) => {
  const error = new Error(`Route not found - ${req.originalUrl}`)
  res.status(404)
  next(error)
}

// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  let statusCode = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500
  let message = err.message || 'Server error'

  // Mongoose bad ObjectId / CastError (malformed parameter or invalid input)
  if (err.name === 'CastError') {
    statusCode = 400
    message = err.kind === 'ObjectId' ? 'Invalid ID format' : `Invalid value for ${err.path || 'field'}`
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    statusCode = 400
    message = Object.values(err.errors)
      .map((val) => val.message)
      .join(', ')
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    statusCode = 409
    const kv = err.keyValue || {}
    const keys = Object.keys(kv)
    if (keys.includes('course') && keys.includes('rollNumber')) {
      message = `Roll number "${kv.rollNumber}" already exists in this course. Please assign a unique roll number.`
    } else if (keys.includes('studentId')) {
      message = `Register number "${kv.studentId}" already exists.`
    } else if (keys.includes('email')) {
      message = `Email address "${kv.email}" is already in use.`
    } else if (keys.includes('code')) {
      message = `Code "${kv.code}" already exists.`
    } else if (keys.includes('employeeId')) {
      message = `Employee ID "${kv.employeeId}" already exists.`
    } else if (keys.includes('user')) {
      message = 'A profile already exists for this user account.'
    } else {
      const field = keys[0]
      message = field ? `${field} already in use` : 'Duplicate value'
    }
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401
    message = 'Invalid token'
  }
  if (err.name === 'TokenExpiredError') {
    statusCode = 401
    message = 'Session expired, please log in again'
  }

  if (statusCode === 500 && process.env.NODE_ENV !== 'test') {
    console.error('[Server Error]', err.message || err)
  }

  res.status(statusCode).json({
    success: false,
    message,
  })
}
