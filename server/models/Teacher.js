import mongoose from 'mongoose'

const { Schema } = mongoose

const teacherSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Teacher must be linked to a user account'],
      unique: true,
    },
    employeeId: {
      type: String,
      required: [true, 'Employee ID is required'],
      unique: true,
      trim: true,
      uppercase: true,
      maxlength: [30, 'Employee ID cannot exceed 30 characters'],
    },
    department: {
      type: String,
      trim: true,
      maxlength: [100, 'Department name cannot exceed 100 characters'],
    },
    designation: {
      type: String,
      trim: true,
      maxlength: [100, 'Designation cannot exceed 100 characters'],
      default: 'Assistant Professor',
    },
    phone: {
      type: String,
      trim: true,
      maxlength: [20, 'Phone number looks too long'],
    },
    subjects: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Subject',
      },
    ],
    assignments: [
      {
        year: { type: Number, default: 1 },
        department: { type: String, trim: true },
        section: { type: String, trim: true, uppercase: true, default: 'A' },
        subject: { type: Schema.Types.ObjectId, ref: 'Subject' },
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
)

teacherSchema.index({ subjects: 1 })

const Teacher = mongoose.model('Teacher', teacherSchema)

export default Teacher
