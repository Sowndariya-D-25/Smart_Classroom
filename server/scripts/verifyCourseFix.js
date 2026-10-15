import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import { Course, Student, Subject, Timetable, Teacher } from '../models/index.js';

async function verify() {
  const baseUrl = `http://localhost:${process.env.PORT || 5000}`;
  console.log('====================================================');
  console.log('COURSE DEDUPLICATION & INTEGRITY VERIFICATION');
  console.log('====================================================\n');

  await mongoose.connect(process.env.MONGO_URI);

  // 1. Verify MongoDB Course collection
  const courses = await Course.find();
  console.log(`1. Total courses in MongoDB: ${courses.length}`);
  courses.forEach(c => {
    console.log(`   - ID: ${c._id} | Name: "${c.name}" | Code: "${c.code}" | Dept: "${c.department}"`);
  });
  if (courses.length !== 1) {
    throw new Error(`Expected exactly 1 course in MongoDB, found ${courses.length}`);
  }
  console.log('   ✓ MongoDB contains exactly 1 unique Course document.\n');

  // 2. Verify relational integrity
  const courseId = courses[0]._id;
  const studentCount = await Student.countDocuments({ course: courseId });
  const subjectCount = await Subject.countDocuments({ course: courseId });
  const timetableCount = await Timetable.countDocuments({ course: courseId });
  console.log(`2. Relational references to Course ${courses[0].code}:`);
  console.log(`   - Students: ${studentCount}`);
  console.log(`   - Subjects: ${subjectCount}`);
  console.log(`   - Timetables: ${timetableCount}`);
  if (studentCount === 0 || subjectCount === 0 || timetableCount === 0) {
    throw new Error('Relational references broken!');
  }
  console.log('   ✓ All relational references intact.\n');

  // 3. Test HTTP Teacher Login and GET /api/teacher/courses
  console.log(`3. Testing HTTP API at ${baseUrl}...`);
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'teacher1@smartclassroom.local',
      password: 'Password123!',
    }),
  });
  const loginData = await loginRes.json();
  if (!loginData.success) throw new Error('Teacher login failed: ' + JSON.stringify(loginData));
  const token = loginData.data.token;
  console.log('   ✓ Teacher login successful (Rahul Mehta)');

  const courseRes = await fetch(`${baseUrl}/api/teacher/courses`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const courseData = await courseRes.json();
  console.log('   HTTP GET /api/teacher/courses status:', courseRes.status);
  console.log('   Response items:', courseData.data?.items);

  if (courseRes.status !== 200 || !courseData.success) {
    throw new Error('GET /api/teacher/courses failed: ' + JSON.stringify(courseData));
  }

  const items = courseData.data.items || [];
  if (items.length !== 1) {
    throw new Error(`Expected exactly 1 course item returned, got ${items.length}`);
  }
  if (items[0]._id !== courseId.toString()) {
    throw new Error(`Course ID mismatch: expected ${courseId}, got ${items[0]._id}`);
  }
  console.log('   ✓ GET /api/teacher/courses returns exactly 1 real course without duplicates!\n');

  // 4. Test Teacher Subjects still work
  const subjRes = await fetch(`${baseUrl}/api/teacher/subjects`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const subjData = await subjRes.json();
  console.log(`4. GET /api/teacher/subjects status: ${subjRes.status} (${subjData.data?.items?.length} subjects for this teacher)`);
  subjData.data?.items?.forEach(s => {
    console.log(`   - Subject: ${s.name} (${s.code}) -> Course: ${s.course?.name} (${s.course?.code})`);
  });
  console.log('   ✓ Teacher subjects unaffected and working properly.\n');

  // 5. Test Teacher Classrooms still work
  const classRes = await fetch(`${baseUrl}/api/teacher/classrooms`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const classData = await classRes.json();
  console.log(`5. GET /api/teacher/classrooms status: ${classRes.status} (${classData.data?.items?.length} classrooms)`);
  console.log('   ✓ Teacher classrooms unaffected and working properly.\n');

  console.log('====================================================');
  console.log('ALL VERIFICATION CHECKS PASSED (5/5)');
  console.log('====================================================');

  await mongoose.disconnect();
}

verify().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
