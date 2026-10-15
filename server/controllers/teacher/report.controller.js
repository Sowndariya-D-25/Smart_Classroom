import asyncHandler from '../../utils/asyncHandler.js'
import { isLowAttendance, LOW_ATTENDANCE_THRESHOLD } from '../../utils/attendanceThreshold.js'
import { Subject, AttendanceSession, Attendance, Classroom, Student, Timetable } from '../../models/index.js'
import { canonicalDepartment, getDepartmentRegex } from '../../utils/academicFilter.js'
import { toExactRegex } from '../../utils/searchHelpers.js'
import teacherCanAccessStudent from '../../utils/teacherAccess.js'
import { loadOwnedSession, getRoster } from './attendance.controller.js'

// GET /api/teacher/reports/filter-options
export const getFilterOptions = asyncHandler(async (req, res) => {
  const teacherId = req.teacher._id

  // 1. Teacher's active subjects
  const subjects = await Subject.find({ teachers: teacherId, isActive: true })
    .populate('course', 'name code department')
    .select('name code department course')

  const subjectIds = subjects.map((s) => s._id)
  const courseIds = subjects.map((s) => s.course?._id).filter(Boolean)

  // 2. Classrooms
  const classrooms = await Classroom.find({ isActive: true }).select('name code building').sort({ name: 1 })

  // 3. Students belonging to the courses taught by this teacher
  const students = await Student.find({ course: { $in: courseIds }, isActive: true })
    .populate('user', 'name email')
    .select('studentId rollNumber department section user course')
    .sort({ rollNumber: 1 })

  // Extract canonical distinct departments & sections from subjects & students
  const rawDepartments = [
    ...subjects.map((s) => s.department),
    ...subjects.map((s) => s.course?.department),
    ...students.map((st) => st.department),
  ].filter(Boolean)

  const departments = Array.from(
    new Set(rawDepartments.map(canonicalDepartment).filter(Boolean)),
  ).sort()

  const sections = Array.from(
    new Set([
      ...students.map((st) => st.section).filter(Boolean),
    ]),
  ).sort()

  res.json({
    success: true,
    data: {
      subjects: subjects.map((s) => ({
        _id: s._id,
        name: s.name,
        code: s.code,
        department: canonicalDepartment(s.department || s.course?.department),
      })),
      classrooms: classrooms.map((c) => ({ _id: c._id, name: c.name, code: c.code, building: c.building })),
      departments,
      sections,
      students: students.map((st) => ({
        _id: st._id,
        name: st.user?.name || st.studentId,
        studentId: st.studentId,
        rollNumber: st.rollNumber,
        department: canonicalDepartment(st.department),
        section: st.section,
      })),
    },
  })
})

// GET /api/teacher/reports
export const getAttendanceReport = asyncHandler(async (req, res) => {
  const teacherId = req.teacher._id
  const { department, section, classroom, subject, student, startDate, endDate, date } = req.query

  // Teacher's subjects
  const subjectQuery = { teachers: teacherId, isActive: true }
  if (subject) {
    subjectQuery._id = subject
  }
  const teacherSubjects = await Subject.find(subjectQuery).populate('course', 'name code department')
  if (teacherSubjects.length === 0) {
    return res.json({
      success: true,
      data: {
        kpis: { totalStudents: 0, averageAttendance: null, presentToday: 0, absentToday: 0, lowAttendanceCount: 0 },
        todaySummary: { present: 0, absent: 0, total: 0, percentage: null },
        subjectWise: [],
        dailySessions: [],
        studentAttendance: [],
        lowAttendance: [],
        methodAnalytics: { faceCount: 0, manualCount: 0, facePercentage: 0, manualPercentage: 0, totalRecords: 0 },
        faceSummary: { faceSessionsCount: 0, studentsRecognized: 0, studentsNotRecognized: 0, unknownFacesCount: 0 },
        trend: [],
        selectedDate: date || new Date().toISOString().split('T')[0],
      },
    })
  }

  const deptRegex = department ? getDepartmentRegex(department) : null

  // Filter subjects matching department if department filter provided
  const filteredTeacherSubjects = deptRegex
    ? teacherSubjects.filter((s) => {
        const sDept = canonicalDepartment(s.department)
        const cDept = canonicalDepartment(s.course?.department)
        return deptRegex.test(sDept) || deptRegex.test(cDept)
      })
    : teacherSubjects

  const subjectIds = filteredTeacherSubjects.map((s) => s._id)
  const courseIds = filteredTeacherSubjects.map((s) => s.course?._id).filter(Boolean)

  // Build match query for Attendance records
  const attMatch = {
    teacher: teacherId,
    subject: { $in: subjectIds },
  }
  if (classroom) attMatch.classroom = classroom
  if (deptRegex) {
    attMatch.$or = [
      { department: deptRegex },
      { department: { $exists: false } },
      { department: null },
      { department: '' },
    ]
  }
  if (section) attMatch.section = toExactRegex(section)
  if (student) attMatch.student = student

  if (startDate || endDate) {
    attMatch.date = {}
    if (startDate) attMatch.date.$gte = new Date(startDate + 'T00:00:00.000Z')
    if (endDate) attMatch.date.$lte = new Date(endDate + 'T23:59:59.999Z')
  }

  // Build match query for AttendanceSession
  const sessMatch = {
    teacher: teacherId,
    subject: { $in: subjectIds },
  }
  if (classroom) sessMatch.classroom = classroom
  if (deptRegex) {
    sessMatch.$or = [
      { department: deptRegex },
      { department: { $exists: false } },
      { department: null },
      { department: '' },
    ]
  }
  if (section) sessMatch.section = toExactRegex(section)
  if (startDate || endDate) {
    sessMatch.date = {}
    if (startDate) sessMatch.date.$gte = new Date(startDate + 'T00:00:00.000Z')
    if (endDate) sessMatch.date.$lte = new Date(endDate + 'T23:59:59.999Z')
  }

  // 1. Fetch matching Attendance records, AttendanceSessions, Rosters, and Timetables
  const [attendanceRecords, sessions, allRosters, timetables] = await Promise.all([
    Attendance.find(attMatch)
      .populate('student', 'studentId rollNumber department section user')
      .populate('subject', 'name code department')
      .lean(),
    AttendanceSession.find(sessMatch)
      .populate('subject', 'name code department course')
      .populate('classroom', 'name code building')
      .sort({ date: -1, period: 1 })
      .lean(),
    Promise.all(filteredTeacherSubjects.map((s) => getRoster(s.course?._id, { department, section }))),
    Timetable.find({ subject: { $in: subjectIds } }).select('subject period section').lean(),
  ])

  const ttSectionMap = new Map()
  timetables.forEach((t) => {
    if (t.subject && t.period && t.section) {
      ttSectionMap.set(`${t.subject.toString()}-${t.period}`, t.section)
    }
  })

  // Aggregate roster students
  const rosterStudentMap = new Map()
  filteredTeacherSubjects.forEach((sub, idx) => {
    const r = allRosters[idx] || []
    r.forEach((st) => {
      if (student && !st._id.equals(student)) return
      if (!rosterStudentMap.has(st._id.toString())) {
        rosterStudentMap.set(st._id.toString(), {
          _id: st._id,
          name: st.user?.name || st.studentId,
          studentId: st.studentId,
          rollNumber: st.rollNumber,
          department: canonicalDepartment(st.department),
          section: st.section,
          enrolledSubjects: new Set(),
        })
      }
      rosterStudentMap.get(st._id.toString()).enrolledSubjects.add(sub._id.toString())
    })
  })

  // 2. Attendance Method Analytics (Face Recognition vs Manual)
  let faceCount = 0
  let manualCount = 0
  attendanceRecords.forEach((r) => {
    if (r.method === 'Face Recognition' || r.method === 'FACE') {
      faceCount += 1
    } else {
      manualCount += 1
    }
  })
  const totalRecords = faceCount + manualCount
  const methodAnalytics = {
    faceCount,
    manualCount,
    totalRecords,
    facePercentage: totalRecords > 0 ? Math.round((faceCount / totalRecords) * 100) : 0,
    manualPercentage: totalRecords > 0 ? Math.round((manualCount / totalRecords) * 100) : 0,
  }

  // 3. Face Recognition Analytics
  const completedSessions = sessions.filter((s) => s.status === 'Completed')
  let faceSessionsCount = 0
  let studentsRecognized = 0
  let unknownFacesCount = 0
  let studentsNotRecognized = 0

  completedSessions.forEach((s) => {
    const isFaceSession = (s.detectedStudents && s.detectedStudents.length > 0) || (s.unknownFaces && s.unknownFaces.length > 0)
    if (isFaceSession) {
      faceSessionsCount += 1
      studentsRecognized += s.detectedStudents?.length || 0
      if (Array.isArray(s.unknownFaces)) {
        unknownFacesCount += s.unknownFaces.reduce((sum, u) => sum + (u.count || 1), 0)
      }
    }
  })

  // Unrecognized faces are absent records from face-based sessions marked "Not detected"
  attendanceRecords.forEach((r) => {
    if ((r.method === 'Face Recognition' || r.method === 'FACE') && r.status === 'Absent') {
      studentsNotRecognized += 1
    }
  })

  const faceSummary = {
    faceSessionsCount,
    studentsRecognized,
    studentsNotRecognized,
    unknownFacesCount,
  }

  // 4. Today's Attendance Summary
  const now = new Date()
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const todayRecords = attendanceRecords.filter((r) => {
    const d = new Date(r.date)
    const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    return dStr === todayStr
  })
  const presentToday = todayRecords.filter((r) => r.status === 'Present' || r.status === 'Late').length
  const absentToday = todayRecords.filter((r) => r.status === 'Absent').length
  const todayTotal = presentToday + absentToday
  const todayPercentage = todayTotal > 0 ? Math.round((presentToday / todayTotal) * 100) : null
  const todaySummary = {
    present: presentToday,
    absent: absentToday,
    total: todayTotal,
    percentage: todayPercentage,
  }

  // 5. Subject-Wise Attendance Report
  const subjectSessionsMap = {}
  completedSessions.forEach((s) => {
    const sid = s.subject._id.toString()
    subjectSessionsMap[sid] = (subjectSessionsMap[sid] || 0) + 1
  })

  const subjectWise = filteredTeacherSubjects.map((subj) => {
    const sid = subj._id.toString()
    const subjRecords = attendanceRecords.filter((r) => r.subject?._id?.toString() === sid || r.subject?.toString() === sid)
    const present = subjRecords.filter((r) => r.status === 'Present').length
    const late = subjRecords.filter((r) => r.status === 'Late').length
    const absent = subjRecords.filter((r) => r.status === 'Absent').length
    const total = present + late + absent
    const percentage = total > 0 ? Math.round(((present + late) / total) * 100) : null

    return {
      subject: { _id: subj._id, name: subj.name, code: subj.code, department: canonicalDepartment(subj.department || subj.course?.department) },
      totalSessions: subjectSessionsMap[sid] || 0,
      present: present + late,
      absent,
      late,
      percentage,
    }
  })

  // 6. Student-Wise Attendance Report & Low Attendance (<75%)
  const studentStatsMap = {}
  attendanceRecords.forEach((r) => {
    if (!r.student) return
    const stId = r.student._id ? r.student._id.toString() : r.student.toString()
    const sId = r.subject ? (r.subject._id ? r.subject._id.toString() : r.subject.toString()) : ''
    if (!studentStatsMap[stId]) {
      studentStatsMap[stId] = { present: 0, late: 0, absent: 0, total: 0, bySubject: {} }
    }
    const entry = studentStatsMap[stId]
    if (r.status === 'Present') entry.present += 1
    else if (r.status === 'Late') entry.late += 1
    else if (r.status === 'Absent') entry.absent += 1
    entry.total += 1

    if (sId) {
      if (!entry.bySubject[sId]) {
        entry.bySubject[sId] = { present: 0, late: 0, absent: 0, total: 0 }
      }
      const sEntry = entry.bySubject[sId]
      if (r.status === 'Present') sEntry.present += 1
      else if (r.status === 'Late') sEntry.late += 1
      else if (r.status === 'Absent') sEntry.absent += 1
      sEntry.total += 1
    }
  })

  const studentAttendance = []
  const lowAttendance = []

  rosterStudentMap.forEach((st, stId) => {
    const stats = studentStatsMap[stId] || { present: 0, late: 0, absent: 0, total: 0, bySubject: {} }
    const attended = stats.present + stats.late
    const totalClasses = stats.total
    const percentage = totalClasses > 0 ? Math.round((attended / totalClasses) * 100) : null
    const isLow = isLowAttendance(percentage)

    // Build subject-wise breakdown for this student
    const subjectBreakdown = []
    filteredTeacherSubjects.forEach((sub) => {
      const sid = sub._id.toString()
      if (st.enrolledSubjects.has(sid)) {
        const subStat = stats.bySubject[sid] || { present: 0, late: 0, absent: 0, total: 0 }
        const subAttended = subStat.present + subStat.late
        const subTotal = subStat.total
        const subPercentage = subTotal > 0 ? Math.round((subAttended / subTotal) * 100) : null
        subjectBreakdown.push({
          subject: { _id: sub._id, name: sub.name, code: sub.code },
          totalClasses: subTotal,
          present: subStat.present,
          late: subStat.late,
          absent: subStat.absent,
          percentage: subPercentage,
          isLow: isLowAttendance(subPercentage),
        })

        if (subPercentage !== null && subPercentage < LOW_ATTENDANCE_THRESHOLD) {
          lowAttendance.push({
            student: { _id: st._id, name: st.name, studentId: st.studentId, rollNumber: st.rollNumber },
            subject: { _id: sub._id, name: sub.name, code: sub.code },
            percentage: subPercentage,
            present: subAttended,
            absent: subStat.absent,
            totalClasses: subTotal,
          })
        }
      }
    })

    studentAttendance.push({
      student: {
        _id: st._id,
        name: st.name,
        studentId: st.studentId,
        rollNumber: st.rollNumber,
        department: st.department,
        section: st.section,
      },
      totalClasses,
      present: stats.present,
      late: stats.late,
      absent: stats.absent,
      percentage,
      isLow,
      status: percentage === null ? 'No Data' : percentage >= LOW_ATTENDANCE_THRESHOLD ? 'Above 75%' : 'Below 75%',
      subjectBreakdown,
    })
  })

  // Sort low attendance lowest percentage first
  lowAttendance.sort((a, b) => (a.percentage ?? 0) - (b.percentage ?? 0))
  // Sort student attendance by roll number
  studentAttendance.sort((a, b) => (a.student.rollNumber || '').localeCompare(b.student.rollNumber || ''))

  // 7. Daily Attendance Report
  // Default selected date to filter's `date` or today or latest session date
  const targetDateStr = date || (sessions[0]?.date ? new Date(sessions[0].date).toISOString().split('T')[0] : todayStr)
  const dailySessionsList = sessions.filter((s) => {
    const sDateStr = new Date(s.date).toISOString().split('T')[0]
    return sDateStr === targetDateStr
  })

  const dailySessions = dailySessionsList.map((sess) => {
    const sessRecords = attendanceRecords.filter((r) => r.session?.toString() === sess._id.toString())
    const present = sessRecords.filter((r) => r.status === 'Present').length
    const late = sessRecords.filter((r) => r.status === 'Late').length
    const absent = sessRecords.filter((r) => r.status === 'Absent').length
    const total = present + late + absent
    const percentage = total > 0 ? Math.round(((present + late) / total) * 100) : 0
    const method = sess.detectedStudents?.length > 0 ? 'Face Recognition' : 'Manual'

    // Resolve section from AttendanceSession, linked student attendance records, or Timetable
    const recordWithSection = sessRecords.find((r) => r.student?.section)
    const resolvedSection =
      sess.section ||
      recordWithSection?.student?.section ||
      ttSectionMap.get(`${sess.subject?._id?.toString()}-${sess.period}`) ||
      ''

    return {
      sessionId: sess._id,
      period: sess.period,
      subject: { _id: sess.subject._id, name: sess.subject.name, code: sess.subject.code },
      department: canonicalDepartment(sess.department || sess.subject?.department || sess.subject?.course?.department || 'CSE'),
      section: resolvedSection,
      classroom: sess.classroom ? { name: sess.classroom.name, code: sess.classroom.code } : null,
      startTime: sess.startTime || '—',
      endTime: sess.endTime || '—',
      present: present + late,
      absent,
      late,
      total,
      percentage,
      method,
      status: sess.status,
      date: targetDateStr,
    }
  })

  // 8. Attendance Trend Over Time
  const trendMap = {}
  attendanceRecords.forEach((r) => {
    const dStr = new Date(r.date).toISOString().split('T')[0]
    if (!trendMap[dStr]) {
      trendMap[dStr] = { date: dStr, present: 0, late: 0, absent: 0, total: 0 }
    }
    const t = trendMap[dStr]
    if (r.status === 'Present') t.present += 1
    else if (r.status === 'Late') t.late += 1
    else if (r.status === 'Absent') t.absent += 1
    t.total += 1
  })

  const trend = Object.values(trendMap)
    .map((d) => ({
      date: d.date,
      present: d.present,
      late: d.late,
      absent: d.absent,
      total: d.total,
      percentage: d.total > 0 ? Math.round(((d.present + d.late) / d.total) * 100) : null,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))

  // 9. Overall KPIs
  const allPresent = attendanceRecords.filter((r) => r.status === 'Present' || r.status === 'Late').length
  const allTotal = attendanceRecords.length
  const averageAttendance = allTotal > 0 ? Math.round((allPresent / allTotal) * 100) : null

  res.json({
    success: true,
    data: {
      kpis: {
        totalStudents: rosterStudentMap.size,
        averageAttendance,
        presentToday,
        absentToday,
        lowAttendanceCount: new Set(lowAttendance.map((item) => item.student._id.toString())).size,
      },
      todaySummary,
      subjectWise,
      dailySessions,
      studentAttendance,
      lowAttendance,
      methodAnalytics,
      faceSummary,
      trend,
      selectedDate: targetDateStr,
      threshold: LOW_ATTENDANCE_THRESHOLD,
    },
  })
})

// GET /api/teacher/reports/session/:id
export const getDailySessionDetail = asyncHandler(async (req, res) => {
  const session = await loadOwnedSession(req.params.id, req.teacher._id)
  if (!session) {
    res.status(404)
    throw new Error('Attendance session not found')
  }

  const [roster, records] = await Promise.all([
    getRoster(session.subject.course?._id, { department: session.department, section: session.section }),
    Attendance.find({ session: session._id })
      .populate('student', 'studentId rollNumber department section user')
      .lean(),
  ])

  const recordsByStudent = {}
  records.forEach((r) => {
    const stId = r.student?._id ? r.student._id.toString() : r.student?.toString()
    if (stId) recordsByStudent[stId] = r
  })

  const studentsList = roster.map((s) => {
    const mark = recordsByStudent[s._id.toString()]
    return {
      _id: s._id,
      name: s.user?.name || s.studentId,
      studentId: s.studentId,
      rollNumber: s.rollNumber,
      department: canonicalDepartment(s.department),
      section: s.section,
      status: mark ? mark.status : 'Absent',
      method: mark ? mark.method : '—',
      confidence: mark?.confidence ? Math.round(mark.confidence * 100) : null,
      remarks: mark?.remarks || '—',
      timestamp: mark?.timestamp || null,
    }
  })

  const present = studentsList.filter((s) => s.status === 'Present').length
  const late = studentsList.filter((s) => s.status === 'Late').length
  const absent = studentsList.filter((s) => s.status === 'Absent').length
  const total = studentsList.length
  const percentage = total > 0 ? Math.round(((present + late) / total) * 100) : 0

  res.json({
    success: true,
    data: {
      session: {
        _id: session._id,
        subject: session.subject,
        classroom: session.classroom,
        department: canonicalDepartment(session.department || session.subject?.department),
        section: session.section || records.find((r) => r.student?.section)?.student?.section || '',
        date: session.date,
        period: session.period,
        startTime: session.startTime,
        endTime: session.endTime,
        status: session.status,
      },
      summary: { present: present + late, late, absent, total, percentage },
      students: studentsList,
    },
  })
})

// GET /api/teacher/reports/student/:id
export const getStudentDetailReport = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.params.id).populate('user', 'name email phone').populate('course', 'name code')
  if (!student) {
    res.status(404)
    throw new Error('Student not found')
  }

  const hasAccess = await teacherCanAccessStudent(req.teacher._id, student)
  if (!hasAccess) {
    res.status(403)
    throw new Error('You do not have access to view this student')
  }

  const teacherSubjects = await Subject.find({ teachers: req.teacher._id, isActive: true })
  const subjectIds = teacherSubjects.map((s) => s._id)

  const records = await Attendance.find({
    student: student._id,
    teacher: req.teacher._id,
    subject: { $in: subjectIds },
  })
    .populate('subject', 'name code')
    .populate('classroom', 'name')
    .sort({ date: -1, period: -1 })
    .lean()

  const subjectStats = {}
  teacherSubjects.forEach((sub) => {
    subjectStats[sub._id.toString()] = {
      subject: { _id: sub._id, name: sub.name, code: sub.code },
      present: 0,
      late: 0,
      absent: 0,
      total: 0,
    }
  })

  records.forEach((r) => {
    const sid = r.subject?._id?.toString() || r.subject?.toString()
    if (subjectStats[sid]) {
      const s = subjectStats[sid]
      if (r.status === 'Present') s.present += 1
      else if (r.status === 'Late') s.late += 1
      else if (r.status === 'Absent') s.absent += 1
      s.total += 1
    }
  })

  const subjectBreakdown = Object.values(subjectStats).map((s) => ({
    ...s,
    percentage: s.total > 0 ? Math.round(((s.present + s.late) / s.total) * 100) : null,
    isLow: isLowAttendance(s.total > 0 ? Math.round(((s.present + s.late) / s.total) * 100) : null),
  }))

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
        department: canonicalDepartment(student.department),
        section: student.section,
        year: student.year,
        course: student.course,
      },
      summary: {
        totalClasses: total,
        present: present + late,
        late,
        absent,
        percentage: overallPercentage,
        isLow: isLowAttendance(overallPercentage),
        status: overallPercentage === null ? 'No Data' : overallPercentage >= LOW_ATTENDANCE_THRESHOLD ? 'Above 75%' : 'Below 75%',
      },
      subjectBreakdown,
      history: records.map((r) => ({
        _id: r._id,
        date: r.date,
        period: r.period,
        subject: r.subject,
        classroom: r.classroom?.name || '—',
        status: r.status,
        method: r.method,
        confidence: r.confidence ? Math.round(r.confidence * 100) : null,
        remarks: r.remarks || '—',
      })),
    },
  })
})
