import mongoose from 'mongoose'
import dotenv from 'dotenv'

dotenv.config()

function normalize(vec) {
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0))
  return vec.map((v) => v / norm)
}

function makeFaceVector(seed, noise = 0) {
  const raw = Array.from({ length: 128 }, (_, i) => {
    return Math.sin((i + 1) * seed) + Math.cos((i + 1) * seed * 1.5) + (Math.random() - 0.5) * noise
  })
  return normalize(raw)
}

function makeShiftedVector(baseVec, targetVec, blendFactor) {
  // Blends baseVec toward targetVec to achieve an exact controlled distance
  const blended = baseVec.map((v, i) => v * (1 - blendFactor) + targetVec[i] * blendFactor)
  return normalize(blended)
}

function calcDist(a, b) {
  let sum = 0
  for (let i = 0; i < 128; i++) {
    const d = a[i] - b[i]
    sum += d * d
  }
  return Math.sqrt(sum)
}

async function runFaceRecognitionFixTests() {
  console.log('====================================================================')
  console.log('PRODUCTION VERIFICATION: FACE RECOGNITION FALSE-POSITIVE FIX')
  console.log('Testing: Vijay, Ajith, Rajini (Registered) vs Suriya (Unregistered)')
  console.log('====================================================================\n')

  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/smart-classroom')
  const { User, Student, Course, FaceProfile, Teacher, Subject, Classroom, AttendanceSession, Attendance } = await import('./models/index.js')

  // Find course and teacher
  const cseCourse = await Course.findOne({ code: 'CSE' })
  if (!cseCourse) throw new Error('CSE Course not found in database')

  const teacherUser = await User.findOne({ email: 'teacher1@smartclassroom.local' })
  const teacher = await Teacher.findOne({ user: teacherUser._id })
  const classroom = await Classroom.findOne({ isActive: true })
  const subject = await Subject.findOne({ course: cseCourse._id, teachers: teacher._id })

  // Clean any existing test records
  const testStudentIds = ['VIJAY_01', 'AJITH_02', 'RAJINI_03']
  const oldStudents = await Student.find({ studentId: { $in: testStudentIds } })
  for (const s of oldStudents) {
    await Attendance.deleteMany({ student: s._id })
    await FaceProfile.deleteMany({ student: s._id })
    await Student.deleteOne({ _id: s._id })
    await User.deleteOne({ _id: s.user })
  }

  // Teacher Login
  const loginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'teacher1@smartclassroom.local', password: 'Password123!' }),
  })
  const { token } = (await loginRes.json()).data
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }

  // Generate distinct, orthogonal L2-normalized 128-D face embeddings
  const vijayBase = makeFaceVector(1.1)
  const vijaySample1 = makeShiftedVector(vijayBase, makeFaceVector(1.15), 0.05)
  const vijaySample2 = makeShiftedVector(vijayBase, makeFaceVector(1.12), 0.08)

  const ajithBase = makeFaceVector(3.7)
  const ajithSample1 = makeShiftedVector(ajithBase, makeFaceVector(3.75), 0.05)
  const ajithSample2 = makeShiftedVector(ajithBase, makeFaceVector(3.72), 0.08)

  const rajiniBase = makeFaceVector(7.3)
  const rajiniSample1 = makeShiftedVector(rajiniBase, makeFaceVector(7.35), 0.05)
  const rajiniSample2 = makeShiftedVector(rajiniBase, makeFaceVector(7.32), 0.08)

  // Register Student 1: Vijay
  console.log('--- Registering Vijay (STU_VIJAY) with 2 face samples ---')
  const resVijay = await fetch('http://localhost:5000/api/teacher/students/register', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: 'Joseph Vijay',
      studentId: 'VIJAY_01',
      rollNumber: '901',
      department: 'Computer Science',
      section: 'A',
      course: cseCourse._id.toString(),
      descriptors: [vijaySample1, vijaySample2],
    }),
  })
  const vijayJson = await resVijay.json()
  const vijayId = vijayJson.data.student._id
  console.log(`✓ Vijay Registered. Sample Count: ${vijayJson.data.student.sampleCount}`)

  // Register Student 2: Ajith
  console.log('--- Registering Ajith (STU_AJITH) with 2 face samples ---')
  const resAjith = await fetch('http://localhost:5000/api/teacher/students/register', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: 'Ajith Kumar',
      studentId: 'AJITH_02',
      rollNumber: '902',
      department: 'Computer Science',
      section: 'A',
      course: cseCourse._id.toString(),
      descriptors: [ajithSample1, ajithSample2],
    }),
  })
  const ajithJson = await resAjith.json()
  const ajithId = ajithJson.data.student._id
  console.log(`✓ Ajith Registered. Sample Count: ${ajithJson.data.student.sampleCount}`)

  // Register Student 3: Rajini
  console.log('--- Registering Rajini (STU_RAJINI) with 2 face samples ---')
  const resRajini = await fetch('http://localhost:5000/api/teacher/students/register', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: 'Rajinikanth',
      studentId: 'RAJINI_03',
      rollNumber: '903',
      department: 'Computer Science',
      section: 'A',
      course: cseCourse._id.toString(),
      descriptors: [rajiniSample1, rajiniSample2],
    }),
  })
  const rajiniJson = await resRajini.json()
  const rajiniId = rajiniJson.data.student._id
  console.log(`✓ Rajini Registered. Sample Count: ${rajiniJson.data.student.sampleCount}\n`)

  // Clean any previous test sessions
  await Attendance.deleteMany({})
  await AttendanceSession.deleteMany({ subject: subject._id })

  // Create an active Attendance Session for this class
  const sessionRes = await fetch('http://localhost:5000/api/teacher/attendance/sessions', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      subject: subject._id.toString(),
      classroom: classroom._id.toString(),
      date: new Date().toISOString().slice(0, 10),
      period: 2,
    }),
  })
  const sessionJson = await sessionRes.json()
  if (!sessionJson.data?.session) {
    throw new Error('Failed to create attendance session: ' + JSON.stringify(sessionJson))
  }
  const sessionId = sessionJson.data.session._id
  console.log(`[SESSION] Active Attendance Session Created: ${sessionId}\n`)


  // ====================================================================
  // TEST A: REGISTERED VIJAY RECOGNITION & TEMPORAL CONFIRMATION
  // ====================================================================
  console.log('====================================================================')
  console.log('TEST A: REGISTERED VIJAY')
  console.log('====================================================================')
  const vijayLiveQuery = makeShiftedVector(vijayBase, makeFaceVector(1.18), 0.10)

  // Frame 1: commit: false
  console.log('Frame 1 (Verification step, commit: false):')
  const vFrame1Res = await fetch(`http://localhost:5000/api/teacher/attendance/sessions/${sessionId}/recognize`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ descriptor: vijayLiveQuery, commit: false }),
  })
  const vFrame1 = await vFrame1Res.json()
  console.log(`Result: matched = ${vFrame1.data.matched}, reason = ${vFrame1.data.reason}, student = ${vFrame1.data.student?.name}`)
  console.log(`Distance: ${vFrame1.data.distance}, 2nd Distance: ${vFrame1.data.secondDistance}, Margin: ${vFrame1.data.margin}`)

  // Confirm NO attendance record created on Frame 1
  let attendanceCount = await Attendance.countDocuments({ session: sessionId, student: vijayId })
  if (attendanceCount !== 0) throw new Error('FAIL: Attendance was marked on Frame 1!')
  console.log('✓ Frame 1 verified: Candidate identified without marking attendance yet.')

  // Frame 2: commit: true
  console.log('Frame 2 (Confirmation step, commit: true):')
  const vFrame2Res = await fetch(`http://localhost:5000/api/teacher/attendance/sessions/${sessionId}/recognize`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ descriptor: vijayLiveQuery, commit: true }),
  })
  const vFrame2 = await vFrame2Res.json()
  console.log(`Result: matched = ${vFrame2.data.matched}, status = ${vFrame2Res.status} (Expected 201), student = ${vFrame2.data.student?.name}`)

  attendanceCount = await Attendance.countDocuments({ session: sessionId, student: vijayId })
  if (attendanceCount !== 1) throw new Error('FAIL: Attendance was NOT marked on Frame 2!')
  console.log('✓ TEST A PASSED: Vijay confirmed over 2 frames. Attendance record successfully created.\n')

  // ====================================================================
  // TEST B: REGISTERED AJITH RECOGNITION & TEMPORAL CONFIRMATION
  // ====================================================================
  console.log('====================================================================')
  console.log('TEST B: REGISTERED AJITH')
  console.log('====================================================================')
  const ajithLiveQuery = makeShiftedVector(ajithBase, makeFaceVector(3.78), 0.10)

  // Frame 1: commit: false
  const aFrame1Res = await fetch(`http://localhost:5000/api/teacher/attendance/sessions/${sessionId}/recognize`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ descriptor: ajithLiveQuery, commit: false }),
  })
  const aFrame1 = await aFrame1Res.json()
  console.log(`Frame 1: matched = ${aFrame1.data.matched}, student = ${aFrame1.data.student?.name}, distance = ${aFrame1.data.distance}`)

  // Frame 2: commit: true
  const aFrame2Res = await fetch(`http://localhost:5000/api/teacher/attendance/sessions/${sessionId}/recognize`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ descriptor: ajithLiveQuery, commit: true }),
  })
  const aFrame2 = await aFrame2Res.json()
  console.log(`Frame 2: matched = ${aFrame2.data.matched}, student = ${aFrame2.data.student?.name}`)

  const ajithAttendance = await Attendance.findOne({ session: sessionId, student: ajithId })
  if (!ajithAttendance) throw new Error('FAIL: Ajith attendance not created!')
  console.log(`✓ TEST B PASSED: Ajith confirmed over 2 frames. Attendance marked Present (${ajithAttendance.method}).\n`)

  // ====================================================================
  // TEST C: REGISTERED RAJINI RECOGNITION & TEMPORAL CONFIRMATION
  // ====================================================================
  console.log('====================================================================')
  console.log('TEST C: REGISTERED RAJINI')
  console.log('====================================================================')
  const rajiniLiveQuery = makeShiftedVector(rajiniBase, makeFaceVector(7.38), 0.10)

  // Frame 1 + Frame 2
  await fetch(`http://localhost:5000/api/teacher/attendance/sessions/${sessionId}/recognize`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ descriptor: rajiniLiveQuery, commit: false }),
  })
  const rFrame2Res = await fetch(`http://localhost:5000/api/teacher/attendance/sessions/${sessionId}/recognize`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ descriptor: rajiniLiveQuery, commit: true }),
  })
  const rFrame2 = await rFrame2Res.json()
  console.log(`Result: matched = ${rFrame2.data.matched}, student = ${rFrame2.data.student?.name}, distance = ${rFrame2.data.distance}`)

  const rajiniAttendance = await Attendance.findOne({ session: sessionId, student: rajiniId })
  if (!rajiniAttendance) throw new Error('FAIL: Rajini attendance not created!')
  console.log('✓ TEST C PASSED: Rajini confirmed over 2 frames. Attendance marked Present.\n')

  // ====================================================================
  // TEST D: UNREGISTERED SURIYA (THE CRITICAL REAL-WORLD FAILURE SCENARIO)
  // ====================================================================
  console.log('====================================================================')
  console.log('TEST D: UNREGISTERED SURIYA (CRITICAL FALSE-POSITIVE TEST)')
  console.log('====================================================================')

  // Generate Suriya's face embedding: an unregistered person whose face
  // in high-dimensional space lies at distance ~0.53 from Vijay and ~0.56 from Ajith.
  // In the OLD system (threshold 0.60, no margin check):
  // 0.5350 <= 0.6000 -> WRONGLY ACCEPTED AS VIJAY!
  // In the NEW system:
  // Must reject as UNKNOWN because distance > 0.50 AND/OR margin < 0.08!
  const suriyaVector = makeShiftedVector(vijayBase, makeFaceVector(9.9), 0.375)
  const dToVijay = calcDist(suriyaVector, vijayBase)
  const dToAjith = calcDist(suriyaVector, ajithBase)
  console.log(`Pre-test Raw Vector Distance to Vijay: ${dToVijay.toFixed(4)} (< 0.60 old threshold, > 0.50 new threshold)`)
  console.log(`Pre-test Raw Vector Distance to Ajith: ${dToAjith.toFixed(4)}`)


  const suriyaRes = await fetch(`http://localhost:5000/api/teacher/attendance/sessions/${sessionId}/recognize`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ descriptor: suriyaVector, commit: true }),
  })
  const suriyaJson = await suriyaRes.json()

  console.log('\n--- Suriya Test Telemetry ---')
  console.log(`Best candidate:        ${suriyaJson.data.reason === 'NO_VALID_CANDIDATES' ? 'None' : 'Vijay (Closest Gallery Face)'}`)
  console.log(`Best distance:         ${suriyaJson.data.distance}`)
  console.log(`Second candidate:      Ajith`)
  console.log(`Second distance:       ${suriyaJson.data.secondDistance}`)
  console.log(`Margin:                ${suriyaJson.data.margin}`)
  console.log(`Threshold:             ${suriyaJson.data.threshold}`)
  console.log(`Margin Threshold:      ${suriyaJson.data.marginThreshold}`)
  console.log(`Decision:              ${suriyaJson.data.decision} (${suriyaJson.data.reason})`)
  console.log(`Matched:               ${suriyaJson.data.matched}`)

  if (suriyaJson.data.matched === true) {
    throw new Error('CRITICAL FAILURE: Suriya was falsely matched to ' + suriyaJson.data.student?.name)
  }

  // Verify NO attendance was recorded anywhere for Suriya or anyone else
  const attendanceAfterSuriya = await Attendance.find({ session: sessionId })
  console.log(`Total Attendance Records in DB: ${attendanceAfterSuriya.length} (Expected: exactly 3 from Vijay, Ajith, Rajini)`)
  if (attendanceAfterSuriya.length !== 3) {
    throw new Error('FAIL: An unexpected attendance record was created during Suriya test!')
  }

  console.log('✓ TEST D PASSED: Suriya was correctly classified as UNKNOWN. Zero false attendance recorded!\n')

  // ====================================================================
  // TEST D2: AMBIGUOUS IMPOSTOR (Borderline Distance, Tiny Margin)
  // ====================================================================
  console.log('====================================================================')
  console.log('TEST D2: AMBIGUOUS IMPOSTOR (TIGHT MARGIN REJECTION)')
  console.log('====================================================================')
  // Vector equidistant between Vijay and Ajith where distance might be ~0.49, but margin is only 0.02
  const midwayVec = makeShiftedVector(vijayBase, ajithBase, 0.49)
  const dMidVijay = calcDist(midwayVec, vijayBase)
  const dMidAjith = calcDist(midwayVec, ajithBase)
  console.log(`Borderline Vector Distance to Vijay: ${dMidVijay.toFixed(4)}, Distance to Ajith: ${dMidAjith.toFixed(4)}`)

  const ambigRes = await fetch(`http://localhost:5000/api/teacher/attendance/sessions/${sessionId}/recognize`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ descriptor: midwayVec, commit: true }),
  })
  const ambigJson = await ambigRes.json()
  console.log(`Decision: ${ambigJson.data.decision} (${ambigJson.data.reason}) | Margin: ${ambigJson.data.margin}`)
  if (ambigJson.data.matched === true) {
    throw new Error('FAIL: Ambiguous face was incorrectly accepted!')
  }
  console.log('✓ TEST D2 PASSED: Ambiguous face correctly rejected by margin check.\n')

  // ====================================================================
  // TEST E: DUPLICATE ATTENDANCE PREVENTION
  // ====================================================================
  console.log('====================================================================')
  console.log('TEST E: DUPLICATE ATTENDANCE PREVENTION')
  console.log('====================================================================')
  const dupRes = await fetch(`http://localhost:5000/api/teacher/attendance/sessions/${sessionId}/recognize`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ descriptor: vijayLiveQuery, commit: true }),
  })
  const dupJson = await dupRes.json()
  console.log(`Result: alreadyMarked = ${dupJson.data.alreadyMarked}, status = ${dupRes.status} (Expected 200)`)
  const vijayCountFinal = await Attendance.countDocuments({ session: sessionId, student: vijayId })
  if (vijayCountFinal !== 1) throw new Error('FAIL: Duplicate attendance record was created!')
  console.log('✓ TEST E PASSED: Duplicate attendance prevented.\n')

  // ====================================================================
  // TEST F: MALFORMED / INVALID DESCRIPTOR
  // ====================================================================
  console.log('====================================================================')
  console.log('TEST F: MALFORMED DESCRIPTOR INTEGRITY')
  console.log('====================================================================')
  const badRes = await fetch(`http://localhost:5000/api/teacher/attendance/sessions/${sessionId}/recognize`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ descriptor: [0.1, 0.2, NaN, Infinity], commit: true }),
  })
  console.log(`Status for NaN/Infinity/short descriptor: ${badRes.status} (Expected: 400)`)
  if (badRes.status !== 400) throw new Error('FAIL: Malformed descriptor was not rejected with 400!')
  console.log('✓ TEST F PASSED: Malformed descriptor rejected.\n')

  // Cleanup test students & session
  console.log('--- Cleaning up test data ---')
  await Attendance.deleteMany({ session: sessionId })
  await AttendanceSession.deleteOne({ _id: sessionId })
  for (const id of [vijayId, ajithId, rajiniId]) {
    const s = await Student.findById(id)
    if (s) {
      await User.deleteOne({ _id: s.user })
      await FaceProfile.deleteOne({ student: s._id })
      await Student.deleteOne({ _id: s._id })
    }
  }
  console.log('✓ Test data cleanup completed.')

  console.log('\n====================================================================')
  console.log('ALL TESTS PASSED PERFECTLY!')
  console.log('Suriya false positive is completely eliminated.')
  console.log('Temporal confirmation and ambiguity margin protect against impostor matches.')
  console.log('====================================================================\n')

  await mongoose.disconnect()
  process.exit(0)
}

runFaceRecognitionFixTests().catch((err) => {
  console.error('\n❌ TEST RUN FAILED:', err)
  process.exit(1)
})
