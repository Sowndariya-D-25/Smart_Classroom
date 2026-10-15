import asyncHandler from '../../utils/asyncHandler.js'
import { Announcement, Teacher, Student } from '../../models/index.js'
import { toSearchRegex } from '../../utils/searchHelpers.js'

// GET /api/admin/announcements
export const getAnnouncements = asyncHandler(async (req, res) => {
  const { search, type, audience, priority, status, dateFrom, dateTo } = req.query

  const query = {}
  if (type) query.type = type
  if (priority) query.priority = priority

  if (audience) {
    if (audience === 'All Users' || audience === 'All') query.targetAudience = 'All'
    else if (audience === 'Teachers' || audience === 'All Teachers') query.targetAudience = 'All Teachers'
    else if (audience === 'Students' || audience === 'All Students') query.targetAudience = 'All Students'
    else query.targetAudience = audience
  }

  const now = new Date()

  if (status === 'published') {
    query.isPublished = true
    query.publishedAt = { $lte: now }
  } else if (status === 'scheduled') {
    query.isPublished = true
    query.publishedAt = { $gt: now }
  } else if (status === 'draft') {
    query.isPublished = false
  }

  if (dateFrom || dateTo) {
    query.createdAt = {}
    if (dateFrom) query.createdAt.$gte = new Date(dateFrom)
    if (dateTo) query.createdAt.$lte = new Date(dateTo + 'T23:59:59.999Z')
  }

  if (search && search.trim()) {
    const sRegex = toSearchRegex(search)
    query.$or = [{ title: sRegex }, { message: sRegex }]
  }

  const [announcements, allForCounts] = await Promise.all([
    Announcement.find(query)
      .sort({ createdAt: -1 })
      .populate('createdBy', 'name email role')
      .lean(),
    Announcement.find({}).select('isPublished publishedAt createdAt').lean(),
  ])

  // Real MongoDB summary counts
  let publishedCount = 0
  let scheduledCount = 0
  let draftCount = 0

  allForCounts.forEach((a) => {
    if (!a.isPublished) {
      draftCount++
    } else if (a.publishedAt && new Date(a.publishedAt) > now) {
      scheduledCount++
    } else {
      publishedCount++
    }
  })

  const formatted = announcements.map((a) => {
    let computedStatus = 'Draft'
    if (a.isPublished) {
      if (a.publishedAt && new Date(a.publishedAt) > now) {
        computedStatus = 'Scheduled'
      } else {
        computedStatus = 'Published'
      }
    }

    return {
      ...a,
      status: computedStatus,
      priority: a.priority || 'Normal',
      readCount: a.readBy ? a.readBy.length : 0,
    }
  })

  res.json({
    success: true,
    data: {
      items: formatted,
      total: formatted.length,
      summary: {
        total: allForCounts.length,
        published: publishedCount,
        scheduled: scheduledCount,
        drafts: draftCount,
      },
    },
  })
})

// GET /api/admin/announcements/:id
export const getAnnouncementById = asyncHandler(async (req, res) => {
  const announcement = await Announcement.findById(req.params.id)
    .populate('createdBy', 'name email')
    .populate('readBy', 'name email role')

  if (!announcement) {
    res.status(404)
    throw new Error('Announcement not found')
  }

  res.json({
    success: true,
    data: announcement,
  })
})

// POST /api/admin/announcements
export const createAnnouncement = asyncHandler(async (req, res) => {
  const {
    title,
    message,
    type,
    targetAudience,
    audience,
    priority,
    date,
    time,
    venue,
    attachment,
    isPublished,
    publishDate,
    publishTime,
  } = req.body

  if (!title || !message) {
    res.status(400)
    throw new Error('Title and message are required')
  }

  // Canonical audience mapping
  const rawAudience = audience || targetAudience || 'All'
  let resolvedAudience = 'All'
  if (rawAudience === 'Teachers' || rawAudience === 'All Teachers') resolvedAudience = 'All Teachers'
  else if (rawAudience === 'Students' || rawAudience === 'All Students') resolvedAudience = 'All Students'

  const shouldPublish = isPublished !== false

  let resolvedPublishedAt = shouldPublish ? new Date() : null
  if (shouldPublish && publishDate) {
    const combinedStr = publishTime ? `${publishDate}T${publishTime}:00` : `${publishDate}T00:00:00`
    const parsed = new Date(combinedStr)
    if (!isNaN(parsed.getTime())) {
      resolvedPublishedAt = parsed
    }
  }

  const announcement = await Announcement.create({
    title: title.trim(),
    message: message.trim(),
    type: type || 'General',
    targetAudience: resolvedAudience,
    priority: priority || 'Normal',
    date: date || publishDate || '',
    time: time || publishTime || '',
    venue: venue || '',
    attachment: attachment || null,
    createdBy: req.user._id,
    isPublished: shouldPublish,
    publishedAt: resolvedPublishedAt,
    readBy: [],
  })

  await announcement.populate('createdBy', 'name email')

  res.status(201).json({
    success: true,
    message: shouldPublish ? 'Announcement published successfully' : 'Announcement saved as draft',
    data: announcement,
  })
})

// PUT /api/admin/announcements/:id
export const updateAnnouncement = asyncHandler(async (req, res) => {
  const {
    title,
    message,
    type,
    targetAudience,
    audience,
    priority,
    date,
    time,
    venue,
    attachment,
    isPublished,
    publishDate,
    publishTime,
  } = req.body

  const announcement = await Announcement.findById(req.params.id)
  if (!announcement) {
    res.status(404)
    throw new Error('Announcement not found')
  }

  if (title !== undefined) announcement.title = title.trim()
  if (message !== undefined) announcement.message = message.trim()
  if (type !== undefined) announcement.type = type
  if (priority !== undefined) announcement.priority = priority

  if (audience !== undefined || targetAudience !== undefined) {
    const raw = audience || targetAudience
    if (raw === 'Teachers' || raw === 'All Teachers') announcement.targetAudience = 'All Teachers'
    else if (raw === 'Students' || raw === 'All Students') announcement.targetAudience = 'All Students'
    else announcement.targetAudience = 'All'
  }

  if (date !== undefined) announcement.date = date
  if (time !== undefined) announcement.time = time
  if (venue !== undefined) announcement.venue = venue
  if (attachment !== undefined) announcement.attachment = attachment

  if (isPublished !== undefined) {
    announcement.isPublished = isPublished
    if (isPublished) {
      if (publishDate) {
        const combined = publishTime ? `${publishDate}T${publishTime}:00` : `${publishDate}T00:00:00`
        announcement.publishedAt = new Date(combined)
      } else if (!announcement.publishedAt) {
        announcement.publishedAt = new Date()
      }
    }
  }

  await announcement.save()
  await announcement.populate('createdBy', 'name email')

  res.json({
    success: true,
    message: 'Announcement updated successfully',
    data: announcement,
  })
})

// DELETE /api/admin/announcements/:id
export const deleteAnnouncement = asyncHandler(async (req, res) => {
  const announcement = await Announcement.findById(req.params.id)
  if (!announcement) {
    res.status(404)
    throw new Error('Announcement not found')
  }

  await announcement.deleteOne()

  res.json({
    success: true,
    message: 'Announcement deleted successfully',
  })
})

// PATCH /api/admin/announcements/:id/publish
export const togglePublish = asyncHandler(async (req, res) => {
  const announcement = await Announcement.findById(req.params.id)
  if (!announcement) {
    res.status(404)
    throw new Error('Announcement not found')
  }

  announcement.isPublished = !announcement.isPublished
  if (announcement.isPublished && !announcement.publishedAt) {
    announcement.publishedAt = new Date()
  }

  await announcement.save()

  res.json({
    success: true,
    message: `Announcement ${announcement.isPublished ? 'published' : 'saved as draft'} successfully`,
    data: announcement,
  })
})
