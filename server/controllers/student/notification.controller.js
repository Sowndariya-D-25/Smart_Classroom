import asyncHandler from '../../utils/asyncHandler.js'
import { Announcement, Notification, Subject, Attendance, AttendanceSession } from '../../models/index.js'
import {
  isLowAttendance,
  calculateAttendancePercentage,
  getEligibleSessionQuery,
  LOW_ATTENDANCE_THRESHOLD,
} from '../../utils/attendanceThreshold.js'

function mapSystemType(type) {
  switch (type) {
    case 'ATTENDANCE_MARKED':
      return 'Attendance'
    case 'FACE_RECOGNITION':
      return 'Face Recognition'
    case 'LOW_ATTENDANCE':
      return 'Low Attendance'
    case 'STUDENT_REGISTRATION':
      return 'Registration'
    case 'ANNOUNCEMENT':
      return 'Announcements'
    case 'CLASS_REMINDER':
    case 'SYSTEM':
    default:
      return 'System'
  }
}

// GET /api/student/notifications
// Retrieves announcements and notifications for the authenticated student
// with per-student read status isolation.
export const getStudentNotifications = asyncHandler(async (req, res) => {
  const userId = req.user._id
  const student = req.student
  const filter = (req.query.filter || 'all').toLowerCase()

  const now = new Date()

  // 1. Published announcements targeting students (published and not future scheduled)
  const announcements = await Announcement.find({
    targetAudience: { $in: ['All Students', 'All'] },
    isPublished: true,
    publishedAt: { $lte: now },
  })
    .sort({ createdAt: -1 })
    .populate('createdBy', 'name email role')
    .lean()

  const formattedAnnouncements = announcements.map((a) => {
    const isRead =
      Array.isArray(a.readBy) && a.readBy.some((id) => id.toString() === userId.toString())
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
      sentBy: a.createdBy?.name || 'Administrator',
      publishedAt: a.publishedAt || a.createdAt,
      createdAt: a.createdAt,
      isRead,
      link: null,
      metadata: {},
    }
  })

  // 2. Ensure dynamic Low Attendance Warnings exist in MongoDB as real Notification records
  if (student?.course) {
    const subjects = await Subject.find({ course: student.course, isActive: true }).select('name code')
    await Promise.all(
      subjects.map(async (subj) => {
        const sessionQuery = getEligibleSessionQuery(subj._id, student)
        const [totalConducted, attended] = await Promise.all([
          AttendanceSession.countDocuments(sessionQuery),
          Attendance.countDocuments({
            subject: subj._id,
            student: student._id,
            status: { $in: ['Present', 'Late'] },
          }),
        ])

        const percentage = calculateAttendancePercentage(attended, totalConducted)

        if (percentage !== null && isLowAttendance(percentage)) {
          const existing = await Notification.findOne({
            recipient: userId,
            type: 'LOW_ATTENDANCE',
            'metadata.subjectId': subj._id,
          })

          if (!existing) {
            await Notification.create({
              recipient: userId,
              type: 'LOW_ATTENDANCE',
              title: `Low Attendance Alert: ${subj.name}`,
              message: `Your attendance in ${subj.name} (${subj.code}) is currently ${percentage}%, which is below the mandatory ${LOW_ATTENDANCE_THRESHOLD}% threshold. Please attend upcoming classes to avoid exam debarment.`,
              isRead: false,
              link: '/student/subjects',
              metadata: { subjectId: subj._id, percentage, threshold: LOW_ATTENDANCE_THRESHOLD },
            })
          }
        }
      }),
    )
  }

  // 3. Fetch all system notifications directed to this student user (including persisted low-attendance alerts)
  const systemNotifs = await Notification.find({ recipient: userId })
    .sort({ createdAt: -1 })
    .lean()

  const formattedSystemNotifs = systemNotifs.map((n) => ({
    _id: n._id.toString(),
    category: n.type === 'LOW_ATTENDANCE' ? 'attendance' : n.type === 'FACE_RECOGNITION' ? 'attendance' : 'system',
    type: mapSystemType(n.type),
    rawType: n.type,
    title: n.title,
    message: n.message,
    date: '',
    time: '',
    venue: '',
    attachment: null,
    sentBy: n.type === 'LOW_ATTENDANCE' ? 'Attendance Office' : n.type === 'FACE_RECOGNITION' ? 'Face Recognition System' : 'System',
    publishedAt: n.createdAt,
    createdAt: n.createdAt,
    isRead: Boolean(n.isRead),
    link: n.link || null,
    metadata: n.metadata || {},
  }))

  // Combine real announcements and real system notifications from MongoDB
  const all = [...formattedAnnouncements, ...formattedSystemNotifs]

  // Sort newest first
  all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  const unreadCount = all.filter((n) => !n.isRead).length

  // Filter application matching teacher filters
  let filtered = all
  if (filter === 'announcements') {
    filtered = all.filter((n) => n.category === 'announcement')
  } else if (filter === 'attendance') {
    filtered = all.filter((n) => n.type === 'Attendance' || n.type === 'Low Attendance')
  } else if (filter === 'face_recognition' || filter === 'face-recognition' || filter === 'face') {
    filtered = all.filter((n) => n.type === 'Face Recognition')
  } else if (filter === 'system') {
    filtered = all.filter(
      (n) =>
        n.category === 'system' &&
        n.type !== 'Attendance' &&
        n.type !== 'Low Attendance' &&
        n.type !== 'Face Recognition',
    )
  }

  res.json({
    success: true,
    data: {
      notifications: filtered,
      items: filtered,
      unreadCount,
      total: all.length,
      totalCount: all.length,
    },
  })
})

// GET /api/student/notifications/unread-count
// Returns authenticated student's real unread notification and announcement count
export const getUnreadCount = asyncHandler(async (req, res) => {
  const userId = req.user._id

  const now = new Date()

  const [unreadAnnouncements, unreadNotifications] = await Promise.all([
    Announcement.countDocuments({
      targetAudience: { $in: ['All Students', 'All'] },
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

// PATCH /api/student/notifications/:id/read
// Marks a specific notification or announcement as read by the authenticated student
export const markNotificationRead = asyncHandler(async (req, res) => {
  const userId = req.user._id
  const { id } = req.params

  const now = new Date()

  // 1. Check if it's an Announcement authorized for this student
  const announcement = await Announcement.findOne({
    _id: id,
    targetAudience: { $in: ['All Students', 'All'] },
    isPublished: true,
    publishedAt: { $lte: now },
  })
  if (announcement) {
    await Announcement.findByIdAndUpdate(id, { $addToSet: { readBy: userId } })
    return res.json({ success: true, message: 'Announcement marked as read' })
  }

  // 2. Check if it's a direct Notification
  const notification = await Notification.findOne({ _id: id, recipient: userId })
  if (notification) {
    notification.isRead = true
    await notification.save()
    return res.json({ success: true, message: 'Notification marked as read' })
  }

  res.status(404)
  throw new Error('Notification not found')
})

// PATCH /api/student/notifications/read-all
// Marks all student announcements and personal notifications as read
export const markAllNotificationsRead = asyncHandler(async (req, res) => {
  const userId = req.user._id
  const now = new Date()

  await Promise.all([
    Announcement.updateMany(
      {
        targetAudience: { $in: ['All Students', 'All'] },
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
