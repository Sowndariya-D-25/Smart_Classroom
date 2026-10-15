import { body } from 'express-validator'
import { validate } from '../../utils/validateRequest.js'

// Intentionally has no fields for role, email, employeeId, or isActive —
// see profile.controller.js's updateMyProfile, which only ever reads
// the fields listed here regardless of what else is in the request body.
export const updateProfileValidator = [
  body('name').optional({ checkFalsy: true }).trim().isLength({ max: 100 }),
  body('phone').optional({ checkFalsy: true }).trim().isLength({ max: 20 }),
  body('department').optional({ checkFalsy: true }).trim().isLength({ max: 100 }),
  body('designation').optional({ checkFalsy: true }).trim().isLength({ max: 100 }),
  validate,
]
