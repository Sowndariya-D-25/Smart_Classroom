import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import request from 'supertest'

process.env.JWT_SECRET = 'test-only-secret-do-not-use-in-real-deployments'
process.env.JWT_EXPIRES_IN = '1h'
process.env.NODE_ENV = 'test'

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

test('Manual Attendance: 4 students (2 Present, 1 Late, 1 Absent) saves exact statuses and Attendance History shows 2/4', async () => {
  const teacherUser = await User.create({ name: 'Teacher Test', email: 'teacher_test@example.com', password: 'Password123', role: 'teacher' })
  const teacher = await Teacher.create({ user: teacherUser._id, employeeId: 'TCH-999' })
  const loginRes = await request(app).post('/api/auth/login').send({ email: teacherUser.email, password: 'Password123' })
  const token = loginRes.body.data.token

  const course = await Course.create({ name: 'B.E. CSE', code: 'CSE-TEST' })
  const subject = await Subject.create({
    name: 'Operating Systems',
    code: 'CS-OS',
    credits: 4,
    semester: 4,
    course: course._id,
    teachers: [teacher._id],
    department: 'CSE',
  })
  const classroom = await Classroom.create({ name: 'Room 101', code: 'R101', capacity: 40 })

  // 4 students on the roster for CSE Section A
  const students = []
  for (let i = 1; i <= 4; i++) {
    const sUser = await User.create({ name: `Student ${i}`, email: `student${i}@example.com`, password: 'Password123', role: 'student' })
    const stu = await Student.create({
      user: sUser._id,
      studentId: `STU00${i}`,
      rollNumber: `0${i}`,
      course: course._id,
      department: 'CSE',
      section: 'A',
    })
    students.push(stu)
  }

  // Create an attendance session
  const createRes = await request(app)
    .post('/api/teacher/attendance/sessions')
    .set('Authorization', `Bearer ${token}`)
    .send({
      subject: subject._id.toString(),
      classroom: classroom._id.toString(),
      date: '2026-03-01',
      period: 1,
      startTime: '08:00',
      endTime: '09:00',
      department: 'CSE',
      section: 'A',
    })
  assert.equal(createRes.status, 201)
  const sessionId = createRes.body.data.session._id

  // Mark 2 Present, 1 Late, 1 Absent
  const records = [
    { student: students[0]._id.toString(), status: 'Present' },
    { student: students[1]._id.toString(), status: 'Present' },
    { student: students[2]._id.toString(), status: 'Late' },
    { student: students[3]._id.toString(), status: 'Absent' },
  ]

  // Complete session passing the records
  const completeRes = await request(app)
    .post(`/api/teacher/attendance/sessions/${sessionId}/complete`)
    .set('Authorization', `Bearer ${token}`)
    .send({ records })

  assert.equal(completeRes.status, 200)

  // Verify in MongoDB
  const savedRecords = await Attendance.find({ session: sessionId }).sort({ student: 1 })
  assert.equal(savedRecords.length, 4)

  const s0Rec = savedRecords.find((r) => r.student.equals(students[0]._id))
  assert.equal(s0Rec.status, 'Present')

  const s1Rec = savedRecords.find((r) => r.student.equals(students[1]._id))
  assert.equal(s1Rec.status, 'Present')

  const s2Rec = savedRecords.find((r) => r.student.equals(students[2]._id))
  assert.equal(s2Rec.status, 'Late')

  const s3Rec = savedRecords.find((r) => r.student.equals(students[3]._id))
  assert.equal(s3Rec.status, 'Absent')

  // Verify getSession returns exact statuses
  const sessionDetails = await request(app)
    .get(`/api/teacher/attendance/sessions/${sessionId}`)
    .set('Authorization', `Bearer ${token}`)
  assert.equal(sessionDetails.status, 200)
  assert.equal(sessionDetails.body.data.summary.present, 2)
  assert.equal(sessionDetails.body.data.summary.late, 1)
  assert.equal(sessionDetails.body.data.summary.absent, 1)
  assert.equal(sessionDetails.body.data.summary.total, 4)

  // Verify Attendance History listSessions returns 2/4
  const historyRes = await request(app)
    .get('/api/teacher/attendance/sessions')
    .set('Authorization', `Bearer ${token}`)
  assert.equal(historyRes.status, 200)

  const historyItem = historyRes.body.data.items.find((it) => it._id === sessionId)
  assert.ok(historyItem)
  assert.equal(historyItem.presentCount, 2)
  assert.equal(historyItem.studentsMarked, 2) // Present numerator
  assert.equal(historyItem.totalStudents, 4) // Denominator is session-specific roster count
})

test('Duplicate Session Prevention: Blocks second session for same time slot even if period changes', async () => {
  const teacherUser = await User.create({ name: 'Teacher Dup', email: 'teacher_dup@example.com', password: 'Password123', role: 'teacher' })
  const teacher = await Teacher.create({ user: teacherUser._id, employeeId: 'TCH-888' })
  const loginRes = await request(app).post('/api/auth/login').send({ email: teacherUser.email, password: 'Password123' })
  const token = loginRes.body.data.token

  const course = await Course.create({ name: 'B.E. ECE', code: 'ECE-TEST' })
  const subject1 = await Subject.create({
    name: 'Signals',
    code: 'EC-SIG',
    credits: 4,
    semester: 4,
    course: course._id,
    teachers: [teacher._id],
    department: 'ECE',
  })
  const subject2 = await Subject.create({
    name: 'Digital Systems',
    code: 'EC-DIG',
    credits: 4,
    semester: 4,
    course: course._id,
    teachers: [teacher._id],
    department: 'ECE',
  })
  const classroom = await Classroom.create({ name: 'Room 202', code: 'R202', capacity: 40 })

  // 1. First session for slot 09:00 - 10:00 succeeds
  const s1 = await request(app)
    .post('/api/teacher/attendance/sessions')
    .set('Authorization', `Bearer ${token}`)
    .send({
      subject: subject1._id.toString(),
      classroom: classroom._id.toString(),
      date: '2026-03-05',
      period: 1,
      startTime: '09:00',
      endTime: '10:00',
      department: 'ECE',
      section: 'A',
    })
  assert.equal(s1.status, 201)

  // 2. Second session for same time slot (09:00 - 10:00) with DIFFERENT period (2) and subject is REJECTED
  const s2 = await request(app)
    .post('/api/teacher/attendance/sessions')
    .set('Authorization', `Bearer ${token}`)
    .send({
      subject: subject2._id.toString(),
      classroom: classroom._id.toString(),
      date: '2026-03-05',
      period: 2, // Changed period!
      startTime: '09:00', // Same time slot!
      endTime: '10:00',
      department: 'ECE',
      section: 'A',
    })
  assert.equal(s2.status, 409)
  assert.match(s2.body.message, /Attendance has already been created for this time slot/i)

  // 3. Different legitimate time slot (11:00 - 12:00) on the same day SUCCEEDS
  const s3 = await request(app)
    .post('/api/teacher/attendance/sessions')
    .set('Authorization', `Bearer ${token}`)
    .send({
      subject: subject1._id.toString(),
      classroom: classroom._id.toString(),
      date: '2026-03-05',
      period: 3,
      startTime: '11:00',
      endTime: '12:00',
      department: 'ECE',
      section: 'A',
    })
  assert.equal(s3.status, 201)

  // 4. Separate section (Section B) for slot 09:00 - 10:00 with another teacher SUCCEEDS
  const teacherUserB = await User.create({ name: 'Teacher Dup B', email: 'teacher_dup_b@example.com', password: 'Password123', role: 'teacher' })
  const teacherB = await Teacher.create({ user: teacherUserB._id, employeeId: 'TCH-889' })
  const loginResB = await request(app).post('/api/auth/login').send({ email: teacherUserB.email, password: 'Password123' })
  const tokenB = loginResB.body.data.token
  await Subject.findByIdAndUpdate(subject1._id, { $push: { teachers: teacherB._id } })

  const classroomB = await Classroom.create({ name: 'Room 203', code: 'R203', capacity: 40 })

  const s4 = await request(app)
    .post('/api/teacher/attendance/sessions')
    .set('Authorization', `Bearer ${tokenB}`)
    .send({
      subject: subject1._id.toString(),
      classroom: classroomB._id.toString(),
      date: '2026-03-05',
      period: 1,
      startTime: '09:00',
      endTime: '10:00',
      department: 'ECE',
      section: 'B', // Different section!
    })
  assert.equal(s4.status, 201)
})
