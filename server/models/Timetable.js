import mongoose from 'mongoose'

const { Schema } = mongoose

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// "HH:MM" in 24-hour format, e.g. "09:00" or "14:30".
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/

const timetableSchema = new Schema(
  {
    course: {
      type: Schema.Types.ObjectId,
      ref: 'Course',
    },
    subject: {
      type: Schema.Types.ObjectId,
      ref: 'Subject',
      required: [true, 'Timetable entry must reference a subject'],
    },
    teacher: {
      type: Schema.Types.ObjectId,
      ref: 'Teacher',
      required: [true, 'Timetable entry must reference a teacher'],
    },
    classroom: {
      type: Schema.Types.ObjectId,
      ref: 'Classroom',
      required: [true, 'Timetable entry must reference a classroom'],
    },
    dayOfWeek: {
      type: String,
      enum: {
        values: DAYS_OF_WEEK,
        message: '{VALUE} is not a valid day of week',
      },
      required: [true, 'Day of week is required'],
    },
    startTime: {
      type: String,
      required: [true, 'Start time is required'],
      match: [TIME_PATTERN, 'startTime must be in HH:MM 24-hour format'],
    },
    endTime: {
      type: String,
      required: [true, 'End time is required'],
      match: [TIME_PATTERN, 'endTime must be in HH:MM 24-hour format'],
      validate: {
        // String comparison works here because both values are validated
        // zero-padded HH:MM, so lexicographic order matches chronological order.
        validator: function (value) {
          return !this.startTime || value > this.startTime
        },
        message: 'endTime must be later than startTime',
      },
    },
    period: {
      type: Number,
      min: [1, 'Period must be at least 1'],
      max: [20, 'Period value looks unrealistic'],
    },
    semester: {
      type: Number,
      required: [true, 'Semester is required'],
      min: [1, 'Semester must be at least 1'],
      max: [12, 'Semester value looks unrealistic'],
    },
    academicYear: {
      type: String,
      required: [true, 'Academic year is required'],
      trim: true,
      match: [/^\d{4}-\d{4}$/, 'academicYear must look like "2026-2027"'],
    },
    section: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: [10, 'Section cannot exceed 10 characters'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
)

timetableSchema.index({ teacher: 1 })
timetableSchema.index({ classroom: 1 })
timetableSchema.index({ subject: 1 })
timetableSchema.index({ dayOfWeek: 1 })
timetableSchema.index({ semester: 1, academicYear: 1 })
// A teacher can't be in two classes at the same time slot on the same day.
timetableSchema.index(
  { teacher: 1, dayOfWeek: 1, startTime: 1, academicYear: 1 },
  { unique: true },
)

export const DAYS = DAYS_OF_WEEK

const Timetable = mongoose.model('Timetable', timetableSchema)

export default Timetable
