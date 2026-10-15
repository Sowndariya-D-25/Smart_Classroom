import { useEffect, useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import {
  FileText, Download, Printer, Users, TrendingUp,
  AlertTriangle, CheckCircle, XCircle, Calendar,
  Clock, ScanFace, ChevronRight, X, RotateCcw,
  Sparkles,
} from 'lucide-react'
import PageContainer from '../../components/layout/PageContainer'
import SectionHeader from '../../components/common/SectionHeader'
import StatCard from '../../components/common/StatCard'
import StatusBadge from '../../components/common/StatusBadge'
import EmptyState from '../../components/common/EmptyState'
import { inputClass } from '../../components/FormField'
import { useToast } from '../../context/ToastContext'
import {
  getTeacherReports,
  getReportFilterOptions,
  getReportSessionDetail,
  getReportStudentDetail,
} from '../../services/teacherService'
import { normalizeDepartment } from '../../utils/department'

const COLORS = {
  present: '#2F6F5E',
  late: '#DB9558',
  absent: '#DC2626',
  accent: '#97A87A',
  face: '#0D251F',
  manual: '#DB9558',
}

export default function Reports() {
  const toast = useToast()
  const [searchParams] = useSearchParams()

  // Filter options loaded from backend
  const [filterOptions, setFilterOptions] = useState({
    subjects: [],
    departments: [],
    sections: [],
    students: [],
  })

  // Selected filters - all 6 required
  const [filters, setFilters] = useState({
    department: '',
    section: '',
    subject: searchParams.get('subject') || '',
    student: '',
    startDate: '',
    endDate: '',
  })

  // Report Data
  const [reportData, setReportData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  // Interactive Modals
  const [sessionModalId, setSessionModalId] = useState(null)
  const [sessionModalData, setSessionModalData] = useState(null)
  const [sessionModalLoading, setSessionModalLoading] = useState(false)

  const [studentModalId, setStudentModalId] = useState(null)
  const [studentModalData, setStudentModalData] = useState(null)
  const [studentModalLoading, setStudentModalLoading] = useState(false)

  // Canonical unique departments from backend options
  const canonicalDepartments = useMemo(() => {
    return Array.from(new Set((filterOptions.departments || []).map((d) => normalizeDepartment(d, '')))).filter(Boolean).sort()
  }, [filterOptions.departments])

  // Load filter options on mount
  useEffect(() => {
    getReportFilterOptions()
      .then((data) => {
        setFilterOptions(data)
        const depts = Array.from(new Set((data.departments || []).map((d) => normalizeDepartment(d, '')))).filter(Boolean).sort()
        if (depts.length > 0) {
          setFilters((prev) => ({
            ...prev,
            department: prev.department ? normalizeDepartment(prev.department, 'CSE') : depts[0],
            section: prev.section || data.sections?.[0] || '',
            subject: prev.subject || data.subjects?.[0]?._id || '',
          }))
        }
      })
      .catch(() => toast.error('Could not load report filter options.'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Dynamic filter lists
  const filteredSections = useMemo(() => {
    if (!filters.department || !filterOptions.students?.length) return filterOptions.sections || []
    const normDept = normalizeDepartment(filters.department, '')
    const inDept = filterOptions.students.filter(
      (s) => normalizeDepartment(s.department, '') === normDept
    )
    const secs = Array.from(new Set(inDept.map((s) => s.section).filter(Boolean))).sort()
    return secs.length > 0 ? secs : filterOptions.sections || []
  }, [filterOptions, filters.department])

  const filteredSubjects = useMemo(() => {
    if (!filters.department) return filterOptions.subjects || []
    const normDept = normalizeDepartment(filters.department, '')
    const filtered = (filterOptions.subjects || []).filter(
      (s) => normalizeDepartment(s.department, '') === normDept
    )
    return filtered.length > 0 ? filtered : filterOptions.subjects || []
  }, [filterOptions.subjects, filters.department])

  const filteredStudents = useMemo(() => {
    const normDept = normalizeDepartment(filters.department, '')
    return (filterOptions.students || []).filter((st) => {
      const matchDept = !filters.department || normalizeDepartment(st.department, '') === normDept
      const matchSec = !filters.section || st.section === filters.section
      return matchDept && matchSec
    })
  }, [filterOptions.students, filters.department, filters.section])

  // Form validity: ALL 6 required
  const isGenerateEnabled = Boolean(
    filters.department &&
    filters.section &&
    filters.subject &&
    filters.student &&
    filters.startDate &&
    filters.endDate
  )

  // Load reports
  const fetchReports = async (customFilters = filters) => {
    try {
      setLoading(true)
      setHasSearched(true)
      const data = await getTeacherReports(customFilters)
      setReportData(data)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to generate attendance report.')
    } finally {
      setLoading(false)
    }
  }

  // Handle filter changes
  const handleFilterChange = (key, value) => {
    setFilters((prev) => {
      const updated = { ...prev, [key]: value }
      if (key === 'department') {
        // Reset student if they might not belong to this department
        updated.student = ''
      }
      if (key === 'section') {
        updated.student = ''
      }
      return updated
    })
  }

  const handleGenerateReport = (e) => {
    e.preventDefault()
    if (!isGenerateEnabled) {
      toast.warning('Please select Department, Section, Subject, Student, and Date Range.')
      return
    }
    fetchReports(filters)
  }

  const handleResetFilters = () => {
    const reset = {
      department: filterOptions.departments?.[0] || '',
      section: filterOptions.sections?.[0] || '',
      subject: filterOptions.subjects?.[0]?._id || '',
      student: '',
      startDate: '',
      endDate: '',
    }
    setFilters(reset)
    setReportData(null)
    setHasSearched(false)
  }

  // Drill-down: Session modal
  const handleOpenSessionModal = async (sessionId) => {
    try {
      setSessionModalId(sessionId)
      setSessionModalLoading(true)
      const data = await getReportSessionDetail(sessionId)
      setSessionModalData(data)
    } catch (err) {
      toast.error('Failed to load session details.')
      setSessionModalId(null)
    } finally {
      setSessionModalLoading(false)
    }
  }

  // Drill-down: Student modal
  const handleOpenStudentModal = async (studentId) => {
    try {
      setStudentModalId(studentId)
      setStudentModalLoading(true)
      const data = await getReportStudentDetail(studentId)
      setStudentModalData(data)
    } catch (err) {
      toast.error('Failed to load student attendance details.')
      setStudentModalId(null)
    } finally {
      setStudentModalLoading(false)
    }
  }

  // CSV Export
  const handleExportCSV = () => {
    if (!reportData || !reportData.studentAttendance?.length) {
      toast.error('No attendance data available to export.')
      return
    }

    const headers = ['Student Name', 'Register No', 'Department', 'Section', 'Total Classes', 'Present', 'Absent', 'Attendance %', 'Status']
    const rows = reportData.studentAttendance.map((st) => [
      `"${st.student.name}"`,
      `"${st.student.rollNumber || st.student.studentId}"`,
      `"${normalizeDepartment(st.student.department, '')}"`,
      `"${st.student.section || ''}"`,
      st.totalClasses,
      st.present,
      st.absent,
      st.percentage !== null ? `${st.percentage}%` : 'N/A',
      `"${st.status}"`,
    ])

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `attendance_report_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('Attendance report exported to CSV')
  }

  // Print
  const handlePrint = () => {
    window.print()
  }

  // Data helpers
  const kpis = reportData?.kpis || {}
  const todaySummary = reportData?.todaySummary || {}
  const subjectWise = reportData?.subjectWise || []
  const dailySessions = reportData?.dailySessions || []
  const studentAttendance = reportData?.studentAttendance || []
  const lowAttendance = reportData?.lowAttendance || []
  const methodAnalytics = reportData?.methodAnalytics || {}
  const faceSummary = reportData?.faceSummary || {}
  const trend = reportData?.trend || []

  const methodChartData = useMemo(() => {
    return [
      { name: 'Face Recognition', value: methodAnalytics.faceCount || 0, color: COLORS.face },
      { name: 'Manual', value: methodAnalytics.manualCount || 0, color: COLORS.manual },
    ].filter((d) => d.value > 0)
  }, [methodAnalytics])

  return (
    <PageContainer>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            Attendance Reports
          </h1>
          <p className="mt-1 text-sm text-muted">
            Real-time MongoDB attendance analytics, student performance, and method breakdown.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="btn-secondary inline-flex items-center gap-1.5 text-xs font-semibold"
          >
            <Download size={15} />
            Export CSV
          </button>
          <button
            onClick={handlePrint}
            className="btn-secondary inline-flex items-center gap-1.5 text-xs font-semibold"
          >
            <Printer size={15} />
            Print Report
          </button>
        </div>
      </div>

      {/* Filter Card */}
      <div className="card p-5 print:hidden">
        <form onSubmit={handleGenerateReport} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {/* 1. Department */}
            <div>
              <label className="block text-xs font-semibold text-muted mb-1">Department *</label>
              <select
                value={filters.department}
                onChange={(e) => handleFilterChange('department', e.target.value)}
                className={inputClass}
                required
              >
                <option value="">Select Department…</option>
                {canonicalDepartments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Section */}
            <div>
              <label className="block text-xs font-semibold text-muted mb-1">Section *</label>
              <select
                value={filters.section}
                onChange={(e) => handleFilterChange('section', e.target.value)}
                className={inputClass}
                required
              >
                <option value="">Select Section…</option>
                {filteredSections.map((s) => (
                  <option key={s} value={s}>
                    Section {s}
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Subject */}
            <div>
              <label className="block text-xs font-semibold text-muted mb-1">Subject *</label>
              <select
                value={filters.subject}
                onChange={(e) => handleFilterChange('subject', e.target.value)}
                className={inputClass}
                required
              >
                <option value="">Select Subject…</option>
                {filteredSubjects.map((sub) => (
                  <option key={sub._id} value={sub._id}>
                    {sub.name} ({sub.code})
                  </option>
                ))}
              </select>
            </div>

            {/* 4. Student */}
            <div>
              <label className="block text-xs font-semibold text-muted mb-1">Student *</label>
              <select
                value={filters.student}
                onChange={(e) => handleFilterChange('student', e.target.value)}
                className={inputClass}
                required
              >
                <option value="">Select Student…</option>
                {filteredStudents.map((st) => (
                  <option key={st._id} value={st._id}>
                    {st.name} ({st.rollNumber || st.studentId})
                  </option>
                ))}
              </select>
            </div>

            {/* 5. From Date */}
            <div>
              <label className="block text-xs font-semibold text-muted mb-1">From Date *</label>
              <input
                type="date"
                required
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
                className={inputClass}
              />
            </div>

            {/* 6. To Date */}
            <div>
              <label className="block text-xs font-semibold text-muted mb-1">To Date *</label>
              <input
                type="date"
                required
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-line">
            <button
              type="button"
              onClick={handleResetFilters}
              className="btn-secondary px-4 text-xs font-semibold"
            >
              <RotateCcw size={14} className="mr-1.5" /> Reset Filters
            </button>
            <button
              type="submit"
              disabled={!isGenerateEnabled || loading}
              className="btn-primary px-6 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Generating Report…' : 'Generate Report'}
            </button>
          </div>
        </form>
      </div>

      {loading ? (
        <div className="flex min-h-[300px] items-center justify-center">
          <p className="text-sm text-muted animate-pulse">Calculating attendance analytics…</p>
        </div>
      ) : !hasSearched ? (
        <div className="card p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-primary-700">
            <FileText size={24} />
          </div>
          <h3 className="mt-4 text-base font-semibold text-ink">Ready to Generate Attendance Report</h3>
          <p className="mt-1 text-sm text-muted max-w-md mx-auto">
            Select Department, Section, Subject, Student, and Date Range above, then click <strong>Generate Report</strong>.
          </p>
        </div>
      ) : !reportData ? (
        <EmptyState
          icon={AlertTriangle}
          title="No attendance data found"
          description="Try changing the filter parameters above or selecting a different date range."
        />
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard
              title="Total Students"
              value={kpis.totalStudents || 0}
              icon={Users}
              description="Across selected filters"
              colorScheme="blue"
            />
            <StatCard
              title="Average Attendance"
              value={kpis.averageAttendance !== null ? `${kpis.averageAttendance}%` : 'N/A'}
              icon={TrendingUp}
              description="Present & Late records"
              colorScheme="emerald"
            />
            <StatCard
              title="Present Today"
              value={todaySummary.present || 0}
              icon={CheckCircle}
              description="Today's attendance"
              colorScheme="emerald"
            />
            <StatCard
              title="Absent Today"
              value={todaySummary.absent || 0}
              icon={XCircle}
              description="Today's absences"
              colorScheme="rose"
            />
            <StatCard
              title="Low Attendance"
              value={kpis.lowAttendanceCount || 0}
              icon={AlertTriangle}
              description={`Students below 75%`}
              colorScheme="amber"
            />
          </div>

          {/* Today's Attendance Summary Banner */}
          <div className="rounded-xl border border-primary-200 bg-primary-50/40 p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-display text-base font-bold text-ink flex items-center gap-2">
                  <Sparkles size={17} className="text-primary-600" />
                  Today's Attendance Summary
                </h3>
                <p className="text-xs text-muted mt-0.5">
                  Live session statistics for {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-sm font-semibold">
                <div className="flex items-center gap-1.5 text-primary-800">
                  <span className="text-xs text-muted font-normal">Present:</span>
                  <span className="font-mono text-base font-bold">{todaySummary.present || 0}</span>
                </div>
                <div className="flex items-center gap-1.5 text-danger">
                  <span className="text-xs text-muted font-normal">Absent:</span>
                  <span className="font-mono text-base font-bold">{todaySummary.absent || 0}</span>
                </div>
                <div className="flex items-center gap-1.5 text-ink">
                  <span className="text-xs text-muted font-normal">Total:</span>
                  <span className="font-mono text-base font-bold">{todaySummary.total || 0}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted font-normal">Rate:</span>
                  <span className="rounded-md bg-primary-100 px-2.5 py-0.5 font-mono text-sm font-bold text-primary-800">
                    {todaySummary.percentage !== null ? `${todaySummary.percentage}%` : 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Subject-Wise Attendance Chart */}
            <div className="card p-5">
              <SectionHeader
                title="Subject-wise Attendance"
                subtitle="Attendance percentage across your assigned subjects"
              />
              {subjectWise.length === 0 ? (
                <EmptyState title="No subject data available" />
              ) : (
                <div className="mt-4 h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={subjectWise.map((s) => ({
                        name: s.subject.code,
                        fullName: s.subject.name,
                        percentage: s.percentage ?? 0,
                      }))}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#E3E7EA" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} unit="%" />
                      <Tooltip
                        formatter={(val, _name, item) => [`${val}%`, item.payload.fullName]}
                      />
                      <Bar dataKey="percentage" fill={COLORS.present} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Attendance Trend Line Chart */}
            <div className="card p-5">
              <SectionHeader
                title="Attendance Trend"
                subtitle="Chronological daily attendance percentage"
              />
              {trend.length === 0 ? (
                <EmptyState
                  title="No trend data yet"
                  description="Complete attendance across multiple dates to view the trend."
                />
              ) : (
                <div className="mt-4 h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E3E7EA" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} unit="%" />
                      <Tooltip formatter={(v) => `${v}%`} />
                      <Line
                        type="monotone"
                        dataKey="percentage"
                        stroke={COLORS.present}
                        strokeWidth={2.5}
                        dot={{ r: 3 }}
                        connectNulls
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* Attendance Method & Computer Vision Summary */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Attendance Method Analytics */}
            <div className="card p-5">
              <SectionHeader
                title="Attendance Method Analytics"
                subtitle="Comparison between Computer Vision and Manual attendance records"
              />
              <div className="mt-4 grid gap-4 sm:grid-cols-2 items-center">
                <div className="h-52">
                  {methodChartData.length === 0 ? (
                    <EmptyState title="No records marked yet" />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={methodChartData}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={50}
                          outerRadius={75}
                          paddingAngle={3}
                        >
                          {methodChartData.map((entry) => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="rounded-lg border border-line bg-canvas p-3">
                    <div className="flex items-center justify-between text-xs text-muted">
                      <span>Face Recognition</span>
                      <span className="font-bold text-ink">{methodAnalytics.facePercentage || 0}%</span>
                    </div>
                    <p className="mt-1 font-mono text-lg font-bold text-blue-600">
                      {methodAnalytics.faceCount || 0} <span className="text-xs font-normal text-muted">records</span>
                    </p>
                  </div>

                  <div className="rounded-lg border border-line bg-canvas p-3">
                    <div className="flex items-center justify-between text-xs text-muted">
                      <span>Manual Marking</span>
                      <span className="font-bold text-ink">{methodAnalytics.manualPercentage || 0}%</span>
                    </div>
                    <p className="mt-1 font-mono text-lg font-bold text-orange-600">
                      {methodAnalytics.manualCount || 0} <span className="text-xs font-normal text-muted">records</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Face Recognition Analytics Summary */}
            <div className="card p-5">
              <SectionHeader
                title="Face Recognition Analytics"
                subtitle="Computer Vision attendance metrics derived from database session logs"
              />
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-line bg-canvas p-3.5">
                  <p className="text-xs font-semibold text-muted">Face-based Sessions</p>
                  <p className="mt-1 font-mono text-2xl font-bold text-ink">
                    {faceSummary.faceSessionsCount || 0}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted">Sessions with biometric verification</p>
                </div>

                <div className="rounded-lg border border-line bg-canvas p-3.5">
                  <p className="text-xs font-semibold text-muted">Students Recognized</p>
                  <p className="mt-1 font-mono text-2xl font-bold text-emerald-600">
                    {faceSummary.studentsRecognized || 0}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted">Successfully verified by camera</p>
                </div>

                <div className="rounded-lg border border-line bg-canvas p-3.5">
                  <p className="text-xs font-semibold text-muted">Students Not Recognized</p>
                  <p className="mt-1 font-mono text-2xl font-bold text-amber-600">
                    {faceSummary.studentsNotRecognized || 0}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted">Roster students absent/undetected</p>
                </div>

                <div className="rounded-lg border border-line bg-canvas p-3.5">
                  <p className="text-xs font-semibold text-muted">Unknown Faces</p>
                  <p className="mt-1 font-mono text-2xl font-bold text-danger">
                    {faceSummary.unknownFacesCount || 0}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted">Unregistered sightings logged</p>
                </div>
              </div>
            </div>
          </div>

          {/* Low Attendance Section (Students Below 75%) */}
          <div className="card p-5">
            <SectionHeader
              title="Students Below 75% Attendance Threshold"
              subtitle="Students requiring attention · Click any student to inspect full attendance history"
            />
            {lowAttendance.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  icon={CheckCircle}
                  title="No students below the 75% threshold"
                  description="All students currently meet the required attendance quota."
                />
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-line bg-canvas text-xs uppercase text-muted">
                    <tr>
                      <th className="px-4 py-3">Student</th>
                      <th className="px-4 py-3">Register No</th>
                      <th className="px-4 py-3">Subject</th>
                      <th className="px-4 py-3">Total Classes</th>
                      <th className="px-4 py-3">Attended</th>
                      <th className="px-4 py-3">Absent</th>
                      <th className="px-4 py-3">Attendance %</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {lowAttendance.map((row, idx) => (
                      <tr
                        key={`${row.student._id}-${row.subject._id}-${idx}`}
                        onClick={() => handleOpenStudentModal(row.student._id)}
                        className="cursor-pointer transition-colors hover:bg-canvas/60"
                      >
                        <td className="px-4 py-3 font-medium text-ink">{row.student.name}</td>
                        <td className="px-4 py-3 font-mono text-xs text-muted">
                          {row.student.rollNumber || row.student.studentId}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-medium text-ink">{row.subject.name}</span>
                          <span className="text-xs text-muted ml-1.5">({row.subject.code})</span>
                        </td>
                        <td className="px-4 py-3 font-mono">{row.totalClasses}</td>
                        <td className="px-4 py-3 font-mono text-primary-700">{row.present}</td>
                        <td className="px-4 py-3 font-mono text-danger">{row.absent}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-danger">{row.percentage}%</span>
                            <StatusBadge status="Low Attendance" />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="inline-flex items-center text-xs font-semibold text-primary hover:underline">
                            Details <ChevronRight size={14} />
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Subject-Wise Attendance Table */}
          <div className="card p-5">
            <SectionHeader
              title="Subject-wise Attendance Summary"
              subtitle="Aggregated metrics for all assigned courses"
            />
            {subjectWise.length === 0 ? (
              <EmptyState title="No subjects assigned" />
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-line bg-canvas text-xs uppercase text-muted">
                    <tr>
                      <th className="px-4 py-3">Subject</th>
                      <th className="px-4 py-3">Code</th>
                      <th className="px-4 py-3">Completed Sessions</th>
                      <th className="px-4 py-3">Present</th>
                      <th className="px-4 py-3">Late</th>
                      <th className="px-4 py-3">Absent</th>
                      <th className="px-4 py-3">Attendance %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {subjectWise.map((sub) => (
                      <tr key={sub.subject._id}>
                        <td className="px-4 py-3 font-medium text-ink">{sub.subject.name}</td>
                        <td className="px-4 py-3 font-mono text-xs text-muted">{sub.subject.code}</td>
                        <td className="px-4 py-3 font-mono">{sub.totalSessions}</td>
                        <td className="px-4 py-3 font-mono text-primary-700">{sub.present}</td>
                        <td className="px-4 py-3 font-mono text-amber-600">{sub.late}</td>
                        <td className="px-4 py-3 font-mono text-danger">{sub.absent}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`font-mono font-bold ${
                              sub.percentage === null
                                ? 'text-muted'
                                : sub.percentage < 75
                                ? 'text-danger'
                                : 'text-primary-700'
                            }`}
                          >
                            {sub.percentage !== null ? `${sub.percentage}%` : 'N/A'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Daily Attendance Report */}
          <div className="card p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <SectionHeader
                title="Daily Attendance Report"
                subtitle="Period-wise class breakdown · Click a row to view the full student attendance sheet"
              />
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-muted">Select Date:</label>
                <input
                  type="date"
                  value={filters.date || reportData.selectedDate}
                  onChange={(e) => {
                    handleFilterChange('date', e.target.value)
                    fetchReports({ ...filters, date: e.target.value })
                  }}
                  className={`${inputClass} py-1 text-xs`}
                />
              </div>
            </div>

            {dailySessions.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  icon={Calendar}
                  title="No sessions conducted on this date"
                  description="Select a different date from the date selector above."
                />
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-line bg-canvas text-xs uppercase text-muted">
                    <tr>
                      <th className="px-4 py-3">Period</th>
                      <th className="px-4 py-3">Subject</th>
                      <th className="px-4 py-3">Section</th>
                      <th className="px-4 py-3">Time</th>
                      <th className="px-4 py-3">Present</th>
                      <th className="px-4 py-3">Absent</th>
                      <th className="px-4 py-3">Total</th>
                      <th className="px-4 py-3">Attendance %</th>
                      <th className="px-4 py-3">Method</th>
                      <th className="px-4 py-3 text-right">Roster</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {dailySessions.map((sess) => (
                      <tr
                        key={sess.sessionId}
                        onClick={() => handleOpenSessionModal(sess.sessionId)}
                        className="cursor-pointer transition-colors hover:bg-canvas/60"
                      >
                        <td className="px-4 py-3 font-mono font-bold text-ink">Period {sess.period}</td>
                        <td className="px-4 py-3">
                          <span className="font-medium text-ink">{sess.subject.name}</span>
                          <span className="text-xs text-muted ml-1.5">({sess.subject.code})</span>
                        </td>
                        <td className="px-4 py-3 font-medium text-ink">{sess.section ? `Section ${sess.section}` : '—'}</td>
                        <td className="px-4 py-3 font-mono text-xs text-muted">
                          {sess.startTime} – {sess.endTime}
                        </td>
                        <td className="px-4 py-3 font-mono text-primary-700">{sess.present}</td>
                        <td className="px-4 py-3 font-mono text-danger">{sess.absent}</td>
                        <td className="px-4 py-3 font-mono">{sess.total}</td>
                        <td className="px-4 py-3 font-mono font-bold text-ink">{sess.percentage}%</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold ${
                              sess.method === 'Face Recognition'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-canvas text-muted border border-line'
                            }`}
                          >
                            {sess.method === 'Face Recognition' ? <ScanFace size={13} /> : null}
                            {sess.method}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="inline-flex items-center text-xs font-semibold text-primary hover:underline">
                            View Students <ChevronRight size={14} />
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Student-Wise Attendance Roster */}
          <div className="card p-5">
            <SectionHeader
              title="Student-wise Attendance Roster"
              subtitle="Full student list with individual attendance percentages · Click row to inspect"
            />
            {studentAttendance.length === 0 ? (
              <EmptyState title="No students match the current filters" />
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-line bg-canvas text-xs uppercase text-muted">
                    <tr>
                      <th className="px-4 py-3">Student Name</th>
                      <th className="px-4 py-3">Register No</th>
                      <th className="px-4 py-3">Department</th>
                      <th className="px-4 py-3">Section</th>
                      <th className="px-4 py-3">Total Classes</th>
                      <th className="px-4 py-3">Present</th>
                      <th className="px-4 py-3">Absent</th>
                      <th className="px-4 py-3">Attendance %</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {studentAttendance.map((st) => (
                      <tr
                        key={st.student._id}
                        onClick={() => handleOpenStudentModal(st.student._id)}
                        className="cursor-pointer transition-colors hover:bg-canvas/60"
                      >
                        <td className="px-4 py-3 font-medium text-ink">{st.student.name}</td>
                        <td className="px-4 py-3 font-mono text-xs text-muted">
                          {st.student.rollNumber || st.student.studentId}
                        </td>
                        <td className="px-4 py-3 text-muted">{normalizeDepartment(st.student.department)}</td>
                        <td className="px-4 py-3 text-muted">Section {st.student.section || 'A'}</td>
                        <td className="px-4 py-3 font-mono">{st.totalClasses}</td>
                        <td className="px-4 py-3 font-mono text-primary-700">{st.present}</td>
                        <td className="px-4 py-3 font-mono text-danger">{st.absent}</td>
                        <td className="px-4 py-3 font-mono font-bold">
                          {st.percentage !== null ? `${st.percentage}%` : 'N/A'}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={st.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Drill-down Modal: Session Details */}
      {sessionModalId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fade-in">
          <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl border border-line bg-surface shadow-2xl">
            <div className="flex items-center justify-between border-b border-line p-4">
              <div>
                <h3 className="font-display text-lg font-bold text-ink">
                  {sessionModalData?.session?.subject?.name || 'Session Attendance'}
                </h3>
                <p className="text-xs text-muted">
                  Period {sessionModalData?.session?.period} · Dept: {normalizeDepartment(sessionModalData?.session?.department)} · Sec {sessionModalData?.session?.section || '—'} ·{' '}
                  {new Date(sessionModalData?.session?.date).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => setSessionModalId(null)}
                className="rounded-md p-1.5 text-muted hover:bg-canvas hover:text-ink"
              >
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto p-4">
              {sessionModalLoading ? (
                <p className="py-8 text-center text-sm text-muted">Loading session roster…</p>
              ) : (
                <>
                  <div className="mb-4 grid grid-cols-4 gap-2 rounded-lg bg-canvas p-3 text-center text-xs">
                    <div>
                      <span className="text-muted">Total</span>
                      <p className="font-mono text-base font-bold text-ink">{sessionModalData?.summary?.total}</p>
                    </div>
                    <div>
                      <span className="text-muted">Present</span>
                      <p className="font-mono text-base font-bold text-primary-700">{sessionModalData?.summary?.present}</p>
                    </div>
                    <div>
                      <span className="text-muted">Absent</span>
                      <p className="font-mono text-base font-bold text-danger">{sessionModalData?.summary?.absent}</p>
                    </div>
                    <div>
                      <span className="text-muted">Percentage</span>
                      <p className="font-mono text-base font-bold text-ink">{sessionModalData?.summary?.percentage}%</p>
                    </div>
                  </div>

                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-line bg-canvas text-xs uppercase text-muted">
                      <tr>
                        <th className="px-3 py-2">Student</th>
                        <th className="px-3 py-2">Roll No</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Method</th>
                        <th className="px-3 py-2">Confidence</th>
                        <th className="px-3 py-2">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {sessionModalData?.students?.map((st) => (
                        <tr key={st._id}>
                          <td className="px-3 py-2 font-medium text-ink">{st.name}</td>
                          <td className="px-3 py-2 font-mono text-xs text-muted">{st.rollNumber}</td>
                          <td className="px-3 py-2">
                            <StatusBadge status={st.status} />
                          </td>
                          <td className="px-3 py-2 text-xs text-muted">{st.method}</td>
                          <td className="px-3 py-2 font-mono text-xs">
                            {st.confidence ? `${st.confidence}%` : '—'}
                          </td>
                          <td className="px-3 py-2 text-xs text-muted truncate max-w-xs">{st.remarks}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>

            <div className="border-t border-line p-3 flex justify-end">
              <button onClick={() => setSessionModalId(null)} className="btn-secondary text-xs">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drill-down Modal: Student Details */}
      {studentModalId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fade-in">
          <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl border border-line bg-surface shadow-2xl">
            <div className="flex items-center justify-between border-b border-line p-4">
              <div>
                <h3 className="font-display text-lg font-bold text-ink">
                  {studentModalData?.student?.name || 'Student Attendance Details'}
                </h3>
                <p className="text-xs text-muted">
                  Roll No: {studentModalData?.student?.rollNumber || studentModalData?.student?.studentId} ·{' '}
                  {normalizeDepartment(studentModalData?.student?.department)} · Section {studentModalData?.student?.section}
                </p>
              </div>
              <button
                onClick={() => setStudentModalId(null)}
                className="rounded-md p-1.5 text-muted hover:bg-canvas hover:text-ink"
              >
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto p-4 space-y-4">
              {studentModalLoading ? (
                <p className="py-8 text-center text-sm text-muted">Loading student attendance details…</p>
              ) : (
                <>
                  {/* Summary Cards */}
                  <div className="grid grid-cols-4 gap-2 rounded-lg bg-canvas p-3 text-center text-xs">
                    <div>
                      <span className="text-muted">Total Classes</span>
                      <p className="font-mono text-base font-bold text-ink">{studentModalData?.summary?.totalClasses}</p>
                    </div>
                    <div>
                      <span className="text-muted">Present</span>
                      <p className="font-mono text-base font-bold text-primary-700">{studentModalData?.summary?.present}</p>
                    </div>
                    <div>
                      <span className="text-muted">Absent</span>
                      <p className="font-mono text-base font-bold text-danger">{studentModalData?.summary?.absent}</p>
                    </div>
                    <div>
                      <span className="text-muted">Attendance Rate</span>
                      <p className="font-mono text-base font-bold text-ink">
                        {studentModalData?.summary?.percentage !== null ? `${studentModalData?.summary?.percentage}%` : 'N/A'}
                      </p>
                    </div>
                  </div>

                  {/* Subject-Wise Breakdown Table */}
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">Subject Breakdown</h4>
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-line bg-canvas text-xs uppercase text-muted">
                        <tr>
                          <th className="px-3 py-2">Subject</th>
                          <th className="px-3 py-2">Total Classes</th>
                          <th className="px-3 py-2">Present</th>
                          <th className="px-3 py-2">Absent</th>
                          <th className="px-3 py-2">Percentage</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {studentModalData?.subjectBreakdown?.map((s) => (
                          <tr key={s.subject._id}>
                            <td className="px-3 py-2 font-medium text-ink">
                              {s.subject.name} <span className="text-xs text-muted">({s.subject.code})</span>
                            </td>
                            <td className="px-3 py-2 font-mono">{s.totalClasses}</td>
                            <td className="px-3 py-2 font-mono text-primary-700">{s.present}</td>
                            <td className="px-3 py-2 font-mono text-danger">{s.absent}</td>
                            <td className="px-3 py-2">
                              <span
                                className={`font-mono font-bold ${
                                  s.percentage === null ? 'text-muted' : s.percentage < 75 ? 'text-danger' : 'text-primary-700'
                                }`}
                              >
                                {s.percentage !== null ? `${s.percentage}%` : 'N/A'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Individual Session History Table */}
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">Attendance History</h4>
                    <div className="max-h-56 overflow-y-auto border border-line rounded-lg">
                      <table className="w-full text-left text-xs">
                        <thead className="sticky top-0 bg-canvas border-b border-line text-muted uppercase">
                          <tr>
                            <th className="px-3 py-2">Date</th>
                            <th className="px-3 py-2">Period</th>
                            <th className="px-3 py-2">Subject</th>
                            <th className="px-3 py-2">Status</th>
                            <th className="px-3 py-2">Method</th>
                            <th className="px-3 py-2">Confidence</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                          {studentModalData?.history?.map((h) => (
                            <tr key={h._id}>
                              <td className="px-3 py-2">{new Date(h.date).toLocaleDateString()}</td>
                              <td className="px-3 py-2 font-mono">Period {h.period}</td>
                              <td className="px-3 py-2 font-medium text-ink">{h.subject?.name}</td>
                              <td className="px-3 py-2">
                                <StatusBadge status={h.status} />
                              </td>
                              <td className="px-3 py-2 text-muted">{h.method}</td>
                              <td className="px-3 py-2 font-mono">{h.confidence ? `${h.confidence}%` : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="border-t border-line p-3 flex justify-end">
              <button onClick={() => setStudentModalId(null)} className="btn-secondary text-xs">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  )
}
