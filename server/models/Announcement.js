import mongoose from 'mongoose'

const { Schema } = mongoose

export const ANNOUNCEMENT_TYPES = ['Event', 'Holiday', 'Meeting', 'Exam', 'General', 'Urgent']
export const TARGET_AUDIENCES = ['All Teachers', 'All Students', 'All']

const announcementSchema = new Schema(
  {
    title: {
      type: String,
      required: [true, 'Announcement title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    message: {
      type: String,
      required: [true, 'Announcement message is required'],
      trim: true,
      maxlength: [5000, 'Message cannot exceed 5000 characters'],
    },
    type: {
      type: String,
      enum: {
        values: ANNOUNCEMENT_TYPES,
        message: '{VALUE} is not a valid announcement type',
      },
      default: 'General',
      required: [true, 'Announcement type is required'],
    },
    targetAudience: {
      type: String,
      enum: {
        values: TARGET_AUDIENCES,
        message: '{VALUE} is not a valid target audience',
      },
      default: 'All Teachers',
    },
    priority: {
      type: String,
      enum: ['Normal', 'High', 'Urgent'],
      default: 'Normal',
    },
    date: {
      type: String,
      trim: true,
      default: '',
    },
    time: {
      type: String,
      trim: true,
      default: '',
    },
    venue: {
      type: String,
      trim: true,
      default: '',
    },
    attachment: {
      type: String,
      trim: true,
      default: null,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Announcement must have a creator'],
    },
    isPublished: {
      type: Boolean,
      default: true,
    },
    publishedAt: {
      type: Date,
      default: Date.now,
    },
    // Array of user IDs who have marked or opened this announcement as read.
    // This guarantees per-teacher read receipt tracking.
    readBy: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  { timestamps: true },
)

announcementSchema.index({ targetAudience: 1, isPublished: 1 })
announcementSchema.index({ publishedAt: -1 })
announcementSchema.index({ createdAt: -1 })

const Announcement = mongoose.model('Announcement', announcementSchema)

export default Announcement
