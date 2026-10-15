import asyncHandler from '../../utils/asyncHandler.js'
import currentDayOfWeek from '../../utils/dayOfWeek.js'
import { Subject, Timetable, AttendanceSession, Attendance, Student } from '../../models/index.js'

// GET /api/teacher/dashboard/stats
// Scoped strictly to authenticated req.teacher._id
export const getDashboardStats = asyncHandler(async (req, res) => {
  const teacherId = req.teacher._id
  const today = currentDayOfWeek()

  const startOfToday = new Date()
  startOfToday.setUTCHours(0, 0, 0, 0)
  const endOfToday = new Date()
  endOfToday.setUTCHours(23, 59, 59, 999)

  const [
    subjects,
    todayClassesCount,
    sessionsConducted,
    activeSessions,
    todaySessionsCount,
    attendanceCounts,
    todayAttendanceAgg,
  ] = await Promise.all([
    Subject.find({ teachers: teacherId, isActive: true }).select('course department name code'),
    Timetable.countDocuments({ teacher: teacherId, dayOfWeek: today, isActive: true }),
    AttendanceSession.countDocuments({ teacher: teacherId, status: 'Completed' }),
    AttendanceSession.countDocuments({ teacher: teacherId, status: 'Active' }),
    AttendanceSession.countDocuments({
      teacher: teacherId,
      date: { $gte: startOfToday, $lte: endOfToday },
    }),
    Attendance.aggregate([
      { $match: { teacher: teacherId } },
      {
        $group: {
          _id: null,
          attended: { $sum: { $cond: [{ $in: ['$status', ['Present', 'Late']] }, 1, 0] } },
          total: { $sum: 1 },
        },
      },
    ]),
    Attendance.aggregate([
      {
        $match: {
          teacher: teacherId,
          date: { $gte: startOfToday, $lte: endOfToday },
        },
      },
      {
        $group: {
          _id: null,
          presentCount: { $sum: { $cond: [{ $eq: ['$status', 'Present'] }, 1, 0] } },
          totalMarked: { $sum: 1 },
        },
      },
    ]),
  ])

  const courseIds = subjects.map((s) => s.course).filter(Boolean)
  const distinctCourses = new Set(courseIds.map((c) => c.toString()))

  // Total unique students enrolled in the teacher's assigned subjects/courses
  const totalStudents = await Student.countDocuments({ course: { $in: courseIds }, isActive: true })

  const counts = attendanceCounts[0]
  const averageAttendance = counts?.total ? Math.round((counts.attended / counts.total) * 100) : null
  const presentToday = todayAttendanceAgg[0]?.presentCount || 0

  // 7-day weekly attendance trend data from real attendance records
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
  sevenDaysAgo.setUTCHours(0, 0, 0, 0)

  const weeklyAttendanceAgg = await Attendance.aggregate([
    {
      $match: {
        teacher: teacherId,
        date: { $gte: sevenDaysAgo, $lte: endOfToday },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
        attended: { $sum: { $cond: [{ $in: ['$status', ['Present', 'Late']] }, 1, 0] } },
        total: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ])

  const weeklyMap = new Map(weeklyAttendanceAgg.map((w) => [w._id, w]))
  const daysShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const weeklyChart = []

  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    const dayName = daysShort[d.getDay()]
    const entry = weeklyMap.get(key)
    const pct = entry?.total ? Math.round((entry.attended / entry.total) * 100) : 0
    weeklyChart.push({
      day: dayName,
      date: key,
      present: pct,
      capacity: 100,
      total: entry?.total || 0,
    })
  }

  // 4-week monthly attendance trend data
  const fourWeeksAgo = new Date()
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 27)
  fourWeeksAgo.setUTCHours(0, 0, 0, 0)

  const monthlyAttendanceAgg = await Attendance.aggregate([
    {
      $match: {
        teacher: teacherId,
        date: { $gte: fourWeeksAgo, $lte: endOfToday },
      },
    },
    {
      $group: {
        _id: {
          $concat: [
            'W',
            {
              $toString: {
                $ceil: {
                  $divide: [
                    { $subtract: [{ $toLong: '$date' }, { $toLong: fourWeeksAgo }] },
                    7 * 24 * 60 * 60 * 1000,
                  ],
                },
              },
            },
          ],
        },
        attended: { $sum: { $cond: [{ $in: ['$status', ['Present', 'Late']] }, 1, 0] } },
        total: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ])

  const monthlyMap = new Map(monthlyAttendanceAgg.map((m) => [m._id, m]))
  const monthlyChart = ['W1', 'W2', 'W3', 'W4'].map((wk) => {
    const entry = monthlyMap.get(wk)
    const pct = entry?.total ? Math.round((entry.attended / entry.total) * 100) : 0
    return {
      day: wk,
      present: pct,
      capacity: 100,
      total: entry?.total || 0,
    }
  })

  // Recent 4 attendance sessions for this teacher
  const recentSessionsDocs = await AttendanceSession.find({ teacher: teacherId })
    .populate('subject', 'name code')
    .populate('classroom', 'name code building')
    .sort({ date: -1, createdAt: -1 })
    .limit(4)

  const recentSessionIds = recentSessionsDocs.map((s) => s._id)
  const recentAttendanceCounts = await Attendance.aggregate([
    { $match: { session: { $in: recentSessionIds } } },
    {
      $group: {
        _id: '$session',
        present: { $sum: { $cond: [{ $eq: ['$status', 'Present'] }, 1, 0] } },
        total: { $sum: 1 },
      },
    },
  ])
  const recentCountsMap = new Map(recentAttendanceCounts.map((r) => [r._id.toString(), r]))

  const recentSessions = recentSessionsDocs.map((s) => {
    const countsInfo = recentCountsMap.get(s._id.toString()) || { present: 0, total: 0 }
    return {
      _id: s._id,
      subjectName: s.subject?.name,
      subjectCode: s.subject?.code,
      classroom: s.classroom?.name,
      date: s.date,
      period: s.period,
      section: s.section,
      department: s.department,
      status: s.status,
      presentCount: countsInfo.present,
      totalMarked: countsInfo.total,
    }
  })

  // Students with low attendance (< 75%) in this teacher's classes
  const studentAttendanceAgg = await Attendance.aggregate([
    { $match: { teacher: teacherId } },
    {
      $group: {
        _id: '$student',
        attended: { $sum: { $cond: [{ $in: ['$status', ['Present', 'Late']] }, 1, 0] } },
        total: { $sum: 1 },
      },
    },
  ])

  const lowStudentEntries = studentAttendanceAgg.filter(
    (a) => a.total > 0 && Math.round((a.attended / a.total) * 100) < 75,
  )
  const lowStudentIds = lowStudentEntries.map((a) => a._id)

  const lowStudentsDocs = await Student.find({ _id: { $in: lowStudentIds } })
    .populate('user', 'name email')
    .populate('course', 'name code')
    .select('studentId rollNumber department section course user')
    .limit(4)

  const attentionStudents = lowStudentsDocs.map((s) => {
    const att = studentAttendanceAgg.find((a) => a._id.equals(s._id))
    const pct = att ? Math.round((att.attended / att.total) * 100) : 0
    return {
      id: s._id,
      name: s.user?.name || s.studentId,
      studentId: s.studentId,
      course: s.course?.name || s.department || 'Computer Science',
      section: s.section,
      attendance: pct,
      initial: (s.user?.name || '?').charAt(0).toUpperCase(),
    }
  })

  res.json({
    success: true,
    data: {
      subjectsCount: subjects.length,
      classesCount: distinctCourses.size,
      totalStudents,
      todayClassesCount,
      todaySessionsCount,
      presentToday,
      attendanceSessionsCount: sessionsConducted,
      activeSessionsCount: activeSessions,
      averageAttendance, // null = no attendance records yet; frontend shows "N/A"
      today,
      weeklyChart,
      monthlyChart,
      recentSessions,
      attentionStudents,
    },
  })
})
