import mongoose from 'mongoose'
import asyncHandler from '../../utils/asyncHandler.js'
import parsePagination, { buildPaginationMeta, parseSort } from '../../utils/pagination.js'
import { toSearchRegex } from '../../utils/searchHelpers.js'
import { Course } from '../../models/index.js'

const SORTABLE_FIELDS = ['name', 'code', 'createdAt']

export const listCourses = asyncHandler(async (req, res) => {
  const pagination = parsePagination(req.query)
  const sort = parseSort(req.query, SORTABLE_FIELDS, { createdAt: -1 })

  const filter = {}
  if (req.query.department) filter.department = new RegExp(`^${req.query.department}$`, 'i')
  if (req.query.status === 'active') filter.isActive = true
  if (req.query.status === 'inactive') filter.isActive = false
  if (req.query.course || req.query.program) {
    const progVal = req.query.course || req.query.program
    if (mongoose.isValidObjectId(progVal)) {
      filter._id = progVal
    } else {
      filter.$or = [
        { code: progVal.toUpperCase() },
        { name: new RegExp(`^${progVal}$`, 'i') },
      ]
    }
  }
  if (req.query.search) {
    const regex = toSearchRegex(req.query.search)
    filter.$or = [{ name: regex }, { code: regex }]
  }

  const [items, total] = await Promise.all([
    Course.find(filter).sort(sort).skip(pagination.skip).limit(pagination.limit),
    Course.countDocuments(filter),
  ])

  res.json({ success: true, data: { items, pagination: buildPaginationMeta(pagination, total) } })
})

export const getCourse = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.id)
  if (!course) {
    res.status(404)
    throw new Error('Course not found')
  }
  res.json({ success: true, data: { course } })
})

export const createCourse = asyncHandler(async (req, res) => {
  const { name, code, department, duration, description } = req.body

  const existing = await Course.findOne({ code: code.toUpperCase() })
  if (existing) {
    res.status(409)
    throw new Error('A course with this code already exists')
  }

  const course = await Course.create({ name, code, department, duration, description })
  res.status(201).json({ success: true, message: 'Course created successfully', data: { course } })
})

export const updateCourse = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.id)
  if (!course) {
    res.status(404)
    throw new Error('Course not found')
  }

  const { name, code, department, duration, description } = req.body

  if (code && code.toUpperCase() !== course.code) {
    const codeTaken = await Course.findOne({ code: code.toUpperCase(), _id: { $ne: course._id } })
    if (codeTaken) {
      res.status(409)
      throw new Error('A course with this code already exists')
    }
    course.code = code
  }
  if (name !== undefined) course.name = name
  if (department !== undefined) course.department = department
  if (duration !== undefined) course.duration = duration
  if (description !== undefined) course.description = description

  await course.save()
  res.json({ success: true, message: 'Course updated successfully', data: { course } })
})

export const updateCourseStatus = asyncHandler(async (req, res) => {
  const course = await Course.findByIdAndUpdate(req.params.id, { isActive: req.body.isActive }, { new: true })
  if (!course) {
    res.status(404)
    throw new Error('Course not found')
  }
  res.json({
    success: true,
    message: `Course ${req.body.isActive ? 'activated' : 'deactivated'} successfully`,
    data: { course },
  })
})

// Soft delete only — Course is referenced by Student and Subject records.
export const deleteCourse = asyncHandler(async (req, res) => {
  const course = await Course.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true })
  if (!course) {
    res.status(404)
    throw new Error('Course not found')
  }
  res.json({ success: true, message: 'Course deactivated successfully', data: { course } })
})
