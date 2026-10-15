import dotenv from 'dotenv'
dotenv.config()

import mongoose from 'mongoose'
import jwt from 'jsonwebtoken'
import {
  Student,
  FaceProfile,
  User,
  Teacher,
  Subject,
  Classroom,
  Course,
  AttendanceSession,
} from '../models/index.js'

const BASE_URL = 'http://localhost:5000'

async function probe() {
  console.log('=================================================================')
  console.log('  FORENSIC PROBE: NEW STUDENT REGISTRATION & TAKE ATTENDANCE ROSTER')
  console.log('=================================================================\n')

  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/smart-classroom')

  // 1. Prepare Teacher Auth & Assigned Subject
  const teacher = await Teacher.findOne({ employeeId: 'TCH-001' }).populate('user')
  const token = jwt.sign(
    { userId: teacher.user._id.toString(), role: 'teacher' },
    process.env.JWT_SECRET || 'smart_classroom_secret_2026_change_this',
    { expiresIn: '1h' }
  )

  const subject = await Subject.findOne({ teachers: teacher._id, isActive: true }).populate('course')
  const classroom = await Classroom.findOne({ isActive: true })

  console.log('1. Teacher Context:')
  console.log(`   Teacher ID: ${teacher._id} (${teacher.employeeId} - ${teacher.user?.name})`)
  console.log(`   Subject: ${subject.name} (${subject.code})`)
  console.log(`   Course: ${subject.course?.name} (${subject.course?.code} - ID: ${subject.course?._id})`)
  console.log(`   Department: ${subject.department}\n`)

  // 2. Register a NEW Student via Face Registration API
  console.log('2. Registering NEW Student via POST /api/teacher/students/register...')
  const testStudentId = 'STU_PERSIST_01'
  const testEmail = 'persist01@smartclassroom.local'

  // Clean up any existing test student with this ID
  const oldStudent = await Student.findOne({ studentId: testStudentId })
  if (oldStudent) {
    await FaceProfile.deleteMany({ student: oldStudent._id })
    await User.deleteMany({ _id: oldStudent.user })
    await Student.deleteMany({ _id: oldStudent._id })
  }

  // Generate a valid 128-D descriptor sample
  const sampleDescriptor = Array.from({ length: 128 }, (_, i) => Number((Math.sin(i + 1) * 0.2).toFixed(6)))

  const registrationPayload = {
    name: 'Persist Student One',
    studentId: testStudentId,
    rollNumber: '99',
    department: subject.department || 'Computer Science',
    section: 'A',
    classroom: classroom._id.toString(),
    course: subject.course._id.toString(),
    email: testEmail,
    phone: '9876543210',
    gender: 'Male',
    year: '1',
    descriptors: [sampleDescriptor, sampleDescriptor, sampleDescriptor],
  }

  const regResponse = await fetch(`${BASE_URL}/api/teacher/students/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(registrationPayload),
  })

  const regResult = await regResponse.json()
  console.log(`   Registration Status: ${regResponse.status}`)
  console.log(`   Registration Response:`, JSON.stringify(regResult, null, 2))

  // 3. Inspect Immediately in MongoDB
  console.log('\n3. Inspecting NEW Student in MongoDB Immediately After Registration:')
  const studentDocBefore = await Student.findOne({ studentId: testStudentId })
    .populate('user')
    .populate('course')
    .populate('classroom')
    .lean()

  console.log('   [Student Document in MongoDB]:', JSON.stringify(studentDocBefore, null, 2))

  const faceProfileDocBefore = await FaceProfile.findOne({ student: studentDocBefore._id }).lean()
  console.log('   [FaceProfile Document in MongoDB]:', {
    _id: faceProfileDocBefore._id,
    student: faceProfileDocBefore.student,
    sampleCount: faceProfileDocBefore.sampleCount,
    descriptorsCount: faceProfileDocBefore.descriptors?.length,
    firstDescriptorLength: faceProfileDocBefore.descriptors?.[0]?.length,
    isActive: faceProfileDocBefore.isActive,
    createdAt: faceProfileDocBefore.createdAt,
  })

  // 4. Test Take Attendance Session Creation & Roster Query BEFORE Restart
  console.log('\n4. Testing Take Attendance (Creating Session & Querying Roster) BEFORE Restart:')
  const testDate = new Date().toISOString().slice(0, 10)
  const testPeriod = 6

  // Clean any old test session on period 6
  await AttendanceSession.deleteMany({ teacher: teacher._id, period: testPeriod, date: new Date(testDate) })

  const sessionPayload = {
    subject: subject._id.toString(),
    classroom: classroom._id.toString(),
    department: studentDocBefore.department,
    section: studentDocBefore.section,
    date: testDate,
    period: testPeriod,
    startTime: '14:00',
    endTime: '15:00',
  }

  const sessionCreateRes = await fetch(`${BASE_URL}/api/teacher/attendance/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(sessionPayload),
  })

  const sessionCreateData = await sessionCreateRes.json()
  const createdSession = sessionCreateData?.data?.session
  const rosterBefore = sessionCreateData?.data?.roster || []

  console.log(`   Session Created ID: ${createdSession?._id}`)
  console.log(`   Roster size returned by createSession: ${rosterBefore.length}`)
  const inRosterBefore = rosterBefore.some((s) => s.studentId === testStudentId)
  console.log(`   Student ${testStudentId} in createSession roster? ${inRosterBefore ? 'YES' : 'NO'}`)

  // Query getSession endpoint (GET /api/teacher/attendance/sessions/:id)
  const getSessionRes = await fetch(`${BASE_URL}/api/teacher/attendance/sessions/${createdSession._id}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const getSessionData = await getSessionRes.json()
  const rosterFromGetSession = getSessionData?.data?.roster || []
  const inGetSessionRoster = rosterFromGetSession.some((s) => s.studentId === testStudentId)
  console.log(`   Student ${testStudentId} in GET /sessions/:id roster? ${inGetSessionRoster ? 'YES' : 'NO'}`)

  // 5. Test Teacher Classes & Roster (GET /api/teacher/classes/:subjectId/students)
  const classRosterRes = await fetch(`${BASE_URL}/api/teacher/classes/${subject._id}/students`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const classRosterData = await classRosterRes.json()
  const classItems = classRosterData?.data?.items || []
  const inClassRoster = classItems.some((s) => s.studentId === testStudentId)
  console.log(`   Student ${testStudentId} in GET /classes/:subjectId/students? ${inClassRoster ? 'YES' : 'NO'}`)

  // 6. Test Face Recognition against the newly created session
  const recRes = await fetch(`${BASE_URL}/api/teacher/attendance/sessions/${createdSession._id}/recognize`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      descriptor: sampleDescriptor,
      commit: true,
    }),
  })
  const recData = await recRes.json()
  console.log(`   Face Recognition match result: matched=${recData?.data?.matched}, student=${recData?.data?.student?.studentId} (${recData?.data?.student?.name})`)

  // 7. Simulating Process Stop & Re-Querying After Backend Re-connect
  console.log('\n5. Simulating Backend Stop & Reconnect (Re-querying MongoDB from fresh connection):')
  await mongoose.disconnect()
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/smart-classroom')

  const studentDocAfter = await Student.findOne({ studentId: testStudentId })
    .populate('user')
    .populate('course')
    .populate('classroom')
    .lean()

  console.log('   Student exists in MongoDB after reconnect?', studentDocAfter ? 'YES' : 'NO')
  if (studentDocAfter) {
    console.log('   [Student Document After Reconnect]:', JSON.stringify(studentDocAfter, null, 2))
  }

  const faceProfileDocAfter = await FaceProfile.findOne({ student: studentDocBefore._id }).lean()
  console.log('   FaceProfile exists after reconnect?', faceProfileDocAfter ? 'YES' : 'NO')

  // 8. Re-querying the Take Attendance Roster API from the running server
  console.log('\n6. Re-testing Take Attendance API for the student:')
  const getSessionRes2 = await fetch(`${BASE_URL}/api/teacher/attendance/sessions/${createdSession._id}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const getSessionData2 = await getSessionRes2.json()
  const roster2 = getSessionData2?.data?.roster || []
  const inRoster2 = roster2.some((s) => s.studentId === testStudentId)
  console.log(`   Student ${testStudentId} in GET /sessions/:id roster? ${inRoster2 ? 'YES' : 'NO'}`)

  // Clean up test session
  await AttendanceSession.deleteMany({ _id: createdSession._id })
  console.log('\n✓ Cleaned up test attendance session.')

  await mongoose.disconnect()
  console.log('\nProbe completed successfully.')
}

probe().catch((err) => {
  console.error('Probe failed:', err)
  process.exit(1)
})
