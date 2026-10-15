import { body } from 'express-validator'
import { validate } from '../../utils/validateRequest.js'

export const createSessionValidator = [
  body('subject').isMongoId().withMessage('A valid subject must be selected'),
  body('classroom').optional({ checkFalsy: true }).isMongoId().withMessage('A valid classroom must be selected'),
  body('department').optional({ checkFalsy: true }).trim().isLength({ max: 100 }),
  body('section').optional({ checkFalsy: true }).trim().isLength({ max: 10 }),
  body('date')
    .isISO8601()
    .withMessage('A valid date is required')
    .custom((value) => {
      const d = new Date(value)
      if (isNaN(d.getTime())) {
        throw new Error('Invalid date format')
      }
      const year = d.getFullYear()
      const now = new Date()
      if (year < 2020 || year > now.getFullYear() + 1) {
        throw new Error('Session date is outside a realistic academic schedule range')
      }
      return true
    })
    .toDate(),
  body('period').isInt({ min: 1, max: 20 }).withMessage('Period must be between 1 and 20'),
  body('startTime').optional({ checkFalsy: true }).matches(/^([01]\d|2[0-3]):([0-5]\d)$/).withMessage('startTime must be in HH:MM format'),
  body('endTime')
    .optional({ checkFalsy: true })
    .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .withMessage('endTime must be in HH:MM format')
    .custom((endTime, { req }) => {
      if (req.body.startTime && endTime <= req.body.startTime) {
        throw new Error('endTime must be later than startTime')
      }
      return true
    }),
  validate,
]

export const markAttendanceValidator = [
  body('records').isArray({ min: 1 }).withMessage('At least one attendance record is required'),
  body('records.*.student').isMongoId().withMessage('Invalid student ID'),
  body('records.*.status').isIn(['Present', 'Absent', 'Late']).withMessage('Status must be Present, Absent, or Late'),
  body('records.*.remarks').optional({ checkFalsy: true }).trim().isLength({ max: 500 }),
  validate,
]
