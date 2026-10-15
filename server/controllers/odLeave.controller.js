import asyncHandler from '../utils/asyncHandler.js'
import {
  ODLeaveRequest,
  Student,
  Subject,
  Teacher,
  User,
  Attendance,
  AttendanceSession,
  Notification,
} from '../models/index.js'
import {
  OD_ATTENDANCE_POLICY,
  LEAVE_ATTENDANCE_POLICY,
} from '../utils/attendanceThreshold.js'

/**
 * POST /api/od-leave/apply
 * Student submits an On-Duty (OD) or Leave request.
 */
export const submitRequest = asyncHandler(async (req, res) => {
  const student = req.student
  const { type, startDate, endDate, subjects, reason, documentUrl, documentName } = req.body

  if (!type || !['OD', 'Leave'].includes(type)) {
    res.status(400)
    throw new Error('Valid request type (OD or Leave) is required')
  }

  if (!startDate || !endDate) {
    res.status(400)
    throw new Error('Both start date and end date are required')
  }

  const parsedStart = new Date(startDate)
  const parsedEnd = new Date(endDate)

  if (isNaN(parsedStart.getTime()) || isNaN(parsedEnd.getTime())) {
    res.status(400)
    throw new Error('Invalid start date or end date format')
  }

  if (parsedEnd < parsedStart) {
    res.status(400)
    throw new Error('End date cannot be earlier than start date')
  }

  // Prevent absurd date ranges (e.g., > 90 days span or years in future/past)
  const daysDiff = (parsedEnd - parsedStart) / (1000 * 60 * 60 * 24)
  if (daysDiff > 90) {
    res.status(400)
    throw new Error('Request duration cannot exceed 90 days')
  }

  const currentYear = new Date().getFullYear()
  if (parsedStart.getFullYear() < currentYear - 1 || parsedEnd.getFullYear() > currentYear + 1) {
    res.status(400)
    throw new Error('Request dates must be within the current academic schedule period')
  }

  const cleanReason = String(reason || '').trim()
  if (cleanReason.length < 3 || cleanReason.length > 1000) {
    res.status(400)
    throw new Error('Reason must be between 3 and 1000 characters')
  }

  // Validate affected subjects belong to student's enrolled course if specified
  let validSubjectIds = []
  if (Array.isArray(subjects) && subjects.length > 0) {
    const enrolledSubjects = await Subject.find({
      _id: { $in: subjects },
      course: student.course,
      isActive: true,
    }).select('_id')
    validSubjectIds = enrolledSubjects.map((s) => s._id)
  }

  // Create the request with student ownership guaranteed by req.student
  const request = await ODLeaveRequest.create({
    student: student._id,
    type,
    startDate: parsedStart,
    endDate: parsedEnd,
    subjects: validSubjectIds,
    reason: cleanReason,
    documentUrl: documentUrl || null,
    documentName: documentName || null,
    status: 'Pending',
    attendancePolicy: type === 'OD' ? OD_ATTENDANCE_POLICY : LEAVE_ATTENDANCE_POLICY,
  })

  // Format dates for notification text
  const dateRangeStr = `${parsedStart.toLocaleDateString()} to ${parsedEnd.toLocaleDateString()}`
  const studentUser = await User.findById(student.user).select('name email')
  const studentName = studentUser?.name || 'Student'

  // Route Notifications:
  try {
    // 1. For OD requests: notify Administrators
    if (type === 'OD') {
      const adminUsers = await User.find({ role: 'admin', isActive: true }).select('_id')
      await Promise.all(
        adminUsers.map((admin) =>
          Notification.create({
            recipient: admin._id,
            title: `New On-Duty (OD) Request: ${studentName}`,
            message: `${studentName} (${student.studentId}, Section ${student.section || 'A'}) applied for On-Duty (OD) from ${dateRangeStr}.\nReason: ${cleanReason.slice(0, 100)}`,
            type: 'OD_REQUEST',
            link: '/admin/attendance',
            metadata: {
              requestId: request._id,
              studentId: student._id,
              requestType: 'OD',
            },
          }),
        ),
      )
    }

    // 2. For both OD and Leave: notify respective Teachers
    const teacherQuery = { course: student.course, isActive: true }
    if (validSubjectIds.length > 0) {
      teacherQuery._id = { $in: validSubjectIds }
    }
    const relevantSubjects = await Subject.find(teacherQuery).populate({
      path: 'teachers',
      populate: { path: 'user', select: '_id' },
    })

    const teacherUserIds = new Set()
    relevantSubjects.forEach((sub) => {
      sub.teachers?.forEach((t) => {
        if (t.user?._id) teacherUserIds.add(t.user._id.toString())
      })
    })

    await Promise.all(
      Array.from(teacherUserIds).map((tUserId) =>
        Notification.create({
          recipient: tUserId,
          title: `New ${type} Request: ${studentName}`,
          message: `${studentName} (${student.studentId}, Sec ${student.section || 'A'}) requested ${type} from ${dateRangeStr}.\nReason: ${cleanReason.slice(0, 100)}`,
          type: type === 'OD' ? 'OD_REQUEST' : 'LEAVE_REQUEST',
          link: '/teacher/notifications',
          metadata: {
            requestId: request._id,
            studentId: student._id,
            requestType: type,
          },
        }),
      ),
    )
  } catch (notifErr) {
    console.error('Failed to create OD/Leave submission notifications:', notifErr.message)
  }

  res.status(201).json({
    success: true,
    message: `${type} request submitted successfully and is pending review.`,
    data: request,
  })
})

/**
 * GET /api/od-leave/my-requests
 * Authenticated student retrieves their own OD/Leave requests.
 */
export const getMyRequests = asyncHandler(async (req, res) => {
  const student = req.student
  const { status, type } = req.query

  const filter = { student: student._id }
  if (status && ['Pending', 'Approved', 'Rejected'].includes(status)) {
    filter.status = status
  }
  if (type && ['OD', 'Leave'].includes(type)) {
    filter.type = type
  }

  const requests = await ODLeaveRequest.find(filter)
    .populate('subjects', 'name code department')
    .populate('reviewedBy', 'name role')
    .sort({ createdAt: -1 })
    .lean()

  res.json({
    success: true,
    data: requests,
  })
})

/**
 * GET /api/od-leave/requests
 * Reviewer (Teacher or Admin) lists requests awaiting or past review.
 */
export const getReviewerRequests = asyncHandler(async (req, res) => {
  const user = req.user
  const { status, type, studentId } = req.query

  const filter = {}
  if (status && ['Pending', 'Approved', 'Rejected'].includes(status)) {
    filter.status = status
  }
  if (type && ['OD', 'Leave'].includes(type)) {
    filter.type = type
  }
  if (studentId) {
    filter.student = studentId
  }

  // Teacher scoping: teacher can only see requests for students in their assigned courses/subjects
  if (user.role === 'teacher') {
    const teacher = await Teacher.findOne({ user: user._id })
    if (!teacher) {
      res.status(403)
      throw new Error('Teacher profile not found')
    }

    const teacherSubjects = await Subject.find({ teachers: teacher._id }).select('course _id')
    const courseIds = teacherSubjects.map((s) => s.course).filter(Boolean)
    const eligibleStudents = await Student.find({ course: { $in: courseIds } }).select('_id')
    const eligibleStudentIds = eligibleStudents.map((s) => s._id)

    filter.student = { $in: eligibleStudentIds }
  }

  const requests = await ODLeaveRequest.find(filter)
    .populate({
      path: 'student',
      select: 'studentId rollNumber department section course user',
      populate: { path: 'user', select: 'name email' },
    })
    .populate('subjects', 'name code')
    .populate('reviewedBy', 'name role')
    .sort({ createdAt: -1 })
    .lean()

  res.json({
    success: true,
    data: requests,
  })
})

/**
 * PATCH /api/od-leave/:id/review
 * Authorized Teacher or Admin approves or rejects a request.
 */
export const reviewRequest = asyncHandler(async (req, res) => {
  const { id } = req.params
  const { status, remarks } = req.body
  const user = req.user

  if (!['Approved', 'Rejected'].includes(status)) {
    res.status(400)
    throw new Error('Decision status must be either Approved or Rejected')
  }

  if (status === 'Rejected' && (!remarks || !String(remarks).trim())) {
    res.status(400)
    throw new Error('Rejection reason or remarks are required when rejecting a request')
  }

  // Atomic lookup ensuring request is currently Pending
  const request = await ODLeaveRequest.findOne({ _id: id, status: 'Pending' }).populate({
    path: 'student',
    populate: { path: 'user', select: '_id name email' },
  })

  if (!request) {
    res.status(404)
    throw new Error('Request not found or has already been reviewed')
  }

  // Authorization check for teacher: student must be in teacher's course
  if (user.role === 'teacher') {
    const teacher = await Teacher.findOne({ user: user._id })
    if (!teacher) {
      res.status(403)
      throw new Error('Teacher profile not found')
    }
    const teacherSubjects = await Subject.find({ teachers: teacher._id }).select('course')
    const teacherCourseIds = teacherSubjects.map((s) => s.course?.toString())
    if (!teacherCourseIds.includes(request.student.course?.toString())) {
      res.status(403)
      throw new Error('You are not authorized to review requests for students outside your assigned classes')
    }
  }

  // Record decision
  const cleanRemarks = String(remarks || '').trim()
  request.status = status
  request.reviewedBy = user._id
  request.reviewerRole = user.role
  request.reviewerRemarks = cleanRemarks || null
  request.reviewedAt = new Date()

  // If Approved: integrate with attendance records for the affected dates and sessions
  const appliedSessionIds = []
  if (status === 'Approved') {
    const startOfDay = new Date(request.startDate)
    startOfDay.setUTCHours(0, 0, 0, 0)
    const endOfDay = new Date(request.endDate)
    endOfDay.setUTCHours(23, 59, 59, 999)

    // Build session query for the applicable dates
    const sessionQuery = {
      date: { $gte: startOfDay, $lte: endOfDay },
      status: 'Completed',
    }
    if (request.subjects && request.subjects.length > 0) {
      sessionQuery.subject = { $in: request.subjects }
    }

    const sessions = await AttendanceSession.find(sessionQuery).select('_id date subject period')

    for (const session of sessions) {
      appliedSessionIds.push(session._id)

      // Find any existing attendance record for this student and session
      const existingRecord = await Attendance.findOne({
        student: request.student._id,
        session: session._id,
      })

      if (existingRecord) {
        // If already marked Absent, upgrade safely to OD/Leave while preserving original status
        if (existingRecord.status === 'Absent') {
          existingRecord.originalStatus = 'Absent'
          existingRecord.status = request.type === 'OD' ? 'OD' : 'Leave'
          existingRecord.odLeaveRequest = request._id
          existingRecord.remarks = `Approved ${request.type}: ${cleanRemarks || request.reason}`.slice(0, 500)
          await existingRecord.save()
        }
      }
    }
  }

  request.appliedSessions = appliedSessionIds
  await request.save()

  // Notify student of decision
  try {
    const studentUser = request.student?.user?._id || request.student?.user
    if (studentUser) {
      const dateRangeStr = `${new Date(request.startDate).toLocaleDateString()} to ${new Date(request.endDate).toLocaleDateString()}`
      await Notification.create({
        recipient: studentUser,
        title: `${request.type} Request ${status}`,
        message: `Your ${request.type} request for ${dateRangeStr} has been ${status.toLowerCase()} by ${user.name}.${cleanRemarks ? `\n\nRemarks: ${cleanRemarks}` : ''}`,
        type: 'OD_LEAVE_DECISION',
        link: '/student/notifications',
        metadata: {
          requestId: request._id,
          status,
          type: request.type,
          remarks: cleanRemarks,
        },
      })
    }
  } catch (notifErr) {
    console.error('Failed to notify student of OD/Leave decision:', notifErr.message)
  }

  res.json({
    success: true,
    message: `${request.type} request successfully ${status.toLowerCase()}.`,
    data: request,
  })
})

/**
 * GET /api/od-leave/session-exceptions/:sessionId
 * Helper for manual attendance: loads approved OD/leave exceptions for a session.
 */
export const getSessionExceptions = asyncHandler(async (req, res) => {
  const { sessionId } = req.params
  const session = await AttendanceSession.findById(sessionId).populate('subject', 'course')
  if (!session) {
    res.status(404)
    throw new Error('Attendance session not found')
  }

  const startOfDay = new Date(session.date)
  startOfDay.setUTCHours(0, 0, 0, 0)
  const endOfDay = new Date(session.date)
  endOfDay.setUTCHours(23, 59, 59, 999)

  const approved = await ODLeaveRequest.find({
    status: 'Approved',
    startDate: { $lte: endOfDay },
    endDate: { $gte: startOfDay },
    $or: [
      { subjects: { $size: 0 } },
      { subjects: { $exists: false } },
      { subjects: session.subject?._id || session.subject },
    ],
  })
    .populate({
      path: 'student',
      select: 'studentId rollNumber department section user',
      populate: { path: 'user', select: 'name' },
    })
    .lean()

  const exceptionsByStudent = {}
  approved.forEach((reqDoc) => {
    if (reqDoc.student?._id) {
      exceptionsByStudent[reqDoc.student._id.toString()] = {
        requestId: reqDoc._id,
        type: reqDoc.type,
        reason: reqDoc.reason,
        reviewedBy: reqDoc.reviewedBy,
        reviewerRemarks: reqDoc.reviewerRemarks,
      }
    }
  })

  res.json({
    success: true,
    data: {
      exceptionsByStudent,
      count: Object.keys(exceptionsByStudent).length,
    },
  })
})
