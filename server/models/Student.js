import mongoose from 'mongoose'

const { Schema } = mongoose

/**
 * Role-specific profile for a student. Auth fields (email/password) stay
 * on User; this model only holds academic data and a 1:1 link to it.
 */
const studentSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Student must be linked to a user account'],
      unique: true,
    },
    studentId: {
      type: String,
      required: [true, 'Student ID is required'],
      unique: true,
      trim: true,
      uppercase: true,
      maxlength: [30, 'Student ID cannot exceed 30 characters'],
    },
    rollNumber: {
      type: String,
      required: [true, 'Roll number is required'],
      trim: true,
      maxlength: [20, 'Roll number cannot exceed 20 characters'],
    },
    department: {
      type: String,
      trim: true,
      maxlength: [100, 'Department name cannot exceed 100 characters'],
    },
    year: {
      type: Number,
      min: [1, 'Year must be at least 1'],
      max: [10, 'Year value looks unrealistic'],
    },
    section: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: [10, 'Section cannot exceed 10 characters'],
    },
    course: {
      type: Schema.Types.ObjectId,
      ref: 'Course',
      required: [true, 'Student must belong to a course'],
    },
    classroom: {
      type: Schema.Types.ObjectId,
      ref: 'Classroom',
      default: null,
    },
    phone: {
      type: String,
      trim: true,
      maxlength: [20, 'Phone number looks too long'],
    },
    dateOfBirth: {
      type: Date,
    },
    gender: {
      type: String,
      enum: {
        values: ['Male', 'Female', 'Other'],
        message: '{VALUE} is not a valid gender option',
      },
    },
    faceProfile: {
      type: Schema.Types.ObjectId,
      ref: 'FaceProfile',
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
)

studentSchema.index({ course: 1, section: 1 })
// Roll numbers are typically only unique within a course (two different
// courses can both have a "roll no. 1"), so scope the uniqueness rather
// than making rollNumber globally unique.
studentSchema.index({ course: 1, rollNumber: 1 }, { unique: true })

const Student = mongoose.model('Student', studentSchema)

export default Student
