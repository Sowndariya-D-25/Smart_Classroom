import mongoose from 'mongoose'

const { Schema } = mongoose

const SESSION_STATUSES = ['Scheduled', 'Active', 'Completed', 'Cancelled']

// A lightweight, non-identifying summary of one unrecognized face sighting
// during a session — not a stored photo, just enough for the teacher's UI
// to say "3 unknown faces detected" and let them handle it manually.
const unknownFaceSchema = new Schema(
  {
    count: {
      type: Number,
      default: 1,
      min: [1, 'count must be at least 1'],
    },
    confidence: {
      type: Number,
      min: [0, 'confidence cannot be below 0'],
      max: [1, 'confidence cannot be above 1'],
    },
    detectedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
)

/**
 * One camera-based (or manual) attendance-taking event for a
 * subject/classroom/period. Individual Attendance records reference the
 * session they were marked in.
 */
const attendanceSessionSchema = new Schema(
  {
    teacher: {
      type: Schema.Types.ObjectId,
      ref: 'Teacher',
      required: [true, 'Session must reference a teacher'],
    },
    subject: {
      type: Schema.Types.ObjectId,
      ref: 'Subject',
      required: [true, 'Session must reference a subject'],
    },
    classroom: {
      type: Schema.Types.ObjectId,
      ref: 'Classroom',
      required: false,
      default: null,
    },
    department: {
      type: String,
      trim: true,
      maxlength: [100, 'Department cannot exceed 100 characters'],
    },
    section: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: [10, 'Section cannot exceed 10 characters'],
    },
    date: {
      type: Date,
      required: [true, 'Session date is required'],
    },
    period: {
      type: Number,
      min: [1, 'Period must be at least 1'],
      max: [20, 'Period value looks unrealistic'],
    },
    startTime: {
      type: String,
      match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'startTime must be in HH:MM 24-hour format'],
    },
    endTime: {
      type: String,
      match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'endTime must be in HH:MM 24-hour format'],
    },
    status: {
      type: String,
      enum: {
        values: SESSION_STATUSES,
        message: '{VALUE} is not a valid session status',
      },
      default: 'Scheduled',
    },
    detectedStudents: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Student',
      },
    ],
    unknownFaces: [unknownFaceSchema],
    notes: {
      type: String,
      trim: true,
      maxlength: [1000, 'Notes cannot exceed 1000 characters'],
    },
  },
  { timestamps: true },
)

attendanceSessionSchema.index({ teacher: 1 })
attendanceSessionSchema.index({ subject: 1 })
attendanceSessionSchema.index({ classroom: 1 })
attendanceSessionSchema.index({ date: 1 })
attendanceSessionSchema.index({ status: 1 })

export const ATTENDANCE_SESSION_STATUSES = SESSION_STATUSES

const AttendanceSession = mongoose.model('AttendanceSession', attendanceSessionSchema)

export default AttendanceSession
