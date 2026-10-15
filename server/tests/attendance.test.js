import { test, describe, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import request from 'supertest'

/**
 * Phase 8 — Attendance Management tests: history, session details,
 * class-attendance percentages, the low-attendance threshold, and
 * student-facing attendance access. Builds on (and doesn't repeat) the
 * ownership/creation/duplicate-prevention coverage already in
 * teacher.test.js and faceRecognition.test.js.
 *
 * Same mongodb-memory-server caveat as every other DB-backed suite in
 * this project: downloads a real `mongod` on first run, needs internet,
 * won't run in a network-locked sandbox.
 *
 * Run with: npm test   (from /server)
 */

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only-secret-do-not-use-in-real-deployments'
process.env.JWT_EXPIRES_IN = '1h'
process.env.NODE_ENV = 'test'
process.env.LOW_ATTENDANCE_THRESHOLD = '75'

let mongod
let app
let User, Course, Subject, Teacher, Student, Classroom, AttendanceSession, Attendance

before(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
  ;({ default: app } = await import('../app.js'))
  ;({ User, Course, Subject, Teacher, Student, Classroom, AttendanceSession, Attendance } = await import('../models/index.js'))
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

async function makeTeacher(employeeId) {
  const user = await User.create({ name: `T ${employeeId}`, email: `${employeeId.toLowerCase()}@example.com`, password: 'Password123', role: 'teacher' })
  const teacher = await Teacher.create({ user: user._id, employeeId })
  const login = await request(app).post('/api/auth/login').send({ email: user.email, password: 'Password123' })
  return { user, teacher, token: login.body.data.token }
}

let codeCounter = 200
function makeCode(prefix = 'C') {
  codeCounter += 1
  return `${prefix}${Date.now().toString().slice(-4)}${codeCounter}`.slice(0, 18).toUpperCase()
}

async function makeStudent(course, studentId, dept = 'CSE', sec = 'A') {
  const user = await User.create({ name: `Student ${studentId}`, email: `${studentId.toLowerCase()}@example.com`, password: 'Password123', role: 'student' })
  const student = await Student.create({ user: user._id, studentId, rollNumber: studentId.slice(-2), course: course._id, department: dept, section: sec })
  const login = await request(app).post('/api/auth/login').send({ email: user.email, password: 'Password123' })
  return { user, student, token: login.body.data.token }
}

async function setupClass(teacherId) {
  const course = await Course.create({ name: 'B.E. CSE', code: makeCode('CSE') })
  const subject = await Subject.create({
    name: 'Data Structures',
    code: makeCode('CS'),
    credits: 4,
    semester: 3,
    course: course._id,
    teachers: [teacherId],
  })
  const classroom = await Classroom.create({ name: 'Room 1', code: makeCode('CR'), capacity: 30 })
  return { course, subject, classroom }
}

async function startSession(token, subject, classroom, date, period = 1) {
  const res = await request(app)
    .post('/api/teacher/attendance/sessions')
    .set('Authorization', `Bearer ${token}`)
    .send({ subject: subject._id.toString(), classroom: classroom._id.toString(), date, period })
  return res.body.data.session
}

describe('Authorization', () => {
  test('no token → 401 on history', async () => {
    const res = await request(app).get('/api/teacher/attendance/sessions')
    assert.equal(res.status, 401)
  })

  test('invalid token → 401', async () => {
    const res = await request(app).get('/api/teacher/attendance/sessions').set('Authorization', 'Bearer garbage')
    assert.equal(res.status, 401)
  })

  test('student → 403 on teacher attendance endpoint', async () => {
    const course = await Course.create({ name: 'CSE', code: makeCode('CSE') })
    const { token } = await makeStudent(course, 'STU9101')
    const res = await request(app).get('/api/teacher/attendance/sessions').set('Authorization', `Bearer ${token}`)
    assert.equal(res.status, 403)
  })
})

describe('Ownership', () => {
  test('teacher can access their own session; cannot access another teacher\'s', async () => {
    const a = await makeTeacher('TCH-H1')
    const b = await makeTeacher('TCH-H2')
    const { subject, classroom } = await setupClass(a.teacher._id)
    const session = await startSession(a.token, subject, classroom, '2026-02-01')

    const ownRes = await request(app).get(`/api/teacher/attendance/sessions/${session._id}`).set('Authorization', `Bearer ${a.token}`)
    assert.equal(ownRes.status, 200)

    const otherRes = await request(app).get(`/api/teacher/attendance/sessions/${session._id}`).set('Authorization', `Bearer ${b.token}`)
    assert.equal(otherRes.status, 404)
  })

  test('teacher cannot mark attendance on another teacher\'s session', async () => {
    const a = await makeTeacher('TCH-H3')
    const b = await makeTeacher('TCH-H4')
    const { course, subject, classroom } = await setupClass(a.teacher._id)
    const student = await Student.create({ user: (await User.create({ name: 'S', email: 'sH4@example.com', password: 'Password123', role: 'student' }))._id, studentId: 'STU9102', rollNumber: '02', course: course._id, department: 'CSE', section: 'A' })
    const session = await startSession(a.token, subject, classroom, '2026-02-02')

    const res = await request(app)
      .post(`/api/teacher/attendance/sessions/${session._id}/mark`)
      .set('Authorization', `Bearer ${b.token}`)
      .send({ records: [{ student: student._id.toString(), status: 'Present' }] })
    assert.equal(res.status, 404)
  })
})

describe('Session completion lifecycle', () => {
  test('an active session can be completed', async () => {
    const { token, teacher } = await makeTeacher('TCH-C1')
    const { subject, classroom } = await setupClass(teacher._id)
    const session = await startSession(token, subject, classroom, '2026-02-03')

    const res = await request(app).post(`/api/teacher/attendance/sessions/${session._id}/complete`).set('Authorization', `Bearer ${token}`)
    assert.equal(res.status, 200)
    assert.equal(res.body.data.session.status, 'Completed')
  })

  test('a completed session cannot be marked again', async () => {
    const { token, teacher } = await makeTeacher('TCH-C2')
    const { course, subject, classroom } = await setupClass(teacher._id)
    const student = await Student.create({ user: (await User.create({ name: 'S', email: 'sC2@example.com', password: 'Password123', role: 'student' }))._id, studentId: 'STU9103', rollNumber: '03', course: course._id, department: 'CSE', section: 'A' })
    const session = await startSession(token, subject, classroom, '2026-02-04')
    await request(app).post(`/api/teacher/attendance/sessions/${session._id}/complete`).set('Authorization', `Bearer ${token}`)

    const res = await request(app)
      .post(`/api/teacher/attendance/sessions/${session._id}/mark`)
      .set('Authorization', `Bearer ${token}`)
      .send({ records: [{ student: student._id.toString(), status: 'Present' }] })
    assert.equal(res.status, 400)
  })

  test('a completed session cannot be recognized against either', async () => {
    const { token, teacher } = await makeTeacher('TCH-C3')
    const { subject, classroom } = await setupClass(teacher._id)
    const session = await startSession(token, subject, classroom, '2026-02-05')
    await request(app).post(`/api/teacher/attendance/sessions/${session._id}/complete`).set('Authorization', `Bearer ${token}`)

    const res = await request(app)
      .post(`/api/teacher/attendance/sessions/${session._id}/recognize`)
      .set('Authorization', `Bearer ${token}`)
      .send({ descriptor: new Array(128).fill(0.1) })
    assert.equal(res.status, 400)
  })
})

describe('Attendance creation edge cases', () => {
  test('a student outside the session roster is skipped, not saved', async () => {
    const { token, teacher } = await makeTeacher('TCH-E1')
    const { subject, classroom } = await setupClass(teacher._id)
    const outsideCourse = await Course.create({ name: 'ECE', code: makeCode('ECE') })
    const outsideStudent = await Student.create({ user: (await User.create({ name: 'Out', email: 'outE1@example.com', password: 'Password123', role: 'student' }))._id, studentId: 'STU9104', rollNumber: '04', course: outsideCourse._id, department: 'ECE', section: 'B' })
    const session = await startSession(token, subject, classroom, '2026-02-06')

    const res = await request(app)
      .post(`/api/teacher/attendance/sessions/${session._id}/mark`)
      .set('Authorization', `Bearer ${token}`)
      .send({ records: [{ student: outsideStudent._id.toString(), status: 'Present' }] })
    assert.equal(res.status, 200)
    assert.equal(res.body.data.saved, 0)
    assert.equal(res.body.data.skipped.length, 1)

    const count = await Attendance.countDocuments({ session: session._id })
    assert.equal(count, 0)
  })

  test('duplicate manual mark for the same student+session updates in place (no duplicate-key crash)', async () => {
    const { token, teacher } = await makeTeacher('TCH-E2')
    const { course, subject, classroom } = await setupClass(teacher._id)
    const student = await Student.create({ user: (await User.create({ name: 'S', email: 'sE2@example.com', password: 'Password123', role: 'student' }))._id, studentId: 'STU9105', rollNumber: '05', course: course._id, department: 'CSE', section: 'A' })
    const session = await startSession(token, subject, classroom, '2026-02-07')

    await request(app).post(`/api/teacher/attendance/sessions/${session._id}/mark`).set('Authorization', `Bearer ${token}`).send({ records: [{ student: student._id.toString(), status: 'Absent' }] })
    const res = await request(app).post(`/api/teacher/attendance/sessions/${session._id}/mark`).set('Authorization', `Bearer ${token}`).send({ records: [{ student: student._id.toString(), status: 'Present' }] })
    assert.equal(res.status, 200)

    const records = await Attendance.find({ session: session._id, student: student._id })
    assert.equal(records.length, 1)
    assert.equal(records[0].status, 'Present')
  })
})

describe('Attendance history', () => {
  test('only the requesting teacher\'s sessions are returned', async () => {
    const a = await makeTeacher('TCH-L1')
    const b = await makeTeacher('TCH-L2')
    const classA = await setupClass(a.teacher._id)
    const classB = await setupClass(b.teacher._id)
    await startSession(a.token, classA.subject, classA.classroom, '2026-02-08')
    await startSession(b.token, classB.subject, classB.classroom, '2026-02-08')

    const res = await request(app).get('/api/teacher/attendance/sessions').set('Authorization', `Bearer ${a.token}`)
    assert.equal(res.status, 200)
    assert.equal(res.body.data.items.length, 1)
  })

  test('pagination works', async () => {
    const { token, teacher } = await makeTeacher('TCH-L3')
    const { subject, classroom } = await setupClass(teacher._id)
    for (let i = 1; i <= 3; i += 1) {
      await startSession(token, subject, classroom, `2026-02-${10 + i}`, i)
    }
    const res = await request(app).get('/api/teacher/attendance/sessions?limit=2&page=1').set('Authorization', `Bearer ${token}`)
    assert.equal(res.body.data.items.length, 2)
    assert.equal(res.body.data.pagination.total, 3)
    assert.equal(res.body.data.pagination.totalPages, 2)
  })

  test('status filter works', async () => {
    const { token, teacher } = await makeTeacher('TCH-L4')
    const { subject, classroom } = await setupClass(teacher._id)
    const session = await startSession(token, subject, classroom, '2026-02-15')
    await request(app).post(`/api/teacher/attendance/sessions/${session._id}/complete`).set('Authorization', `Bearer ${token}`)
    await startSession(token, subject, classroom, '2026-02-16', 2)

    const res = await request(app).get('/api/teacher/attendance/sessions?status=Completed').set('Authorization', `Bearer ${token}`)
    assert.equal(res.body.data.items.length, 1)
    assert.equal(res.body.data.items[0].session.status, 'Completed')
  })

  test('session history items include an attendance percentage', async () => {
    const { token, teacher } = await makeTeacher('TCH-L5')
    const { course, subject, classroom } = await setupClass(teacher._id)
    await Student.create({ user: (await User.create({ name: 'S', email: 'sL5@example.com', password: 'Password123', role: 'student' }))._id, studentId: 'STU9106', rollNumber: '06', course: course._id, department: 'CSE', section: 'A' })
    const session = await startSession(token, subject, classroom, '2026-02-17')

    const res = await request(app).get('/api/teacher/attendance/sessions').set('Authorization', `Bearer ${token}`)
    assert.equal(res.status, 200)
    assert.ok('percentage' in res.body.data.items[0])
    assert.ok('totalStudents' in res.body.data.items[0])
  })
})

describe('Session details summary', () => {
  test('getSession returns a total/present/absent/late/percentage summary', async () => {
    const { token, teacher } = await makeTeacher('TCH-D1')
    const { course, subject, classroom } = await setupClass(teacher._id)
    const s1 = await Student.create({ user: (await User.create({ name: 'S1', email: 's1D1@example.com', password: 'Password123', role: 'student' }))._id, studentId: 'STU9107', rollNumber: '07', course: course._id, department: 'CSE', section: 'A' })
    await Student.create({ user: (await User.create({ name: 'S2', email: 's2D1@example.com', password: 'Password123', role: 'student' }))._id, studentId: 'STU9108', rollNumber: '08', course: course._id, department: 'CSE', section: 'A' })
    const session = await startSession(token, subject, classroom, '2026-02-18')

    await request(app).post(`/api/teacher/attendance/sessions/${session._id}/mark`).set('Authorization', `Bearer ${token}`).send({ records: [{ student: s1._id.toString(), status: 'Present' }] })

    const res = await request(app).get(`/api/teacher/attendance/sessions/${session._id}`).set('Authorization', `Bearer ${token}`)
    assert.equal(res.status, 200)
    assert.equal(res.body.data.summary.total, 2)
    assert.equal(res.body.data.summary.present, 1)
    assert.equal(res.body.data.summary.unmarked, 1)
    assert.equal(res.body.data.summary.percentage, 50) // 1 of 2 attended
  })
})

describe('Class attendance percentage (Present + Late = attended)', () => {
  test('percentage counts Late as attended, matching the documented rule', async () => {
    const { token, teacher } = await makeTeacher('TCH-P1')
    const { course, subject, classroom } = await setupClass(teacher._id)
    const student = await Student.create({ user: (await User.create({ name: 'S', email: 'sP1@example.com', password: 'Password123', role: 'student' }))._id, studentId: 'STU9109', rollNumber: '09', course: course._id, department: 'CSE', section: 'A' })

    // Two completed sessions: one Present, one Late → should be 100%, not 50%.
    const s1 = await startSession(token, subject, classroom, '2026-02-19', 1)
    await request(app).post(`/api/teacher/attendance/sessions/${s1._id}/mark`).set('Authorization', `Bearer ${token}`).send({ records: [{ student: student._id.toString(), status: 'Present' }] })
    await request(app).post(`/api/teacher/attendance/sessions/${s1._id}/complete`).set('Authorization', `Bearer ${token}`)

    const s2 = await startSession(token, subject, classroom, '2026-02-20', 1)
    await request(app).post(`/api/teacher/attendance/sessions/${s2._id}/mark`).set('Authorization', `Bearer ${token}`).send({ records: [{ student: student._id.toString(), status: 'Late' }] })
    await request(app).post(`/api/teacher/attendance/sessions/${s2._id}/complete`).set('Authorization', `Bearer ${token}`)

    const res = await request(app).get(`/api/teacher/attendance/class/${subject._id}`).set('Authorization', `Bearer ${token}`)
    assert.equal(res.status, 200)
    const row = res.body.data.rows.find((r) => r.student._id === student._id.toString())
    assert.equal(row.percentage, 100)
    assert.equal(row.isLow, false)
  })
})

describe('Low attendance threshold', () => {
  test('below 75% is flagged low; exactly 75% is not', async () => {
    const mod = await import('../utils/attendanceThreshold.js')
    assert.equal(mod.isLowAttendance(74), true)
    assert.equal(mod.isLowAttendance(75), false)
    assert.equal(mod.isLowAttendance(76), false)
    assert.equal(mod.isLowAttendance(null), false) // "no data yet" is never "low"
  })
})

describe('Student attendance access', () => {
  test('a student sees only their own subject-wise summary', async () => {
    const teacher = await makeTeacher('TCH-S1')
    const { course, subject, classroom } = await setupClass(teacher.teacher._id)
    const a = await makeStudent(course, 'STU9201')
    const b = await makeStudent(course, 'STU9202')

    const session = await startSession(teacher.token, subject, classroom, '2026-02-21')
    await request(app).post(`/api/teacher/attendance/sessions/${session._id}/mark`).set('Authorization', `Bearer ${teacher.token}`).send({ records: [{ student: a.student._id.toString(), status: 'Present' }, { student: b.student._id.toString(), status: 'Absent' }] })
    await request(app).post(`/api/teacher/attendance/sessions/${session._id}/complete`).set('Authorization', `Bearer ${teacher.token}`)

    const resA = await request(app).get('/api/student/attendance').set('Authorization', `Bearer ${a.token}`)
    assert.equal(resA.status, 200)
    assert.equal(resA.body.data.subjects[0].percentage, 100)

    const resB = await request(app).get('/api/student/attendance').set('Authorization', `Bearer ${b.token}`)
    assert.equal(resB.body.data.subjects[0].percentage, 0)
    assert.equal(resB.body.data.subjects[0].isLow, true)
  })

  test('a client-supplied studentId in the query string is ignored', async () => {
    const teacher = await makeTeacher('TCH-S2')
    const { course } = await setupClass(teacher.teacher._id)
    const a = await makeStudent(course, 'STU9203')
    const b = await makeStudent(course, 'STU9204')

    // A tries to read B's history by passing B's id — must be ignored.
    const res = await request(app).get(`/api/student/attendance/history?studentId=${b.student._id}`).set('Authorization', `Bearer ${a.token}`)
    assert.equal(res.status, 200)
    // No error either way, but critically: this only ever returns A's own records.
    for (const record of res.body.data.items) {
      assert.notEqual(record.student, b.student._id.toString())
    }
  })

  test('student cannot access teacher attendance endpoints', async () => {
    const course = await Course.create({ name: 'CSE', code: makeCode('CSE') })
    const { token } = await makeStudent(course, 'STU9205')
    const res = await request(app).get('/api/teacher/attendance/sessions').set('Authorization', `Bearer ${token}`)
    assert.equal(res.status, 403)
  })

  test('teacher cannot access student-only attendance endpoints', async () => {
    const { token } = await makeTeacher('TCH-S3')
    const res = await request(app).get('/api/student/attendance').set('Authorization', `Bearer ${token}`)
    assert.equal(res.status, 403)
  })
})
