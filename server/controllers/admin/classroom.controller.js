import asyncHandler from '../../utils/asyncHandler.js'
import parsePagination, { buildPaginationMeta, parseSort } from '../../utils/pagination.js'
import { toSearchRegex } from '../../utils/searchHelpers.js'
import { Classroom } from '../../models/index.js'

const SORTABLE_FIELDS = ['name', 'code', 'capacity', 'createdAt']

export const listClassrooms = asyncHandler(async (req, res) => {
  const pagination = parsePagination(req.query)
  const sort = parseSort(req.query, SORTABLE_FIELDS, { createdAt: -1 })

  const filter = {}
  if (req.query.building) filter.building = new RegExp(`^${req.query.building}$`, 'i')
  if (req.query.status === 'active') filter.isActive = true
  if (req.query.status === 'inactive') filter.isActive = false
  if (req.query.search) {
    const regex = toSearchRegex(req.query.search)
    filter.$or = [{ name: regex }, { code: regex }, { roomNumber: regex }]
  }

  const [items, total] = await Promise.all([
    Classroom.find(filter).sort(sort).skip(pagination.skip).limit(pagination.limit),
    Classroom.countDocuments(filter),
  ])

  res.json({ success: true, data: { items, pagination: buildPaginationMeta(pagination, total) } })
})

export const getClassroom = asyncHandler(async (req, res) => {
  const classroom = await Classroom.findById(req.params.id)
  if (!classroom) {
    res.status(404)
    throw new Error('Classroom not found')
  }
  res.json({ success: true, data: { classroom } })
})

export const createClassroom = asyncHandler(async (req, res) => {
  const { name, code, building, floor, capacity, roomNumber, hasCamera, cameraId } = req.body

  const existing = await Classroom.findOne({ code: code.toUpperCase() })
  if (existing) {
    res.status(409)
    throw new Error('A classroom with this code already exists')
  }

  const classroom = await Classroom.create({
    name,
    code,
    building,
    floor,
    capacity,
    roomNumber,
    hasCamera,
    cameraId: hasCamera ? cameraId : null,
  })
  res.status(201).json({ success: true, message: 'Classroom created successfully', data: { classroom } })
})

export const updateClassroom = asyncHandler(async (req, res) => {
  const classroom = await Classroom.findById(req.params.id)
  if (!classroom) {
    res.status(404)
    throw new Error('Classroom not found')
  }

  const { name, code, building, floor, capacity, roomNumber, hasCamera, cameraId } = req.body

  if (code && code.toUpperCase() !== classroom.code) {
    const codeTaken = await Classroom.findOne({ code: code.toUpperCase(), _id: { $ne: classroom._id } })
    if (codeTaken) {
      res.status(409)
      throw new Error('A classroom with this code already exists')
    }
    classroom.code = code
  }
  if (name !== undefined) classroom.name = name
  if (building !== undefined) classroom.building = building
  if (floor !== undefined) classroom.floor = floor
  if (capacity !== undefined) classroom.capacity = capacity
  if (roomNumber !== undefined) classroom.roomNumber = roomNumber
  if (hasCamera !== undefined) classroom.hasCamera = hasCamera
  if (cameraId !== undefined) classroom.cameraId = classroom.hasCamera ? cameraId : null

  await classroom.save()
  res.json({ success: true, message: 'Classroom updated successfully', data: { classroom } })
})

export const updateClassroomStatus = asyncHandler(async (req, res) => {
  const classroom = await Classroom.findByIdAndUpdate(req.params.id, { isActive: req.body.isActive }, { new: true })
  if (!classroom) {
    res.status(404)
    throw new Error('Classroom not found')
  }
  res.json({
    success: true,
    message: `Classroom ${req.body.isActive ? 'activated' : 'deactivated'} successfully`,
    data: { classroom },
  })
})

// Soft delete only — Classroom is referenced by Timetable and AttendanceSession records.
export const deleteClassroom = asyncHandler(async (req, res) => {
  const classroom = await Classroom.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true })
  if (!classroom) {
    res.status(404)
    throw new Error('Classroom not found')
  }
  res.json({ success: true, message: 'Classroom deactivated successfully', data: { classroom } })
})
