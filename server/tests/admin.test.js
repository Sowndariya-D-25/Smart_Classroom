import { test, describe, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import request from 'supertest'

/**
 * Admin Module tests: real HTTP requests against the actual Express app,
 * backed by a real in-memory MongoDB. Covers the two things that matter
 * most for this phase — (1) the CRUD actually persists to MongoDB
 * correctly, and (2) the role-authorization boundary is enforced on the
 * backend for every resource, not just hidden in the frontend.
 *
 * Same mongodb-memory-server caveat as auth.test.js / models.integration.test.js:
 * downloads a real `mongod` on first run, needs internet, won't run in a
 * network-locked sandbox.
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

async function tokenFor(role, overrides = {}) {
  const user = await User.create({
    name: `${role} user`,
    email: `${role}-${Date.now()}-${Math.random()}@example.com`,
    password: 'Password123',
    role,
    ...overrides,
  })
  const res = await request(app).post('/api/auth/login').send({ email: user.email, password: 'Password123' })
  return res.body.data.token
}

let codeCounter = 500
function makeCode(prefix = 'C') {
  codeCounter += 1
  return `${prefix}${Date.now().toString().slice(-4)}${codeCounter}`.slice(0, 18).toUpperCase()
}

async function seedCourse() {
  return Course.create({ name: 'B.E. CSE', code: makeCode('CSE') })
}

describe('Admin route authorization (every resource)', () => {
  const resources = ['students', 'teachers', 'subjects', 'courses', 'classrooms']

  for (const resource of resources) {
    test(`admin can list /api/admin/${resource}`, async () => {
      const token = await tokenFor('admin')
      const res = await request(app).get(`/api/admin/${resource}`).set('Authorization', `Bearer ${token}`)
      assert.equal(res.status, 200)
      assert.equal(res.body.success, true)
    })

    test(`teacher is forbidden from /api/admin/${resource}`, async () => {
      const token = await tokenFor('teacher')
      const res = await request(app).get(`/api/admin/${resource}`).set('Authorization', `Bearer ${token}`)
      assert.equal(res.status, 403)
    })

    test(`student is forbidden from /api/admin/${resource}`, async () => {
      const token = await tokenFor('student')
      const res = await request(app).get(`/api/admin/${resource}`).set('Authorization', `Bearer ${token}`)
      assert.equal(res.status, 403)
    })

    test(`no token is rejected from /api/admin/${resource}`, async () => {
      const res = await request(app).get(`/api/admin/${resource}`)
      assert.equal(res.status, 401)
    })

    test(`invalid token is rejected from /api/admin/${resource}`, async () => {
      const res = await request(app).get(`/api/admin/${resource}`).set('Authorization', 'Bearer not-a-real-token')
      assert.equal(res.status, 401)
    })
  }
})

describe('Dashboard stats', () => {
  test('returns real MongoDB counts', async () => {
    const token = await tokenFor('admin')
    const course = await seedCourse()
    const studentUser = await User.create({ name: 'S', email: 's1@example.com', password: 'Password123', role: 'student' })
    await Student.create({ user: studentUser._id, studentId: 'STU0001', rollNumber: '01', course: course._id, department: 'CSE', section: 'A' })

    const res = await request(app).get('/api/admin/dashboard/stats').set('Authorization', `Bearer ${token}`)
    assert.equal(res.status, 200)
    assert.equal(res.body.data.students.total, 1)
    assert.equal(res.body.data.students.active, 1)
  })
})

describe('Student CRUD', () => {
  test('admin can create a student', async () => {
    const token = await tokenFor('admin')
    const course = await seedCourse()

    const res = await request(app)
      .post('/api/admin/students')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Jordan Lee',
        email: 'jordan@example.com',
        password: 'Password123',
        studentId: 'STU9001',
        rollNumber: '01',
        course: course._id.toString(),
        department: 'Computer Science',
        year: 2,
        section: 'A',
      })

    assert.equal(res.status, 201)
    assert.equal(res.body.data.student.studentId, 'STU9001')
    assert.equal(res.body.data.student.user.email, 'jordan@example.com')
    assert.equal(res.body.data.student.user.password, undefined)
  })

  test('rejects a duplicate studentId', async () => {
    const token = await tokenFor('admin')
    const course = await seedCourse()
    const payload = {
      name: 'A',
      email: 'a@example.com',
      password: 'Password123',
      studentId: 'STU9002',
      rollNumber: '02',
      course: course._id.toString(),
      department: 'Computer Science',
      section: 'A',
    }
    await request(app).post('/api/admin/students').set('Authorization', `Bearer ${token}`).send(payload)
    const res = await request(app)
      .post('/api/admin/students')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...payload, email: 'b@example.com', rollNumber: '03' })
    assert.equal(res.status, 409)
  })

  test('lists students with pagination metadata', async () => {
    const token = await tokenFor('admin')
    const course = await seedCourse()
    for (let i = 1; i <= 3; i += 1) {
      await request(app)
        .post('/api/admin/students')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: `Student ${i}`,
          email: `student${i}@example.com`,
          password: 'Password123',
          studentId: `STU100${i}`,
          rollNumber: `0${i}`,
          course: course._id.toString(),
          department: 'Computer Science',
          section: 'A',
        })
    }
    const res = await request(app).get('/api/admin/students?limit=2&page=1').set('Authorization', `Bearer ${token}`)
    assert.equal(res.status, 200)
    assert.equal(res.body.data.items.length, 2)
    assert.equal(res.body.data.pagination.total, 3)
    assert.equal(res.body.data.pagination.totalPages, 2)
  })

  test('updates a student without touching their password', async () => {
    const token = await tokenFor('admin')
    const course = await seedCourse()
    const created = await request(app)
      .post('/api/admin/students')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Original Name',
        email: 'orig@example.com',
        password: 'Password123',
        studentId: 'STU9010',
        rollNumber: '10',
        course: course._id.toString(),
        department: 'Computer Science',
        section: 'A',
      })
    const studentId = created.body.data.student._id
    const before = await User.findOne({ email: 'orig@example.com' }).select('+password')

    const res = await request(app)
      .put(`/api/admin/students/${studentId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated Name', section: 'B' })
    assert.equal(res.status, 200)
    assert.equal(res.body.data.student.user.name, 'Updated Name')
    assert.equal(res.body.data.student.section, 'B')

    const after = await User.findOne({ email: 'orig@example.com' }).select('+password')
    assert.equal(after.password, before.password) // untouched
  })

  test('deactivating a student also deactivates their login', async () => {
    const token = await tokenFor('admin')
    const course = await seedCourse()
    const created = await request(app)
      .post('/api/admin/students')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'To Deactivate',
        email: 'deactivate@example.com',
        password: 'Password123',
        studentId: 'STU9020',
        rollNumber: '20',
        course: course._id.toString(),
        department: 'Computer Science',
        section: 'A',
      })
    const studentId = created.body.data.student._id

    const res = await request(app)
      .patch(`/api/admin/students/${studentId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isActive: false })
    assert.equal(res.status, 200)

    const loginAttempt = await request(app)
      .post('/api/auth/login')
      .send({ email: 'deactivate@example.com', password: 'Password123' })
    assert.equal(loginAttempt.status, 401)
  })

  test('rejects a malformed student id with 400', async () => {
    const token = await tokenFor('admin')
    const res = await request(app).get('/api/admin/students/not-an-object-id').set('Authorization', `Bearer ${token}`)
    assert.equal(res.status, 400)
  })
})

describe('Teacher CRUD', () => {
  test('creates a teacher with role forced to "teacher"', async () => {
    const token = await tokenFor('admin')
    const res = await request(app)
      .post('/api/admin/teachers')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Dr. Smith', email: 'smith@example.com', password: 'Password123', employeeId: 'TCH-900' })
    assert.equal(res.status, 201)
    const user = await User.findOne({ email: 'smith@example.com' })
    assert.equal(user.role, 'teacher')
  })

  test('ignores a client-supplied admin role', async () => {
    const token = await tokenFor('admin')
    const res = await request(app)
      .post('/api/admin/teachers')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Sneaky',
        email: 'sneaky@example.com',
        password: 'Password123',
        employeeId: 'TCH-901',
        role: 'admin',
      })
    assert.equal(res.status, 201)
    const user = await User.findOne({ email: 'sneaky@example.com' })
    assert.equal(user.role, 'teacher')
  })

  test('rejects a duplicate employeeId', async () => {
    const token = await tokenFor('admin')
    const payload = { name: 'A', email: 'ta@example.com', password: 'Password123', employeeId: 'TCH-902' }
    await request(app).post('/api/admin/teachers').set('Authorization', `Bearer ${token}`).send(payload)
    const res = await request(app)
      .post('/api/admin/teachers')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...payload, email: 'tb@example.com' })
    assert.equal(res.status, 409)
  })

  test('updates a teacher', async () => {
    const token = await tokenFor('admin')
    const created = await request(app)
      .post('/api/admin/teachers')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Old Name', email: 'oldteacher@example.com', password: 'Password123', employeeId: 'TCH-903' })
    const id = created.body.data.teacher._id
    const res = await request(app)
      .put(`/api/admin/teachers/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ department: 'Physics' })
    assert.equal(res.status, 200)
    assert.equal(res.body.data.teacher.department, 'Physics')
  })
})

describe('Subject CRUD', () => {
  test('creates a subject linked to a course', async () => {
    const token = await tokenFor('admin')
    const course = await seedCourse()
    const res = await request(app)
      .post('/api/admin/subjects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Algorithms', code: 'CS301', credits: 4, semester: 3, course: course._id.toString() })
    assert.equal(res.status, 201)
    assert.equal(res.body.data.subject.code, 'CS301')
  })

  test('rejects a duplicate subject code', async () => {
    const token = await tokenFor('admin')
    const course = await seedCourse()
    const payload = { name: 'Algorithms', code: 'CS302', credits: 4, semester: 3, course: course._id.toString() }
    await request(app).post('/api/admin/subjects').set('Authorization', `Bearer ${token}`).send(payload)
    const res = await request(app).post('/api/admin/subjects').set('Authorization', `Bearer ${token}`).send(payload)
    assert.equal(res.status, 409)
  })

  test('updates a subject', async () => {
    const token = await tokenFor('admin')
    const course = await seedCourse()
    const created = await request(app)
      .post('/api/admin/subjects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Old Subject', code: 'CS303', credits: 3, semester: 2, course: course._id.toString() })
    const id = created.body.data.subject._id
    const res = await request(app)
      .put(`/api/admin/subjects/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ credits: 5 })
    assert.equal(res.status, 200)
    assert.equal(res.body.data.subject.credits, 5)
  })
})

describe('Course CRUD', () => {
  test('creates and lists a course', async () => {
    const token = await tokenFor('admin')
    const create = await request(app)
      .post('/api/admin/courses')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'B.Tech IT', code: 'BTIT' })
    assert.equal(create.status, 201)

    const list = await request(app).get('/api/admin/courses').set('Authorization', `Bearer ${token}`)
    assert.equal(list.status, 200)
    assert.equal(list.body.data.items.length, 1)
  })

  test('updates a course', async () => {
    const token = await tokenFor('admin')
    const created = await request(app)
      .post('/api/admin/courses')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Old Course', code: 'OLDC' })
    const id = created.body.data.course._id
    const res = await request(app)
      .put(`/api/admin/courses/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'New Course Name' })
    assert.equal(res.status, 200)
    assert.equal(res.body.data.course.name, 'New Course Name')
  })
})

describe('Classroom CRUD', () => {
  test('creates and lists a classroom', async () => {
    const token = await tokenFor('admin')
    const create = await request(app)
      .post('/api/admin/classrooms')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Lab 1', code: 'LAB-901', capacity: 30 })
    assert.equal(create.status, 201)

    const list = await request(app).get('/api/admin/classrooms').set('Authorization', `Bearer ${token}`)
    assert.equal(list.status, 200)
    assert.equal(list.body.data.items.length, 1)
  })

  test('rejects a duplicate classroom code', async () => {
    const token = await tokenFor('admin')
    const payload = { name: 'Lab 2', code: 'LAB-902', capacity: 20 }
    await request(app).post('/api/admin/classrooms').set('Authorization', `Bearer ${token}`).send(payload)
    const res = await request(app).post('/api/admin/classrooms').set('Authorization', `Bearer ${token}`).send(payload)
    assert.equal(res.status, 409)
  })

  test('rejects a non-positive capacity', async () => {
    const token = await tokenFor('admin')
    const res = await request(app)
      .post('/api/admin/classrooms')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Lab 3', code: 'LAB-903', capacity: 0 })
    assert.equal(res.status, 400)
  })

  test('updates a classroom', async () => {
    const token = await tokenFor('admin')
    const created = await request(app)
      .post('/api/admin/classrooms')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Lab 4', code: 'LAB-904', capacity: 25 })
    const id = created.body.data.classroom._id
    const res = await request(app)
      .put(`/api/admin/classrooms/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ capacity: 40 })
    assert.equal(res.status, 200)
    assert.equal(res.body.data.classroom.capacity, 40)
  })
})
