import asyncHandler from '../../utils/asyncHandler.js'
import {
  Student,
  Teacher,
  Subject,
  Attendance,
  AttendanceSession,
} from '../../models/index.js'
import { isLowAttendance, LOW_ATTENDANCE_THRESHOLD } from '../../utils/attendanceThreshold.js'
import { getDepartmentRegex } from '../../utils/academicFilter.js'
import { toExactRegex } from '../../utils/searchHelpers.js'

// GET /api/admin/analytics/overview
export const getAdminAnalyticsOverview = asyncHandler(async (req, res) => {
  const { range, department, year, section, subject, teacher, student, dateFrom, dateTo, startDate, endDate } = req.query

  let dateFilter = {}
  const from = dateFrom || startDate
  const to = dateTo || endDate

  if (from || to) {
    dateFilter.date = {}
    if (from) {
      dateFilter.date.$gte = new Date(from.includes('T') ? from : `${from}T00:00:00.000+05:30`)
    }
    if (to) {
      dateFilter.date.$lte = new Date(to.includes('T') ? to : `${to}T23:59:59.999+05:30`)
    }
  } else if (range === '7d') {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    d.setHours(0, 0, 0, 0)
    dateFilter = { date: { $gte: d } }
  } else if (range === '30d') {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    d.setHours(0, 0, 0, 0)
    dateFilter = { date: { $gte: d } }
  } else if (range === 'today') {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const end = new Date()
    end.setHours(23, 59, 59, 999)
    dateFilter = { date: { $gte: start, $lte: end } }
  }

  const [
    totalStudents,
    totalTeachers,
    totalSubjects,
    allAttendance,
    allSessions,
    subjects,
    teachers,
  ] = await Promise.all([
    Student.countDocuments({ isActive: true }),
    Teacher.countDocuments({ isActive: true }),
    Subject.countDocuments({ isActive: true }),
    Attendance.find(dateFilter)
      .populate('subject', 'name code department semester')
      .populate({
        path: 'student',
        select: 'studentId rollNumber department section year user',
        populate: { path: 'user', select: 'name' },
      })
      .lean(),
    AttendanceSession.find(dateFilter)
      .populate('subject', 'name code department semester teachers')
      .populate({
        path: 'teacher',
        select: 'employeeId department user',
        populate: { path: 'user', select: 'name' },
      })
      .lean(),
    Subject.find({ isActive: true }).select('name code department semester teachers').lean(),
    Teacher.find({ isActive: true }).populate('user', 'name').select('employeeId department user').lean(),
  ])

  // Filter attendance records and sessions according to active filters
  let filteredAttendance = allAttendance
  let filteredSessions = allSessions

  if (department) {
    const deptRegex = getDepartmentRegex(department)
    filteredAttendance = filteredAttendance.filter(
      (r) => deptRegex.test(r.department) || deptRegex.test(r.subject?.department) || deptRegex.test(r.student?.department),
    )
    filteredSessions = filteredSessions.filter(
      (s) => deptRegex.test(s.department) || deptRegex.test(s.subject?.department) || deptRegex.test(s.teacher?.department),
    )
  }

  if (section) {
    const secRegex = toExactRegex(section)
    filteredAttendance = filteredAttendance.filter(
      (r) => secRegex.test(r.section) || secRegex.test(r.student?.section),
    )
    filteredSessions = filteredSessions.filter(
      (s) => secRegex.test(s.section),
    )
  }

  if (subject) {
    const subStr = subject.toString()
    filteredAttendance = filteredAttendance.filter(
      (r) => (r.subject?._id?.toString() || r.subject?.toString()) === subStr,
    )
    filteredSessions = filteredSessions.filter(
      (s) => (s.subject?._id?.toString() || s.subject?.toString()) === subStr,
    )
  }

  if (teacher) {
    const teacherId = teacher.toString()
    filteredSessions = filteredSessions.filter((s) => {
      const directTeacher = (s.teacher?._id?.toString() || s.teacher?.toString()) === teacherId
      const subjectTeacher = s.subject?.teachers?.some((t) => (t._id?.toString() || t.toString()) === teacherId)
      return directTeacher || subjectTeacher
    })
    const teacherSessionIds = new Set(filteredSessions.map((s) => s._id.toString()))
    filteredAttendance = filteredAttendance.filter((r) => {
      const directTeacher = (r.teacher?._id?.toString() || r.teacher?.toString()) === teacherId
      const sessionTeacher = r.session && teacherSessionIds.has(r.session.toString())
      return directTeacher || sessionTeacher
    })
  }

  if (year) {
    const yrNum = typeof year === 'string' ? parseInt(year.replace(/\D/g, ''), 10) : Number(year)
    if (!isNaN(yrNum)) {
      filteredAttendance = filteredAttendance.filter((r) => {
        const studentYear = r.student?.year
        const subYear = r.subject?.semester ? Math.ceil(r.subject.semester / 2) : 1
        return studentYear === yrNum || subYear === yrNum
      })
      filteredSessions = filteredSessions.filter((s) => {
        const subYear = s.subject?.semester ? Math.ceil(s.subject.semester / 2) : 1
        return subYear === yrNum
      })
    }
  }

  if (student) {
    const studentStr = student.toString()
    filteredAttendance = filteredAttendance.filter(
      (r) => (r.student?._id?.toString() || r.student?.toString() || r.student?.studentId) === studentStr,
    )
    const studentSessionIds = new Set(filteredAttendance.map((r) => r.session?.toString()).filter(Boolean))
    filteredSessions = filteredSessions.filter((s) => studentSessionIds.has(s._id.toString()))
  }

  // 1. Core KPIs
  let presentCount = 0
  let lateCount = 0
  let absentCount = 0

  filteredAttendance.forEach((r) => {
    if (r.status === 'Present') presentCount++
    else if (r.status === 'Late') lateCount++
    else if (r.status === 'Absent') absentCount++
  })

  const totalMarked = presentCount + lateCount + absentCount
  // Attendance formula: (Present + Late) / Total Applicable Sessions * 100
  // Late counts as attended. If zero applicable sessions or zero marked: return null so UI displays N/A
  const overallPercentage = (totalMarked > 0 && filteredSessions.length > 0)
    ? Math.round(((presentCount + lateCount) / totalMarked) * 100)
    : null

  // 2. Attendance Trend over time
  const trendMap = {}
  filteredAttendance.forEach((r) => {
    if (!r.date) return
    const dStr = new Date(r.date).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
    if (!trendMap[dStr]) {
      trendMap[dStr] = { date: dStr, present: 0, late: 0, absent: 0, total: 0 }
    }
    const t = trendMap[dStr]
    if (r.status === 'Present') t.present++
    else if (r.status === 'Late') t.late++
    else if (r.status === 'Absent') t.absent++
    t.total++
  })

  const trend = Object.values(trendMap)
    .map((t) => ({
      date: t.date,
      present: t.present,
      late: t.late,
      absent: t.absent,
      total: t.total,
      percentage: t.total > 0 ? Math.round(((t.present + t.late) / t.total) * 100) : null,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))

  // 3. Department-wise Attendance
  const deptStats = {}
  filteredAttendance.forEach((r) => {
    let dept = r.department || r.subject?.department || r.student?.department
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
    totalRecords: d.total,
  }))

  let bestDepartment = 'N/A'
  let lowestDepartment = 'N/A'
  if (departmentWise.length > 0) {
    const sorted = [...departmentWise].filter((d) => d.percentage !== null).sort((a, b) => b.percentage - a.percentage)
    if (sorted.length > 0) {
      bestDepartment = `${sorted[0].department} (${sorted[0].percentage}%)`
      lowestDepartment = `${sorted[sorted.length - 1].department} (${sorted[sorted.length - 1].percentage}%)`
    }
  }

  // 4. Year-wise Attendance
  const yearStats = {
    1: { year: 'Year 1', present: 0, late: 0, absent: 0, total: 0 },
    2: { year: 'Year 2', present: 0, late: 0, absent: 0, total: 0 },
    3: { year: 'Year 3', present: 0, late: 0, absent: 0, total: 0 },
    4: { year: 'Year 4', present: 0, late: 0, absent: 0, total: 0 },
  }

  filteredAttendance.forEach((r) => {
    const yr = r.student?.year || (r.subject?.semester ? Math.ceil(r.subject.semester / 2) : 1)
    if (yearStats[yr]) {
      if (r.status === 'Present') yearStats[yr].present++
      else if (r.status === 'Late') yearStats[yr].late++
      else if (r.status === 'Absent') yearStats[yr].absent++
      yearStats[yr].total++
    }
  })

  const yearWise = Object.values(yearStats).map((y) => ({
    year: y.year,
    percentage: y.total > 0 ? Math.round(((y.present + y.late) / y.total) * 100) : null,
    totalRecords: y.total,
  }))

  // 5. Section-wise Attendance
  const sectionStats = {}
  filteredAttendance.forEach((r) => {
    const sec = r.section || r.student?.section || 'A'
    if (!sectionStats[sec]) {
      sectionStats[sec] = { section: `Section ${sec}`, present: 0, late: 0, absent: 0, total: 0 }
    }
    const s = sectionStats[sec]
    if (r.status === 'Present') s.present++
    else if (r.status === 'Late') s.late++
    else if (r.status === 'Absent') s.absent++
    s.total++
  })

  const sectionWise = Object.values(sectionStats).map((s) => ({
    section: s.section,
    percentage: s.total > 0 ? Math.round(((s.present + s.late) / s.total) * 100) : null,
    totalRecords: s.total,
  }))

  // 6. Subject-wise Attendance
  const activeDeptRegex = department ? getDepartmentRegex(department) : null
  const subjectStats = {}

  subjects.forEach((s) => {
    if (activeDeptRegex && !activeDeptRegex.test(s.department)) return
    if (year) {
      const yrNum = typeof year === 'string' ? parseInt(year.replace(/\D/g, ''), 10) : Number(year)
      if (!isNaN(yrNum)) {
        const subYr = s.semester ? Math.ceil(s.semester / 2) : 1
        if (subYr !== yrNum) return
      }
    }
    if (subject && s._id.toString() !== subject.toString()) return

    subjectStats[s._id.toString()] = {
      subject: { _id: s._id, name: s.name, code: s.code },
      present: 0,
      late: 0,
      absent: 0,
      total: 0,
    }
  })

  filteredAttendance.forEach((r) => {
    if (!r.subject) return
    const sId = r.subject._id ? r.subject._id.toString() : r.subject.toString()
    if (subjectStats[sId]) {
      const s = subjectStats[sId]
      if (r.status === 'Present') s.present++
      else if (r.status === 'Late') s.late++
      else if (r.status === 'Absent') s.absent++
      s.total++
    }
  })

  const subjectWise = Object.values(subjectStats).map((s) => ({
    ...s,
    percentage: s.total > 0 ? Math.round(((s.present + s.late) / s.total) * 100) : null,
  }))

  // 7. Student Attendance Distribution & Low Attendance Analysis
  const studentMap = {}
  filteredAttendance.forEach((r) => {
    if (!r.student) return
    const stId = r.student._id ? r.student._id.toString() : r.student.toString()
    if (!studentMap[stId]) {
      studentMap[stId] = {
        student: r.student,
        present: 0,
        late: 0,
        absent: 0,
        total: 0,
      }
    }
    const s = studentMap[stId]
    if (r.status === 'Present') s.present++
    else if (r.status === 'Late') s.late++
    else if (r.status === 'Absent') s.absent++
    s.total++
  })

  const studentDistribution = {
    excellent: 0, // 90-100%
    good: 0,      // 75-89%
    low: 0,       // 60-74%
    critical: 0,  // <60%
  }

  const lowAttendanceList = []
  Object.values(studentMap).forEach((st) => {
    const attended = st.present + st.late
    const percentage = st.total > 0 ? Math.round((attended / st.total) * 100) : null
    if (percentage !== null) {
      if (percentage >= 90) studentDistribution.excellent++
      else if (percentage >= 75) studentDistribution.good++
      else if (percentage >= 60) studentDistribution.low++
      else studentDistribution.critical++

      if (percentage < LOW_ATTENDANCE_THRESHOLD) {
        lowAttendanceList.push({
          _id: st.student._id,
          name: st.student.user?.name || st.student.studentId || 'Student',
          studentId: st.student.studentId,
          rollNumber: st.student.rollNumber,
          department: (/^(computer science|cse|c\.s\.e\.|cse department)$/i.test(st.student.department || '') ? 'CSE' : (st.student.department || '—')),
          section: st.student.section || '—',
          present: attended,
          absent: st.absent,
          total: st.total,
          percentage,
          isCritical: percentage < 60,
        })
      }
    }
  })
  lowAttendanceList.sort((a, b) => a.percentage - b.percentage)

  // 8. Teacher-wise Session Analytics (Descriptive only: NO ranking or best/worst labels)
  const teacherSessionMap = {}
  teachers.forEach((t) => {
    if (activeDeptRegex && !activeDeptRegex.test(t.department)) return
    if (teacher && t._id.toString() !== teacher.toString()) return

    teacherSessionMap[t._id.toString()] = {
      teacherId: t._id,
      name: t.user?.name || t.employeeId,
      employeeId: t.employeeId,
      department: (/^(computer science|cse|c\.s\.e\.|cse department)$/i.test(t.department || '') ? 'CSE' : (t.department || '—')),
      sessionsConducted: 0,
      recordsMarked: 0,
    }
  })

  filteredSessions.forEach((s) => {
    const tId = s.teacher?._id?.toString() || s.teacher?.toString() || s.subject?.teachers?.[0]?._id?.toString() || s.subject?.teachers?.[0]?.toString()
    if (tId && teacherSessionMap[tId]) {
      teacherSessionMap[tId].sessionsConducted++
    }
  })

  filteredAttendance.forEach((r) => {
    const tId = r.teacher?._id?.toString() || r.teacher?.toString() || r.session?.teacher?._id?.toString() || r.subject?.teachers?.[0]?._id?.toString() || r.subject?.teachers?.[0]?.toString()
    if (tId && teacherSessionMap[tId]) {
      teacherSessionMap[tId].recordsMarked++
    }
  })

  const teacherAnalytics = Object.values(teacherSessionMap)
    .filter((t) => t.sessionsConducted > 0)
    .sort((a, b) => b.sessionsConducted - a.sessionsConducted)

  res.json({
    success: true,
    data: {
      kpis: {
        totalStudents,
        totalTeachers,
        totalSubjects,
        overallPercentage,
        studentsBelowThreshold: lowAttendanceList.length,
        bestDepartment,
        lowestDepartment,
        totalSessions: filteredSessions.length,
        threshold: LOW_ATTENDANCE_THRESHOLD,
      },
      distribution: {
        present: presentCount,
        late: lateCount,
        absent: absentCount,
      },
      studentDistribution,
      trend,
      departmentWise,
      yearWise,
      sectionWise,
      subjectWise,
      lowAttendance: lowAttendanceList,
      teacherAnalytics,
    },
  })
})
