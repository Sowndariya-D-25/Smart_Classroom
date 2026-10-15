import { test, describe, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import request from 'supertest'

/**
 * End-to-end authentication tests: real HTTP requests (via supertest)
 * against the actual Express app, backed by a real in-memory MongoDB.
 *
 * NOTE: like models.integration.test.js, mongodb-memory-server downloads
 * a real `mongod` binary on first run and needs an internet connection —
 * it will not run in network-locked sandboxes.
 *
 * Run with: npm test   (from /server)
 */

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only-secret-do-not-use-in-real-deployments'
process.env.JWT_EXPIRES_IN = '2s' // short-lived so the expiry test doesn't need to sleep long
process.env.NODE_ENV = 'test' // keeps the /test/* dev-only routes mounted, silences morgan

let mongod
let app
let User

before(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())

  // Imported after JWT_SECRET/NODE_ENV are set and after mongoose is
  // connected, since app.js and the models read env vars at import time.
  ;({ default: app } = await import('../app.js'))
  ;({ default: User } = await import('../models/User.js'))
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

const validRegistration = {
  name: 'Test Student',
  email: 'student@example.com',
  password: 'Password123',
}

describe('POST /api/auth/register', () => {
  test('registers a new (student) account', async () => {
    const res = await request(app).post('/api/auth/register').send(validRegistration)
    assert.equal(res.status, 201)
    assert.equal(res.body.success, true)
    assert.equal(res.body.data.user.role, 'student')
    assert.equal(res.body.data.user.email, 'student@example.com')
    assert.ok(res.body.data.token)
    assert.equal(res.body.data.user.password, undefined)
  })

  test('ignores a client-supplied admin role and forces student', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validRegistration, role: 'admin' })
    assert.equal(res.status, 201)
    assert.equal(res.body.data.user.role, 'student')
  })

  test('rejects an invalid email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validRegistration, email: 'not-an-email' })
    assert.equal(res.status, 400)
    assert.equal(res.body.success, false)
    assert.ok(res.body.errors.some((e) => e.field === 'email'))
  })

  test('rejects a weak password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validRegistration, password: 'weak' })
    assert.equal(res.status, 400)
    assert.ok(res.body.errors.some((e) => e.field === 'password'))
  })

  test('rejects missing fields', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'x@example.com' })
    assert.equal(res.status, 400)
    assert.ok(res.body.errors.length > 0)
  })

  test('rejects a duplicate email', async () => {
    await request(app).post('/api/auth/register').send(validRegistration)
    const res = await request(app).post('/api/auth/register').send(validRegistration)
    assert.equal(res.status, 409)
  })

  test('stores the password hashed, never in plain text', async () => {
    await request(app).post('/api/auth/register').send(validRegistration)
    const stored = await User.findOne({ email: validRegistration.email }).select('+password')
    assert.notEqual(stored.password, validRegistration.password)
    assert.ok(stored.password.startsWith('$2')) // bcrypt hash prefix
  })
})

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await request(app).post('/api/auth/register').send(validRegistration)
  })

  test('logs in with correct credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: validRegistration.email, password: validRegistration.password })
    assert.equal(res.status, 200)
    assert.ok(res.body.data.token)
    assert.equal(res.body.data.user.email, validRegistration.email)
  })

  test('rejects the wrong password with a generic message', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: validRegistration.email, password: 'WrongPassword1' })
    assert.equal(res.status, 401)
    assert.match(res.body.message, /invalid email or password/i)
  })

  test('rejects an unknown email with the same generic message', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'Password123' })
    assert.equal(res.status, 401)
    assert.match(res.body.message, /invalid email or password/i)
  })

  test('rejects a deactivated account', async () => {
    await User.updateOne({ email: validRegistration.email }, { isActive: false })
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: validRegistration.email, password: validRegistration.password })
    assert.equal(res.status, 401)
  })
})

describe('GET /api/auth/me', () => {
  test('rejects a request with no token', async () => {
    const res = await request(app).get('/api/auth/me')
    assert.equal(res.status, 401)
  })

  test('rejects an invalid token', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer not-a-real-token')
    assert.equal(res.status, 401)
  })

  test('rejects an expired token', async () => {
    const reg = await request(app).post('/api/auth/register').send(validRegistration)
    const { token } = reg.body.data
    await new Promise((resolve) => setTimeout(resolve, 2100)) // JWT_EXPIRES_IN is 2s for this suite
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`)
    assert.equal(res.status, 401)
  })

  test('returns the current user for a valid token', async () => {
    const reg = await request(app).post('/api/auth/register').send(validRegistration)
    const { token } = reg.body.data
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`)
    assert.equal(res.status, 200)
    assert.equal(res.body.data.user.email, validRegistration.email)
    assert.equal(res.body.data.user.password, undefined)
  })
})

describe('Role-based authorization', () => {
  const asUser = async (role) => {
    const email = `${role}@example.com`
    await User.create({ name: role, email, password: 'Password123', role })
    const res = await request(app).post('/api/auth/login').send({ email, password: 'Password123' })
    return res.body.data.token
  }

  test('admin can reach the admin-only test route', async () => {
    const token = await asUser('admin')
    const res = await request(app).get('/api/auth/test/admin').set('Authorization', `Bearer ${token}`)
    assert.equal(res.status, 200)
  })

  test('teacher is forbidden from the admin-only test route', async () => {
    const token = await asUser('teacher')
    const res = await request(app).get('/api/auth/test/admin').set('Authorization', `Bearer ${token}`)
    assert.equal(res.status, 403)
  })

  test('student is forbidden from the admin-only test route', async () => {
    const token = await asUser('student')
    const res = await request(app).get('/api/auth/test/admin').set('Authorization', `Bearer ${token}`)
    assert.equal(res.status, 403)
  })

  test('teacher can reach the teacher test route', async () => {
    const token = await asUser('teacher')
    const res = await request(app).get('/api/auth/test/teacher').set('Authorization', `Bearer ${token}`)
    assert.equal(res.status, 200)
  })

  test('student can reach the student test route', async () => {
    const token = await asUser('student')
    const res = await request(app).get('/api/auth/test/student').set('Authorization', `Bearer ${token}`)
    assert.equal(res.status, 200)
  })
})
