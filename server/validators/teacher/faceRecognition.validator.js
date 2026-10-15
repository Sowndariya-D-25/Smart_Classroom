import { body } from 'express-validator'
import { validate } from '../../utils/validateRequest.js'
import { isValidDescriptor, DESCRIPTOR_LENGTH } from './faceProfile.validator.js'

export const recognizeFaceValidator = [
  body('descriptor')
    .custom(isValidDescriptor)
    .withMessage(`descriptor must be an array of exactly ${DESCRIPTOR_LENGTH} finite numbers`),
  body('commit').optional().isBoolean().withMessage('commit must be a boolean'),
  validate,
]

