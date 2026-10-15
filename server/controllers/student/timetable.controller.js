import asyncHandler from '../../utils/asyncHandler.js'
import { Timetable, Subject, Classroom } from '../../models/index.js'
import { canonicalDepartment } from '../../utils/academicFilter.js'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// Helper to parse HH:MM to minutes from midnight
function timeToMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return 0
  const [h, m] = timeStr.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

// GET /api/student/timetable
// Scoped strictly to the authenticated student's course and section
export const getMyTimetable = asyncHandler(async (req, res) => {
  const student = req.student
  const { dayOfWeek, subject, classroom } = req.query

  const query = {
    course: student.course,
    isActive: true,
  }

  // If the timetable entry has a section, filter by the student's section
  // or allow entries that have no specific section assigned
  if (student.section) {
    query.$or = [
      { section: student.section },
      { section: { $exists: false } },
      { section: null },
      { section: '' },
    ]
  }

  if (dayOfWeek && DAYS.includes(dayOfWeek)) {
    query.dayOfWeek = dayOfWeek
  }

  if (subject) {
    query.subject = subject
  }

  if (classroom) {
    query.classroom = classroom
  }

  const entries = await Timetable.find(query)
    .populate('subject', 'name code department credits')
    .populate({
      path: 'teacher',
      select: 'employeeId user department',
      populate: { path: 'user', select: 'name email' },
    })
    .populate('classroom', 'name code building')
    .sort({ dayOfWeek: 1, startTime: 1 })
    .lean()

  // Format entries
  const formattedEntries = entries.map((e) => ({
    _id: e._id,
    dayOfWeek: e.dayOfWeek,
    startTime: e.startTime,
    endTime: e.endTime,
    period: e.period,
    semester: e.semester,
    academicYear: e.academicYear,
    section: e.section || student.section,
    subject: e.subject
      ? {
          _id: e.subject._id,
          name: e.subject.name,
          code: e.subject.code,
          department: canonicalDepartment(e.subject.department || student.department || 'CSE'),
        }
      : null,
    teacher: e.teacher
      ? {
          _id: e.teacher._id,
          name: e.teacher.user?.name || e.teacher.employeeId || 'Faculty',
          email: e.teacher.user?.email || '',
        }
      : null,
    classroom: e.classroom
      ? {
          _id: e.classroom._id,
          name: e.classroom.name,
          code: e.classroom.code,
          building: e.classroom.building || '',
        }
      : null,
  }))

  // Organize by Day for easy Weekly Grid display
  const weeklyGrid = {}
  DAYS.forEach((day) => {
    weeklyGrid[day] = formattedEntries
      .filter((e) => e.dayOfWeek === day)
      .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))
  })

  // Dropdown filter options derived from student's available timetable
  const allStudentEntries = await Timetable.find({
    course: student.course,
    isActive: true,
  })
    .populate('subject', 'name code')
    .populate('classroom', 'name code')
    .lean()

  const uniqueSubjects = []
  const subMap = new Set()
  allStudentEntries.forEach((e) => {
    if (e.subject && !subMap.has(e.subject._id.toString())) {
      subMap.add(e.subject._id.toString())
      uniqueSubjects.push({ _id: e.subject._id, name: e.subject.name, code: e.subject.code })
    }
  })

  const uniqueClassrooms = []
  const roomMap = new Set()
  allStudentEntries.forEach((e) => {
    if (e.classroom && !roomMap.has(e.classroom._id.toString())) {
      roomMap.add(e.classroom._id.toString())
      uniqueClassrooms.push({ _id: e.classroom._id, name: e.classroom.name, code: e.classroom.code })
    }
  })

  res.json({
    success: true,
    data: {
      items: formattedEntries,
      weeklyGrid,
      section: student.section,
      filterOptions: {
        days: DAYS,
        subjects: uniqueSubjects,
        classrooms: uniqueClassrooms,
      },
    },
  })
})

// GET /api/student/timetable/today
// Returns classes scheduled for the current day, along with Current and Next class indicators
export const getTodayTimetable = asyncHandler(async (req, res) => {
  const student = req.student

  // Determine current day in local context
  const now = new Date()
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const todayDayName = dayNames[now.getDay()]

  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  const query = {
    course: student.course,
    dayOfWeek: todayDayName,
    isActive: true,
  }

  if (student.section) {
    query.$or = [
      { section: student.section },
      { section: { $exists: false } },
      { section: null },
      { section: '' },
    ]
  }

  const entries = await Timetable.find(query)
    .populate('subject', 'name code')
    .populate({
      path: 'teacher',
      select: 'employeeId user',
      populate: { path: 'user', select: 'name email' },
    })
    .populate('classroom', 'name code building')
    .sort({ startTime: 1 })
    .lean()

  const formatted = entries
    .map((e) => ({
      _id: e._id,
      dayOfWeek: e.dayOfWeek,
      startTime: e.startTime,
      endTime: e.endTime,
      period: e.period,
      subject: e.subject
        ? { _id: e.subject._id, name: e.subject.name, code: e.subject.code }
        : null,
      teacher: e.teacher
        ? {
            _id: e.teacher._id,
            name: e.teacher.user?.name || e.teacher.employeeId || 'Faculty',
          }
        : null,
      classroom: e.classroom
        ? {
            _id: e.classroom._id,
            name: e.classroom.name,
            code: e.classroom.code,
            building: e.classroom.building || '',
          }
        : null,
    }))
    .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))

  // Find currently active class and upcoming next class
  let currentClass = null
  let nextClass = null

  for (const item of formatted) {
    const startM = timeToMinutes(item.startTime)
    const endM = timeToMinutes(item.endTime)

    if (currentMinutes >= startM && currentMinutes < endM) {
      currentClass = item
    } else if (currentMinutes < startM && !nextClass) {
      nextClass = item
    }
  }

  res.json({
    success: true,
    data: {
      day: todayDayName,
      currentTime: currentTimeStr,
      isWeekend: todayDayName === 'Sunday',
      classes: formatted,
      totalClasses: formatted.length,
      currentClass,
      nextClass,
    },
  })
})
