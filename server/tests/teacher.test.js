import { test, describe, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import request from 'supertest'

/**
 * Teacher Module tests: real HTTP requests against the actual Express
 * app, backed by a real in-memory MongoDB. The focus is ownership —
 * proving a teacher can only ever see/act on their own subjects,
 * classes, timetable, and attendance sessions, never another teacher's,
 * regardless of what ID is put in the URL or request body.
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
  const user = await User.create({
    name: `Teacher ${employeeId}`,
    email: `${employeeId.toLowerCase()}@example.com`,
    password: 'Password123',
    role: 'teacher',
  })
  const teacher = await Teacher.create({ user: user._id, employeeId })
  const login = await request(app).post('/api/auth/login').send({ email: user.email, password: 'Password123' })
  return { user, teacher, token: login.body.data.token }
}

async function makeStudentToken() {
  const user = await User.create({ name: 'Stu', email: 'stu@example.com', password: 'Password123', role: 'student' })
  const res = await request(app).post('/api/auth/login').send({ email: user.email, password: 'Password123' })
  return res.body.data.token
}

let codeCounter = 100
function makeCode(prefix = 'C') {
  codeCounter += 1
  return `${prefix}${Date.now().toString().slice(-4)}${codeCounter}`.slice(0, 18).toUpperCase()
}

async function seedCourseAndSubject(teacherId) {
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

describe('Authorization', () => {
  test('no token → 401', async () => {
    const res = await request(app).get('/api/teacher/dashboard/stats')
    assert.equal(res.status, 401)
  })

  test('invalid token → 401', async () => {
    const res = await request(app).get('/api/teacher/dashboard/stats').set('Authorization', 'Bearer garbage')
    assert.equal(res.status, 401)
  })

  test('student → 403', async () => {
    const token = await makeStudentToken()
    const res = await request(app).get('/api/teacher/dashboard/stats').set('Authorization', `Bearer ${token}`)
    assert.equal(res.status, 403)
  })

  test('teacher → allowed', async () => {
    const { token } = await makeTeacher('TCH-A1')
    const res = await request(app).get('/api/teacher/dashboard/stats').set('Authorization', `Bearer ${token}`)
    assert.equal(res.status, 200)
    assert.equal(res.body.success, true)
  })
})

describe('Dashboard stats', () => {
  test('returns the documented structure', async () => {
    const { token, teacher } = await makeTeacher('TCH-D1')
    await seedCourseAndSubject(teacher._id)
    const res = await request(app).get('/api/teacher/dashboard/stats').set('Authorization', `Bearer ${token}`)
    assert.equal(res.status, 200)
    assert.equal(res.body.data.subjectsCount, 1)
    assert.ok('todayClassesCount' in res.body.data)
    assert.ok('attendanceSessionsCount' in res.body.data)
  })
})

describe('Subjects & Classes ownership', () => {
  test('teacher only sees their own assigned subjects', async () => {
    const a = await makeTeacher('TCH-S1')
    const b = await makeTeacher('TCH-S2')
    await seedCourseAndSubject(a.teacher._id)
    await seedCourseAndSubject(b.teacher._id)

    const resA = await request(app).get('/api/teacher/subjects').set('Authorization', `Bearer ${a.token}`)
    assert.equal(resA.body.data.items.length, 1)

    const resB = await request(app).get('/api/teacher/subjects').set('Authorization', `Bearer ${b.token}`)
    assert.equal(resB.body.data.items.length, 1)
    assert.notEqual(resA.body.data.items[0]._id, resB.body.data.items[0]._id)
  })

  test('teacher only sees their own classes', async () => {
    const { token, teacher } = await makeTeacher('TCH-C1')
    await seedCourseAndSubject(teacher._id)
    const res = await request(app).get('/api/teacher/classes').set('Authorization', `Bearer ${token}`)
    assert.equal(res.status, 200)
    assert.equal(res.body.data.items.length, 1)
    assert.ok('studentCount' in res.body.data.items[0])
  })
})

describe('Timetable ownership', () => {
  test('teacher only sees their own timetable', async () => {
    const { token, teacher } = await makeTeacher('TCH-T1')
    const { subject, classroom } = await seedCourseAndSubject(teacher._id)
    const Timetable = (await import('../models/index.js')).Timetable
    await Timetable.create({
      subject: subject._id,
      teacher: teacher._id,
      classroom: classroom._id,
      dayOfWeek: 'Monday',
      startTime: '09:00',
      endTime: '10:00',
      semester: 3,
      academicYear: '2026-2027',
    })
    const res = await request(app).get('/api/teacher/timetable').set('Authorization', `Bearer ${token}`)
    assert.equal(res.status, 200)
    assert.equal(res.body.data.items.length, 1)
  })
})

describe('Attendance session ownership', () => {
  test('teacher can create a session for their own subject', async () => {
    const { token, teacher } = await makeTeacher('TCH-AT1')
    const { subject, classroom } = await seedCourseAndSubject(teacher._id)
    const res = await request(app)
      .post('/api/teacher/attendance/sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({ subject: subject._id.toString(), classroom: classroom._id.toString(), date: '2026-01-15', period: 1 })
    assert.equal(res.status, 201)
    assert.equal(res.body.data.session.status, 'Active')
  })

  test("teacher cannot create a session for another teacher's subject", async () => {
    const a = await makeTeacher('TCH-AT2')
    const b = await makeTeacher('TCH-AT3')
    const { subject, classroom } = await seedCourseAndSubject(a.teacher._id) // belongs to A

    const res = await request(app)
      .post('/api/teacher/attendance/sessions')
      .set('Authorization', `Bearer ${b.token}`) // B tries to use it
      .send({ subject: subject._id.toString(), classroom: classroom._id.toString(), date: '2026-01-15', period: 1 })
    assert.equal(res.status, 403)
  })

  test('invalid course/subject ID is rejected', async () => {
    const { token } = await makeTeacher('TCH-AT4')
    const fakeId = new mongoose.Types.ObjectId().toString()
    const classroom = await Classroom.create({ name: 'Room X', code: makeCode('CRX'), capacity: 20 })
    const res = await request(app)
      .post('/api/teacher/attendance/sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({ subject: fakeId, classroom: classroom._id.toString(), date: '2026-01-15', period: 1 })
    assert.equal(res.status, 403) // not assigned to this teacher, same as "not yours"
  })

  test("another teacher cannot read the first teacher's session by ID", async () => {
    const a = await makeTeacher('TCH-AT5')
    const b = await makeTeacher('TCH-AT6')
    const { subject, classroom } = await seedCourseAndSubject(a.teacher._id)
    const created = await request(app)
      .post('/api/teacher/attendance/sessions')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ subject: subject._id.toString(), classroom: classroom._id.toString(), date: '2026-01-15', period: 2 })
    const sessionId = created.body.data.session._id

    const res = await request(app)
      .get(`/api/teacher/attendance/sessions/${sessionId}`)
      .set('Authorization', `Bearer ${b.token}`)
    assert.equal(res.status, 404)
  })

  test('duplicate active session for same subject/date/period is rejected', async () => {
    const { token, teacher } = await makeTeacher('TCH-AT7')
    const { subject, classroom } = await seedCourseAndSubject(teacher._id)
    const payload = { subject: subject._id.toString(), classroom: classroom._id.toString(), date: '2026-01-16', period: 3 }
    await request(app).post('/api/teacher/attendance/sessions').set('Authorization', `Bearer ${token}`).send(payload)
    const res = await request(app).post('/api/teacher/attendance/sessions').set('Authorization', `Bearer ${token}`).send(payload)
    assert.equal(res.status, 409)
  })

  test('marks attendance and prevents duplicate records on re-submit', async () => {
    const { token, teacher } = await makeTeacher('TCH-AT8')
    const { course, subject, classroom } = await seedCourseAndSubject(teacher._id)
    const studentUser = await User.create({ name: 'S1', email: 's1@example.com', password: 'Password123', role: 'student' })
    const student = await Student.create({ user: studentUser._id, studentId: 'STU5001', rollNumber: '01', course: course._id, department: 'CSE', section: 'A' })

    const created = await request(app)
      .post('/api/teacher/attendance/sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({ subject: subject._id.toString(), classroom: classroom._id.toString(), date: '2026-01-17', period: 1 })
    const sessionId = created.body.data.session._id

    const mark1 = await request(app)
      .post(`/api/teacher/attendance/sessions/${sessionId}/mark`)
      .set('Authorization', `Bearer ${token}`)
      .send({ records: [{ student: student._id.toString(), status: 'Present' }] })
    assert.equal(mark1.status, 200)
    assert.equal(mark1.body.data.saved, 1)

    // Re-submit with a different status — should UPDATE, not create a duplicate.
    const mark2 = await request(app)
      .post(`/api/teacher/attendance/sessions/${sessionId}/mark`)
      .set('Authorization', `Bearer ${token}`)
      .send({ records: [{ student: student._id.toString(), status: 'Late' }] })
    assert.equal(mark2.status, 200)

    const Attendance = (await import('../models/index.js')).Attendance
    const records = await Attendance.find({ session: sessionId, student: student._id })
    assert.equal(records.length, 1) // still exactly one record
    assert.equal(records[0].status, 'Late') // updated, not duplicated
  })
})

describe('Classrooms (shared resource, not Timetable-dependent)', () => {
  test('teacher can list active classrooms regardless of Timetable data', async () => {
    const { token } = await makeTeacher('TCH-CR1')
    await Classroom.create({ name: 'Lecture Hall 1', code: makeCode('CR1'), capacity: 60 })
    await Classroom.create({ name: 'Inactive Room', code: makeCode('CR0'), capacity: 10, isActive: false })

    const res = await request(app).get('/api/teacher/classrooms').set('Authorization', `Bearer ${token}`)
    assert.equal(res.status, 200)
    // Only the active classroom should be returned, and this must work
    // with zero Timetable entries in the database.
    assert.equal(res.body.data.items.length, 1)
    assert.equal(res.body.data.items[0].name, 'Lecture Hall 1')
  })
})

describe('Profile', () => {
  test('teacher can retrieve their own profile', async () => {
    const { token } = await makeTeacher('TCH-P1')
    const res = await request(app).get('/api/teacher/profile').set('Authorization', `Bearer ${token}`)
    assert.equal(res.status, 200)
    assert.equal(res.body.data.teacher.employeeId, 'TCH-P1')
    assert.equal(res.body.data.teacher.user.password, undefined)
  })

  test('teacher can update allowed fields', async () => {
    const { token } = await makeTeacher('TCH-P2')
    const res = await request(app)
      .put('/api/teacher/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ phone: '9999999999', name: 'Updated Teacher' })
    assert.equal(res.status, 200)
    assert.equal(res.body.data.teacher.phone, '9999999999')
    assert.equal(res.body.data.teacher.user.name, 'Updated Teacher')
  })

  test('cannot change role through the profile update endpoint', async () => {
    const { token, user } = await makeTeacher('TCH-P3')
    await request(app)
      .put('/api/teacher/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'admin', name: 'Still A Teacher' })
    const reloaded = await User.findById(user._id)
    assert.equal(reloaded.role, 'teacher')
  })
})
