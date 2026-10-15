import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bell,
  Megaphone,
  Calendar,
  CalendarDays,
  Sparkles,
  FileText,
  AlertTriangle,
  AlertCircle,
  ClipboardCheck,
  ScanFace,
  UserCheck,
  CheckCheck,
  Clock,
  MapPin,
  ExternalLink,
  X,
  Check,
  PlusCircle,
  Send,
  CalendarRange,
  FileCheck,
  ShieldCheck,
  LoaderCircle,
  Paperclip,
} from 'lucide-react'
import PageContainer from '../../components/layout/PageContainer'
import EmptyState from '../../components/common/EmptyState'
import StatusBadge from '../../components/common/StatusBadge'
import { useToast } from '../../context/ToastContext'
import {
  getStudentNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  applyODLeave,
  getMyODLeaveRequests,
  getMySubjects,
} from '../../services/studentService'

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'od_leave', label: 'My OD & Leave Requests' },
  { id: 'announcements', label: 'Announcements' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'face_recognition', label: 'Face Recognition' },
  { id: 'system', label: 'System' },
]

function getNotificationIcon(type, category) {
  if (category === 'announcement') {
    switch (type) {
      case 'Meeting':
        return <Calendar className="h-5 w-5 text-blue-600" />
      case 'Holiday':
        return <CalendarDays className="h-5 w-5 text-emerald-600" />
      case 'Event':
        return <Sparkles className="h-5 w-5 text-purple-600" />
      case 'Exam':
        return <FileText className="h-5 w-5 text-amber-600" />
      case 'Urgent':
        return <AlertTriangle className="h-5 w-5 text-danger" />
      case 'General':
      default:
        return <Megaphone className="h-5 w-5 text-primary" />
    }
  }

  switch (type) {
    case 'OD':
    case 'Leave':
    case 'OD_REQUEST':
    case 'LEAVE_REQUEST':
    case 'OD_LEAVE_DECISION':
      return <CalendarRange className="h-5 w-5 text-purple-600" />
    case 'Attendance':
      return <ClipboardCheck className="h-5 w-5 text-primary-600" />
    case 'Face Recognition':
      return <ScanFace className="h-5 w-5 text-accent-600" />
    case 'Low Attendance':
      return <AlertCircle className="h-5 w-5 text-amber-600" />
    case 'Registration':
    case 'Student Registration':
      return <UserCheck className="h-5 w-5 text-emerald-600" />
    case 'System':
    default:
      return <Bell className="h-5 w-5 text-muted" />
  }
}

function getTypeBadgeColor(type, category) {
  if (category === 'announcement') {
    switch (type) {
      case 'Meeting':
        return 'bg-blue-50 text-blue-700 border-blue-200'
      case 'Holiday':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200'
      case 'Event':
        return 'bg-purple-50 text-purple-700 border-purple-200'
      case 'Exam':
        return 'bg-amber-50 text-amber-700 border-amber-200'
      case 'Urgent':
        return 'bg-red-50 text-red-700 border-red-200'
      default:
        return 'bg-primary-50 text-primary-700 border-primary-200'
    }
  }

  switch (type) {
    case 'OD':
    case 'Leave':
    case 'OD_REQUEST':
    case 'LEAVE_REQUEST':
    case 'OD_LEAVE_DECISION':
      return 'bg-purple-50 text-purple-700 border-purple-200'
    case 'Attendance':
      return 'bg-primary-50 text-primary-700 border-primary-200'
    case 'Face Recognition':
      return 'bg-accent-50 text-accent-700 border-accent-200'
    case 'Low Attendance':
      return 'bg-amber-50 text-amber-700 border-amber-200'
    case 'Registration':
    case 'Student Registration':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    default:
      return 'bg-canvas text-muted border-line'
  }
}

export default function StudentNotifications() {
  const toast = useToast()
  const navigate = useNavigate()
  const [activeFilter, setActiveFilter] = useState('all')
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null)

  // OD & Leave Requests State
  const [odRequests, setOdRequests] = useState([])
  const [requestsLoading, setRequestsLoading] = useState(false)
  const [requestStatusFilter, setRequestStatusFilter] = useState('all')
  const [showApplyModal, setShowApplyModal] = useState(false)
  const [submittingRequest, setSubmittingRequest] = useState(false)
  const [enrolledSubjects, setEnrolledSubjects] = useState([])

  // Form State
  const [formType, setFormType] = useState('OD')
  const [formStartDate, setFormStartDate] = useState('')
  const [formEndDate, setFormEndDate] = useState('')
  const [formSelectedSubjects, setFormSelectedSubjects] = useState([])
  const [formReason, setFormReason] = useState('')
  const [formDocumentName, setFormDocumentName] = useState('')
  const [formDocumentUrl, setFormDocumentUrl] = useState('')

  const loadNotifications = async (filter = activeFilter) => {
    try {
      setLoading(true)
      const res = await getStudentNotifications({ filter })
      setNotifications(res.notifications || res.items || [])
      setUnreadCount(res.unreadCount || 0)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not load notifications.')
    } finally {
      setLoading(false)
    }
  }

  const loadRequests = async (status = requestStatusFilter) => {
    try {
      setRequestsLoading(true)
      const data = await getMyODLeaveRequests({
        status: status === 'all' ? undefined : status,
      })
      setOdRequests(data || [])
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not load OD/Leave requests.')
    } finally {
      setRequestsLoading(false)
    }
  }

  useEffect(() => {
    if (activeFilter === 'od_leave') {
      loadRequests(requestStatusFilter)
    } else {
      loadNotifications(activeFilter)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilter, requestStatusFilter])

  useEffect(() => {
    getMySubjects()
      .then((data) => setEnrolledSubjects(data || []))
      .catch(() => {})
  }, [])

  const handleMarkAsRead = async (id, e) => {
    if (e) e.stopPropagation()
    try {
      await markNotificationRead(id)
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n)),
      )
      setUnreadCount((c) => Math.max(0, c - 1))
      toast.success('Marked as read')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update notification status.')
    }
  }

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead()
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
      setUnreadCount(0)
      toast.success('All notifications marked as read')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not mark all notifications as read.')
    }
  }

  const handleNotificationClick = (item) => {
    if (!item.isRead) {
      handleMarkAsRead(item._id)
    }

    if (item.category === 'announcement') {
      setSelectedAnnouncement(item)
    } else if (item.type === 'OD_LEAVE_DECISION' || item.type === 'OD_REQUEST' || item.type === 'LEAVE_REQUEST') {
      setActiveFilter('od_leave')
    } else if (item.link) {
      navigate(item.link)
    }
  }

  const handleApplySubmit = async (e) => {
    e.preventDefault()
    if (!formStartDate || !formEndDate) {
      toast.error('Please specify both start date and end date.')
      return
    }
    if (new Date(formEndDate) < new Date(formStartDate)) {
      toast.error('End date cannot be earlier than start date.')
      return
    }
    if (!formReason.trim() || formReason.trim().length < 3) {
      toast.error('Please provide a reason of at least 3 characters.')
      return
    }

    setSubmittingRequest(true)
    try {
      const payload = {
        type: formType,
        startDate: formStartDate,
        endDate: formEndDate,
        subjects: formSelectedSubjects,
        reason: formReason.trim(),
        documentName: formDocumentName.trim() || null,
        documentUrl: formDocumentUrl.trim() || null,
      }
      const res = await applyODLeave(payload)
      toast.success(res.message || `${formType} request submitted successfully!`)
      setShowApplyModal(false)
      // Reset form
      setFormType('OD')
      setFormStartDate('')
      setFormEndDate('')
      setFormSelectedSubjects([])
      setFormReason('')
      setFormDocumentName('')
      setFormDocumentUrl('')
      setActiveFilter('od_leave')
      loadRequests(requestStatusFilter)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit request.')
    } finally {
      setSubmittingRequest(false)
    }
  }

  const toggleSubjectSelection = (subjId) => {
    setFormSelectedSubjects((prev) =>
      prev.includes(subjId) ? prev.filter((id) => id !== subjId) : [...prev, subjId],
    )
  }

  return (
    <PageContainer>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            Notifications &amp; OD Requests
          </h1>
          <p className="mt-1 text-sm text-muted">
            Track official announcements, apply for On-Duty (OD) / Leave, and view real-time approval decisions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setShowApplyModal(true)}
            className="btn-primary inline-flex items-center gap-2 !px-4.5 !py-2.5 !text-xs !font-bold shadow-sm hover:shadow-md"
          >
            <PlusCircle size={15} />
            <span>Apply for OD / Leave</span>
          </button>

          {unreadCount > 0 && activeFilter !== 'od_leave' && (
            <button
              onClick={handleMarkAllRead}
              className="btn-secondary inline-flex items-center gap-2 text-xs font-semibold text-primary-700 hover:bg-primary-50"
            >
              <CheckCheck size={16} />
              Mark All as Read ({unreadCount})
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line pb-4 mt-6">
        {FILTERS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveFilter(tab.id)}
            className={`rounded-full px-4 py-2 text-xs font-bold transition-all ${
              activeFilter === tab.id
                ? 'bg-ink text-white shadow-xs'
                : 'bg-white text-muted border border-line hover:bg-canvas hover:text-ink'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* OD & Leave Requests View */}
      {activeFilter === 'od_leave' && (
        <div className="mt-6 space-y-4">
          {/* Sub-status filters */}
          <div className="flex items-center justify-between flex-wrap gap-3 rounded-2xl bg-white border border-line/90 p-3 shadow-2xs">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-muted uppercase tracking-wider pl-1">Status:</span>
              {['all', 'Pending', 'Approved', 'Rejected'].map((st) => (
                <button
                  key={st}
                  onClick={() => setRequestStatusFilter(st)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                    requestStatusFilter === st
                      ? 'bg-primary text-white shadow-xs'
                      : 'bg-slate-50 text-muted hover:bg-slate-100 hover:text-ink'
                  }`}
                >
                  {st === 'all' ? 'All Requests' : st}
                </button>
              ))}
            </div>

            <p className="text-xs text-muted font-medium">
              Showing <strong className="text-ink">{odRequests.length}</strong> request{odRequests.length === 1 ? '' : 's'}
            </p>
          </div>

          {requestsLoading ? (
            <div className="flex min-h-[250px] items-center justify-center">
              <p className="text-sm font-semibold text-muted animate-pulse">Loading OD / Leave requests…</p>
            </div>
          ) : odRequests.length === 0 ? (
            <EmptyState
              icon={CalendarRange}
              title="No requests found"
              description={
                requestStatusFilter === 'all'
                  ? 'You have not submitted any On-Duty or Leave requests yet. Click "Apply for OD / Leave" above to create one.'
                  : `No ${requestStatusFilter} requests on record.`
              }
            />
          ) : (
            <div className="space-y-4">
              {odRequests.map((req) => {
                const startDateStr = new Date(req.startDate).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
                const endDateStr = new Date(req.endDate).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
                const isPending = req.status === 'Pending'
                const isApproved = req.status === 'Approved'
                const isRejected = req.status === 'Rejected'

                return (
                  <div
                    key={req._id}
                    className="card rounded-[22px] border border-line/90 bg-white p-5 sm:p-6 shadow-card hover:shadow-card-hover transition-all"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 border-b border-line/70 pb-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                            req.type === 'OD' ? 'bg-purple-50 text-purple-700 border border-purple-200' : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}
                        >
                          <CalendarRange size={20} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`rounded-md px-2.5 py-0.5 text-xs font-black uppercase tracking-wider ${
                                req.type === 'OD' ? 'bg-purple-100 text-purple-900' : 'bg-blue-100 text-blue-900'
                              }`}
                            >
                              {req.type === 'OD' ? 'On-Duty (OD)' : 'Leave'}
                            </span>
                            <StatusBadge status={req.status} />
                          </div>
                          <p className="text-xs text-muted mt-1 font-medium">
                            Submitted on {new Date(req.createdAt).toLocaleDateString()} at{' '}
                            {new Date(req.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>

                      <div className="rounded-xl border border-line bg-canvas/70 px-3.5 py-2 text-right">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Request Duration</p>
                        <p className="text-xs font-black text-ink mt-0.5">
                          {startDateStr} {startDateStr !== endDateStr ? `– ${endDateStr}` : '(Single Day)'}
                        </p>
                      </div>
                    </div>

                    {/* Request Details */}
                    <div className="mt-4 space-y-3 text-xs">
                      <div>
                        <span className="font-bold text-muted uppercase text-[10px] tracking-wider">Reason:</span>
                        <p className="mt-1 text-ink font-medium leading-relaxed bg-[#F9FAF8] rounded-xl p-3 border border-line/60">
                          {req.reason}
                        </p>
                      </div>

                      {/* Affected Subjects */}
                      {req.subjects && req.subjects.length > 0 && (
                        <div>
                          <span className="font-bold text-muted uppercase text-[10px] tracking-wider">
                            Applicable Subjects:
                          </span>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {req.subjects.map((sub) => (
                              <span
                                key={sub._id || sub}
                                className="rounded-lg bg-sage-50 border border-line px-2.5 py-1 text-xs font-bold text-ink"
                              >
                                {sub.name ? `${sub.name} (${sub.code})` : sub}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Supporting Document */}
                      {(req.documentName || req.documentUrl) && (
                        <div className="flex items-center gap-2 pt-1">
                          <Paperclip size={14} className="text-muted" />
                          <span className="font-bold text-muted">Attachment:</span>
                          {req.documentUrl ? (
                            <a
                              href={req.documentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-bold text-primary hover:underline inline-flex items-center gap-1"
                            >
                              <span>{req.documentName || 'Supporting Document'}</span>
                              <ExternalLink size={12} />
                            </a>
                          ) : (
                            <span className="text-ink font-semibold">{req.documentName}</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Decision Outcome Trail */}
                    <div className="mt-5 pt-4 border-t border-line/70">
                      {isApproved && (
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 text-emerald-950 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                            <span className="text-xs font-bold">
                              Approved by {req.reviewedBy?.name || req.reviewerRole || 'Faculty Reviewer'} on{' '}
                              {new Date(req.reviewedAt).toLocaleDateString()}
                            </span>
                          </div>
                          {req.reviewerRemarks && (
                            <p className="text-xs italic text-emerald-800">
                              Remarks: &ldquo;{req.reviewerRemarks}&rdquo;
                            </p>
                          )}
                        </div>
                      )}

                      {isRejected && (
                        <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-3 text-rose-950">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
                            <span className="text-xs font-extrabold text-rose-800">
                              Rejected on {new Date(req.reviewedAt).toLocaleDateString()} by{' '}
                              {req.reviewedBy?.name || req.reviewerRole || 'Faculty Reviewer'}
                            </span>
                          </div>
                          {req.reviewerRemarks && (
                            <p className="mt-1 text-xs text-rose-800 leading-relaxed">
                              <strong>Rejection Reason:</strong> {req.reviewerRemarks}
                            </p>
                          )}
                        </div>
                      )}

                      {isPending && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-amber-900 flex items-center gap-2">
                          <Clock className="h-4 w-4 text-amber-600 shrink-0 animate-pulse" />
                          <span className="text-xs font-bold">
                            Request is under review by designated faculty and administration.
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Notifications List View (when activeFilter !== 'od_leave') */}
      {activeFilter !== 'od_leave' && (
        <>
          {loading ? (
            <div className="flex min-h-[300px] items-center justify-center">
              <p className="text-sm font-semibold text-muted animate-pulse">Loading notifications…</p>
            </div>
          ) : notifications.length === 0 ? (
            <EmptyState
              icon={Bell}
              title="No notifications available"
              description={
                activeFilter === 'all'
                  ? 'When announcements or attendance events occur, they will appear here.'
                  : `No notifications found under the "${FILTERS.find((f) => f.id === activeFilter)?.label}" category.`
              }
            />
          ) : (
            <div className="space-y-3.5 mt-6">
          {notifications.map((item) => (
            <div
              key={item._id}
              onClick={() => handleNotificationClick(item)}
              className={`group relative flex cursor-pointer flex-col gap-3.5 rounded-2xl border p-5 sm:flex-row sm:items-start sm:gap-4 transition-all duration-200 hover:shadow-card-hover hover:-translate-y-0.5 ${
                !item.isRead
                  ? 'border-primary/40 bg-primary/[0.03] shadow-xs'
                  : 'border-line/80 bg-white hover:bg-canvas/50'
              }`}
            >
              {/* Icon */}
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${
                  !item.isRead ? 'bg-white border-primary/20 text-primary shadow-xs' : 'bg-canvas border-line text-muted'
                }`}
              >
                {getNotificationIcon(item.type, item.category)}
              </div>

              {/* Main Content */}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-[11px] font-bold ${getTypeBadgeColor(
                      item.type,
                      item.category,
                    )}`}
                  >
                    {item.type}
                  </span>

                  <span className="text-[11px] font-semibold text-muted">
                    {item.category === 'announcement' ? 'Admin Announcement' : 'System Alert'}
                  </span>

                  <span className="text-xs text-muted/60">•</span>

                  <span className="text-[11px] font-medium text-muted">
                    {new Date(item.publishedAt || item.createdAt).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>

                  {!item.isRead && (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-rose-600">
                      <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                      Unread
                    </span>
                  )}
                </div>

                <h3
                  className={`mt-1.5 text-base font-extrabold font-display leading-snug ${
                    !item.isRead ? 'text-ink' : 'text-ink/90'
                  }`}
                >
                  {item.title}
                </h3>

                <p className="mt-1 whitespace-pre-line text-xs text-muted leading-relaxed line-clamp-3">
                  {item.message}
                </p>

                {/* Announcement Details Snippet */}
                {item.category === 'announcement' && (item.date || item.time || item.venue) && (
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-pine-600">
                    {item.date && (
                      <span className="inline-flex items-center gap-1.5 font-medium">
                        <Clock size={13} className="text-olive-700" />
                        {item.date} {item.time ? `at ${item.time}` : ''}
                      </span>
                    )}
                    {item.venue && (
                      <span className="inline-flex items-center gap-1.5 font-medium">
                        <MapPin size={13} className="text-accent" />
                        {item.venue}
                      </span>
                    )}
                    <span className="text-pine-500 font-medium">Sent by: {item.sentBy}</span>
                  </div>
                )}

                {/* System notification link action */}
                {item.category === 'system' && item.link && (
                  <div className="mt-2.5 flex items-center gap-1 text-xs font-bold text-olive-700 group-hover:underline">
                    <span>View details</span>
                    <ExternalLink size={12} />
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 self-end sm:self-center">
                {!item.isRead && (
                  <button
                    onClick={(e) => handleMarkAsRead(item._id, e)}
                    title="Mark as read"
                    className="flex h-8 items-center gap-1.5 rounded-lg border border-pine-900/10 bg-white px-3 text-xs font-semibold text-pine-700 hover:bg-ivory hover:text-pine-950 transition-colors shadow-xs"
                  >
                    <Check size={14} />
                    <span>Mark as Read</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )}

      {/* Admin Announcement Detail Modal */}
      {selectedAnnouncement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-pine-950/60 p-4 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-lg rounded-3xl border border-pine-900/10 bg-white p-7 shadow-xl space-y-4">
            <button
              onClick={() => setSelectedAnnouncement(null)}
              className="absolute right-5 top-5 rounded-xl p-2 text-pine-500 hover:bg-ivory hover:text-pine-950"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getTypeBadgeColor(
                  selectedAnnouncement.type,
                  'announcement',
                )}`}
              >
                {selectedAnnouncement.type}
              </span>
              <span className="text-xs font-semibold text-pine-600">Admin Announcement</span>
            </div>

            <h2 className="mt-2.5 text-xl font-bold tracking-tight text-pine-950">
              {selectedAnnouncement.title}
            </h2>

            <div className="mt-4 rounded-2xl bg-ivory/50 border border-pine-900/10 p-5 text-sm leading-relaxed text-pine-900 whitespace-pre-line">
              {selectedAnnouncement.message}
            </div>

            <div className="mt-5 space-y-2.5 border-t border-pine-900/10 pt-4 text-xs text-pine-700">
              {selectedAnnouncement.date && (
                <div className="flex items-center justify-between">
                  <span className="font-bold text-pine-950">Event Date:</span>
                  <span>{selectedAnnouncement.date}</span>
                </div>
              )}
              {selectedAnnouncement.time && (
                <div className="flex items-center justify-between">
                  <span className="font-bold text-pine-950">Time:</span>
                  <span>{selectedAnnouncement.time}</span>
                </div>
              )}
              {selectedAnnouncement.venue && (
                <div className="flex items-center justify-between">
                  <span className="font-bold text-pine-950">Venue:</span>
                  <span>{selectedAnnouncement.venue}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="font-bold text-pine-950">Sent By:</span>
                <span>{selectedAnnouncement.sentBy}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-pine-950">Published:</span>
                <span>
                  {new Date(
                    selectedAnnouncement.publishedAt || selectedAnnouncement.createdAt,
                  ).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedAnnouncement(null)}
                className="btn-primary px-6 py-2.5 text-xs font-semibold shadow-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Apply for OD / Leave Modal */}
      {showApplyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="relative w-full max-w-lg rounded-3xl border border-line bg-white p-6 sm:p-7 shadow-2xl my-8">
            <button
              onClick={() => setShowApplyModal(false)}
              className="absolute right-5 top-5 rounded-xl p-2 text-muted hover:bg-slate-100 hover:text-ink transition"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <PlusCircle size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold font-display text-ink">Apply for OD / Leave</h2>
                <p className="text-xs text-muted">Submit an official request for faculty and administrative review</p>
              </div>
            </div>

            <form onSubmit={handleApplySubmit} className="mt-5 space-y-4">
              {/* Request Type Selector */}
              <div>
                <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-1.5">
                  Request Type <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormType('OD')}
                    className={`rounded-xl border p-3 text-left transition-all ${
                      formType === 'OD'
                        ? 'border-purple-500 bg-purple-50/70 text-purple-900 ring-2 ring-purple-500/20 shadow-xs'
                        : 'border-line bg-white text-muted hover:border-slate-300'
                    }`}
                  >
                    <span className="block font-black text-sm">On-Duty (OD)</span>
                    <span className="block text-[11px] text-muted mt-0.5">Academic events, symposiums, sports</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormType('Leave')}
                    className={`rounded-xl border p-3 text-left transition-all ${
                      formType === 'Leave'
                        ? 'border-blue-500 bg-blue-50/70 text-blue-900 ring-2 ring-blue-500/20 shadow-xs'
                        : 'border-line bg-white text-muted hover:border-slate-300'
                    }`}
                  >
                    <span className="block font-black text-sm">Leave</span>
                    <span className="block text-[11px] text-muted mt-0.5">Medical, personal, or emergency</span>
                  </button>
                </div>
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-ink mb-1">
                    Start Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                    className="w-full rounded-xl border border-line bg-canvas/40 px-3 py-2 text-xs text-ink focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-ink mb-1">
                    End Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                    className="w-full rounded-xl border border-line bg-canvas/40 px-3 py-2 text-xs text-ink focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              {/* Affected Subjects Selection */}
              {enrolledSubjects.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-ink">
                      Affected Subjects (Optional)
                    </label>
                    <span className="text-[11px] text-muted">
                      {formSelectedSubjects.length === 0 ? 'Applies to all subjects' : `${formSelectedSubjects.length} selected`}
                    </span>
                  </div>
                  <div className="max-h-32 overflow-y-auto rounded-xl border border-line p-2 space-y-1.5 bg-canvas/30">
                    {enrolledSubjects.map((sub) => (
                      <label
                        key={sub._id}
                        className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white transition cursor-pointer text-xs"
                      >
                        <input
                          type="checkbox"
                          checked={formSelectedSubjects.includes(sub._id)}
                          onChange={() => toggleSubjectSelection(sub._id)}
                          className="rounded border-line text-primary focus:ring-primary/20 h-3.5 w-3.5"
                        />
                        <span className="font-semibold text-ink">{sub.name}</span>
                        <span className="font-mono text-[10px] text-muted uppercase">({sub.code})</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Reason */}
              <div>
                <label className="block text-xs font-bold text-ink mb-1">
                  Reason for Request <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={formReason}
                  onChange={(e) => setFormReason(e.target.value)}
                  placeholder="State the objective, official event, or medical reason..."
                  className="w-full rounded-xl border border-line bg-canvas/40 p-3 text-xs text-ink placeholder:text-muted focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {/* Supporting Document / Evidence */}
              <div>
                <label className="block text-xs font-bold text-ink mb-1">
                  Supporting Document Reference (Optional)
                </label>
                <input
                  type="text"
                  value={formDocumentName}
                  onChange={(e) => setFormDocumentName(e.target.value)}
                  placeholder="e.g. Hackathon Certificate / Medical Letter / Event ID"
                  className="w-full rounded-xl border border-line bg-canvas/40 px-3 py-2 text-xs text-ink placeholder:text-muted focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => setShowApplyModal(false)}
                  className="btn-secondary !px-4 !py-2 !text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingRequest}
                  className="btn-primary inline-flex items-center gap-2 !px-5 !py-2 !text-xs font-bold shadow-sm"
                >
                  {submittingRequest && <LoaderCircle size={14} className="animate-spin" />}
                  <span>{submittingRequest ? 'Submitting…' : 'Submit Request'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PageContainer>
  )
}
