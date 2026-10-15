import mongoose from 'mongoose'

const { Schema } = mongoose

const ATTENDANCE_STATUSES = ['Present', 'Absent', 'Late', 'OD', 'Leave']
const ATTENDANCE_METHODS = ['Face Recognition', 'Manual', 'FACE', 'MANUAL']

/**
 * One student's attendance record for one session. Confidence is stored
 * as a 0–1 probability (not 0–100) — face-api.js's match distance is
 * naturally converted to a 0–1 score, so the whole app standardizes on
 * that scale. `method: 'Manual'` records simply omit confidence.
 */
const attendanceSchema = new Schema(
  {
    student: {
      type: Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'Attendance must reference a student'],
    },
    subject: {
      type: Schema.Types.ObjectId,
      ref: 'Subject',
      required: [true, 'Attendance must reference a subject'],
    },
    teacher: {
      type: Schema.Types.ObjectId,
      ref: 'Teacher',
      required: [true, 'Attendance must reference a teacher'],
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
    session: {
      type: Schema.Types.ObjectId,
      ref: 'AttendanceSession',
      required: [true, 'Attendance must reference a session'],
    },
    date: {
      type: Date,
      required: [true, 'Attendance date is required'],
    },
    period: {
      type: Number,
      min: [1, 'Period must be at least 1'],
      max: [20, 'Period value looks unrealistic'],
    },
    status: {
      type: String,
      enum: {
        values: ATTENDANCE_STATUSES,
        message: '{VALUE} is not a valid attendance status',
      },
      required: [true, 'Attendance status is required'],
      default: 'Present',
    },
    markedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Attendance must record who marked it'],
    },
    method: {
      type: String,
      enum: {
        values: ATTENDANCE_METHODS,
        message: '{VALUE} is not a valid attendance method',
      },
      required: [true, 'Attendance method is required'],
      default: 'Manual',
    },
    confidence: {
      // 0-1 scale. Only meaningful when method === 'Face Recognition'.
      type: Number,
      min: [0, 'confidence cannot be below 0'],
      max: [1, 'confidence cannot be above 1'],
      default: null,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    remarks: {
      type: String,
      trim: true,
      maxlength: [500, 'Remarks cannot exceed 500 characters'],
    },
    originalStatus: {
      type: String,
      enum: ['Present', 'Absent', 'Late', null],
      default: null,
    },
    odLeaveRequest: {
      type: Schema.Types.ObjectId,
      ref: 'ODLeaveRequest',
      default: null,
    },
  },
  { timestamps: true },
)

// THE critical constraint: a student can only have one attendance record
// per session. This is enforced by MongoDB itself, not just app logic.
attendanceSchema.index({ student: 1, session: 1 }, { unique: true })

attendanceSchema.index({ student: 1 })
attendanceSchema.index({ subject: 1 })
attendanceSchema.index({ teacher: 1 })
attendanceSchema.index({ date: 1 })
attendanceSchema.index({ status: 1 })
// Common analytics query: "this student's attendance in this subject over time"
attendanceSchema.index({ student: 1, subject: 1, date: 1 })

export const ATTENDANCE_STATUSES_LIST = ATTENDANCE_STATUSES
export const ATTENDANCE_METHODS_LIST = ATTENDANCE_METHODS

const Attendance = mongoose.model('Attendance', attendanceSchema)

export default Attendance
