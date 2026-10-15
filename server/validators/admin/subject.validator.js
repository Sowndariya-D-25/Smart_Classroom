import { body } from 'express-validator'
import { validate } from '../../utils/validateRequest.js'

export const createSubjectValidator = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 150 }),
  body('code').trim().notEmpty().withMessage('Subject code is required').isLength({ max: 20 }),
  body('credits').isFloat({ min: 0, max: 20 }).withMessage('Credits must be between 0 and 20'),
  body('semester').isInt({ min: 1, max: 12 }).withMessage('Semester must be between 1 and 12'),
  body('course').isMongoId().withMessage('A valid course must be selected'),
  body('department').optional({ checkFalsy: true }).trim().isLength({ max: 100 }),
  body('description').optional({ checkFalsy: true }).trim().isLength({ max: 1000 }),
  body('teachers').optional().isArray().withMessage('teachers must be an array of teacher IDs'),
  body('teachers.*').optional().isMongoId().withMessage('Invalid teacher ID'),
  validate,
]

export const updateSubjectValidator = [
  body('name').optional({ checkFalsy: true }).trim().isLength({ max: 150 }),
  body('code').optional({ checkFalsy: true }).trim().isLength({ max: 20 }),
  body('credits').optional().isFloat({ min: 0, max: 20 }),
  body('semester').optional().isInt({ min: 1, max: 12 }),
  body('course').optional({ checkFalsy: true }).isMongoId(),
  body('department').optional({ checkFalsy: true }).trim().isLength({ max: 100 }),
  body('description').optional({ checkFalsy: true }).trim().isLength({ max: 1000 }),
  body('teachers').optional().isArray(),
  body('teachers.*').optional().isMongoId(),
  validate,
]

export const updateStatusValidator = [
  body('isActive').isBoolean().withMessage('isActive must be true or false').toBoolean(),
  validate,
]
