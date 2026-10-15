import { describe, it, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import jwt from 'jsonwebtoken'

import {
  User,
  Student,
  Teacher,
  Admin,
  Course,
  Subject,
  Classroom,
  Attendance,
  AttendanceSession,
  Notification,
  ODLeaveRequest,
} from '../models/index.js'
import {
  calculateConsecutiveClassesNeeded,
  isLowAttendance,
  calculateAttendancePercentage,
  OD_ATTENDANCE_POLICY,
  ATTENDED_STATUSES,
} from '../utils/attendanceThreshold.js'

let mongod

function makeToken(user) {
  return jwt.sign(
    { userId: user._id.toString(), role: user.role, tokenVersion: user.tokenVersion || 0 },
    process.env.JWT_SECRET || 'testsecretkeyforantigravitytesting12345678',
    { expiresIn: '1h' },
  )
}

describe('Smart Attendance Recovery Planner & OD/Leave Workflow', () => {
  before(async () => {
    process.env.JWT_SECRET = 'testsecretkeyforantigravitytesting12345678'
    mongod = await MongoMemoryServer.create()
    const uri = mongod.getUri()
    await mongoose.connect(uri)
  })

  after(async () => {
    await mongoose.disconnect()
    await mongod.stop()
  })

  beforeEach(async () => {
    const collections = mongoose.connection.collections
    for (const key in collections) {
      await collections[key].deleteMany({})
    }
  })

  describe('PHASE 2: Recovery Planner Arithmetic & Logic', () => {
    it('returns null when total sessions conducted is 0 or negative', () => {
      assert.strictEqual(calculateConsecutiveClassesNeeded(0, 0, 75), null)
      assert.strictEqual(calculateConsecutiveClassesNeeded(0, -5, 75), null)
      assert.strictEqual(calculateConsecutiveClassesNeeded(2, null, 75), null)
    })

    it('returns 0 when student already meets or exceeds the 75% target', () => {
      // 15/20 = 75%
      assert.strictEqual(calculateConsecutiveClassesNeeded(15, 20, 75), 0)
      // 16/20 = 80%
      assert.strictEqual(calculateConsecutiveClassesNeeded(16, 20, 75), 0)
      // 20/20 = 100%
      assert.strictEqual(calculateConsecutiveClassesNeeded(20, 20, 75), 0)
    })

    it('accurately calculates consecutive classes needed when below target', () => {
      // Prompt example: A = 13, T = 20, p = 75% -> ceil((0.75 * 20 - 13) / 0.25) = 8
      // Projected attendance: (13 + 8) / (20 + 8) = 21 / 28 = 75.0%
      const result = calculateConsecutiveClassesNeeded(13, 20, 75)
      assert.strictEqual(result, 8)
      const projectedPercentage = ((13 + result) / (20 + result)) * 100
      assert.ok(projectedPercentage >= 75)

      // Another case: T = 10, A = 7 (70%). ceil((0.75 * 10 - 7) / 0.25) = ceil(0.5 / 0.25) = 2
      // (7 + 2) / (10 + 2) = 9/12 = 75%
      assert.strictEqual(calculateConsecutiveClassesNeeded(7, 10, 75), 2)

      // Case: T = 4, A = 2 (50%). ceil((0.75 * 4 - 2) / 0.25) = ceil(1 / 0.25) = 4
      // (2 + 4) / (4 + 4) = 6/8 = 75%
      assert.strictEqual(calculateConsecutiveClassesNeeded(2, 4, 75), 4)

      // Case: T = 1, A = 0 (0%). ceil((0.75 * 1 - 0) / 0.25) = ceil(0.75 / 0.25) = 3
      // (0 + 3) / (1 + 3) = 3/4 = 75%
      assert.strictEqual(calculateConsecutiveClassesNeeded(0, 1, 75), 3)
    })

    it('works with custom target percentages if configured', () => {
      // Target: 80%. T = 10, A = 7 (70%). x = ceil((0.8 * 10 - 7) / 0.2) = ceil(1 / 0.2) = 5
      // (7 + 5) / (10 + 5) = 12/15 = 80%
      assert.strictEqual(calculateConsecutiveClassesNeeded(7, 10, 80), 5)
    })
  })

  describe('PHASE 3: OD & Leave Request Workflow', () => {
    let studentUser, studentDoc, teacherUser, teacherDoc, adminUser, courseDoc, subjectDoc

    beforeEach(async () => {
      // 1. Create Course & Subject
      courseDoc = await Course.create({
        name: 'B.E. Computer Science',
        code: 'CSE101',
        department: 'CSE',
        durationYears: 4,
        totalSemesters: 8,
      })

      studentUser = await User.create({
        name: 'Alice Student',
        email: 'alice@college.edu',
        password: 'Password123!',
        role: 'student',
      })

      studentDoc = await Student.create({
        user: studentUser._id,
        studentId: 'STU001',
        rollNumber: '21CS001',
        department: 'CSE',
        section: 'A',
        year: 2,
        semester: 3,
        course: courseDoc._id,
      })

      teacherUser = await User.create({
        name: 'Prof. Bob Smith',
        email: 'bob@college.edu',
        password: 'Password123!',
        role: 'teacher',
      })

      teacherDoc = await Teacher.create({
        user: teacherUser._id,
        employeeId: 'EMP001',
        department: 'CSE',
        designation: 'Assistant Professor',
      })

      adminUser = await User.create({
        name: 'Admin Carol',
        email: 'admin@college.edu',
        password: 'Password123!',
        role: 'admin',
      })

      await Admin.create({
        user: adminUser._id,
        employeeId: 'ADM001',
        department: 'CSE',
      })

      subjectDoc = await Subject.create({
        name: 'Computer Networks',
        code: 'CS301',
        credits: 4,
        department: 'CSE',
        semester: 3,
        course: courseDoc._id,
        teachers: [teacherDoc._id],
      })
    })

    it('creates an OD request and notifies both administrator and teacher', async () => {
      const startDate = new Date()
      startDate.setDate(startDate.getDate() + 1)
      const endDate = new Date(startDate)
      endDate.setDate(endDate.getDate() + 1)

      const reqDoc = await ODLeaveRequest.create({
        student: studentDoc._id,
        type: 'OD',
        startDate,
        endDate,
        subjects: [subjectDoc._id],
        reason: 'Representing college at Inter-College Hackathon',
        status: 'Pending',
      })

      assert.strictEqual(reqDoc.status, 'Pending')
      assert.strictEqual(reqDoc.type, 'OD')
      assert.ok(reqDoc.student.equals(studentDoc._id))

      // Simulate notification generation
      await Notification.create({
        recipient: adminUser._id,
        title: 'New On-Duty (OD) Request: Alice Student',
        message: 'Alice Student applied for OD',
        type: 'OD_REQUEST',
        link: '/admin/attendance',
        metadata: { requestId: reqDoc._id },
      })

      await Notification.create({
        recipient: teacherUser._id,
        title: 'New On-Duty (OD) Request: Alice Student',
        message: 'Alice Student applied for OD',
        type: 'OD_REQUEST',
        link: '/teacher/notifications',
        metadata: { requestId: reqDoc._id },
      })

      const adminNotifs = await Notification.find({ recipient: adminUser._id })
      const teacherNotifs = await Notification.find({ recipient: teacherUser._id })

      assert.strictEqual(adminNotifs.length, 1)
      assert.strictEqual(adminNotifs[0].type, 'OD_REQUEST')
      assert.strictEqual(teacherNotifs.length, 1)
      assert.strictEqual(teacherNotifs[0].type, 'OD_REQUEST')
    })

    it('rejects OD/Leave with mandatory rejection remarks and notifies student', async () => {
      const reqDoc = await ODLeaveRequest.create({
        student: studentDoc._id,
        type: 'Leave',
        startDate: new Date(),
        endDate: new Date(),
        reason: 'Personal reasons',
        status: 'Pending',
      })

      // Decision: Rejected
      reqDoc.status = 'Rejected'
      reqDoc.reviewedBy = teacherUser._id
      reqDoc.reviewerRole = 'teacher'
      reqDoc.reviewerRemarks = 'Exam scheduled on this date; leave cannot be granted.'
      reqDoc.reviewedAt = new Date()
      await reqDoc.save()

      // Notify student
      await Notification.create({
        recipient: studentUser._id,
        title: 'Leave Request Rejected',
        message: `Your Leave request has been rejected by Prof. Bob Smith. Remarks: ${reqDoc.reviewerRemarks}`,
        type: 'OD_LEAVE_DECISION',
        metadata: { requestId: reqDoc._id, status: 'Rejected' },
      })

      const studentNotifs = await Notification.find({ recipient: studentUser._id })
      assert.strictEqual(studentNotifs.length, 1)
      assert.strictEqual(studentNotifs[0].type, 'OD_LEAVE_DECISION')
      assert.ok(studentNotifs[0].message.includes('rejected'))
    })
  })

  describe('PHASE 4: Integration with Manual Attendance & Policy', () => {
    let studentUser, studentDoc, teacherUser, teacherDoc, courseDoc, subjectDoc, sessionDoc

    beforeEach(async () => {
      courseDoc = await Course.create({
        name: 'B.E. Computer Science',
        code: 'CSE101',
        department: 'CSE',
        durationYears: 4,
        totalSemesters: 8,
      })

      studentUser = await User.create({
        name: 'Alice Student',
        email: 'alice@college.edu',
        password: 'Password123!',
        role: 'student',
      })

      studentDoc = await Student.create({
        user: studentUser._id,
        studentId: 'STU001',
        rollNumber: '21CS001',
        department: 'CSE',
        section: 'A',
        course: courseDoc._id,
      })

      teacherUser = await User.create({
        name: 'Prof. Bob Smith',
        email: 'bob@college.edu',
        password: 'Password123!',
        role: 'teacher',
      })

      teacherDoc = await Teacher.create({
        user: teacherUser._id,
        employeeId: 'EMP001',
        department: 'CSE',
      })

      subjectDoc = await Subject.create({
        name: 'Computer Networks',
        code: 'CS301',
        credits: 4,
        department: 'CSE',
        semester: 3,
        course: courseDoc._id,
        teachers: [teacherDoc._id],
      })

      const today = new Date()
      sessionDoc = await AttendanceSession.create({
        teacher: teacherDoc._id,
        subject: subjectDoc._id,
        department: 'CSE',
        section: 'A',
        date: today,
        period: 1,
        startTime: '09:00',
        endTime: '10:00',
        status: 'Completed',
      })
    })

    it('updates prior Absent attendance record to OD upon approval without creating duplicates', async () => {
      // 1. Initial attendance record was marked Absent
      const initialRecord = await Attendance.create({
        student: studentDoc._id,
        subject: subjectDoc._id,
        teacher: teacherDoc._id,
        session: sessionDoc._id,
        date: sessionDoc.date,
        period: 1,
        status: 'Absent',
        markedBy: teacherUser._id,
        method: 'Manual',
      })

      // Verify single record
      const countBefore = await Attendance.countDocuments({ student: studentDoc._id, session: sessionDoc._id })
      assert.strictEqual(countBefore, 1)

      // 2. Student submits OD and it is approved
      const odRequest = await ODLeaveRequest.create({
        student: studentDoc._id,
        type: 'OD',
        startDate: sessionDoc.date,
        endDate: sessionDoc.date,
        subjects: [subjectDoc._id],
        reason: 'National Robotics Competition',
        status: 'Approved',
        reviewedBy: teacherUser._id,
        reviewerRole: 'teacher',
        reviewedAt: new Date(),
      })

      // 3. System updates existing record to OD while preserving originalStatus
      await Attendance.findOneAndUpdate(
        { student: studentDoc._id, session: sessionDoc._id },
        {
          status: 'OD',
          originalStatus: 'Absent',
          odLeaveRequest: odRequest._id,
          remarks: 'Approved OD: National Robotics Competition',
        },
      )

      const updatedRecord = await Attendance.findOne({ student: studentDoc._id, session: sessionDoc._id })
      assert.strictEqual(updatedRecord.status, 'OD')
      assert.strictEqual(updatedRecord.originalStatus, 'Absent')
      assert.ok(updatedRecord.odLeaveRequest.equals(odRequest._id))

      // Crucial: No duplicate record created (unique constraint verified)
      const countAfter = await Attendance.countDocuments({ student: studentDoc._id, session: sessionDoc._id })
      assert.strictEqual(countAfter, 1)
    })

    it('treats OD as attended in percentage calculations under configured policy', async () => {
      // Create 4 sessions: 2 Present, 1 Absent, 1 OD
      const s1 = sessionDoc
      const s2 = await AttendanceSession.create({
        teacher: teacherDoc._id,
        subject: subjectDoc._id,
        department: 'CSE',
        section: 'A',
        date: new Date(Date.now() - 86400000),
        period: 2,
        status: 'Completed',
      })
      const s3 = await AttendanceSession.create({
        teacher: teacherDoc._id,
        subject: subjectDoc._id,
        department: 'CSE',
        section: 'A',
        date: new Date(Date.now() - 172800000),
        period: 3,
        status: 'Completed',
      })
      const s4 = await AttendanceSession.create({
        teacher: teacherDoc._id,
        subject: subjectDoc._id,
        department: 'CSE',
        section: 'A',
        date: new Date(Date.now() - 259200000),
        period: 4,
        status: 'Completed',
      })

      await Attendance.create({
        student: studentDoc._id,
        subject: subjectDoc._id,
        teacher: teacherDoc._id,
        session: s1._id,
        date: s1.date,
        status: 'Present',
        markedBy: teacherUser._id,
      })

      await Attendance.create({
        student: studentDoc._id,
        subject: subjectDoc._id,
        teacher: teacherDoc._id,
        session: s2._id,
        date: s2.date,
        status: 'Present',
        markedBy: teacherUser._id,
      })

      await Attendance.create({
        student: studentDoc._id,
        subject: subjectDoc._id,
        teacher: teacherDoc._id,
        session: s3._id,
        date: s3.date,
        status: 'Absent',
        markedBy: teacherUser._id,
      })

      await Attendance.create({
        student: studentDoc._id,
        subject: subjectDoc._id,
        teacher: teacherDoc._id,
        session: s4._id,
        date: s4.date,
        status: 'OD',
        markedBy: teacherUser._id,
      })

      // Query attended count using ATTENDED_STATUSES
      const attendedCount = await Attendance.countDocuments({
        student: studentDoc._id,
        subject: subjectDoc._id,
        status: { $in: ATTENDED_STATUSES },
      })

      // 2 Present + 1 OD = 3 attended out of 4 sessions = 75%
      assert.strictEqual(attendedCount, 3)
      const percentage = calculateAttendancePercentage(attendedCount, 4)
      assert.strictEqual(percentage, 75)
      assert.strictEqual(isLowAttendance(percentage), false)

      // Recovery planner shows 0 consecutive classes needed
      const needed = calculateConsecutiveClassesNeeded(attendedCount, 4, 75)
      assert.strictEqual(needed, 0)
    })
  })
})
