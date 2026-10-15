import mongoose from 'mongoose'
import asyncHandler from '../../utils/asyncHandler.js'
import { AttendanceSession, Attendance, Subject, Teacher, Classroom, Student } from '../../models/index.js'
import { isLowAttendance, LOW_ATTENDANCE_THRESHOLD } from '../../utils/attendanceThreshold.js'
import { buildAcademicFilter, canonicalDepartment } from '../../utils/academicFilter.js'

// GET /api/admin/attendance/stats
export const getAttendanceStats = asyncHandler(async (req, res) => {
  const [totalSessions, allRecords, sessions] = await Promise.all([
    AttendanceSession.countDocuments({ status: 'Completed' }),
    Attendance.find().select('status method date student department subject').populate('subject', 'department').lean(),
    AttendanceSession.find({ status: 'Completed' }).select('detectedStudents unknownFaces').lean(),
  ])

  // Today bounds
  const now = new Date()
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  let presentToday = 0
  let lateToday = 0
  let absentToday = 0

  allRecords.forEach((r) => {
    if (r.date) {
      const d = new Date(r.date)
      const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      if (dStr === todayStr) {
        if (r.status === 'Present') presentToday++
        else if (r.status === 'Late') lateToday++
        else if (r.status === 'Absent') absentToday++
      }
    }
  })

  const totalToday = presentToday + lateToday + absentToday
  // Formula: (Present + Late) / Total * 100
  const todayPercentage = totalToday > 0 ? Math.round(((presentToday + lateToday) / totalToday) * 100) : null

  // Low Attendance students count (<75%)
  const studentStats = {}
  allRecords.forEach((r) => {
    if (!r.student) return
    const sId = r.student.toString()
    if (!studentStats[sId]) studentStats[sId] = { attended: 0, total: 0 }
    if (r.status === 'Present' || r.status === 'Late') studentStats[sId].attended++
    studentStats[sId].total++
  })

  let lowAttendanceCount = 0
  Object.values(studentStats).forEach((s) => {
    if (s.total > 0 && Math.round((s.attended / s.total) * 100) < LOW_ATTENDANCE_THRESHOLD) {
      lowAttendanceCount++
    }
  })

  // Department-wise Attendance
  const deptStats = {}
  allRecords.forEach((r) => {
    let dept = r.department || r.subject?.department
    if (!dept) return
    if (/^(computer science|cse|c\.s\.e\.|cse department)$/i.test(dept.trim())) {
      dept = 'CSE'
    } else {
      dept = dept.trim()
    }
    if (!deptStats[dept]) {
      deptStats[dept] = { department: dept, present: 0, late: 0, absent: 0, total: 0 }
    }
    const d = deptStats[dept]
    if (r.status === 'Present') d.present++
    else if (r.status === 'Late') d.late++
    else if (r.status === 'Absent') d.absent++
    d.total++
  })

  const departmentWise = Object.values(deptStats).map((d) => ({
    department: d.department,
    percentage: d.total > 0 ? Math.round(((d.present + d.late) / d.total) * 100) : null,
    total: d.total,
    present: d.present,
    late: d.late,
    absent: d.absent,
  }))

  res.json({
    success: true,
    data: {
      totalSessions,
      presentToday,
      lateToday,
      absentToday,
      totalToday,
      todayPercentage,
      lowAttendanceCount,
      departmentWise,
      threshold: LOW_ATTENDANCE_THRESHOLD,
    },
  })
})

// GET /api/admin/attendance/sessions
export const listAttendanceSessions = asyncHandler(async (req, res) => {
  const { year } = req.query
  const { impossible, sessQuery } = await buildAcademicFilter(req.query)

  if (impossible) {
    return res.json({
      success: true,
      data: { items: [], total: 0 },
    })
  }

  const sessions = await AttendanceSession.find(sessQuery)
    .populate('subject', 'name code department semester')
    .populate({
      path: 'teacher',
      select: 'employeeId department user',
      populate: { path: 'user', select: 'name email' },
    })
    .sort({ date: -1, period: -1 })
    .lean()

  const sessionIds = sessions.map((s) => s._id)
  const records = await Attendance.find({ session: { $in: sessionIds } }).select('session status method').lean()

  const recordsBySession = {}
  records.forEach((r) => {
    const sId = r.session.toString()
    if (!recordsBySession[sId]) {
      recordsBySession[sId] = { present: 0, late: 0, absent: 0, total: 0 }
    }
    const entry = recordsBySession[sId]
    if (r.status === 'Present') entry.present++
    else if (r.status === 'Late') entry.late++
    else if (r.status === 'Absent') entry.absent++
    entry.total++
  })

  let formatted = sessions.map((s) => {
    const stats = recordsBySession[s._id.toString()] || { present: 0, late: 0, absent: 0, total: 0 }
    const attended = stats.present + stats.late
    const percentage = stats.total > 0 ? Math.round((attended / stats.total) * 100) : null
    const calculatedYear = s.subject?.semester ? Math.ceil(s.subject.semester / 2) : 1

    return {
      _id: s._id,
      date: s.date,
      period: s.period || 1,
      startTime: s.startTime || '—',
      endTime: s.endTime || '—',
      status: s.status,
      subject: s.subject ? { _id: s.subject._id, name: s.subject.name, code: s.subject.code } : null,
      teacher: s.teacher ? { _id: s.teacher._id, name: s.teacher.user?.name || s.teacher.employeeId } : null,
      department: canonicalDepartment(s.department || s.subject?.department || '—'),
      year: calculatedYear,
      section: s.section || 'A',
      present: stats.present,
      late: stats.late,
      absent: stats.absent,
      total: stats.total,
      percentage,
    }
  })

  if (year) {
    const yrNum = typeof year === 'string' ? parseInt(year.replace(/\D/g, ''), 10) : Number(year)
    if (!isNaN(yrNum)) {
      formatted = formatted.filter((s) => s.year === yrNum)
    }
  }

  res.json({
    success: true,
    data: { items: formatted, total: formatted.length },
  })
})

// GET /api/admin/attendance/options
export const getAttendanceFilterOptions = asyncHandler(async (req, res) => {
  const { department, subject } = req.query
  const isCse = department ? /^(cse|computer science|c\.s\.e\.|cse department)$/i.test(department.trim()) : false
  const deptRegex = department ? (isCse ? /^(cse|computer science|c\.s\.e\.|cse department)$/i : new RegExp(`^${department.trim()}$`, 'i')) : null

  let teacherQuery = { isActive: true }
  if (deptRegex) {
    teacherQuery.department = deptRegex
  }
  if (subject && mongoose.Types.ObjectId.isValid(subject)) {
    const subDoc = await Subject.findById(subject).select('teachers department').lean()
    if (subDoc) {
      if (deptRegex && !deptRegex.test(subDoc.department)) {
        teacherQuery._id = { $in: [] }
      } else {
        const assigned = (subDoc.teachers || []).map((t) => (t._id || t).toString())
        teacherQuery._id = { $in: assigned }
      }
    } else {
      teacherQuery._id = { $in: [] }
    }
  }

  const [subjects, teachers, students, studentSections, sessionSections] = await Promise.all([
    Subject.find({ isActive: true }).select('name code department semester teachers').sort({ name: 1 }),
    Teacher.find(teacherQuery).populate('user', 'name').select('employeeId department user').sort({ 'user.name': 1 }),
    Student.find({ isActive: true }).populate('user', 'name').select('studentId rollNumber department year section user').sort({ rollNumber: 1 }),
    Student.distinct('section', { isActive: true }),
    AttendanceSession.distinct('section'),
  ])

  const rawDepts = [
    ...subjects.map((s) => s.department).filter(Boolean),
    ...teachers.map((t) => t.department).filter(Boolean),
    ...students.map((st) => st.department).filter(Boolean),
  ]
  const departments = Array.from(
    new Set(rawDepts.map(canonicalDepartment).filter(Boolean)),
  ).sort()

  const combinedSections = Array.from(
    new Set([...studentSections, ...sessionSections].filter(Boolean).map((s) => s.trim().toUpperCase())),
  ).sort()
  const sections = combinedSections.length > 0 ? combinedSections : ['A', 'B']

  res.json({
    success: true,
    data: {
      subjects,
      teachers: teachers.map((t) => ({
        _id: t._id,
        name: t.user?.name || t.employeeId,
        department: canonicalDepartment(t.department || '—'),
      })),
      students: students.map((st) => ({
        _id: st._id,
        name: st.user?.name || st.studentId,
        studentId: st.studentId,
        rollNumber: st.rollNumber,
        department: canonicalDepartment(st.department || '—'),
        year: st.year,
        section: st.section,
      })),
      departments,
      years: [1, 2, 3, 4],
      sections,
    },
  })
})

// GET /api/admin/attendance/sessions/:id
export const getAttendanceSessionDetail = asyncHandler(async (req, res) => {
  const session = await AttendanceSession.findById(req.params.id)
    .populate('subject', 'name code department course semester')
    .populate({
      path: 'teacher',
      select: 'employeeId department user',
      populate: { path: 'user', select: 'name email phone' },
    })
    .lean()

  if (!session) {
    res.status(404)
    throw new Error('Attendance session not found')
  }

  const records = await Attendance.find({ session: session._id })
    .populate({
      path: 'student',
      select: 'studentId rollNumber department section user',
      populate: { path: 'user', select: 'name email' },
    })
    .sort({ 'student.rollNumber': 1 })
    .lean()

  // Clean data: no face descriptors, no secrets
  const studentsList = records.map((r) => ({
    _id: r._id,
    studentId: r.student?.studentId || '—',
    rollNumber: r.student?.rollNumber || '—',
    name: r.student?.user?.name || r.student?.studentId || 'Student',
    department: r.student?.department || session.department || '—',
    section: r.student?.section || session.section || '—',
    status: r.status,
    markedAt: r.markedAt || r.timestamp || r.createdAt,
  }))

  const present = studentsList.filter((s) => s.status === 'Present').length
  const late = studentsList.filter((s) => s.status === 'Late').length
  const absent = studentsList.filter((s) => s.status === 'Absent').length
  const total = studentsList.length
  // (Present + Late) / Total * 100
  const percentage = total > 0 ? Math.round(((present + late) / total) * 100) : null

  res.json({
    success: true,
    data: {
      session: {
        _id: session._id,
        date: session.date,
        period: session.period,
        startTime: session.startTime,
        endTime: session.endTime,
        status: session.status,
        subject: session.subject,
        teacher: session.teacher,
        department: session.department || session.subject?.department,
        section: session.section,
      },
      summary: { present, late, absent, total, percentage },
      students: studentsList,
    },
  })
})

// DELETE /api/admin/attendance/sessions/:id
// Admin-only: Deletes an AttendanceSession and all associated Attendance records safely.
export const deleteAttendanceSession = asyncHandler(async (req, res) => {
  const session = await AttendanceSession.findById(req.params.id)
  if (!session) {
    res.status(404)
    throw new Error('Attendance session not found')
  }

  // 1. Delete all Attendance records for this session
  const deletedRecords = await Attendance.deleteMany({ session: session._id })

  // 2. Delete the session document itself
  await AttendanceSession.findByIdAndDelete(session._id)

  res.json({
    success: true,
    message: `Attendance session and ${deletedRecords.deletedCount} associated attendance record(s) deleted successfully`,
  })
})

// DELETE /api/admin/attendance/records/:id
// Admin-only: Deletes an individual Attendance record safely without affecting the session.
export const deleteAttendanceRecord = asyncHandler(async (req, res) => {
  const record = await Attendance.findById(req.params.id)
  if (!record) {
    res.status(404)
    throw new Error('Attendance record not found')
  }

  await Attendance.findByIdAndDelete(record._id)

  res.json({
    success: true,
    message: 'Attendance record deleted successfully',
  })
})

