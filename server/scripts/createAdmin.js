import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import mongoose from 'mongoose'
import User from '../models/User.js'
import Admin from '../models/Admin.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.resolve(__dirname, '../.env') })
if (!process.env.MONGO_URI) {
  dotenv.config({ path: path.resolve(__dirname, '../../.env') })
}

const ADMIN_NAME = 'Admin'
const ADMIN_EMAIL = 'admin123@gmail.com'
const ADMIN_PASSWORD = 'admin@123'

async function createAdmin() {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/smart-classroom'

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 })
  } catch (err) {
    console.error('Failed to connect to MongoDB:', err.message)
    process.exit(1)
  }

  try {
    // 1. Check whether this email already exists in User/Admin architecture
    const existingUser = await User.findOne({ email: ADMIN_EMAIL.toLowerCase() })

    if (existingUser) {
      console.log(`Admin account already exists for ${ADMIN_EMAIL}.`)
      console.log('No existing data was changed.')
      await mongoose.disconnect()
      process.exit(0)
    }

    // 2. Create User account (User.pre('save') handles bcrypt hashing)
    const user = await User.create({
      name: ADMIN_NAME,
      email: ADMIN_EMAIL.toLowerCase(),
      password: ADMIN_PASSWORD,
      role: 'admin',
    })

    // 3. Determine unique employee ID for Admin profile
    let employeeId = 'ADM-001'
    const existingEmp = await Admin.findOne({ employeeId })
    if (existingEmp) {
      const count = await Admin.countDocuments()
      employeeId = `ADM-${String(count + 1).padStart(3, '0')}`
    }

    // 4. Create linked Admin profile
    await Admin.create({
      user: user._id,
      employeeId,
      department: 'CSE',
    })

    console.log('Admin account created successfully.')
    console.log('You can now login from the existing Admin login page.')

    await mongoose.disconnect()
    process.exit(0)
  } catch (err) {
    console.error('Error creating admin account:', err.message)
    await mongoose.disconnect()
    process.exit(1)
  }
}

createAdmin()
