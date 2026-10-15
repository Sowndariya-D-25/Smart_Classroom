import asyncHandler from '../../utils/asyncHandler.js'
import parsePagination, { buildPaginationMeta, parseSort } from '../../utils/pagination.js'
import { toSearchRegex, findUserIdsMatching } from '../../utils/searchHelpers.js'
import { Teacher, User, Subject, AttendanceSession, Attendance } from '../../models/index.js'

const SORTABLE_FIELDS = ['employeeId', 'createdAt']
const POPULATE_USER = 'name email phone isActive lastLogin createdAt'
const POPULATE_SUBJECTS = 'name code department'
const POPULATE_ASSIGNMENTS = { path: 'assignments.subject', select: 'name code department' }

export const listTeachers = asyncHandler(async (req, res) => {
  const pagination = parsePagination(req.query)
  const sort = parseSort(req.query, SORTABLE_FIELDS, { createdAt: -1 })

  const filter = {}
  if (req.query.department) {
    const isCse = /^(cse|computer science|c\.s\.e\.|cse department)$/i.test(req.query.department)
    filter.department = isCse ? /^(cse|computer science|c\.s\.e\.|cse department)$/i : new RegExp(`^${req.query.department}$`, 'i')
  }
  if (req.query.designation) filter.designation = new RegExp(`^${req.query.designation}$`, 'i')
  if (req.query.status === 'active') filter.isActive = true
  if (req.query.status === 'inactive') filter.isActive = false

  if (req.query.search) {
    const regex = toSearchRegex(req.query.search)
    const matchingUserIds = await findUserIdsMatching(regex, 'teacher')
    filter.$or = [{ employeeId: regex }, { user: { $in: matchingUserIds } }]
  }

  if (req.query.year) {
    filter['assignments.year'] = Number(req.query.year)
  }

  const [items, total, activeTeachers, inactiveTeachers, allActiveForDept] = await Promise.all([
    Teacher.find(filter)
      .populate('user', POPULATE_USER)
      .populate('subjects', POPULATE_SUBJECTS)
      .populate(POPULATE_ASSIGNMENTS)
      .sort(sort)
      .skip(pagination.skip)
      .limit(pagination.limit),
    Teacher.countDocuments(filter),
    Teacher.countDocuments({ isActive: true }),
    Teacher.countDocuments({ isActive: false }),
    Teacher.find({ isActive: true }).select('department').lean(),
  ])

  // Canonical departments of active teachers
  const activeDepartments = Array.from(
    new Set(allActiveForDept.map((t) => {
      if (!t.department) return null
      return /^(computer science|cse|c\.s\.e\.|cse department)$/i.test(t.department.trim()) ? 'CSE' : t.department.trim()
    }).filter(Boolean)),
  ).sort()
  if (activeDepartments.length === 0) activeDepartments.push('CSE')

  res.json({
    success: true,
    data: {
      items,
      pagination: buildPaginationMeta(pagination, total),
      summary: {
        total: activeTeachers + inactiveTeachers,
        active: activeTeachers,
        inactive: inactiveTeachers,
        departments: activeDepartments.length,
        departmentList: activeDepartments,
      },
    },
  })
})

export const getTeacher = asyncHandler(async (req, res) => {
  const teacher = await Teacher.findById(req.params.id)
    .populate('user', POPULATE_USER)
    .populate('subjects', POPULATE_SUBJECTS)
    .populate(POPULATE_ASSIGNMENTS)

  if (!teacher) {
    res.status(404)
    throw new Error('Teacher not found')
  }
  res.json({ success: true, data: { teacher } })
})

export const createTeacher = asyncHandler(async (req, res) => {
  const { name, email, password, confirmPassword, employeeId, department, designation, phone, mobile } = req.body

  const teacherPhone = phone || mobile || ''

  if (!password) {
    res.status(400)
    throw new Error('Password is required')
  }
  if (confirmPassword && password !== confirmPassword) {
    res.status(400)
    throw new Error('Passwords do not match')
  }
  if (password.length < 8) {
    res.status(400)
    throw new Error('Password must be at least 8 characters')
  }

  const cleanEmail = email ? String(email).trim().toLowerCase() : ''

  const [existingUser, existingEmployeeId] = await Promise.all([
    User.findOne({ email: cleanEmail }),
    Teacher.findOne({ employeeId: employeeId.toUpperCase() }),
  ])
  if (existingUser) {
    res.status(409)
    throw new Error('An account with this email already exists')
  }
  if (existingEmployeeId) {
    res.status(409)
    throw new Error('A teacher with this Employee ID already exists')
  }

  // Role is hardcoded to 'teacher'
  const user = await User.create({ name, email: cleanEmail, password, role: 'teacher', phone: teacherPhone })

  try {
    const teacher = await Teacher.create({
      user: user._id,
      employeeId: employeeId.toUpperCase(),
      department,
      designation: designation || 'Assistant Professor',
      phone: teacherPhone,
      subjects: [],
      assignments: [],
    })
    const populated = await teacher.populate({ path: 'user', select: POPULATE_USER })
    res.status(201).json({ success: true, message: 'Teacher created successfully', data: { teacher: populated } })
  } catch (err) {
    await User.deleteOne({ _id: user._id })
    throw err
  }
})

export const updateTeacher = asyncHandler(async (req, res) => {
  const teacher = await Teacher.findById(req.params.id).populate('user')
  if (!teacher) {
    res.status(404)
    throw new Error('Teacher not found')
  }

  const { name, email, employeeId, department, designation, phone, mobile, assignments } = req.body
  const teacherPhone = phone !== undefined ? phone : mobile

  const cleanEmail = email ? String(email).trim().toLowerCase() : ''
  if (cleanEmail && cleanEmail !== teacher.user.email) {
    const emailTaken = await User.findOne({ email: cleanEmail, _id: { $ne: teacher.user._id } })
    if (emailTaken) {
      res.status(409)
      throw new Error('An account with this email already exists')
    }
    teacher.user.email = cleanEmail
  }
  if (name) teacher.user.name = name
  if (teacherPhone !== undefined) {
    teacher.user.phone = teacherPhone
    teacher.phone = teacherPhone
  }

  if (employeeId && employeeId.toUpperCase() !== teacher.employeeId) {
    const idTaken = await Teacher.findOne({ employeeId: employeeId.toUpperCase(), _id: { $ne: teacher._id } })
    if (idTaken) {
      res.status(409)
      throw new Error('A teacher with this Employee ID already exists')
    }
    teacher.employeeId = employeeId.toUpperCase()
  }
  if (department !== undefined) teacher.department = department
  if (designation !== undefined) teacher.designation = designation

  // Handle teaching assignments synchronization
  if (Array.isArray(assignments)) {
    // Validate assignments: year, department, section, subject (prevent duplicates)
    const seen = new Set()
    const validAssignments = []
    const subjectIds = []

    for (const a of assignments) {
      if (!a.subject) continue
      const subId = a.subject._id ? a.subject._id.toString() : a.subject.toString()
      const key = `${a.year || 1}-${(a.department || '').toLowerCase()}-${(a.section || 'A').toUpperCase()}-${subId}`
      if (seen.has(key)) continue
      seen.add(key)

      validAssignments.push({
        year: Number(a.year) || 1,
        department: a.department || teacher.department,
        section: (a.section || 'A').toUpperCase(),
        subject: subId,
      })
      subjectIds.push(subId)
    }

    teacher.assignments = validAssignments
    teacher.subjects = Array.from(new Set(subjectIds))

    // Bidirectional sync: add teacher to Subject.teachers
    await Promise.all([
      // Add teacher to current subjects
      Subject.updateMany(
        { _id: { $in: subjectIds } },
        { $addToSet: { teachers: teacher._id } },
      ),
      // Remove teacher from subjects not in assignments anymore
      Subject.updateMany(
        { _id: { $nin: subjectIds }, teachers: teacher._id },
        { $pull: { teachers: teacher._id } },
      ),
    ])
  }

  await teacher.user.save()
  await teacher.save()

  const populated = await teacher.populate([
    { path: 'user', select: POPULATE_USER },
    { path: 'subjects', select: POPULATE_SUBJECTS },
    POPULATE_ASSIGNMENTS,
  ])
  res.json({ success: true, message: 'Teacher updated successfully', data: { teacher: populated } })
})

export const updateTeacherStatus = asyncHandler(async (req, res) => {
  const teacher = await Teacher.findById(req.params.id).populate('user')
  if (!teacher) {
    res.status(404)
    throw new Error('Teacher not found')
  }
  teacher.isActive = req.body.isActive
  teacher.user.isActive = req.body.isActive
  await teacher.save()
  await teacher.user.save()
  res.json({
    success: true,
    message: `Teacher ${req.body.isActive ? 'activated' : 'deactivated'} successfully`,
    data: { teacher },
  })
})

// DELETE /api/admin/teachers/:id
// Permanent deletion: removes from subjects, deletes linked User and Teacher if safe.
// Dependent record check: prevents orphaning historical attendance sessions and records.
export const deleteTeacher = asyncHandler(async (req, res) => {
  const teacher = await Teacher.findById(req.params.id)
  if (!teacher) {
    res.status(404)
    throw new Error('Teacher not found')
  }

  const userId = teacher.user
  const teacherId = teacher._id

  // 1. Dependency check: do not delete teacher if historical sessions or records exist
  const [sessionCount, attendanceCount] = await Promise.all([
    AttendanceSession.countDocuments({ teacher: teacherId }),
    Attendance.countDocuments({ teacher: teacherId }),
  ])

  if (sessionCount > 0 || attendanceCount > 0) {
    res.status(409)
    throw new Error(
      `Cannot delete teacher with existing attendance history (${sessionCount} sessions, ${attendanceCount} records). Please deactivate the teacher instead to preserve historical records.`
    )
  }

  // 2. Coordinated deletion:
  try {
    // Unassign teacher from all subjects
    await Subject.updateMany({ teachers: teacherId }, { $pull: { teachers: teacherId } })

    // Delete teacher record
    await Teacher.findByIdAndDelete(teacherId)

    // Delete user account
    if (userId) {
      await User.findByIdAndDelete(userId)
    }
  } catch (err) {
    res.status(500)
    throw new Error('Failed to complete teacher deletion: ' + err.message)
  }

  res.json({ success: true, message: 'Teacher permanently deleted' })
})
