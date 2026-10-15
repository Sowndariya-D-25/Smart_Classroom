import { body } from 'express-validator'
import { validate } from '../../utils/validateRequest.js'

export const createCourseValidator = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 150 }),
  body('code').trim().notEmpty().withMessage('Course code is required').isLength({ max: 20 }),
  body('department').optional({ checkFalsy: true }).trim().isLength({ max: 100 }),
  body('duration').optional({ checkFalsy: true }).isInt({ min: 1, max: 10 }).withMessage('Duration must be between 1 and 10 years'),
  body('description').optional({ checkFalsy: true }).trim().isLength({ max: 1000 }),
  validate,
]

export const updateCourseValidator = [
  body('name').optional({ checkFalsy: true }).trim().isLength({ max: 150 }),
  body('code').optional({ checkFalsy: true }).trim().isLength({ max: 20 }),
  body('department').optional({ checkFalsy: true }).trim().isLength({ max: 100 }),
  body('duration').optional({ checkFalsy: true }).isInt({ min: 1, max: 10 }),
  body('description').optional({ checkFalsy: true }).trim().isLength({ max: 1000 }),
  validate,
]

export const updateStatusValidator = [
  body('isActive').isBoolean().withMessage('isActive must be true or false').toBoolean(),
  validate,
]
