import asyncHandler from '../../utils/asyncHandler.js'
import {
  Student,
  Teacher,
  Subject,
  Course,
  Attendance,
  AttendanceSession,
  Announcement,
  FaceProfile,
} from '../../models/index.js'
import { LOW_ATTENDANCE_THRESHOLD } from '../../utils/attendanceThreshold.js'

// GET /api/admin/dashboard/stats
export const getDashboardStats = asyncHandler(async (req, res) => {
  const [
    studentsTotal,
    studentsActive,
    teachersTotal,
    teachersActive,
    subjectsTotal,
    subjectsActive,
    coursesTotal,
    coursesActive,
    allAttendance,
    recentSessions,
    recentAnnouncements,
    recentStudents,
    recentFaces,
  ] = await Promise.all([
    Student.countDocuments({}),
    Student.countDocuments({ isActive: true }),
    Teacher.countDocuments({}),
    Teacher.countDocuments({ isActive: true }),
    Subject.countDocuments({}),
    Subject.countDocuments({ isActive: true }),
    Course.countDocuments({}),
    Course.countDocuments({ isActive: true }),
    Attendance.find()
      .populate('subject', 'name code department')
      .populate({
        path: 'student',
        select: 'studentId rollNumber department section user',
        populate: { path: 'user', select: 'name' },
      })
      .lean(),
    AttendanceSession.find()
      .populate('subject', 'name code')
      .populate({ path: 'teacher', select: 'employeeId user', populate: { path: 'user', select: 'name' } })
      .sort({ createdAt: -1 })
      .limit(3)
      .lean(),
    Announcement.find({ isPublished: true })
      .sort({ publishedAt: -1, createdAt: -1 })
      .limit(3)
      .lean(),
    Student.find()
      .populate('user', 'name')
      .sort({ createdAt: -1 })
      .limit(3)
      .lean(),
    FaceProfile.find()
      .populate({ path: 'student', select: 'studentId rollNumber user', populate: { path: 'user', select: 'name' } })
      .sort({ createdAt: -1 })
      .limit(3)
      .lean(),
  ])

  // 1. Today's Attendance Overview
  const now = new Date()
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  let presentToday = 0
  let lateToday = 0
  let absentToday = 0

  allAttendance.forEach((r) => {
    if (!r.date) return
    const d = new Date(r.date)
    const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    if (dStr === todayStr) {
      if (r.status === 'Present') presentToday++
      else if (r.status === 'Late') lateToday++
      else if (r.status === 'Absent') absentToday++
    }
  })

  const totalToday = presentToday + lateToday + absentToday
  const todayPercentage = totalToday > 0 ? Math.round(((presentToday + lateToday) / totalToday) * 100) : null

  // 2. Attendance Trend (Last 7 days)
  const last7DaysMap = {}
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    last7DaysMap[key] = { date: key, label, present: 0, late: 0, absent: 0, total: 0 }
  }

  allAttendance.forEach((r) => {
    if (!r.date) return
    const d = new Date(r.date)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    if (last7DaysMap[key]) {
      if (r.status === 'Present') last7DaysMap[key].present++
      else if (r.status === 'Late') last7DaysMap[key].late++
      else if (r.status === 'Absent') last7DaysMap[key].absent++
      last7DaysMap[key].total++
    }
  })

  const trend = Object.values(last7DaysMap).map((item) => ({
    date: item.label,
    present: item.present,
    late: item.late,
    absent: item.absent,
    total: item.total,
    percentage: item.total > 0 ? Math.round(((item.present + item.late) / item.total) * 100) : null,
  }))

  // 3. Department-wise Attendance
  const deptStats = {}
  allAttendance.forEach((r) => {
    let dept = r.department || r.subject?.department || r.student?.department
    if (!dept) return
    dept = dept.trim()
    if (/^(computer science|cse|c\.s\.e\.|cse department)$/i.test(dept)) {
      dept = 'CSE'
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

  // 4. Attendance Alerts (<75% low, <60% critical)
  const studentMap = {}
  allAttendance.forEach((r) => {
    if (!r.student) return
    const sId = r.student._id ? r.student._id.toString() : r.student.toString()
    if (!studentMap[sId]) {
      studentMap[sId] = {
        student: r.student,
        present: 0,
        late: 0,
        absent: 0,
        total: 0,
      }
    }
    const s = studentMap[sId]
    if (r.status === 'Present') s.present++
    else if (r.status === 'Late') s.late++
    else if (r.status === 'Absent') s.absent++
    s.total++
  })

  const alerts = []
  Object.values(studentMap).forEach((st) => {
    if (st.total === 0) return
    const attended = st.present + st.late
    const pct = Math.round((attended / st.total) * 100)
    if (pct < LOW_ATTENDANCE_THRESHOLD) {
      alerts.push({
        _id: st.student._id,
        name: st.student.user?.name || st.student.studentId || 'Student',
        studentId: st.student.studentId,
        rollNumber: st.student.rollNumber,
        department: st.student.department || '—',
        section: st.student.section || '—',
        percentage: pct,
        isCritical: pct < 60,
      })
    }
  })
  alerts.sort((a, b) => a.percentage - b.percentage)

  // 5. Recent Activity (Real events from MongoDB, exactly 3)
  const activities = []

  recentSessions.forEach((s) => {
    const time = s.createdAt || s.date
    const teacherName = s.teacher?.user?.name || s.teacher?.employeeId || 'Teacher'
    activities.push({
      id: `session-${s._id}`,
      text: `Attendance session conducted for ${s.subject?.name || 'Class'} (${s.section || 'A'}) by ${teacherName}`,
      time,
      status: s.status || 'Completed',
      type: 'session',
    })
  })

  recentAnnouncements.forEach((a) => {
    const time = a.publishedAt || a.createdAt
    activities.push({
      id: `announcement-${a._id}`,
      text: `Official announcement published: "${a.title}"`,
      time,
      status: 'Published',
      type: 'announcement',
    })
  })

  recentStudents.forEach((st) => {
    if (st.createdAt) {
      activities.push({
        id: `student-${st._id}`,
        text: `New student registered: ${st.user?.name || st.studentId}`,
        time: st.createdAt,
        status: st.isActive ? 'Active' : 'Inactive',
        type: 'student',
      })
    }
  })

  recentFaces.forEach((f) => {
    if (f.createdAt) {
      activities.push({
        id: `face-${f._id}`,
        text: `Face profile registered for ${f.student?.user?.name || f.student?.studentId || 'Student'}`,
        time: f.createdAt,
        status: 'Verified',
        type: 'face',
      })
    }
  })

  activities.sort((a, b) => new Date(b.time) - new Date(a.time))
  const trimmedActivity = activities.slice(0, 3)

  res.json({
    success: true,
    data: {
      students: { total: studentsTotal, active: studentsActive },
      teachers: { total: teachersTotal, active: teachersActive },
      courses: { total: coursesTotal, active: coursesActive },
      subjects: { total: subjectsTotal, active: subjectsActive },
      todayAttendance: {
        present: presentToday,
        late: lateToday,
        absent: absentToday,
        total: totalToday,
        percentage: todayPercentage,
      },
      trend,
      departmentWise,
      alerts,
      recentActivity: trimmedActivity,
    },
  })
})
