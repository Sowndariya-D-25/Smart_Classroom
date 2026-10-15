import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import dotenv from 'dotenv'

dotenv.config()

async function testWorkflow() {
  await mongoose.connect('mongodb://127.0.0.1:27017/smart-classroom')
  const { User, Teacher, Subject, Classroom, Student, FaceProfile, Attendance, AttendanceSession } = await import(
    './models/index.js'
  )

  console.log('========================================================')
  console.log('SMART CLASSROOM & ATTENDANCE: FULL WORKFLOW VALIDATION')
  console.log('========================================================\n')

  console.log('--- 1. Testing Teacher Setup & Auth ---')
  const teacherUser = await User.findOne({ email: 'teacher1@smartclassroom.local' })
  const teacher = await Teacher.findOne({ user: teacherUser._id })
  const subject = await Subject.findOne({ teachers: teacher._id }).populate('course')
  const classroom = await Classroom.findOne({ isActive: true })

  // Log in using real auth API
  const loginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'teacher1@smartclassroom.local', password: 'Password123!' }),
  })
  const loginJson = await loginRes.json()
  const token = loginJson.data?.token
  if (!token) throw new Error('Teacher login failed: ' + JSON.stringify(loginJson))

  console.log('Teacher Logged In:', teacherUser.name, 'Token received')
  console.log('Subject:', subject.name, `(${subject.code})`)
  console.log('Classroom:', classroom.name, `(${classroom.code})`)

  const API = 'http://localhost:5000/api/teacher'
  const headers = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }

  // Clean any test data from previous runs
  await Student.deleteOne({ studentId: '23CS099' })
  await User.deleteOne({ email: 'sowndariya@smartclassroom.local' })

  console.log('\n--- 2. TEST 1: Student Registration + Face Registration ---')
  // Simulated 128D real-valued descriptors
  const mockDescriptor1 = Array.from({ length: 128 }, (_, i) => Math.sin(i * 0.1) * 0.15)
  const mockDescriptor2 = mockDescriptor1.map((v) => v + 0.01)

  const regRes = await fetch(API + '/students/register', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: 'Sowndariya S',
      studentId: '23CS099',
      rollNumber: '99',
      department: 'Computer Science',
      section: 'A',
      course: subject.course._id,
      classroom: classroom._id,
      email: 'sowndariya@smartclassroom.local',
      gender: 'Female',
      year: 2,
      descriptors: [mockDescriptor1, mockDescriptor2],
    }),
  })
  const regData = await regRes.json()
  console.log('Registration Response Status:', regRes.status, regData.message)

  const savedStudent = await Student.findOne({ studentId: '23CS099' }).populate('user faceProfile')
  console.log('Student Created in DB:', {
    studentId: savedStudent?.studentId,
    name: savedStudent?.user?.name,
    email: savedStudent?.user?.email,
    faceSamples: savedStudent?.faceProfile?.sampleCount,
  })
  if (!savedStudent || savedStudent.faceProfile?.sampleCount !== 2) {
    throw new Error('Test 1 Failed: Student and face profile were not stored correctly.')
  }
  console.log('✓ TEST 1 PASSED: Student and face descriptors stored in MongoDB successfully.')

  console.log('\n--- 3. TEST 2: Start Attendance Session (Period 1) ---')
  const sessionDate = '2026-09-24'
  // Clean any existing session for this period/date
  await AttendanceSession.deleteMany({ subject: subject._id, period: 1, date: new Date(sessionDate) })
  await AttendanceSession.deleteMany({ subject: subject._id, period: 2, date: new Date(sessionDate) })

  const sessionRes = await fetch(API + '/attendance/sessions', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      subject: subject._id,
      classroom: classroom._id,
      department: 'Computer Science',
      section: 'A',
      period: 1,
      date: sessionDate,
      startTime: '09:00',
      endTime: '10:00',
    }),
  })
  const sessionJson = await sessionRes.json()
  console.log('Create Session Status:', sessionRes.status, sessionJson.message)
  const sessionId = sessionJson.data?.session?._id
  console.log('Session ID:', sessionId)

  console.log('\n--- 4. TEST 2: Live Face Attendance (Show Registered Face) ---')
  // Probe with a live scan vector close to mockDescriptor1
  const liveScanVector = mockDescriptor1.map((v) => v + 0.005)
  const recRes = await fetch(`${API}/attendance/sessions/${sessionId}/recognize`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ descriptor: liveScanVector }),
  })
  const recJson = await recRes.json()
  console.log('Face Match Result:', {
    matched: recJson.data?.matched,
    student: recJson.data?.student?.name,
    studentId: recJson.data?.student?.studentId,
    confidence: recJson.data?.confidence,
    status: recJson.data?.attendance?.status,
  })
  if (!recJson.data?.matched || recJson.data?.student?.studentId !== '23CS099') {
    throw new Error('Test 2 Failed: Face was not matched to student 23CS099.')
  }
  console.log('✓ TEST 2 PASSED: Face recognized and student marked Present in MongoDB.')

  console.log('\n--- 5. TEST 5: Duplicate Attendance Prevention in Same Session ---')
  // Show same student again
  const dupRes = await fetch(`${API}/attendance/sessions/${sessionId}/recognize`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ descriptor: liveScanVector }),
  })
  const dupJson = await dupRes.json()
  console.log('Duplicate Scan Response:', dupJson.message, { alreadyMarked: dupJson.data?.alreadyMarked })
  const attCount = await Attendance.countDocuments({ student: savedStudent._id, session: sessionId })
  console.log('Total Attendance records for student in this session:', attCount)
  if (attCount !== 1) {
    throw new Error('Test 5 Failed: Duplicate attendance was created.')
  }
  console.log('✓ TEST 5 PASSED: Duplicate detection prevented; only 1 attendance record exists.')

  console.log('\n--- 6. TEST 3: Unknown / Unregistered Face Detection ---')
  const unknownVector = Array.from({ length: 128 }, () => 0.85) // Far distance > 0.6 threshold
  const unkRes = await fetch(`${API}/attendance/sessions/${sessionId}/recognize`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ descriptor: unknownVector }),
  })
  const unkJson = await unkRes.json()
  console.log('Unknown Face Scan Result:', {
    matched: unkJson.data?.matched,
    message: unkJson.message,
    student: unkJson.data?.student,
  })
  if (unkJson.data?.matched !== false || unkJson.data?.student !== null) {
    throw new Error('Test 3 Failed: Unknown face should not match any student.')
  }
  console.log('✓ TEST 3 PASSED: Unknown face detected; no student marked present.')

  console.log('\n--- 7. TEST 6: Finish Attendance (Undetected Students Marked Absent) ---')
  const finRes = await fetch(`${API}/attendance/sessions/${sessionId}/complete`, {
    method: 'POST',
    headers,
  })
  const finJson = await finRes.json()
  console.log('Finish Attendance Response:', finJson.message)
  console.log('Summary:', finJson.data?.summary)

  const finalRecords = await Attendance.find({ session: sessionId })
  const presentRecords = finalRecords.filter((r) => r.status === 'Present')
  const absentRecords = finalRecords.filter((r) => r.status === 'Absent')
  console.log(`Database Records for Session: ${presentRecords.length} Present, ${absentRecords.length} Absent.`)
  if (absentRecords.length === 0) {
    throw new Error('Test 6 Failed: Undetected students were not marked absent.')
  }
  console.log('✓ TEST 6 PASSED: Undetected students automatically marked Absent upon finishing attendance.')

  console.log('\n--- 8. TEST 8: Different Periods (Period 2 Attendance) ---')
  const p2Res = await fetch(API + '/attendance/sessions', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      subject: subject._id,
      classroom: classroom._id,
      department: 'Computer Science',
      section: 'A',
      period: 2,
      date: sessionDate,
      startTime: '10:00',
      endTime: '11:00',
    }),
  })
  const p2Json = await p2Res.json()
  const p2Id = p2Json.data?.session?._id

  // Mark face in Period 2
  const p2Rec = await fetch(`${API}/attendance/sessions/${p2Id}/recognize`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ descriptor: liveScanVector }),
  })
  const p2RecJson = await p2Rec.json()
  console.log('Period 2 Recognition:', p2RecJson.message, { matched: p2RecJson.data?.matched })

  const p1Doc = await Attendance.findOne({ student: savedStudent._id, session: sessionId })
  const p2Doc = await Attendance.findOne({ student: savedStudent._id, session: p2Id })
  console.log('Period 1 Record ID:', p1Doc?._id, 'Period:', p1Doc?.period, 'Status:', p1Doc?.status)
  console.log('Period 2 Record ID:', p2Doc?._id, 'Period:', p2Doc?.period, 'Status:', p2Doc?.status)
  if (!p1Doc || !p2Doc || p1Doc._id.equals(p2Doc._id)) {
    throw new Error('Test 8 Failed: Period 1 and Period 2 should have separate records.')
  }
  console.log('✓ TEST 8 PASSED: Period 1 and Period 2 have independent attendance records.')

  console.log('\n========================================================')
  console.log('ALL WORKFLOW TESTS COMPLETED SUCCESSFULLY!')
  console.log('========================================================\n')

  await mongoose.disconnect()
  process.exit(0)
}

testWorkflow().catch((err) => {
  console.error('Validation Error:', err)
  process.exit(1)
})
