import mongoose from 'mongoose'
import asyncHandler from '../../utils/asyncHandler.js'
import parsePagination, { buildPaginationMeta, parseSort } from '../../utils/pagination.js'
import { toSearchRegex } from '../../utils/searchHelpers.js'
import { Subject, Course } from '../../models/index.js'

const SORTABLE_FIELDS = ['name', 'code', 'semester', 'createdAt']
const TEACHER_POPULATE = { path: 'teachers', select: 'employeeId user', populate: { path: 'user', select: 'name' } }

export const listSubjects = asyncHandler(async (req, res) => {
  const pagination = parsePagination(req.query)
  const sort = parseSort(req.query, SORTABLE_FIELDS, { createdAt: -1 })

  const filter = {}
  if (req.query.department) filter.department = new RegExp(`^${req.query.department}$`, 'i')
  if (req.query.semester) filter.semester = Number(req.query.semester)
  if (req.query.status === 'active') filter.isActive = true
  if (req.query.status === 'inactive') filter.isActive = false
  if (req.query.course) {
    if (mongoose.isValidObjectId(req.query.course)) {
      filter.course = req.query.course
    } else {
      const foundCourse = await Course.findOne({
        $or: [
          { code: req.query.course.toUpperCase() },
          { name: new RegExp(`^${req.query.course}$`, 'i') },
        ],
      })
      if (foundCourse) {
        filter.course = foundCourse._id
      } else {
        filter.course = req.query.course
      }
    }
  }
  if (req.query.search) {
    const regex = toSearchRegex(req.query.search)
    filter.$or = [{ name: regex }, { code: regex }]
  }

  const [items, total] = await Promise.all([
    Subject.find(filter)
      .populate('course', 'name code')
      .populate(TEACHER_POPULATE)
      .sort(sort)
      .skip(pagination.skip)
      .limit(pagination.limit),
    Subject.countDocuments(filter),
  ])

  res.json({ success: true, data: { items, pagination: buildPaginationMeta(pagination, total) } })
})

export const getSubject = asyncHandler(async (req, res) => {
  const subject = await Subject.findById(req.params.id).populate('course', 'name code').populate(TEACHER_POPULATE)
  if (!subject) {
    res.status(404)
    throw new Error('Subject not found')
  }
  res.json({ success: true, data: { subject } })
})

export const createSubject = asyncHandler(async (req, res) => {
  const { name, code, description, credits, department, semester, course, teachers } = req.body

  const [existingCode, courseDoc] = await Promise.all([
    Subject.findOne({ code: code.toUpperCase() }),
    Course.findById(course),
  ])
  if (existingCode) {
    res.status(409)
    throw new Error('A subject with this code already exists')
  }
  if (!courseDoc) {
    res.status(400)
    throw new Error('Selected course does not exist')
  }

  const subject = await Subject.create({
    name,
    code,
    description,
    credits,
    department,
    semester,
    course,
    teachers: teachers || [],
  })
  const populated = await subject.populate([{ path: 'course', select: 'name code' }, TEACHER_POPULATE])
  res.status(201).json({ success: true, message: 'Subject created successfully', data: { subject: populated } })
})

export const updateSubject = asyncHandler(async (req, res) => {
  const subject = await Subject.findById(req.params.id)
  if (!subject) {
    res.status(404)
    throw new Error('Subject not found')
  }

  const { name, code, description, credits, department, semester, course, teachers } = req.body

  if (code && code.toUpperCase() !== subject.code) {
    const codeTaken = await Subject.findOne({ code: code.toUpperCase(), _id: { $ne: subject._id } })
    if (codeTaken) {
      res.status(409)
      throw new Error('A subject with this code already exists')
    }
    subject.code = code
  }
  if (course) {
    const courseDoc = await Course.findById(course)
    if (!courseDoc) {
      res.status(400)
      throw new Error('Selected course does not exist')
    }
    subject.course = course
  }
  if (name !== undefined) subject.name = name
  if (description !== undefined) subject.description = description
  if (credits !== undefined) subject.credits = credits
  if (department !== undefined) subject.department = department
  if (semester !== undefined) subject.semester = semester
  if (teachers !== undefined) subject.teachers = teachers

  await subject.save()
  const populated = await subject.populate([{ path: 'course', select: 'name code' }, TEACHER_POPULATE])
  res.json({ success: true, message: 'Subject updated successfully', data: { subject: populated } })
})

export const updateSubjectStatus = asyncHandler(async (req, res) => {
  const subject = await Subject.findByIdAndUpdate(req.params.id, { isActive: req.body.isActive }, { new: true })
  if (!subject) {
    res.status(404)
    throw new Error('Subject not found')
  }
  res.json({
    success: true,
    message: `Subject ${req.body.isActive ? 'activated' : 'deactivated'} successfully`,
    data: { subject },
  })
})

// Soft delete only — Subject is referenced by Timetable, Attendance, and
// AttendanceSession records.
export const deleteSubject = asyncHandler(async (req, res) => {
  const subject = await Subject.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true })
  if (!subject) {
    res.status(404)
    throw new Error('Subject not found')
  }
  res.json({ success: true, message: 'Subject deactivated successfully', data: { subject } })
})
