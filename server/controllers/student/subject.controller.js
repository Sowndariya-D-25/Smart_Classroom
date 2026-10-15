import asyncHandler from '../../utils/asyncHandler.js'
import { Subject, AttendanceSession, Attendance, Timetable } from '../../models/index.js'
import { isLowAttendance, LOW_ATTENDANCE_THRESHOLD } from '../../utils/attendanceThreshold.js'
import { canonicalDepartment } from '../../utils/academicFilter.js'

// GET /api/student/subjects
// Returns all subjects assigned to the authenticated student's course,
// with calculated real attendance percentages and teacher details.
export const getMySubjects = asyncHandler(async (req, res) => {
  const student = req.student

  const subjects = await Subject.find({
    course: student.course,
    isActive: true,
  })
    .populate({
      path: 'teachers',
      select: 'employeeId user department',
      populate: { path: 'user', select: 'name email' },
    })
    .populate('course', 'name code')
    .sort({ semester: 1, name: 1 })
    .lean()

  // Get classroom information from timetable for student's section
  const timetables = await Timetable.find({
    course: student.course,
    section: student.section,
    isActive: true,
  })
    .populate('classroom', 'name code building')
    .lean()

  const classroomBySubject = {}
  timetables.forEach((t) => {
    if (t.subject && t.classroom) {
      classroomBySubject[t.subject.toString()] = t.classroom
    }
  })

  // Calculate real attendance for each subject
  const subjectList = await Promise.all(
    subjects.map(async (subj) => {
      const [totalConducted, attended, absent] = await Promise.all([
        AttendanceSession.countDocuments({ subject: subj._id, status: 'Completed' }),
        Attendance.countDocuments({
          subject: subj._id,
          student: student._id,
          status: { $in: ['Present', 'Late'] },
        }),
        Attendance.countDocuments({
          subject: subj._id,
          student: student._id,
          status: 'Absent',
        }),
      ])

      const percentage =
        totalConducted > 0 ? Math.round((attended / totalConducted) * 100) : null
      const isLow = isLowAttendance(percentage)

      const teacherList = (subj.teachers || []).map((t) => ({
        _id: t._id,
        name: t.user?.name || t.employeeId || 'Faculty',
        email: t.user?.email || '',
        department: t.department || '',
      }))

      return {
        _id: subj._id,
        name: subj.name,
        code: subj.code,
        description: subj.description || '',
        credits: subj.credits,
        semester: subj.semester,
        department: canonicalDepartment(subj.department || student.department || 'CSE'),
        section: student.section,
        teachers: teacherList,
        primaryTeacher: teacherList[0] || null,
        classroom: classroomBySubject[subj._id.toString()] || null,
        totalConducted,
        attended,
        absent,
        percentage,
        isLow,
        status:
          percentage === null
            ? 'No Classes Held'
            : percentage >= LOW_ATTENDANCE_THRESHOLD
              ? 'Good'
              : 'Low Attendance',
      }
    }),
  )

  res.json({
    success: true,
    data: {
      threshold: LOW_ATTENDANCE_THRESHOLD,
      course: student.course,
      section: student.section,
      department: student.department,
      subjects: subjectList,
    },
  })
})

// GET /api/student/subjects/:id
// Returns detailed performance and recent attendance history for a single subject.
// Security: Verifies the subject belongs to the student's enrolled course.
export const getMySubjectDetail = asyncHandler(async (req, res) => {
  const student = req.student
  const subjectId = req.params.id

  const subject = await Subject.findById(subjectId)
    .populate({
      path: 'teachers',
      select: 'employeeId user department',
      populate: { path: 'user', select: 'name email phone' },
    })
    .populate('course', 'name code department')
    .lean()

  if (!subject) {
    res.status(404)
    throw new Error('Subject not found')
  }

  // Security authorization check: Verify the subject belongs to student's course
  if (subject.course && student.course) {
    const courseId = subject.course._id ? subject.course._id.toString() : subject.course.toString()
    const studentCourseId = student.course._id ? student.course._id.toString() : student.course.toString()
    if (courseId !== studentCourseId) {
      res.status(403)
      throw new Error('You are not authorized to view subjects from another course')
    }
  }

  // Calculate student attendance for this subject
  const [totalConducted, attended, absent, records] = await Promise.all([
    AttendanceSession.countDocuments({ subject: subject._id, status: 'Completed' }),
    Attendance.countDocuments({
      subject: subject._id,
      student: student._id,
      status: { $in: ['Present', 'Late'] },
    }),
    Attendance.countDocuments({
      subject: subject._id,
      student: student._id,
      status: 'Absent',
    }),
    Attendance.find({ subject: subject._id, student: student._id })
      .populate('classroom', 'name code building')
      .populate({
        path: 'teacher',
        select: 'employeeId user',
        populate: { path: 'user', select: 'name' },
      })
      .select('date period status method confidence timestamp classroom teacher')
      .sort({ date: -1, period: -1 })
      .limit(30)
      .lean(),
  ])

  const percentage =
    totalConducted > 0 ? Math.round((attended / totalConducted) * 100) : null
  const isLow = isLowAttendance(percentage)

  const history = records.map((r) => ({
    _id: r._id,
    date: r.date,
    period: r.period,
    status: r.status,
    method: r.method,
    confidence: r.confidence ? Math.round(r.confidence * 100) : null,
    classroom: r.classroom ? `${r.classroom.name} (${r.classroom.code})` : '—',
    teacher: r.teacher?.user?.name || r.teacher?.employeeId || '—',
    timestamp: r.timestamp || r.createdAt,
  }))

  res.json({
    success: true,
    data: {
      subject: {
        _id: subject._id,
        name: subject.name,
        code: subject.code,
        description: subject.description,
        credits: subject.credits,
        semester: subject.semester,
        department: subject.department,
        teachers: subject.teachers,
        course: subject.course,
      },
      stats: {
        totalConducted,
        attended,
        absent,
        percentage,
        isLow,
        status:
          percentage === null
            ? 'No Classes'
            : percentage >= LOW_ATTENDANCE_THRESHOLD
              ? 'Safe'
              : 'Low Attendance',
        threshold: LOW_ATTENDANCE_THRESHOLD,
      },
      history,
    },
  })
})
