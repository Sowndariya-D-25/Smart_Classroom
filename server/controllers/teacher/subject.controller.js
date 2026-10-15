import asyncHandler from '../../utils/asyncHandler.js'
import parsePagination, { buildPaginationMeta, parseSort } from '../../utils/pagination.js'
import { toSearchRegex } from '../../utils/searchHelpers.js'
import { Subject } from '../../models/index.js'
import { canonicalDepartment } from '../../utils/academicFilter.js'

const SORTABLE_FIELDS = ['name', 'code', 'semester']

// GET /api/teacher/subjects — only ever queries by req.teacher._id, so a
// teacher can only ever see subjects they're actually assigned to.
export const listMySubjects = asyncHandler(async (req, res) => {
  const pagination = parsePagination(req.query)
  const sort = parseSort(req.query, SORTABLE_FIELDS, { name: 1 })

  const filter = { teachers: req.teacher._id }
  if (req.query.status === 'active') filter.isActive = true
  if (req.query.status === 'inactive') filter.isActive = false
  if (req.query.search) {
    const regex = toSearchRegex(req.query.search)
    filter.$or = [{ name: regex }, { code: regex }]
  }

  const [items, total] = await Promise.all([
    Subject.find(filter)
      .populate('course', 'name code department')
      .sort(sort)
      .skip(pagination.skip)
      .limit(pagination.limit),
    Subject.countDocuments(filter),
  ])

  const formattedItems = items.map((s) => {
    const obj = s.toObject()
    return {
      ...obj,
      department: canonicalDepartment(obj.department || obj.course?.department),
    }
  })

  res.json({ success: true, data: { items: formattedItems, pagination: buildPaginationMeta(pagination, total) } })
})
