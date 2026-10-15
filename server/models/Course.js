import mongoose from 'mongoose'

const { Schema } = mongoose

/**
 * Academic program a student is enrolled in, e.g. "B.E. Computer Science
 * and Engineering". Subjects and Students both reference a Course.
 */
const courseSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Course name is required'],
      trim: true,
      maxlength: [150, 'Course name cannot exceed 150 characters'],
    },
    code: {
      type: String,
      required: [true, 'Course code is required'],
      unique: true,
      trim: true,
      uppercase: true,
      maxlength: [20, 'Course code cannot exceed 20 characters'],
    },
    department: {
      type: String,
      trim: true,
      maxlength: [100, 'Department name cannot exceed 100 characters'],
    },
    duration: {
      // Duration in years, e.g. 4 for a B.E./B.Tech program.
      type: Number,
      min: [1, 'Duration must be at least 1 year'],
      max: [10, 'Duration looks unrealistic'],
      default: 4,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
)

courseSchema.index({ department: 1 })

const Course = mongoose.model('Course', courseSchema)

export default Course
