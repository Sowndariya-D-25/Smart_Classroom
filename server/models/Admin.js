import mongoose from 'mongoose'

const { Schema } = mongoose

const PERMISSIONS = [
  'manage_students',
  'manage_teachers',
  'manage_subjects',
  'manage_classrooms',
  'manage_courses',
  'manage_timetable',
  'view_attendance',
  'view_analytics',
  'generate_reports',
  'manage_settings',
]

const adminSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Admin must be linked to a user account'],
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
    permissions: {
      type: [String],
      enum: {
        values: PERMISSIONS,
        message: '{VALUE} is not a recognized permission',
      },
      default: PERMISSIONS, // a seeded/primary admin gets full access by default
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
)



export const ADMIN_PERMISSIONS = PERMISSIONS

const Admin = mongoose.model('Admin', adminSchema)

export default Admin
