import mongoose from 'mongoose'

const { Schema } = mongoose

const NOTIFICATION_TYPES = [
  'LOW_ATTENDANCE',
  'ATTENDANCE_MARKED',
  'FACE_RECOGNITION',
  'STUDENT_REGISTRATION',
  'CLASS_REMINDER',
  'ANNOUNCEMENT',
  'SYSTEM',
  'OD_REQUEST',
  'LEAVE_REQUEST',
  'OD_LEAVE_DECISION',
]

const notificationSchema = new Schema(
  {
    recipient: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Notification must have a recipient'],
    },
    title: {
      type: String,
      required: [true, 'Notification title is required'],
      trim: true,
      maxlength: [150, 'Title cannot exceed 150 characters'],
    },
    message: {
      type: String,
      required: [true, 'Notification message is required'],
      trim: true,
      maxlength: [1000, 'Message cannot exceed 1000 characters'],
    },
    type: {
      type: String,
      enum: {
        values: NOTIFICATION_TYPES,
        message: '{VALUE} is not a valid notification type',
      },
      required: [true, 'Notification type is required'],
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    link: {
      // Frontend route the notification should deep-link to, e.g. "/student/attendance"
      type: String,
      trim: true,
      default: null,
    },
    metadata: {
      // Free-form extra context (e.g. { subjectId, percentage } for a
      // LOW_ATTENDANCE alert) — intentionally loose since it varies by type.
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true },
)

notificationSchema.index({ recipient: 1 })
notificationSchema.index({ isRead: 1 })
notificationSchema.index({ createdAt: -1 })
notificationSchema.index({ recipient: 1, isRead: 1 })

export const NOTIFICATION_TYPES_LIST = NOTIFICATION_TYPES

const Notification = mongoose.model('Notification', notificationSchema)

export default Notification
