import { test, describe, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import request from 'supertest'

process.env.JWT_SECRET = 'test-secret-for-admin-setup-tests'
process.env.JWT_EXPIRES_IN = '1h'
process.env.NODE_ENV = 'test'
process.env.ADMIN_SETUP_KEY = 'super-secret-setup-key-2026'

let mongod
let app
let User
let Admin

before(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())

  ;({ default: app } = await import('../app.js'))
  ;({ default: User } = await import('../models/User.js'))
  ;({ default: Admin } = await import('../models/Admin.js'))
})

after(async () => {
  await mongoose.disconnect()
  await mongod.stop()
})

beforeEach(async () => {
  process.env.ADMIN_SETUP_KEY = 'super-secret-setup-key-2026'
  const collections = await mongoose.connection.db.collections()
  for (const collection of collections) {
    await collection.deleteMany({})
  }
})

const validAdminPayload = {
  name: 'System Admin',
  email: 'admin@institution.edu',
  password: 'AdminPassword123',
  confirmPassword: 'AdminPassword123',
  setupKey: 'super-secret-setup-key-2026',
  department: 'CSE',
}

describe('GET /api/auth/setup/status', () => {
  test('returns setupAvailable: true when no admin exists and ADMIN_SETUP_KEY is configured', async () => {
    const res = await request(app).get('/api/auth/setup/status')
    assert.equal(res.status, 200)
    assert.equal(res.body.success, true)
    assert.equal(res.body.data.setupAvailable, true)
    assert.equal(res.body.data.adminExists, false)
    assert.equal(res.body.data.hasSetupKey, true)
  })

  test('returns setupAvailable: false when an admin already exists', async () => {
    await request(app).post('/api/auth/setup').send(validAdminPayload)

    const res = await request(app).get('/api/auth/setup/status')
    assert.equal(res.status, 200)
    assert.equal(res.body.success, true)
    assert.equal(res.body.data.setupAvailable, false)
    assert.equal(res.body.data.adminExists, true)
    assert.match(res.body.data.message, /already exists/i)
  })

  test('returns setupAvailable: false when ADMIN_SETUP_KEY is missing on server', async () => {
    delete process.env.ADMIN_SETUP_KEY
    const res = await request(app).get('/api/auth/setup/status')
    assert.equal(res.status, 200)
    assert.equal(res.body.data.setupAvailable, false)
    assert.equal(res.body.data.hasSetupKey, false)
  })
})

describe('POST /api/auth/setup', () => {
  test('successfully creates the first admin, hashes password, and creates linked Admin profile', async () => {
    const res = await request(app).post('/api/auth/setup').send(validAdminPayload)

    assert.equal(res.status, 201)
    assert.equal(res.body.success, true)
    assert.equal(res.body.data.user.role, 'admin')
    assert.equal(res.body.data.user.email, 'admin@institution.edu')
    assert.equal(res.body.data.user.name, 'System Admin')
    // Password must NEVER be returned
    assert.equal(res.body.data.user.password, undefined)

    // Verify User record in DB
    const userInDb = await User.findOne({ email: 'admin@institution.edu' }).select('+password')
    assert.ok(userInDb)
    assert.equal(userInDb.role, 'admin')
    assert.notEqual(userInDb.password, validAdminPayload.password)
    assert.ok(userInDb.password.startsWith('$2'))

    // Verify Admin profile record in DB
    const adminProfile = await Admin.findOne({ user: userInDb._id })
    assert.ok(adminProfile)
    assert.equal(adminProfile.employeeId, 'ADM-001')
    assert.equal(adminProfile.department, 'CSE')
  })

  test('allows the newly created admin to log in via /api/auth/login and access admin routes', async () => {
    // 1. Create admin via setup
    await request(app).post('/api/auth/setup').send(validAdminPayload)

    // 2. Log in using normal login route
    const loginRes = await request(app).post('/api/auth/login').send({
      email: validAdminPayload.email,
      password: validAdminPayload.password,
    })
    assert.equal(loginRes.status, 200)
    assert.equal(loginRes.body.success, true)
    assert.equal(loginRes.body.data.user.role, 'admin')
    const token = loginRes.body.data.token
    assert.ok(token)

    // 3. Admin token can access protected admin route
    const authCheck = await request(app)
      .get('/api/auth/test/admin')
      .set('Authorization', `Bearer ${token}`)
    assert.equal(authCheck.status, 200)
    assert.equal(authCheck.body.role, 'admin')

    // 4. Verify /api/auth/me returns profile
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
    assert.equal(meRes.status, 200)
    assert.equal(meRes.body.data.user.role, 'admin')
    assert.ok(meRes.body.data.profile)
    assert.equal(meRes.body.data.profile.employeeId, 'ADM-001')
  })

  test('rejects setup if ADMIN_SETUP_KEY is missing on server with 503', async () => {
    delete process.env.ADMIN_SETUP_KEY
    const res = await request(app).post('/api/auth/setup').send(validAdminPayload)
    assert.equal(res.status, 503)
    assert.match(res.body.message, /disabled|not configured/i)
  })

  test('rejects setup if client provides an incorrect setup key with 403', async () => {
    const res = await request(app)
      .post('/api/auth/setup')
      .send({ ...validAdminPayload, setupKey: 'wrong-key-value' })
    assert.equal(res.status, 403)
    assert.match(res.body.message, /invalid admin setup key/i)
  })

  test('rejects registration once the first admin account is created with 409', async () => {
    // First creation succeeds
    const first = await request(app).post('/api/auth/setup').send(validAdminPayload)
    assert.equal(first.status, 201)

    // Second attempt must fail with 409
    const second = await request(app).post('/api/auth/setup').send({
      ...validAdminPayload,
      email: 'anotheradmin@institution.edu',
    })
    assert.equal(second.status, 409)
    assert.match(second.body.message, /administrator account already exists/i)
  })

  test('rejects passwords that do not match confirmPassword with 400', async () => {
    const res = await request(app)
      .post('/api/auth/setup')
      .send({ ...validAdminPayload, confirmPassword: 'DifferentPassword123' })
    assert.equal(res.status, 400)
    assert.ok(res.body.errors.some((e) => e.field === 'confirmPassword'))
  })

  test('rejects weak passwords failing security rules with 400', async () => {
    const res = await request(app)
      .post('/api/auth/setup')
      .send({ ...validAdminPayload, password: 'weak', confirmPassword: 'weak' })
    assert.equal(res.status, 400)
    assert.ok(res.body.errors.some((e) => e.field === 'password'))
  })

  test('rejects invalid email address with 400', async () => {
    const res = await request(app)
      .post('/api/auth/setup')
      .send({ ...validAdminPayload, email: 'not-an-email' })
    assert.equal(res.status, 400)
    assert.ok(res.body.errors.some((e) => e.field === 'email'))
  })

  test('rejects missing setup key with 400', async () => {
    const res = await request(app)
      .post('/api/auth/setup')
      .send({ ...validAdminPayload, setupKey: '' })
    assert.equal(res.status, 400)
    assert.ok(res.body.errors.some((e) => e.field === 'setupKey'))
  })
})

describe('CORS behavior for Vercel and deployed frontends', () => {
  test('allows requests originating from a Vercel domain with proper CORS headers', async () => {
    const res = await request(app)
      .get('/api/auth/setup/status')
      .set('Origin', 'https://smart-classroom-portal.vercel.app')
    assert.equal(res.status, 200)
    assert.equal(
      res.headers['access-control-allow-origin'],
      'https://smart-classroom-portal.vercel.app',
    )
    assert.equal(res.headers['access-control-allow-credentials'], 'true')
  })

  test('allows preflight OPTIONS requests from Vercel frontend', async () => {
    const res = await request(app)
      .options('/api/auth/setup')
      .set('Origin', 'https://smart-classroom-git-main-user.vercel.app')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'Content-Type')
    assert.equal(res.status, 204)
    assert.equal(
      res.headers['access-control-allow-origin'],
      'https://smart-classroom-git-main-user.vercel.app',
    )
  })

  test('blocks unallowed origins from receiving Access-Control-Allow-Origin', async () => {
    const res = await request(app)
      .get('/api/auth/setup/status')
      .set('Origin', 'https://unauthorized-domain.com')
    assert.equal(res.status, 200)
    assert.equal(res.headers['access-control-allow-origin'], undefined)
  })
})

