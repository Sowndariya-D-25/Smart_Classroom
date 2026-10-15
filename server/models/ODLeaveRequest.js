import mongoose from 'mongoose'

const { Schema } = mongoose

const REQUEST_TYPES = ['OD', 'Leave']
const REQUEST_STATUSES = ['Pending', 'Approved', 'Rejected']

const odLeaveRequestSchema = new Schema(
  {
    student: {
      type: Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'Request must reference a student'],
      index: true,
    },
    type: {
      type: String,
      enum: {
        values: REQUEST_TYPES,
        message: '{VALUE} is not a valid request type',
      },
      required: [true, 'Request type is required (OD or Leave)'],
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
    },
    endDate: {
      type: Date,
      required: [true, 'End date is required'],
    },
    subjects: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Subject',
      },
    ],
    reason: {
      type: String,
      required: [true, 'Reason is required'],
      trim: true,
      minlength: [3, 'Reason must be at least 3 characters'],
      maxlength: [1000, 'Reason cannot exceed 1000 characters'],
    },
    documentUrl: {
      type: String,
      trim: true,
      default: null,
    },
    documentName: {
      type: String,
      trim: true,
      default: null,
    },
    status: {
      type: String,
      enum: {
        values: REQUEST_STATUSES,
        message: '{VALUE} is not a valid request status',
      },
      default: 'Pending',
      index: true,
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewerRole: {
      type: String,
      enum: ['teacher', 'admin', null],
      default: null,
    },
    reviewerRemarks: {
      type: String,
      trim: true,
      maxlength: [1000, 'Reviewer remarks cannot exceed 1000 characters'],
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    attendancePolicy: {
      type: String,
      default: 'COUNT_AS_PRESENT',
    },
    appliedSessions: [
      {
        type: Schema.Types.ObjectId,
        ref: 'AttendanceSession',
      },
    ],
  },
  { timestamps: true },
)

odLeaveRequestSchema.index({ student: 1, createdAt: -1 })
odLeaveRequestSchema.index({ status: 1, type: 1 })
odLeaveRequestSchema.index({ startDate: 1, endDate: 1 })

export const OD_LEAVE_TYPES = REQUEST_TYPES
export const OD_LEAVE_STATUSES = REQUEST_STATUSES

const ODLeaveRequest = mongoose.model('ODLeaveRequest', odLeaveRequestSchema)

export default ODLeaveRequest
