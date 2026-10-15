import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import mongoose from 'mongoose'

import {
  User,
  Student,
  Teacher,
  Subject,
  Classroom,
  Attendance,
  AttendanceSession,
  Notification,
} from '../models/index.js'

/**
 * Schema-level validation tests.
 *
 * These run WITHOUT a database connection using Mongoose's validateSync(),
 * which checks `required`, `enum`, `min`/`max`, and custom validators
 * purely in memory. They confirm the shape/rules of each schema.
 *
 * They do NOT check MongoDB-enforced constraints (unique indexes, like
 * duplicate emails or duplicate student+session attendance) — that
 * requires a real database. See models.integration.test.js for those,
 * which runs against a real (in-memory) MongoDB via mongodb-memory-server.
 *
 * Run with: npm test   (from /server)
 */

const oid = () => new mongoose.Types.ObjectId()

describe('User model validation', () => {
  test('accepts a valid user', () => {
    const user = new User({
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123',
      role: 'student',
    })
    assert.equal(user.validateSync(), undefined)
  })

  test('rejects an invalid email', () => {
    const user = new User({
      name: 'Test User',
      email: 'not-an-email',
      password: 'password123',
      role: 'student',
    })
    const err = user.validateSync()
    assert.ok(err)
    assert.ok(err.errors.email)
  })

  test('rejects an invalid role', () => {
    const user = new User({
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123',
      role: 'superadmin',
    })
    const err = user.validateSync()
    assert.ok(err)
    assert.ok(err.errors.role)
  })

  test('password is never returned by default', () => {
    // select:false means the plain document won't carry it unless
    // explicitly requested with .select('+password') at query time.
    const path = User.schema.path('password')
    assert.equal(path.options.select, false)
  })
})

describe('Student model validation', () => {
  const base = {
    user: oid(),
    studentId: 'STU0001',
    rollNumber: '01',
    course: oid(),
  }

  test('accepts a valid student', () => {
    const student = new Student(base)
    assert.equal(student.validateSync(), undefined)
  })

  test('rejects a student missing a course reference', () => {
    const student = new Student({ ...base, course: undefined })
    const err = student.validateSync()
    assert.ok(err)
    assert.ok(err.errors.course)
  })

  test('rejects an invalid gender value', () => {
    const student = new Student({ ...base, gender: 'Unknown' })
    const err = student.validateSync()
    assert.ok(err)
    assert.ok(err.errors.gender)
  })
})

describe('Teacher model validation', () => {
  test('accepts a valid teacher', () => {
    const teacher = new Teacher({ user: oid(), employeeId: 'TCH-001' })
    assert.equal(teacher.validateSync(), undefined)
  })

  test('rejects a teacher missing employeeId', () => {
    const teacher = new Teacher({ user: oid() })
    const err = teacher.validateSync()
    assert.ok(err)
    assert.ok(err.errors.employeeId)
  })
})

describe('Subject model validation', () => {
  test('accepts a valid subject', () => {
    const subject = new Subject({
      name: 'Data Structures',
      code: 'CS201',
      credits: 4,
      semester: 3,
      course: oid(),
    })
    assert.equal(subject.validateSync(), undefined)
  })

  test('rejects negative credits', () => {
    const subject = new Subject({
      name: 'Data Structures',
      code: 'CS201',
      credits: -1,
      semester: 3,
      course: oid(),
    })
    const err = subject.validateSync()
    assert.ok(err)
    assert.ok(err.errors.credits)
  })
})

describe('Classroom model validation', () => {
  test('accepts a valid classroom', () => {
    const room = new Classroom({ name: 'Lecture Hall 1', code: 'CR-101', capacity: 60 })
    assert.equal(room.validateSync(), undefined)
  })

  test('rejects a non-positive capacity', () => {
    const room = new Classroom({ name: 'Lecture Hall 1', code: 'CR-101', capacity: 0 })
    const err = room.validateSync()
    assert.ok(err)
    assert.ok(err.errors.capacity)
  })
})

describe('Attendance model validation', () => {
  const base = {
    student: oid(),
    subject: oid(),
    teacher: oid(),
    classroom: oid(),
    session: oid(),
    date: new Date(),
    markedBy: oid(),
  }

  test('accepts a valid attendance record', () => {
    const record = new Attendance(base)
    assert.equal(record.validateSync(), undefined)
  })

  test('rejects an invalid status', () => {
    const record = new Attendance({ ...base, status: 'Excused' })
    const err = record.validateSync()
    assert.ok(err)
    assert.ok(err.errors.status)
  })

  test('rejects confidence outside 0-1', () => {
    const record = new Attendance({ ...base, confidence: 1.5 })
    const err = record.validateSync()
    assert.ok(err)
    assert.ok(err.errors.confidence)
  })

  test('declares a unique compound index on student + session', () => {
    const indexes = Attendance.schema.indexes()
    const hasCompoundUnique = indexes.some(
      ([fields, options]) =>
        fields.student === 1 && fields.session === 1 && options?.unique === true,
    )
    assert.ok(hasCompoundUnique, 'expected a unique {student, session} index')
  })
})

describe('AttendanceSession model validation', () => {
  test('accepts a valid session', () => {
    const session = new AttendanceSession({
      teacher: oid(),
      subject: oid(),
      classroom: oid(),
      date: new Date(),
    })
    assert.equal(session.validateSync(), undefined)
  })

  test('rejects an invalid status', () => {
    const session = new AttendanceSession({
      teacher: oid(),
      subject: oid(),
      classroom: oid(),
      date: new Date(),
      status: 'Paused',
    })
    const err = session.validateSync()
    assert.ok(err)
    assert.ok(err.errors.status)
  })
})

describe('Notification model validation', () => {
  test('accepts a valid notification', () => {
    const n = new Notification({
      recipient: oid(),
      title: 'Hello',
      message: 'World',
      type: 'SYSTEM',
    })
    assert.equal(n.validateSync(), undefined)
  })

  test('rejects an invalid type', () => {
    const n = new Notification({
      recipient: oid(),
      title: 'Hello',
      message: 'World',
      type: 'SPAM',
    })
    const err = n.validateSync()
    assert.ok(err)
    assert.ok(err.errors.type)
  })
})
