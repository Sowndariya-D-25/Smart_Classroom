import asyncHandler from '../../utils/asyncHandler.js'
import parsePagination, { buildPaginationMeta } from '../../utils/pagination.js'
import { toSearchRegex, toExactRegex } from '../../utils/searchHelpers.js'
import { Student, User, Course, Classroom, Subject, FaceProfile } from '../../models/index.js'
import { canonicalDepartment, getDepartmentRegex } from '../../utils/academicFilter.js'
import teacherCanAccessStudent from '../../utils/teacherAccess.js'
import { isValidDescriptor } from '../../validators/teacher/faceProfile.validator.js'

/**
 * GET /api/teacher/students
 * Lists students enrolled in the teacher's subject courses with face profile status.
 */
export const listTeacherStudents = asyncHandler(async (req, res) => {
  const teacherId = req.teacher._id
  const pagination = parsePagination(req.query)

  // Find all subjects assigned to this teacher to get their course IDs
  const teacherSubjects = await Subject.find({ teachers: teacherId, isActive: true }).select('course department')
  const courseIds = [...new Set(teacherSubjects.map((s) => s.course?.toString()).filter(Boolean))]

  const filter = { isActive: true }
  if (courseIds.length > 0) {
    filter.course = { $in: courseIds }
  }

  if (req.query.department) {
    const deptRegex = getDepartmentRegex(req.query.department)
    if (deptRegex) filter.department = deptRegex
  }
  if (req.query.year) {
    const yrNum = Number(req.query.year)
    if (!isNaN(yrNum) && yrNum > 0) {
      filter.year = yrNum
    }
  }
  if (req.query.section) {
    filter.section = toExactRegex(req.query.section)
  }

  if (req.query.search) {
    const regex = toSearchRegex(req.query.search)
    const matchingUsers = await User.find({ role: 'student', name: regex }).select('_id')
    const userIds = matchingUsers.map((u) => u._id)
    filter.$or = [{ studentId: regex }, { rollNumber: regex }, { user: { $in: userIds } }]
  }

  const [students, total] = await Promise.all([
    Student.find(filter)
      .populate('user', 'name email phone')
      .populate('course', 'name code')
      .populate('classroom', 'name code building')
      .sort({ studentId: 1 })
      .skip(pagination.skip)
      .limit(pagination.limit),
    Student.countDocuments(filter),
  ])

  const studentIds = students.map((s) => s._id)
  const profiles = await FaceProfile.find({ student: { $in: studentIds } }).select('student sampleCount lastUpdated isActive')
  const profileByStudent = Object.fromEntries(profiles.map((p) => [p.student.toString(), p]))

  const items = students.map((s) => {
    const profile = profileByStudent[s._id.toString()]
    const faceRegistered = Boolean(profile?.isActive && profile.sampleCount > 0)
    return {
      _id: s._id,
      studentId: s.studentId,
      rollNumber: s.rollNumber,
      department: canonicalDepartment(s.department),
      section: s.section,
      year: s.year,
      gender: s.gender,
      phone: s.phone,
      name: s.user?.name,
      email: s.user?.email,
      course: s.course,
      classroom: s.classroom,
      faceRegistered,
      sampleCount: profile?.sampleCount || 0,
      faceLastUpdated: profile?.lastUpdated || null,
    }
  })

  // Optional filtering by face registration status
  let filteredItems = items
  if (req.query.hasFace === 'true') {
    filteredItems = items.filter((i) => i.faceRegistered)
  } else if (req.query.hasFace === 'false') {
    filteredItems = items.filter((i) => !i.faceRegistered)
  }

  res.json({
    success: true,
    data: {
      items: filteredItems,
      pagination: buildPaginationMeta(pagination, total),
    },
  })
})

/**
 * GET /api/teacher/students/:id
 * Fetches a single student's details and face profile status.
 */
export const getTeacherStudent = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.params.id)
    .populate('user', 'name email phone')
    .populate('course', 'name code department')
    .populate('classroom', 'name code building')

  if (!student) {
    res.status(404)
    throw new Error('Student not found')
  }

  const hasAccess = await teacherCanAccessStudent(req.teacher._id, student)
  if (!hasAccess) {
    res.status(403)
    throw new Error('You do not have access to this student')
  }

  const profile = await FaceProfile.findOne({ student: student._id }).select('sampleCount lastUpdated isActive')

  res.json({
    success: true,
    data: {
      student: {
        _id: student._id,
        studentId: student.studentId,
        rollNumber: student.rollNumber,
        department: canonicalDepartment(student.department),
        section: student.section,
        year: student.year,
        gender: student.gender,
        name: student.user?.name,
        email: student.user?.email,
        phone: student.phone || student.user?.phone,
        course: student.course,
        classroom: student.classroom,
        faceRegistered: Boolean(profile?.isActive && profile.sampleCount > 0),
        sampleCount: profile?.sampleCount || 0,
        faceLastUpdated: profile?.lastUpdated || null,
      },
    },
  })
})

/**
 * POST /api/teacher/students/register
 * One-time registration for a student's information and camera-captured face samples.
 * Accepts: { name, studentId, rollNumber, department, section, classroom, course, email, phone, gender, year, descriptors }
 */
export const registerStudentWithFace = asyncHandler(async (req, res) => {
  const teacherId = req.teacher._id
  const {
    name,
    studentId,
    rollNumber,
    department,
    section,
    classroom,
    course: requestedCourse,
    email,
    phone,
    gender,
    year,
    descriptors,
    password,
  } = req.body

  if (!name || !name.trim()) {
    res.status(400)
    throw new Error('Student name is required')
  }
  if (!studentId || !studentId.trim()) {
    res.status(400)
    throw new Error('Student ID / Register number is required')
  }

  // Validate descriptors if provided
  if (descriptors) {
    if (!Array.isArray(descriptors) || !descriptors.every(isValidDescriptor)) {
      res.status(400)
      throw new Error('Each face descriptor must be an array of exactly 128 finite numbers')
    }
  }

  // Determine course
  let courseDoc = null
  if (requestedCourse) {
    courseDoc = await Course.findById(requestedCourse)
  }
  if (!courseDoc) {
    // Pick the course associated with teacher's assigned subjects
    const teacherSubject = await Subject.findOne({ teachers: teacherId, isActive: true }).populate('course')
    courseDoc = teacherSubject?.course
  }
  if (!courseDoc) {
    // Fallback to any active course in the system
    courseDoc = await Course.findOne({ isActive: true })
  }
  if (!courseDoc) {
    res.status(400)
    throw new Error('No course available. An academic course must be configured before registering students.')
  }

  const cleanStudentId = studentId.trim().toUpperCase()
  const cleanEmail = email ? email.trim().toLowerCase() : `${cleanStudentId.toLowerCase()}@smartclassroom.local`

  // Check if student with this studentId / register number already exists
  const existingStudent = await Student.findOne({ studentId: cleanStudentId })
  if (existingStudent) {
    res.status(409)
    throw new Error(`Register number "${cleanStudentId}" already exists.`)
  }

  // Determine roll number and check uniqueness within the selected course
  let cleanRollNumber = rollNumber ? rollNumber.trim() : ''
  if (cleanRollNumber) {
    const duplicateRoll = await Student.findOne({ course: courseDoc._id, rollNumber: cleanRollNumber })
    if (duplicateRoll) {
      res.status(409)
      throw new Error(`Roll number "${cleanRollNumber}" is already in use in this course. Please assign a unique roll number.`)
    }
  } else {
    // Auto-generate roll number from studentId or sequential next available in this course
    const candidate = cleanStudentId.slice(-4) || cleanStudentId
    const exists = await Student.findOne({ course: courseDoc._id, rollNumber: candidate })
    if (!exists) {
      cleanRollNumber = candidate
    } else {
      const courseStudents = await Student.find({ course: courseDoc._id }).select('rollNumber')
      const maxNum = courseStudents.reduce((max, s) => {
        const n = parseInt(s.rollNumber, 10)
        return !isNaN(n) && n > max ? n : max
      }, 0)
      cleanRollNumber = String(maxNum + 1).padStart(2, '0')
    }
  }

  // Check if email is already taken
  const existingUser = await User.findOne({ email: cleanEmail })
  if (existingUser) {
    res.status(409)
    throw new Error(`An account with email "${cleanEmail}" already exists. Please provide a different email.`)
  }

  // Create User account for student with bcrypt hashed password
  const initialPassword = password && password.trim().length >= 8 ? password.trim() : 'Password123!'
  const user = await User.create({
    name: name.trim(),
    email: cleanEmail,
    password: initialPassword,
    role: 'student',
    phone: phone?.trim(),
  })

  let student = null
  try {
    const rawYearVal = year !== undefined ? year : req.body.academicYear
    let parsedYear = 1
    if (typeof rawYearVal === 'number' && !isNaN(rawYearVal) && rawYearVal >= 1) {
      parsedYear = rawYearVal
    } else if (rawYearVal) {
      const match = String(rawYearVal).match(/\d+/)
      if (match) {
        const n = parseInt(match[0], 10)
        if (n >= 1 && n <= 10) parsedYear = n
      }
    }

    student = await Student.create({
      user: user._id,
      studentId: cleanStudentId,
      rollNumber: cleanRollNumber,
      department: canonicalDepartment(department?.trim() || courseDoc.department || 'CSE'),
      section: section?.trim().toUpperCase() || 'A',
      course: courseDoc._id,
      classroom: classroom || null,
      phone: phone?.trim(),
      gender: gender || 'Other',
      year: parsedYear,
    })
    student.user = user
  } catch (err) {
    await User.deleteOne({ _id: user._id })
    throw err
  }

  // Handle face descriptors if provided
  let faceProfile = null
  if (descriptors && descriptors.length > 0) {
    faceProfile = await FaceProfile.findOne({ student: student._id })
    if (faceProfile) {
      faceProfile.descriptors = descriptors
      faceProfile.isActive = true
      await faceProfile.save()
    } else {
      faceProfile = await FaceProfile.create({
        student: student._id,
        descriptors,
        sampleCount: descriptors.length,
        isActive: true,
      })
    }

    if (!student.faceProfile || !student.faceProfile.equals(faceProfile._id)) {
      student.faceProfile = faceProfile._id
      await student.save()
    }
  } else if (student.faceProfile) {
    faceProfile = await FaceProfile.findById(student.faceProfile)
  }

  const populated = await student.populate([
    { path: 'user', select: 'name email phone' },
    { path: 'course', select: 'name code' },
    { path: 'classroom', select: 'name code' },
  ])

  res.status(201).json({
    success: true,
    message: faceProfile?.sampleCount
      ? `Student ${student.studentId} registered with ${faceProfile.sampleCount} face samples.`
      : `Student ${student.studentId} registered successfully.`,
    data: {
      student: {
        _id: populated._id,
        studentId: populated.studentId,
        rollNumber: populated.rollNumber,
        name: populated.user?.name,
        email: populated.user?.email,
        department: populated.department,
        year: populated.year,
        section: populated.section,
        course: populated.course,
        classroom: populated.classroom,
        faceRegistered: Boolean(faceProfile?.isActive && faceProfile?.sampleCount > 0),
        sampleCount: faceProfile?.sampleCount || 0,
        faceLastUpdated: faceProfile?.lastUpdated || null,
      },
    },
  })
})
