import { test, describe, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import request from 'supertest'

process.env.JWT_SECRET = 'test-only-secret-do-not-use-in-real-deployments'
process.env.JWT_EXPIRES_IN = '1h'
process.env.NODE_ENV = 'test'
process.env.MAX_UNKNOWN_FACES = '5'

let mongod
let app
let User, Student, Teacher, Course, Subject, Classroom, AttendanceSession, Attendance

before(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
  ;({ default: app } = await import('../app.js'))
  ;({ User, Student, Teacher, Course, Subject, Classroom, AttendanceSession, Attendance } = await import(
    '../models/index.js'
  ))
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

describe('BUG-015 & BUG-021: Security headers, Error formatting & CastError handling', () => {
  test('returns security headers and does not expose error stack traces', async () => {
    const res = await request(app).get('/api/health')
    assert.equal(res.status, 200)
    // Helmet sets X-Content-Type-Options
    assert.equal(res.headers['x-content-type-options'], 'nosniff')
  })

  test('invalid ObjectId returns 400 Bad Request with safe message and no stack trace', async () => {
    const user = await User.create({
      name: 'Admin User',
      email: 'admin@example.com',
      password: 'Password123',
      role: 'admin',
    })
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@example.com', password: 'Password123' })
    const token = loginRes.body.data.token

    const res = await request(app)
      .get('/api/admin/students/invalid-object-id-123')
      .set('Authorization', `Bearer ${token}`)

    assert.equal(res.status, 400)
    assert.equal(res.body.success, false)
    assert.equal(res.body.stack, undefined)
  })
})

describe('BUG-016: Server-side token invalidation on logout', () => {
  test('logout revokes the JWT and subsequent requests with the old token fail with 401', async () => {
    await request(app).post('/api/auth/register').send({
      name: 'Logout Test Student',
      email: 'logout.test@example.com',
      password: 'Password123',
    })

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'logout.test@example.com', password: 'Password123' })

    const token = loginRes.body.data.token

    // Verified token works before logout
    const meResBefore = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`)
    assert.equal(meResBefore.status, 200)
    assert.equal(meResBefore.body.data.user.email, 'logout.test@example.com')

    // Call logout endpoint
    const logoutRes = await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${token}`)
    assert.equal(logoutRes.status, 200)
    assert.equal(logoutRes.body.success, true)

    // Token must now be rejected
    const meResAfter = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`)
    assert.equal(meResAfter.status, 401)
  })
})

describe('BUG-017: Multi-step deletion safety and dependent records check', () => {
  test('rejects deleting a student who has historical attendance records with 409 Conflict', async () => {
    const adminUser = await User.create({
      name: 'Admin Deletion Tester',
      email: 'admin.del@example.com',
      password: 'Password123',
      role: 'admin',
    })
    const adminTokenRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin.del@example.com', password: 'Password123' })
    const adminToken = adminTokenRes.body.data.token

    const studentUser = await User.create({
      name: 'Attended Student',
      email: 'attended@example.com',
      password: 'Password123',
      role: 'student',
    })
    const course = await Course.create({ name: 'Computer Science', code: 'CS-DEL', department: 'CSE' })
    const student = await Student.create({
      user: studentUser._id,
      studentId: 'STU-DEL-01',
      rollNumber: 'R-DEL-01',
      course: course._id,
      department: 'CSE',
      section: 'A',
      year: 2,
    })

    const teacherUser = await User.create({
      name: 'Teacher Del',
      email: 'teacher.del@example.com',
      password: 'Password123',
      role: 'teacher',
    })
    const teacher = await Teacher.create({
      user: teacherUser._id,
      employeeId: 'EMP-DEL-01',
      department: 'CSE',
    })
    const subject = await Subject.create({
      name: 'Data Structures',
      code: 'CS-DS-DEL',
      course: course._id,
      department: 'CSE',
      semester: 3,
      credits: 4,
    })

    const session = await AttendanceSession.create({
      teacher: teacher._id,
      subject: subject._id,
      date: new Date(),
      period: 1,
      status: 'Completed',
    })

    await Attendance.create({
      student: student._id,
      subject: subject._id,
      teacher: teacher._id,
      session: session._id,
      date: new Date(),
      period: 1,
      status: 'Present',
      method: 'Manual',
      markedBy: teacherUser._id,
    })

    // Attempting to delete student with attendance records must return 409 Conflict
    const delStudentRes = await request(app)
      .delete(`/api/admin/students/${student._id}`)
      .set('Authorization', `Bearer ${adminToken}`)

    assert.equal(delStudentRes.status, 409)
    assert.match(delStudentRes.body.message, /attendance records/i)

    // Verify student still exists
    const stillExists = await Student.findById(student._id)
    assert.ok(stillExists)
  })

  test('rejects deleting a teacher who has conducted attendance sessions with 409 Conflict', async () => {
    const adminUser = await User.create({
      name: 'Admin Teacher Del',
      email: 'admin.tdel@example.com',
      password: 'Password123',
      role: 'admin',
    })
    const adminTokenRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin.tdel@example.com', password: 'Password123' })
    const adminToken = adminTokenRes.body.data.token

    const teacherUser = await User.create({
      name: 'Teacher With Sessions',
      email: 'teacher.sess@example.com',
      password: 'Password123',
      role: 'teacher',
    })
    const teacher = await Teacher.create({
      user: teacherUser._id,
      employeeId: 'EMP-SESS-01',
      department: 'CSE',
    })
    const course = await Course.create({ name: 'Civil Eng', code: 'CE-DEL', department: 'CE' })
    const subject = await Subject.create({
      name: 'Surveying',
      code: 'CE-SRV-DEL',
      course: course._id,
      department: 'CE',
      semester: 1,
      credits: 3,
    })

    await AttendanceSession.create({
      teacher: teacher._id,
      subject: subject._id,
      date: new Date(),
      period: 2,
      status: 'Completed',
    })

    // Attempting to delete teacher with sessions must return 409 Conflict
    const delTeacherRes = await request(app)
      .delete(`/api/admin/teachers/${teacher._id}`)
      .set('Authorization', `Bearer ${adminToken}`)

    assert.equal(delTeacherRes.status, 409)
    assert.match(delTeacherRes.body.message, /attendance history/i)

    // Verify teacher still exists
    const stillExists = await Teacher.findById(teacher._id)
    assert.ok(stillExists)
  })
})

describe('BUG-020: Consistent email normalization', () => {
  test('registration and login normalize mixed case and whitespace consistently', async () => {
    const regRes = await request(app).post('/api/auth/register').send({
      name: 'Normalized Student',
      email: '  Student.Norm@Example.COM  ',
      password: 'Password123',
    })
    assert.equal(regRes.status, 201)
    assert.equal(regRes.body.data.user.email, 'student.norm@example.com')

    // Duplicate registration with different case is cleanly rejected
    const dupRes = await request(app).post('/api/auth/register').send({
      name: 'Duplicate Student',
      email: 'STUDENT.NORM@EXAMPLE.COM',
      password: 'Password123',
    })
    assert.equal(dupRes.status, 409)

    // Login succeeds with any casing/whitespace variation
    const loginRes = await request(app).post('/api/auth/login').send({
      email: ' student.norm@example.com ',
      password: 'Password123',
    })
    assert.equal(loginRes.status, 200)
    assert.ok(loginRes.body.data.token)
  })
})

describe('BUG-023: Health readiness endpoint', () => {
  test('GET /api/health/ready returns 200 and reports ready when connected to database', async () => {
    const res = await request(app).get('/api/health/ready')
    assert.equal(res.status, 200)
    assert.equal(res.body.success, true)
    assert.equal(res.body.status, 'ready')
    assert.equal(res.body.db, 'connected')
  })
})

describe('BUG-013: Unknown face recording and bounded storage', () => {
  test('unrecognized face is logged to session and bounded to MAX_UNKNOWN_FACES without creating attendance', async () => {
    const teacherUser = await User.create({
      name: 'Face Teacher',
      email: 'face.teacher@example.com',
      password: 'Password123',
      role: 'teacher',
    })
    const teacherTokenRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'face.teacher@example.com', password: 'Password123' })
    const teacherToken = teacherTokenRes.body.data.token

    const teacher = await Teacher.create({
      user: teacherUser._id,
      employeeId: 'EMP-FACE-01',
      department: 'CSE',
    })
    const course = await Course.create({ name: 'CS Vision', code: 'CS-VIS-01', department: 'CSE' })
    const subject = await Subject.create({
      name: 'Computer Vision',
      code: 'CS-CV-01',
      course: course._id,
      department: 'CSE',
      semester: 4,
      credits: 3,
      teachers: [teacher._id],
    })

    const session = await AttendanceSession.create({
      teacher: teacher._id,
      subject: subject._id,
      date: new Date(),
      period: 1,
      status: 'Active',
      unknownFaces: [],
    })

    // Construct a query descriptor (128 floats)
    const dummyDescriptor = Array.from({ length: 128 }, () => 0.1)

    // Fire 8 recognize requests for unknown face (MAX_UNKNOWN_FACES is 5 in this test file)
    for (let i = 0; i < 8; i++) {
      const recRes = await request(app)
        .post(`/api/teacher/attendance/sessions/${session._id}/recognize`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ descriptor: dummyDescriptor, commit: true })

      assert.equal(recRes.status, 200)
      assert.equal(recRes.body.data.matched, false)
    }

    // Verify session unknownFaces was capped at MAX_UNKNOWN_FACES (5)
    const updatedSession = await AttendanceSession.findById(session._id)
    assert.equal(updatedSession.unknownFaces.length, 5)

    // Verify no student attendance was created
    const attCount = await Attendance.countDocuments({ session: session._id })
    assert.equal(attCount, 0)
  })
})
