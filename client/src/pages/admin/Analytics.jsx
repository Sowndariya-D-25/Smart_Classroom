import { useEffect, useState, useMemo } from 'react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import {
  BarChart3,
  TrendingUp,
  Users,
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  RotateCcw,
  BookOpen,
  Award,
  TrendingDown,
  GraduationCap,
} from 'lucide-react'
import PageContainer from '../../components/layout/PageContainer'
import SectionHeader from '../../components/common/SectionHeader'
import StatCard from '../../components/common/StatCard'
import EmptyState from '../../components/common/EmptyState'
import { useToast } from '../../context/ToastContext'
import { adminAnalyticsApi, timetableApi, studentsApi } from '../../services/adminService'
import { normalizeDepartment } from '../../utils/department'

const COLORS = {
  present: '#059669',
  late: '#D97706',
  absent: '#DC2626',
  excellent: '#059669',
  good: '#10B981',
  low: '#F59E0B',
  critical: '#EF4444',
  bar1: '#059669',
  bar2: '#10B981',
  bar3: '#34D399',
}

export default function AdminAnalytics() {
  const toast = useToast()

  const [range, setRange] = useState('all') // '7d' | '30d' | 'all'
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  // Filter options from timetableApi.getOptions
  const [options, setOptions] = useState({
    departments: [],
    subjects: [],
    teachers: [],
    sections: ['A', 'B', 'C', 'D'],
  })
  const [availableSections, setAvailableSections] = useState([])

  // Filter state
  const [filters, setFilters] = useState({
    academicYear: '2026-2027',
    dateFrom: '',
    dateTo: '',
    department: '',
    year: '',
    section: '',
    subject: '',
    teacher: '',
  })

  useEffect(() => {
    timetableApi
      .getOptions()
      .then((opts) => {
        setOptions({
          departments: opts.departments || [],
          subjects: opts.subjects || [],
          teachers: opts.teachers || [],
          sections: opts.sections || ['A', 'B', 'C', 'D'],
        })
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    studentsApi
      .getSections({
        department: filters.department || undefined,
        year: filters.year || undefined,
      })
      .then((res) => {
        setAvailableSections(res.sections || [])
      })
      .catch(() => {
        setAvailableSections([])
      })
  }, [filters.department, filters.year])

  const canonicalDepartments = useMemo(() => {
    const raw = options.departments || []
    const normalized = raw.map(normalizeDepartment)
    return Array.from(new Set(normalized)).filter(Boolean).sort()
  }, [options.departments])

  const filterSubjects = useMemo(() => {
    return (options.subjects || []).filter((s) => {
      if (filters.department && normalizeDepartment(s.department) !== normalizeDepartment(filters.department)) {
        return false
      }
      if (filters.year) {
        const yr = Number(filters.year)
        const allowed = [(yr - 1) * 2 + 1, yr * 2]
        if (!allowed.includes(s.semester)) return false
      }
      return true
    })
  }, [options.subjects, filters.department, filters.year])

  const filterTeachers = useMemo(() => {
    let list = options.teachers || []
    if (filters.department) {
      list = list.filter(
        (t) => normalizeDepartment(t.department) === normalizeDepartment(filters.department),
      )
    }
    if (filters.subject) {
      const selectedSub = (options.subjects || []).find((s) => (s._id || s) === filters.subject)
      if (selectedSub?.teachers?.length > 0) {
        const assignedIds = new Set(selectedSub.teachers.map((t) => (t._id || t).toString()))
        list = list.filter((t) => assignedIds.has(t._id.toString()))
      } else {
        list = []
      }
    }
    return list
  }, [options.teachers, options.subjects, filters.subject, filters.department])

  const handleFilterChange = (field, val) => {
    const updated = { ...filters, [field]: val }
    if (field === 'department') {
      updated.year = ''
      updated.section = ''
      updated.subject = ''
      updated.teacher = ''
    } else if (field === 'year') {
      updated.section = ''
      updated.subject = ''
      updated.teacher = ''
    } else if (field === 'section') {
      updated.subject = ''
      updated.teacher = ''
    } else if (field === 'subject') {
      updated.teacher = ''
    }
    setFilters(updated)
  }

  const fetchAnalytics = () => {
    setLoading(true)
    adminAnalyticsApi
      .getOverview({ range, ...filters })
      .then((res) => setData(res))
      .catch((err) => {
        toast.error(err.response?.data?.message || 'Failed to load institutional analytics')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchAnalytics()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    range,
    filters.dateFrom,
    filters.dateTo,
    filters.department,
    filters.year,
    filters.section,
    filters.subject,
    filters.teacher,
  ])

  const handleResetFilters = () => {
    setRange('all')
    setFilters({
      academicYear: '2026-2027',
      dateFrom: '',
      dateTo: '',
      department: '',
      year: '',
      section: '',
      subject: '',
      teacher: '',
    })
  }

  const {
    kpis = {},
    distribution = {},
    studentDistribution = {},
    trend = [],
    departmentWise = [],
    yearWise = [],
    sectionWise = [],
    subjectWise = [],
    lowAttendance = [],
    teacherAnalytics = [],
  } = data || {}

  // 1. Overall Attendance Display (Zero sessions = N/A)
  const overallDisplay =
    kpis.overallPercentage !== null && kpis.overallPercentage !== undefined
      ? `${kpis.overallPercentage}%`
      : 'N/A'

  // Status pie chart dataset
  const statusPieData = [
    { name: 'Present', value: distribution.present || 0, color: COLORS.present },
    { name: 'Late', value: distribution.late || 0, color: COLORS.late },
    { name: 'Absent', value: distribution.absent || 0, color: COLORS.absent },
  ]
  const totalStatusMarked = (distribution.present || 0) + (distribution.late || 0) + (distribution.absent || 0)

  // Student distribution pie chart dataset
  const studentDistPieData = [
    { name: 'Excellent (≥90%)', value: studentDistribution.excellent || 0, color: COLORS.excellent },
    { name: 'Good (75-89%)', value: studentDistribution.good || 0, color: COLORS.good },
    { name: 'Low (60-74%)', value: studentDistribution.low || 0, color: COLORS.low },
    { name: 'Critical (<60%)', value: studentDistribution.critical || 0, color: COLORS.critical },
  ]
  const totalStudentsDistributed =
    (studentDistribution.excellent || 0) +
    (studentDistribution.good || 0) +
    (studentDistribution.low || 0) +
    (studentDistribution.critical || 0)

  return (
    <PageContainer>
      <SectionHeader
        title="Analytics"
        subtitle="Analyze attendance trends, student performance, department performance, and academic activity."
      />

      {/* Exactly 5 Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          icon={TrendingUp}
          label="Overall Attendance"
          value={loading ? '…' : overallDisplay}
          subtext={totalStatusMarked > 0 ? `${totalStatusMarked} attendance records` : 'No sessions = N/A'}
        />
        <StatCard
          icon={AlertTriangle}
          label="Students Below 75%"
          value={loading ? '…' : (kpis.studentsBelowThreshold ?? 0)}
          subtext="Policy non-compliance"
        />
        <StatCard
          icon={Award}
          label="Best Performing Department"
          value={loading ? '…' : (kpis.bestDepartment || '—')}
          subtext="Highest attendance rate"
        />
        <StatCard
          icon={TrendingDown}
          label="Lowest Performing Department"
          value={loading ? '…' : (kpis.lowestDepartment || '—')}
          subtext="Needs academic follow-up"
        />
        <StatCard
          icon={Calendar}
          label="Attendance Sessions"
          value={loading ? '…' : (kpis.totalSessions ?? 0)}
          subtext="Completed classes"
        />
      </div>

      {/* Zero data notification */}
      {!loading && totalStatusMarked === 0 && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-center text-xs text-amber-800 font-medium">
          No attendance data available for the selected filters.
        </div>
      )}

      {/* Analytics Filter Toolbar */}
      <div className="mt-6 card rounded-[22px] border border-line bg-surface p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-muted font-display">
            Analytics Filters
          </span>
          <div className="flex items-center gap-2">
            {/* Range Toggle */}
            <div className="inline-flex items-center gap-1 rounded-2xl border border-line bg-[#F0F5F1] p-1 shadow-2xs">
              {[
                { label: 'Last 7 Days', value: '7d' },
                { label: 'Last 30 Days', value: '30d' },
                { label: 'All Time', value: 'all' },
              ].map((btn) => (
                <button
                  key={btn.value}
                  onClick={() => setRange(btn.value)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                    range === btn.value
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'text-muted hover:text-ink hover:bg-emerald-50/60'
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>
            <button
              onClick={handleResetFilters}
              title="Reset Filters"
              className="rounded-xl border border-line bg-surface p-2 text-muted hover:text-ink transition shadow-xs"
            >
              <RotateCcw size={14} />
            </button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {/* Academic Year */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted">Academic Year</label>
            <select
              value={filters.academicYear}
              onChange={(e) => handleFilterChange('academicYear', e.target.value)}
              className="mt-1 h-10 w-full rounded-xl border border-line bg-surface px-2.5 text-xs font-semibold text-ink shadow-xs transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              {(options.academicYears?.length ? options.academicYears : ['2026-2027']).map((ay) => (
                <option key={ay} value={ay}>
                  {ay}
                </option>
              ))}
            </select>
          </div>

          {/* Date From */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted">Date From</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
              className="mt-1 h-10 w-full rounded-xl border border-line bg-surface px-2 text-xs font-semibold text-ink shadow-xs transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Date To */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted">Date To</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => handleFilterChange('dateTo', e.target.value)}
              className="mt-1 h-10 w-full rounded-xl border border-line bg-surface px-2 text-xs font-semibold text-ink shadow-xs transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Department */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted">Department</label>
            <select
              value={filters.department}
              onChange={(e) => handleFilterChange('department', e.target.value)}
              className="mt-1 h-10 w-full rounded-xl border border-line bg-surface px-2.5 text-xs font-semibold text-ink shadow-xs transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
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
              className="mt-1 h-10 w-full rounded-xl border border-line bg-surface px-2.5 text-xs font-semibold text-ink shadow-xs transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">All Years</option>
              <option value="1">Year 1</option>
              <option value="2">Year 2</option>
              <option value="3">Year 3</option>
              <option value="4">Year 4</option>
            </select>
          </div>

          {/* Section */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted">Section</label>
            <select
              value={filters.section}
              onChange={(e) => handleFilterChange('section', e.target.value)}
              className="mt-1 h-10 w-full rounded-xl border border-line bg-surface px-2.5 text-xs font-semibold text-ink shadow-xs transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">All Sections</option>
              {(availableSections.length > 0 ? availableSections : (filters.department || filters.year ? [] : options.sections)).map((s) => (
                <option key={s} value={s}>
                  Section {s}
                </option>
              ))}
              {(filters.department || filters.year) && availableSections.length === 0 && (
                <option value="" disabled>
                  No sections available
                </option>
              )}
            </select>
          </div>

          {/* Subject */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted">Subject</label>
            <select
              value={filters.subject}
              onChange={(e) => handleFilterChange('subject', e.target.value)}
              className="mt-1 h-10 w-full rounded-xl border border-line bg-surface px-2.5 text-xs font-semibold text-ink shadow-xs transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">All Subjects</option>
              {filterSubjects.map((s) => (
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
              className="mt-1 h-10 w-full rounded-xl border border-line bg-surface px-2.5 text-xs font-semibold text-ink shadow-xs transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">All Teachers</option>
              {filterTeachers.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Chart 1: Attendance Trend Over Time */}
      <div className="mt-6 card rounded-[22px] border border-line bg-surface p-6 shadow-card">
        <h2 className="text-base font-bold text-ink font-display">
          Attendance Trend Over Time
        </h2>
        <p className="text-xs text-muted font-medium">Day-by-day attendance rate across all conducted sessions.</p>

        {trend.length > 0 ? (
          <div className="mt-4 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2EAE4" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6B7F76' }} axisLine={{ stroke: '#E2EAE4' }} />
                <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 11, fill: '#6B7F76' }} axisLine={{ stroke: '#E2EAE4' }} />
                <Tooltip
                  formatter={(val) => (val !== null ? `${val}%` : 'N/A')}
                  contentStyle={{ borderRadius: '14px', border: '1px solid #E2EAE4', fontSize: '12px' }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="percentage"
                  name="Attendance Rate"
                  stroke="#059669"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#059669' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="py-12 text-center text-xs text-muted font-medium">
            No attendance trend data available for the selected filters.
          </div>
        )}
      </div>

      {/* Charts 2 & 3: Department-wise & Year-wise Attendance */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Chart 2: Department-wise */}
        <div className="card rounded-[22px] border border-line bg-surface p-6 shadow-card">
          <h2 className="text-base font-bold text-ink font-display">
            Department-wise Attendance
          </h2>
          <p className="text-xs text-muted font-medium">Comparative attendance performance by academic department.</p>

          {departmentWise.length > 0 ? (
            <div className="mt-4 h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={departmentWise}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2EAE4" />
                  <XAxis dataKey="department" tick={{ fontSize: 11, fill: '#6B7F76' }} axisLine={{ stroke: '#E2EAE4' }} />
                  <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 11, fill: '#6B7F76' }} axisLine={{ stroke: '#E2EAE4' }} />
                  <Tooltip
                    formatter={(val) => (val !== null ? `${val}%` : 'N/A')}
                    contentStyle={{ borderRadius: '14px', border: '1px solid #E2EAE4', fontSize: '12px' }}
                  />
                  <Bar dataKey="percentage" name="Attendance %" fill={COLORS.bar1} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="py-12 text-center text-xs text-muted font-medium">No department data.</div>
          )}
        </div>

        {/* Chart 3: Year-wise */}
        <div className="card rounded-[22px] border border-line bg-surface p-6 shadow-card">
          <h2 className="text-base font-bold text-ink font-display">
            Year-wise Attendance
          </h2>
          <p className="text-xs text-muted font-medium">Attendance percentages broken down by undergraduate study year.</p>

          {yearWise.length > 0 ? (
            <div className="mt-4 h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={yearWise}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2EAE4" />
                  <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#6B7F76' }} axisLine={{ stroke: '#E2EAE4' }} />
                  <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 11, fill: '#6B7F76' }} axisLine={{ stroke: '#E2EAE4' }} />
                  <Tooltip
                    formatter={(val) => (val !== null ? `${val}%` : 'N/A')}
                    contentStyle={{ borderRadius: '14px', border: '1px solid #E2EAE4', fontSize: '12px' }}
                  />
                  <Bar dataKey="percentage" name="Attendance %" fill={COLORS.bar2} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="py-12 text-center text-xs text-muted font-medium">No year data.</div>
          )}
        </div>
      </div>

      {/* Charts 4 & 5: Section-wise & Subject-wise Attendance */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Chart 4: Section-wise */}
        <div className="card rounded-[22px] border border-line bg-surface p-6 shadow-card">
          <h2 className="text-base font-bold text-ink font-display">
            Section-wise Attendance
          </h2>
          <p className="text-xs text-muted font-medium">Attendance distribution across student sections.</p>

          {sectionWise.length > 0 ? (
            <div className="mt-4 h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sectionWise}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2EAE4" />
                  <XAxis dataKey="section" tick={{ fontSize: 11, fill: '#6B7F76' }} axisLine={{ stroke: '#E2EAE4' }} />
                  <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 11, fill: '#6B7F76' }} axisLine={{ stroke: '#E2EAE4' }} />
                  <Tooltip
                    formatter={(val) => (val !== null ? `${val}%` : 'N/A')}
                    contentStyle={{ borderRadius: '14px', border: '1px solid #E2EAE4', fontSize: '12px' }}
                  />
                  <Bar dataKey="percentage" name="Attendance %" fill={COLORS.bar3} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="py-12 text-center text-xs text-muted font-medium">No section data.</div>
          )}
        </div>

        {/* Chart 5: Subject-wise */}
        <div className="card rounded-[22px] border border-line bg-surface p-6 shadow-card">
          <h2 className="text-base font-bold text-ink font-display">
            Subject-wise Attendance
          </h2>
          <p className="text-xs text-muted font-medium">Attendance rate across all active course subjects.</p>

          {subjectWise.length > 0 ? (
            <div className="mt-4 h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={subjectWise.map((s) => ({ name: s.subject?.code || s.subject?.name, percentage: s.percentage }))}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2EAE4" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6B7F76' }} axisLine={{ stroke: '#E2EAE4' }} />
                  <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 11, fill: '#6B7F76' }} axisLine={{ stroke: '#E2EAE4' }} />
                  <Tooltip
                    formatter={(val) => (val !== null ? `${val}%` : 'N/A')}
                    contentStyle={{ borderRadius: '14px', border: '1px solid #E2EAE4', fontSize: '12px' }}
                  />
                  <Bar dataKey="percentage" name="Attendance %" fill="#059669" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="py-12 text-center text-xs text-muted font-medium">No subject data.</div>
          )}
        </div>
      </div>

      {/* Charts 6 & 8: Student Attendance Distribution & Attendance Status Distribution */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Chart 6: Student Attendance Distribution */}
        <div className="card rounded-[22px] border border-line bg-surface p-6 shadow-card">
          <h2 className="text-base font-bold text-ink font-display">
            Student Attendance Distribution
          </h2>
          <p className="text-xs text-muted font-medium">Categorization of enrolled students by attendance bracket.</p>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 text-center">
            <div className="rounded-2xl border border-line bg-emerald-50/50 p-3.5">
              <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                90–100%
              </span>
              <p className="mt-1 text-2xl font-black text-ink">
                {studentDistribution.excellent || 0}
              </p>
              <span className="text-[10px] text-muted font-medium">Excellent</span>
            </div>
            <div className="rounded-2xl border border-line bg-sage-50/50 p-3.5">
              <span className="text-[11px] font-bold text-ink uppercase tracking-wider">
                75–89%
              </span>
              <p className="mt-1 text-2xl font-black text-ink">
                {studentDistribution.good || 0}
              </p>
              <span className="text-[10px] text-muted font-medium">Good</span>
            </div>
            <div className="rounded-2xl border border-line bg-amber-50/50 p-3.5">
              <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">
                60–74%
              </span>
              <p className="mt-1 text-2xl font-black text-ink">
                {studentDistribution.low || 0}
              </p>
              <span className="text-[10px] text-muted font-medium">Low</span>
            </div>
            <div className="rounded-2xl border border-line bg-rose-50/50 p-3.5">
              <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wider">
                &lt;60%
              </span>
              <p className="mt-1 text-2xl font-black text-ink">
                {studentDistribution.critical || 0}
              </p>
              <span className="text-[10px] text-muted font-medium">Critical</span>
            </div>
          </div>

          {totalStudentsDistributed > 0 && (
            <div className="mt-4 h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={studentDistPieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={65}
                  >
                    {studentDistPieData.map((e) => (
                      <Cell key={e.name} fill={e.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '14px', border: '1px solid #E2EAE4', fontSize: '12px' }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Chart 8: Attendance Status Distribution */}
        <div className="card rounded-[22px] border border-line bg-surface p-6 shadow-card">
          <h2 className="text-base font-bold text-ink font-display">
            Attendance Status Distribution
          </h2>
          <p className="text-xs text-muted font-medium">Overall ratio of Present, Late, and Absent recorded marks.</p>

          {totalStatusMarked > 0 ? (
            <div className="mt-4 flex flex-col items-center">
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusPieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={78}
                      paddingAngle={5}
                    >
                      {statusPieData.map((e) => (
                        <Cell key={e.name} fill={e.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '14px', border: '1px solid #E2EAE4', fontSize: '12px' }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-2 flex w-full justify-around border-t border-line pt-3 text-center">
                <div>
                  <span className="text-xs text-emerald-800 font-bold uppercase tracking-wider text-[11px]">Present</span>
                  <p className="text-lg font-black text-ink">
                    {distribution.present || 0}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-amber-800 font-bold uppercase tracking-wider text-[11px]">Late</span>
                  <p className="text-lg font-black text-ink">
                    {distribution.late || 0}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-rose-800 font-bold uppercase tracking-wider text-[11px]">Absent</span>
                  <p className="text-lg font-black text-ink">
                    {distribution.absent || 0}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-xs text-muted font-medium">
              No attendance records recorded yet.
            </div>
          )}
        </div>
      </div>

      {/* Chart 7: Low Attendance Analysis */}
      <div className="mt-6 card rounded-[22px] border border-line bg-surface p-6 shadow-card">
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div>
            <h2 className="text-base font-bold text-ink font-display">
              Low Attendance Analysis
            </h2>
            <p className="text-xs text-muted font-medium">Students whose attendance rate is below policy threshold (&lt;75%).</p>
          </div>
          {lowAttendance.length > 0 && (
            <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700 border border-rose-100">
              {lowAttendance.length} At-Risk Students
            </span>
          )}
        </div>

        <div className="mt-4">
          {lowAttendance.length > 0 ? (
            <div className="overflow-x-auto rounded-2xl border border-line">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-line bg-[#F8FAF7]/90 text-[11px] font-bold uppercase tracking-wider text-muted">
                  <tr>
                    <th className="p-3">Student</th>
                    <th className="p-3">Register No.</th>
                    <th className="p-3">Department</th>
                    <th className="p-3">Section</th>
                    <th className="p-3 text-center">Present / Attended</th>
                    <th className="p-3 text-center">Absent</th>
                    <th className="p-3 text-center">Attendance %</th>
                    <th className="p-3 text-right">Risk Level</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {lowAttendance.map((st) => (
                    <tr key={st._id} className="transition-colors hover:bg-sage-50/40">
                      <td className="p-3 font-bold text-ink">
                        {st.name}
                      </td>
                      <td className="p-3 font-mono text-muted text-[11px]">{st.rollNumber}</td>
                      <td className="p-3 font-medium text-ink">{st.department}</td>
                      <td className="p-3 font-bold text-ink">{st.section}</td>
                      <td className="p-3 text-center font-bold text-emerald-700">
                        {st.present}
                      </td>
                      <td className="p-3 text-center font-bold text-rose-600">
                        {st.absent}
                      </td>
                      <td className="p-3 text-center font-black text-ink">
                        {st.percentage}%
                      </td>
                      <td className="p-3 text-right">
                        <span
                          className={`inline-flex rounded-lg px-2.5 py-1 text-[11px] font-bold ${
                            st.isCritical
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {st.isCritical ? 'Critical (<60%)' : 'Low (<75%)'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-muted font-medium">
              <CheckCircle2 className="mx-auto mb-2 h-6 w-6 text-emerald-600" />
              All active students currently meet the minimum 75% attendance requirement.
            </div>
          )}
        </div>
      </div>

      {/* Chart 9: Teacher-wise Session Analytics */}
      <div className="mt-6 card rounded-[22px] border border-line bg-surface p-6 shadow-card">
        <h2 className="text-base font-bold text-ink font-display">
          Faculty Session Conducted Analytics
        </h2>
        <p className="text-xs text-muted font-medium">Descriptive record of sessions conducted by faculty members.</p>

        {teacherAnalytics.length > 0 ? (
          <div className="mt-4 overflow-x-auto rounded-2xl border border-line">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-line bg-[#F8FAF7]/90 text-[11px] font-bold uppercase tracking-wider text-muted">
                <tr>
                  <th className="p-3">Faculty Member</th>
                  <th className="p-3">Employee ID</th>
                  <th className="p-3">Department</th>
                  <th className="p-3 text-center">Sessions Conducted</th>
                  <th className="p-3 text-center">Student Marks Recorded</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {teacherAnalytics.map((t) => (
                  <tr key={t.teacherId} className="transition-colors hover:bg-sage-50/40">
                    <td className="p-3 font-bold text-ink">
                      {t.name}
                    </td>
                    <td className="p-3 font-mono text-muted text-[11px]">{t.employeeId}</td>
                    <td className="p-3 font-medium text-ink">{t.department}</td>
                    <td className="p-3 text-center font-black text-ink">
                      {t.sessionsConducted}
                    </td>
                    <td className="p-3 text-center font-bold text-primary">
                      {t.recordsMarked}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-muted font-medium">
            No faculty session records available for the selected filters.
          </div>
        )}
      </div>
    </PageContainer>
  )
}
