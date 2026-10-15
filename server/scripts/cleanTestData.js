import mongoose from 'mongoose';
import { Attendance, AttendanceSession, Student, FaceProfile } from '../models/index.js';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
  const uri = process.env.MONGO_URI || '';
  if (!uri.includes('test') && process.env.NODE_ENV !== 'test') {
    console.error('REFUSED: cleanTestData.js is a test-only utility and cannot run against a development or production database.');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);
  const s1 = await Student.findOne({ studentId: 'STU0001' });
  const s2 = await Student.findOne({ studentId: 'STU0002' });

  // 1. Check attendances in session 6abd3110c3508da21d4d64e2
  const atts = await Attendance.find({ session: '6abd3110c3508da21d4d64e2' });
  console.log('Session attendances before:', atts.map(a => ({ student: a.student, status: a.status, confidence: a.confidence })));

  // Delete the false attendance for STU0002 created by the bug
  const delRes = await Attendance.deleteOne({ session: '6abd3110c3508da21d4d64e2', student: s2._id });
  console.log('Deleted false attendance for STU0002 in 6abd3110c3508da21d4d64e2:', delRes.deletedCount);

  // Update session detectedStudents
  await AttendanceSession.updateOne(
    { _id: '6abd3110c3508da21d4d64e2' },
    { $pull: { detectedStudents: s2._id } }
  );

  // 2. Give STU0002 a clean, distinct face profile so it is NOT a duplicate of STU0001
  // We construct realistic unit-normed embeddings for STU0002 with distance ~0.72 to STU0001
  const fp1 = await FaceProfile.findOne({ student: s1._id });
  const fp2 = await FaceProfile.findOne({ student: s2._id });

  if (fp1 && fp2) {
    // Generate orthogonal/distinct direction
    const base1 = fp1.descriptors[0];
    // Create base2 by shifting base1 in orthogonal dimensions
    const base2 = base1.map((v, idx) => {
      const shift = Math.sin(idx * 1.5) * 0.08;
      return idx % 2 === 0 ? v + shift : -v + shift;
    });
    // Normalize base2 to unit length
    const norm = Math.sqrt(base2.reduce((sum, v) => sum + v * v, 0));
    const unitBase2 = base2.map(v => v / norm);

    // Create 3 realistic samples with slight pose variation (< 0.25 intra-distance)
    const samples2 = [
      unitBase2.map((v, i) => Number((v + (i % 3 === 0 ? 0.01 : 0)).toFixed(6))),
      unitBase2.map((v, i) => Number((v - (i % 4 === 0 ? 0.015 : 0)).toFixed(6))),
      unitBase2.map((v, i) => Number((v + (i % 5 === 0 ? 0.012 : -0.005)).toFixed(6))),
    ];

    fp2.descriptors = samples2;
    fp2.sampleCount = samples2.length;
    fp2.lastUpdated = new Date();
    await fp2.save();
    console.log('Updated STU0002 with distinct clean face profile (3 samples).');
  }

  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
