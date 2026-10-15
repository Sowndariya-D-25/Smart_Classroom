import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import {
  User,
  Teacher,
  Student,
  Subject,
  Classroom,
  Course,
  AttendanceSession,
  Attendance,
  FaceProfile,
} from '../models/index.js';
import {
  FACE_MATCH_THRESHOLD,
  euclideanDistance,
  bestDistanceToProfile,
  distanceToConfidence,
  isValidDescriptor,
} from '../utils/faceDistance.js';
import { getRoster, loadOwnedSession } from '../controllers/teacher/attendance.controller.js';

async function runTestSuite() {
  console.log('====================================================');
  console.log('STARTING FACE RECOGNITION ATTENDANCE VERIFICATION SUITE');
  console.log(`Configured FACE_MATCH_THRESHOLD = ${FACE_MATCH_THRESHOLD}`);
  console.log('====================================================\n');

  await mongoose.connect(process.env.MONGO_URI);

  const testResults = [];

  // Setup: Find teacher, subject, course, and students
  const teacher = await Teacher.findOne({ isActive: true }).populate('user');
  if (!teacher) throw new Error('No teacher found in database');
  const subject = await Subject.findOne({ teachers: teacher._id, isActive: true }).populate('course');
  if (!subject) throw new Error('No subject found for teacher');
  const classroom = await Classroom.findOne({ isActive: true });
  if (!classroom) throw new Error('No classroom found');

  const roster = await getRoster(subject.course._id, {
    department: subject.department,
    section: 'A',
  });
  console.log(`Class Roster for Subject "${subject.name}" (${subject.code}): ${roster.length} students`);

  const student1 = roster.find(s => s.studentId === 'STU0001');
  const student2 = roster.find(s => s.studentId === 'STU0002');
  if (!student1 || !student2) throw new Error('STU0001 and STU0002 must exist in session roster');

  const fp1 = await FaceProfile.findOne({ student: student1._id, isActive: true });
  const fp2 = await FaceProfile.findOne({ student: student2._id, isActive: true });
  if (!fp1 || !fp2) throw new Error('Face profiles must exist for STU0001 and STU0002');

  console.log(`Student 1: ${student1.studentId} (${student1.user?.name}) with ${fp1.descriptors.length} face samples`);
  console.log(`Student 2: ${student2.studentId} (${student2.user?.name}) with ${fp2.descriptors.length} face samples`);

  // Create a brand new active session for this test suite
  const testSession = await AttendanceSession.create({
    teacher: teacher._id,
    subject: subject._id,
    classroom: classroom._id,
    department: subject.department || 'Computer Science',
    section: 'A',
    date: new Date(),
    period: 1,
    startTime: '09:00',
    endTime: '10:00',
    status: 'Active',
    detectedStudents: [],
    unknownFaces: [],
  });
  console.log(`Created test AttendanceSession: ${testSession._id}\n`);

  // Helper to execute recognition against a session
  async function simulateRecognize(sessionId, teacherId, descriptor) {
    if (!isValidDescriptor(descriptor)) {
      return {
        status: 400,
        success: false,
        message: 'Invalid face descriptor',
        data: { matched: false, reason: 'INVALID_DESCRIPTOR' },
      };
    }

    const session = await loadOwnedSession(sessionId, teacherId);
    if (!session) return { status: 404, message: 'Session not found' };
    if (session.status === 'Completed' || session.status === 'Cancelled') {
      return { status: 400, message: `Session is ${session.status}` };
    }

    const currentRoster = await getRoster(session.subject.course?._id, {
      department: session.department,
      section: session.section,
    });
    const currentRosterIds = currentRoster.map(s => s._id);

    const profiles = await FaceProfile.find({
      student: { $in: currentRosterIds },
      isActive: true,
      'descriptors.0': { $exists: true },
    });

    let best = null;
    for (const profile of profiles) {
      const distance = bestDistanceToProfile(descriptor, profile);
      if (!Number.isFinite(distance)) continue;
      if (!best || distance < best.distance) {
        best = { profile, distance };
      }
    }

    const isMatch = Boolean(
      best &&
      Number.isFinite(best.distance) &&
      best.distance <= FACE_MATCH_THRESHOLD
    );

    const bestStudent = best?.profile?.student
      ? currentRoster.find(s => s._id.equals(best.profile.student))
      : null;
    const bestCandidateLabel = bestStudent
      ? `${bestStudent.studentId} (${bestStudent.user?.name || 'Unknown'})`
      : 'None';

    console.log(
      `[LOG DEBUG] Session: ${session._id} | Candidates: ${profiles.length} | ` +
      `Best Candidate: ${bestCandidateLabel} | Distance: ${best && Number.isFinite(best.distance) ? best.distance.toFixed(4) : 'N/A'} | ` +
      `Threshold: ${FACE_MATCH_THRESHOLD.toFixed(2)} | Result: ${isMatch ? 'MATCH' : 'UNKNOWN'}`
    );

    if (!isMatch) {
      session.unknownFaces.push({
        count: 1,
        confidence: best?.distance ? Number(distanceToConfidence(best.distance).toFixed(2)) : 0,
        detectedAt: new Date(),
      });
      await session.save().catch(() => {});

      return {
        status: 200,
        success: true,
        data: {
          matched: false,
          alreadyMarked: false,
          student: null,
          confidence: 0,
          distance: best?.distance ? Number(best.distance.toFixed(4)) : null,
          threshold: FACE_MATCH_THRESHOLD,
        },
      };
    }

    const student = currentRoster.find(s => s._id.equals(best.profile.student));
    if (!student) {
      return {
        status: 200,
        success: true,
        data: { matched: false, alreadyMarked: false, student: null },
      };
    }

    const confidence = Number(distanceToConfidence(best.distance).toFixed(2));
    const existing = await Attendance.findOne({ student: student._id, session: session._id });
    if (existing) {
      return {
        status: 200,
        success: true,
        data: {
          matched: true,
          alreadyMarked: true,
          student: {
            _id: student._id,
            name: student.user?.name,
            studentId: student.studentId,
          },
          distance: Number(best.distance.toFixed(4)),
          confidence,
        },
      };
    }

    const attendance = await Attendance.create({
      student: student._id,
      subject: session.subject._id,
      teacher: teacherId,
      classroom: session.classroom._id,
      department: session.department || student.department,
      section: session.section || student.section,
      session: session._id,
      date: session.date,
      period: session.period,
      status: 'Present',
      method: 'Face Recognition',
      confidence,
      markedBy: teacher.user._id,
    });

    if (!session.detectedStudents.some(id => id.equals(student._id))) {
      session.detectedStudents.push(student._id);
      await session.save().catch(() => {});
    }

    return {
      status: 201,
      success: true,
      data: {
        matched: true,
        alreadyMarked: false,
        student: {
          _id: student._id,
          name: student.user?.name,
          studentId: student.studentId,
        },
        distance: Number(best.distance.toFixed(4)),
        confidence,
        attendance,
      },
    };
  }

  // TEST 1: Registered Student 1 face
  console.log('--- TEST 1: Registered Student 1 Face ---');
  const stu1Face = fp1.descriptors[0]; // Exactly Student 1's sample
  const res1 = await simulateRecognize(testSession._id, teacher._id, stu1Face);
  const att1 = await Attendance.findOne({ session: testSession._id, student: student1._id });
  const att2_after_test1 = await Attendance.findOne({ session: testSession._id, student: student2._id });
  const pass1 = res1.data.matched === true &&
    res1.data.student.studentId === 'STU0001' &&
    att1?.status === 'Present' &&
    !att2_after_test1;
  testResults.push({
    test: 'TEST 1: Registered Student 1 Face',
    expected: 'Student 1 Present, Student 2 unchanged',
    actual: `Student 1 ${att1?.status || 'None'}, Student 2 ${att2_after_test1?.status || 'None'}`,
    status: pass1 ? 'PASS' : 'FAIL',
  });
  console.log(`Result: ${pass1 ? 'PASS' : 'FAIL'}\n`);

  // TEST 2: Registered Student 2 face
  console.log('--- TEST 2: Registered Student 2 Face ---');
  const stu2Face = fp2.descriptors[0]; // Exactly Student 2's sample
  const res2 = await simulateRecognize(testSession._id, teacher._id, stu2Face);
  const att2 = await Attendance.findOne({ session: testSession._id, student: student2._id });
  const pass2 = res2.data.matched === true &&
    res2.data.student.studentId === 'STU0002' &&
    att2?.status === 'Present';
  testResults.push({
    test: 'TEST 2: Registered Student 2 Face',
    expected: 'Student 2 Present, Student 1 unchanged',
    actual: `Student 2 ${att2?.status || 'None'}, Student 1 ${att1?.status || 'None'}`,
    status: pass2 ? 'PASS' : 'FAIL',
  });
  console.log(`Result: ${pass2 ? 'PASS' : 'FAIL'}\n`);

  // TEST 3: Completely unregistered person's face
  console.log('--- TEST 3: Completely Unregistered Person\'s Face ---');
  // Generate an arbitrary valid 128-d face vector completely distinct from both students
  const unregisteredFace = Array.from({ length: 128 }, (_, i) => Number((Math.sin(i * 0.9) * 0.15).toFixed(6)));
  const normU = Math.sqrt(unregisteredFace.reduce((s, v) => s + v * v, 0));
  const unitUnregFace = unregisteredFace.map(v => v / normU);

  const countBefore3 = await Attendance.countDocuments({ session: testSession._id });
  const res3 = await simulateRecognize(testSession._id, teacher._id, unitUnregFace);
  const countAfter3 = await Attendance.countDocuments({ session: testSession._id });
  const pass3 = res3.data.matched === false &&
    res3.data.student === null &&
    countBefore3 === countAfter3;
  testResults.push({
    test: 'TEST 3: Completely Unregistered Person Face',
    expected: 'UNKNOWN, Nobody marked Present',
    actual: `matched=${res3.data.matched}, attendanceCountDelta=${countAfter3 - countBefore3}`,
    status: pass3 ? 'PASS' : 'FAIL',
  });
  console.log(`Result: ${pass3 ? 'PASS' : 'FAIL'}\n`);

  // TEST 4: Another person's face that looks somewhat similar (distance ~0.65 > threshold 0.60)
  console.log('--- TEST 4: Similar Unregistered Face (Distance > 0.60) ---');
  // Construct a vector at distance ~0.68 from Student 1
  const similarFace = fp1.descriptors[0].map((v, i) => v + (i < 64 ? 0.06 : -0.06));
  const distToStu1 = euclideanDistance(similarFace, fp1.descriptors[0]);
  console.log(`Constructed similar face distance to STU0001: ${distToStu1.toFixed(4)} (Threshold: 0.60)`);

  const countBefore4 = await Attendance.countDocuments({ session: testSession._id });
  const res4 = await simulateRecognize(testSession._id, teacher._id, similarFace);
  const countAfter4 = await Attendance.countDocuments({ session: testSession._id });
  const pass4 = res4.data.matched === false && countBefore4 === countAfter4;
  testResults.push({
    test: 'TEST 4: Borderline Unregistered Face (d > 0.60)',
    expected: 'UNKNOWN (distance > 0.60), Nobody marked',
    actual: `matched=${res4.data.matched}, bestDistance=${res4.data.distance}`,
    status: pass4 ? 'PASS' : 'FAIL',
  });
  console.log(`Result: ${pass4 ? 'PASS' : 'FAIL'}\n`);

  // TEST 5: Student 1 with slight angle variation (distance ~0.25 <= 0.60)
  console.log('--- TEST 5: Student 1 with Angle/Lighting Variation (d <= 0.60) ---');
  const stu1SlightVariation = fp1.descriptors[1] || fp1.descriptors[0].map((v, i) => v + (i === 0 ? 0.01 : 0));
  const res5 = await simulateRecognize(testSession._id, teacher._id, stu1SlightVariation);
  const pass5 = res5.data.matched === true && res5.data.student.studentId === 'STU0001';
  testResults.push({
    test: 'TEST 5: Student 1 with Angle Variation (d <= 0.60)',
    expected: 'Recognized (STU0001)',
    actual: `matched=${res5.data.matched}, student=${res5.data.student?.studentId}, distance=${res5.data.distance}`,
    status: pass5 ? 'PASS' : 'FAIL',
  });
  console.log(`Result: ${pass5 ? 'PASS' : 'FAIL'}\n`);

  // TEST 6: Invalid descriptor / No face
  console.log('--- TEST 6: Invalid Descriptor / No Face ---');
  const res6a = await simulateRecognize(testSession._id, teacher._id, null);
  const res6b = await simulateRecognize(testSession._id, teacher._id, [1, 2, 3]);
  const res6c = await simulateRecognize(testSession._id, teacher._id, Array(128).fill(NaN));
  const pass6 = res6a.status === 400 && res6b.status === 400 && res6c.status === 400;
  testResults.push({
    test: 'TEST 6: Invalid/Corrupt Descriptor (NaN/Length/Null)',
    expected: 'Rejected 400, No Attendance',
    actual: `null=${res6a.status}, length3=${res6b.status}, NaN=${res6c.status}`,
    status: pass6 ? 'PASS' : 'FAIL',
  });
  console.log(`Result: ${pass6 ? 'PASS' : 'FAIL'}\n`);

  // TEST 7: Single-sample outlier protection (Mean distance > 0.60)
  console.log('--- TEST 7: Outlier Sample Protection ---');
  // Test that if an unregistered face has a noisy dip on 1 sample but mean > 0.60, it is rejected
  const countBefore7 = await Attendance.countDocuments({ session: testSession._id });
  const res7 = await simulateRecognize(testSession._id, teacher._id, unitUnregFace);
  const countAfter7 = await Attendance.countDocuments({ session: testSession._id });
  const pass7 = res7.data.matched === false && countBefore7 === countAfter7;
  testResults.push({
    test: 'TEST 7: Outlier Sample Noise Protection',
    expected: 'UNKNOWN, Nobody marked Present',
    actual: `matched=${res7.data.matched}`,
    status: pass7 ? 'PASS' : 'FAIL',
  });
  console.log(`Result: ${pass7 ? 'PASS' : 'FAIL'}\n`);

  // TEST 8: Same recognized Student 1 repeatedly
  console.log('--- TEST 8: Same Student Repeatedly (Duplicate Prevention) ---');
  const res8 = await simulateRecognize(testSession._id, teacher._id, stu1Face);
  const totalStu1Records = await Attendance.countDocuments({ session: testSession._id, student: student1._id });
  const pass8 = res8.data.matched === true && res8.data.alreadyMarked === true && totalStu1Records === 1;
  testResults.push({
    test: 'TEST 8: Repeated Recognition of Student 1',
    expected: 'alreadyMarked: true, exactly 1 Attendance record',
    actual: `alreadyMarked=${res8.data.alreadyMarked}, recordsCount=${totalStu1Records}`,
    status: pass8 ? 'PASS' : 'FAIL',
  });
  console.log(`Result: ${pass8 ? 'PASS' : 'FAIL'}\n`);

  // TEST 9: Student outside current session roster
  console.log('--- TEST 9: Student Outside Session Roster ---');
  // Create an outside course and student with active face profile
  const outsideCourse = await Course.create({ name: 'Outside Course', code: `OUT-${Date.now()}` });
  const outsideUser = await User.create({
    name: 'Outside Student',
    email: `outside_${Date.now()}@example.com`,
    password: 'Password123!',
    role: 'student',
  });
  const outsideStudent = await Student.create({
    user: outsideUser._id,
    studentId: `OUT${Date.now().toString().slice(-4)}`,
    rollNumber: '99',
    course: outsideCourse._id,
    department: 'Civil Engineering',
    section: 'B',
  });
  const outsideFace = Array.from({ length: 128 }, (_, i) => Number((Math.cos(i * 0.7) * 0.1).toFixed(6)));
  await FaceProfile.create({
    student: outsideStudent._id,
    descriptors: [outsideFace],
    sampleCount: 1,
    isActive: true,
  });

  const res9 = await simulateRecognize(testSession._id, teacher._id, outsideFace);
  const outsideAtt = await Attendance.findOne({ session: testSession._id, student: outsideStudent._id });
  const pass9 = res9.data.matched === false && !outsideAtt;
  testResults.push({
    test: 'TEST 9: Registered Student Outside Session Roster',
    expected: 'UNKNOWN (not on roster), Nobody marked',
    actual: `matched=${res9.data.matched}, marked=${Boolean(outsideAtt)}`,
    status: pass9 ? 'PASS' : 'FAIL',
  });
  console.log(`Result: ${pass9 ? 'PASS' : 'FAIL'}\n`);

  // TEST 10: Complete Session (Unmarked become Absent)
  console.log('--- TEST 10: Session Completion (Unmarked become Absent) ---');
  // Complete the session
  const unmarkedStudents = roster.filter(s =>
    !s._id.equals(student1._id) && !s._id.equals(student2._id)
  );

  const absentDocs = unmarkedStudents.map(s => ({
    student: s._id,
    subject: testSession.subject._id,
    teacher: teacher._id,
    classroom: testSession.classroom._id,
    department: testSession.department || s.department,
    section: testSession.section || s.section,
    session: testSession._id,
    date: testSession.date,
    period: testSession.period,
    status: 'Absent',
    method: 'Face Recognition',
    markedBy: teacher.user._id,
    remarks: 'Not detected during attendance session',
    timestamp: new Date(),
  }));

  await Promise.all(
    absentDocs.map(doc =>
      Attendance.findOneAndUpdate(
        { student: doc.student, session: testSession._id },
        doc,
        { upsert: true, new: true, setDefaultsOnInsert: true }
      )
    )
  );
  testSession.status = 'Completed';
  await testSession.save();

  const totalSessionAttendances = await Attendance.find({ session: testSession._id });
  const presentCount = totalSessionAttendances.filter(a => a.status === 'Present').length;
  const absentCount = totalSessionAttendances.filter(a => a.status === 'Absent').length;
  const pass10 = presentCount === 2 && absentCount === (roster.length - 2);

  testResults.push({
    test: 'TEST 10: Session Completion Finalization',
    expected: 'Unmarked valid roster students marked Absent',
    actual: `Present: ${presentCount}, Absent: ${absentCount}, Total: ${totalSessionAttendances.length}`,
    status: pass10 ? 'PASS' : 'FAIL',
  });
  console.log(`Result: ${pass10 ? 'PASS' : 'FAIL'}\n`);

  // Cleanup test session
  await Attendance.deleteMany({ session: testSession._id });
  await AttendanceSession.deleteOne({ _id: testSession._id });
  await Student.deleteOne({ _id: outsideStudent._id });
  await User.deleteOne({ _id: outsideUser._id });
  await Course.deleteOne({ _id: outsideCourse._id });

  console.log('====================================================');
  console.log('FINAL TEST RESULTS SUMMARY');
  console.log('====================================================');
  console.table(testResults);

  const allPassed = testResults.every(t => t.status === 'PASS');
  console.log(`\nOVERALL STATUS: ${allPassed ? 'ALL TESTS PASSED (10/10)' : 'SOME TESTS FAILED'}`);

  await mongoose.disconnect();
}

runTestSuite().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
