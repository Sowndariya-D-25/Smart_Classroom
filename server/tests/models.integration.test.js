import { test, describe, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'

import { User, Student, Teacher, Course, Subject, Classroom, Attendance, AttendanceSession, FaceProfile } from '../models/index.js'

/**
 * Integration tests against a REAL MongoDB (an in-memory instance spun up
 * by mongodb-memory-server), so they exercise constraints that only the
 * database itself enforces — unique indexes in particular.
 *
 * NOTE: mongodb-memory-server downloads a real `mongod` binary the first
 * time it runs, which needs an internet connection. This is expected to
 * work on a normal development machine; it will NOT run in network-locked
 * sandboxes. If you don't want to wait for the download, run the pure
 * schema tests instead: `node --test tests/models.validation.test.js`.
 *
 * Run with: npm test   (from /server) — runs every *.test.js file.
 */

let mongod

before(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
})

after(async () => {
  await mongoose.disconnect()
  await mongod.stop()
})

beforeEach(async () => {
  const collections = await mongoose.connection.db.collections()
  for (const collection of collections) {
    await collection.deleteMany({})
  }
})

describe('User uniqueness', () => {
  test('rejects a second user with the same email', async () => {
    await User.create({ name: 'A', email: 'dup@example.com', password: 'password123', role: 'student' })
    await assert.rejects(
      () => User.create({ name: 'B', email: 'dup@example.com', password: 'password123', role: 'student' }),
      /duplicate|E11000/i,
    )
  })
})

describe('Student uniqueness', () => {
  test('rejects a duplicate studentId', async () => {
    const user1 = await User.create({ name: 'S1', email: 's1@example.com', password: 'password123', role: 'student' })
    const user2 = await User.create({ name: 'S2', email: 's2@example.com', password: 'password123', role: 'student' })
    const course = await Course.create({ name: 'CSE', code: 'CSE' })

    await Student.create({ user: user1._id, studentId: 'STU0001', rollNumber: '01', course: course._id })
    await assert.rejects(
      () => Student.create({ user: user2._id, studentId: 'STU0001', rollNumber: '02', course: course._id }),
      /duplicate|E11000/i,
    )
  })
})

describe('Teacher uniqueness', () => {
  test('rejects a duplicate employeeId', async () => {
    const user1 = await User.create({ name: 'T1', email: 't1@example.com', password: 'password123', role: 'teacher' })
    const user2 = await User.create({ name: 'T2', email: 't2@example.com', password: 'password123', role: 'teacher' })

    await Teacher.create({ user: user1._id, employeeId: 'TCH-001' })
    await assert.rejects(
      () => Teacher.create({ user: user2._id, employeeId: 'TCH-001' }),
      /duplicate|E11000/i,
    )
  })
})

describe('Subject uniqueness', () => {
  test('rejects a duplicate subject code', async () => {
    const course = await Course.create({ name: 'CSE', code: 'CSE' })
    await Subject.create({ name: 'DS', code: 'CS201', credits: 4, semester: 3, course: course._id })
    await assert.rejects(
      () => Subject.create({ name: 'DS 2', code: 'CS201', credits: 4, semester: 3, course: course._id }),
      /duplicate|E11000/i,
    )
  })
})

describe('Attendance duplicate prevention', () => {
  test('rejects a second attendance record for the same student + session', async () => {
    const studentUser = await User.create({ name: 'S1', email: 's1@example.com', password: 'password123', role: 'student' })
    const teacherUser = await User.create({ name: 'T1', email: 't1@example.com', password: 'password123', role: 'teacher' })
    const course = await Course.create({ name: 'CSE', code: 'CSE' })
    const student = await Student.create({ user: studentUser._id, studentId: 'STU0001', rollNumber: '01', course: course._id })
    const teacher = await Teacher.create({ user: teacherUser._id, employeeId: 'TCH-001' })
    const subject = await Subject.create({ name: 'DS', code: 'CS201', credits: 4, semester: 3, course: course._id })
    const classroom = await Classroom.create({ name: 'Room 1', code: 'CR-101', capacity: 60 })
    const session = await AttendanceSession.create({
      teacher: teacher._id,
      subject: subject._id,
      classroom: classroom._id,
      date: new Date(),
    })

    const record = {
      student: student._id,
      subject: subject._id,
      teacher: teacher._id,
      classroom: classroom._id,
      session: session._id,
      date: new Date(),
      markedBy: teacherUser._id,
    }

    await Attendance.create(record)
    await assert.rejects(() => Attendance.create(record), /duplicate|E11000/i)
  })
})

describe('FaceProfile uniqueness', () => {
  test('rejects a second face profile for the same student', async () => {
    const user = await User.create({ name: 'S1', email: 's1@example.com', password: 'password123', role: 'student' })
    const course = await Course.create({ name: 'CSE', code: 'CSE' })
    const student = await Student.create({ user: user._id, studentId: 'STU0001', rollNumber: '01', course: course._id })

    await FaceProfile.create({ student: student._id, descriptors: [[0.1, 0.2]] })
    await assert.rejects(
      () => FaceProfile.create({ student: student._id, descriptors: [[0.3, 0.4]] }),
      /duplicate|E11000/i,
    )
  })

  test('accepts valid descriptor arrays and tracks sampleCount', async () => {
    const user = await User.create({ name: 'S2', email: 's2@example.com', password: 'password123', role: 'student' })
    const course = await Course.create({ name: 'CSE', code: 'CSE' })
    const student = await Student.create({ user: user._id, studentId: 'STU0002', rollNumber: '02', course: course._id })

    const profile = await FaceProfile.create({ student: student._id, descriptors: [[0.1, 0.2], [0.3, 0.4]] })
    assert.equal(profile.sampleCount, 2)
  })
})
