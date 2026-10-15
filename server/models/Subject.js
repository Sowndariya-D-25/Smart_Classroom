import mongoose from 'mongoose'

const { Schema } = mongoose

/**
 * A subject taught within a Course, e.g. "Data Structures" under
 * "B.E. Computer Science". One or more Teachers can be assigned to it.
 */
const subjectSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Subject name is required'],
      trim: true,
      maxlength: [150, 'Subject name cannot exceed 150 characters'],
    },
    code: {
      type: String,
      required: [true, 'Subject code is required'],
      unique: true,
      trim: true,
      uppercase: true,
      maxlength: [20, 'Subject code cannot exceed 20 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
    },
    credits: {
      type: Number,
      required: [true, 'Credits are required'],
      min: [0, 'Credits cannot be negative'],
      max: [20, 'Credits value looks unrealistic'],
    },
    department: {
      type: String,
      trim: true,
      maxlength: [100, 'Department name cannot exceed 100 characters'],
    },
    semester: {
      type: Number,
      required: [true, 'Semester is required'],
      min: [1, 'Semester must be at least 1'],
      max: [12, 'Semester value looks unrealistic'],
    },
    teachers: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Teacher',
      },
    ],
    course: {
      type: Schema.Types.ObjectId,
      ref: 'Course',
      required: [true, 'Subject must belong to a course'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
)

subjectSchema.index({ course: 1 })
subjectSchema.index({ semester: 1 })
subjectSchema.index({ teachers: 1 })

const Subject = mongoose.model('Subject', subjectSchema)

export default Subject
