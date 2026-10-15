import asyncHandler from '../../utils/asyncHandler.js'
import { Timetable, Subject, Teacher, Classroom, Course, Student } from '../../models/index.js'

const POPULATE_FIELDS = [
  { path: 'subject', select: 'name code department course semester' },
  { path: 'teacher', select: 'employeeId department user', populate: { path: 'user', select: 'name email phone' } },
  { path: 'classroom', select: 'name code building capacity' },
  { path: 'course', select: 'name code department' },
]

/**
 * Checks for schedule overlaps:
 * Returns an error message if there is a conflict, or null if clear.
 */
export async function checkTimetableConflict({
  dayOfWeek,
  startTime,
  endTime,
  period,
  academicYear,
  teacherId,
  classroomId,
  courseId,
  semester,
  section,
  subjectId,
  excludeId = null,
}) {
  const query = {
    dayOfWeek,
    academicYear,
    isActive: true,
    $or: [
      { startTime: { $lt: endTime }, endTime: { $gt: startTime } },
      ...(period ? [{ period: Number(period) }] : []),
    ],
  }
  if (excludeId) {
    query._id = { $ne: excludeId }
  }

  const overlapping = await Timetable.find(query)
    .populate('subject', 'name code')
    .populate({
      path: 'teacher',
      select: 'employeeId user',
      populate: { path: 'user', select: 'name' },
    })
    .populate('classroom', 'name code')
    .lean()

  for (const entry of overlapping) {
    // 1. Same teacher conflict
    if (entry.teacher && entry.teacher._id.toString() === teacherId.toString()) {
      const teacherName = entry.teacher.user?.name || 'This teacher'
      const subjectName = entry.subject?.name || 'another class'
      return `Teacher conflict: ${teacherName} is already scheduled for ${subjectName} on ${dayOfWeek} (Period ${entry.period || 'current'}, ${entry.startTime} to ${entry.endTime}).`
    }

    // 2. Same section conflict
    if (
      entry.semester === Number(semester) &&
      entry.section?.toUpperCase() === section?.toUpperCase()
    ) {
      // Duplicate timetable check
      if (subjectId && entry.subject && entry.subject._id.toString() === subjectId.toString()) {
        return `Duplicate timetable: An entry for ${entry.subject?.name || 'this subject'} already exists for Section ${section} on ${dayOfWeek} (Period ${entry.period || 'current'}).`
      }
      const subjectName = entry.subject?.name || 'another subject'
      return `Section conflict: Section ${section} (Semester ${semester}) already has ${subjectName} scheduled on ${dayOfWeek} (Period ${entry.period || 'current'}, ${entry.startTime} to ${entry.endTime}).`
    }

    // 3. Same classroom conflict (only when classroomId is passed)
    if (classroomId && entry.classroom && entry.classroom._id.toString() === classroomId.toString()) {
      const roomName = entry.classroom.name || 'This classroom'
      const subjectName = entry.subject?.name || 'another class'
      return `Classroom conflict: Classroom ${roomName} is already occupied by ${subjectName} from ${entry.startTime} to ${entry.endTime}.`
    }
  }

  return null
}

// GET /api/admin/timetable
export const listTimetable = asyncHandler(async (req, res) => {
  const { dayOfWeek, department, year, semester, section, teacher, subject, classroom, academicYear } = req.query

  const query = { isActive: true }
  if (dayOfWeek) query.dayOfWeek = dayOfWeek
  if (section) query.section = new RegExp(`^${section.trim()}$`, 'i')
  if (teacher) query.teacher = teacher
  if (subject) query.subject = subject
  if (classroom) query.classroom = classroom
  if (academicYear) query.academicYear = academicYear.trim()

  if (semester) {
    query.semester = Number(semester)
  } else if (year) {
    const yr = Number(year)
    query.semester = { $in: [(yr - 1) * 2 + 1, yr * 2] }
  }

  if (department) {
    const isCse = /^(cse|computer science|c\.s\.e\.|cse department)$/i.test(department.trim())
    const deptRegex = isCse ? /^(cse|computer science|c\.s\.e\.|cse department)$/i : new RegExp(`^${department.trim()}$`, 'i')
    const matchingSubjectIds = await Subject.find({ department: deptRegex }).distinct('_id')
    if (query.subject) {
      if (!matchingSubjectIds.some((id) => id.toString() === query.subject.toString())) {
        query.subject = { $in: [] }
      }
    } else {
      query.subject = { $in: matchingSubjectIds }
    }
  }

  let entries = await Timetable.find(query)
    .populate(POPULATE_FIELDS)
    .sort({ dayOfWeek: 1, startTime: 1 })
    .lean()

  if (department) {
    const isCse = /^(cse|computer science|c\.s\.e\.|cse department)$/i.test(department.trim())
    const deptRegex = isCse ? /^(cse|computer science|c\.s\.e\.|cse department)$/i : new RegExp(`^${department.trim()}$`, 'i')
    entries = entries.filter((e) => {
      const subDept = e.subject?.department
      return subDept && deptRegex.test(subDept)
    })
  }

  const todayDayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()]
  const todayCount = entries.filter((e) => e.dayOfWeek === todayDayName).length
  const uniqueDepts = new Set(entries.map((e) => {
    const d = e.subject?.department
    if (!d) return null
    return /^(computer science|cse|c\.s\.e\.|cse department)$/i.test(d.trim()) ? 'CSE' : d.trim()
  }).filter(Boolean))
  const uniqueSubjects = new Set(entries.map((e) => e.subject?._id?.toString() || e.subject?.toString()).filter(Boolean))

  res.json({
    success: true,
    data: {
      items: entries,
      total: entries.length,
      summary: {
        totalEntries: entries.length,
        today: todayCount,
        departments: uniqueDepts.size,
        activeSubjects: uniqueSubjects.size,
      },
    },
  })
})

// GET /api/admin/timetable/options
export const getTimetableOptions = asyncHandler(async (req, res) => {
  const [subjects, teachers, classrooms, courses, studentSections, timetableSections, studentYears, timetableAcademicYears] = await Promise.all([
    Subject.find({ isActive: true }).select('name code department course semester teachers').populate('course', 'name code').sort({ name: 1 }),
    Teacher.find({ isActive: true }).populate('user', 'name email').select('employeeId department user subjects').sort({ 'user.name': 1 }),
    Classroom.find({ isActive: true }).select('name code building capacity').sort({ name: 1 }),
    Course.find({ isActive: true }).select('name code department durationYears').sort({ name: 1 }),
    Student.distinct('section', { isActive: true }),
    Timetable.distinct('section', { isActive: true }),
    Student.distinct('year', { isActive: true }),
    Timetable.distinct('academicYear', { isActive: true }),
  ])

  // Extract distinct departments & sections (normalized to canonical names)
  const rawDepts = [
    ...subjects.map((s) => s.department).filter(Boolean),
    ...teachers.map((t) => t.department).filter(Boolean),
    ...courses.map((c) => c.department).filter(Boolean),
  ]
  const departments = Array.from(
    new Set(rawDepts.map((d) => (/^(computer science|cse|c\.s\.e\.|cse department)$/i.test(d.trim()) ? 'CSE' : d.trim()))),
  ).sort()
  if (departments.length === 0) departments.push('CSE')

  const combinedSections = Array.from(
    new Set([...studentSections, ...timetableSections].filter(Boolean).map((s) => s.trim().toUpperCase())),
  ).sort()
  const sections = combinedSections.length > 0 ? combinedSections : ['A', 'B']

  // Distinct Years from students and subject semesters
  const subjectYears = subjects.map((s) => s.semester ? Math.ceil(s.semester / 2) : null).filter(Boolean)
  const combinedYears = Array.from(new Set([...studentYears, ...subjectYears].filter(Boolean))).sort((a, b) => a - b)
  const years = combinedYears.length > 0 ? combinedYears : [1, 2, 3, 4]

  // Distinct Semesters from subjects and timetable
  const distinctSemesters = Array.from(new Set(subjects.map((s) => s.semester).filter(Boolean))).sort((a, b) => a - b)
  const semesters = distinctSemesters.length > 0 ? distinctSemesters : [1, 2, 3, 4, 5, 6, 7, 8]

  // Academic years
  const academicYears = timetableAcademicYears.length > 0 ? Array.from(new Set(timetableAcademicYears.filter(Boolean))).sort() : ['2026-2027']

  res.json({
    success: true,
    data: {
      departments,
      years,
      sections,
      semesters,
      subjects,
      teachers: teachers.map((t) => ({
        _id: t._id,
        name: t.user?.name || t.employeeId,
        email: t.user?.email,
        employeeId: t.employeeId,
        department: (/^(computer science|cse|c\.s\.e\.|cse department)$/i.test((t.department || '').trim()) ? 'CSE' : t.department),
        subjects: t.subjects,
      })),
      academicYears,
      classrooms,
      courses,
    },
  })
})

// GET /api/admin/timetable/:id
export const getTimetableEntry = asyncHandler(async (req, res) => {
  const entry = await Timetable.findById(req.params.id).populate(POPULATE_FIELDS)
  if (!entry) {
    res.status(404)
    throw new Error('Timetable entry not found')
  }

  res.json({ success: true, data: entry })
})

// POST /api/admin/timetable
export const createTimetableEntry = asyncHandler(async (req, res) => {
  const {
    subject,
    teacher,
    classroom,
    course,
    dayOfWeek,
    startTime,
    endTime,
    period,
    semester,
    academicYear,
    section,
  } = req.body

  let resolvedClassroom = classroom
  if (!resolvedClassroom) {
    const defaultRoom = await Classroom.findOne({ isActive: true })
    resolvedClassroom = defaultRoom?._id
  }

  if (!subject || !teacher || !dayOfWeek || !startTime || !endTime || !semester || !academicYear) {
    res.status(400)
    throw new Error('Please provide all required timetable fields')
  }

  if (startTime >= endTime) {
    res.status(400)
    throw new Error('End time must be after start time')
  }

  // Fetch subject to validate assignment and semester
  const subjectDoc = await Subject.findById(subject)
  if (!subjectDoc) {
    res.status(400)
    throw new Error('Selected subject does not exist')
  }

  if (subjectDoc.semester !== Number(semester)) {
    res.status(400)
    throw new Error(`Subject ${subjectDoc.name} belongs to Semester ${subjectDoc.semester}, not Semester ${semester}`)
  }

  // Validate teacher assignment
  if (subjectDoc.teachers && subjectDoc.teachers.length > 0) {
    const isAssigned = subjectDoc.teachers.some((t) => t.toString() === teacher.toString())
    if (!isAssigned) {
      res.status(400)
      throw new Error(`Invalid teacher assignment: The selected teacher is not assigned to teach ${subjectDoc.name}`)
    }
  }

  const resolvedCourse = course || subjectDoc.course

  // Conflict validation
  const conflict = await checkTimetableConflict({
    dayOfWeek,
    startTime,
    endTime,
    period: period ? Number(period) : 1,
    academicYear,
    teacherId: teacher,
    classroomId: resolvedClassroom,
    courseId: resolvedCourse,
    semester: Number(semester),
    section: section ? section.trim().toUpperCase() : 'A',
    subjectId: subject,
  })

  if (conflict) {
    res.status(409)
    throw new Error(`Schedule Conflict: ${conflict}`)
  }

  const entry = await Timetable.create({
    subject,
    teacher,
    classroom: resolvedClassroom,
    course: resolvedCourse,
    dayOfWeek,
    startTime,
    endTime,
    period: period ? Number(period) : 1,
    semester: Number(semester),
    academicYear,
    section: section ? section.trim().toUpperCase() : 'A',
    isActive: true,
  })

  const populated = await entry.populate(POPULATE_FIELDS)

  res.status(201).json({
    success: true,
    message: 'Timetable entry created successfully',
    data: populated,
  })
})

// PUT /api/admin/timetable/:id
export const updateTimetableEntry = asyncHandler(async (req, res) => {
  const entry = await Timetable.findById(req.params.id)
  if (!entry) {
    res.status(404)
    throw new Error('Timetable entry not found')
  }

  const {
    subject,
    teacher,
    classroom,
    course,
    dayOfWeek,
    startTime,
    endTime,
    period,
    semester,
    academicYear,
    section,
  } = req.body

  const targetStartTime = startTime || entry.startTime
  const targetEndTime = endTime || entry.endTime

  if (targetStartTime >= targetEndTime) {
    res.status(400)
    throw new Error('End time must be after start time')
  }

  const targetDay = dayOfWeek || entry.dayOfWeek
  const targetYear = academicYear || entry.academicYear
  const targetTeacher = teacher || entry.teacher
  const targetClassroom = classroom || entry.classroom
  const targetCourse = course || entry.course
  const targetSemester = semester !== undefined ? semester : entry.semester
  const targetSection = section !== undefined ? section : entry.section
  const targetPeriod = period !== undefined ? period : entry.period
  const targetSubject = subject || entry.subject

  if (subject || teacher || semester !== undefined) {
    const subjectDoc = await Subject.findById(targetSubject)
    if (!subjectDoc) {
      res.status(400)
      throw new Error('Selected subject does not exist')
    }
    if (subjectDoc.semester !== Number(targetSemester)) {
      res.status(400)
      throw new Error(`Subject ${subjectDoc.name} belongs to Semester ${subjectDoc.semester}, not Semester ${targetSemester}`)
    }
    if (subjectDoc.teachers && subjectDoc.teachers.length > 0) {
      const isAssigned = subjectDoc.teachers.some((t) => t.toString() === targetTeacher.toString())
      if (!isAssigned) {
        res.status(400)
        throw new Error(`Invalid teacher assignment: The selected teacher is not assigned to teach ${subjectDoc.name}`)
      }
    }
  }

  // Conflict validation excluding current entry
  const conflict = await checkTimetableConflict({
    dayOfWeek: targetDay,
    startTime: targetStartTime,
    endTime: targetEndTime,
    period: targetPeriod,
    academicYear: targetYear,
    teacherId: targetTeacher,
    classroomId: targetClassroom,
    courseId: targetCourse,
    semester: targetSemester,
    section: targetSection,
    subjectId: targetSubject,
    excludeId: entry._id,
  })

  if (conflict) {
    res.status(409)
    throw new Error(`Schedule Conflict: ${conflict}`)
  }

  if (subject) entry.subject = subject
  if (teacher) entry.teacher = teacher
  if (classroom) entry.classroom = classroom
  if (course) entry.course = course
  if (dayOfWeek) entry.dayOfWeek = dayOfWeek
  if (startTime) entry.startTime = startTime
  if (endTime) entry.endTime = endTime
  if (period !== undefined) entry.period = Number(period)
  if (semester !== undefined) entry.semester = Number(semester)
  if (academicYear) entry.academicYear = academicYear
  if (section !== undefined) entry.section = section.trim().toUpperCase()

  await entry.save()
  const populated = await entry.populate(POPULATE_FIELDS)

  res.json({
    success: true,
    message: 'Timetable entry updated successfully',
    data: populated,
  })
})

// DELETE /api/admin/timetable/:id
export const deleteTimetableEntry = asyncHandler(async (req, res) => {
  const entry = await Timetable.findById(req.params.id)
  if (!entry) {
    res.status(404)
    throw new Error('Timetable entry not found')
  }

  await entry.deleteOne()

  res.json({
    success: true,
    message: 'Timetable entry deleted successfully',
  })
})
