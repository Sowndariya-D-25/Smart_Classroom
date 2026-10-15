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
  Announcement,
  Notification,
} from '../models/index.js'

const BASE_URL = 'http://localhost:5000'
const JWT_SECRET = process.env.JWT_SECRET || 'smart_classroom_secret_2026_change_this'

async function runVerification() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/smart-classroom')
  console.log('Connected to MongoDB:', mongoose.connection.name)

  let passed = 0
  let failed = 0

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`)
      passed++
    } else {
      console.error(`  [FAIL] ${message}`)
      failed++
    }
  }

  console.log('\n======================================================')
  console.log('1. DATABASE INTEGRITY CHECKS (NO RESET, NO WIPE)')
  console.log('======================================================')
  const studentCount = await Student.countDocuments()
  const teacherCount = await Teacher.countDocuments()
  const userCount = await User.countDocuments()
  const notifCount = await Notification.countDocuments()
  const annCount = await Announcement.countDocuments()

  assert(studentCount > 0, `Real students count in MongoDB: ${studentCount}`)
  assert(teacherCount > 0, `Real teachers count in MongoDB: ${teacherCount}`)
  assert(userCount > 0, `Real users count in MongoDB: ${userCount}`)
  assert(notifCount > 0, `Real notifications count in MongoDB: ${notifCount}`)
  assert(annCount > 0, `Real announcements count in MongoDB: ${annCount}`)

  console.log('\n======================================================')
  console.log('2. ISSUE 1 — STUDENT NOTIFICATIONS TESTS')
  console.log('======================================================')
  const studentUser1 = await User.findOne({ email: 'student1@gmail.com' })
  const studentUser2 = await User.findOne({ email: 'senthamil@gmail.com' })
  assert(studentUser1 !== null, `Test Student 1 exists: ${studentUser1?.email}`)
  assert(studentUser2 !== null, `Test Student 2 exists: ${studentUser2?.email}`)

  const token1 = jwt.sign(
    { userId: studentUser1._id.toString(), role: 'student' },
    JWT_SECRET,
    { expiresIn: '1h' },
  )
  const token2 = jwt.sign(
    { userId: studentUser2._id.toString(), role: 'student' },
    JWT_SECRET,
    { expiresIn: '1h' },
  )

  // Test unread count endpoint
  const unreadRes = await fetch(`${BASE_URL}/api/student/notifications/unread-count`, {
    headers: { Authorization: `Bearer ${token1}` },
  })
  assert(unreadRes.status === 200, 'GET /api/student/notifications/unread-count returns 200')
  const unreadJson = await unreadRes.json()
  assert(typeof unreadJson.data?.unreadCount === 'number', `Unread count returned: ${unreadJson.data?.unreadCount}`)

  // Test notifications list
  const listRes = await fetch(`${BASE_URL}/api/student/notifications`, {
    headers: { Authorization: `Bearer ${token1}` },
  })
  assert(listRes.status === 200, 'GET /api/student/notifications returns 200')
  const listJson = await listRes.json()
  assert(listJson.success === true, 'List response has success: true')
  assert(Array.isArray(listJson.data?.notifications), 'List response contains notifications array')
  assert(Array.isArray(listJson.data?.items), 'List response backward compatible items array present')

  // Verify notification fields match Teacher Notifications requirements
  if (listJson.data?.notifications?.length > 0) {
    const item = listJson.data.notifications[0]
    assert('_id' in item, 'Notification has _id')
    assert('title' in item, 'Notification has title')
    assert('message' in item, 'Notification has message')
    assert('type' in item, 'Notification has type badge field')
    assert('category' in item, 'Notification has category field')
    assert('isRead' in item, 'Notification has isRead boolean')
    assert('createdAt' in item, 'Notification has createdAt timestamp')
  }

  // Test Mark All as Read
  const markAllRes = await fetch(`${BASE_URL}/api/student/notifications/read-all`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token1}` },
  })
  assert(markAllRes.status === 200, 'PATCH /api/student/notifications/read-all returns 200')

  // Verify unread count is now 0 for Student 1
  const afterAllRes = await fetch(`${BASE_URL}/api/student/notifications/unread-count`, {
    headers: { Authorization: `Bearer ${token1}` },
  })
  const afterAllJson = await afterAllRes.json()
  assert(afterAllJson.data?.unreadCount === 0, 'Unread count for Student 1 is 0 after mark all read')

  // User-isolation test: verify Student 2 read state was NOT modified
  const student2UnreadRes = await fetch(`${BASE_URL}/api/student/notifications/unread-count`, {
    headers: { Authorization: `Bearer ${token2}` },
  })
  const student2UnreadJson = await student2UnreadRes.json()
  assert(student2UnreadJson.data?.unreadCount > 0, `Student 2 unread count isolated: ${student2UnreadJson.data?.unreadCount}`)

  console.log('\n======================================================')
  console.log('3. ISSUE 2 — DYNAMIC ACADEMIC RECORD TESTS')
  console.log('======================================================')
  // Verify student document in MongoDB
  const studentDoc1 = await Student.findOne({ user: studentUser1._id }).lean()
  assert(studentDoc1.year === 3, `Student 1 (${studentDoc1.studentId}) MongoDB stored year: ${studentDoc1.year}`)
  assert(studentDoc1.section === 'A', `Student 1 MongoDB stored section: ${studentDoc1.section}`)
  assert(studentDoc1.department === 'CSE', `Student 1 MongoDB stored department: ${studentDoc1.department}`)

  // Call student profile API
  const profileRes1 = await fetch(`${BASE_URL}/api/student/profile`, {
    headers: { Authorization: `Bearer ${token1}` },
  })
  assert(profileRes1.status === 200, 'GET /api/student/profile returns 200')
  const profileJson1 = await profileRes1.json()
  const academic1 = profileJson1.data?.academic

  assert(academic1.year === 3, `API returns real year: ${academic1.year}`)
  assert(academic1.yearLabel === '3rd Year', `API returns dynamic yearLabel: "${academic1.yearLabel}"`)
  assert(academic1.section === 'A', `API returns real section: "${academic1.section}"`)
  assert(academic1.department === 'CSE', `API returns canonical department: "${academic1.department}"`)

  // Check senthamil profile as well
  const profileRes2 = await fetch(`${BASE_URL}/api/student/profile`, {
    headers: { Authorization: `Bearer ${token2}` },
  })
  const profileJson2 = await profileRes2.json()
  const academic2 = profileJson2.data?.academic
  assert(academic2.year === 3, `Senthamil API returns real year: ${academic2.year}`)
  assert(academic2.yearLabel === '3rd Year', `Senthamil API returns dynamic yearLabel: "${academic2.yearLabel}"`)

  // Security test: ensure student cannot modify academic fields via PUT /api/student/profile
  const hackRes = await fetch(`${BASE_URL}/api/student/profile`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token1}`,
    },
    body: JSON.stringify({
      year: 4,
      department: 'HACKED',
      section: 'Z',
      name: studentUser1.name,
    }),
  })
  assert(hackRes.status === 200, 'PUT /api/student/profile executes')
  const verifyStudentDoc = await Student.findOne({ user: studentUser1._id }).lean()
  assert(verifyStudentDoc.year === 3, `Student year remains protected in MongoDB: ${verifyStudentDoc.year}`)
  assert(verifyStudentDoc.department === 'CSE', `Student department remains protected: ${verifyStudentDoc.department}`)
  assert(verifyStudentDoc.section === 'A', `Student section remains protected: ${verifyStudentDoc.section}`)

  console.log('\n======================================================')
  console.log(`TOTAL TESTS PASSED: ${passed} / ${passed + failed}`)
  console.log('======================================================')

  await mongoose.disconnect()
  process.exit(failed > 0 ? 1 : 0)
}

runVerification().catch((err) => {
  console.error('Verification failed with error:', err)
  process.exit(1)
})
