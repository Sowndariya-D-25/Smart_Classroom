import { body } from 'express-validator'
import { validate } from '../../utils/validateRequest.js'

export const createClassroomValidator = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }),
  body('code').trim().notEmpty().withMessage('Classroom code is required').isLength({ max: 20 }),
  body('capacity').isInt({ min: 1 }).withMessage('Capacity must be a positive number'),
  body('building').optional({ checkFalsy: true }).trim().isLength({ max: 100 }),
  body('floor').optional({ checkFalsy: true }).isInt({ min: -2, max: 100 }),
  body('roomNumber').optional({ checkFalsy: true }).trim().isLength({ max: 20 }),
  body('hasCamera').optional().isBoolean().toBoolean(),
  body('cameraId').optional({ checkFalsy: true }).trim().isLength({ max: 100 }),
  validate,
]

export const updateClassroomValidator = [
  body('name').optional({ checkFalsy: true }).trim().isLength({ max: 100 }),
  body('code').optional({ checkFalsy: true }).trim().isLength({ max: 20 }),
  body('capacity').optional().isInt({ min: 1 }).withMessage('Capacity must be a positive number'),
  body('building').optional({ checkFalsy: true }).trim().isLength({ max: 100 }),
  body('floor').optional({ checkFalsy: true }).isInt({ min: -2, max: 100 }),
  body('roomNumber').optional({ checkFalsy: true }).trim().isLength({ max: 20 }),
  body('hasCamera').optional().isBoolean().toBoolean(),
  body('cameraId').optional({ checkFalsy: true }).trim().isLength({ max: 100 }),
  validate,
]

export const updateStatusValidator = [
  body('isActive').isBoolean().withMessage('isActive must be true or false').toBoolean(),
  validate,
]
