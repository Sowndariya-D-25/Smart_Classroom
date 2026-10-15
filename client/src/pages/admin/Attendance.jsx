import { useEffect, useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import {
  ClipboardCheck,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  RotateCcw,
  Eye,
  Search,
  BookOpen,
  Building2,
  Calendar,
  UserCheck,
  Trash2,
  X,
  FileCheck,
  Paperclip,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import PageContainer from '../../components/layout/PageContainer'
import SectionHeader from '../../components/common/SectionHeader'
import StatCard from '../../components/common/StatCard'
import StatusBadge from '../../components/common/StatusBadge'
import EmptyState from '../../components/common/EmptyState'
import { inputClass } from '../../components/FormField'
import { useToast } from '../../context/ToastContext'
import { adminAttendanceApi, adminODLeaveApi } from '../../services/adminService'
import { normalizeDepartment } from '../../utils/department'

export default function AdminAttendance() {
  const toast = useToast()

  // Stats
  const [stats, setStats] = useState(null)
  const [statsLoading, setStatsLoading] = useState(true)

  // Dropdown options
  const [options, setOptions] = useState({
    subjects: [],
    teachers: [],
    students: [],
    departments: [],
    sections: [],
  })

  // Filters
  const [filters, setFilters] = useState({
    date: '',
    startDate: '',
    endDate: '',
    department: '',
    year: '',
    section: '',
    subject: '',
    teacher: '',
    student: '',
    status: '',
    search: '',
  })

  // Sessions
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)

  // Session Detail Modal
  const [selectedSessionId, setSelectedSessionId] = useState(null)
  const [sessionDetail, setSessionDetail] = useState(null)
  const [modalLoading, setModalLoading] = useState(false)
  const [modalFilter, setModalFilter] = useState('ALL') // 'ALL' | 'Present' | 'Late' | 'Absent'
  const [detailError, setDetailError] = useState(null)

  // Admin Delete States
  const [deleteSessionTarget, setDeleteSessionTarget] = useState(null)
  const [deletingSession, setDeletingSession] = useState(false)
  const [deleteRecordTarget, setDeleteRecordTarget] = useState(null)
  const [deletingRecord, setDeletingRecord] = useState(false)

  // Top View: 'sessions' | 'od_leave'
  const [activeTab, setActiveTab] = useState('sessions')

  // OD & Leave Management States
  const [odLeaveRequests, setOdLeaveRequests] = useState([])
  const [odLeaveLoading, setOdLeaveLoading] = useState(false)
  const [odStatusFilter, setOdStatusFilter] = useState('All') // 'All' | 'Pending' | 'Approved' | 'Rejected'
  const [odTypeFilter, setOdTypeFilter] = useState('All') // 'All' | 'OD' | 'Leave'
  const [odSearch, setOdSearch] = useState('')
  const [odReviewModal, setOdReviewModal] = useState({
    open: false,
    request: null,
    decision: 'Approved',
    remarks: '',
  })
  const [submittingOdReview, setSubmittingOdReview] = useState(false)

  const loadOdLeaveRequests = async () => {
    setOdLeaveLoading(true)
    try {
      const params = {}
      if (odStatusFilter !== 'All') params.status = odStatusFilter
      if (odTypeFilter !== 'All') params.type = odTypeFilter
      const data = await adminODLeaveApi.getRequests(params)
      setOdLeaveRequests(data || [])
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not load OD/Leave requests.')
    } finally {
      setOdLeaveLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'od_leave') {
      loadOdLeaveRequests()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, odStatusFilter, odTypeFilter])

  const openOdReviewModal = (request, decision) => {
    setOdReviewModal({
      open: true,
      request,
      decision,
      remarks: '',
    })
  }

  const handleOdReviewSubmit = async (e) => {
    e.preventDefault()
    if (!odReviewModal.request) return

    if (odReviewModal.decision === 'Rejected' && !odReviewModal.remarks.trim()) {
      toast.error('Rejection reason/remarks are required.')
      return
    }

    setSubmittingOdReview(true)
    try {
      const res = await adminODLeaveApi.reviewRequest(odReviewModal.request._id, {
        status: odReviewModal.decision,
        remarks: odReviewModal.remarks.trim(),
      })
      toast.success(res.message || `Request ${odReviewModal.decision.toLowerCase()} successfully!`)
      setOdReviewModal({ open: false, request: null, decision: 'Approved', remarks: '' })
      loadOdLeaveRequests()
      loadStats()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update request decision.')
    } finally {
      setSubmittingOdReview(false)
    }
  }

  const filteredOdRequests = useMemo(() => {
    if (!odSearch.trim()) return odLeaveRequests
    const term = odSearch.toLowerCase()
    return odLeaveRequests.filter((r) => {
      const studentName = r.student?.user?.name?.toLowerCase() || ''
      const rollNumber = r.student?.rollNumber?.toLowerCase() || ''
      const studentId = r.student?.studentId?.toLowerCase() || ''
      const reason = r.reason?.toLowerCase() || ''
      return (
        studentName.includes(term) ||
        rollNumber.includes(term) ||
        studentId.includes(term) ||
        reason.includes(term)
      )
    })
  }, [odLeaveRequests, odSearch])

  const loadStats = () => {
    setStatsLoading(true)
    adminAttendanceApi
      .getStats()
      .then((data) => setStats(data))
      .catch(() => {})
      .finally(() => setStatsLoading(false))
  }

  const loadOptions = () => {
    adminAttendanceApi
      .getOptions()
      .then((data) => setOptions(data))
      .catch(() => {})
  }

  const canonicalDepartments = useMemo(() => {
    const raw = options.departments || []
    const normalized = raw.map(normalizeDepartment)
    return Array.from(new Set(normalized)).filter(Boolean).sort()
  }, [options.departments])

  const filteredSubjects = useMemo(() => {
    return (options.subjects || []).filter((s) => {
      if (filters.department && normalizeDepartment(s.department) !== normalizeDepartment(filters.department)) {
        return false
      }
      if (filters.year) {
        const allowedSems = [(Number(filters.year) - 1) * 2 + 1, Number(filters.year) * 2]
        if (s.semester && !allowedSems.includes(s.semester)) return false
      }
      return true
    })
  }, [options.subjects, filters.department, filters.year])

  const filteredTeachers = useMemo(() => {
    let list = options.teachers || []
    if (filters.department) {
      list = list.filter(
        (t) => normalizeDepartment(t.department) === normalizeDepartment(filters.department),
      )
    }
    if (filters.subject) {
      const sub = (options.subjects || []).find((s) => s._id === filters.subject)
      if (sub?.teachers?.length > 0) {
        const assigned = new Set(sub.teachers.map((t) => (t._id || t).toString()))
        list = list.filter((t) => assigned.has(t._id.toString()))
      } else {
        list = []
      }
    }
    return list
  }, [options.teachers, options.subjects, filters.subject, filters.department])

  const filteredStudents = useMemo(() => {
    return (options.students || []).filter((st) => {
      if (filters.department && normalizeDepartment(st.department) !== normalizeDepartment(filters.department)) {
        return false
      }
      if (filters.year && st.year && Number(st.year) !== Number(filters.year)) {
        return false
      }
      if (filters.section && st.section && st.section.toUpperCase() !== filters.section.toUpperCase()) {
        return false
      }
      return true
    })
  }, [options.students, filters.department, filters.year, filters.section])

  const fetchSessions = () => {
    setLoading(true)
    const query = { ...filters }
    delete query.search

    adminAttendanceApi
      .listSessions(query)
      .then((data) => setSessions(data.items || []))
      .catch((err) => toast.error(err.response?.data?.message || 'Failed to load sessions'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadStats()
    loadOptions()
    fetchSessions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleFilterChange = (field, val) => {
    setFilters((prev) => {
      const updated = { ...prev, [field]: val }
      if (field === 'department') {
        updated.year = ''
        updated.section = ''
        updated.subject = ''
        updated.teacher = ''
        updated.student = ''
      } else if (field === 'year') {
        updated.section = ''
        updated.subject = ''
        updated.teacher = ''
        updated.student = ''
      } else if (field === 'section') {
        updated.student = ''
      } else if (field === 'subject') {
        updated.teacher = ''
      }
      return updated
    })
  }

  const handleConfirmDeleteSession = async () => {
    if (!deleteSessionTarget || deletingSession) return
    const targetId = deleteSessionTarget._id || deleteSessionTarget.id
    if (!targetId) {
      toast.error('Invalid session identifier for deletion')
      return
    }
    setDeletingSession(true)
    try {
      const res = await adminAttendanceApi.deleteSession(targetId)
      toast.success(res?.message || 'Attendance session and records removed successfully.')
      setDeleteSessionTarget(null)
      fetchSessions()
      loadStats()
    } catch (err) {
      console.error('Delete session error:', err)
      toast.error(err.response?.data?.message || err.message || 'Failed to delete attendance session.')
    } finally {
      setDeletingSession(false)
    }
  }

  const handleConfirmDeleteRecord = async () => {
    if (!deleteRecordTarget || deletingRecord) return
    const recordId = deleteRecordTarget._id || deleteRecordTarget.id
    if (!recordId) {
      toast.error('Invalid record identifier for deletion')
      return
    }
    setDeletingRecord(true)
    try {
      const res = await adminAttendanceApi.deleteRecord(recordId)
      toast.success(res?.message || 'Attendance record removed successfully.')
      setDeleteRecordTarget(null)
      if (selectedSessionId) {
        handleOpenDetail(selectedSessionId)
      }
      fetchSessions()
      loadStats()
    } catch (err) {
      console.error('Delete record error:', err)
      toast.error(err.response?.data?.message || err.message || 'Failed to delete attendance record.')
    } finally {
      setDeletingRecord(false)
    }
  }

  useEffect(() => {
    fetchSessions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    filters.date,
    filters.startDate,
    filters.endDate,
    filters.department,
    filters.year,
    filters.section,
    filters.subject,
    filters.teacher,
    filters.student,
    filters.status,
  ])

  const resetFilters = () => {
    setFilters({
      date: '',
      startDate: '',
      endDate: '',
      department: '',
      year: '',
      section: '',
      subject: '',
      teacher: '',
      student: '',
      status: '',
      search: '',
    })
  }

  // Open Detail Modal — Prevents stale closures, fetches from real API
  const handleOpenDetail = async (id) => {
    if (!id) {
      toast.error('Attendance session ID is missing')
      return
    }
    const safeId = typeof id === 'object' ? id._id || id.id : id
    setSelectedSessionId(safeId)
    setSessionDetail(null) // clear stale details immediately
    setDetailError(null)
    setModalLoading(true)
    setModalFilter('ALL')
    try {
      const data = await adminAttendanceApi.getSessionDetail(safeId)
      setSessionDetail(data)
    } catch (err) {
      console.error('Session detail error:', err)
      const msg = err.response?.data?.message || err.message || 'Failed to load session details'
      setDetailError(msg)
      toast.error(msg)
    } finally {
      setModalLoading(false)
    }
  }

  const handleCloseModal = () => {
    setSelectedSessionId(null)
    setSessionDetail(null)
    setDetailError(null)
    setModalLoading(false)
  }

  // Lock background scrolling and handle Escape key when any modal is open
  useEffect(() => {
    const isAnyModalOpen = Boolean(selectedSessionId || deleteSessionTarget || deleteRecordTarget)
    if (!isAnyModalOpen) return undefined

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (deleteRecordTarget) setDeleteRecordTarget(null)
        else if (deleteSessionTarget) setDeleteSessionTarget(null)
        else if (selectedSessionId) handleCloseModal()
      }
    }
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = originalOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [selectedSessionId, deleteSessionTarget, deleteRecordTarget])

  // Client search filtering
  const filteredSessions = useMemo(() => {
    if (!filters.search.trim()) return sessions
    const term = filters.search.toLowerCase()
    return sessions.filter((s) => {
      const subjectName = s.subject?.name?.toLowerCase() || ''
      const subjectCode = s.subject?.code?.toLowerCase() || ''
      const teacherName = s.teacher?.name?.toLowerCase() || ''
      const dept = s.department?.toLowerCase() || ''
      return (
        subjectName.includes(term) ||
        subjectCode.includes(term) ||
        teacherName.includes(term) ||
        dept.includes(term)
      )
    })
  }, [sessions, filters.search])

  // Modal student list filtering
  const modalStudents = useMemo(() => {
    if (!sessionDetail?.students) return []
    if (modalFilter === 'ALL') return sessionDetail.students
    return sessionDetail.students.filter((s) => s.status === modalFilter)
  }, [sessionDetail, modalFilter])

  // Card 1: Today's Attendance (% or N/A)
  const todayPercentageDisplay =
    stats?.todayPercentage !== null && stats?.todayPercentage !== undefined
      ? `${stats.todayPercentage}%`
      : 'N/A'

  return (
    <PageContainer>
      <SectionHeader
        title="Attendance"
        subtitle="View, monitor, and analyze attendance records across departments, sections, subjects, and students."
      />

      {/* Top View Switcher */}
      <div className="mt-4 flex flex-wrap items-center gap-2 border-b border-line pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('sessions')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
            activeTab === 'sessions'
              ? 'bg-primary text-white shadow-xs'
              : 'bg-white text-muted hover:text-ink border border-line'
          }`}
        >
          <ClipboardCheck size={15} />
          <span>Attendance Sessions &amp; Analytics</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('od_leave')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
            activeTab === 'od_leave'
              ? 'bg-primary text-white shadow-xs'
              : 'bg-white text-muted hover:text-ink border border-line'
          }`}
        >
          <FileCheck size={15} />
          <span>Digital OD &amp; Leave Approvals</span>
          {odLeaveRequests.filter((r) => r.status === 'Pending').length > 0 && (
            <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] text-white font-extrabold">
              {odLeaveRequests.filter((r) => r.status === 'Pending').length} pending
            </span>
          )}
        </button>
      </div>

      {activeTab === 'sessions' && (
        <>
          {/* Exactly 5 Cards - Emerald / Light Green Theme */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          icon={ClipboardCheck}
          label="Today's Attendance"
          value={statsLoading ? '…' : todayPercentageDisplay}
          subtext={stats?.totalToday > 0 ? `${stats.totalToday} marked today` : 'Zero sessions = N/A'}
          colorScheme="emerald"
        />
        <StatCard
          icon={CheckCircle2}
          label="Present"
          value={statsLoading ? '…' : (stats?.presentToday ?? 0)}
          subtext="Present students today"
          colorScheme="emerald"
        />
        <StatCard
          icon={XCircle}
          label="Absent"
          value={statsLoading ? '…' : (stats?.absentToday ?? 0)}
          subtext="Absent students today"
          colorScheme="rose"
        />
        <StatCard
          icon={Clock}
          label="Late"
          value={statsLoading ? '…' : (stats?.lateToday ?? 0)}
          subtext="Late arrivals today"
          colorScheme="amber"
        />
        <StatCard
          icon={AlertTriangle}
          label="Low Attendance"
          value={statsLoading ? '…' : (stats?.lowAttendanceCount ?? 0)}
          subtext="Students below 75%"
          colorScheme="rose"
        />
      </div>

      {/* Department-wise Attendance Bar Chart */}
      {stats?.departmentWise?.length > 0 && (
        <div className="mt-6 card rounded-[22px] border border-line bg-surface p-6 shadow-card">
          <div className="flex items-center justify-between border-b border-line pb-4">
            <div>
              <h2 className="text-base font-bold font-display text-ink">
                Department-wise Attendance
              </h2>
              <p className="text-xs text-muted">Attendance percentages aggregated across academic departments.</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-800 border border-emerald-200/60">
              <Building2 className="h-5 w-5" />
            </div>
          </div>

          <div className="mt-4 h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.departmentWise}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2EAE4" />
                <XAxis dataKey="department" tick={{ fontSize: 11, fill: '#6B7F76' }} axisLine={{ stroke: '#E2EAE4' }} />
                <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 11, fill: '#6B7F76' }} axisLine={{ stroke: '#E2EAE4' }} />
                <Tooltip
                  formatter={(val) => (val !== null ? `${val}%` : 'N/A')}
                  contentStyle={{ borderRadius: '14px', border: '1px solid #E2EAE4', fontSize: '12px' }}
                />
                <Bar dataKey="percentage" name="Attendance %" fill="#059669" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Filters Toolbar */}
      <div className="mt-6 card rounded-[22px] border border-line bg-surface p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-muted font-display">
            Attendance Filters
          </span>
          <button
            onClick={resetFilters}
            className="flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-ink transition"
          >
            <RotateCcw size={13} /> Reset Filters
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {/* Date From */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted">Date From</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              className="mt-1 h-10 w-full rounded-xl border border-line bg-surface px-3 text-xs font-semibold text-ink shadow-xs transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Date To */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted">Date To</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              className="mt-1 h-10 w-full rounded-xl border border-line bg-surface px-3 text-xs font-semibold text-ink shadow-xs transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Department */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted">Department</label>
            <select
              value={filters.department}
              onChange={(e) => handleFilterChange('department', e.target.value)}
              className="mt-1 h-10 w-full rounded-xl border border-line bg-surface px-3 text-xs font-semibold text-ink shadow-xs transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">All Departments</option>
              {canonicalDepartments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* Year */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted">Year</label>
            <select
              value={filters.year}
              onChange={(e) => handleFilterChange('year', e.target.value)}
              className="mt-1 h-10 w-full rounded-xl border border-line bg-surface px-3 text-xs font-semibold text-ink shadow-xs transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">All Years</option>
              <option value="1">1st Year</option>
              <option value="2">2nd Year</option>
              <option value="3">3rd Year</option>
              <option value="4">4th Year</option>
            </select>
          </div>

          {/* Section */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted">Section</label>
            <select
              value={filters.section}
              onChange={(e) => handleFilterChange('section', e.target.value)}
              className="mt-1 h-10 w-full rounded-xl border border-line bg-surface px-3 text-xs font-semibold text-ink shadow-xs transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">All Sections</option>
              {options.sections.map((s) => (
                <option key={s} value={s}>
                  Section {s}
                </option>
              ))}
            </select>
          </div>

          {/* Subject */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted">Subject</label>
            <select
              value={filters.subject}
              onChange={(e) => handleFilterChange('subject', e.target.value)}
              className="mt-1 h-10 w-full rounded-xl border border-line bg-surface px-3 text-xs font-semibold text-ink shadow-xs transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">All Subjects</option>
              {filteredSubjects.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </div>

          {/* Teacher */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted">Teacher</label>
            <select
              value={filters.teacher}
              onChange={(e) => handleFilterChange('teacher', e.target.value)}
              className="mt-1 h-10 w-full rounded-xl border border-line bg-surface px-3 text-xs font-semibold text-ink shadow-xs transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">All Teachers</option>
              {filteredTeachers.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Student */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted">Student</label>
            <select
              value={filters.student}
              onChange={(e) => handleFilterChange('student', e.target.value)}
              className="mt-1 h-10 w-full rounded-xl border border-line bg-surface px-3 text-xs font-semibold text-ink shadow-xs transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">All Students</option>
              {filteredStudents.map((st) => (
                <option key={st._id} value={st._id}>
                  {st.name} ({st.rollNumber || st.studentId})
                </option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted">Status</label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="mt-1 h-10 w-full rounded-xl border border-line bg-surface px-3 text-xs font-semibold text-ink shadow-xs transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">All Statuses</option>
              <option value="Present">Present</option>
              <option value="Late">Late</option>
              <option value="Absent">Absent</option>
              <option value="Completed">Session Completed</option>
              <option value="Active">Session Active</option>
            </select>
          </div>

          {/* Search */}
          <div className="sm:col-span-1 lg:col-span-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted">Search</label>
            <div className="relative mt-1">
              <Search className="absolute left-3 top-3 h-3.5 w-3.5 text-muted" />
              <input
                type="text"
                placeholder="Search..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="h-10 w-full rounded-xl border border-line bg-surface pl-9 pr-3 text-xs font-semibold text-ink shadow-xs transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Attendance Sessions Table */}
      <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-line bg-[#F8FAF7]/90 text-[11px] font-bold uppercase tracking-wider text-muted">
              <tr>
                <th className="p-3.5">Date</th>
                <th className="p-3.5">Period</th>
                <th className="p-3.5">Department</th>
                <th className="p-3.5">Year</th>
                <th className="p-3.5">Section</th>
                <th className="p-3.5">Subject</th>
                <th className="p-3.5">Teacher</th>
                <th className="p-3.5 text-center">Present</th>
                <th className="p-3.5 text-center">Absent</th>
                <th className="p-3.5 text-center">Late</th>
                <th className="p-3.5 text-center">Attendance %</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filteredSessions.length > 0 ? (
                filteredSessions.map((row) => {
                  const pct = row.percentage
                  const isLow = pct !== null && pct < 75
                  const isCritical = pct !== null && pct < 60
                  return (
                    <tr key={row._id} className="transition-colors hover:bg-sage-50/40">
                      <td className="p-3.5 font-bold text-ink">
                        {row.date
                          ? new Date(row.date).toLocaleDateString('en-US', {
                              timeZone: 'Asia/Kolkata',
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })
                          : '—'}
                      </td>
                      <td className="p-3.5 font-medium text-ink">Period {row.period}</td>
                      <td className="p-3.5 font-medium text-ink">{normalizeDepartment(row.department)}</td>
                      <td className="p-3.5 font-medium text-muted">Year {row.year}</td>
                      <td className="p-3.5 font-bold text-ink">
                        {row.section}
                      </td>
                      <td className="p-3.5">
                        <span className="font-semibold text-ink">
                          {row.subject?.name}
                        </span>{' '}
                        <span className="text-muted text-[11px]">({row.subject?.code})</span>
                      </td>
                      <td className="p-3.5 font-medium text-ink">{row.teacher?.name || '—'}</td>
                      <td className="p-3.5 text-center font-bold text-emerald-700">
                        {row.present ?? 0}
                      </td>
                      <td className="p-3.5 text-center font-bold text-rose-600">
                        {row.absent ?? 0}
                      </td>
                      <td className="p-3.5 text-center font-bold text-amber-600">
                        {row.late ?? 0}
                      </td>
                      <td className="p-3.5 text-center">
                        <span
                          className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-bold ${
                            pct === null
                              ? 'bg-slate-100 text-slate-600'
                              : isCritical
                              ? 'bg-rose-50 text-rose-700'
                              : isLow
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-emerald-50 text-emerald-700'
                          }`}
                        >
                          {pct !== null ? `${pct}%` : 'N/A'}
                        </span>
                      </td>
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleOpenDetail(row._id)
                            }}
                            className="inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50/80 hover:bg-emerald-100 hover:text-emerald-800 transition"
                            title="View Session Details"
                          >
                            <Eye size={13} /> View Details
                          </button>
                          <button
                            type="button"
                            disabled={deletingSession}
                            onClick={(e) => {
                              e.stopPropagation()
                              setDeleteSessionTarget(row)
                            }}
                            className="inline-flex items-center gap-1 rounded-xl p-1.5 text-xs font-medium text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition disabled:opacity-50"
                            title="Delete Attendance Session"
                            aria-label="Delete Session"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={12} className="p-12 text-center text-xs font-semibold text-muted">
                    No attendance records found matching your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      </>
      )}

      {activeTab === 'od_leave' && (
        <div className="mt-6 space-y-6">
          {/* OD / Leave Summary KPI Cards */}
          <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
            <div className="card rounded-[20px] p-4 text-center shadow-card border border-line/90 bg-white">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-muted">Total Requests</p>
              <p className="mt-1 text-2xl font-black font-display text-ink">{odLeaveRequests.length}</p>
            </div>
            <div className="card rounded-[20px] p-4 text-center shadow-card bg-amber-50/70 border-amber-200/80">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-amber-800">Pending Review</p>
              <p className="mt-1 text-2xl font-black font-display text-amber-700">
                {odLeaveRequests.filter((r) => r.status === 'Pending').length}
              </p>
            </div>
            <div className="card rounded-[20px] p-4 text-center shadow-card bg-emerald-50/70 border-emerald-200/80">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-800">Approved</p>
              <p className="mt-1 text-2xl font-black font-display text-emerald-700">
                {odLeaveRequests.filter((r) => r.status === 'Approved').length}
              </p>
            </div>
            <div className="card rounded-[20px] p-4 text-center shadow-card bg-rose-50/70 border-rose-200/80">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-rose-800">Rejected</p>
              <p className="mt-1 text-2xl font-black font-display text-rose-700">
                {odLeaveRequests.filter((r) => r.status === 'Rejected').length}
              </p>
            </div>
          </div>

          {/* Filters & Search Toolbar */}
          <div className="card rounded-[22px] border border-line bg-surface p-4 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-muted uppercase tracking-wider mr-1">Status:</span>
              {['All', 'Pending', 'Approved', 'Rejected'].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setOdStatusFilter(st)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                    odStatusFilter === st
                      ? 'bg-primary text-white shadow-xs'
                      : 'bg-sage-50 text-muted hover:text-ink hover:bg-sage-100'
                  }`}
                >
                  {st}
                </button>
              ))}

              <div className="h-4 w-px bg-line mx-1" />

              <span className="text-xs font-bold text-muted uppercase tracking-wider mr-1">Type:</span>
              {['All', 'OD', 'Leave'].map((tp) => (
                <button
                  key={tp}
                  type="button"
                  onClick={() => setOdTypeFilter(tp)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                    odTypeFilter === tp
                      ? 'bg-ink text-white shadow-xs'
                      : 'bg-sage-50 text-muted hover:text-ink hover:bg-sage-100'
                  }`}
                >
                  {tp === 'OD' ? 'On-Duty' : tp}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={14} />
                <input
                  type="text"
                  placeholder="Search student or reason…"
                  value={odSearch}
                  onChange={(e) => setOdSearch(e.target.value)}
                  className="w-full rounded-xl border border-line bg-white pl-8 pr-3 py-1.5 text-xs text-ink placeholder:text-muted/60 focus:border-primary-500 focus:outline-hidden"
                />
              </div>
              <button
                type="button"
                onClick={loadOdLeaveRequests}
                className="btn-secondary !p-2 text-muted hover:text-ink"
                title="Refresh Requests"
              >
                <RotateCcw size={14} className={odLeaveLoading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* Requests Content */}
          {odLeaveLoading ? (
            <div className="flex h-48 flex-col items-center justify-center gap-3">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
              <p className="text-xs font-semibold text-muted">Loading requests…</p>
            </div>
          ) : filteredOdRequests.length === 0 ? (
            <EmptyState
              title="No OD or Leave Requests Found"
              description="No student request records match your selected status and type filters."
            />
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredOdRequests.map((req) => {
                const isPending = req.status === 'Pending'
                const isApproved = req.status === 'Approved'
                const isRejected = req.status === 'Rejected'
                const startDateStr = new Date(req.startDate).toLocaleDateString()
                const endDateStr = new Date(req.endDate).toLocaleDateString()

                return (
                  <div
                    key={req._id}
                    className="card rounded-[22px] border border-line bg-surface p-5 shadow-card hover:border-primary-500/30 transition-all"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      {/* Left Header */}
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold border ${
                              req.type === 'OD'
                                ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                                : 'bg-purple-50 text-purple-800 border-purple-200'
                            }`}
                          >
                            {req.type === 'OD' ? 'On-Duty (OD)' : 'Leave Application'}
                          </span>
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold border ${
                              isApproved
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : isRejected
                                ? 'bg-rose-50 text-rose-800 border-rose-200'
                                : 'bg-amber-50 text-amber-800 border-amber-200'
                            }`}
                          >
                            {req.status}
                          </span>
                          <span className="text-xs text-muted">
                            Submitted {new Date(req.createdAt).toLocaleDateString()}
                          </span>
                        </div>

                        <h3 className="text-base font-bold text-ink pt-1">
                          {req.student?.user?.name || 'Student'}{' '}
                          <span className="text-xs font-normal text-muted font-mono">
                            ({req.student?.studentId} · Roll {req.student?.rollNumber} · {req.student?.department} Sec {req.student?.section || 'A'})
                          </span>
                        </h3>

                        <p className="text-xs font-semibold text-primary-800 flex items-center gap-1.5">
                          <Calendar size={13} className="text-primary-600" />
                          <span>
                            {startDateStr} {startDateStr !== endDateStr ? `– ${endDateStr}` : '(Single Day)'}
                          </span>
                        </p>
                      </div>

                      {/* Right Review Actions (if pending) */}
                      {isPending && (
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => openOdReviewModal(req, 'Approved')}
                            className="btn-primary !bg-emerald-600 hover:!bg-emerald-700 !px-4 !py-1.5 !text-xs font-bold inline-flex items-center gap-1.5 shadow-sm"
                          >
                            <CheckCircle2 size={14} />
                            <span>Approve</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => openOdReviewModal(req, 'Rejected')}
                            className="btn-secondary !border-rose-200 !text-rose-700 hover:!bg-rose-50 !px-4 !py-1.5 !text-xs font-bold inline-flex items-center gap-1.5"
                          >
                            <XCircle size={14} />
                            <span>Reject</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Details: Reason & Subjects */}
                    <div className="mt-3.5 space-y-2 text-xs">
                      <div>
                        <span className="font-bold text-muted uppercase text-[10px] tracking-wider">Reason:</span>
                        <p className="mt-1 text-ink font-medium leading-relaxed bg-[#F9FAF8] rounded-xl p-3 border border-line/60">
                          {req.reason}
                        </p>
                      </div>

                      {req.subjects && req.subjects.length > 0 && (
                        <div>
                          <span className="font-bold text-muted uppercase text-[10px] tracking-wider">Applicable Subjects:</span>
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

                      {/* Attached Document */}
                      {(req.documentName || req.documentUrl) && (
                        <div className="flex items-center gap-2 pt-1">
                          <Paperclip size={14} className="text-muted" />
                          <span className="font-bold text-muted">Evidence Document:</span>
                          {req.documentUrl ? (
                            <a
                              href={req.documentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-bold text-primary hover:underline inline-flex items-center gap-1"
                            >
                              <span>{req.documentName || 'View Document'}</span>
                              <ExternalLink size={12} />
                            </a>
                          ) : (
                            <span className="text-ink font-semibold">{req.documentName}</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Decision Audit Trail */}
                    {!isPending && (
                      <div className="mt-4 pt-3 border-t border-line/70 flex items-center justify-between text-xs">
                        {isApproved ? (
                          <div className="flex items-center gap-2 font-bold text-emerald-800">
                            <ShieldCheck className="h-4 w-4 text-emerald-600" />
                            <span>
                              Approved on {new Date(req.reviewedAt).toLocaleDateString()} by {req.reviewedBy?.name || req.reviewerRole || 'Reviewer'}
                              {req.reviewerRemarks && ` · Remarks: "${req.reviewerRemarks}"`}
                            </span>
                          </div>
                        ) : (
                          <div className="font-bold text-rose-800">
                            <span>
                              Rejected on {new Date(req.reviewedAt).toLocaleDateString()} by {req.reviewedBy?.name || req.reviewerRole || 'Reviewer'}
                            </span>
                            {req.reviewerRemarks && (
                              <p className="mt-0.5 text-[11px] text-rose-700 font-medium">
                                Reason: {req.reviewerRemarks}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Session Details Modal */}
      {selectedSessionId &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 backdrop-blur-md bg-slate-900/60 overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Attendance Session Details"
          >
            <button
              type="button"
              className="absolute inset-0 h-full w-full bg-[#091D17]/60 cursor-default focus:outline-none"
              aria-label="Close dialog overlay"
              onClick={handleCloseModal}
            />
            <div
              className="relative flex max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col min-h-0 overflow-hidden rounded-[24px] border border-line/90 bg-surface shadow-2xl animate-in fade-in zoom-in-95 duration-150 z-10"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Sticky Header */}
              <div className="flex shrink-0 items-center justify-between border-b border-line/80 bg-gradient-to-r from-[#F6FAF7] to-[#F4F8F5] px-6 py-4">
                <div>
                  <h2 className="text-base font-extrabold text-ink font-display tracking-tight">
                    Attendance Session Details
                  </h2>
                  <p className="text-xs text-muted font-medium mt-0.5">
                    {modalLoading
                      ? 'Loading session details from database…'
                      : sessionDetail?.session
                      ? `${sessionDetail.session.subject?.name || 'Class Session'} · Period ${sessionDetail.session.period || 1} · ${
                          sessionDetail.session.date
                            ? new Date(sessionDetail.session.date).toLocaleDateString('en-US', {
                                timeZone: 'Asia/Kolkata',
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })
                            : '—'
                        }`
                      : 'Session Information'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="rounded-xl p-2 text-muted hover:bg-slate-200/60 hover:text-ink transition active:scale-95"
                  aria-label="Close dialog"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Dynamic Content Container */}
              {modalLoading ? (
                <div className="flex h-64 flex-col items-center justify-center gap-3 p-6">
                  <div className="h-7 w-7 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
                  <p className="text-xs font-semibold text-muted">Retrieving attendance session records…</p>
                </div>
              ) : detailError ? (
                <div className="flex h-64 flex-col items-center justify-center gap-3 p-6 text-center">
                  <div className="rounded-full bg-rose-50 p-3 text-rose-600">
                    <AlertTriangle size={24} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-ink">Failed to load session details</h3>
                    <p className="mt-1 text-xs text-muted">{detailError}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleOpenDetail(selectedSessionId)}
                    className="btn-primary !py-2 !px-4 !text-xs mt-2"
                  >
                    Retry Request
                  </button>
                </div>
              ) : (
                <div className="flex-1 min-h-0 overflow-y-auto p-6 text-sm space-y-5">
                  {/* Session Meta */}
                  <div className="grid grid-cols-2 gap-3 rounded-2xl border border-emerald-200/60 bg-emerald-50/40 p-4 text-xs sm:grid-cols-4">
                    <div>
                      <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Department</span>
                      <p className="mt-0.5 font-bold text-ink">
                        {sessionDetail?.session?.department || '—'}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Section</span>
                      <p className="mt-0.5 font-bold text-ink">
                        Section {sessionDetail?.session?.section || 'A'}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Teacher</span>
                      <p className="mt-0.5 font-bold text-ink truncate" title={sessionDetail?.session?.teacher?.user?.name}>
                        {sessionDetail?.session?.teacher?.user?.name || sessionDetail?.session?.teacher?.employeeId || '—'}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Attendance</span>
                      <p className="mt-0.5 font-black text-emerald-700 text-sm">
                        {sessionDetail?.summary?.percentage !== null && sessionDetail?.summary?.percentage !== undefined
                          ? `${sessionDetail.summary.percentage}%`
                          : 'N/A'}
                      </p>
                    </div>
                  </div>

                  {/* Filter Tabs in Modal */}
                  <div className="flex items-center justify-between border-b border-line pb-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {[
                        { tab: 'ALL', count: sessionDetail?.summary?.total ?? 0 },
                        { tab: 'Present', count: sessionDetail?.summary?.present ?? 0 },
                        { tab: 'Late', count: sessionDetail?.summary?.late ?? 0 },
                        { tab: 'Absent', count: sessionDetail?.summary?.absent ?? 0 },
                      ].map(({ tab, count }) => (
                        <button
                          key={tab}
                          type="button"
                          onClick={() => setModalFilter(tab)}
                          className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                            modalFilter === tab
                              ? 'bg-emerald-700 text-white shadow-xs'
                              : 'bg-emerald-50/60 text-muted hover:text-ink hover:bg-emerald-100/50'
                          }`}
                        >
                          {tab} <span className="opacity-75 font-normal">({count})</span>
                        </button>
                      ))}
                    </div>
                    <span className="text-[11px] font-medium text-muted">
                      Total: {sessionDetail?.students?.length ?? 0} students
                    </span>
                  </div>

                  {/* Student Attendance Table */}
                  <div className="overflow-hidden rounded-xl border border-line">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="border-b border-line bg-[#F8FAF7]/90 text-[11px] font-bold uppercase tracking-wider text-muted">
                          <tr>
                            <th className="p-3">Student</th>
                            <th className="p-3">Register No.</th>
                            <th className="p-3">Status</th>
                            <th className="p-3">Marked At</th>
                            <th className="p-3 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                          {sessionDetail?.students?.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="p-8 text-center text-xs text-muted font-medium">
                                No student attendance records exist for this session.
                              </td>
                            </tr>
                          ) : modalStudents.length > 0 ? (
                            modalStudents.map((st) => (
                              <tr key={st._id} className="hover:bg-emerald-50/20">
                                <td className="p-3 font-semibold text-ink">
                                  {st.name}
                                </td>
                                <td className="p-3 font-mono text-muted text-[11px]">{st.rollNumber}</td>
                                <td className="p-3">
                                  <StatusBadge status={st.status} />
                                </td>
                                <td className="p-3 text-muted text-[11px]">
                                  {st.markedAt
                                    ? new Date(st.markedAt).toLocaleTimeString('en-US', {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })
                                    : '—'}
                                </td>
                                <td className="p-3 text-right">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setDeleteRecordTarget(st)
                                    }}
                                    title="Delete Attendance Record"
                                    className="inline-flex items-center rounded-lg p-1.5 text-muted hover:bg-rose-50 hover:text-rose-600 transition"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={5} className="p-6 text-center text-xs text-muted font-medium">
                                No students matching status filter "{modalFilter}".
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Sticky Footer */}
              <div className="flex shrink-0 justify-end border-t border-line/80 bg-[#F8FAF7]/80 px-6 py-4">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="btn-secondary !px-4 !py-2 !text-xs font-semibold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Confirm Delete Session Modal — rendered in portal */}
      {deleteSessionTarget &&
        createPortal(
          <div
            className="fixed inset-0 z-[70] flex items-center justify-center p-4 backdrop-blur-md bg-slate-900/60 overflow-hidden"
            role="alertdialog"
            aria-modal="true"
          >
            <button
              type="button"
              className="absolute inset-0 h-full w-full bg-[#091D17]/60 cursor-default focus:outline-none"
              aria-label="Cancel"
              onClick={() => !deletingSession && setDeleteSessionTarget(null)}
            />
            <div
              className="relative w-full max-w-md rounded-[24px] border border-line/90 bg-surface p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200 z-10"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 text-rose-600">
                <div className="rounded-2xl bg-rose-50 p-2.5 border border-rose-200/60">
                  <Trash2 size={20} />
                </div>
                <h3 className="text-base font-extrabold text-ink font-display">Delete Attendance Session</h3>
              </div>
              <p className="mt-3 text-xs text-muted leading-relaxed">
                Are you sure you want to permanently delete this attendance session for{' '}
                <strong className="text-ink">{deleteSessionTarget.subject?.name || 'Class Session'}</strong> on{' '}
                <strong className="text-ink">
                  {deleteSessionTarget.date ? new Date(deleteSessionTarget.date).toLocaleDateString() : 'selected date'}
                </strong>?
                This will safely remove the session and its associated student attendance records.
                Master records and students will not be affected.
              </p>
              <div className="mt-6 flex justify-end gap-2.5">
                <button
                  type="button"
                  disabled={deletingSession}
                  onClick={() => setDeleteSessionTarget(null)}
                  className="btn-secondary !px-4 !py-2 !text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deletingSession}
                  onClick={handleConfirmDeleteSession}
                  className="btn-primary !px-4 !py-2 !text-xs font-bold !bg-gradient-to-r !from-rose-600 !to-rose-700 hover:!from-rose-700 hover:!to-rose-800"
                >
                  {deletingSession ? 'Deleting…' : 'Delete Session'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Confirm Delete Individual Record Modal — rendered in portal */}
      {deleteRecordTarget &&
        createPortal(
          <div
            className="fixed inset-0 z-[70] flex items-center justify-center p-4 backdrop-blur-md bg-slate-900/60 overflow-hidden"
            role="alertdialog"
            aria-modal="true"
          >
            <button
              type="button"
              className="absolute inset-0 h-full w-full bg-[#091D17]/60 cursor-default focus:outline-none"
              aria-label="Cancel"
              onClick={() => !deletingRecord && setDeleteRecordTarget(null)}
            />
            <div
              className="relative w-full max-w-md rounded-[24px] border border-line/90 bg-surface p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200 z-10"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 text-rose-600">
                <div className="rounded-2xl bg-rose-50 p-2.5 border border-rose-200/60">
                  <Trash2 size={20} />
                </div>
                <h3 className="text-base font-extrabold text-ink font-display">Delete Student Attendance Record</h3>
              </div>
              <p className="mt-3 text-xs text-muted leading-relaxed">
                Are you sure you want to remove the attendance record for{' '}
                <strong className="text-ink">{deleteRecordTarget.name}</strong> ({deleteRecordTarget.rollNumber})?
                The parent session and other students will not be affected.
              </p>
              <div className="mt-6 flex justify-end gap-2.5">
                <button
                  type="button"
                  disabled={deletingRecord}
                  onClick={() => setDeleteRecordTarget(null)}
                  className="btn-secondary !px-4 !py-2 !text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deletingRecord}
                  onClick={handleConfirmDeleteRecord}
                  className="btn-primary !px-4 !py-2 !text-xs font-bold !bg-gradient-to-r !from-rose-600 !to-rose-700 hover:!from-rose-700 hover:!to-rose-800"
                >
                  {deletingRecord ? 'Deleting…' : 'Delete Record'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Admin OD / Leave Review Modal */}
      {odReviewModal.open && odReviewModal.request && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-lg rounded-3xl border border-line bg-white p-7 shadow-2xl space-y-4">
            <button
              onClick={() => setOdReviewModal({ open: false, request: null, decision: 'Approved', remarks: '' })}
              className="absolute right-5 top-5 rounded-xl p-2 text-muted hover:bg-sage-50 hover:text-ink transition-colors"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${
                  odReviewModal.decision === 'Approved'
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : 'bg-rose-100 text-rose-800 border-rose-300'
                }`}
              >
                {odReviewModal.decision === 'Approved' ? 'Confirm Approval' : 'Confirm Rejection'}
              </span>
              <span className="text-xs text-muted">
                Admin Review · {odReviewModal.request.type === 'OD' ? 'On-Duty' : 'Leave'}
              </span>
            </div>

            <h2 className="text-xl font-bold tracking-tight text-ink">
              {odReviewModal.decision === 'Approved' ? 'Approve Student Request' : 'Reject Student Request'}
            </h2>

            <div className="rounded-2xl bg-sage-50/70 border border-line p-4 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted font-semibold">Student:</span>
                <span className="font-bold text-ink">
                  {odReviewModal.request.student?.user?.name || 'Student'} ({odReviewModal.request.student?.rollNumber})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted font-semibold">Duration:</span>
                <span className="font-bold text-ink">
                  {new Date(odReviewModal.request.startDate).toLocaleDateString()}
                  {new Date(odReviewModal.request.startDate).toDateString() !==
                    new Date(odReviewModal.request.endDate).toDateString() &&
                    ` to ${new Date(odReviewModal.request.endDate).toLocaleDateString()}`}
                </span>
              </div>
              <div className="flex flex-col gap-1 pt-1 border-t border-line/60">
                <span className="text-muted font-semibold">Reason:</span>
                <p className="font-medium text-ink bg-white rounded-lg p-2.5 border border-line/60">
                  {odReviewModal.request.reason}
                </p>
              </div>
            </div>

            <form onSubmit={handleOdReviewSubmit} className="space-y-4 pt-1">
              <div>
                <label className="block text-xs font-bold text-ink mb-1.5">
                  {odReviewModal.decision === 'Rejected' ? (
                    <span>
                      Rejection Reason / Remarks <span className="text-rose-500">*</span>
                    </span>
                  ) : (
                    <span>Review Remarks / Administrative Notes (Optional)</span>
                  )}
                </label>
                <textarea
                  rows={3}
                  value={odReviewModal.remarks}
                  onChange={(e) =>
                    setOdReviewModal((prev) => ({ ...prev, remarks: e.target.value }))
                  }
                  required={odReviewModal.decision === 'Rejected'}
                  placeholder={
                    odReviewModal.decision === 'Rejected'
                      ? 'Please specify why this request is being rejected (mandatory)...'
                      : 'Optional feedback or administrative instructions...'
                  }
                  className="w-full rounded-xl border border-line bg-white p-3 text-xs text-ink placeholder:text-muted/60 focus:border-primary-500 focus:outline-hidden focus:ring-2 focus:ring-primary-500/20"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setOdReviewModal({ open: false, request: null, decision: 'Approved', remarks: '' })}
                  className="btn-secondary !px-4 !py-2 !text-xs font-semibold"
                  disabled={submittingOdReview}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingOdReview}
                  className={`btn-primary !px-5 !py-2 !text-xs font-bold inline-flex items-center gap-1.5 shadow-sm ${
                    odReviewModal.decision === 'Rejected'
                      ? '!bg-rose-600 hover:!bg-rose-700'
                      : '!bg-emerald-600 hover:!bg-emerald-700'
                  }`}
                >
                  {submittingOdReview ? (
                    'Processing...'
                  ) : odReviewModal.decision === 'Rejected' ? (
                    <>
                      <XCircle size={14} />
                      <span>Confirm Rejection</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={14} />
                      <span>Confirm Approval</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PageContainer>
  )
}
