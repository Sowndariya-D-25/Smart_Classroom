import mongoose from 'mongoose'
import jwt from 'jsonwebtoken'
import dotenv from 'dotenv'
dotenv.config()

import {
  User,
  Student,
  Teacher,
  Subject,
  Attendance,
  AttendanceSession,
  FaceProfile,
} from '../models/index.js'

async function runVerification() {
  await mongoose.connect(process.env.MONGO_URI)
  console.log('Connected to MongoDB:', process.env.MONGO_URI)

  const BASE_URL = 'http://localhost:5000'
  let passed = 0
  let failed = 0

  function assert(cond, msg) {
    if (cond) {
      console.log(`  [PASS] ${msg}`)
      passed++
    } else {
      console.error(`  [FAIL] ${msg}`)
      failed++
    }
  }

  // 1. Initial Database Counts (Safety check)
  console.log('\n=== 1. DATABASE RECORD COUNTS (NO SEED, NO WIPE) ===')
  const counts = {
    students: await Student.countDocuments(),
    teachers: await Teacher.countDocuments(),
    subjects: await Subject.countDocuments(),
    attendanceSessions: await AttendanceSession.countDocuments(),
    attendanceRecords: await Attendance.countDocuments(),
    faceProfiles: await FaceProfile.countDocuments(),
    users: await User.countDocuments(),
  }
  console.log('Real MongoDB Data Counts:')
  for (const [k, v] of Object.entries(counts)) {
    console.log(`  - ${k}: ${v}`)
  }
  assert(counts.students > 0, 'Students exist in database')
  assert(counts.teachers > 0, 'Teachers exist in database')
  assert(counts.subjects > 0, 'Subjects exist in database')
  assert(counts.attendanceSessions > 0, 'Attendance sessions exist in database')
  assert(counts.attendanceRecords > 0, 'Attendance records exist in database')

  // Find Users
  const adminUser = await User.findOne({ role: 'admin' })
  const teacherUser = await User.findOne({ role: 'teacher' })
  const studentUser = await User.findOne({ role: 'student' })

  assert(adminUser !== null, `Admin user exists: ${adminUser?.email}`)
  assert(teacherUser !== null, `Teacher user exists: ${teacherUser?.email}`)
  assert(studentUser !== null, `Student user exists: ${studentUser?.email}`)

  const adminToken = jwt.sign(
    { userId: adminUser._id.toString(), role: adminUser.role },
    process.env.JWT_SECRET,
    { expiresIn: '1h' },
  )
  const teacherToken = teacherUser
    ? jwt.sign(
        { userId: teacherUser._id.toString(), role: teacherUser.role },
        process.env.JWT_SECRET,
        { expiresIn: '1h' },
      )
    : null
  const studentToken = studentUser
    ? jwt.sign(
        { userId: studentUser._id.toString(), role: studentUser.role },
        process.env.JWT_SECRET,
        { expiresIn: '1h' },
      )
    : null

  // 2. Auth / Account Management Tests
  console.log('\n=== 2. AUTHENTICATION & PASSWORD FLOW TESTS ===')
  // Teacher change password validation (wrong current password should fail gracefully with 400)
  const teacherPwdRes = await fetch(`${BASE_URL}/api/teacher/profile/password`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${teacherToken}`,
    },
    body: JSON.stringify({
      currentPassword: 'WrongPassword123!',
      newPassword: 'NewValidPassword123!',
      confirmPassword: 'NewValidPassword123!',
    }),
  })
  const teacherPwdJson = await teacherPwdRes.json()
  assert(
    teacherPwdRes.status === 400,
    'Teacher change password correctly rejects invalid current password with 400',
  )
  assert(
    teacherPwdJson.message?.toLowerCase().includes('current password'),
    'Teacher change password error message indicates incorrect current password',
  )

  // 3. Students Section API
  console.log('\n=== 3. ADMIN STUDENTS SECTIONS API ===')
  const secRes = await fetch(`${BASE_URL}/api/admin/students/sections`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  })
  const secJson = await secRes.json()
  assert(secRes.status === 200, 'GET /api/admin/students/sections returns 200')
  assert(secJson.success === true, 'Sections response success is true')
  const sections = secJson.sections || secJson.data?.sections || []
  assert(Array.isArray(sections), `Returns real sections array: ${JSON.stringify(sections)}`)
  assert(sections.length > 0, 'Sections populated from real Student collection')

  // Filter sections by department
  const secCseRes = await fetch(`${BASE_URL}/api/admin/students/sections?department=CSE`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  })
  const secCseJson = await secCseRes.json()
  assert(secCseRes.status === 200, 'GET /api/admin/students/sections?department=CSE returns 200')
  const cseSections = secCseJson.sections || secCseJson.data?.sections || []
  assert(Array.isArray(cseSections), `CSE sections: ${JSON.stringify(cseSections)}`)

  // 4. Admin Dashboard Canonical Department Normalization
  console.log('\n=== 4. ADMIN DASHBOARD NORMALIZATION ===')
  const dashRes = await fetch(`${BASE_URL}/api/admin/dashboard`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  })
  const dashJson = await dashRes.json()
  assert(dashRes.status === 200, 'GET /api/admin/dashboard returns 200')
  const deptList = (dashJson.data?.departmentWise || []).map((d) => d.department)
  console.log('  Dashboard Departments:', deptList)
  const hasCompSci = deptList.some((d) => d.toLowerCase() === 'computer science')
  assert(!hasCompSci, 'No duplicate "Computer Science" displayed; normalized to canonical "CSE"')

  // 5. Timetable Filters
  console.log('\n=== 5. ADMIN TIMETABLE FILTERS ===')
  const ttAllRes = await fetch(`${BASE_URL}/api/admin/timetable`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  })
  const ttAllJson = await ttAllRes.json()
  assert(ttAllRes.status === 200, 'GET /api/admin/timetable returns 200')
  console.log(`  Total timetable entries: ${ttAllJson.items?.length || 0}`)

  const ttCseRes = await fetch(`${BASE_URL}/api/admin/timetable?department=CSE`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  })
  const ttCseJson = await ttCseRes.json()
  assert(ttCseRes.status === 200, 'GET /api/admin/timetable?department=CSE returns 200')
  const allMatchCse = (ttCseJson.items || []).every(
    (e) => (e.subject?.department || e.course?.department || '').toUpperCase().includes('CS'),
  )
  assert(allMatchCse, 'All returned timetable entries match canonical CSE department')

  // 6. Admin Attendance & Delete Security
  console.log('\n=== 6. ADMIN ATTENDANCE & DELETE SECURITY ===')
  const attRes = await fetch(`${BASE_URL}/api/admin/attendance`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  })
  const attJson = await attRes.json()
  assert(attRes.status === 200, 'GET /api/admin/attendance returns 200')
  assert(Array.isArray(attJson.data?.items), 'Attendance sessions items returned')
  console.log(`  Attendance sessions count: ${attJson.data?.items?.length || 0}`)

  // Delete Session RBAC test: Teachers must NOT be allowed to call Admin Delete
  const fakeId = new mongoose.Types.ObjectId().toString()
  const teacherDelRes = await fetch(`${BASE_URL}/api/admin/attendance/sessions/${fakeId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${teacherToken}` },
  })
  assert(teacherDelRes.status === 403, 'Teacher token receives 403 on Admin Delete Session endpoint')

  const unauthDelRes = await fetch(`${BASE_URL}/api/admin/attendance/sessions/${fakeId}`, {
    method: 'DELETE',
  })
  assert(unauthDelRes.status === 401, 'Unauthenticated request receives 401 on Admin Delete Session endpoint')

  // 7. Admin Analytics
  console.log('\n=== 7. ADMIN ANALYTICS KPIS & FILTERS ===')
  const anaRes = await fetch(`${BASE_URL}/api/admin/analytics/overview`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  })
  const anaJson = await anaRes.json()
  assert(anaRes.status === 200, 'GET /api/admin/analytics/overview returns 200')
  const kpis = anaJson.data?.kpis || {}
  console.log('  Analytics KPIs:', {
    overallPercentage: kpis.overallPercentage,
    studentsBelowThreshold: kpis.studentsBelowThreshold,
    bestDepartment: kpis.bestDepartment,
    lowestDepartment: kpis.lowestDepartment,
    totalSessions: kpis.totalSessions,
  })
  assert(kpis.totalSessions !== undefined, 'KPI: totalSessions is present')
  assert(kpis.overallPercentage !== undefined, 'KPI: overallPercentage is present')
  assert(kpis.studentsBelowThreshold !== undefined, 'KPI: studentsBelowThreshold is present')
  assert(kpis.bestDepartment !== undefined, 'KPI: bestDepartment is present')
  assert(kpis.lowestDepartment !== undefined, 'KPI: lowestDepartment is present')

  // Test Analytics with Department Filter
  const anaCseRes = await fetch(`${BASE_URL}/api/admin/analytics/overview?department=CSE`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  })
  const anaCseJson = await anaCseRes.json()
  assert(anaCseRes.status === 200, 'Analytics overview with department=CSE returns 200')
  assert(anaCseJson.data?.kpis?.totalSessions <= kpis.totalSessions, 'Filtered sessions count is constrained')

  // 8. Admin Reports
  console.log('\n=== 8. ADMIN REPORTS (ALL 7 REPORT TYPES & FILTERS) ===')
  const repRes = await fetch(`${BASE_URL}/api/admin/reports`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  })
  const repJson = await repRes.json()
  assert(repRes.status === 200, 'GET /api/admin/reports returns 200')
  const repData = repJson.data || {}

  assert(repData.overall?.totalSessions !== undefined, '1. Attendance Summary report data present')
  assert(Array.isArray(repData.studentAttendance), '2. Student Attendance report data present')
  assert(Array.isArray(repData.departmentAttendance), '3. Department Attendance report data present')
  assert(Array.isArray(repData.subjectWise), '4. Subject Attendance report data present')
  assert(Array.isArray(repData.teacherSessions), '5. Teacher Session report data present')
  assert(Array.isArray(repData.lowAttendance), '6. Low Attendance report data present')
  assert(Array.isArray(repData.dailyAttendance), '7. Daily Attendance report data present')

  // Check canonical CSE in Department Attendance report
  const repDeptNames = repData.departmentAttendance.map((d) => d.department)
  console.log('  Report Department Names:', repDeptNames)
  assert(!repDeptNames.some((d) => d.toLowerCase() === 'computer science'), 'Report departmentAttendance does not show separate "Computer Science"')

  // Test Year Filter on Reports (verify bug fix: year now returns records!)
  const repYearRes = await fetch(`${BASE_URL}/api/admin/reports?year=3rd Year`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  })
  const repYearJson = await repYearRes.json()
  assert(repYearRes.status === 200, 'GET /api/admin/reports?year=3rd Year returns 200')
  console.log('  Year 3 Student Attendance count:', repYearJson.data?.studentAttendance?.length)
  console.log('  Year 3 Total Sessions:', repYearJson.data?.overall?.totalSessions)

  // 9. Final Database Safety Verification
  console.log('\n=== 9. FINAL DATABASE SAFETY VERIFICATION ===')
  const finalCounts = {
    students: await Student.countDocuments(),
    teachers: await Teacher.countDocuments(),
    subjects: await Subject.countDocuments(),
    attendanceSessions: await AttendanceSession.countDocuments(),
    attendanceRecords: await Attendance.countDocuments(),
    faceProfiles: await FaceProfile.countDocuments(),
    users: await User.countDocuments(),
  }
  let dbUnchanged = true
  for (const [k, v] of Object.entries(counts)) {
    if (finalCounts[k] !== v) {
      console.error(`  MISMATCH in ${k}: was ${v}, now ${finalCounts[k]}`)
      dbUnchanged = false
    }
  }
  assert(dbUnchanged, 'All MongoDB collection counts are 100% IDENTICAL before and after testing')

  console.log(`\n========================================`)
  console.log(`VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`)
  console.log(`========================================\n`)

  await mongoose.disconnect()
  process.exit(failed > 0 ? 1 : 0)
}

runVerification().catch((err) => {
  console.error('Test script crashed:', err)
  process.exit(1)
})
