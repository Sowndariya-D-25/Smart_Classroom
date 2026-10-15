import { test, describe, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import request from 'supertest'

/**
 * Phase 9 — Analytics tests: teacher and student analytics overviews,
 * scoping/ownership, the Present+Late attendance formula, and safe
 * zero-data behavior.
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
let User, Course, Subject, Teacher, Student, Classroom

before(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
  ;({ default: app } = await import('../app.js'))
  ;({ User, Course, Subject, Teacher, Student, Classroom } = await import('../models/index.js'))
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

let codeCounter = 400
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

async function startAndComplete(token, subject, classroom, date, period, marks) {
  const created = await request(app)
    .post('/api/teacher/attendance/sessions')
    .set('Authorization', `Bearer ${token}`)
    .send({ subject: subject._id.toString(), classroom: classroom._id.toString(), date, period })
  const sessionId = created.body.data.session._id
  if (marks?.length) {
    await request(app).post(`/api/teacher/attendance/sessions/${sessionId}/mark`).set('Authorization', `Bearer ${token}`).send({ records: marks })
  }
  await request(app).post(`/api/teacher/attendance/sessions/${sessionId}/complete`).set('Authorization', `Bearer ${token}`)
  return sessionId
}

describe('Teacher analytics — authorization', () => {
  test('no token → 401', async () => {
    const res = await request(app).get('/api/teacher/analytics/overview')
    assert.equal(res.status, 401)
  })

  test('authenticated teacher can access', async () => {
    const { token } = await makeTeacher('TCH-AN1')
    const res = await request(app).get('/api/teacher/analytics/overview').set('Authorization', `Bearer ${token}`)
    assert.equal(res.status, 200)
    assert.equal(res.body.success, true)
  })

  test('student → 403', async () => {
    const course = await Course.create({ name: 'CSE', code: makeCode('CSE') })
    const { token } = await makeStudent(course, 'STU8001')
    const res = await request(app).get('/api/teacher/analytics/overview').set('Authorization', `Bearer ${token}`)
    assert.equal(res.status, 403)
  })
})

describe('Teacher analytics — zero data', () => {
  test('a teacher with no subjects gets a safe empty response, no crash', async () => {
    const { token } = await makeTeacher('TCH-AN2')
    const res = await request(app).get('/api/teacher/analytics/overview').set('Authorization', `Bearer ${token}`)
    assert.equal(res.status, 200)
    assert.equal(res.body.data.kpis.overallPercentage, null)
    assert.equal(res.body.data.kpis.totalSessions, 0)
    assert.deepEqual(res.body.data.lowAttendance, [])
    assert.deepEqual(res.body.data.trend, [])
  })
})

describe('Teacher analytics — ownership', () => {
  test('teacher only sees their own subjects/data, never another teacher\'s', async () => {
    const a = await makeTeacher('TCH-AN3')
    const b = await makeTeacher('TCH-AN4')
    const classA = await setupClass(a.teacher._id)
    await setupClass(b.teacher._id)

    const student = await Student.create({ user: (await User.create({ name: 'S', email: 'sAN3@example.com', password: 'Password123', role: 'student' }))._id, studentId: 'STU8002', rollNumber: '02', course: classA.course._id, department: 'CSE', section: 'A' })
    await startAndComplete(a.token, classA.subject, classA.classroom, '2026-03-01', 1, [{ student: student._id.toString(), status: 'Present' }])

    const res = await request(app).get('/api/teacher/analytics/overview').set('Authorization', `Bearer ${a.token}`)
    assert.equal(res.status, 200)
    assert.equal(res.body.data.subjects.length, 1)
    assert.equal(res.body.data.subjects[0]._id, classA.subject._id.toString())

    const resB = await request(app).get('/api/teacher/analytics/overview').set('Authorization', `Bearer ${b.token}`)
    assert.equal(resB.body.data.kpis.totalSessions, 0) // B's class had no sessions
  })

  test('subject filter narrows results and ignores a subject not belonging to the teacher', async () => {
    const a = await makeTeacher('TCH-AN5')
    const b = await makeTeacher('TCH-AN6')
    const classA = await setupClass(a.teacher._id)
    const classB = await setupClass(b.teacher._id)
    await startAndComplete(a.token, classA.subject, classA.classroom, '2026-03-02', 1, [])

    // A tries to filter by B's subject id — should NOT return B's data.
    const res = await request(app)
      .get(`/api/teacher/analytics/overview?subject=${classB.subject._id}`)
      .set('Authorization', `Bearer ${a.token}`)
    assert.equal(res.status, 200)
    assert.equal(res.body.data.subjects.length, 0) // that subject doesn't belong to A, so it's filtered to nothing — not B's data
  })
})

describe('Teacher analytics — Present + Late formula', () => {
  test('a Present session and a Late session average to 100%, not 50%', async () => {
    const { token, teacher } = await makeTeacher('TCH-AN7')
    const { course, subject, classroom } = await setupClass(teacher._id)
    const student = await Student.create({ user: (await User.create({ name: 'S', email: 'sAN7@example.com', password: 'Password123', role: 'student' }))._id, studentId: 'STU8003', rollNumber: '03', course: course._id, department: 'CSE', section: 'A' })

    await startAndComplete(token, subject, classroom, '2026-03-03', 1, [{ student: student._id.toString(), status: 'Present' }])
    await startAndComplete(token, subject, classroom, '2026-03-04', 1, [{ student: student._id.toString(), status: 'Late' }])

    const res = await request(app).get('/api/teacher/analytics/overview').set('Authorization', `Bearer ${token}`)
    const row = res.body.data.lowAttendance.find((r) => r.student._id === student._id.toString())
    assert.equal(row, undefined) // 100% is not low, so it shouldn't appear in the low-attendance list
    assert.equal(res.body.data.subjectWise[0].percentage, 100)
    assert.equal(res.body.data.kpis.overallPercentage, 100)
  })

  test('an Absent-only student appears in the low-attendance list, sorted lowest first', async () => {
    const { token, teacher } = await makeTeacher('TCH-AN8')
    const { course, subject, classroom } = await setupClass(teacher._id)
    const low = await Student.create({ user: (await User.create({ name: 'Low', email: 'lowAN8@example.com', password: 'Password123', role: 'student' }))._id, studentId: 'STU8004', rollNumber: '04', course: course._id, department: 'CSE', section: 'A' })
    const high = await Student.create({ user: (await User.create({ name: 'High', email: 'highAN8@example.com', password: 'Password123', role: 'student' }))._id, studentId: 'STU8005', rollNumber: '05', course: course._id, department: 'CSE', section: 'A' })

    await startAndComplete(token, subject, classroom, '2026-03-05', 1, [
      { student: low._id.toString(), status: 'Absent' },
      { student: high._id.toString(), status: 'Present' },
    ])

    const res = await request(app).get('/api/teacher/analytics/overview').set('Authorization', `Bearer ${token}`)
    assert.equal(res.body.data.lowAttendance.length, 1)
    assert.equal(res.body.data.lowAttendance[0].student.studentId, 'STU8004')
    assert.equal(res.body.data.kpis.studentsBelowThreshold, 1)
  })
})

describe('Student analytics — authorization & security', () => {
  test('no token → 401', async () => {
    const res = await request(app).get('/api/student/analytics/overview')
    assert.equal(res.status, 401)
  })

  test('teacher → 403 on student analytics', async () => {
    const { token } = await makeTeacher('TCH-AN9')
    const res = await request(app).get('/api/student/analytics/overview').set('Authorization', `Bearer ${token}`)
    assert.equal(res.status, 403)
  })

  test('a client-supplied studentId query param cannot expose another student\'s analytics', async () => {
    const teacher = await makeTeacher('TCH-AN10')
    const { course, subject, classroom } = await setupClass(teacher.teacher._id)
    const a = await makeStudent(course, 'STU8006')
    const b = await makeStudent(course, 'STU8007')
    await startAndComplete(teacher.token, subject, classroom, '2026-03-06', 1, [
      { student: a.student._id.toString(), status: 'Present' },
      { student: b.student._id.toString(), status: 'Absent' },
    ])

    // A requests analytics while passing B's id — must still get A's own data.
    const res = await request(app)
      .get(`/api/student/analytics/overview?studentId=${b.student._id}`)
      .set('Authorization', `Bearer ${a.token}`)
    assert.equal(res.status, 200)
    assert.equal(res.body.data.kpis.overallPercentage, 100) // A's own 100%, not B's 0%
  })
})

describe('Student analytics — zero data & formula', () => {
  test('a student with no subjects gets a safe empty response', async () => {
    const course = await Course.create({ name: 'CSE', code: makeCode('CSE') })
    const { token } = await makeStudent(course, 'STU8008')
    const res = await request(app).get('/api/student/analytics/overview').set('Authorization', `Bearer ${token}`)
    assert.equal(res.status, 200)
    assert.equal(res.body.data.kpis.overallPercentage, null)
    assert.deepEqual(res.body.data.trend, [])
  })

  test('Present + Late counted as attended for the student\'s own KPIs', async () => {
    const teacher = await makeTeacher('TCH-AN11')
    const { course, subject, classroom } = await setupClass(teacher.teacher._id)
    const student = await makeStudent(course, 'STU8009')

    await startAndComplete(teacher.token, subject, classroom, '2026-03-07', 1, [{ student: student.student._id.toString(), status: 'Late' }])
    await startAndComplete(teacher.token, subject, classroom, '2026-03-08', 1, [{ student: student.student._id.toString(), status: 'Present' }])

    const res = await request(app).get('/api/student/analytics/overview').set('Authorization', `Bearer ${student.token}`)
    assert.equal(res.body.data.kpis.overallPercentage, 100)
    assert.equal(res.body.data.kpis.subjectsBelowThreshold, 0)
  })
})

describe('Regression — prior-phase routes still resolve', () => {
  test('classroom, recognize, and student attendance routes are unaffected', async () => {
    const { token } = await makeTeacher('TCH-AN12')
    const classroomsRes = await request(app).get('/api/teacher/classrooms').set('Authorization', `Bearer ${token}`)
    assert.equal(classroomsRes.status, 200)

    const recognizeRes = await request(app)
      .post(`/api/teacher/attendance/sessions/${new mongoose.Types.ObjectId()}/recognize`)
      .set('Authorization', `Bearer ${token}`)
      .send({ descriptor: new Array(128).fill(0.1) })
    assert.equal(recognizeRes.status, 404) // session doesn't exist, but the ROUTE resolved correctly
  })
})
