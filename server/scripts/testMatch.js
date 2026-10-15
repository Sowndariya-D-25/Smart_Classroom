import mongoose from 'mongoose';
import { Student, FaceProfile } from '../models/index.js';
import dotenv from 'dotenv';
import { euclideanDistance, bestDistanceToProfile } from '../utils/faceDistance.js';
dotenv.config();

await mongoose.connect(process.env.MONGO_URI);
const s2 = await Student.findOne({ studentId: 'STU0002' });
const fp2 = await FaceProfile.findOne({ student: s2._id });

const otherProfiles = await FaceProfile.find({ isActive: true, student: { $ne: s2._id } }).populate('student', 'studentId');

console.log('Comparing all other student descriptors to STU0002 profile:');
for (const op of otherProfiles) {
  for (let i = 0; i < op.descriptors.length; i++) {
    const desc = op.descriptors[i];
    const bestDist = bestDistanceToProfile(desc, fp2);
    if (bestDist < 0.6) {
      console.log(`${op.student?.studentId} sample ${i} best dist to STU0002: ${bestDist.toFixed(4)} *** FALSE MATCH (< 0.6) ***`);
    } else {
      console.log(`${op.student?.studentId} sample ${i} best dist to STU0002: ${bestDist.toFixed(4)} (no match)`);
    }
  }
}
await mongoose.disconnect();
