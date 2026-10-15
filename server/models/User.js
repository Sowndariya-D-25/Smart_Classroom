import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

const { Schema } = mongoose

/**
 * Base authentication identity shared by every role. Role-specific data
 * (studentId, employeeId, permissions, ...) lives in Student / Teacher /
 * Admin, each of which references back to a User via `user`.
 *
 * Auth logic (login, JWT issuing, password comparison) is implemented in
 * Phase 3 — this model only defines the shape and the constraints Phase 3
 * will rely on.
 */
const userSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      // Never returned by default (e.g. GET /students populating `user`).
      // Phase 3's auth controller explicitly .select('+password') at login.
      select: false,
    },
    role: {
      type: String,
      enum: {
        values: ['admin', 'teacher', 'student'],
        message: '{VALUE} is not a valid role',
      },
      required: [true, 'Role is required'],
    },
    phone: {
      type: String,
      trim: true,
      maxlength: [20, 'Phone number looks too long'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
      default: null,
    },
    tokenVersion: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
)

// Fast lookups by role (e.g. "list all teachers' users"). Email unique index is defined on schema field.
userSchema.index({ role: 1 })

// Defence in depth: even if a route forgets to strip it, password never
// serializes over the wire.
userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.password
    return ret
  },
})

// Hash the password whenever it's set/changed — the single place this
// happens, so controllers and the seed script only ever assign a plain
// password and never hash it themselves (which would double-hash it).
userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) {
    return
  }

  const salt = await bcrypt.genSalt(10)
  this.password = await bcrypt.hash(this.password, salt)
})

// Requires the document to have been fetched with .select('+password').
userSchema.methods.comparePassword = function comparePassword(candidatePassword) {
  if (!candidatePassword || !this.password) {
    return Promise.resolve(false)
  }
  return bcrypt.compare(candidatePassword, this.password)
}

const User = mongoose.model('User', userSchema)

export default User
