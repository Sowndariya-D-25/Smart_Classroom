import asyncHandler from '../../utils/asyncHandler.js'
import { Subject, Timetable, Attendance, AttendanceSession } from '../../models/index.js'
import {
  isLowAttendance,
  calculateAttendancePercentage,
  getEligibleSessionQuery,
  LOW_ATTENDANCE_THRESHOLD,
  calculateConsecutiveClassesNeeded,
  ATTENDED_STATUSES,
  isAttendedStatus,
} from '../../utils/attendanceThreshold.js'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// GET /api/student/dashboard/summary
// Real-time summary statistics for the authenticated student dashboard
export const getStudentDashboardStats = asyncHandler(async (req, res) => {
  const student = req.student

  // 1. Fetch student's course subjects
  const subjects = await Subject.find({ course: student.course, isActive: true }).select('name code')

  // 2. Fetch all attendance marks for this student
  const allStudentMarks = await Attendance.find({ student: student._id })
    .populate('subject', 'name code')
    .sort({ date: -1, createdAt: -1 })
    .lean()

  let attendedCount = 0
  let missedCount = 0

  allStudentMarks.forEach((r) => {
    if (isAttendedStatus(r.status)) attendedCount++
    else if (r.status === 'Absent') missedCount++
  })

  const totalMarks = attendedCount + missedCount
  const overallPercentage = totalMarks > 0 ? Math.round((attendedCount / totalMarks) * 100) : null

  // 3. Subject-wise calculation to find low attendance subjects (<75%) & recovery planner
  let lowAttendanceSubjectsCount = 0
  const subjectIds = subjects.map((s) => s._id)
  const attendedAgg = await Attendance.aggregate([
    {
      $match: {
        student: student._id,
        subject: { $in: subjectIds },
        status: { $in: ATTENDED_STATUSES },
      },
    },
    {
      $group: {
        _id: '$subject',
        count: { $sum: 1 },
      },
    },
  ])

  const attendedMap = new Map()
  for (const item of attendedAgg) {
    attendedMap.set(item._id.toString(), item.count)
  }

  const recoveryPlanner = await Promise.all(
    subjects.map(async (subj) => {
      const sessionQuery = getEligibleSessionQuery(subj._id, student)
      const totalConducted = await AttendanceSession.countDocuments(sessionQuery)
      const attended = attendedMap.get(subj._id.toString()) || 0
      const percentage = calculateAttendancePercentage(attended, totalConducted)
      const isLow = percentage !== null && isLowAttendance(percentage)

      if (isLow) {
        lowAttendanceSubjectsCount++
      }

      const classesNeeded = calculateConsecutiveClassesNeeded(
        attended,
        totalConducted,
        LOW_ATTENDANCE_THRESHOLD,
      )

      let status = 'on_target'
      let message = `You currently meet the ${LOW_ATTENDANCE_THRESHOLD}% target`

      if (totalConducted === 0 || percentage === null) {
        status = 'no_classes'
        message = 'Attendance not available yet'
      } else if (isLow) {
        status = 'at_risk'
        message = `Attend the next ${classesNeeded} consecutive class${classesNeeded === 1 ? '' : 'es'} to reach ${LOW_ATTENDANCE_THRESHOLD}%`
      }

      return {
        subject: {
          _id: subj._id,
          name: subj.name,
          code: subj.code,
        },
        classesAttended: attended,
        totalSessions: totalConducted,
        currentPercentage: percentage,
        requiredPercentage: LOW_ATTENDANCE_THRESHOLD,
        classesToAttendConsecutively: classesNeeded,
        isLow,
        status,
        message,
      }
    }),
  )

  // 4. Today's classes from Timetable
  const now = new Date()
  const todayName = DAYS[now.getDay()]
  const timetableQuery = {
    course: student.course,
    dayOfWeek: todayName,
    isActive: true,
  }

  if (student.section) {
    timetableQuery.$or = [
      { section: student.section },
      { section: { $exists: false } },
      { section: null },
      { section: '' },
    ]
  }

  const todayEntries = await Timetable.find(timetableQuery)
    .populate('subject', 'name code')
    .populate('classroom', 'name code')
    .sort({ startTime: 1 })
    .lean()

  const todayClasses = todayEntries.map((e) => ({
    _id: e._id,
    subject: e.subject?.name || 'Class',
    code: e.subject?.code || '',
    classroom: e.classroom?.name || '—',
    time: `${e.startTime} – ${e.endTime}`,
    period: e.period,
  }))

  // 5. Recent Attendance (Last 5 records)
  const recentAttendance = allStudentMarks.slice(0, 5).map((r) => ({
    _id: r._id,
    subject: r.subject?.name || 'Subject',
    code: r.subject?.code || '',
    date: r.date ? new Date(r.date).toLocaleDateString() : '—',
    period: r.period,
    status: r.status,
    method: r.method,
    confidence: r.confidence ? Math.round(r.confidence * 100) : null,
  }))

  res.json({
    success: true,
    data: {
      stats: {
        overallPercentage,
        classesAttended: attendedCount,
        classesMissed: missedCount,
        totalSubjects: subjects.length,
        lowAttendanceSubjectsCount,
        threshold: LOW_ATTENDANCE_THRESHOLD,
        recoveryPlanner,
      },
      today: {
        day: todayName,
        classes: todayClasses,
        totalClassesToday: todayClasses.length,
      },
      recentAttendance,
      recoveryPlanner,
    },
  })
})
