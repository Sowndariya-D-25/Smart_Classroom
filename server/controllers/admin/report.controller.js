import mongoose from 'mongoose'
import asyncHandler from '../../utils/asyncHandler.js'
import {
  Student,
  Teacher,
  Subject,
  Classroom,
  Attendance,
  AttendanceSession,
} from '../../models/index.js'
import { isLowAttendance, LOW_ATTENDANCE_THRESHOLD } from '../../utils/attendanceThreshold.js'
import { buildAcademicFilter, canonicalDepartment } from '../../utils/academicFilter.js'

const canonicalDept = (dept) => {
  if (!dept) return ''
  const trimmed = dept.trim()
  if (/^(computer science|cse|c\.s\.e\.|cse department)$/i.test(trimmed)) return 'CSE'
  return trimmed
}

// GET /api/admin/reports/options
export const getAdminReportFilterOptions = asyncHandler(async (req, res) => {
  const { department, subject } = req.query
  const isCse = department ? /^(cse|computer science|c\.s\.e\.|cse department)$/i.test(department.trim()) : false
  const deptRegex = department ? (isCse ? /^(cse|computer science|c\.s\.e\.|cse department)$/i : new RegExp(`^${department.trim()}$`, 'i')) : null

  let teacherQuery = { isActive: true }
  if (deptRegex) {
    teacherQuery.department = deptRegex
  }

  if (subject && mongoose.Types.ObjectId.isValid(subject)) {
    const targetSubject = await Subject.findById(subject).select('teachers department').lean()
    if (targetSubject) {
      if (deptRegex && !deptRegex.test(targetSubject.department)) {
        teacherQuery._id = { $in: [] }
      } else {
        const assignedTeachers = (targetSubject.teachers || []).map((t) => (t._id || t).toString())
        teacherQuery._id = { $in: assignedTeachers }
      }
    } else {
      teacherQuery._id = { $in: [] }
    }
  }

  const [subjects, teachers, students, distinctSections, allDepts] = await Promise.all([
    Subject.find({ isActive: true }).select('name code department semester teachers').sort({ name: 1 }),
    Teacher.find(teacherQuery).populate('user', 'name').select('employeeId department user').sort({ 'user.name': 1 }),
    Student.find({ isActive: true }).populate('user', 'name').select('studentId rollNumber department year section user').sort({ rollNumber: 1 }),
    Student.distinct('section', { section: { $ne: null } }),
    Teacher.distinct('department', { isActive: true }),
  ])

  const rawDepts = [
    ...subjects.map((s) => s.department).filter(Boolean),
    ...allDepts.filter(Boolean),
    ...students.map((st) => st.department).filter(Boolean),
  ]
  const departments = Array.from(
    new Set(rawDepts.map(canonicalDept).filter(Boolean)),
  ).sort()

  const years = ['1st Year', '2nd Year', '3rd Year', '4th Year']
  const sections = Array.from(new Set(distinctSections.filter(Boolean))).sort()

  res.json({
    success: true,
    data: {
      subjects,
      teachers: teachers.map((t) => ({
        _id: t._id,
        name: t.user?.name || t.employeeId,
        employeeId: t.employeeId,
        department: canonicalDept(t.department || '—'),
      })),
      students: students.map((st) => ({
        _id: st._id,
        name: st.user?.name || st.studentId,
        studentId: st.studentId,
        rollNumber: st.rollNumber,
        department: canonicalDept(st.department || '—'),
        year: st.year,
        section: st.section,
      })),
      departments,
      years,
      sections: sections.length > 0 ? sections : ['A'],
    },
  })
})

// GET /api/admin/reports
export const getAdminReports = asyncHandler(async (req, res) => {
  const { department, year, section, teacher, subject, student, method, startDate, endDate, date } = req.query
  const { impossible, sessQuery, attQuery } = await buildAcademicFilter(req.query)

  if (impossible) {
    const reportingPeriod = startDate && endDate
      ? `${startDate} to ${endDate}`
      : startDate
      ? `From ${startDate}`
      : endDate
      ? `Up to ${endDate}`
      : 'Filtered'

    return res.json({
      success: true,
      data: {
        overall: {
          reportingPeriod,
          totalStudents: 0,
          totalSessions: 0,
          presentRecords: 0,
          lateRecords: 0,
          absentRecords: 0,
          totalRecords: 0,
          overallPercentage: null,
          lowAttendanceCount: 0,
          criticalCount: 0,
        },
        studentAttendance: [],
        departmentAttendance: [],
        subjectWise: [],
        teacherSessions: [],
        lowAttendance: [],
        dailyAttendance: [],
      },
    })
  }

  let [allAttendance, allSessions, allStudents, allSubjects, allTeachers] = await Promise.all([
    Attendance.find(attQuery)
      .populate('subject', 'name code department semester year teachers')
      .populate({
        path: 'teacher',
        select: 'employeeId department user',
        populate: { path: 'user', select: 'name' },
      })
      .populate({
        path: 'student',
        select: 'studentId rollNumber department year section user',
        populate: { path: 'user', select: 'name email' },
      })
      .lean(),
    AttendanceSession.find(sessQuery)
      .populate('subject', 'name code department semester year teachers')
      .populate({
        path: 'teacher',
        select: 'employeeId department user',
        populate: { path: 'user', select: 'name' },
      })
      .sort({ date: -1, period: 1 })
      .lean(),
    Student.find({ isActive: true })
      .populate('user', 'name email phone')
      .lean(),
    Subject.find({ isActive: true })
      .populate('teachers')
      .lean(),
    Teacher.find({ isActive: true })
      .populate('user', 'name email')
      .lean(),
  ])

  // 1. Overall Summary
  let presentRecords = 0
  let lateRecords = 0
  let absentRecords = 0
  let faceCount = 0
  let manualCount = 0

  allAttendance.forEach((r) => {
    if (r.status === 'Present') presentRecords++
    else if (r.status === 'Late') lateRecords++
    else if (r.status === 'Absent') absentRecords++

    if (r.method === 'Face Recognition' || r.method === 'FACE') faceCount++
    else manualCount++
  })

  const totalMarked = presentRecords + lateRecords + absentRecords
  const overallPercentage = totalMarked > 0 ? Math.round(((presentRecords + lateRecords) / totalMarked) * 100) : null

  // 2. Student-wise Attendance & Low Attendance (<75%) & Critical (<60%)
  const studentStatsMap = {}
  allAttendance.forEach((r) => {
    if (!r.student) return
    const stId = r.student._id ? r.student._id.toString() : r.student.toString()
    if (!studentStatsMap[stId]) {
      studentStatsMap[stId] = {
        student: r.student,
        present: 0,
        late: 0,
        absent: 0,
        total: 0,
      }
    }
    const st = studentStatsMap[stId]
    if (r.status === 'Present') st.present++
    else if (r.status === 'Late') st.late++
    else if (r.status === 'Absent') st.absent++
    st.total++
  })

  const studentAttendance = []
  const lowAttendance = []
  let below60Count = 0

  Object.values(studentStatsMap).forEach((st) => {
    const attended = st.present + st.late
    const percentage = st.total > 0 ? Math.round((attended / st.total) * 100) : null
    const isLow = percentage !== null && percentage < 75
    const isCritical = percentage !== null && percentage < 60
    if (isCritical) below60Count++

    let statusLabel = 'No Data'
    if (percentage !== null) {
      if (percentage >= 75) statusLabel = 'Above 75%'
      else if (percentage < 60) statusLabel = 'Critical (<60%)'
      else statusLabel = 'Below 75%'
    }

    const entry = {
      student: {
        _id: st.student._id,
        name: st.student.user?.name || st.student.studentId || 'Unknown',
        studentId: st.student.studentId,
        rollNumber: st.student.rollNumber,
        department: st.student.department,
        year: st.student.year,
        section: st.student.section,
      },
      department: st.student.department || '—',
      year: st.student.year || '—',
      section: st.student.section || 'A',
      present: st.present,
      late: st.late,
      attended,
      absent: st.absent,
      total: st.total,
      percentage,
      status: statusLabel,
      isLow,
      isCritical,
    }

    studentAttendance.push(entry)
    if (isLow) {
      lowAttendance.push(entry)
    }
  })

  studentAttendance.sort((a, b) => (a.student.rollNumber || '').localeCompare(b.student.rollNumber || ''))
  lowAttendance.sort((a, b) => (a.percentage ?? 0) - (b.percentage ?? 0))

  // 3. Department Attendance Report
  const deptMap = {}
  // Seed with departments found across subjects, teachers, and students
  const deptNames = Array.from(new Set([
    ...allSubjects.map((s) => s.department).filter(Boolean),
    ...allStudents.map((s) => s.department).filter(Boolean),
    ...allTeachers.map((t) => t.department).filter(Boolean),
  ].map(canonicalDept).filter(Boolean)))

  deptNames.forEach((d) => {
    deptMap[d] = {
      department: d,
      students: new Set(),
      sessions: new Set(),
      present: 0,
      late: 0,
      absent: 0,
      total: 0,
    }
  })

  allStudents.forEach((st) => {
    const d = canonicalDept(st.department)
    if (d && deptMap[d]) {
      deptMap[d].students.add(st._id.toString())
    }
  })

  allSessions.forEach((sess) => {
    const d = canonicalDept(sess.department || sess.subject?.department)
    if (d && deptMap[d]) {
      deptMap[d].sessions.add(sess._id.toString())
    }
  })

  allAttendance.forEach((r) => {
    const d = canonicalDept(r.department || r.student?.department || r.subject?.department)
    if (d) {
      if (!deptMap[d]) {
        deptMap[d] = { department: d, students: new Set(), sessions: new Set(), present: 0, late: 0, absent: 0, total: 0 }
      }
      if (r.status === 'Present') deptMap[d].present++
      else if (r.status === 'Late') deptMap[d].late++
      else if (r.status === 'Absent') deptMap[d].absent++
      deptMap[d].total++
    }
  })

  const departmentAttendance = Object.values(deptMap)
    .filter((d) => !department || canonicalDept(department) === d.department)
    .map((d) => {
      const attended = d.present + d.late
      const pct = d.total > 0 ? Math.round((attended / d.total) * 100) : null
      return {
        department: d.department,
        students: d.students.size,
        sessions: d.sessions.size,
        present: d.present,
        late: d.late,
        absent: d.absent,
        total: d.total,
        percentage: pct,
      }
    })
    .sort((a, b) => a.department.localeCompare(b.department))

  // 4. Subject-wise Attendance
  const subjectMap = {}
  allAttendance.forEach((r) => {
    if (!r.subject) return
    const sId = r.subject._id ? r.subject._id.toString() : r.subject.toString()
    if (!subjectMap[sId]) {
      subjectMap[sId] = {
        subject: r.subject,
        teacher: r.teacher ? (r.teacher.user?.name || r.teacher.employeeId) : '—',
        sessions: new Set(),
        present: 0,
        late: 0,
        absent: 0,
        total: 0,
      }
    }
    const s = subjectMap[sId]
    if (r.session) s.sessions.add(r.session.toString())
    if (r.status === 'Present') s.present++
    else if (r.status === 'Late') s.late++
    else if (r.status === 'Absent') s.absent++
    s.total++
  })

  const subjectWise = Object.values(subjectMap).map((s) => {
    const attended = s.present + s.late
    const subTeacher = s.subject?.teachers?.[0]?.user?.name || s.subject?.teachers?.[0]?.employeeId || s.teacher || '—'
    return {
      subject: { _id: s.subject._id, name: s.subject.name, code: s.subject.code },
      code: s.subject.code,
      name: s.subject.name,
      department: canonicalDept(s.subject.department || '—'),
      year: s.subject.semester ? Math.ceil(s.subject.semester / 2) : 1,
      teacher: subTeacher,
      sessions: s.sessions.size,
      present: s.present,
      late: s.late,
      absent: s.absent,
      total: s.total,
      percentage: s.total > 0 ? Math.round((attended / s.total) * 100) : null,
    }
  })

  // 5. Teacher Session Report (descriptive only, no ranking)
  const teacherStatsMap = {}
  allTeachers.forEach((t) => {
    const tid = t._id.toString()
    teacherStatsMap[tid] = {
      teacherId: t._id,
      name: t.user?.name || t.employeeId,
      employeeId: t.employeeId,
      department: canonicalDept(t.department || '—'),
      sessions: 0,
      present: 0,
      late: 0,
      absent: 0,
      totalMarks: 0,
    }
  })

  allSessions.forEach((s) => {
    const tid = s.teacher?._id?.toString() || s.teacher?.toString() || s.subject?.teachers?.[0]?._id?.toString() || s.subject?.teachers?.[0]?.toString()
    if (tid && teacherStatsMap[tid]) {
      teacherStatsMap[tid].sessions++
    }
  })

  allAttendance.forEach((r) => {
    const tid = r.teacher?._id?.toString() || r.teacher?.toString() || r.session?.teacher?._id?.toString() || r.subject?.teachers?.[0]?._id?.toString() || r.subject?.teachers?.[0]?.toString()
    if (tid && teacherStatsMap[tid]) {
      if (r.status === 'Present') teacherStatsMap[tid].present++
      else if (r.status === 'Late') teacherStatsMap[tid].late++
      else if (r.status === 'Absent') teacherStatsMap[tid].absent++
      teacherStatsMap[tid].totalMarks++
    }
  })

  const teacherSessions = Object.values(teacherStatsMap)
    .filter((t) => (!teacher || t.teacherId.toString() === teacher.toString()) && t.sessions > 0)
    .map((t) => {
      const attended = t.present + t.late
      return {
        teacher: t.name,
        employeeId: t.employeeId,
        department: t.department,
        sessionsConducted: t.sessions,
        totalMarks: t.totalMarks,
        present: t.present,
        late: t.late,
        absent: t.absent,
        percentage: t.totalMarks > 0 ? Math.round((attended / t.totalMarks) * 100) : null,
      }
    })
    .sort((a, b) => a.teacher.localeCompare(b.teacher))

  // 6. Daily Attendance Report
  const formatDateIST = (d) => {
    if (!d) return ''
    return new Date(d).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  }
  const selectedDateStr = date || (allSessions[0]?.date ? formatDateIST(allSessions[0].date) : formatDateIST(new Date()))
  const dailySessionsList = allSessions.filter((s) => {
    const sDate = formatDateIST(s.date)
    return !date || sDate === selectedDateStr
  })

  const sessionRecordsMap = {}
  allAttendance.forEach((r) => {
    if (!r.session) return
    const sId = r.session.toString()
    if (!sessionRecordsMap[sId]) sessionRecordsMap[sId] = { present: 0, late: 0, absent: 0, total: 0 }
    if (r.status === 'Present') sessionRecordsMap[sId].present++
    else if (r.status === 'Late') sessionRecordsMap[sId].late++
    else if (r.status === 'Absent') sessionRecordsMap[sId].absent++
    sessionRecordsMap[sId].total++
  })

  const dailyAttendance = dailySessionsList.map((s) => {
    const stats = sessionRecordsMap[s._id.toString()] || { present: 0, late: 0, absent: 0, total: 0 }
    const isFace = (s.detectedStudents && s.detectedStudents.length > 0)
    const attended = stats.present + stats.late
    const sDateStr = s.date ? formatDateIST(s.date) : '—'
    const sTeacher = s.teacher ? (s.teacher.user?.name || s.teacher.employeeId) : (s.subject?.teachers?.[0]?.user?.name || s.subject?.teachers?.[0]?.employeeId || '—')
    return {
      sessionId: s._id,
      date: sDateStr,
      period: s.period,
      department: canonicalDept(s.department || s.subject?.department || '—'),
      year: s.subject?.semester ? Math.ceil(s.subject.semester / 2) : 1,
      section: s.section || 'A',
      subject: s.subject ? { name: s.subject.name, code: s.subject.code } : { name: 'Unknown', code: '—' },
      teacher: sTeacher,
      totalStudents: stats.total,
      present: stats.present,
      late: stats.late,
      absent: stats.absent,
      percentage: stats.total > 0 ? Math.round((attended / stats.total) * 100) : null,
      method: isFace ? 'Face Recognition' : 'Manual',
      status: s.status,
    }
  })

  const reportingPeriod = startDate && endDate
    ? `${startDate} to ${endDate}`
    : startDate
    ? `From ${startDate}`
    : endDate
    ? `Up to ${endDate}`
    : 'All Time'

  res.json({
    success: true,
    data: {
      overall: {
        reportingPeriod,
        totalStudents: allStudents.length,
        totalSessions: allSessions.length,
        presentRecords,
        lateRecords,
        absentRecords,
        totalRecords: totalMarked,
        overallPercentage,
        lowAttendanceCount: lowAttendance.length,
        below60Count,
      },
      studentAttendance,
      departmentAttendance,
      subjectWise,
      teacherSessions,
      dailyAttendance,
      lowAttendance,
      methodAnalytics: {
        manualCount,
        faceCount,
        total: totalMarked,
        manualPercentage: totalMarked > 0 ? Math.round((manualCount / totalMarked) * 100) : 0,
        facePercentage: totalMarked > 0 ? Math.round((faceCount / totalMarked) * 100) : 0,
      },
      selectedDate: selectedDateStr,
      threshold: LOW_ATTENDANCE_THRESHOLD,
    },
  })
})

// GET /api/admin/reports/session/:id
export const getAdminReportSessionDetail = asyncHandler(async (req, res) => {
  const session = await AttendanceSession.findById(req.params.id)
    .populate('subject', 'name code department year')
    .populate({
      path: 'teacher',
      select: 'employeeId department user',
      populate: { path: 'user', select: 'name' },
    })
    .lean()

  if (!session) {
    res.status(404)
    throw new Error('Attendance session not found')
  }

  const records = await Attendance.find({ session: session._id })
    .populate({
      path: 'student',
      select: 'studentId rollNumber department year section user',
      populate: { path: 'user', select: 'name' },
    })
    .sort({ 'student.rollNumber': 1 })
    .lean()

  const studentsList = records.map((r) => ({
    _id: r._id,
    name: r.student?.user?.name || r.student?.studentId || 'Unknown',
    studentId: r.student?.studentId || '—',
    rollNumber: r.student?.rollNumber || '—',
    department: r.student?.department || '—',
    year: r.student?.year || '—',
    section: r.student?.section || '—',
    status: r.status,
    method: r.method,
    confidence: r.confidence ? Math.round(r.confidence * 100) : null,
    remarks: r.remarks || '—',
    markedAt: r.timestamp || r.createdAt,
  }))

  const present = studentsList.filter((s) => s.status === 'Present').length
  const late = studentsList.filter((s) => s.status === 'Late').length
  const absent = studentsList.filter((s) => s.status === 'Absent').length
  const total = studentsList.length
  const percentage = total > 0 ? Math.round(((present + late) / total) * 100) : null

  res.json({
    success: true,
    data: {
      session: {
        _id: session._id,
        date: session.date,
        period: session.period,
        department: session.department || session.subject?.department || '—',
        year: session.year || session.subject?.year || '—',
        section: session.section || 'A',
        subject: session.subject ? { name: session.subject.name, code: session.subject.code } : null,
        teacher: session.teacher ? (session.teacher.user?.name || session.teacher.employeeId) : '—',
        status: session.status,
      },
      summary: { present, late, absent, total, percentage },
      students: studentsList,
    },
  })
})

// GET /api/admin/reports/student/:id
export const getAdminReportStudentDetail = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.params.id)
    .populate('user', 'name email phone')
    .lean()

  if (!student) {
    res.status(404)
    throw new Error('Student not found')
  }

  const records = await Attendance.find({ student: student._id })
    .populate('subject', 'name code department year')
    .populate({
      path: 'teacher',
      select: 'employeeId user',
      populate: { path: 'user', select: 'name' },
    })
    .sort({ date: -1, period: -1 })
    .lean()

  const subjectStats = {}
  records.forEach((r) => {
    if (!r.subject) return
    const sid = r.subject._id.toString()
    if (!subjectStats[sid]) {
      subjectStats[sid] = {
        subject: { _id: r.subject._id, name: r.subject.name, code: r.subject.code },
        present: 0,
        late: 0,
        absent: 0,
        total: 0,
      }
    }
    const s = subjectStats[sid]
    if (r.status === 'Present') s.present++
    else if (r.status === 'Late') s.late++
    else if (r.status === 'Absent') s.absent++
    s.total++
  })

  const subjectBreakdown = Object.values(subjectStats).map((s) => {
    const attended = s.present + s.late
    const pct = s.total > 0 ? Math.round((attended / s.total) * 100) : null
    return {
      ...s,
      percentage: pct,
      isLow: isLowAttendance(pct ?? 0),
    }
  })

  const present = records.filter((r) => r.status === 'Present').length
  const late = records.filter((r) => r.status === 'Late').length
  const absent = records.filter((r) => r.status === 'Absent').length
  const total = records.length
  const overallPercentage = total > 0 ? Math.round(((present + late) / total) * 100) : null

  res.json({
    success: true,
    data: {
      student: {
        _id: student._id,
        name: student.user?.name || student.studentId,
        email: student.user?.email || '—',
        phone: student.user?.phone || student.phone || '—',
        studentId: student.studentId,
        rollNumber: student.rollNumber,
        department: student.department,
        section: student.section,
        year: student.year,
      },
      summary: {
        totalClasses: total,
        present,
        late,
        absent,
        percentage: overallPercentage,
        status: overallPercentage === null ? 'No Data' : overallPercentage >= LOW_ATTENDANCE_THRESHOLD ? 'Above 75%' : overallPercentage < 60 ? 'Critical (<60%)' : 'Below 75%',
      },
      subjectBreakdown,
      history: records.map((r) => ({
        _id: r._id,
        date: r.date,
        period: r.period,
        subject: r.subject ? { name: r.subject.name, code: r.subject.code } : null,
        teacher: r.teacher ? (r.teacher.user?.name || r.teacher.employeeId) : '—',
        status: r.status,
        method: r.method,
        confidence: r.confidence ? Math.round(r.confidence * 100) : null,
        markedAt: r.timestamp || r.createdAt,
      })),
    },
  })
})
