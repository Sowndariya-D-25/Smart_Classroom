import asyncHandler from '../../utils/asyncHandler.js'
import { isLowAttendance, LOW_ATTENDANCE_THRESHOLD } from '../../utils/attendanceThreshold.js'
import { Subject, AttendanceSession, Attendance } from '../../models/index.js'
import { getRoster } from './attendance.controller.js'

const TREND_DAYS = 30 // most recent N distinct session dates shown on the trend chart — see docs/ANALYTICS.md

// GET /api/teacher/analytics/overview?subject=optionalSubjectId
//
// One aggregated endpoint rather than five separate ones — every number
// below is computed from the SAME scoped subject list, so the KPI
// cards, charts, and low-attendance table can never disagree with each
// other. Everything is derived from Attendance/AttendanceSession
// (Phase 2 models); nothing new is stored.
export const getTeacherAnalyticsOverview = asyncHandler(async (req, res) => {
  const teacherId = req.teacher._id

  // Ownership: only ever the teacher's own subjects. An optional
  // ?subject= filter narrows this list, but a subject id that doesn't
  // belong to this teacher is silently ignored rather than trusted —
  // it just won't match the `teachers: teacherId` filter below.
  const subjectFilter = { teachers: teacherId, isActive: true }
  if (req.query.subject) subjectFilter._id = req.query.subject
  const subjects = await Subject.find(subjectFilter).populate('course', 'name code').select('name code course')

  if (subjects.length === 0) {
    return res.json({
      success: true,
      data: {
        kpis: { overallPercentage: null, totalSessions: 0, totalStudents: 0, studentsBelowThreshold: 0, presentCount: 0, lateCount: 0, absentCount: 0 },
        subjectWise: [],
        trend: [],
        distribution: { present: 0, late: 0, absent: 0 },
        lowAttendance: [],
        threshold: LOW_ATTENDANCE_THRESHOLD,
        subjects: [],
      },
    })
  }

  const subjectIds = subjects.map((s) => s._id)

  const [totalSessionsBySubjectAgg, attendanceStatsAgg, trendAgg, rosterBySubject] = await Promise.all([
    AttendanceSession.aggregate([
      { $match: { teacher: teacherId, subject: { $in: subjectIds }, status: 'Completed' } },
      {
        $group: {
          _id: { subject: '$subject', section: '$section' },
          count: { $sum: 1 },
        },
      },
    ]),
    Attendance.aggregate([
      { $match: { teacher: teacherId, subject: { $in: subjectIds } } },
      {
        $group: {
          _id: { student: '$student', subject: '$subject' },
          present: { $sum: { $cond: [{ $eq: ['$status', 'Present'] }, 1, 0] } },
          late: { $sum: { $cond: [{ $eq: ['$status', 'Late'] }, 1, 0] } },
          absent: { $sum: { $cond: [{ $eq: ['$status', 'Absent'] }, 1, 0] } },
        },
      },
    ]),
    // Trend: attendance % per calendar day across the teacher's own sessions
    Attendance.aggregate([
      { $match: { teacher: teacherId, subject: { $in: subjectIds } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          present: { $sum: { $cond: [{ $eq: ['$status', 'Present'] }, 1, 0] } },
          late: { $sum: { $cond: [{ $eq: ['$status', 'Late'] }, 1, 0] } },
          absent: { $sum: { $cond: [{ $eq: ['$status', 'Absent'] }, 1, 0] } },
          total: { $sum: 1 },
        },
      },
      { $sort: { _id: -1 } },
      { $limit: TREND_DAYS },
    ]),
    Promise.all(subjects.map((s) => getRoster(s.course?._id))),
  ])

  const sessionsBySubjectAndSection = {}
  const sessionsBySubjectAny = {}
  totalSessionsBySubjectAgg.forEach((r) => {
    if (!r._id?.subject) return
    const sId = r._id.subject.toString()
    const sec = r._id.section ? r._id.section.trim().toUpperCase() : null
    if (sec) {
      sessionsBySubjectAndSection[`${sId}:${sec}`] = r.count
    }
    sessionsBySubjectAny[sId] = (sessionsBySubjectAny[sId] || 0) + r.count
  })

  const statsByKey = Object.fromEntries(
    attendanceStatsAgg.map((r) => [`${r._id.student}:${r._id.subject}`, r]),
  )

  // Build one row per (student, subject)
  const rows = []
  subjects.forEach((subject, idx) => {
    const roster = rosterBySubject[idx]
    roster.forEach((student) => {
      const studentSec = student.section ? student.section.trim().toUpperCase() : null
      let totalSessions = 0
      if (studentSec && sessionsBySubjectAndSection[`${subject._id}:${studentSec}`] !== undefined) {
        totalSessions = sessionsBySubjectAndSection[`${subject._id}:${studentSec}`]
      } else {
        totalSessions = sessionsBySubjectAny[subject._id.toString()] || 0
      }

      const stats = statsByKey[`${student._id}:${subject._id}`] || { present: 0, late: 0, absent: 0 }
      const attended = stats.present + stats.late
      const percentage = totalSessions > 0 ? Math.round((attended / totalSessions) * 100) : null
      rows.push({
        _id: `${student._id}:${subject._id}`,
        student: { _id: student._id, name: student.user?.name, studentId: student.studentId },
        subject: { _id: subject._id, name: subject.name, code: subject.code },
        present: stats.present,
        late: stats.late,
        absent: stats.absent,
        totalSessions,
        percentage,
        isLow: isLowAttendance(percentage),
      })
    })
  })

  // Distinct students across every roster (a student in two of this
  // teacher's subjects is only counted once for the KPI card).
  const distinctStudentIds = new Set(rows.map((r) => r.student._id.toString()))

  const presentCount = attendanceStatsAgg.reduce((sum, r) => sum + r.present, 0)
  const lateCount = attendanceStatsAgg.reduce((sum, r) => sum + r.late, 0)
  const absentCount = attendanceStatsAgg.reduce((sum, r) => sum + r.absent, 0)
  const totalMarked = presentCount + lateCount + absentCount
  const overallPercentage = totalMarked > 0 ? Math.round(((presentCount + lateCount) / totalMarked) * 100) : null

  const subjectWise = subjects.map((subject) => {
    const subjectRows = rows.filter((r) => r.subject._id.equals(subject._id))
    const withData = subjectRows.filter((r) => r.percentage !== null)
    const percentage = withData.length > 0 ? Math.round(withData.reduce((sum, r) => sum + r.percentage, 0) / withData.length) : null
    return { subject: { _id: subject._id, name: subject.name, code: subject.code }, percentage }
  })

  const trend = trendAgg
    .map((day) => ({
      date: day._id,
      present: day.present,
      late: day.late,
      absent: day.absent,
      percentage: day.total > 0 ? Math.round(((day.present + day.late) / day.total) * 100) : null,
    }))
    .sort((a, b) => a.date.localeCompare(b.date)) // chronological for the chart, even though the query fetched newest-first

  const lowAttendance = rows
    .filter((r) => r.isLow)
    .sort((a, b) => (a.percentage ?? 0) - (b.percentage ?? 0))

  res.json({
    success: true,
    data: {
      kpis: {
        overallPercentage,
        totalSessions: Object.values(sessionsBySubjectAny).reduce((a, b) => a + b, 0),
        totalStudents: distinctStudentIds.size,
        studentsBelowThreshold: new Set(lowAttendance.map((r) => r.student._id.toString())).size,
        presentCount,
        lateCount,
        absentCount,
      },
      subjectWise,
      trend,
      distribution: { present: presentCount, late: lateCount, absent: absentCount },
      lowAttendance,
      threshold: LOW_ATTENDANCE_THRESHOLD,
      subjects: subjects.map((s) => ({ _id: s._id, name: s.name, code: s.code })),
    },
  })
})
