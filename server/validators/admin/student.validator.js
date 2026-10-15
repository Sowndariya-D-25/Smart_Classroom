import { body, query } from 'express-validator'
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

export const createStudentValidator = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }),
  body('email').trim().notEmpty().withMessage('Email is required').isEmail().withMessage('Invalid email').normalizeEmail(),
  passwordRules,
  body('studentId').trim().notEmpty().withMessage('Student ID is required').isLength({ max: 30 }),
  body('rollNumber').trim().notEmpty().withMessage('Roll number is required').isLength({ max: 20 }),
  body('course').isMongoId().withMessage('A valid course must be selected'),
  body('department').trim().notEmpty().withMessage('Department is required').isLength({ max: 100 }),
  body('year').optional({ checkFalsy: true }).isInt({ min: 1, max: 10 }).withMessage('Year must be between 1 and 10'),
  body('section').trim().notEmpty().withMessage('Section is required').isLength({ max: 10 }),
  body('gender').optional({ checkFalsy: true }).isIn(['Male', 'Female', 'Other']),
  validate,
]

export const updateStudentValidator = [
  body('name').optional({ checkFalsy: true }).trim().isLength({ max: 100 }),
  body('email').optional({ checkFalsy: true }).trim().isEmail().withMessage('Invalid email').normalizeEmail(),
  body('studentId').optional({ checkFalsy: true }).trim().isLength({ max: 30 }),
  body('course').optional({ checkFalsy: true }).isMongoId().withMessage('Invalid course'),
  body('department').optional({ checkFalsy: true }).trim().isLength({ max: 100 }),
  body('year').optional({ checkFalsy: true }).isInt({ min: 1, max: 10 }),
  body('section').optional({ checkFalsy: true }).trim().isLength({ max: 10 }),
  body('gender').optional({ checkFalsy: true }).isIn(['Male', 'Female', 'Other']),
  validate,
]

export const updateStatusValidator = [
  body('isActive').isBoolean().withMessage('isActive must be true or false').toBoolean(),
  validate,
]

export const listStudentsValidator = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('year').optional().isInt({ min: 1, max: 10 }),
  query('status').optional().isIn(['active', 'inactive']),
  validate,
]
