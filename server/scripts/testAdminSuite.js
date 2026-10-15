import mongoose from 'mongoose'
import jwt from 'jsonwebtoken'
import dotenv from 'dotenv'
dotenv.config()

import { User } from '../models/index.js'

async function runTests() {
  await mongoose.connect(process.env.MONGO_URI)
  console.log('Connected to MongoDB:', process.env.MONGO_URI)

  // 1. Find Admin user
  const adminUser = await User.findOne({ role: 'admin' })
  if (!adminUser) {
    console.error('FAIL: No admin user found in database!')
    process.exit(1)
  }
  console.log(`Found Admin user: ${adminUser.name} (${adminUser.email})`)

  // Find Teacher user for RBAC test
  const teacherUser = await User.findOne({ role: 'teacher' })
  console.log(`Found Teacher user: ${teacherUser?.name} (${teacherUser?.email})`)

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

  const BASE_URL = 'http://localhost:5000'

  let passCount = 0
  let failCount = 0

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`)
      passCount++
    } else {
      console.error(`  [FAIL] ${message}`)
      failCount++
    }
  }

  // --- Test 1: Admin Profile ---
  console.log('\n--- 1. Testing Admin Profile API ---')
  const profileRes = await fetch(`${BASE_URL}/api/admin/profile`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  })
  const profileJson = await profileRes.json()
  assert(profileRes.status === 200, 'GET /api/admin/profile returns 200')
  assert(profileJson.success === true, 'profile response success is true')
  assert(profileJson.data?.user?.email === adminUser.email, 'Returns real admin institutional email')
  assert(profileJson.data?.user?.name === adminUser.name, 'Returns real admin full name')
  assert(profileJson.data?.user?.role === 'admin', 'Role in user record matches admin')
  assert(profileJson.data?.admin?.employeeId !== undefined, 'Admin employeeId is returned if record exists')
  assert(!profileJson.data?.user?.password && !profileJson.data?.user?.passwordHash, 'Never returns password or password hash')
  assert(!profileJson.data?.jwt && !profileJson.data?.token, 'Never returns JWT')
  assert(!profileJson.data?.faceDescriptor, 'Never returns face descriptors')

  // --- Test 2: RBAC Protection ---
  console.log('\n--- 2. Testing RBAC / Security Protection ---')
  if (teacherToken) {
    const unauthRes = await fetch(`${BASE_URL}/api/admin/profile`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    })
    assert(unauthRes.status === 403, 'Teacher token receives 403 Forbidden on Admin Profile')

    const unauthDash = await fetch(`${BASE_URL}/api/admin/dashboard`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    })
    assert(unauthDash.status === 403, 'Teacher token receives 403 Forbidden on Admin Dashboard')
  }

  const noTokenRes = await fetch(`${BASE_URL}/api/admin/profile`)
  assert(noTokenRes.status === 401, 'Request with no token receives 401 Unauthorized')

  // --- Test 3: Admin Dashboard ---
  console.log('\n--- 3. Testing Admin Dashboard API ---')
  const dashRes = await fetch(`${BASE_URL}/api/admin/dashboard`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  })
  const dashJson = await dashRes.json()
  assert(dashRes.status === 200, 'GET /api/admin/dashboard returns 200')
  assert(dashJson.data?.students?.total !== undefined, 'Card 1: Total students metric present')
  assert(dashJson.data?.teachers?.total !== undefined, 'Card 2: Total teachers metric present')
  assert(dashJson.data?.courses?.total !== undefined, 'Card 3: Courses metric present')
  assert(dashJson.data?.subjects?.total !== undefined, 'Card 4: Subjects metric present')
  assert(dashJson.data?.todayAttendance?.percentage !== undefined, 'Card 5: Today attendance percentage present')
  assert(dashJson.data?.classrooms === undefined, 'No classroom card in dashboard data')
  assert(Array.isArray(dashJson.data?.trend), 'Attendance trend 7-day array returned')
  assert(Array.isArray(dashJson.data?.departmentWise), 'Department-wise attendance array returned')
  assert(dashJson.data?.alerts !== undefined, 'Attendance alerts section returned')
  assert(Array.isArray(dashJson.data?.recentActivity), 'Recent activity array returned')

  // --- Test 4: Admin Students ---
  console.log('\n--- 4. Testing Admin Students API ---')
  const studentsRes = await fetch(`${BASE_URL}/api/admin/students`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  })
  const studentsJson = await studentsRes.json()
  assert(studentsRes.status === 200, 'GET /api/admin/students returns 200')
  assert(studentsJson.data?.summary?.total !== undefined, 'Students summary: total count present')
  assert(studentsJson.data?.summary?.active !== undefined, 'Students summary: active count present')
  assert(Array.isArray(studentsJson.data?.items), 'Students items list returned as array')
  if (studentsJson.data?.items?.length > 0) {
    const s0 = studentsJson.data.items[0]
    assert(!s0.faceDescriptor && !s0.descriptors, 'Never exposes raw 128D face descriptors')
  }

  // --- Test 5: Admin Teachers & Assignments ---
  console.log('\n--- 5. Testing Admin Teachers API ---')
  const teachersRes = await fetch(`${BASE_URL}/api/admin/teachers`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  })
  const teachersJson = await teachersRes.json()
  assert(teachersRes.status === 200, 'GET /api/admin/teachers returns 200')
  assert(teachersJson.data?.summary?.total !== undefined, 'Teachers summary: total count present')
  assert(teachersJson.data?.summary?.active !== undefined, 'Teachers summary: active count present')
  assert(teachersJson.data?.summary?.departments !== undefined, 'Teachers summary: unique departments count present')
  assert(Array.isArray(teachersJson.data?.items), 'Teachers items list returned as array')
  if (teachersJson.data?.items?.length > 0) {
    const t0 = teachersJson.data.items[0]
    assert(Array.isArray(t0.assignments), 'Teaching assignments array is present on teacher record')
  }

  // --- Test 6: Academic Management ---
  console.log('\n--- 6. Testing Academic Management (Courses & Subjects) ---')
  const coursesRes = await fetch(`${BASE_URL}/api/admin/courses`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  })
  const coursesJson = await coursesRes.json()
  assert(coursesRes.status === 200, 'GET /api/admin/courses returns 200')
  assert(Array.isArray(coursesJson.data?.items), 'Courses items returned as array')

  const subjectsRes = await fetch(`${BASE_URL}/api/admin/subjects`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  })
  const subjectsJson = await subjectsRes.json()
  assert(subjectsRes.status === 200, 'GET /api/admin/subjects returns 200')
  assert(Array.isArray(subjectsJson.data?.items), 'Subjects items returned as array')

  // --- Test 7: Canonical Departments ---
  console.log('\n--- 7. Testing Admin Departments API ---')
  const deptsRes = await fetch(`${BASE_URL}/api/admin/departments`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  })
  const deptsJson = await deptsRes.json()
  assert(deptsRes.status === 200, 'GET /api/admin/departments returns 200')
  assert(Array.isArray(deptsJson.data?.items), 'Canonical departments items returned as array')

  // --- Test 8: Timetable ---
  console.log('\n--- 8. Testing Admin Timetable API ---')
  const ttRes = await fetch(`${BASE_URL}/api/admin/timetable`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  })
  const ttJson = await ttRes.json()
  assert(ttRes.status === 200, 'GET /api/admin/timetable returns 200')
  assert(ttJson.data?.summary?.totalEntries !== undefined, 'Timetable summary: total entries present')
  assert(Array.isArray(ttJson.data?.items), 'Timetable entries returned as array')

  // --- Test 9: Attendance Monitoring ---
  console.log('\n--- 9. Testing Admin Attendance API ---')
  const attRes = await fetch(`${BASE_URL}/api/admin/attendance`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  })
  const attJson = await attRes.json()
  assert(attRes.status === 200, 'GET /api/admin/attendance returns 200')
  assert(Array.isArray(attJson.data?.items), 'Attendance session items returned as array')

  const attStatsRes = await fetch(`${BASE_URL}/api/admin/attendance/stats`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  })
  const attStatsJson = await attStatsRes.json()
  assert(attStatsRes.status === 200, 'GET /api/admin/attendance/stats returns 200')
  assert(attStatsJson.data?.todayPercentage !== undefined, 'Card 1: Today attendance present')
  assert(attStatsJson.data?.presentToday !== undefined, 'Card 2: Present count present')
  assert(attStatsJson.data?.absentToday !== undefined, 'Card 3: Absent count present')
  assert(attStatsJson.data?.lateToday !== undefined, 'Card 4: Late count present')
  assert(attStatsJson.data?.lowAttendanceCount !== undefined, 'Card 5: Low attendance count present')

  // --- Test 10: Analytics ---
  console.log('\n--- 10. Testing Admin Analytics API ---')
  const analyticsRes = await fetch(`${BASE_URL}/api/admin/analytics`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  })
  const analyticsJson = await analyticsRes.json()
  assert(analyticsRes.status === 200, 'GET /api/admin/analytics returns 200')
  assert(analyticsJson.data?.kpis?.overallPercentage !== undefined, 'Card 1: overallPercentage present')
  assert(analyticsJson.data?.kpis?.studentsBelowThreshold !== undefined, 'Card 2: studentsBelowThreshold present')
  assert(analyticsJson.data?.kpis?.bestDepartment !== undefined, 'Card 3: bestDepartment present')
  assert(analyticsJson.data?.kpis?.lowestDepartment !== undefined, 'Card 4: lowestDepartment present')
  assert(analyticsJson.data?.kpis?.totalSessions !== undefined, 'Card 5: totalSessions present')
  assert(Array.isArray(analyticsJson.data?.trend), 'Chart 1: trend array present')
  assert(Array.isArray(analyticsJson.data?.departmentWise), 'Chart 2: departmentWise present')
  assert(Array.isArray(analyticsJson.data?.yearWise), 'Chart 3: yearWise present')
  assert(Array.isArray(analyticsJson.data?.sectionWise), 'Chart 4: sectionWise present')
  assert(Array.isArray(analyticsJson.data?.subjectWise), 'Chart 5: subjectWise present')
  assert(analyticsJson.data?.studentDistribution !== undefined, 'Chart 6: studentDistribution present')
  assert(Array.isArray(analyticsJson.data?.lowAttendance), 'Chart 7: lowAttendance list present')
  assert(analyticsJson.data?.distribution !== undefined, 'Chart 8: status distribution present')
  assert(Array.isArray(analyticsJson.data?.teacherAnalytics), 'Chart 9: teacher descriptive analytics present')

  // --- Test 11: Announcements ---
  console.log('\n--- 11. Testing Admin Announcements API ---')
  const annRes = await fetch(`${BASE_URL}/api/admin/announcements`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  })
  const annJson = await annRes.json()
  assert(annRes.status === 200, 'GET /api/admin/announcements returns 200')
  assert(annJson.data?.summary?.total !== undefined, 'Card 1: total announcements present')
  assert(annJson.data?.summary?.published !== undefined, 'Card 2: published announcements present')
  assert(annJson.data?.summary?.scheduled !== undefined, 'Card 3: scheduled announcements present')
  assert(annJson.data?.summary?.drafts !== undefined, 'Card 4: draft announcements present')
  assert(Array.isArray(annJson.data?.items), 'Announcements items returned as array')

  // --- Test 12: Reports ---
  console.log('\n--- 12. Testing Admin Reports API ---')
  const repRes = await fetch(`${BASE_URL}/api/admin/reports`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  })
  const repJson = await repRes.json()
  assert(repRes.status === 200, 'GET /api/admin/reports returns 200')
  assert(repJson.data?.overall !== undefined, 'Report 1: overall attendance summary present')
  assert(Array.isArray(repJson.data?.studentAttendance), 'Report 2: studentAttendance array present')
  assert(Array.isArray(repJson.data?.departmentAttendance), 'Report 3: departmentAttendance array present')
  assert(Array.isArray(repJson.data?.subjectWise), 'Report 4: subjectWise array present')
  assert(Array.isArray(repJson.data?.teacherSessions), 'Report 5: teacherSessions array present')
  assert(Array.isArray(repJson.data?.lowAttendance), 'Report 6: lowAttendance array present')
  assert(Array.isArray(repJson.data?.dailyAttendance), 'Report 7: dailyAttendance array present')

  console.log(`\n========================================`)
  console.log(`TEST RESULTS: ${passCount} PASSED, ${failCount} FAILED`)
  console.log(`========================================`)

  await mongoose.disconnect()
  process.exit(failCount > 0 ? 1 : 0)
}

runTests().catch((err) => {
  console.error('Test execution error:', err)
  process.exit(1)
})
