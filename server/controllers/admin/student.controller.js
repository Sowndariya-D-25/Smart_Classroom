import asyncHandler from '../../utils/asyncHandler.js'
import parsePagination, { buildPaginationMeta, parseSort } from '../../utils/pagination.js'
import { toSearchRegex, toExactRegex, findUserIdsMatching } from '../../utils/searchHelpers.js'
import { getDepartmentRegex } from '../../utils/academicFilter.js'
import { Student, User, Course, FaceProfile, Attendance } from '../../models/index.js'

const SORTABLE_FIELDS = ['studentId', 'rollNumber', 'year', 'createdAt']
const POPULATE_USER = 'name email phone isActive lastLogin createdAt'
const POPULATE_COURSE = 'name code'

// GET /api/admin/students
export const listStudents = asyncHandler(async (req, res) => {
  const pagination = parsePagination(req.query)
  const sort = parseSort(req.query, SORTABLE_FIELDS, { createdAt: -1 })

  const filter = {}
  if (req.query.department) {
    filter.department = getDepartmentRegex(req.query.department)
  }
  if (req.query.section) filter.section = toExactRegex(req.query.section)
  if (req.query.year) filter.year = Number(req.query.year)
  if (req.query.status === 'active') filter.isActive = true
  if (req.query.status === 'inactive') filter.isActive = false

  if (req.query.search) {
    const regex = toSearchRegex(req.query.search)
    const matchingUserIds = await findUserIdsMatching(regex, 'student')
    filter.$or = [{ studentId: regex }, { rollNumber: regex }, { user: { $in: matchingUserIds } }]
  }

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const [items, total, activeCount, inactiveCount, recentCount] = await Promise.all([
    Student.find(filter)
      .populate('user', POPULATE_USER)
      .populate('course', POPULATE_COURSE)
      .sort(sort)
      .skip(pagination.skip)
      .limit(pagination.limit),
    Student.countDocuments(filter),
    Student.countDocuments({ isActive: true }),
    Student.countDocuments({ isActive: false }),
    Student.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
  ])

  res.json({
    success: true,
    data: {
      items,
      pagination: buildPaginationMeta(pagination, total),
      summary: {
        total: activeCount + inactiveCount,
        active: activeCount,
        inactive: inactiveCount,
        recentlyRegistered: recentCount,
      },
    },
  })
})

// GET /api/admin/students/:id
export const getStudent = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.params.id)
    .populate('user', POPULATE_USER)
    .populate('course', POPULATE_COURSE)

  if (!student) {
    res.status(404)
    throw new Error('Student not found')
  }

  // Calculate student attendance statistics safely
  const attendanceRecords = await Attendance.find({ student: student._id }).select('status date').lean()
  let present = 0
  let late = 0
  let absent = 0
  attendanceRecords.forEach((r) => {
    if (r.status === 'Present') present++
    else if (r.status === 'Late') late++
    else if (r.status === 'Absent') absent++
  })
  const totalSessions = present + late + absent
  const attendancePercentage = totalSessions > 0 ? Math.round(((present + late) / totalSessions) * 100) : null

  res.json({
    success: true,
    data: {
      student,
      attendance: {
        total: totalSessions,
        present,
        late,
        absent,
        percentage: attendancePercentage,
      },
    },
  })
})

// POST /api/admin/students
export const createStudent = asyncHandler(async (req, res) => {
  const { name, email, password, studentId, rollNumber, course, department, year, section, gender, phone } = req.body

  if (!department || !String(department).trim()) {
    res.status(400)
    throw new Error('Department is required')
  }
  if (!section || !String(section).trim()) {
    res.status(400)
    throw new Error('Section is required')
  }

  const cleanEmail = email ? String(email).trim().toLowerCase() : ''

  const [existingUser, existingStudentId, courseDoc] = await Promise.all([
    User.findOne({ email: cleanEmail }),
    Student.findOne({ studentId: studentId.toUpperCase() }),
    Course.findById(course),
  ])

  if (existingUser) {
    res.status(409)
    throw new Error('An account with this email already exists')
  }
  if (existingStudentId) {
    res.status(409)
    throw new Error('A student with this Student ID already exists')
  }
  if (!courseDoc) {
    res.status(400)
    throw new Error('Selected course does not exist')
  }

  const duplicateRoll = await Student.findOne({ course, rollNumber })
  if (duplicateRoll) {
    res.status(409)
    throw new Error('A student with this roll number already exists in the selected course')
  }

  // User.pre('save') hashes `password` — passed through as plain text here.
  const user = await User.create({ name, email: cleanEmail, password, role: 'student', phone })

  const rawYear = year !== undefined ? year : req.body.academicYear
  let parsedYear = 1
  if (typeof rawYear === 'number' && !isNaN(rawYear) && rawYear >= 1) {
    parsedYear = rawYear
  } else if (rawYear) {
    const match = String(rawYear).match(/\d+/)
    if (match) {
      const n = parseInt(match[0], 10)
      if (n >= 1 && n <= 10) parsedYear = n
    }
  }

  try {
    const student = await Student.create({
      user: user._id,
      studentId,
      rollNumber,
      course,
      department,
      year: parsedYear,
      section,
      gender,
      phone,
    })
    const populated = await student.populate([
      { path: 'user', select: POPULATE_USER },
      { path: 'course', select: POPULATE_COURSE },
    ])
    res.status(201).json({ success: true, message: 'Student created successfully', data: { student: populated } })
  } catch (err) {
    // The Student profile failed to save (e.g. a race on the unique
    // index) — don't leave a User account with no matching profile
    // behind from what was supposed to be one atomic "add student" action.
    await User.deleteOne({ _id: user._id })
    throw err
  }
})

// PUT /api/admin/students/:id
export const updateStudent = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.params.id).populate('user')
  if (!student) {
    res.status(404)
    throw new Error('Student not found')
  }

  const { name, email, studentId, department, year, section, gender, phone, course } = req.body

  const cleanEmail = email ? String(email).trim().toLowerCase() : ''
  if (cleanEmail && cleanEmail !== student.user.email) {
    const emailTaken = await User.findOne({ email: cleanEmail, _id: { $ne: student.user._id } })
    if (emailTaken) {
      res.status(409)
      throw new Error('An account with this email already exists')
    }
    student.user.email = cleanEmail
  }
  if (name) student.user.name = name
  if (phone !== undefined) student.user.phone = phone

  if (studentId && studentId.toUpperCase() !== student.studentId) {
    const idTaken = await Student.findOne({ studentId: studentId.toUpperCase(), _id: { $ne: student._id } })
    if (idTaken) {
      res.status(409)
      throw new Error('A student with this Student ID already exists')
    }
    student.studentId = studentId
  }

  if (course) student.course = course
  if (department !== undefined) {
    if (!department || !String(department).trim()) {
      res.status(400)
      throw new Error('Department cannot be empty')
    }
    student.department = String(department).trim()
  }
  const rawYear = year !== undefined ? year : req.body.academicYear
  if (rawYear !== undefined) {
    if (typeof rawYear === 'number' && !isNaN(rawYear) && rawYear >= 1) {
      student.year = rawYear
    } else if (rawYear) {
      const match = String(rawYear).match(/\d+/)
      if (match) {
        const n = parseInt(match[0], 10)
        if (n >= 1 && n <= 10) student.year = n
      }
    }
  }
  if (section !== undefined) {
    if (!section || !String(section).trim()) {
      res.status(400)
      throw new Error('Section cannot be empty')
    }
    student.section = String(section).trim().toUpperCase()
  }
  if (gender !== undefined) student.gender = gender

  // Password is intentionally never touched here — editing a profile
  // must never blank out or change the account's password.
  await student.user.save()
  await student.save()

  const populated = await student.populate([
    { path: 'user', select: POPULATE_USER },
    { path: 'course', select: POPULATE_COURSE },
  ])
  res.json({ success: true, message: 'Student updated successfully', data: { student: populated } })
})

// PATCH /api/admin/students/:id/status
export const updateStudentStatus = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.params.id).populate('user')
  if (!student) {
    res.status(404)
    throw new Error('Student not found')
  }

  student.isActive = req.body.isActive
  // Mirrored onto the linked User too, so a deactivated student can no
  // longer log in — not just disappear from admin lists.
  student.user.isActive = req.body.isActive

  await student.save()
  await student.user.save()

  res.json({
    success: true,
    message: `Student ${req.body.isActive ? 'activated' : 'deactivated'} successfully`,
    data: { student },
  })
})

// DELETE /api/admin/students/:id
// Permanent deletion: deletes FaceProfile, Student, and linked User if safe.
// Dependent record check: prevents orphaning historical attendance records.
export const deleteStudent = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.params.id)
  if (!student) {
    res.status(404)
    throw new Error('Student not found')
  }

  const userId = student.user
  const studentId = student._id

  // 1. Dependency check: do not orphan historical attendance records
  const attendanceCount = await Attendance.countDocuments({ student: studentId })
  if (attendanceCount > 0) {
    res.status(409)
    throw new Error(
      `Cannot delete student with existing attendance records (${attendanceCount} found). Please deactivate the student instead to preserve historical records.`
    )
  }

  // 2. Coordinated deletion: FaceProfile, Student, User
  try {
    await FaceProfile.deleteOne({ student: studentId })
    await Student.findByIdAndDelete(studentId)
    if (userId) {
      await User.findByIdAndDelete(userId)
    }
  } catch (err) {
    res.status(500)
    throw new Error('Failed to complete student deletion: ' + err.message)
  }

  res.json({ success: true, message: 'Student permanently deleted' })
})

// GET /api/admin/students/sections
// Returns distinct registered sections for students matching optional department and year
export const getStudentSections = asyncHandler(async (req, res) => {
  const { department, year } = req.query
  const filter = { isActive: true }

  if (department) {
    filter.department = getDepartmentRegex(department)
  }

  if (year) {
    filter.year = Number(year)
  }

  const rawSections = await Student.distinct('section', filter)
  const sections = rawSections
    .filter(Boolean)
    .map((s) => s.trim().toUpperCase())
    .filter((s, idx, arr) => arr.indexOf(s) === idx)
    .sort()

  res.json({
    success: true,
    data: { sections },
    sections,
  })
})


