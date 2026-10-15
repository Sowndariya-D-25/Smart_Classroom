import asyncHandler from '../../utils/asyncHandler.js'
import { isLowAttendance, LOW_ATTENDANCE_THRESHOLD } from '../../utils/attendanceThreshold.js'
import { Subject, AttendanceSession, Attendance } from '../../models/index.js'

const TREND_DAYS = 30

// GET /api/student/analytics/overview
//
// req.student is resolved by loadStudentProfile from the JWT — nothing
// here ever reads a studentId from the client. A request like
// `?studentId=someone-else` has no effect: that parameter is never read.
export const getStudentAnalyticsOverview = asyncHandler(async (req, res) => {
  const studentId = req.student._id
  const subjects = await Subject.find({ course: req.student.course, isActive: true }).select('name code')

  if (subjects.length === 0) {
    return res.json({
      success: true,
      data: {
        kpis: { overallPercentage: null, totalSessions: 0, presentCount: 0, lateCount: 0, absentCount: 0, subjectsBelowThreshold: 0 },
        subjectWise: [],
        trend: [],
        distribution: { present: 0, late: 0, absent: 0 },
        threshold: LOW_ATTENDANCE_THRESHOLD,
      },
    })
  }

  const subjectIds = subjects.map((s) => s._id)

  const [totalSessionsBySubjectAgg, attendanceStatsAgg, trendAgg] = await Promise.all([
    AttendanceSession.aggregate([
      { $match: { subject: { $in: subjectIds }, status: 'Completed' } },
      { $group: { _id: '$subject', count: { $sum: 1 } } },
    ]),
    Attendance.aggregate([
      { $match: { student: studentId, subject: { $in: subjectIds } } },
      {
        $group: {
          _id: '$subject',
          present: { $sum: { $cond: [{ $eq: ['$status', 'Present'] }, 1, 0] } },
          late: { $sum: { $cond: [{ $eq: ['$status', 'Late'] }, 1, 0] } },
          absent: { $sum: { $cond: [{ $eq: ['$status', 'Absent'] }, 1, 0] } },
        },
      },
    ]),
    // Same day-level trend approach as the teacher's analytics endpoint
    // — see docs/ANALYTICS.md.
    Attendance.aggregate([
      { $match: { student: studentId, subject: { $in: subjectIds } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          present: { $sum: { $cond: [{ $eq: ['$status', 'Present'] }, 1, 0] } },
          late: { $sum: { $cond: [{ $eq: ['$status', 'Late'] }, 1, 0] } },
          absent: { $sum: { $cond: [{ $eq: ['$status', 'Absent'] }, 1, 0] } },
        },
      },
      { $sort: { _id: -1 } },
      { $limit: TREND_DAYS },
    ]),
  ])

  const totalSessionsBySubject = Object.fromEntries(totalSessionsBySubjectAgg.map((r) => [r._id.toString(), r.count]))
  const statsBySubject = Object.fromEntries(attendanceStatsAgg.map((r) => [r._id.toString(), r]))

  const subjectWise = subjects.map((subject) => {
    const stats = statsBySubject[subject._id.toString()] || { present: 0, late: 0, absent: 0 }
    const totalSessions = totalSessionsBySubject[subject._id.toString()] || 0
    const attended = stats.present + stats.late
    const percentage = totalSessions > 0 ? Math.round((attended / totalSessions) * 100) : null
    return {
      _id: subject._id,
      subject: { _id: subject._id, name: subject.name, code: subject.code },
      present: stats.present,
      late: stats.late,
      absent: stats.absent,
      totalSessions,
      percentage,
      isLow: isLowAttendance(percentage),
    }
  })

  const presentCount = attendanceStatsAgg.reduce((sum, r) => sum + r.present, 0)
  const lateCount = attendanceStatsAgg.reduce((sum, r) => sum + r.late, 0)
  const absentCount = attendanceStatsAgg.reduce((sum, r) => sum + r.absent, 0)
  const totalApplicableSessions = Object.values(totalSessionsBySubject).reduce((a, b) => a + b, 0)
  const totalAttended = presentCount + lateCount
  const overallPercentage = totalApplicableSessions > 0 ? Math.round((totalAttended / totalApplicableSessions) * 100) : null

  const trend = trendAgg
    .map((day) => ({
      date: day._id,
      present: day.present,
      late: day.late,
      absent: day.absent,
      percentage: day.present + day.late + day.absent > 0 ? Math.round(((day.present + day.late) / (day.present + day.late + day.absent)) * 100) : null,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))

  res.json({
    success: true,
    data: {
      kpis: {
        overallPercentage,
        totalSessions: totalApplicableSessions,
        presentCount,
        lateCount,
        absentCount,
        subjectsBelowThreshold: subjectWise.filter((s) => s.isLow).length,
      },
      subjectWise,
      trend,
      distribution: { present: presentCount, late: lateCount, absent: absentCount },
      threshold: LOW_ATTENDANCE_THRESHOLD,
    },
  })
})
