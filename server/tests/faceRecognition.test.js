import { test, describe, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import request from 'supertest'

/**
 * Computer Vision (face registration + recognition) tests: real HTTP
 * requests against the actual Express app, backed by a real in-memory
 * MongoDB. Uses deterministic mock 128-length descriptor vectors —
 * actual browser face-api.js detection cannot run in a Node test
 * environment, so these prove the backend's matching/ownership/
 * duplicate-prevention logic against known, controlled input vectors.
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
process.env.FACE_MATCH_THRESHOLD = '0.6'

let mongod
let app
let User, Course, Subject, Teacher, Student, Classroom, FaceProfile, Attendance

before(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
  ;({ default: app } = await import('../app.js'))
  ;({ User, Course, Subject, Teacher, Student, Classroom, FaceProfile, Attendance } = await import('../models/index.js'))
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

// Deterministic 128-length vectors. `near(base)` produces a vector close
// enough in Euclidean distance to `base` to be considered a match under
// the default 0.6 threshold; `far()` is deliberately distant.
const base = (fill) => new Array(128).fill(fill)
const near = (fill) => base(fill).map((v, i) => (i === 0 ? v + 0.01 : v))
const far = () => base(5) // Euclidean distance from any small-valued base is huge

async function makeTeacher(employeeId) {
  const user = await User.create({ name: `T ${employeeId}`, email: `${employeeId.toLowerCase()}@example.com`, password: 'Password123', role: 'teacher' })
  const teacher = await Teacher.create({ user: user._id, employeeId })
  const login = await request(app).post('/api/auth/login').send({ email: user.email, password: 'Password123' })
  return { user, teacher, token: login.body.data.token }
}

async function makeStudentToken() {
  const user = await User.create({ name: 'Stu', email: 'stu@example.com', password: 'Password123', role: 'student' })
  const res = await request(app).post('/api/auth/login').send({ email: user.email, password: 'Password123' })
  return res.body.data.token
}

let codeCounter = 300
function makeCode(prefix = 'C') {
  codeCounter += 1
  return `${prefix}${Date.now().toString().slice(-4)}${codeCounter}`.slice(0, 18).toUpperCase()
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

async function addStudent(course, studentId, dept = 'CSE', sec = 'A') {
  const user = await User.create({ name: `Student ${studentId}`, email: `${studentId.toLowerCase()}@example.com`, password: 'Password123', role: 'student' })
  return Student.create({ user: user._id, studentId, rollNumber: studentId.slice(-2), course: course._id, department: dept, section: sec })
}

describe('Authorization', () => {
  test('no token → 401 on face-profiles', async () => {
    const res = await request(app).post('/api/teacher/face-profiles').send({})
    assert.equal(res.status, 401)
  })

  test('student → 403 on face-profiles', async () => {
    const token = await makeStudentToken()
    const res = await request(app).post('/api/teacher/face-profiles').set('Authorization', `Bearer ${token}`).send({})
    assert.equal(res.status, 403)
  })

  test('teacher → allowed (validation still applies)', async () => {
    const { token } = await makeTeacher('TCH-F1')
    const res = await request(app).post('/api/teacher/face-profiles').set('Authorization', `Bearer ${token}`).send({})
    assert.equal(res.status, 400) // missing fields, but past the auth gate
  })
})

describe('Face profile registration — validation', () => {
  test('valid descriptor is accepted', async () => {
    const { token, teacher } = await makeTeacher('TCH-F2')
    const { course } = await setupClass(teacher._id)
    const student = await addStudent(course, 'STU7001')

    const res = await request(app)
      .post('/api/teacher/face-profiles')
      .set('Authorization', `Bearer ${token}`)
      .send({ student: student._id.toString(), descriptors: [base(0.1)] })
    assert.equal(res.status, 201)
    assert.equal(res.body.data.sampleCount, 1)
  })

  test('empty descriptors array is rejected', async () => {
    const { token, teacher } = await makeTeacher('TCH-F3')
    const { course } = await setupClass(teacher._id)
    const student = await addStudent(course, 'STU7002')

    const res = await request(app)
      .post('/api/teacher/face-profiles')
      .set('Authorization', `Bearer ${token}`)
      .send({ student: student._id.toString(), descriptors: [] })
    assert.equal(res.status, 400)
  })

  test('wrong-length descriptor is rejected', async () => {
    const { token, teacher } = await makeTeacher('TCH-F4')
    const { course } = await setupClass(teacher._id)
    const student = await addStudent(course, 'STU7003')

    const res = await request(app)
      .post('/api/teacher/face-profiles')
      .set('Authorization', `Bearer ${token}`)
      .send({ student: student._id.toString(), descriptors: [[0.1, 0.2, 0.3]] })
    assert.equal(res.status, 400)
  })

  test('descriptor containing NaN/Infinity is rejected', async () => {
    const { token, teacher } = await makeTeacher('TCH-F5')
    const { course } = await setupClass(teacher._id)
    const student = await addStudent(course, 'STU7004')
    const bad = base(0.1)
    bad[5] = null // JSON has no NaN/Infinity literal, so this is how a client could try to smuggle a non-finite value through

    const res = await request(app)
      .post('/api/teacher/face-profiles')
      .set('Authorization', `Bearer ${token}`)
      .send({ student: student._id.toString(), descriptors: [bad] })
    assert.equal(res.status, 400)
  })

  test('re-registering updates the same profile, not a second one', async () => {
    const { token, teacher } = await makeTeacher('TCH-F6')
    const { course } = await setupClass(teacher._id)
    const student = await addStudent(course, 'STU7005')

    await request(app).post('/api/teacher/face-profiles').set('Authorization', `Bearer ${token}`).send({ student: student._id.toString(), descriptors: [base(0.1)] })
    const second = await request(app)
      .post('/api/teacher/face-profiles')
      .set('Authorization', `Bearer ${token}`)
      .send({ student: student._id.toString(), descriptors: [base(0.2), base(0.3)] })
    assert.equal(second.status, 200) // update, not create
    assert.equal(second.body.data.sampleCount, 2)

    const count = await FaceProfile.countDocuments({ student: student._id })
    assert.equal(count, 1) // still exactly one profile
  })
})

describe('Face profile registration — ownership', () => {
  test("teacher cannot register a face for a student outside their course", async () => {
    const a = await makeTeacher('TCH-F7')
    const b = await makeTeacher('TCH-F8')
    const { course: courseA } = await setupClass(a.teacher._id) // A's course
    await setupClass(b.teacher._id) // B has an unrelated course
    const studentInA = await addStudent(courseA, 'STU7006')

    const res = await request(app)
      .post('/api/teacher/face-profiles')
      .set('Authorization', `Bearer ${b.token}`) // B tries to register A's student
      .send({ student: studentInA._id.toString(), descriptors: [base(0.1)] })
    assert.equal(res.status, 403)
  })
})

describe('Face recognition + attendance integration', () => {
  test('a close-enough descriptor is recognized and marks Present', async () => {
    const { token, teacher, user: teacherUser } = await makeTeacher('TCH-F9')
    const { course, subject, classroom } = await setupClass(teacher._id)
    const student = await addStudent(course, 'STU7007')
    await FaceProfile.create({ student: student._id, descriptors: [base(0.1)] })

    const session = await request(app)
      .post('/api/teacher/attendance/sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({ subject: subject._id.toString(), classroom: classroom._id.toString(), date: '2026-01-20', period: 1 })
    const sessionId = session.body.data.session._id

    const res = await request(app)
      .post(`/api/teacher/attendance/sessions/${sessionId}/recognize`)
      .set('Authorization', `Bearer ${token}`)
      .send({ descriptor: near(0.1) })

    assert.equal(res.status, 201)
    assert.equal(res.body.data.matched, true)
    assert.equal(res.body.data.student.studentId, 'STU7007')

    const record = await Attendance.findOne({ student: student._id, session: sessionId })
    assert.equal(record.status, 'Present')
    assert.equal(record.method, 'Face Recognition')
    assert.ok(record.confidence > 0)
  })

  test('a far descriptor is not recognized and marks nothing', async () => {
    const { token, teacher } = await makeTeacher('TCH-F10')
    const { course, subject, classroom } = await setupClass(teacher._id)
    const student = await addStudent(course, 'STU7008')
    await FaceProfile.create({ student: student._id, descriptors: [base(0.1)] })

    const session = await request(app)
      .post('/api/teacher/attendance/sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({ subject: subject._id.toString(), classroom: classroom._id.toString(), date: '2026-01-21', period: 1 })
    const sessionId = session.body.data.session._id

    const res = await request(app)
      .post(`/api/teacher/attendance/sessions/${sessionId}/recognize`)
      .set('Authorization', `Bearer ${token}`)
      .send({ descriptor: far() })

    assert.equal(res.status, 200)
    assert.equal(res.body.data.matched, false)

    const count = await Attendance.countDocuments({ session: sessionId })
    assert.equal(count, 0)
  })

  test('recognizing the same student twice does not create a duplicate record', async () => {
    const { token, teacher } = await makeTeacher('TCH-F11')
    const { course, subject, classroom } = await setupClass(teacher._id)
    const student = await addStudent(course, 'STU7009')
    await FaceProfile.create({ student: student._id, descriptors: [base(0.1)] })

    const session = await request(app)
      .post('/api/teacher/attendance/sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({ subject: subject._id.toString(), classroom: classroom._id.toString(), date: '2026-01-22', period: 1 })
    const sessionId = session.body.data.session._id

    await request(app).post(`/api/teacher/attendance/sessions/${sessionId}/recognize`).set('Authorization', `Bearer ${token}`).send({ descriptor: near(0.1) })
    const second = await request(app).post(`/api/teacher/attendance/sessions/${sessionId}/recognize`).set('Authorization', `Bearer ${token}`).send({ descriptor: near(0.1) })

    assert.equal(second.status, 200)
    assert.equal(second.body.data.alreadyMarked, true)

    const count = await Attendance.countDocuments({ session: sessionId, student: student._id })
    assert.equal(count, 1)
  })

  test('a student outside this session\'s roster is never even compared', async () => {
    const { token, teacher } = await makeTeacher('TCH-F12')
    const { course, subject, classroom } = await setupClass(teacher._id)
    // A second, unrelated course + student — NOT enrolled in the session's subject.
    const otherCourse = await Course.create({ name: 'B.E. ECE', code: makeCode('ECE') })
    const outsideStudent = await addStudent(otherCourse, 'STU7010', 'ECE', 'B')
    await FaceProfile.create({ student: outsideStudent._id, descriptors: [base(0.1)] })
    // No student inside the actual roster has a matching profile.

    const session = await request(app)
      .post('/api/teacher/attendance/sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({ subject: subject._id.toString(), classroom: classroom._id.toString(), date: '2026-01-23', period: 1 })
    const sessionId = session.body.data.session._id

    const res = await request(app)
      .post(`/api/teacher/attendance/sessions/${sessionId}/recognize`)
      .set('Authorization', `Bearer ${token}`)
      .send({ descriptor: near(0.1) }) // matches outsideStudent's descriptor closely

    // Even though the descriptor is a near-perfect match for a real
    // FaceProfile in the database, that student isn't on this roster,
    // so their profile was never in the comparison set — "not recognized",
    // not "recognized but rejected".
    assert.equal(res.status, 200)
    assert.equal(res.body.data.matched, false)
  })

  test('cannot recognize on another teacher\'s session', async () => {
    const a = await makeTeacher('TCH-F13')
    const b = await makeTeacher('TCH-F14')
    const { subject, classroom } = await setupClass(a.teacher._id)

    const session = await request(app)
      .post('/api/teacher/attendance/sessions')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ subject: subject._id.toString(), classroom: classroom._id.toString(), date: '2026-01-24', period: 1 })
    const sessionId = session.body.data.session._id

    const res = await request(app)
      .post(`/api/teacher/attendance/sessions/${sessionId}/recognize`)
      .set('Authorization', `Bearer ${b.token}`)
      .send({ descriptor: base(0.1) })
    assert.equal(res.status, 404)
  })

  test('cannot recognize on a completed session', async () => {
    const { token, teacher } = await makeTeacher('TCH-F15')
    const { subject, classroom } = await setupClass(teacher._id)

    const session = await request(app)
      .post('/api/teacher/attendance/sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({ subject: subject._id.toString(), classroom: classroom._id.toString(), date: '2026-01-25', period: 1 })
    const sessionId = session.body.data.session._id
    await request(app).post(`/api/teacher/attendance/sessions/${sessionId}/complete`).set('Authorization', `Bearer ${token}`)

    const res = await request(app)
      .post(`/api/teacher/attendance/sessions/${sessionId}/recognize`)
      .set('Authorization', `Bearer ${token}`)
      .send({ descriptor: base(0.1) })
    assert.equal(res.status, 400)
  })

  test('rejects a malformed descriptor before touching the database', async () => {
    const { token, teacher } = await makeTeacher('TCH-F16')
    const { subject, classroom } = await setupClass(teacher._id)
    const session = await request(app)
      .post('/api/teacher/attendance/sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({ subject: subject._id.toString(), classroom: classroom._id.toString(), date: '2026-01-26', period: 1 })
    const sessionId = session.body.data.session._id

    const res = await request(app)
      .post(`/api/teacher/attendance/sessions/${sessionId}/recognize`)
      .set('Authorization', `Bearer ${token}`)
      .send({ descriptor: [1, 2, 3] })
    assert.equal(res.status, 400)
  })
})

describe('Manual attendance still works alongside face recognition', () => {
  test('manual mark endpoint is unaffected by this phase\'s changes', async () => {
    const { token, teacher } = await makeTeacher('TCH-F17')
    const { course, subject, classroom } = await setupClass(teacher._id)
    const student = await addStudent(course, 'STU7011')

    const session = await request(app)
      .post('/api/teacher/attendance/sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({ subject: subject._id.toString(), classroom: classroom._id.toString(), date: '2026-01-27', period: 1 })
    const sessionId = session.body.data.session._id

    const res = await request(app)
      .post(`/api/teacher/attendance/sessions/${sessionId}/mark`)
      .set('Authorization', `Bearer ${token}`)
      .send({ records: [{ student: student._id.toString(), status: 'Present' }] })
    assert.equal(res.status, 200)
    assert.equal(res.body.data.saved, 1)
  })
})

describe('Classroom listing is still unaffected (Phase 6 fix intact)', () => {
  test('GET /api/teacher/classrooms still returns active classrooms with zero Timetable data', async () => {
    const { token } = await makeTeacher('TCH-F18')
    await Classroom.create({ name: 'CR Test', code: makeCode('CRT'), capacity: 40 })
    const res = await request(app).get('/api/teacher/classrooms').set('Authorization', `Bearer ${token}`)
    assert.equal(res.status, 200)
    assert.ok(res.body.data.items.length >= 1)
  })
})
