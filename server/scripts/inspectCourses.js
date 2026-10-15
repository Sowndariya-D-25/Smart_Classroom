import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import { Course, Subject, Student, Timetable, Teacher } from '../models/index.js';

async function main() {
  await mongoose.connect(process.env.MONGO_URI);

  console.log('--- ALL COURSES IN MONGODB ---');
  const courses = await Course.find();
  console.log('Total courses count:', courses.length);
  for (const c of courses) {
    const studentCount = await Student.countDocuments({ course: c._id });
    const subjectCount = await Subject.countDocuments({ course: c._id });
    const timetableCount = await Timetable.countDocuments({ course: c._id });
    console.log({
      _id: c._id.toString(),
      name: c.name,
      code: c.code,
      department: c.department,
      isActive: c.isActive,
      studentsReferencing: studentCount,
      subjectsReferencing: subjectCount,
      timetablesReferencing: timetableCount,
    });
  }

  console.log('\n--- TEACHER SUBJECTS & COURSES ---');
  const teachers = await Teacher.find().populate('user', 'name email');
  for (const t of teachers) {
    const subjs = await Subject.find({ teachers: t._id, isActive: true }).populate('course');
    console.log(`Teacher: ${t.employeeId} (${t.user?.name}) - ${subjs.length} subjects:`);
    for (const s of subjs) {
      console.log(`  - Subject: ${s.name} (${s.code}) -> Course: ${s.course?.name} (${s.course?.code}) [ID: ${s.course?._id}]`);
    }
  }

  await mongoose.disconnect();
}

main().catch(console.error);
