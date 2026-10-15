import asyncHandler from '../../utils/asyncHandler.js'
import { Announcement, Notification } from '../../models/index.js'

/**
 * Maps raw model notification types to user-friendly category labels.
 */
function mapSystemType(type) {
  switch (type) {
    case 'ATTENDANCE_MARKED':
      return 'Attendance'
    case 'FACE_RECOGNITION':
      return 'Face Recognition'
    case 'LOW_ATTENDANCE':
      return 'Low Attendance'
    case 'STUDENT_REGISTRATION':
      return 'Student Registration'
    case 'ANNOUNCEMENT':
      return 'Announcements'
    case 'CLASS_REMINDER':
    case 'SYSTEM':
    default:
      return 'System'
  }
}

// GET /api/teacher/notifications
export const getNotifications = asyncHandler(async (req, res) => {
  const userId = req.user._id
  const filter = (req.query.filter || 'all').toLowerCase()

  const now = new Date()

  // 1. Fetch published announcements targeting teachers (published and not future scheduled)
  const announcements = await Announcement.find({
    targetAudience: { $in: ['All Teachers', 'All'] },
    isPublished: true,
    publishedAt: { $lte: now },
  })
    .sort({ createdAt: -1 })
    .populate('createdBy', 'name email role')
    .lean()

  const formattedAnnouncements = announcements.map((a) => {
    const isRead = Array.isArray(a.readBy) && a.readBy.some((id) => id.toString() === userId.toString())
    return {
      _id: a._id.toString(),
      category: 'announcement',
      type: a.type || 'General',
      rawType: 'ANNOUNCEMENT',
      title: a.title,
      message: a.message,
      date: a.date || '',
      time: a.time || '',
      venue: a.venue || '',
      attachment: a.attachment || null,
      sentBy: a.createdBy?.name || 'Admin',
      publishedAt: a.publishedAt || a.createdAt,
      createdAt: a.createdAt,
      isRead,
      link: null,
      metadata: {},
    }
  })

  // 2. Fetch system notifications directed to this teacher
  const systemNotifs = await Notification.find({ recipient: userId })
    .sort({ createdAt: -1 })
    .lean()

  const formattedSystemNotifs = systemNotifs.map((n) => ({
    _id: n._id.toString(),
    category: 'system',
    type: mapSystemType(n.type),
    rawType: n.type,
    title: n.title,
    message: n.message,
    date: '',
    time: '',
    venue: '',
    attachment: null,
    sentBy: 'System',
    publishedAt: n.createdAt,
    createdAt: n.createdAt,
    isRead: Boolean(n.isRead),
    link: n.link || null,
    metadata: n.metadata || {},
  }))

  // Combine both sources
  let all = [...formattedAnnouncements, ...formattedSystemNotifs]

  // Sort newest first
  all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  // Unread count
  const unreadCount = all.filter((item) => !item.isRead).length

  // Filter if requested
  let filtered = all
  if (filter === 'announcements') {
    filtered = all.filter((n) => n.category === 'announcement')
  } else if (filter === 'attendance') {
    filtered = all.filter((n) => n.type === 'Attendance')
  } else if (filter === 'face_recognition' || filter === 'face-recognition' || filter === 'face') {
    filtered = all.filter((n) => n.type === 'Face Recognition')
  } else if (filter === 'system') {
    filtered = all.filter(
      (n) =>
        n.category === 'system' &&
        n.type !== 'Attendance' &&
        n.type !== 'Face Recognition',
    )
  }

  res.json({
    success: true,
    data: {
      notifications: filtered,
      unreadCount,
      total: all.length,
    },
  })
})

// GET /api/teacher/notifications/unread-count
export const getUnreadCount = asyncHandler(async (req, res) => {
  const userId = req.user._id

  const now = new Date()

  const [unreadAnnouncements, unreadNotifications] = await Promise.all([
    Announcement.countDocuments({
      targetAudience: { $in: ['All Teachers', 'All'] },
      isPublished: true,
      publishedAt: { $lte: now },
      readBy: { $ne: userId },
    }),
    Notification.countDocuments({
      recipient: userId,
      isRead: false,
    }),
  ])

  res.json({
    success: true,
    data: {
      unreadCount: unreadAnnouncements + unreadNotifications,
    },
  })
})

// GET /api/teacher/notifications/:id
export const getNotificationById = asyncHandler(async (req, res) => {
  const { id } = req.params
  const userId = req.user._id

  const now = new Date()

  // Check announcement first (must be published and authorized for teachers)
  const announcement = await Announcement.findOne({
    _id: id,
    targetAudience: { $in: ['All Teachers', 'All'] },
    isPublished: true,
    publishedAt: { $lte: now },
  }).populate('createdBy', 'name email role')
  if (announcement) {
    if (!announcement.readBy.some((uid) => uid.toString() === userId.toString())) {
      announcement.readBy.push(userId)
      await announcement.save()
    }

    return res.json({
      success: true,
      data: {
        _id: announcement._id.toString(),
        category: 'announcement',
        type: announcement.type || 'General',
        rawType: 'ANNOUNCEMENT',
        title: announcement.title,
        message: announcement.message,
        date: announcement.date || '',
        time: announcement.time || '',
        venue: announcement.venue || '',
        attachment: announcement.attachment || null,
        sentBy: announcement.createdBy?.name || 'Admin',
        publishedAt: announcement.publishedAt || announcement.createdAt,
        createdAt: announcement.createdAt,
        isRead: true,
        link: null,
        metadata: {},
      },
    })
  }

  // Check system notification
  const notification = await Notification.findOne({ _id: id, recipient: userId })
  if (notification) {
    if (!notification.isRead) {
      notification.isRead = true
      await notification.save()
    }

    return res.json({
      success: true,
      data: {
        _id: notification._id.toString(),
        category: 'system',
        type: mapSystemType(notification.type),
        rawType: notification.type,
        title: notification.title,
        message: notification.message,
        date: '',
        time: '',
        venue: '',
        attachment: null,
        sentBy: 'System',
        publishedAt: notification.createdAt,
        createdAt: notification.createdAt,
        isRead: true,
        link: notification.link || null,
        metadata: notification.metadata || {},
      },
    })
  }

  res.status(404)
  throw new Error('Notification not found')
})

// PATCH /api/teacher/notifications/:id/read
export const markAsRead = asyncHandler(async (req, res) => {
  const { id } = req.params
  const userId = req.user._id

  const now = new Date()

  // Check announcement authorized for teachers
  const announcement = await Announcement.findOne({
    _id: id,
    targetAudience: { $in: ['All Teachers', 'All'] },
    isPublished: true,
    publishedAt: { $lte: now },
  })
  if (announcement) {
    await Announcement.findByIdAndUpdate(id, { $addToSet: { readBy: userId } })
    return res.json({
      success: true,
      message: 'Announcement marked as read',
    })
  }

  // Check system notification
  const notification = await Notification.findOne({ _id: id, recipient: userId })
  if (notification) {
    notification.isRead = true
    await notification.save()
    return res.json({
      success: true,
      message: 'Notification marked as read',
    })
  }

  res.status(404)
  throw new Error('Notification not found')
})

// PATCH /api/teacher/notifications/read-all
export const markAllAsRead = asyncHandler(async (req, res) => {
  const userId = req.user._id

  const now = new Date()

  await Promise.all([
    Announcement.updateMany(
      {
        targetAudience: { $in: ['All Teachers', 'All'] },
        isPublished: true,
        publishedAt: { $lte: now },
      },
      {
        $addToSet: { readBy: userId },
      },
    ),
    Notification.updateMany(
      {
        recipient: userId,
        isRead: false,
      },
      {
        $set: { isRead: true },
      },
    ),
  ])

  res.json({
    success: true,
    message: 'All notifications marked as read',
    data: {
      unreadCount: 0,
    },
  })
})
