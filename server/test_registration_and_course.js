import mongoose from 'mongoose'
import dotenv from 'dotenv'

dotenv.config()

async function runTests() {
  console.log('========================================================')
  console.log('VERIFYING TEACHER FACE REGISTRATION & COURSE BEHAVIOR')
  console.log('========================================================\n')

  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/smart-classroom')
  const { User, Student, Course, FaceProfile, Teacher, Subject, Classroom, AttendanceSession, Attendance } = await import('./models/index.js')

  // 1. Initial State Check
  const initialCourses = await Course.find()
  console.log(`[CHECK] Courses in DB: ${initialCourses.length}`)
  const cseCourse = initialCourses.find(c => c.code === 'CSE')
  if (!cseCourse) throw new Error('CSE Course not found!')
  console.log(`[CHECK] CSE Course ID: ${cseCourse._id}, Name: "${cseCourse.name}", Code: "${cseCourse.code}"`)

  const initialStudents = await Student.find({ studentId: { $in: Array.from({ length: 20 }, (_, i) => `STU${String(i + 1).padStart(4, '0')}`) } })
  console.log(`[CHECK] Existing Baseline Students in DB: ${initialStudents.length}`)

  // Clean any previous test students
  const testStudentIds = ['TEST_STU_A', 'TEST_STU_B', 'TEST_STU_C']
  const existingTestStudents = await Student.find({ studentId: { $in: testStudentIds } })
  for (const s of existingTestStudents) {
    await Student.deleteOne({ _id: s._id })
    await User.deleteOne({ _id: s.user })
    await FaceProfile.deleteOne({ student: s._id })
  }

  // Teacher Auth
  const loginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'teacher1@smartclassroom.local', password: 'Password123!' }),
  })
  const loginJson = await loginRes.json()
  const token = loginJson.data?.token
  if (!token) throw new Error('Teacher login failed: ' + JSON.stringify(loginJson))
  console.log('[AUTH] Teacher login successful\n')

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
  const mockDescriptor1 = Array.from({ length: 128 }, (_, i) => Math.cos(i * 0.1) * 0.12)
  const mockDescriptor2 = mockDescriptor1.map(v => v + 0.01)
  const mockDescriptorB1 = Array.from({ length: 128 }, (_, i) => Math.sin(i * 0.2) * 0.25)
  const mockDescriptorB2 = mockDescriptorB1.map(v => v + 0.01)

  // TEST A: Register NEW student using existing CSE course
  console.log('--- TEST A: Register NEW student using existing CSE course ---')
  const resA = await fetch('http://localhost:5000/api/teacher/students/register', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: 'Test Student Alpha',
      studentId: 'TEST_STU_A',
      rollNumber: '881',
      department: 'Computer Science',
      section: 'A',
      course: cseCourse._id.toString(),
      email: 'test_alpha@smartclassroom.local',
      gender: 'Male',
      year: 2,
      descriptors: [mockDescriptor1, mockDescriptor2],
    }),
  })
  const dataA = await resA.json()
  console.log(`Test A Status: ${resA.status} (Expected: 201)`)
  console.log(`Test A Message: "${dataA.message}"`)
  if (resA.status !== 201) throw new Error(`Test A Failed: Expected 201, got ${resA.status}`)
  console.log('✓ TEST A PASSED: Student Alpha registered with 201 Created.\n')

  // TEST B: Register ANOTHER new student using SAME CSE course
  console.log('--- TEST B: Register another NEW student using the SAME CSE course ---')
  const resB = await fetch('http://localhost:5000/api/teacher/students/register', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: 'Test Student Beta',
      studentId: 'TEST_STU_B',
      rollNumber: '882',
      department: 'Computer Science',
      section: 'A',
      course: cseCourse._id.toString(),
      email: 'test_beta@smartclassroom.local',
      gender: 'Female',
      year: 2,
      descriptors: [mockDescriptorB1, mockDescriptorB2],
    }),
  })
  const dataB = await resB.json()

  console.log(`Test B Status: ${resB.status} (Expected: 201)`)
  console.log(`Test B Message: "${dataB.message}"`)
  if (resB.status !== 201) throw new Error(`Test B Failed: Expected 201, got ${resB.status}`)
  console.log('✓ TEST B PASSED: Multiple students successfully share the exact same course.\n')

  // TEST C: Attempt to register the SAME register number
  console.log('--- TEST C: Attempt to register the SAME register number ---')
  const resC = await fetch('http://localhost:5000/api/teacher/students/register', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: 'Duplicate Student Alpha',
      studentId: 'TEST_STU_A',
      rollNumber: '889',
      department: 'Computer Science',
      section: 'A',
      course: cseCourse._id.toString(),
      email: 'diff_email@smartclassroom.local',
      gender: 'Male',
      year: 2,
    }),
  })
  const dataC = await resC.json()
  console.log(`Test C Status: ${resC.status} (Expected: 409)`)
  console.log(`Test C Message: "${dataC.message}"`)
  if (resC.status !== 409) throw new Error(`Test C Failed: Expected 409, got ${resC.status}`)
  if (!dataC.message.includes('Register number') && !dataC.message.includes('already exists')) {
    throw new Error(`Test C Failed: Message did not mention Register number conflict: ${dataC.message}`)
  }
  console.log('✓ TEST C PASSED: Duplicate register number rejected with 409 and clear message.\n')

  // TEST C2: Attempt to register duplicate Roll Number in the same course
  console.log('--- TEST C2: Attempt to register duplicate roll number in same course ---')
  const resC2 = await fetch('http://localhost:5000/api/teacher/students/register', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: 'Conflict Roll Student',
      studentId: 'TEST_STU_C',
      rollNumber: '881', // Already taken by TEST_STU_A
      department: 'Computer Science',
      section: 'A',
      course: cseCourse._id.toString(),
      email: 'roll_conflict@smartclassroom.local',
      gender: 'Male',
      year: 2,
    }),
  })
  const dataC2 = await resC2.json()
  console.log(`Test C2 Status: ${resC2.status} (Expected: 409)`)
  console.log(`Test C2 Message: "${dataC2.message}"`)
  if (resC2.status !== 409) throw new Error(`Test C2 Failed: Expected 409, got ${resC2.status}`)
  if (dataC2.message.toLowerCase().includes('course already in use')) {
    throw new Error(`Test C2 Failed: Server still incorrectly reports 'course already in use'!`)
  }
  if (!dataC2.message.includes('Roll number') || !dataC2.message.includes('already')) {
    throw new Error(`Test C2 Failed: Unexpected message: ${dataC2.message}`)
  }
  console.log('✓ TEST C2 PASSED: Roll number collision correctly identified (NOT "course already in use").\n')

  // TEST D: Existing 20 baseline students remain unchanged
  console.log('--- TEST D: Existing 20 baseline students remain unchanged ---')
  const baselineAfter = await Student.find({ studentId: { $in: Array.from({ length: 20 }, (_, i) => `STU${String(i + 1).padStart(4, '0')}`) } })
  console.log(`Baseline students count: ${baselineAfter.length} / 20`)
  if (baselineAfter.length !== 20) throw new Error('Test D Failed: Baseline students count changed!')
  console.log('✓ TEST D PASSED: All 20 baseline students remain intact.\n')

  // TEST E: Course collection must still contain exactly 1 CSE course
  console.log('--- TEST E: Course collection must still contain exactly 1 CSE course ---')
  const coursesAfter = await Course.find()
  console.log(`Total courses in DB: ${coursesAfter.length}`)
  const cseAfter = coursesAfter.filter(c => c.code === 'CSE')
  console.log(`CSE courses in DB: ${cseAfter.length}`)
  if (coursesAfter.length !== 1 || cseAfter.length !== 1) {
    throw new Error('Test E Failed: Course count is not exactly 1!')
  }
  console.log('✓ TEST E PASSED: Exactly 1 CSE course exists in MongoDB.\n')

  // TEST F, G, H: Face Registration, Face Recognition, and Attendance
  console.log('--- TEST F, G, H: Face Registration, Recognition & Attendance ---')
  const teacherUser = await User.findOne({ email: 'teacher1@smartclassroom.local' })
  const teacher = await Teacher.findOne({ user: teacherUser._id })
  const subject = await Subject.findOne({ teachers: teacher._id }).populate('course')
  const classroom = await Classroom.findOne({ isActive: true })

  // Clean sessions for test date
  const testDate = '2026-09-28'
  await AttendanceSession.deleteMany({ subject: subject._id, date: new Date(testDate) })

  // Create session
  const sessRes = await fetch('http://localhost:5000/api/teacher/attendance/sessions', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      subject: subject._id,
      classroom: classroom._id,
      department: 'Computer Science',
      section: 'A',
      period: 1,
      date: testDate,
      startTime: '10:00',
      endTime: '11:00',
    }),
  })
  const sessJson = await sessRes.json()
  const sessionId = sessJson.data?.session?._id
  console.log(`Session Created: ${sessionId}`)

  // Recognize Student Alpha's face
  const recogRes = await fetch(`http://localhost:5000/api/teacher/attendance/sessions/${sessionId}/recognize`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ descriptor: mockDescriptor1 }),
  })
  const recogJson = await recogRes.json()
  console.log('Face Recognition Result:', recogJson.data)
  if (!recogJson.data?.matched || recogJson.data?.student?.studentId !== 'TEST_STU_A') {
    throw new Error('Test G Failed: Face recognition did not match registered student TEST_STU_A')
  }
  console.log('✓ TEST F & G PASSED: Face profile registered and recognized successfully.')

  // Verify attendance record
  const studentDoc = await Student.findOne({ studentId: 'TEST_STU_A' })
  const attRecord = await Attendance.findOne({ session: sessionId, student: studentDoc._id })
  console.log('Attendance Record in DB:', { status: attRecord?.status, confidence: attRecord?.confidence })
  if (!attRecord || attRecord.status !== 'Present') {
    throw new Error('Test H Failed: Attendance record not marked as Present')
  }
  console.log('✓ TEST H PASSED: Attendance record marked correctly.\n')

  // Clean up test data
  console.log('--- CLEANUP: Removing temporary test students and test session ---')
  for (const sId of testStudentIds) {
    const s = await Student.findOne({ studentId: sId })
    if (s) {
      await Student.deleteOne({ _id: s._id })
      await User.deleteOne({ _id: s.user })
      await FaceProfile.deleteOne({ student: s._id })
      await Attendance.deleteMany({ student: s._id })
    }
  }
  await AttendanceSession.deleteMany({ _id: sessionId })
  await Attendance.deleteMany({ session: sessionId })

  const finalStudentsCount = await Student.countDocuments()
  console.log(`Final Students Count in DB: ${finalStudentsCount} (Expected: 20)`)
  const finalCoursesCount = await Course.countDocuments()
  console.log(`Final Courses Count in DB: ${finalCoursesCount} (Expected: 1)`)

  console.log('\n========================================================')
  console.log('ALL VERIFICATION TESTS (A through H) PASSED PERFECTLY!')
  console.log('========================================================')

  await mongoose.disconnect()
}

runTests().catch(err => {
  console.error('\n❌ TEST RUN FAILED:', err)
  process.exit(1)
})
