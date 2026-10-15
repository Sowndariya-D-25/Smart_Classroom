import dotenv from 'dotenv'
dotenv.config()

import mongoose from 'mongoose'
import jwt from 'jsonwebtoken'
import {
  Student,
  FaceProfile,
  Attendance,
  AttendanceSession,
  Subject,
  Classroom,
  Teacher,
  User,
} from '../models/index.js'

const BASE_URL = 'http://localhost:5000'

async function runVerification() {
  console.log('====================================================')
  console.log('   PERSISTENCE & SECTION SCOPING FORENSIC VERIFICATION')
  console.log('====================================================\n')

  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/smart-classroom')

  // --- Step 1: Inspect Student 201 & FaceProfile ---
  console.log('STEP 1: Inspecting Student 201 and FaceProfile in MongoDB...')
  const student201 = await Student.findOne({ studentId: '201' }).populate('user')
  if (!student201) {
    throw new Error('Student 201 not found in database!')
  }

  const initialProfile = await FaceProfile.findOne({ student: student201._id })
  if (!initialProfile) {
    throw new Error('FaceProfile for Student 201 not found!')
  }

  console.log(`✓ Student 201: ${student201.user?.name} | Dept: ${student201.department} | Sec: ${student201.section}`)
  console.log(`✓ FaceProfile ID: ${initialProfile._id}`)
  console.log(`✓ Descriptors count: ${initialProfile.descriptors.length}`)
  console.log(`✓ Sample count: ${initialProfile.sampleCount}`)
  console.log(`✓ Active: ${initialProfile.isActive}`)

  const initialDescriptorJson = JSON.stringify(initialProfile.descriptors)

  // Get teacher auth token
  const teacher = await Teacher.findOne({ employeeId: 'TCH-001' }).populate('user')
  const token = jwt.sign(
    { userId: teacher.user._id.toString(), role: 'teacher' },
    process.env.JWT_SECRET || 'smart_classroom_secret_2026_change_this',
    { expiresIn: '1h' }
  )

  const subject = await Subject.findOne({ teachers: teacher._id, isActive: true })
  const classroom = await Classroom.findOne({ isActive: true })

  // --- Step 2: Negative Test — Section A Session ---
  console.log('\nSTEP 2: Negative Test — Starting Section A session...')
  const dateStr = new Date().toISOString().slice(0, 10)
  const uniquePeriodA = 7 // period 7 for test

  // Cleanup any old test session on period 7
  await AttendanceSession.deleteMany({ teacher: teacher._id, period: uniquePeriodA, date: new Date(dateStr) })

  const resSessionA = await fetch(`${BASE_URL}/api/teacher/attendance/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      subject: subject._id.toString(),
      classroom: classroom._id.toString(),
      department: 'Computer Science',
      section: 'A',
      date: dateStr,
      period: uniquePeriodA,
      startTime: '09:00',
      endTime: '10:00',
    }),
  })

  const sessionAData = await resSessionA.json()
  const sessionA = sessionAData?.data?.session
  console.log(`✓ Created Session A (ID: ${sessionA._id}) | Section: ${sessionA.section}`)

  // Confirm student 201 is NOT in Session A roster
  const sessionARosterIds = (sessionAData?.data?.roster || []).map((s) => s.studentId)
  console.log(`✓ Session A roster size: ${sessionARosterIds.length} students`)
  console.log(`✓ Student 201 in Session A roster? ${sessionARosterIds.includes('201') ? 'YES (ERROR)' : 'NO (CORRECT)'}`)

  // Present student 201 face to Session A
  const sampleDescriptor = initialProfile.descriptors[0]
  const resRecognizeA = await fetch(`${BASE_URL}/api/teacher/attendance/sessions/${sessionA._id}/recognize`, {
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
  const recognizeAData = await resRecognizeA.json()
  console.log(`✓ Section A recognition result: matched=${recognizeAData.data?.matched}, reason=${recognizeAData.data?.reason}`)
  if (recognizeAData.data?.matched === false) {
    console.log('✓ PASS: Section A correctly rejects Section F student.')
  } else {
    throw new Error('FAIL: Section A should not have matched Section F student!')
  }

  // --- Step 3: Positive Test — Section F Session ---
  console.log('\nSTEP 3: Positive Test — Starting Section F session (The user scenario)...')
  const uniquePeriodF = 8 // period 8 for test
  await AttendanceSession.deleteMany({ teacher: teacher._id, period: uniquePeriodF, date: new Date(dateStr) })

  const resSessionF = await fetch(`${BASE_URL}/api/teacher/attendance/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      subject: subject._id.toString(),
      classroom: classroom._id.toString(),
      department: 'Computer Science',
      section: 'F',
      date: dateStr,
      period: uniquePeriodF,
      startTime: '10:00',
      endTime: '11:00',
    }),
  })

  const sessionFData = await resSessionF.json()
  const sessionF = sessionFData?.data?.session
  console.log(`✓ Created Session F (ID: ${sessionF._id}) | Section: ${sessionF.section}`)

  const sessionFRosterIds = (sessionFData?.data?.roster || []).map((s) => s.studentId)
  console.log(`✓ Session F roster size: ${sessionFRosterIds.length} students`)
  console.log(`✓ Student 201 in Session F roster? ${sessionFRosterIds.includes('201') ? 'YES (CORRECT)' : 'NO (ERROR)'}`)

  // Present student 201 face to Session F: Frame 1 (uncommitted verification)
  const resRecognizeF1 = await fetch(`${BASE_URL}/api/teacher/attendance/sessions/${sessionF._id}/recognize`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      descriptor: sampleDescriptor,
      commit: false,
    }),
  })
  const f1Data = await resRecognizeF1.json()
  console.log(`✓ Frame 1 (uncommitted verification): matched=${f1Data.data?.matched}, student=${f1Data.data?.student?.studentId} (${f1Data.data?.student?.name})`)

  // Frame 2 (commit)
  const resRecognizeF2 = await fetch(`${BASE_URL}/api/teacher/attendance/sessions/${sessionF._id}/recognize`, {
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
  const f2Data = await resRecognizeF2.json()
  console.log(`✓ Frame 2 (commit attendance): matched=${f2Data.data?.matched}, student=${f2Data.data?.student?.studentId}, alreadyMarked=${f2Data.data?.alreadyMarked}`)

  if (f2Data.data?.matched === true && f2Data.data?.student?.studentId === '201') {
    console.log('✓ PASS: Student 201 recognized successfully in Section F session!')
  } else {
    throw new Error('FAIL: Student 201 was not recognized in Section F session!')
  }

  // Verify attendance record in MongoDB
  const attendanceRecord = await Attendance.findOne({ session: sessionF._id, student: student201._id })
  console.log(`✓ Attendance Record in DB: ID=${attendanceRecord?._id} | Status=${attendanceRecord?.status} | Method=${attendanceRecord?.method}`)
  if (attendanceRecord && attendanceRecord.status === 'Present') {
    console.log('✓ PASS: Exactly one Present record created.')
  } else {
    throw new Error('FAIL: Attendance record not found or not Present!')
  }

  // Test duplicate protection
  console.log('\nSTEP 4: Duplicate Attendance Protection Test...')
  const resRecognizeDup = await fetch(`${BASE_URL}/api/teacher/attendance/sessions/${sessionF._id}/recognize`, {
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
  const dupData = await resRecognizeDup.json()
  console.log(`✓ Duplicate scan result: alreadyMarked=${dupData.data?.alreadyMarked}, matched=${dupData.data?.matched}`)
  const attendanceCount = await Attendance.countDocuments({ session: sessionF._id, student: student201._id })
  console.log(`✓ Attendance records count for Student 201: ${attendanceCount}`)
  if (dupData.data?.alreadyMarked === true && attendanceCount === 1) {
    console.log('✓ PASS: Duplicate protection works correctly (no extra record created).')
  } else {
    throw new Error('FAIL: Duplicate protection failed!')
  }

  // --- Step 5: Test Unknown / Unregistered Face ---
  console.log('\nSTEP 5: Unknown Face Rejection Test...')
  // Synthetic far face: [1.0, 1.0, ..., 1.0] (L2 norm distance is huge)
  const unknownDescriptor = Array(128).fill(1.0)
  const resRecognizeUnknown = await fetch(`${BASE_URL}/api/teacher/attendance/sessions/${sessionF._id}/recognize`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      descriptor: unknownDescriptor,
      commit: true,
    }),
  })
  const unknownData = await resRecognizeUnknown.json()
  console.log(`✓ Unknown face result: matched=${unknownData.data?.matched}, reason=${unknownData.data?.reason}`)
  if (unknownData.data?.matched === false) {
    console.log('✓ PASS: Unknown face correctly rejected.')
  } else {
    throw new Error('FAIL: Unknown face was falsely accepted!')
  }

  // --- Step 6: Verify Database Integrity ---
  console.log('\nSTEP 6: Verifying Database Integrity...')
  const finalProfileCount = await FaceProfile.countDocuments()
  const finalProfile = await FaceProfile.findOne({ student: student201._id })
  const finalDescriptorJson = JSON.stringify(finalProfile.descriptors)

  console.log(`✓ Total FaceProfiles in DB: ${finalProfileCount} (Expected: 21)`)
  console.log(`✓ Student 201 FaceProfile sampleCount: ${finalProfile.sampleCount}`)
  console.log(`✓ Descriptors byte-level equality: ${initialDescriptorJson === finalDescriptorJson ? 'IDENTICAL (100% UNCHANGED)' : 'DIFFERENT (ERROR)'}`)

  if (finalProfileCount === 21 && initialDescriptorJson === finalDescriptorJson) {
    console.log('✓ PASS: FaceProfile documents and 128-D vectors were NOT altered or corrupted.')
  } else {
    throw new Error('FAIL: FaceProfile data was modified unexpectedly!')
  }

  // Clean up test sessions
  await AttendanceSession.deleteMany({ _id: { $in: [sessionA._id, sessionF._id] } })
  await Attendance.deleteMany({ session: { $in: [sessionA._id, sessionF._id] } })
  console.log('✓ Cleaned up test sessions and attendance records.')

  console.log('\n====================================================')
  console.log('   ALL FORENSIC VERIFICATION TESTS PASSED!')
  console.log('====================================================')

  await mongoose.disconnect()
}

runVerification().catch((err) => {
  console.error('\n❌ ERROR DURING VERIFICATION:', err)
  process.exit(1)
})
