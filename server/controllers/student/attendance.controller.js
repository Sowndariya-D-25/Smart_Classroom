import asyncHandler from '../../utils/asyncHandler.js'
import parsePagination, { buildPaginationMeta } from '../../utils/pagination.js'
import {
  isLowAttendance,
  calculateAttendancePercentage,
  getEligibleSessionQuery,
  LOW_ATTENDANCE_THRESHOLD,
  calculateConsecutiveClassesNeeded,
  ATTENDED_STATUSES,
} from '../../utils/attendanceThreshold.js'
import { Subject, AttendanceSession, Attendance } from '../../models/index.js'

// GET /api/student/attendance
// Subject-wise summary for the AUTHENTICATED student only — req.student
// comes from loadStudentProfile (resolved from the JWT), never from a
// studentId in the query string. A request like
// `?studentId=someoneElse` has no effect: it's never read.
export const getMySummary = asyncHandler(async (req, res) => {
  const subjects = await Subject.find({ course: req.student.course, isActive: true }).select('name code credits')

  const subjectIds = subjects.map((s) => s._id)

  // Batch query: aggregate all attended counts for all subjects in 1 query
  const attendedAgg = await Attendance.aggregate([
    {
      $match: {
        student: req.student._id,
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

  const rows = await Promise.all(
    subjects.map(async (subject) => {
      // Eligible sessions scoped to this student's section and department
      const sessionQuery = getEligibleSessionQuery(subject._id, req.student)
      const totalSessions = await AttendanceSession.countDocuments(sessionQuery)
      const attended = attendedMap.get(subject._id.toString()) || 0
      const percentage = calculateAttendancePercentage(attended, totalSessions)
      return {
        subject: { _id: subject._id, name: subject.name, code: subject.code },
        totalSessions,
        attended,
        percentage,
        isLow: isLowAttendance(percentage),
        consecutiveClassesNeeded: calculateConsecutiveClassesNeeded(attended, totalSessions, LOW_ATTENDANCE_THRESHOLD),
      }
    }),
  )

  res.json({ success: true, data: { threshold: LOW_ATTENDANCE_THRESHOLD, subjects: rows } })
})

// GET /api/student/attendance/history
// Session-level log for the authenticated student, paginated/filterable
// — same ownership rule as above, req.student only.
export const getMyHistory = asyncHandler(async (req, res) => {
  const pagination = parsePagination(req.query)
  const filter = { student: req.student._id }
  if (req.query.subject) filter.subject = req.query.subject
  if (req.query.status) filter.status = req.query.status
  if (req.query.from || req.query.to) {
    filter.date = {}
    if (req.query.from) filter.date.$gte = new Date(req.query.from)
    if (req.query.to) filter.date.$lte = new Date(req.query.to)
  }

  const [records, total] = await Promise.all([
    Attendance.find(filter)
      .populate('subject', 'name code department')
      .populate({ path: 'teacher', select: 'employeeId user', populate: { path: 'user', select: 'name' } })
      .populate('classroom', 'name code')
      .select('subject teacher classroom date period status method confidence timestamp')
      .sort({ date: -1, createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit),
    Attendance.countDocuments(filter),
  ])

  res.json({ success: true, data: { items: records, pagination: buildPaginationMeta(pagination, total) } })
})
