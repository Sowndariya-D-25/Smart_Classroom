import { body } from 'express-validator'
import { validate } from '../../utils/validateRequest.js'

const passwordRules = body('password')
  .isString()
  .isLength({ min: 8 })
  .withMessage('Password must be at least 8 characters')
  .matches(/[a-z]/)
  .withMessage('Password must contain a lowercase letter')
  .matches(/[A-Z]/)
  .withMessage('Password must contain an uppercase letter')
  .matches(/[0-9]/)
  .withMessage('Password must contain a number')

export const createTeacherValidator = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }),
  body('email').trim().notEmpty().withMessage('Email is required').isEmail().withMessage('Invalid email').normalizeEmail(),
  passwordRules,
  body('employeeId').trim().notEmpty().withMessage('Employee ID is required').isLength({ max: 30 }),
  body('department').optional({ checkFalsy: true }).trim().isLength({ max: 100 }),
  body('designation').optional({ checkFalsy: true }).trim().isLength({ max: 100 }),
  validate,
]

export const updateTeacherValidator = [
  body('name').optional({ checkFalsy: true }).trim().isLength({ max: 100 }),
  body('email').optional({ checkFalsy: true }).trim().isEmail().withMessage('Invalid email').normalizeEmail(),
  body('employeeId').optional({ checkFalsy: true }).trim().isLength({ max: 30 }),
  body('department').optional({ checkFalsy: true }).trim().isLength({ max: 100 }),
  body('designation').optional({ checkFalsy: true }).trim().isLength({ max: 100 }),
  validate,
]

export const updateStatusValidator = [
  body('isActive').isBoolean().withMessage('isActive must be true or false').toBoolean(),
  validate,
]
