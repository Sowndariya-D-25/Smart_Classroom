import mongoose from 'mongoose'

const { Schema } = mongoose

/**
 * A physical room. `hasCamera` / `cameraId` are placeholders wired up for
 * the Computer Vision attendance flow in Phase 7 — no hardware integration
 * happens here, they're just fields a room can be tagged with.
 */
const classroomSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Classroom name is required'],
      trim: true,
      maxlength: [100, 'Classroom name cannot exceed 100 characters'],
    },
    code: {
      type: String,
      required: [true, 'Classroom code is required'],
      unique: true,
      trim: true,
      uppercase: true,
      maxlength: [20, 'Classroom code cannot exceed 20 characters'],
    },
    building: {
      type: String,
      trim: true,
      maxlength: [100, 'Building name cannot exceed 100 characters'],
    },
    floor: {
      type: Number,
      min: [-2, 'Floor value looks unrealistic'],
      max: [100, 'Floor value looks unrealistic'],
    },
    capacity: {
      type: Number,
      required: [true, 'Capacity is required'],
      min: [1, 'Capacity must be a positive number'],
    },
    roomNumber: {
      type: String,
      trim: true,
      maxlength: [20, 'Room number cannot exceed 20 characters'],
    },
    hasCamera: {
      type: Boolean,
      default: false,
    },
    cameraId: {
      // Free-form identifier for whichever camera/device is mounted in the
      // room. Not validated further until Phase 7 defines the CV service.
      type: String,
      trim: true,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
)

classroomSchema.index({ roomNumber: 1 })

const Classroom = mongoose.model('Classroom', classroomSchema)

export default Classroom
