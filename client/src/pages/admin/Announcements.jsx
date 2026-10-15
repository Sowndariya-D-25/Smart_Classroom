import { useEffect, useState } from 'react'
import { FiX } from 'react-icons/fi'
import {
  Bell,
  Plus,
  Trash2,
  Edit2,
  Calendar,
  Clock,
  MapPin,
  Eye,
  Search,
  Filter,
  AlertTriangle,
  RotateCcw,
  CheckCircle,
  FileText,
  Users,
} from 'lucide-react'
import PageContainer from '../../components/layout/PageContainer'
import AdminPageHeader from '../../components/admin/AdminPageHeader'
import StatCard from '../../components/common/StatCard'
import StatusBadge from '../../components/common/StatusBadge'
import EmptyState from '../../components/common/EmptyState'
import { inputClass } from '../../components/FormField'
import { useToast } from '../../context/ToastContext'
import { announcementsApi } from '../../services/adminService'

const ANNOUNCEMENT_TYPES = ['General', 'Event', 'Holiday', 'Meeting', 'Exam', 'Urgent']
const PRIORITIES = ['Normal', 'High', 'Urgent']
const AUDIENCES = ['All Users', 'Teachers', 'Students']

const INITIAL_FORM = {
  title: '',
  message: '',
  type: 'General',
  priority: 'Normal',
  audience: 'All Users',
  publishDate: new Date().toISOString().split('T')[0],
  publishTime: '09:00',
  venue: '',
  isPublished: true,
}

export default function Announcements() {
  const toast = useToast()

  const [announcements, setAnnouncements] = useState([])
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState({
    total: 0,
    published: 0,
    scheduled: 0,
    drafts: 0,
  })

  // Filters
  const [filters, setFilters] = useState({
    search: '',
    type: '',
    audience: '',
    priority: '',
    status: '',
    dateFrom: '',
    dateTo: '',
  })

  // Create / Edit modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState(INITIAL_FORM)
  const [formError, setFormError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  // View modal state
  const [viewItem, setViewItem] = useState(null)

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const loadAnnouncements = async (activeFilters = filters) => {
    try {
      setLoading(true)
      const res = await announcementsApi.list(activeFilters)
      const items = res.items || res || []
      setAnnouncements(items)
      if (res.summary) {
        setSummary(res.summary)
      } else {
        const published = items.filter((a) => a.status === 'Published').length
        const scheduled = items.filter((a) => a.status === 'Scheduled').length
        const drafts = items.filter((a) => a.status === 'Draft').length
        setSummary({
          total: items.length,
          published,
          scheduled,
          drafts,
        })
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not load announcements.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAnnouncements(filters)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleFilterChange = (field, val) => {
    const updated = { ...filters, [field]: val }
    setFilters(updated)
    loadAnnouncements(updated)
  }

  const resetFilters = () => {
    const reset = {
      search: '',
      type: '',
      audience: '',
      priority: '',
      status: '',
      dateFrom: '',
      dateTo: '',
    }
    setFilters(reset)
    loadAnnouncements(reset)
  }

  const handleOpenCreate = () => {
    setEditingId(null)
    setFormData(INITIAL_FORM)
    setFormError(null)
    setIsModalOpen(true)
  }

  const handleOpenEdit = (item) => {
    setEditingId(item._id)
    let aud = 'All Users'
    if (item.targetAudience === 'All Teachers') aud = 'Teachers'
    else if (item.targetAudience === 'All Students') aud = 'Students'

    setFormData({
      title: item.title,
      message: item.message,
      type: item.type || 'General',
      priority: item.priority || 'Normal',
      audience: aud,
      publishDate: item.date || item.publishedAt ? new Date(item.publishedAt || item.date).toISOString().split('T')[0] : '',
      publishTime: item.time || '09:00',
      venue: item.venue || '',
      isPublished: item.isPublished !== false,
    })
    setFormError(null)
    setIsModalOpen(true)
  }

  const handleSubmit = async (publishImmediate = true) => {
    if (!formData.title.trim()) {
      setFormError('Title is required')
      return
    }
    if (!formData.message.trim()) {
      setFormError('Message / description is required')
      return
    }

    setSubmitting(true)
    setFormError(null)

    try {
      const payload = {
        title: formData.title.trim(),
        message: formData.message.trim(),
        type: formData.type,
        priority: formData.priority,
        audience: formData.audience,
        publishDate: formData.publishDate,
        publishTime: formData.publishTime,
        venue: formData.venue.trim(),
        isPublished: publishImmediate,
      }

      if (editingId) {
        await announcementsApi.update(editingId, payload)
        toast.success('Announcement updated successfully.')
      } else {
        await announcementsApi.create(payload)
        toast.success(
          publishImmediate
            ? 'Announcement published! Teachers & students notified.'
            : 'Announcement saved as draft.',
        )
      }

      setIsModalOpen(false)
      loadAnnouncements(filters)
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to save announcement.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      await announcementsApi.remove(deleteTarget._id)
      toast.success('Announcement deleted.')
      setDeleteTarget(null)
      loadAnnouncements(filters)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not delete announcement.')
    } finally {
      setDeleteLoading(false)
    }
  }

  const getPriorityBadge = (priority) => {
    switch (priority) {
      case 'Urgent':
        return 'bg-rose-50 text-rose-700 border border-rose-200'
      case 'High':
        return 'bg-amber-50 text-amber-700 border border-amber-200'
      default:
        return 'bg-slate-100 text-slate-700'
    }
  }

  const getTypeBadge = (type) => {
    switch (type) {
      case 'Urgent':
        return 'bg-rose-50 text-rose-700'
      case 'Exam':
        return 'bg-purple-50 text-purple-700'
      case 'Holiday':
        return 'bg-emerald-50 text-emerald-700'
      case 'Meeting':
        return 'bg-blue-50 text-blue-700'
      case 'Event':
        return 'bg-indigo-50 text-indigo-700'
      default:
        return 'bg-slate-100 text-slate-700'
    }
  }

  return (
    <PageContainer>
      <AdminPageHeader
        title="Announcements"
        subtitle="Create and manage announcements for students and teachers."
        actionLabel="Create Announcement"
        onAction={handleOpenCreate}
      />

      {/* Exactly 4 Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Bell}
          label="Total Announcements"
          value={loading ? '…' : summary.total}
          subtext="Institutional communications"
          colorScheme="purple"
        />
        <StatCard
          icon={CheckCircle}
          label="Published"
          value={loading ? '…' : summary.published}
          subtext="Active notifications"
          colorScheme="emerald"
        />
        <StatCard
          icon={Clock}
          label="Scheduled"
          value={loading ? '…' : summary.scheduled}
          subtext="Future scheduled releases"
          colorScheme="amber"
        />
        <StatCard
          icon={FileText}
          label="Drafts"
          value={loading ? '…' : summary.drafts}
          subtext="Unpublished records"
          colorScheme="blue"
        />
      </div>

      {/* Filters Toolbar */}
      <div className="mt-6 rounded-[22px] border border-line bg-surface p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-primary" />
            <span className="text-xs font-bold uppercase tracking-wider text-muted">
              Search & Filter Announcements
            </span>
          </div>
          <button
            onClick={resetFilters}
            className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-medium text-muted transition hover:bg-surface-subtle hover:text-ink"
          >
            <RotateCcw size={13} /> Reset Filters
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {/* Search */}
          <div className="col-span-2">
            <label className="text-[11px] font-semibold text-muted">Search</label>
            <div className="relative mt-1">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
              <input
                type="text"
                placeholder="Search by title or message…"
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="h-10 w-full rounded-xl border border-line bg-background pl-9 pr-3 text-xs text-ink placeholder:text-muted/60 focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          {/* Type */}
          <div>
            <label className="text-[11px] font-semibold text-muted">Type</label>
            <select
              value={filters.type}
              onChange={(e) => handleFilterChange('type', e.target.value)}
              className="mt-1 h-10 w-full rounded-xl border border-line bg-background px-3 text-xs text-ink focus:border-primary focus:outline-none"
            >
              <option value="">All Types</option>
              {ANNOUNCEMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* Audience */}
          <div>
            <label className="text-[11px] font-semibold text-muted">Audience</label>
            <select
              value={filters.audience}
              onChange={(e) => handleFilterChange('audience', e.target.value)}
              className="mt-1 h-10 w-full rounded-xl border border-line bg-background px-3 text-xs text-ink focus:border-primary focus:outline-none"
            >
              <option value="">All Audiences</option>
              {AUDIENCES.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          {/* Priority */}
          <div>
            <label className="text-[11px] font-semibold text-muted">Priority</label>
            <select
              value={filters.priority}
              onChange={(e) => handleFilterChange('priority', e.target.value)}
              className="mt-1 h-10 w-full rounded-xl border border-line bg-background px-3 text-xs text-ink focus:border-primary focus:outline-none"
            >
              <option value="">All Priorities</option>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="text-[11px] font-semibold text-muted">Status</label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="mt-1 h-10 w-full rounded-xl border border-line bg-background px-3 text-xs text-ink focus:border-primary focus:outline-none"
            >
              <option value="">All Statuses</option>
              <option value="published">Published</option>
              <option value="scheduled">Scheduled</option>
              <option value="draft">Draft</option>
            </select>
          </div>
        </div>
      </div>

      {/* Announcements Table */}
      <div className="mt-6 overflow-hidden rounded-[22px] border border-line bg-surface shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-line bg-surface-subtle font-semibold text-muted">
              <tr>
                <th className="p-3.5">Title</th>
                <th className="p-3.5">Type</th>
                <th className="p-3.5">Audience</th>
                <th className="p-3.5">Priority</th>
                <th className="p-3.5">Published</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {announcements.length > 0 ? (
                announcements.map((row) => (
                  <tr key={row._id} className="transition hover:bg-primary/[0.02]">
                    <td className="p-3.5">
                      <p className="font-semibold text-ink line-clamp-1">
                        {row.title}
                      </p>
                      <p className="text-muted text-[11px] line-clamp-1">{row.message}</p>
                    </td>
                    <td className="p-3.5">
                      <span className={`inline-flex rounded-lg px-2 py-0.5 text-[11px] font-semibold ${getTypeBadge(row.type)}`}>
                        {row.type || 'General'}
                      </span>
                    </td>
                    <td className="p-3.5 font-medium text-ink">
                      {row.targetAudience === 'All' ? 'All Users' : row.targetAudience}
                    </td>
                    <td className="p-3.5">
                      <span className={`inline-flex rounded-lg px-2 py-0.5 text-[11px] font-semibold ${getPriorityBadge(row.priority)}`}>
                        {row.priority || 'Normal'}
                      </span>
                    </td>
                    <td className="p-3.5 text-muted">
                      {row.publishedAt
                        ? new Date(row.publishedAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })
                        : '—'}
                    </td>
                    <td className="p-3.5">
                      <StatusBadge status={row.status || (row.isPublished ? 'Published' : 'Draft')} />
                    </td>
                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setViewItem(row)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface text-muted transition hover:bg-surface-subtle hover:text-ink"
                          title="View Announcement"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(row)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface text-muted transition hover:bg-surface-subtle hover:text-ink"
                          title="Edit"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(row)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50/50 text-rose-600 transition hover:bg-rose-100"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted">
                    No announcements found matching your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-[24px] border border-line bg-surface shadow-2xl">
            <div className="flex items-center justify-between border-b border-line p-5">
              <h2 className="text-base font-bold text-ink">
                {editingId ? 'Edit Announcement' : 'Create Announcement'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-muted transition hover:bg-surface-subtle hover:text-ink"
                aria-label="Close modal"
              >
                <FiX size={18} />
              </button>
            </div>

            <div className="space-y-4 p-5 text-sm">
              {formError && (
                <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-semibold text-ink">
                  Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. End Semester Examination Schedule Announced"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className={`${inputClass} rounded-xl border-line bg-background text-ink`}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-ink">
                  Description / Message
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="Enter announcement details, instructions, or meeting agenda…"
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className={`${inputClass} rounded-xl border-line bg-background text-ink`}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-ink">
                    Type
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className={`${inputClass} rounded-xl border-line bg-background text-ink`}
                  >
                    {ANNOUNCEMENT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-ink">
                    Priority
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className={`${inputClass} rounded-xl border-line bg-background text-ink`}
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-ink">
                    Audience
                  </label>
                  <select
                    value={formData.audience}
                    onChange={(e) => setFormData({ ...formData, audience: e.target.value })}
                    className={`${inputClass} rounded-xl border-line bg-background text-ink`}
                  >
                    {AUDIENCES.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-ink">
                    Publish Date
                  </label>
                  <input
                    type="date"
                    value={formData.publishDate}
                    onChange={(e) => setFormData({ ...formData, publishDate: e.target.value })}
                    className={`${inputClass} rounded-xl border-line bg-background text-ink`}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-ink">
                    Publish Time
                  </label>
                  <input
                    type="time"
                    value={formData.publishTime}
                    onChange={(e) => setFormData({ ...formData, publishTime: e.target.value })}
                    className={`${inputClass} rounded-xl border-line bg-background text-ink`}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-ink">
                  Venue / Location (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Auditorium / Main Seminar Hall"
                  value={formData.venue}
                  onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                  className={`${inputClass} rounded-xl border-line bg-background text-ink`}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-line bg-surface-subtle p-4">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="btn-secondary text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleSubmit(false)}
                className="rounded-xl border border-line bg-surface px-3 py-2 text-xs font-semibold text-ink shadow-sm hover:bg-surface-subtle disabled:opacity-50"
              >
                Save Draft
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleSubmit(true)}
                className="btn-primary text-xs"
              >
                {submitting ? 'Publishing…' : 'Publish'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Announcement Modal */}
      {viewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-[24px] border border-line bg-surface shadow-2xl">
            <div className="flex items-center justify-between border-b border-line p-5">
              <div className="flex items-center gap-2">
                <span className={`inline-flex rounded-lg px-2.5 py-0.5 text-xs font-semibold ${getTypeBadge(viewItem.type)}`}>
                  {viewItem.type || 'General'}
                </span>
                <span className={`inline-flex rounded-lg px-2.5 py-0.5 text-xs font-semibold ${getPriorityBadge(viewItem.priority)}`}>
                  {viewItem.priority || 'Normal'}
                </span>
              </div>
              <button
                onClick={() => setViewItem(null)}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-muted transition hover:bg-surface-subtle hover:text-ink"
                aria-label="Close modal"
              >
                <FiX size={18} />
              </button>
            </div>

            <div className="space-y-4 p-5 text-sm">
              <div>
                <h3 className="text-base font-bold text-ink">
                  {viewItem.title}
                </h3>
                <p className="mt-1 text-xs text-muted">
                  Target: {viewItem.targetAudience === 'All' ? 'All Users' : viewItem.targetAudience} · Published by {viewItem.createdBy?.name || 'Administrator'}
                </p>
              </div>

              <div className="rounded-2xl border border-line bg-background p-4 text-xs leading-relaxed text-ink whitespace-pre-wrap">
                {viewItem.message}
              </div>

              {viewItem.venue && (
                <div className="flex items-center gap-2 text-xs text-ink">
                  <MapPin className="h-4 w-4 text-muted" /> Venue: {viewItem.venue}
                </div>
              )}

              <div className="flex items-center justify-between border-t border-line pt-3 text-xs text-muted">
                <span>
                  Date:{' '}
                  {viewItem.publishedAt
                    ? new Date(viewItem.publishedAt).toLocaleString()
                    : 'Draft'}
                </span>
                <span>Read by {viewItem.readCount ?? viewItem.readBy?.length ?? 0} users</span>
              </div>
            </div>

            <div className="border-t border-line bg-surface-subtle p-4 text-right">
              <button onClick={() => setViewItem(null)} className="btn-secondary text-xs">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-[24px] border border-line bg-surface p-6 shadow-2xl">
            <h3 className="text-base font-bold text-ink">
              Delete Announcement?
            </h3>
            <p className="mt-2 text-xs text-muted">
              Are you sure you want to delete "{deleteTarget.title}"? This announcement will be removed from all student and teacher notification streams.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="btn-secondary text-xs"
              >
                Cancel
              </button>
              <button
                disabled={deleteLoading}
                onClick={handleDelete}
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-rose-700"
              >
                {deleteLoading ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  )
}
