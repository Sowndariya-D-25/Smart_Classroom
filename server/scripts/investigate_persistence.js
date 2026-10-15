import mongoose from 'mongoose'
import dotenv from 'dotenv'
dotenv.config()

async function main() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/smart-classroom')
  const { Student, User, Course, FaceProfile, Subject, AttendanceSession, Timetable, Teacher } = await import('../models/index.js')

  console.log('--- Connected DB ---')
  console.log('DB Name:', mongoose.connection.name)
  console.log('DB Host:', mongoose.connection.host)
  console.log('DB Port:', mongoose.connection.port)

  const courses = await Course.find()
  for (const c of courses) {
    console.log(`Course: ${c.code} (${c.name}) | Created: ${c.createdAt?.toISOString()} | ID: ${c._id}`)
  }

  const allStudents = await Student.find().populate('user', 'name email createdAt').sort({ createdAt: -1 })
  console.log(`\nTotal Students in DB: ${allStudents.length}`)
  
  for (const s of allStudents) {
    const fp = await FaceProfile.findOne({ student: s._id })
    console.log(`Student ID: ${s.studentId} | Name: ${s.user?.name} | Created: ${s.createdAt?.toISOString()} | Sec: ${s.section} | FP Exists: ${Boolean(fp)} | FP Samples: ${fp?.sampleCount || 0} | FP Created: ${fp?.createdAt?.toISOString()} | FP Updated: ${fp?.updatedAt?.toISOString()}`)
  }

  // Check MongoDB server build info and storage engine
  const adminDb = mongoose.connection.db.admin()
  const serverStatus = await adminDb.serverStatus()
  console.log('\n--- MongoDB Server Status ---')
  console.log('MongoDB Version:', serverStatus.version)
  console.log('Storage Engine:', serverStatus.storageEngine?.name)
  console.log('Uptime (seconds):', serverStatus.uptime)

  await mongoose.disconnect()
}

main().catch(console.error)
