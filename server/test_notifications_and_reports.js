import mongoose from 'mongoose'
import dotenv from 'dotenv'
import app from './app.js'
import {
  User,
  Teacher,
  Subject,
  Classroom,
  Student,
  Attendance,
  AttendanceSession,
  Announcement,
  Notification,
} from './models/index.js'

dotenv.config()

async function runTests() {
  console.log('========================================================')
  console.log('TEACHER NOTIFICATIONS & REPORTS: FULL VERIFICATION TEST')
  console.log('========================================================\n')

  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/smart-classroom')
  console.log('✓ Connected to MongoDB')

  const server = app.listen(0)
  const port = server.address().port
  const BASE = `http://127.0.0.1:${port}`

  try {
    // 1. Authenticate users
    console.log('\n--- 1. Authenticating Admin, Teacher 1, and Teacher 2 ---')
    const login = async (email, password) => {
      const res = await fetch(`${BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const json = await res.json()
      if (!json.success || !json.data?.token) {
        throw new Error(`Login failed for ${email}: ${JSON.stringify(json)}`)
      }
      return json.data.token
    }

    const adminToken = await login('admin@smartclassroom.local', 'Password123!')
    const teacher1Token = await login('teacher1@smartclassroom.local', 'Password123!')
    const teacher2Token = await login('teacher2@smartclassroom.local', 'Password123!')

    console.log('✓ Admin authenticated')
    console.log('✓ Teacher 1 authenticated')
    console.log('✓ Teacher 2 authenticated')

    const adminHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }
    const t1Headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${teacher1Token}` }
    const t2Headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${teacher2Token}` }

    // Clean test announcements
    await Announcement.deleteMany({ title: 'Faculty Meeting - Verification Test' })

    // 2. Test 1: Admin creates announcement
    console.log('\n--- 2. TEST 1: Admin Creates and Publishes Announcement ---')
    const createRes = await fetch(`${BASE}/api/admin/announcements`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        title: 'Faculty Meeting - Verification Test',
        message: 'All CSE faculty members are requested to attend the department meeting.',
        type: 'Meeting',
        targetAudience: 'All Teachers',
        date: '25 September 2026',
        time: '2:00 PM',
        venue: 'Seminar Hall',
        isPublished: true,
      }),
    })
    const createJson = await createRes.json()
    if (!createJson.success) throw new Error(`Announcement creation failed: ${JSON.stringify(createJson)}`)
    const announcementId = createJson.data._id
    console.log(`✓ Admin created announcement: ID ${announcementId}`)

    // Verify Teacher 1 sees it
    const t1NotifsRes = await fetch(`${BASE}/api/teacher/notifications`, { headers: t1Headers })
    const t1NotifsJson = await t1NotifsRes.json()
    const t1Found = t1NotifsJson.data.notifications.find((n) => n._id === announcementId)
    if (!t1Found) throw new Error('Teacher 1 did not receive the published announcement!')
    console.log(`✓ Teacher 1 sees announcement in feed: "${t1Found.title}"`)

    // Verify Teacher 2 sees it
    const t2NotifsRes = await fetch(`${BASE}/api/teacher/notifications`, { headers: t2Headers })
    const t2NotifsJson = await t2NotifsRes.json()
    const t2Found = t2NotifsJson.data.notifications.find((n) => n._id === announcementId)
    if (!t2Found) throw new Error('Teacher 2 did not receive the published announcement!')
    console.log(`✓ Teacher 2 sees announcement in feed: "${t2Found.title}"`)

    // 3. Test 2: Per-Teacher Read Receipt Rule
    console.log('\n--- 3. TEST 2: Per-Teacher Read Status Independence ---')
    console.log(`Initial read status: Teacher 1 isRead=${t1Found.isRead}, Teacher 2 isRead=${t2Found.isRead}`)
    if (t1Found.isRead || t2Found.isRead) throw new Error('Initial status should be unread!')

    // Teacher 1 marks as read
    const markRes = await fetch(`${BASE}/api/teacher/notifications/${announcementId}/read`, {
      method: 'PATCH',
      headers: t1Headers,
    })
    const markJson = await markRes.json()
    if (!markJson.success) throw new Error(`Failed to mark read: ${JSON.stringify(markJson)}`)

    // Refetch Teacher 1 notifications
    const t1AfterRes = await fetch(`${BASE}/api/teacher/notifications`, { headers: t1Headers })
    const t1AfterJson = await t1AfterRes.json()
    const t1After = t1AfterJson.data.notifications.find((n) => n._id === announcementId)

    // Refetch Teacher 2 notifications
    const t2AfterRes = await fetch(`${BASE}/api/teacher/notifications`, { headers: t2Headers })
    const t2AfterJson = await t2AfterRes.json()
    const t2After = t2AfterJson.data.notifications.find((n) => n._id === announcementId)

    console.log(`After Teacher 1 opens: Teacher 1 isRead=${t1After.isRead}, Teacher 2 isRead=${t2After.isRead}`)
    if (!t1After.isRead) throw new Error('Teacher 1 should be read!')
    if (t2After.isRead) throw new Error('Teacher 2 should still be unread (isolated per teacher)!')
    console.log('✓ Per-teacher read receipt verified: Teacher 1 is Read, Teacher 2 is still Unread')

    // 4. Test 3: Mark All as Read
    console.log('\n--- 4. TEST 3: Teacher 2 Mark All as Read ---')
    const markAllRes = await fetch(`${BASE}/api/teacher/notifications/read-all`, {
      method: 'PATCH',
      headers: t2Headers,
    })
    const markAllJson = await markAllRes.json()
    if (!markAllJson.success) throw new Error('Mark all as read failed!')

    const t2CountRes = await fetch(`${BASE}/api/teacher/notifications/unread-count`, { headers: t2Headers })
    const t2CountJson = await t2CountRes.json()
    console.log(`Teacher 2 unread count after Mark All: ${t2CountJson.data.unreadCount}`)
    if (t2CountJson.data.unreadCount !== 0) throw new Error('Teacher 2 unread count should be 0!')
    console.log('✓ Mark All as Read verified: unread count is 0')

    // 5. Test 4: System Attendance Notifications
    console.log('\n--- 5. TEST 4: System Attendance Notifications ---')
    const teacher1User = await User.findOne({ email: 'teacher1@smartclassroom.local' })
    const teacher1 = await Teacher.findOne({ user: teacher1User._id })
    const subject = await Subject.findOne({ teachers: teacher1._id })
    const classroom = await Classroom.findOne({ isActive: true })

    // Create session
    const sessRes = await fetch(`${BASE}/api/teacher/attendance/sessions`, {
      method: 'POST',
      headers: t1Headers,
      body: JSON.stringify({
        subject: subject._id,
        classroom: classroom._id,
        date: new Date().toISOString(),
        period: 9,
        startTime: '15:00',
        endTime: '16:00',
        department: 'Computer Science',
        section: 'A',
      }),
    })
    const sessJson = await sessRes.json()
    if (!sessJson.success) throw new Error(`Create session failed: ${JSON.stringify(sessJson)}`)
    const sessionId = sessJson.data.session._id
    console.log(`Created test session: ${sessionId}`)

    // Complete session
    const compRes = await fetch(`${BASE}/api/teacher/attendance/sessions/${sessionId}/complete`, {
      method: 'POST',
      headers: t1Headers,
    })
    const compJson = await compRes.json()
    if (!compJson.success) throw new Error(`Complete session failed: ${JSON.stringify(compJson)}`)
    console.log('Session completed successfully')

    // Verify Teacher 1 has system notification
    const t1SysNotifsRes = await fetch(`${BASE}/api/teacher/notifications?filter=attendance`, { headers: t1Headers })
    const t1SysNotifsJson = await t1SysNotifsRes.json()
    const attNotif = t1SysNotifsJson.data.notifications.find((n) => n.metadata?.sessionId === sessionId)
    if (!attNotif) throw new Error('Attendance completion system notification not generated!')
    console.log(`✓ System notification verified: "${attNotif.title}" - ${attNotif.message.replace(/\n/g, ' ')}`)

    // 6. Test 5: Teacher Reports Full Analytics
    console.log('\n--- 6. TEST 5: Teacher Reports - Database Analytics & KPIs ---')
    const repOptionsRes = await fetch(`${BASE}/api/teacher/reports/filter-options`, { headers: t1Headers })
    const repOptionsJson = await repOptionsRes.json()
    if (!repOptionsJson.success) throw new Error('Filter options failed')
    console.log(`✓ Filter options loaded: ${repOptionsJson.data.subjects.length} subjects, ${repOptionsJson.data.students.length} students`)

    const repRes = await fetch(`${BASE}/api/teacher/reports`, { headers: t1Headers })
    const repJson = await repRes.json()
    if (!repJson.success) throw new Error('Get reports failed')
    const rData = repJson.data

    console.log('KPI Cards Data:')
    console.log(`  Total Students: ${rData.kpis.totalStudents}`)
    console.log(`  Average Attendance: ${rData.kpis.averageAttendance}%`)
    console.log(`  Present Today: ${rData.kpis.presentToday}`)
    console.log(`  Absent Today: ${rData.kpis.absentToday}`)
    console.log(`  Low Attendance Count (<75%): ${rData.kpis.lowAttendanceCount}`)

    console.log('\nAttendance Method Breakdown:')
    console.log(`  Face Recognition: ${rData.methodAnalytics.faceCount} (${rData.methodAnalytics.facePercentage}%)`)
    console.log(`  Manual: ${rData.methodAnalytics.manualCount} (${rData.methodAnalytics.manualPercentage}%)`)
    console.log(`  Total Records: ${rData.methodAnalytics.totalRecords}`)

    console.log('\nFace Recognition Summary:')
    console.log(`  Face Sessions: ${rData.faceSummary.faceSessionsCount}`)
    console.log(`  Students Recognized: ${rData.faceSummary.studentsRecognized}`)
    console.log(`  Students Not Recognized: ${rData.faceSummary.studentsNotRecognized}`)
    console.log(`  Unknown Faces: ${rData.faceSummary.unknownFacesCount}`)

    console.log(`\nSubject-Wise Attendance Table (${rData.subjectWise.length} subjects):`)
    rData.subjectWise.forEach((s) => {
      console.log(`  ${s.subject.code} (${s.subject.name}): ${s.percentage}% (${s.present} Present, ${s.absent} Absent, ${s.totalSessions} Sessions)`)
    })

    console.log(`\nStudents Below 75% Threshold (${rData.lowAttendance.length} records):`)
    rData.lowAttendance.slice(0, 3).forEach((l) => {
      console.log(`  ${l.student.name} (${l.student.rollNumber}): ${l.subject.code} -> ${l.percentage}% (${l.present}/${l.totalClasses})`)
    })

    // Test drill-down on session
    console.log('\n--- 7. TEST 6: Interactive Session & Student Drill-Down ---')
    const sessionDetailRes = await fetch(`${BASE}/api/teacher/reports/session/${sessionId}`, { headers: t1Headers })
    const sessionDetailJson = await sessionDetailRes.json()
    if (!sessionDetailJson.success) throw new Error('Session detail drill-down failed')
    console.log(`✓ Session drill-down successful: ${sessionDetailJson.data.students.length} students rostered, ${sessionDetailJson.data.summary.present} present`)

    // Test drill-down on student
    if (rData.studentAttendance.length > 0) {
      const firstStudentId = rData.studentAttendance[0].student._id
      const studentDetailRes = await fetch(`${BASE}/api/teacher/reports/student/${firstStudentId}`, { headers: t1Headers })
      const studentDetailJson = await studentDetailRes.json()
      if (!studentDetailJson.success) throw new Error('Student detail drill-down failed')
      console.log(`✓ Student drill-down successful for "${studentDetailJson.data.student.name}": ${studentDetailJson.data.summary.percentage}% rate across ${studentDetailJson.data.summary.totalClasses} classes`)
    }

    console.log('\n========================================================')
    console.log('ALL VERIFICATION TESTS COMPLETED SUCCESSFULLY!')
    console.log('========================================================\n')
  } finally {
    server.close()
    await mongoose.connection.close()
  }
}

runTests().catch((err) => {
  console.error('\n❌ TEST RUN FAILED:', err)
  process.exit(1)
})
