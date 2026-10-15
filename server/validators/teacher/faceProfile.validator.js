import { body } from 'express-validator'
import { validate } from '../../utils/validateRequest.js'

export const DESCRIPTOR_LENGTH = 128 // face-api.js's face_recognition_model output size

// A single descriptor: exactly 128 finite numbers, never NaN/Infinity,
// never trusted blindly just because it "looks like an array" — every
// element is checked. Shared with faceRecognition.validator.js.
export const isValidDescriptor = (value) =>
  Array.isArray(value) &&
  value.length === DESCRIPTOR_LENGTH &&
  value.every((n) => typeof n === 'number' && Number.isFinite(n))

export const registerFaceValidator = [
  body('student').isMongoId().withMessage('A valid student ID is required'),
  body('descriptors')
    .isArray({ min: 1, max: 10 })
    .withMessage('At least one face sample is required (max 10)')
    .custom((descriptors) => descriptors.every(isValidDescriptor))
    .withMessage(`Each face sample must be an array of exactly ${DESCRIPTOR_LENGTH} finite numbers`),
  validate,
]
