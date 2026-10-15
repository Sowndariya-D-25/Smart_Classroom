import asyncHandler from '../../utils/asyncHandler.js'
import parsePagination, { buildPaginationMeta, parseSort } from '../../utils/pagination.js'
import { toSearchRegex } from '../../utils/searchHelpers.js'
import { Subject, Student, Timetable, FaceProfile } from '../../models/index.js'

const SORTABLE_FIELDS = ['name', 'code']

/**
 * GET /api/teacher/classes
 *
 * This project's Phase 2 schema doesn't have a separate "class" model —
 * a teacher's "classes" are their assigned Subjects, each enriched here
 * with the student count (everyone enrolled in that subject's course)
 * and which classroom(s) it meets in per the timetable. See
 * docs/TEACHER_MODULE.md ("What counts as a class") for the reasoning.
 */
export const listMyClasses = asyncHandler(async (req, res) => {
  const pagination = parsePagination(req.query)
  const sort = parseSort(req.query, SORTABLE_FIELDS, { name: 1 })

  const filter = { teachers: req.teacher._id, isActive: true }
  if (req.query.search) {
    const regex = toSearchRegex(req.query.search)
    filter.$or = [{ name: regex }, { code: regex }]
  }

  const [subjects, total] = await Promise.all([
    Subject.find(filter).populate('course', 'name code').sort(sort).skip(pagination.skip).limit(pagination.limit),
    Subject.countDocuments(filter),
  ])

  const items = await Promise.all(
    subjects.map(async (subject) => {
      const [studentCount, sections, timetableSlots] = await Promise.all([
        Student.countDocuments({ course: subject.course?._id, isActive: true }),
        Student.distinct('section', { course: subject.course?._id, isActive: true }),
        Timetable.find({ subject: subject._id, teacher: req.teacher._id, isActive: true })
          .populate('classroom', 'name code')
          .select('dayOfWeek startTime endTime classroom'),
      ])
      const cleanSections = (sections.filter(Boolean).length > 0 ? sections.filter(Boolean) : ['A']).sort()
      return {
        _id: subject._id,
        subject: { _id: subject._id, name: subject.name, code: subject.code, credits: subject.credits, department: subject.department, semester: subject.semester },
        course: subject.course,
        department: subject.course?.code || subject.department || 'CSE',
        sections: cleanSections,
        section: cleanSections.join(', '),
        studentCount,
        classrooms: [...new Map(timetableSlots.filter((t) => t.classroom).map((t) => [t.classroom._id.toString(), t.classroom])).values()],
        weeklySlots: timetableSlots.length,
      }
    }),
  )

  res.json({ success: true, data: { items, pagination: buildPaginationMeta(pagination, total) } })
})

// GET /api/teacher/classes/:subjectId/students
// Roster for one of the teacher's own subjects, enriched with whether
// each student already has a registered face — used by the Face
// Registration picker so a teacher only ever sees/selects students in
// their own class (never an arbitrary studentId from outside it).
export const getClassRoster = asyncHandler(async (req, res) => {
  const subject = await Subject.findOne({ _id: req.params.subjectId, teachers: req.teacher._id })
  if (!subject) {
    res.status(404)
    throw new Error('Subject not found')
  }

  const students = await Student.find({ course: subject.course, isActive: true })
    .populate('user', 'name email')
    .select('studentId rollNumber user')
    .sort({ rollNumber: 1 })

  const profiles = await FaceProfile.find({ student: { $in: students.map((s) => s._id) } }).select('student sampleCount isActive')
  const profileByStudent = Object.fromEntries(profiles.map((p) => [p.student.toString(), p]))

  const items = students.map((s) => {
    const profile = profileByStudent[s._id.toString()]
    return {
      _id: s._id,
      studentId: s.studentId,
      rollNumber: s.rollNumber,
      name: s.user?.name,
      faceRegistered: Boolean(profile?.isActive && profile.sampleCount > 0),
      sampleCount: profile?.sampleCount || 0,
    }
  })

  res.json({
    success: true,
    data: { subject: { _id: subject._id, name: subject.name, code: subject.code }, items },
  })
})
