import mongoose from 'mongoose'
import asyncHandler from '../../utils/asyncHandler.js'
import parsePagination, { buildPaginationMeta } from '../../utils/pagination.js'
import { isLowAttendance, LOW_ATTENDANCE_THRESHOLD, OD_ATTENDANCE_POLICY } from '../../utils/attendanceThreshold.js'
import { AttendanceSession, Attendance, Subject, Classroom, Student, Notification, Timetable, ODLeaveRequest } from '../../models/index.js'
import { canonicalDepartment, getDepartmentRegex } from '../../utils/academicFilter.js'
import { toExactRegex } from '../../utils/searchHelpers.js'

const SESSION_POPULATE = [
  { path: 'subject', select: 'name code course department', populate: { path: 'course', select: 'name code department' } },
  { path: 'classroom', select: 'name code building' },
]

/**
 * Loads an AttendanceSession and verifies it belongs to req.teacher.
 * This is the ownership check that stops Teacher A from reading or
 * marking Teacher B's session just by guessing/changing an :id in the
 * URL — a mismatch looks exactly like "not found" to the caller, so it
 * doesn't leak whether the session exists at all.
 */
export async function loadOwnedSession(id, teacherId) {
  const session = await AttendanceSession.findById(id).populate(SESSION_POPULATE)
  if (!session || !session.teacher.equals(teacherId)) return null
  return session
}

export async function getRoster(courseId, { department, section } = {}) {
  const filter = { course: courseId, isActive: true }
  if (department) {
    const deptRegex = getDepartmentRegex(department)
    if (deptRegex) {
      filter.department = deptRegex
    }
  }
  if (section) {
    filter.section = toExactRegex(section)
  }
  return Student.find(filter)
    .populate('user', 'name email phone')
    .select('studentId rollNumber department section course user')
    .sort({ rollNumber: 1 })
}

// POST /api/teacher/attendance/sessions
// Body: { subject, classroom, date, period, startTime, endTime, department, section }
export const createSession = asyncHandler(async (req, res) => {
  const { subject, classroom, date, period, startTime, endTime, department, section } = req.body
  const teacherId = req.teacher._id

  // Validate start and end times if both provided
  if (startTime && endTime && endTime <= startTime) {
    res.status(400)
    throw new Error('endTime must be later than startTime')
  }

  // Validate session date
  const parsedDate = new Date(date)
  if (isNaN(parsedDate.getTime())) {
    res.status(400)
    throw new Error('Invalid date provided for attendance session')
  }
  const sessionYear = parsedDate.getFullYear()
  const currentYear = new Date().getFullYear()
  if (sessionYear < 2020 || sessionYear > currentYear + 1) {
    res.status(400)
    throw new Error('Session date is outside a realistic academic schedule range')
  }

  // Ownership check: the subject must actually be assigned to THIS
  // teacher — `subject` in the request body is never trusted beyond
  // "does it belong to req.teacher".
  const subjectDoc = await Subject.findOne({ _id: subject, teachers: teacherId, isActive: true })
  if (!subjectDoc) {
    res.status(403)
    throw new Error('You are not assigned to this subject')
  }

  let classroomDoc = null
  if (classroom) {
    classroomDoc = await Classroom.findById(classroom)
    if (!classroomDoc) {
      res.status(400)
      throw new Error('Selected classroom does not exist')
    }

    // Classroom conflict check: classroom cannot be double booked for same date and period
    const classroomConflict = await AttendanceSession.findOne({
      classroom,
      date: parsedDate,
      period,
      status: { $in: ['Scheduled', 'Active'] },
      teacher: { $ne: teacherId },
    })
    if (classroomConflict) {
      res.status(409)
      throw new Error('Selected classroom is already occupied by another session for this period')
    }
  }

  const cleanSection = section?.trim().toUpperCase() || 'A'
  const cleanDepartment = canonicalDepartment(department?.trim() || subjectDoc.department || 'CSE')

  const startOfDay = new Date(parsedDate)
  startOfDay.setUTCHours(0, 0, 0, 0)
  const endOfDay = new Date(parsedDate)
  endOfDay.setUTCHours(23, 59, 59, 999)

  // Find all subjects in this course to identify this academic group
  const sameCourseSubjects = await Subject.find({ course: subjectDoc.course }).select('_id')
  const sameCourseSubjectIds = sameCourseSubjects.map((s) => s._id)

  // Look for timetable entry to determine canonical scheduled slot if available
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const dayOfWeek = dayNames[parsedDate.getUTCDay()]
  const timetableEntry = await Timetable.findOne({
    subject: subjectDoc._id,
    dayOfWeek,
    section: cleanSection,
    isActive: true,
  })

  const effectiveStart = startTime || timetableEntry?.startTime
  const effectiveEnd = endTime || timetableEntry?.endTime
  const effectivePeriod = Number(period) || timetableEntry?.period

  // Check for clashing sessions on this date:
  // 1) Same academic group: subjects sharing this course AND same section
  // 2) Same teacher: teacher cannot be in two sessions at the same time slot
  const potentialClashingSessions = await AttendanceSession.find({
    date: { $gte: startOfDay, $lte: endOfDay },
    status: { $in: ['Scheduled', 'Active', 'Completed'] },
    $or: [
      { subject: { $in: sameCourseSubjectIds }, section: cleanSection },
      { teacher: teacherId },
    ],
  })

  for (const ex of potentialClashingSessions) {
    if (effectiveStart && effectiveEnd && ex.startTime && ex.endTime) {
      if (effectiveStart < ex.endTime && effectiveEnd > ex.startTime) {
        res.status(409)
        throw new Error('Attendance has already been created for this time slot.')
      }
    } else if (effectivePeriod && ex.period && effectivePeriod === ex.period) {
      res.status(409)
      throw new Error('Attendance has already been created for this time slot.')
    } else if (ex.teacher.equals(teacherId) && ex.subject.equals(subjectDoc._id) && ex.period === Number(period)) {
      res.status(409)
      throw new Error('Attendance has already been created for this time slot.')
    }
  }

  // Also check direct match for teacher, subject, date, and period
  const duplicate = await AttendanceSession.findOne({
    teacher: teacherId,
    subject,
    date: { $gte: startOfDay, $lte: endOfDay },
    period: Number(period),
    status: { $in: ['Scheduled', 'Active', 'Completed'] },
  })
  if (duplicate) {
    res.status(409)
    throw new Error('Attendance has already been created for this time slot.')
  }

  let session
  try {
    session = await AttendanceSession.create({
      teacher: teacherId,
      subject,
      classroom: classroom || null,
      department: cleanDepartment,
      section: cleanSection,
      date: parsedDate,
      period: Number(period) || 1,
      startTime: effectiveStart || undefined,
      endTime: effectiveEnd || undefined,
      status: 'Active',
    })
  } catch (err) {
    if (err.code === 11000) {
      res.status(409)
      throw new Error('Attendance has already been created for this time slot.')
    }
    throw err
  }

  const populated = await session.populate(SESSION_POPULATE)
  const roster = await getRoster(subjectDoc.course, { department: session.department, section: session.section })

  res.status(201).json({
    success: true,
    message: 'Attendance session started successfully',
    data: { session: populated, roster },
  })
})

// GET /api/teacher/attendance/sessions/:id
export const getSession = asyncHandler(async (req, res) => {
  const session = await loadOwnedSession(req.params.id, req.teacher._id)
  if (!session) {
    res.status(404)
    throw new Error('Attendance session not found')
  }

  const [roster, existingRecords] = await Promise.all([
    getRoster(session.subject.course?._id, { department: session.department, section: session.section }),
    Attendance.find({ session: session._id }).select('student status method confidence remarks timestamp originalStatus odLeaveRequest'),
  ])

  const marksByStudent = Object.fromEntries(existingRecords.map((r) => [r.student.toString(), r]))

  // Find approved OD/Leave requests for students on the roster for this session date and subject
  const startOfDay = new Date(session.date)
  startOfDay.setUTCHours(0, 0, 0, 0)
  const endOfDay = new Date(session.date)
  endOfDay.setUTCHours(23, 59, 59, 999)

  const rosterIds = roster.map((s) => s._id)
  const approvedRequests = await ODLeaveRequest.find({
    student: { $in: rosterIds },
    status: 'Approved',
    startDate: { $lte: endOfDay },
    endDate: { $gte: startOfDay },
    $or: [
      { subjects: { $size: 0 } },
      { subjects: { $exists: false } },
      { subjects: session.subject?._id || session.subject },
    ],
  }).lean()

  const approvedByStudent = {}
  approvedRequests.forEach((reqDoc) => {
    approvedByStudent[reqDoc.student.toString()] = {
      _id: reqDoc._id,
      type: reqDoc.type,
      reason: reqDoc.reason,
      reviewerRole: reqDoc.reviewerRole,
      reviewedAt: reqDoc.reviewedAt,
    }
  })

  const present = existingRecords.filter((r) => r.status === 'Present').length
  const late = existingRecords.filter((r) => r.status === 'Late').length
  const absent = existingRecords.filter((r) => r.status === 'Absent').length
  const od = existingRecords.filter((r) => r.status === 'OD').length
  const leave = existingRecords.filter((r) => r.status === 'Leave').length
  const effectiveAttended = present + late + (OD_ATTENDANCE_POLICY === 'COUNT_AS_PRESENT' ? od : 0)

  const summary = {
    total: roster.length,
    present,
    late,
    absent,
    od,
    leave,
    unmarked: Math.max(0, roster.length - existingRecords.length),
    percentage: roster.length > 0 ? Math.round((effectiveAttended / roster.length) * 100) : null,
  }

  res.json({ success: true, data: { session, roster, marksByStudent, approvedByStudent, summary } })
})

/**
 * Shared helper to validate, deduplicate, normalize, and upsert
 * student attendance marks for a session.
 */
export async function saveSessionAttendanceRecords(session, teacherId, userId, rawRecords, roster) {
  const rosterIds = new Set(roster.map((s) => s._id.toString()))
  const validStatusMap = {
    present: 'Present',
    late: 'Late',
    absent: 'Absent',
    od: 'OD',
    leave: 'Leave',
  }

  // Pre-load approved OD/Leave requests covering this session's date & subject
  const startOfDay = new Date(session.date)
  startOfDay.setUTCHours(0, 0, 0, 0)
  const endOfDay = new Date(session.date)
  endOfDay.setUTCHours(23, 59, 59, 999)

  const approvedRequests = await ODLeaveRequest.find({
    student: { $in: Array.from(rosterIds) },
    status: 'Approved',
    startDate: { $lte: endOfDay },
    endDate: { $gte: startOfDay },
    $or: [
      { subjects: { $size: 0 } },
      { subjects: { $exists: false } },
      { subjects: session.subject?._id || session.subject },
    ],
  }).lean()

  const approvedMap = new Map(approvedRequests.map((r) => [r.student.toString(), r]))

  const skipped = []
  const seenStudents = new Set()
  const deduplicatedRecords = []

  for (const r of (rawRecords || [])) {
    if (!r.student) continue
    const sId = r.student.toString()
    const rawStatus = typeof r.status === 'string' ? r.status.trim().toLowerCase() : ''
    const normStatus = validStatusMap[rawStatus]
    if (!rosterIds.has(sId) || !normStatus) {
      skipped.push(sId)
      continue
    }

    // Security check: Only allow setting OD or Leave if an approved request covers this session
    if (normStatus === 'OD' || normStatus === 'Leave') {
      const appReq = approvedMap.get(sId)
      if (!appReq || appReq.type !== normStatus) {
        skipped.push(sId)
        continue
      }
    }

    if (!seenStudents.has(sId)) {
      seenStudents.add(sId)
      const approvedForStudent = approvedMap.get(sId)
      deduplicatedRecords.push({
        student: sId,
        status: normStatus,
        remarks: r.remarks || (approvedForStudent && approvedForStudent.type === normStatus ? `Approved ${normStatus}` : undefined),
        method: r.method,
        odLeaveRequest: approvedForStudent && approvedForStudent.type === normStatus ? approvedForStudent._id : null,
      })
    }
  }

  await Promise.all(
    deduplicatedRecords.map((r) =>
      Attendance.findOneAndUpdate(
        { student: r.student, session: session._id },
        {
          student: r.student,
          subject: session.subject?._id || session.subject,
          teacher: teacherId,
          classroom: session.classroom?._id || session.classroom || null,
          department: session.department,
          section: session.section,
          session: session._id,
          date: session.date,
          period: session.period,
          status: r.status,
          method: r.method || 'Manual',
          markedBy: userId,
          remarks: r.remarks,
          odLeaveRequest: r.odLeaveRequest || null,
          timestamp: new Date(),
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      ),
    ),
  )

  return { deduplicatedRecords, skipped }
}

// POST /api/teacher/attendance/sessions/:id/mark
// Body: { records: [{ student, status, remarks }] }
export const markAttendance = asyncHandler(async (req, res) => {
  const session = await loadOwnedSession(req.params.id, req.teacher._id)
  if (!session) {
    res.status(404)
    throw new Error('Attendance session not found')
  }
  if (session.status === 'Completed' || session.status === 'Cancelled') {
    res.status(400)
    throw new Error(`Cannot mark attendance — this session is already ${session.status.toLowerCase()}`)
  }

  const { records } = req.body
  const roster = await getRoster(session.subject.course?._id, { department: session.department, section: session.section })

  const { deduplicatedRecords, skipped } = await saveSessionAttendanceRecords(
    session,
    req.teacher._id,
    req.user._id,
    records,
    roster,
  )

  res.json({
    success: true,
    message: `Attendance saved for ${deduplicatedRecords.length} student${deduplicatedRecords.length === 1 ? '' : 's'}${skipped.length ? ` (${skipped.length} skipped — not on this class's roster)` : ''}`,
    data: { saved: deduplicatedRecords.length, skipped },
  })
})

// POST /api/teacher/attendance/sessions/:id/complete
export const completeSession = asyncHandler(async (req, res) => {
  const session = await loadOwnedSession(req.params.id, req.teacher._id)
  if (!session) {
    res.status(404)
    throw new Error('Attendance session not found')
  }

  const roster = await getRoster(session.subject.course?._id, {
    department: session.department,
    section: session.section,
  })

  // If request contains submitted records, save/upsert them before finalizing
  if (req.body && Array.isArray(req.body.records) && req.body.records.length > 0) {
    await saveSessionAttendanceRecords(
      session,
      req.teacher._id,
      req.user._id,
      req.body.records,
      roster,
    )
  }

  // Idempotent session completion: if already completed, do not re-run or create duplicate notifications
  if (session.status === 'Completed') {
    const existingRecords = await Attendance.find({ session: session._id })
    const present = existingRecords.filter((r) => r.status === 'Present').length
    const late = existingRecords.filter((r) => r.status === 'Late').length
    const absent = existingRecords.filter((r) => r.status === 'Absent').length
    return res.json({
      success: true,
      message: `Attendance session is already completed.`,
      data: {
        session,
        summary: {
          total: roster.length,
          present,
          late,
          absent,
          percentage: roster.length > 0 ? Math.round(((present + late) / roster.length) * 100) : 0,
        },
      },
    })
  }

  // Atomic state transition: Active -> Completed to prevent race condition duplicates
  const updatedSession = await AttendanceSession.findOneAndUpdate(
    { _id: session._id, status: { $ne: 'Completed' } },
    { $set: { status: 'Completed' } },
    { new: true },
  )

  if (!updatedSession) {
    // Another concurrent call completed this session
    const existingRecords = await Attendance.find({ session: session._id })
    const present = existingRecords.filter((r) => r.status === 'Present').length
    const late = existingRecords.filter((r) => r.status === 'Late').length
    const absent = existingRecords.filter((r) => r.status === 'Absent').length
    return res.json({
      success: true,
      message: `Attendance session is already completed.`,
      data: {
        session,
        summary: {
          total: roster.length,
          present,
          late,
          absent,
          percentage: roster.length > 0 ? Math.round(((present + late) / roster.length) * 100) : 0,
        },
      },
    })
  }

  // Finalize attendance: students on the roster not detected or marked
  // are recorded as Absent in the database.
  const existingRecords = await Attendance.find({ session: session._id }).select('student status')
  const markedStudentIds = new Set(existingRecords.map((r) => r.student.toString()))
  const unmarkedStudents = roster.filter((s) => !markedStudentIds.has(s._id.toString()))

  if (unmarkedStudents.length > 0) {
    const startOfDay = new Date(session.date)
    startOfDay.setUTCHours(0, 0, 0, 0)
    const endOfDay = new Date(session.date)
    endOfDay.setUTCHours(23, 59, 59, 999)

    const approvedRequests = await ODLeaveRequest.find({
      student: { $in: unmarkedStudents.map((s) => s._id) },
      status: 'Approved',
      startDate: { $lte: endOfDay },
      endDate: { $gte: startOfDay },
      $or: [
        { subjects: { $size: 0 } },
        { subjects: { $exists: false } },
        { subjects: session.subject?._id || session.subject },
      ],
    }).lean()

    const approvedMap = new Map(approvedRequests.map((r) => [r.student.toString(), r]))

    const absentDocs = unmarkedStudents.map((s) => {
      const approved = approvedMap.get(s._id.toString())
      return {
        student: s._id,
        subject: session.subject._id,
        teacher: req.teacher._id,
        classroom: session.classroom?._id || session.classroom || null,
        department: session.department || s.department,
        section: session.section || s.section,
        session: session._id,
        date: session.date,
        period: session.period,
        status: approved ? approved.type : 'Absent',
        originalStatus: approved ? 'Absent' : null,
        odLeaveRequest: approved ? approved._id : null,
        method: (session.detectedStudents?.length > 0) ? 'Face Recognition' : 'Manual',
        markedBy: req.user._id,
        remarks: approved ? `Approved ${approved.type} on file` : 'Not detected during attendance session',
        timestamp: new Date(),
      }
    })

    await Promise.all(
      absentDocs.map((doc) =>
        Attendance.findOneAndUpdate(
          { student: doc.student, session: session._id },
          doc,
          { upsert: true, new: true, setDefaultsOnInsert: true },
        ).catch((err) => {
          console.error(`Failed to record absent attendance for student ${doc.student}:`, err.message)
          return null
        }),
      ),
    )
  }

  session.status = 'Completed'

  const allRecords = await Attendance.find({ session: session._id })
  const present = allRecords.filter((r) => r.status === 'Present').length
  const late = allRecords.filter((r) => r.status === 'Late').length
  const absent = allRecords.filter((r) => r.status === 'Absent').length
  const od = allRecords.filter((r) => r.status === 'OD').length
  const leave = allRecords.filter((r) => r.status === 'Leave').length
  const totalAttended = present + late + (OD_ATTENDANCE_POLICY === 'COUNT_AS_PRESENT' ? od : 0)
  const isFaceSession = (session.detectedStudents?.length > 0) || (session.unknownFaces?.length > 0)

  // Generate teacher system notifications (deduplicated)
  try {
    const existingNotification = await Notification.findOne({
      recipient: req.user._id,
      'metadata.sessionId': session._id,
    })

    if (!existingNotification) {
      if (isFaceSession) {
        const recognized = session.detectedStudents?.length || 0
        const notRecognized = Math.max(0, roster.length - recognized)
        const unknownCount = session.unknownFaces?.reduce((sum, u) => sum + (u.count || 1), 0) || 0
        await Notification.create({
          recipient: req.user._id,
          title: '✓ Face Attendance Completed',
          message: `${session.subject.name} — Period ${session.period}\n\nRecognized: ${recognized}\nNot Recognized: ${notRecognized}\nUnknown Faces: ${unknownCount}`,
          type: 'FACE_RECOGNITION',
          link: `/teacher/reports?subject=${session.subject._id}`,
          metadata: {
            sessionId: session._id,
            subjectId: session.subject._id,
            recognized,
            notRecognized,
            unknownFaces: unknownCount,
          },
        })
      } else {
        const dateFormatted = new Date(session.date).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
        await Notification.create({
          recipient: req.user._id,
          title: '🔔 Attendance Completed',
          message: `${session.subject.name} — Period ${session.period}\n\n${totalAttended} / ${roster.length} students present\nDate: ${dateFormatted}`,
          type: 'ATTENDANCE_MARKED',
          link: `/teacher/reports?subject=${session.subject._id}`,
          metadata: {
            sessionId: session._id,
            subjectId: session.subject._id,
            present: totalAttended,
            total: roster.length,
            classroom: session.classroom?.name || null,
          },
        })
      }
    }

    // Check low attendance (<75%) scoped to this section/department
    const sessionSection = session.section
    const sessionDept = session.department
    const sessionFilter = {
      subject: session.subject._id,
      teacher: req.teacher._id,
      status: 'Completed',
    }
    if (sessionSection) sessionFilter.section = sessionSection
    if (sessionDept) sessionFilter.department = sessionDept

    const completedSubjectSessions = await AttendanceSession.countDocuments(sessionFilter)

    if (completedSubjectSessions >= 2) {
      const rosterStudentIds = roster.map((s) => s._id)
      const allSubjectAttendance = await Attendance.aggregate([
        {
          $match: {
            subject: session.subject._id,
            teacher: req.teacher._id,
            student: { $in: rosterStudentIds },
          },
        },
        {
          $group: {
            _id: '$student',
            attended: { $sum: { $cond: [{ $in: ['$status', ['Present', 'Late']] }, 1, 0] } },
          },
        },
      ])

      const lowCount = allSubjectAttendance.filter(
        (a) => Math.round((a.attended / completedSubjectSessions) * 100) < LOW_ATTENDANCE_THRESHOLD,
      ).length

      if (lowCount > 0) {
        const recentAlert = await Notification.findOne({
          recipient: req.user._id,
          type: 'LOW_ATTENDANCE',
          'metadata.subjectId': session.subject._id,
          createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        })

        if (!recentAlert) {
          await Notification.create({
            recipient: req.user._id,
            title: '⚠ Low Attendance',
            message: `${lowCount} student${lowCount > 1 ? 's are' : ' is'} below the 75% attendance threshold.\n\n${session.subject.name}`,
            type: 'LOW_ATTENDANCE',
            link: `/teacher/reports?subject=${session.subject._id}`,
            metadata: {
              subjectId: session.subject._id,
              lowCount,
              threshold: LOW_ATTENDANCE_THRESHOLD,
            },
          })
        }
      }
    }
  } catch (err) {
    console.error('Failed to create attendance notification:', err.message)
  }

  res.json({
    success: true,
    message: `Attendance session finalized. ${present} Present, ${absent} Absent.`,
    data: {
      session,
      summary: {
        total: roster.length,
        present,
        late,
        absent,
        percentage: roster.length > 0 ? Math.round(((present + late) / roster.length) * 100) : 0,
      },
    },
  })
})

// GET /api/teacher/attendance/sessions — history, scoped to req.teacher._id
export const listSessions = asyncHandler(async (req, res) => {
  const pagination = parsePagination(req.query)
  const filter = { teacher: req.teacher._id }
  if (req.query.subject) filter.subject = req.query.subject
  if (req.query.status) filter.status = req.query.status
  if (req.query.from || req.query.to) {
    filter.date = {}
    if (req.query.from) filter.date.$gte = new Date(req.query.from)
    if (req.query.to) filter.date.$lte = new Date(req.query.to)
  }

  const [sessions, total] = await Promise.all([
    AttendanceSession.find(filter)
      .populate(SESSION_POPULATE)
      .sort({ date: -1, createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit),
    AttendanceSession.countDocuments(filter),
  ])

  const sessionIds = sessions.map((s) => s._id)

  // Batch query 1: aggregate records by session in a single database roundtrip
  const attendanceAgg = await Attendance.aggregate([
    { $match: { session: { $in: sessionIds } } },
    {
      $group: {
        _id: '$session',
        count: { $sum: 1 },
        presentCount: {
          $sum: { $cond: [{ $eq: ['$status', 'Present'] }, 1, 0] },
        },
        lateCount: {
          $sum: { $cond: [{ $eq: ['$status', 'Late'] }, 1, 0] },
        },
        absentCount: {
          $sum: { $cond: [{ $eq: ['$status', 'Absent'] }, 1, 0] },
        },
        presentOrLate: {
          $sum: {
            $cond: [{ $in: ['$status', ['Present', 'Late']] }, 1, 0],
          },
        },
      },
    },
  ])

  const attendanceMap = new Map()
  for (const row of attendanceAgg) {
    attendanceMap.set(row._id.toString(), {
      count: row.count,
      presentCount: row.presentCount,
      lateCount: row.lateCount,
      absentCount: row.absentCount,
      presentOrLate: row.presentOrLate,
    })
  }

  // Batch query 2: cache roster counts per unique course/department/section
  const rosterKeys = Array.from(
    new Set(
      sessions.map((s) => {
        const cId = (s.subject?.course?._id || s.subject?.course)?.toString() || ''
        const dept = s.department || ''
        const sec = s.section || ''
        return `${cId}:::${dept}:::${sec}`
      }),
    ),
  )

  const rosterCounts = await Promise.all(
    rosterKeys.map(async (key) => {
      const [cId, dept, sec] = key.split(':::')
      if (!cId) return [key, 0]
      const rosterList = await getRoster(cId, { department: dept, section: sec })
      return [key, rosterList.length]
    }),
  )
  const rosterMap = new Map(rosterCounts)

  const items = sessions.map((session) => {
    const courseId = (session.subject?.course?._id || session.subject?.course)?.toString() || ''
    const key = `${courseId}:::${session.department || ''}:::${session.section || ''}`
    const rosterSize = rosterMap.get(key) || 0
    const attData = attendanceMap.get(session._id.toString()) || {
      count: 0,
      presentCount: 0,
      lateCount: 0,
      absentCount: 0,
      presentOrLate: 0,
    }

    return {
      _id: session._id,
      session,
      presentCount: attData.presentCount,
      studentsMarked: attData.presentCount,
      totalMarked: attData.count,
      totalStudents: rosterSize,
      percentage: rosterSize > 0 ? Math.round((attData.presentOrLate / rosterSize) * 100) : null,
    }
  })

  res.json({ success: true, data: { items, pagination: buildPaginationMeta(pagination, total) } })
})

// GET /api/teacher/attendance/class/:subjectId — basic operational view,
// not the full analytics engine (that's Phase 9).
export const getClassAttendance = asyncHandler(async (req, res) => {
  const { subjectId } = req.params
  const subject = await Subject.findOne({ _id: subjectId, teachers: req.teacher._id })
  if (!subject) {
    res.status(404)
    throw new Error('Subject not found')
  }

  const [roster, totalSessions, attendanceStats] = await Promise.all([
    getRoster(subject.course),
    AttendanceSession.countDocuments({ teacher: req.teacher._id, subject: subject._id, status: 'Completed' }),
    Attendance.aggregate([
      { $match: { subject: new mongoose.Types.ObjectId(subjectId), teacher: req.teacher._id } },
      {
        $group: {
          _id: '$student',
          present: { $sum: { $cond: [{ $eq: ['$status', 'Present'] }, 1, 0] } },
          absent: { $sum: { $cond: [{ $eq: ['$status', 'Absent'] }, 1, 0] } },
          late: { $sum: { $cond: [{ $eq: ['$status', 'Late'] }, 1, 0] } },
        },
      },
    ]),
  ])

  const statsByStudent = Object.fromEntries(attendanceStats.map((s) => [s._id.toString(), s]))

  const rows = roster.map((student) => {
    const stats = statsByStudent[student._id.toString()] || { present: 0, absent: 0, late: 0 }
    // Attendance rule (see docs/ATTENDANCE_MANAGEMENT.md): Present and
    // Late both count as "attended" — only Absent doesn't. This is the
    // one place that rule is implemented; every other percentage in the
    // app (class summary, student summary) goes through the same logic.
    const attended = stats.present + stats.late
    const percentage = totalSessions > 0 ? Math.round((attended / totalSessions) * 100) : null
    return {
      student: { _id: student._id, studentId: student.studentId, rollNumber: student.rollNumber, name: student.user?.name },
      present: stats.present,
      absent: stats.absent,
      late: stats.late,
      totalSessions,
      percentage, // null means "no sessions conducted yet" — frontend shows "N/A"
      isLow: isLowAttendance(percentage),
    }
  })

  res.json({
    success: true,
    data: {
      subject: { _id: subject._id, name: subject.name, code: subject.code },
      totalSessions,
      threshold: LOW_ATTENDANCE_THRESHOLD,
      rows,
    },
  })
})
