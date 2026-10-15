import { validationResult } from 'express-validator'

// Same shape/behavior as validators/auth.validator.js's `validate` — kept
// as a separate copy rather than importing from there, so Phase 3's auth
// validator file stays completely untouched.
export const validate = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    })
  }
  next()
}

export default validate
