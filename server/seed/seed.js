import dotenv from 'dotenv'
dotenv.config()

import mongoose from 'mongoose'

import {
  User,
  Student,
  Teacher,
  Admin,
  Course,
  Subject,
  Classroom,
  Timetable,
  Attendance,
  AttendanceSession,
  FaceProfile,
  Notification,
} from '../models/index.js'

/**
 * Development/demo seed script.
 *
 * WHAT IT DOES
 *   1. Connects to MONGO_URI.
 *   2. Wipes the 12 collections this app owns (see COLLECTIONS_TO_CLEAR
 *      below) — nothing outside them is touched.
 *   3. Inserts a consistent demo dataset, respecting every reference
 *      (Students point at real Users/Courses, Attendance points at real
 *      Students/Sessions, etc.) so relational queries and the unique
 *      student+session index all work immediately after seeding.
 *
 * SAFETY
 *   Refuses to run when NODE_ENV=production, since step 2 is destructive.
 *   This script is meant for local/dev/demo databases only.
 *
 * USAGE
 *   npm run seed        (from project root or from /server)
 */

const DEMO_PASSWORD = 'Password123!'

const COLLECTIONS_TO_CLEAR = [
  Notification,
  FaceProfile,
  Attendance,
  AttendanceSession,
  Timetable,
  Subject,
  Classroom,
  Teacher,
  Student,
  Admin,
  Course,
  User,
]

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

const log = (msg) => console.log(`[seed] ${msg}`)

async function connect() {
  const uri = process.env.MONGO_URI
  if (!uri) {
    throw new Error('MONGO_URI is not set. Copy server/.env.example to server/.env first.')
  }
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 })
  log(`Connected to ${mongoose.connection.host}/${mongoose.connection.name}`)
}

async function clearDemoData() {
  log('Clearing existing data from app collections...')
  for (const Model of COLLECTIONS_TO_CLEAR) {
    await Model.deleteMany({})
  }
  log('Done clearing.')
}

async function createUser({ name, email, role, phone }) {
  // User.pre('save') hashes this automatically — pass the plain demo
  // password here, never a pre-hashed value (that would double-hash it).
  return User.create({ name, email, role, phone, password: DEMO_PASSWORD })
}

function randomBetween(min, max) {
  return Math.random() * (max - min) + min
}

function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(0, 0, 0, 0)
  return d
}

function fakeDescriptor() {
  // A 128-length vector, matching face-api.js's descriptor size, filled
  // with plausible small floats. Not a real embedding — just realistic
  // shape/scale for demo purposes until Phase 7 captures the real thing.
  return Array.from({ length: 128 }, () => Number(randomBetween(-0.3, 0.3).toFixed(6)))
}

async function seed() {
  await connect()
  await clearDemoData()

  // ---- Course ----
  const course = await Course.create({
    name: 'B.E. Computer Science and Engineering',
    code: 'CSE',
    department: 'Computer Science',
    duration: 4,
    description: 'Undergraduate program covering core computer science and software engineering.',
  })
  log('Created 1 course')

  // ---- Classrooms ----
  const classroomsData = [
    { name: 'Lecture Hall 1', code: 'CR-101', building: 'Main Block', floor: 1, capacity: 60, roomNumber: '101', hasCamera: true, cameraId: 'CAM-101' },
    { name: 'Lecture Hall 2', code: 'CR-102', building: 'Main Block', floor: 1, capacity: 60, roomNumber: '102', hasCamera: true, cameraId: 'CAM-102' },
    { name: 'Seminar Room', code: 'CR-103', building: 'Main Block', floor: 2, capacity: 40, roomNumber: '203', hasCamera: false },
  ]
  const classrooms = await Classroom.insertMany(classroomsData)
  log(`Created ${classrooms.length} classrooms`)

  // ---- Admin ----
  const adminUser = await createUser({
    name: 'Ava Administrator',
    email: 'admin@smartclassroom.local',
    role: 'admin',
    phone: '9000000001',
  })
  const admin = await Admin.create({
    user: adminUser._id,
    employeeId: 'ADM-001',
    department: 'Administration',
  })
  log('Created 1 admin')

  // ---- Teachers ----
  const teacherSeeds = [
    { name: 'Rahul Mehta', email: 'teacher1@smartclassroom.local', employeeId: 'TCH-001', department: 'Computer Science' },
    { name: 'Priya Nair', email: 'teacher2@smartclassroom.local', employeeId: 'TCH-002', department: 'Computer Science' },
    { name: 'Karthik Iyer', email: 'teacher3@smartclassroom.local', employeeId: 'TCH-003', department: 'Computer Science' },
  ]
  const teachers = []
  for (const t of teacherSeeds) {
    const user = await createUser({ name: t.name, email: t.email, role: 'teacher', phone: '9000000010' })
    const teacher = await Teacher.create({
      user: user._id,
      employeeId: t.employeeId,
      department: t.department,
      designation: 'Assistant Professor',
    })
    teachers.push(teacher)
  }
  log(`Created ${teachers.length} teachers`)

  // ---- Subjects (assigned round-robin to teachers) ----
  const subjectSeeds = [
    { name: 'Data Structures', code: 'CS201', credits: 4, semester: 3 },
    { name: 'Operating Systems', code: 'CS202', credits: 4, semester: 3 },
    { name: 'Database Systems', code: 'CS203', credits: 3, semester: 3 },
    { name: 'Computer Networks', code: 'CS204', credits: 3, semester: 4 },
    { name: 'Web Technologies', code: 'CS205', credits: 3, semester: 4 },
  ]
  const subjects = []
  for (let i = 0; i < subjectSeeds.length; i += 1) {
    const s = subjectSeeds[i]
    const assignedTeacher = teachers[i % teachers.length]
    const subject = await Subject.create({
      name: s.name,
      code: s.code,
      credits: s.credits,
      semester: s.semester,
      department: 'Computer Science',
      course: course._id,
      teachers: [assignedTeacher._id],
    })
    subjects.push(subject)
    assignedTeacher.subjects.push(subject._id)
    await assignedTeacher.save()
  }
  log(`Created ${subjects.length} subjects`)

  // ---- Students ----
  const students = []
  const genders = ['Male', 'Female', 'Other']
  for (let i = 1; i <= 20; i += 1) {
    const rollNumber = String(i).padStart(2, '0')
    const studentId = `STU${String(i).padStart(4, '0')}`
    const user = await createUser({
      name: `Student ${rollNumber}`,
      email: `student${i}@smartclassroom.local`,
      role: 'student',
      phone: '9000000100',
    })
    const student = await Student.create({
      user: user._id,
      studentId,
      rollNumber,
      department: 'Computer Science',
      year: 2,
      section: i <= 10 ? 'A' : 'B',
      course: course._id,
      gender: genders[i % genders.length],
      dateOfBirth: new Date(2006, i % 12, (i % 27) + 1),
    })
    students.push(student)
  }
  log(`Created ${students.length} students`)

  // ---- Face profiles (fake descriptors, ~70% of students "registered") ----
  let faceProfileCount = 0
  for (const student of students) {
    if (Math.random() > 0.3) {
      const descriptors = [fakeDescriptor(), fakeDescriptor(), fakeDescriptor()]
      const profile = await FaceProfile.create({
        student: student._id,
        descriptors,
        sampleCount: descriptors.length,
      })
      student.faceProfile = profile._id
      await student.save()
      faceProfileCount += 1
    }
  }
  log(`Created ${faceProfileCount} face profiles`)

  // ---- Timetable: one weekly slot per subject ----
  const startTimes = ['09:00', '10:00', '11:15', '13:00', '14:00']
  const timetableEntries = subjects.map((subject, i) => ({
    course: course._id,
    subject: subject._id,
    teacher: subject.teachers[0],
    classroom: classrooms[i % classrooms.length]._id,
    dayOfWeek: DAYS[i % DAYS.length],
    startTime: startTimes[i],
    endTime: `${String(Number(startTimes[i].split(':')[0]) + 1).padStart(2, '0')}:${startTimes[i].split(':')[1]}`,
    period: i + 1,
    semester: subject.semester,
    academicYear: '2026-2027',
    section: 'A',
  }))
  await Timetable.insertMany(timetableEntries)
  log(`Created ${timetableEntries.length} timetable entries`)

  // ---- Attendance sessions + attendance records ----
  // For each subject, 4 completed sessions on the last 4 matching weekdays.
  let sessionCount = 0
  let attendanceCount = 0
  for (let sIdx = 0; sIdx < subjects.length; sIdx += 1) {
    const subject = subjects[sIdx]
    const teacherId = subject.teachers[0]
    const teacherUser = teachers.find((t) => t._id.equals(teacherId))
    const classroom = classrooms[sIdx % classrooms.length]

    for (let offset = 1; offset <= 4; offset += 1) {
      const sessionDate = daysAgo(sIdx + offset * 2) // spread dates out
      const session = await AttendanceSession.create({
        teacher: teacherId,
        subject: subject._id,
        classroom: classroom._id,
        date: sessionDate,
        period: sIdx + 1,
        startTime: startTimes[sIdx],
        endTime: `${String(Number(startTimes[sIdx].split(':')[0]) + 1).padStart(2, '0')}:${startTimes[sIdx].split(':')[1]}`,
        status: 'Completed',
        unknownFaces:
          Math.random() > 0.6
            ? [{ count: Math.ceil(randomBetween(1, 3)), confidence: Number(randomBetween(0.3, 0.6).toFixed(2)) }]
            : [],
      })
      sessionCount += 1

      const detected = []
      const attendanceDocs = []
      for (const student of students) {
        const roll = Math.random()
        let status = 'Present'
        let method = 'Face Recognition'
        let confidence = Number(randomBetween(0.78, 0.99).toFixed(2))
        let remarks

        if (roll < 0.1) {
          status = 'Absent'
          method = 'Face Recognition'
          confidence = null
          remarks = 'Not detected in camera feed'
        } else if (roll < 0.18) {
          status = 'Late'
          method = 'Manual'
          confidence = null
          remarks = 'Marked late by teacher after session'
        } else {
          detected.push(student._id)
        }

        attendanceDocs.push({
          student: student._id,
          subject: subject._id,
          teacher: teacherId,
          classroom: classroom._id,
          session: session._id,
          date: sessionDate,
          period: sIdx + 1,
          status,
          method,
          confidence,
          markedBy: teacherUser.user,
          remarks,
        })
      }

      await Attendance.insertMany(attendanceDocs)
      attendanceCount += attendanceDocs.length

      session.detectedStudents = detected
      await session.save()
    }
  }
  log(`Created ${sessionCount} attendance sessions`)
  log(`Created ${attendanceCount} attendance records`)

  // ---- Notifications ----
  const notifications = []
  // Low-attendance warning for a couple of students
  for (const student of students.slice(0, 2)) {
    notifications.push({
      recipient: student.user,
      title: 'Low attendance warning',
      message: `Your attendance in ${subjects[0].name} has fallen below the 75% threshold.`,
      type: 'LOW_ATTENDANCE',
      link: '/student/attendance',
      metadata: { subjectId: subjects[0]._id, threshold: 75 },
    })
  }
  // Class reminder for teachers
  for (const teacher of teachers) {
    notifications.push({
      recipient: teacher.user,
      title: 'Upcoming class',
      message: 'You have a class starting in 30 minutes.',
      type: 'CLASS_REMINDER',
      link: '/teacher/classes',
    })
  }
  // System notification for admin
  notifications.push({
    recipient: adminUser._id,
    title: 'Demo data seeded',
    message: 'The database was populated with demo data by the seed script.',
    type: 'SYSTEM',
    link: '/admin/dashboard',
  })

  await Notification.insertMany(notifications)
  log(`Created ${notifications.length} notifications`)

  log('----------------------------------------')
  log('Seed complete. Demo accounts (password for all: "Password123!"):')
  log(`  Admin:   admin@smartclassroom.local`)
  log(`  Teacher: teacher1@smartclassroom.local (also teacher2, teacher3)`)
  log(`  Student: student1@smartclassroom.local (through student20)`)
  log('Note: login itself is implemented in Phase 3.')
  log('----------------------------------------')
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.error('[seed] Refusing to run: NODE_ENV=production. This script deletes data.')
    process.exit(1)
  }

  try {
    await seed()
    process.exit(0)
  } catch (err) {
    console.error('[seed] Failed:', err)
    process.exit(1)
  } finally {
    await mongoose.connection.close().catch(() => {})
  }
}

main()
