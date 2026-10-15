import mongoose from 'mongoose'

async function check() {
  await mongoose.connect('mongodb://127.0.0.1:27017/smart-classroom')
  const sessions = await mongoose.connection.db.collection('attendancesessions').find().toArray()
  console.log('Sample session:', JSON.stringify(sessions[0], null, 2))

  const dups = await mongoose.connection.db.collection('attendancesessions').aggregate([
    {
      $group: {
        _id: { teacher: '$teacher', subject: '$subject', date: '$date', period: '$period', section: '$section' },
        count: { $sum: 1 },
        ids: { $push: '$_id' }
      }
    },
    { $match: { count: { $gt: 1 } } }
  ]).toArray()
  console.log('Duplicates by (teacher, subject, date, period, section):', JSON.stringify(dups, null, 2))

  const dupsByTeacherSlot = await mongoose.connection.db.collection('attendancesessions').aggregate([
    {
      $group: {
        _id: { teacher: '$teacher', date: '$date', period: '$period' },
        count: { $sum: 1 },
        ids: { $push: '$_id' }
      }
    },
    { $match: { count: { $gt: 1 } } }
  ]).toArray()
  console.log('Duplicates by (teacher, date, period):', JSON.stringify(dupsByTeacherSlot, null, 2))

  const dupsBySubjectSlot = await mongoose.connection.db.collection('attendancesessions').aggregate([
    {
      $group: {
        _id: { subject: '$subject', date: '$date', period: '$period', section: '$section' },
        count: { $sum: 1 },
        ids: { $push: '$_id' }
      }
    },
    { $match: { count: { $gt: 1 } } }
  ]).toArray()
  console.log('Duplicates by (subject, date, period, section):', JSON.stringify(dupsBySubjectSlot, null, 2))

  // Also check students with missing department or section (BUG-004)
  const studentsMissingFields = await mongoose.connection.db.collection('students').find({
    $or: [
      { department: { $exists: false } },
      { department: null },
      { department: '' },
      { section: { $exists: false } },
      { section: null },
      { section: '' }
    ]
  }).toArray()
  console.log('Students missing department or section count:', studentsMissingFields.length)
  if (studentsMissingFields.length > 0) {
    console.log('Incomplete student records:', studentsMissingFields.map(s => ({
      _id: s._id,
      studentId: s.studentId,
      department: s.department,
      section: s.section,
      classroom: s.classroom,
      course: s.course
    })))
  }

  await mongoose.disconnect()
}

check().catch(console.error)
