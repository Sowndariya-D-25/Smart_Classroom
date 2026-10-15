import mongoose from 'mongoose'

const { Schema } = mongoose

/**
 * Stores face **descriptors** (numeric vectors produced by a face
 * embedding model, e.g. face-api.js's 128-length descriptor) — never raw
 * photographs. One document per student; re-registering overwrites
 * `descriptors` in place rather than creating a new document, which is
 * why `student` is unique below.
 *
 * Actual capture/matching logic is implemented in Phase 7. This model
 * only defines where that data lives.
 */
const faceProfileSchema = new Schema(
  {
    student: {
      type: Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'Face profile must reference a student'],
      unique: true,
    },
    descriptors: {
      // Array of descriptor vectors, one per captured sample, e.g.
      // [[0.123, -0.456, ...], [0.234, -0.123, ...]]
      type: [[Number]],
      default: [],
      validate: {
        validator: (arr) => Array.isArray(arr),
        message: 'descriptors must be an array of numeric vectors',
      },
    },
    modelVersion: {
      // Identifies which face-embedding model produced these descriptors,
      // so old descriptors aren't compared against a newer/incompatible model.
      type: String,
      trim: true,
      default: 'face-api-tiny-v1',
    },
    sampleCount: {
      type: Number,
      default: 0,
      min: [0, 'sampleCount cannot be negative'],
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
)



// Keep sampleCount and lastUpdated consistent with descriptors automatically.
faceProfileSchema.pre('save', function () {
  if (this.isModified('descriptors')) {
    this.sampleCount = this.descriptors.length
    this.lastUpdated = new Date()
  }
})

const FaceProfile = mongoose.model('FaceProfile', faceProfileSchema)

export default FaceProfile
