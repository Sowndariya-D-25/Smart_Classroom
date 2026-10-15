import { useEffect, useState, useMemo } from 'react'
import {
  Download,
  Printer,
  Users,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Calendar,
  Building2,
  BookOpen,
  Eye,
  Filter,
  RotateCcw,
  FileSpreadsheet,
  FileText,
  X,
  UserCheck,
} from 'lucide-react'
import PageContainer from '../../components/layout/PageContainer'
import StatCard from '../../components/common/StatCard'
import EmptyState from '../../components/common/EmptyState'
import { inputClass } from '../../components/FormField'
import { useToast } from '../../context/ToastContext'
import { adminReportsApi } from '../../services/adminService'
import { normalizeDepartment } from '../../utils/department'

export default function AdminReports() {
  const toast = useToast()

  // Filter options loaded from backend
  const [filterOptions, setFilterOptions] = useState({
    subjects: [],
    teachers: [],
    departments: [],
    years: [],
    sections: [],
    students: [],
  })

  // Selected filters
  const [filters, setFilters] = useState({
    department: '',
    year: '',
    section: '',
    subject: '',
    teacher: '',
    student: '',
    startDate: '',
    endDate: '',
    date: '',
  })

  // Report Data
  const [reportData, setReportData] = useState(null)
  const [loading, setLoading] = useState(true)

  // Active Report Tab:
  // 'summary' | 'student' | 'department' | 'subject' | 'teacher' | 'low' | 'daily'
  const [activeTab, setActiveTab] = useState('summary')

  // Interactive Modals
  const [sessionModalId, setSessionModalId] = useState(null)
  const [sessionModalData, setSessionModalData] = useState(null)
  const [sessionModalLoading, setSessionModalLoading] = useState(false)

  const [studentModalId, setStudentModalId] = useState(null)
  const [studentModalData, setStudentModalData] = useState(null)
  const [studentModalLoading, setStudentModalLoading] = useState(false)

  // Fetch filter options on mount
  useEffect(() => {
    adminReportsApi
      .getOptions()
      .then((data) => {
        setFilterOptions({
          subjects: data.subjects || [],
          teachers: data.teachers || [],
          departments: data.departments || [],
          years: data.years || ['1st Year', '2nd Year', '3rd Year', '4th Year'],
          sections: data.sections || ['A', 'B', 'C', 'D'],
          students: data.students || [],
        })
      })
      .catch(() => {})
  }, [])

  // Dependent Options Computations
  const canonicalDepartments = useMemo(() => {
    const raw = filterOptions.departments || []
    return Array.from(new Set(raw.map(normalizeDepartment))).filter(Boolean).sort()
  }, [filterOptions.departments])

  const availableYears = useMemo(() => {
    if (filters.department) {
      const yrs = new Set(
        (filterOptions.students || [])
          .filter((st) => normalizeDepartment(st.department) === normalizeDepartment(filters.department))
          .map((st) => st.year)
          .filter(Boolean),
      )
      if (yrs.size > 0) {
        return Array.from(yrs).sort().map((y) => `${y}${y === 1 ? 'st' : y === 2 ? 'nd' : y === 3 ? 'rd' : 'th'} Year`)
      }
    }
    return filterOptions.years || ['1st Year', '2nd Year', '3rd Year', '4th Year']
  }, [filterOptions.students, filterOptions.years, filters.department])

  const filteredSubjects = useMemo(() => {
    return (filterOptions.subjects || []).filter((s) => {
      if (filters.department && normalizeDepartment(s.department) !== normalizeDepartment(filters.department)) {
        return false
      }
      if (filters.year) {
        const yr = parseInt(filters.year.replace(/\D/g, ''), 10)
        if (!isNaN(yr)) {
          const sem = s.semester
          if (sem && Math.ceil(sem / 2) !== yr) return false
        }
      }
      return true
    })
  }, [filterOptions.subjects, filters.department, filters.year])

  const filteredTeachers = useMemo(() => {
    let list = filterOptions.teachers || []
    if (filters.department) {
      list = list.filter(
        (t) => normalizeDepartment(t.department) === normalizeDepartment(filters.department),
      )
    }
    if (filters.subject) {
      const selectedSub = (filterOptions.subjects || []).find((s) => s._id === filters.subject)
      if (selectedSub?.teachers?.length > 0) {
        const assignedIds = new Set(selectedSub.teachers.map((t) => (t._id || t).toString()))
        list = list.filter((t) => assignedIds.has(t._id.toString()))
      } else {
        list = []
      }
    }
    return list
  }, [filterOptions.teachers, filterOptions.subjects, filters.subject, filters.department])

  const filteredStudents = useMemo(() => {
    return (filterOptions.students || []).filter((st) => {
      if (filters.department && normalizeDepartment(st.department) !== normalizeDepartment(filters.department)) {
        return false
      }
      if (filters.year) {
        const yr = parseInt(filters.year.replace(/\D/g, ''), 10)
        if (!isNaN(yr) && st.year !== yr) return false
      }
      if (filters.section && st.section?.toUpperCase() !== filters.section.toUpperCase()) {
        return false
      }
      return true
    })
  }, [filterOptions.students, filters.department, filters.year, filters.section])

  const availableSections = useMemo(() => {
    if (filters.department || filters.year) {
      const secs = new Set(
        (filterOptions.students || [])
          .filter((st) => {
            if (filters.department && normalizeDepartment(st.department) !== normalizeDepartment(filters.department)) return false
            if (filters.year) {
              const yr = parseInt(filters.year.replace(/\D/g, ''), 10)
              if (!isNaN(yr) && st.year !== yr) return false
            }
            return true
          })
          .map((st) => st.section)
          .filter(Boolean),
      )
      return Array.from(secs).sort()
    }
    return filterOptions.sections || ['A']
  }, [filterOptions.students, filterOptions.sections, filters.department, filters.year])

  const handleFilterChange = (field, val) => {
    const updated = { ...filters, [field]: val }
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
      updated.subject = ''
      updated.teacher = ''
      updated.student = ''
    } else if (field === 'subject') {
      updated.teacher = ''
    }
    setFilters(updated)
  }

  // Fetch report data whenever filters change
  const fetchReports = () => {
    setLoading(true)
    adminReportsApi
      .getReports(filters)
      .then((data) => {
        setReportData(data)
      })
      .catch((err) => {
        toast.error(err.response?.data?.message || 'Failed to load report data')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchReports()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    filters.department,
    filters.year,
    filters.section,
    filters.subject,
    filters.teacher,
    filters.student,
    filters.startDate,
    filters.endDate,
    filters.date,
  ])

  // Reset Filters
  const resetFilters = () => {
    setFilters({
      department: '',
      year: '',
      section: '',
      subject: '',
      teacher: '',
      student: '',
      startDate: '',
      endDate: '',
      date: '',
    })
  }

  // Load Session Modal Detail
  const handleOpenSessionModal = (sessionId) => {
    setSessionModalId(sessionId)
    setSessionModalLoading(true)
    adminReportsApi
      .getSessionDetail(sessionId)
      .then((data) => setSessionModalData(data))
      .catch((err) => {
        toast.error(err.response?.data?.message || 'Failed to load session roster')
        setSessionModalId(null)
      })
      .finally(() => setSessionModalLoading(false))
  }

  // Load Student Modal Detail
  const handleOpenStudentModal = (studentId) => {
    setStudentModalId(studentId)
    setStudentModalLoading(true)
    adminReportsApi
      .getStudentDetail(studentId)
      .then((data) => setStudentModalData(data))
      .catch((err) => {
        toast.error(err.response?.data?.message || 'Failed to load student attendance record')
        setStudentModalId(null)
      })
      .finally(() => setStudentModalLoading(false))
  }

  // Build CSV content according to active report tab
  const generateExportData = () => {
    if (!reportData) return { headers: [], rows: [], filename: 'report.csv' }

    let headers = []
    let rows = []
    const dateStr = new Date().toISOString().split('T')[0]
    let filename = `report_${activeTab}_${dateStr}.csv`

    if (activeTab === 'summary') {
      filename = `attendance_summary_${dateStr}.csv`
      headers = ['Department', 'Students', 'Sessions', 'Present', 'Absent', 'Late', 'Attendance %']
      rows = (reportData.departmentAttendance || []).map((d) => [
        d.department,
        d.students,
        d.sessions,
        d.present,
        d.absent,
        d.late,
        d.percentage !== null ? `${d.percentage}%` : 'N/A',
      ])
    } else if (activeTab === 'student') {
      filename = `student_attendance_${dateStr}.csv`
      headers = ['Student Name', 'Register No.', 'Department', 'Year', 'Section', 'Present', 'Late', 'Absent', 'Total', 'Attendance %', 'Status']
      rows = (reportData.studentAttendance || []).map((st) => [
        st.student.name,
        st.student.rollNumber || st.student.studentId,
        st.department,
        st.year,
        st.section,
        st.present,
        st.late,
        st.absent,
        st.total,
        st.percentage !== null ? `${st.percentage}%` : 'N/A',
        st.status,
      ])
    } else if (activeTab === 'department') {
      filename = `department_attendance_${dateStr}.csv`
      headers = ['Department', 'Students', 'Sessions', 'Present', 'Absent', 'Late', 'Attendance %']
      rows = (reportData.departmentAttendance || []).map((d) => [
        d.department,
        d.students,
        d.sessions,
        d.present,
        d.absent,
        d.late,
        d.percentage !== null ? `${d.percentage}%` : 'N/A',
      ])
    } else if (activeTab === 'subject') {
      filename = `subject_attendance_${dateStr}.csv`
      headers = ['Subject Name', 'Subject Code', 'Department', 'Year', 'Sessions', 'Present', 'Absent', 'Late', 'Attendance %']
      rows = (reportData.subjectWise || []).map((s) => [
        s.name,
        s.code,
        s.department,
        s.year,
        s.sessions,
        s.present,
        s.absent,
        s.late,
        s.percentage !== null ? `${s.percentage}%` : 'N/A',
      ])
    } else if (activeTab === 'teacher') {
      filename = `teacher_sessions_${dateStr}.csv`
      headers = ['Teacher Name', 'Employee ID', 'Department', 'Sessions Conducted', 'Present Marks', 'Late Marks', 'Absent Marks', 'Total Marks', 'Attendance %']
      rows = (reportData.teacherSessions || []).map((t) => [
        t.teacher,
        t.employeeId,
        t.department,
        t.sessionsConducted,
        t.present,
        t.late,
        t.absent,
        t.totalMarks,
        t.percentage !== null ? `${t.percentage}%` : 'N/A',
      ])
    } else if (activeTab === 'low') {
      filename = `low_attendance_${dateStr}.csv`
      headers = ['Student Name', 'Register No.', 'Department', 'Year', 'Section', 'Attendance %', 'Status']
      rows = (reportData.lowAttendance || []).map((st) => [
        st.student.name,
        st.student.rollNumber || st.student.studentId,
        st.department,
        st.year,
        st.section,
        st.percentage !== null ? `${st.percentage}%` : 'N/A',
        st.status,
      ])
    } else if (activeTab === 'daily') {
      filename = `daily_attendance_${dateStr}.csv`
      headers = ['Date', 'Period', 'Department', 'Year', 'Section', 'Subject', 'Teacher', 'Present', 'Absent', 'Late', 'Attendance %']
      rows = (reportData.dailyAttendance || []).map((d) => [
        d.date,
        d.period,
        d.department,
        d.year,
        d.section,
        `${d.subject.name} (${d.subject.code})`,
        d.teacher,
        d.present,
        d.absent,
        d.late,
        d.percentage !== null ? `${d.percentage}%` : 'N/A',
      ])
    }

    return { headers, rows, filename }
  }

  // Export CSV
  const handleExportCSV = () => {
    const { headers, rows, filename } = generateExportData()
    if (!headers.length) return

    let csvContent = 'data:text/csv;charset=utf-8,\uFEFF'
    csvContent += headers.map((h) => `"${h}"`).join(',') + '\n'
    rows.forEach((r) => {
      csvContent += r.map((c) => `"${c ?? ''}"`).join(',') + '\n'
    })

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', filename)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('Report exported to CSV')
  }

  // Export Excel
  const handleExportExcel = () => {
    const { headers, rows, filename } = generateExportData()
    if (!headers.length) return

    let csvContent = '\uFEFF' + headers.map((h) => `"${h}"`).join('\t') + '\n'
    rows.forEach((r) => {
      csvContent += r.map((c) => `"${c ?? ''}"`).join('\t') + '\n'
    })

    const blob = new Blob([csvContent], { type: 'application/vnd.ms-excel;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', filename.replace('.csv', '.xls'))
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast.success('Report exported to Excel (.xls)')
  }

  // Export PDF / Print
  const handleExportPDF = () => {
    window.print()
  }

  const {
    overall = {},
    studentAttendance = [],
    departmentAttendance = [],
    subjectWise = [],
    teacherSessions = [],
    dailyAttendance = [],
    lowAttendance = [],
  } = reportData || {}

  // Determine which filters are relevant to current tab
  const showDateFilter = ['summary', 'student', 'department', 'subject', 'teacher', 'low', 'daily'].includes(activeTab)
  const showDeptFilter = ['summary', 'student', 'department', 'subject', 'teacher', 'low', 'daily'].includes(activeTab)
  const showYearFilter = ['summary', 'student', 'department', 'subject', 'teacher', 'low', 'daily'].includes(activeTab)
  const showSectionFilter = ['summary', 'student', 'department', 'subject', 'teacher', 'low', 'daily'].includes(activeTab)
  const showSubjectFilter = ['summary', 'student', 'department', 'subject', 'teacher', 'low', 'daily'].includes(activeTab)
  const showTeacherFilter = ['summary', 'student', 'department', 'subject', 'teacher', 'daily'].includes(activeTab)
  const showStudentFilter = ['student', 'low'].includes(activeTab)
  const showSingleDateFilter = false

  return (
    <PageContainer>
      {/* Top Header & Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">
            Reports & Analytics Export
          </h1>
          <p className="mt-1 text-sm text-muted">
            Generate and export academic, attendance, and administrative reports across all departments.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3.5 py-2 text-xs font-semibold text-ink shadow-sm transition hover:bg-surface-subtle"
          >
            <Printer className="h-3.5 w-3.5 text-primary" />
            Export PDF
          </button>
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-3.5 py-2 text-xs font-semibold text-primary shadow-sm transition hover:bg-primary/20"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-primary" />
            Export Excel
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3.5 py-2 text-xs font-semibold text-ink shadow-sm transition hover:bg-surface-subtle"
          >
            <Download className="h-3.5 w-3.5 text-muted" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Segmented Pill Tabs Navigation */}
      <div className="flex items-center gap-1.5 overflow-x-auto rounded-[20px] border border-line bg-surface p-1.5 shadow-sm scrollbar-none">
        <button
          onClick={() => setActiveTab('summary')}
          className={`flex whitespace-nowrap items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition ${
            activeTab === 'summary'
              ? 'bg-ink text-white shadow-sm'
              : 'text-muted hover:bg-surface-subtle hover:text-ink'
          }`}
        >
          <TrendingUp className="h-4 w-4" />
          Attendance Summary
        </button>

        <button
          onClick={() => setActiveTab('student')}
          className={`flex whitespace-nowrap items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition ${
            activeTab === 'student'
              ? 'bg-ink text-white shadow-sm'
              : 'text-muted hover:bg-surface-subtle hover:text-ink'
          }`}
        >
          <Users className="h-4 w-4" />
          Student Attendance
        </button>

        <button
          onClick={() => setActiveTab('department')}
          className={`flex whitespace-nowrap items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition ${
            activeTab === 'department'
              ? 'bg-ink text-white shadow-sm'
              : 'text-muted hover:bg-surface-subtle hover:text-ink'
          }`}
        >
          <Building2 className="h-4 w-4" />
          Department Breakdown
        </button>

        <button
          onClick={() => setActiveTab('subject')}
          className={`flex whitespace-nowrap items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition ${
            activeTab === 'subject'
              ? 'bg-ink text-white shadow-sm'
              : 'text-muted hover:bg-surface-subtle hover:text-ink'
          }`}
        >
          <BookOpen className="h-4 w-4" />
          Subject Wise
        </button>

        <button
          onClick={() => setActiveTab('teacher')}
          className={`flex whitespace-nowrap items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition ${
            activeTab === 'teacher'
              ? 'bg-ink text-white shadow-sm'
              : 'text-muted hover:bg-surface-subtle hover:text-ink'
          }`}
        >
          <UserCheck className="h-4 w-4" />
          Faculty Sessions
        </button>

        <button
          onClick={() => setActiveTab('low')}
          className={`flex whitespace-nowrap items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition ${
            activeTab === 'low'
              ? 'bg-rose-600 text-white shadow-sm'
              : 'text-muted hover:bg-surface-subtle hover:text-rose-600'
          }`}
        >
          <AlertTriangle className="h-4 w-4" />
          Low Attendance Alert
        </button>

        <button
          onClick={() => setActiveTab('daily')}
          className={`flex whitespace-nowrap items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition ${
            activeTab === 'daily'
              ? 'bg-ink text-white shadow-sm'
              : 'text-muted hover:bg-surface-subtle hover:text-ink'
          }`}
        >
          <Calendar className="h-4 w-4" />
          Daily Register
        </button>
      </div>

      {/* Dynamic Filter Bar */}
      <div className="rounded-[22px] border border-line bg-surface p-5 shadow-card">
        <div className="mb-4 flex items-center justify-between border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-primary" />
            <span className="text-xs font-bold uppercase tracking-wider text-muted">
              Report Filters
            </span>
          </div>
          <button
            onClick={resetFilters}
            className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-medium text-muted transition hover:bg-surface-subtle hover:text-ink"
          >
            <RotateCcw className="h-3 w-3" />
            Reset Filters
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {/* Department */}
          {showDeptFilter && (
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-muted">Department</label>
              <select
                value={filters.department}
                onChange={(e) => handleFilterChange('department', e.target.value)}
                className={`${inputClass} text-xs rounded-xl border-line bg-background text-ink`}
              >
                <option value="">All Departments</option>
                {canonicalDepartments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Year */}
          {showYearFilter && (
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-muted">Academic Year</label>
              <select
                value={filters.year}
                onChange={(e) => handleFilterChange('year', e.target.value)}
                className={`${inputClass} text-xs rounded-xl border-line bg-background text-ink`}
              >
                <option value="">All Years</option>
                {availableYears.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Section */}
          {showSectionFilter && (
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-muted">Section</label>
              <select
                value={filters.section}
                onChange={(e) => handleFilterChange('section', e.target.value)}
                className={`${inputClass} text-xs rounded-xl border-line bg-background text-ink`}
              >
                <option value="">All Sections</option>
                {availableSections.map((sec) => (
                  <option key={sec} value={sec}>
                    Section {sec}
                  </option>
                ))}
                {(filters.department || filters.year) && availableSections.length === 0 && (
                  <option value="" disabled>
                    No sections available
                  </option>
                )}
              </select>
            </div>
          )}

          {/* Subject */}
          {showSubjectFilter && (
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-muted">Subject</label>
              <select
                value={filters.subject}
                onChange={(e) => handleFilterChange('subject', e.target.value)}
                className={`${inputClass} text-xs rounded-xl border-line bg-background text-ink`}
              >
                <option value="">All Subjects</option>
                {filteredSubjects.map((sub) => (
                  <option key={sub._id} value={sub._id}>
                    {sub.name} ({sub.code})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Teacher */}
          {showTeacherFilter && (
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-muted">Teacher</label>
              <select
                value={filters.teacher}
                onChange={(e) => handleFilterChange('teacher', e.target.value)}
                className={`${inputClass} text-xs rounded-xl border-line bg-background text-ink`}
              >
                <option value="">All Teachers</option>
                {filteredTeachers.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Student */}
          {showStudentFilter && (
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-muted">Student</label>
              <select
                value={filters.student}
                onChange={(e) => handleFilterChange('student', e.target.value)}
                className={`${inputClass} text-xs rounded-xl border-line bg-background text-ink`}
              >
                <option value="">All Students</option>
                {filteredStudents.map((st) => (
                  <option key={st._id} value={st._id}>
                    {st.name} ({st.rollNumber || st.studentId})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Date range filters */}
          {showDateFilter && (
            <>
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-muted">Date From</label>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => handleFilterChange('startDate', e.target.value)}
                  className={`${inputClass} text-xs rounded-xl border-line bg-background text-ink`}
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-semibold text-muted">Date To</label>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => handleFilterChange('endDate', e.target.value)}
                  className={`${inputClass} text-xs rounded-xl border-line bg-background text-ink`}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Main Tab Content */}
      {loading ? (
        <div className="flex h-72 items-center justify-center">
          <div className="flex items-center gap-3 text-slate-500">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="text-sm">Generating report from MongoDB…</span>
          </div>
        </div>
      ) : (
        <div className="mt-2 space-y-6">
          {/* TAB 1: ATTENDANCE SUMMARY REPORT */}
          {activeTab === 'summary' && (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  icon={CheckCircle}
                  label="Overall Attendance"
                  value={overall.overallPercentage !== null && overall.overallPercentage !== undefined ? `${overall.overallPercentage}%` : 'N/A'}
                  subtext={`Reporting Period: ${overall.reportingPeriod || 'All Time'}`}
                  colorScheme="emerald"
                />
                <StatCard
                  icon={Users}
                  label="Total Students"
                  value={overall.totalStudents ?? 0}
                  subtext={`${overall.totalSessions ?? 0} Total Sessions`}
                  colorScheme="blue"
                />
                <StatCard
                  icon={AlertTriangle}
                  label="Below 75% Threshold"
                  value={overall.lowAttendanceCount ?? 0}
                  subtext={`${overall.below60Count ?? 0} Critical (<60%)`}
                  colorScheme="rose"
                />
                <StatCard
                  icon={Calendar}
                  label="Attendance Marks"
                  value={overall.totalRecords ?? 0}
                  subtext={`Present: ${overall.presentRecords ?? 0} • Late: ${overall.lateRecords ?? 0} • Absent: ${overall.absentRecords ?? 0}`}
                  colorScheme="purple"
                />
              </div>

              {/* Department Table */}
              <div className="overflow-hidden rounded-[22px] border border-line bg-surface shadow-card">
                <div className="border-b border-line bg-surface-subtle px-6 py-3.5">
                  <h3 className="text-sm font-bold text-ink">
                    Department Attendance Breakdown
                  </h3>
                </div>

                {departmentAttendance.length === 0 ? (
                  <div className="p-8">
                    <EmptyState
                      icon={Building2}
                      title="No records found for the selected filters."
                      description="Try adjusting your department or date range filters."
                    />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="border-b border-line bg-surface-subtle font-semibold text-muted">
                          <th className="px-6 py-3.5">Department</th>
                          <th className="px-6 py-3.5 text-center">Students</th>
                          <th className="px-6 py-3.5 text-center">Sessions</th>
                          <th className="px-6 py-3.5 text-center">Present</th>
                          <th className="px-6 py-3.5 text-center">Absent</th>
                          <th className="px-6 py-3.5 text-center">Late</th>
                          <th className="px-6 py-3.5 text-center">Attendance %</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {departmentAttendance.map((d) => (
                          <tr key={d.department} className="transition hover:bg-primary/[0.02]">
                            <td className="whitespace-nowrap px-6 py-3.5 font-bold text-ink">
                              {d.department}
                            </td>
                            <td className="whitespace-nowrap px-6 py-3.5 text-center text-muted">
                              {d.students}
                            </td>
                            <td className="whitespace-nowrap px-6 py-3.5 text-center text-muted">
                              {d.sessions}
                            </td>
                            <td className="whitespace-nowrap px-6 py-3.5 text-center font-semibold text-primary">
                              {d.present}
                            </td>
                            <td className="whitespace-nowrap px-6 py-3.5 text-center font-semibold text-rose-600">
                              {d.absent}
                            </td>
                            <td className="whitespace-nowrap px-6 py-3.5 text-center font-semibold text-amber-600">
                              {d.late}
                            </td>
                            <td className="whitespace-nowrap px-6 py-3.5 text-center font-bold">
                              {d.percentage !== null ? (
                                <span
                                  className={`rounded-lg px-2.5 py-1 ${
                                    d.percentage < 75
                                      ? 'bg-rose-50 text-rose-700'
                                      : 'bg-primary/10 text-primary'
                                  }`}
                                >
                                  {d.percentage}%
                                </span>
                              ) : (
                                <span className="text-muted">N/A</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: STUDENT ATTENDANCE REPORT */}
          {activeTab === 'student' && (
            <div className="overflow-hidden rounded-[22px] border border-line bg-surface shadow-card">
              {studentAttendance.length === 0 ? (
                <div className="p-8">
                  <EmptyState
                    icon={Users}
                    title="No records found for the selected filters."
                    description="No student attendance records match the chosen criteria."
                  />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-line bg-surface-subtle font-semibold text-muted">
                        <th className="px-6 py-3.5">Student</th>
                        <th className="px-6 py-3.5">Register No.</th>
                        <th className="px-6 py-3.5">Department</th>
                        <th className="px-6 py-3.5">Year</th>
                        <th className="px-6 py-3.5">Section</th>
                        <th className="px-6 py-3.5 text-center">Attended</th>
                        <th className="px-6 py-3.5 text-center">Absent</th>
                        <th className="px-6 py-3.5 text-center">Total</th>
                        <th className="px-6 py-3.5 text-center">Attendance %</th>
                        <th className="px-6 py-3.5 text-center">Status</th>
                        <th className="px-6 py-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {studentAttendance.map((st) => (
                        <tr key={st.student._id} className="transition hover:bg-primary/[0.02]">
                          <td className="whitespace-nowrap px-6 py-3.5 font-bold text-ink">
                            {st.student.name}
                          </td>
                          <td className="whitespace-nowrap px-6 py-3.5 text-muted">
                            {st.student.rollNumber || st.student.studentId}
                          </td>
                          <td className="whitespace-nowrap px-6 py-3.5 text-muted">
                            {st.department}
                          </td>
                          <td className="whitespace-nowrap px-6 py-3.5 text-muted">
                            {st.year}
                          </td>
                          <td className="whitespace-nowrap px-6 py-3.5 text-muted">
                            {st.section}
                          </td>
                          <td className="whitespace-nowrap px-6 py-3.5 text-center font-semibold text-primary">
                            {st.attended}
                          </td>
                          <td className="whitespace-nowrap px-6 py-3.5 text-center font-semibold text-rose-600">
                            {st.absent}
                          </td>
                          <td className="whitespace-nowrap px-6 py-3.5 text-center text-ink">
                            {st.total}
                          </td>
                          <td className="whitespace-nowrap px-6 py-3.5 text-center">
                            {st.percentage !== null ? (
                              <span
                                className={`rounded-lg px-2.5 py-1 font-bold ${
                                  st.isLow
                                    ? 'bg-rose-50 text-rose-700'
                                    : 'bg-primary/10 text-primary'
                                }`}
                              >
                                {st.percentage}%
                              </span>
                            ) : (
                              <span className="text-muted">N/A</span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-6 py-3.5 text-center">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-semibold ${
                                st.isCritical
                                  ? 'bg-rose-100 text-rose-800'
                                  : st.isLow
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-primary/15 text-primary'
                              }`}
                            >
                              {st.status}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-6 py-3.5 text-right">
                            <button
                              onClick={() => handleOpenStudentModal(st.student._id)}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink shadow-sm transition hover:bg-surface-subtle"
                            >
                              <Eye className="h-3 w-3 text-muted" />
                              View
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: DEPARTMENT ATTENDANCE REPORT */}
          {activeTab === 'department' && (
            <div className="overflow-hidden rounded-[22px] border border-line bg-surface shadow-card">
              {departmentAttendance.length === 0 ? (
                <div className="p-8">
                  <EmptyState
                    icon={Building2}
                    title="No records found for the selected filters."
                    description="No department attendance data is currently available."
                  />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-line bg-surface-subtle font-semibold text-muted">
                        <th className="px-6 py-3.5">Department</th>
                        <th className="px-6 py-3.5 text-center">Students</th>
                        <th className="px-6 py-3.5 text-center">Sessions</th>
                        <th className="px-6 py-3.5 text-center">Present</th>
                        <th className="px-6 py-3.5 text-center">Absent</th>
                        <th className="px-6 py-3.5 text-center">Late</th>
                        <th className="px-6 py-3.5 text-center">Attendance %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {departmentAttendance.map((d) => (
                        <tr key={d.department} className="transition hover:bg-primary/[0.02]">
                          <td className="whitespace-nowrap px-6 py-3.5 font-bold text-ink">
                            {d.department}
                          </td>
                          <td className="whitespace-nowrap px-6 py-3.5 text-center text-muted">
                            {d.students}
                          </td>
                          <td className="whitespace-nowrap px-6 py-3.5 text-center text-muted">
                            {d.sessions}
                          </td>
                          <td className="whitespace-nowrap px-6 py-3.5 text-center font-semibold text-primary">
                            {d.present}
                          </td>
                          <td className="whitespace-nowrap px-6 py-3.5 text-center font-semibold text-rose-600">
                            {d.absent}
                          </td>
                          <td className="whitespace-nowrap px-6 py-3.5 text-center font-semibold text-amber-600">
                            {d.late}
                          </td>
                          <td className="whitespace-nowrap px-6 py-3.5 text-center font-bold">
                            {d.percentage !== null ? (
                              <span
                                className={`rounded-lg px-2.5 py-1 ${
                                  d.percentage < 75
                                    ? 'bg-rose-50 text-rose-700'
                                    : 'bg-primary/10 text-primary'
                                }`}
                              >
                                {d.percentage}%
                              </span>
                            ) : (
                              <span className="text-muted">N/A</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: SUBJECT ATTENDANCE REPORT */}
          {activeTab === 'subject' && (
            <div className="overflow-hidden rounded-[22px] border border-line bg-surface shadow-card">
              {subjectWise.length === 0 ? (
                <div className="p-8">
                  <EmptyState
                    icon={BookOpen}
                    title="No records found for the selected filters."
                    description="No subject attendance records match the chosen filters."
                  />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-line bg-surface-subtle font-semibold text-muted">
                        <th className="px-6 py-3.5">Subject</th>
                        <th className="px-6 py-3.5">Subject Code</th>
                        <th className="px-6 py-3.5">Department</th>
                        <th className="px-6 py-3.5">Year</th>
                        <th className="px-6 py-3.5 text-center">Sessions</th>
                        <th className="px-6 py-3.5 text-center">Present</th>
                        <th className="px-6 py-3.5 text-center">Absent</th>
                        <th className="px-6 py-3.5 text-center">Late</th>
                        <th className="px-6 py-3.5 text-center">Attendance %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {subjectWise.map((s) => (
                        <tr key={s.subject._id} className="transition hover:bg-primary/[0.02]">
                          <td className="whitespace-nowrap px-6 py-3.5 font-bold text-ink">
                            {s.name}
                          </td>
                          <td className="whitespace-nowrap px-6 py-3.5 font-medium text-muted">
                            {s.code}
                          </td>
                          <td className="whitespace-nowrap px-6 py-3.5 text-muted">
                            {s.department}
                          </td>
                          <td className="whitespace-nowrap px-6 py-3.5 text-muted">
                            {s.year}
                          </td>
                          <td className="whitespace-nowrap px-6 py-3.5 text-center font-semibold text-ink">
                            {s.sessions}
                          </td>
                          <td className="whitespace-nowrap px-6 py-3.5 text-center text-primary font-semibold">
                            {s.present}
                          </td>
                          <td className="whitespace-nowrap px-6 py-3.5 text-center text-rose-600 font-semibold">
                            {s.absent}
                          </td>
                          <td className="whitespace-nowrap px-6 py-3.5 text-center text-amber-600 font-semibold">
                            {s.late}
                          </td>
                          <td className="whitespace-nowrap px-6 py-3.5 text-center font-bold">
                            {s.percentage !== null ? (
                              <span
                                className={`rounded-lg px-2.5 py-1 ${
                                  s.percentage < 75
                                    ? 'bg-rose-50 text-rose-700'
                                    : 'bg-primary/10 text-primary'
                                }`}
                              >
                                {s.percentage}%
                              </span>
                            ) : (
                              <span className="text-muted">N/A</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: TEACHER SESSION REPORT (Descriptive only) */}
          {activeTab === 'teacher' && (
            <div className="overflow-hidden rounded-[22px] border border-line bg-surface shadow-card">
              {teacherSessions.length === 0 ? (
                <div className="p-8">
                  <EmptyState
                    icon={UserCheck}
                    title="No records found for the selected filters."
                    description="No teacher session records match the chosen criteria."
                  />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-line bg-surface-subtle font-semibold text-muted">
                        <th className="px-6 py-3.5">Teacher</th>
                        <th className="px-6 py-3.5">Employee ID</th>
                        <th className="px-6 py-3.5">Department</th>
                        <th className="px-6 py-3.5 text-center">Sessions Conducted</th>
                        <th className="px-6 py-3.5 text-center">Total Marks</th>
                        <th className="px-6 py-3.5 text-center">Present</th>
                        <th className="px-6 py-3.5 text-center">Late</th>
                        <th className="px-6 py-3.5 text-center">Absent</th>
                        <th className="px-6 py-3.5 text-center">Attendance %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {teacherSessions.map((t) => (
                        <tr key={t.employeeId || t.teacher} className="transition hover:bg-primary/[0.02]">
                          <td className="whitespace-nowrap px-6 py-3.5 font-bold text-ink">
                            {t.teacher}
                          </td>
                          <td className="whitespace-nowrap px-6 py-3.5 text-muted">
                            {t.employeeId}
                          </td>
                          <td className="whitespace-nowrap px-6 py-3.5 text-muted">
                            {t.department}
                          </td>
                          <td className="whitespace-nowrap px-6 py-3.5 text-center font-bold text-primary">
                            {t.sessionsConducted}
                          </td>
                          <td className="whitespace-nowrap px-6 py-3.5 text-center text-ink">
                            {t.totalMarks}
                          </td>
                          <td className="whitespace-nowrap px-6 py-3.5 text-center text-primary font-semibold">
                            {t.present}
                          </td>
                          <td className="whitespace-nowrap px-6 py-3.5 text-center text-amber-600 font-semibold">
                            {t.late}
                          </td>
                          <td className="whitespace-nowrap px-6 py-3.5 text-center text-rose-600 font-semibold">
                            {t.absent}
                          </td>
                          <td className="whitespace-nowrap px-6 py-3.5 text-center font-bold">
                            {t.percentage !== null ? `${t.percentage}%` : 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 6: LOW ATTENDANCE REPORT */}
          {activeTab === 'low' && (
            <div className="overflow-hidden rounded-[22px] border border-rose-200 bg-surface shadow-card">
              <div className="border-b border-rose-200 bg-rose-50/60 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-rose-600" />
                    <div>
                      <h3 className="text-base font-bold text-rose-950">
                        Low Attendance Student List (&lt;75%)
                      </h3>
                      <p className="text-xs text-rose-700/80">
                        Students below the 75% institutional attendance policy threshold.
                      </p>
                    </div>
                  </div>
                  <span className="rounded-full bg-rose-200/80 px-3 py-1 text-xs font-bold text-rose-900">
                    {lowAttendance.length} Flagged
                  </span>
                </div>
              </div>

              {lowAttendance.length === 0 ? (
                <div className="p-8">
                  <EmptyState
                    icon={CheckCircle}
                    title="No records found for the selected filters."
                    description="No students currently fall below the 75% attendance policy threshold."
                  />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-rose-100 bg-rose-50/30 font-semibold text-rose-900">
                        <th className="px-6 py-3.5">Student</th>
                        <th className="px-6 py-3.5">Register No.</th>
                        <th className="px-6 py-3.5">Department</th>
                        <th className="px-6 py-3.5">Year</th>
                        <th className="px-6 py-3.5">Section</th>
                        <th className="px-6 py-3.5 text-center">Attendance %</th>
                        <th className="px-6 py-3.5 text-center">Status</th>
                        <th className="px-6 py-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-rose-100">
                      {lowAttendance.map((st) => (
                        <tr key={st.student._id} className="transition hover:bg-rose-50/50">
                          <td className="whitespace-nowrap px-6 py-3.5 font-bold text-ink">
                            {st.student.name}
                          </td>
                          <td className="whitespace-nowrap px-6 py-3.5 text-muted">
                            {st.student.rollNumber || st.student.studentId}
                          </td>
                          <td className="whitespace-nowrap px-6 py-3.5 text-muted">
                            {st.department}
                          </td>
                          <td className="whitespace-nowrap px-6 py-3.5 text-muted">
                            {st.year}
                          </td>
                          <td className="whitespace-nowrap px-6 py-3.5 text-muted">
                            {st.section}
                          </td>
                          <td className="whitespace-nowrap px-6 py-3.5 text-center">
                            <span className="rounded-lg bg-rose-100 px-2.5 py-1 font-bold text-rose-700">
                              {st.percentage !== null ? `${st.percentage}%` : 'N/A'}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-6 py-3.5 text-center">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-semibold ${
                                st.isCritical
                                  ? 'bg-rose-200 text-rose-900'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {st.status}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-6 py-3.5 text-right">
                            <button
                              onClick={() => handleOpenStudentModal(st.student._id)}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-surface px-3 py-1.5 text-xs font-semibold text-rose-700 shadow-sm transition hover:bg-rose-50"
                            >
                              <Eye className="h-3 w-3" />
                              View
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 7: DAILY ATTENDANCE REPORT */}
          {activeTab === 'daily' && (
            <div className="overflow-hidden rounded-[22px] border border-line bg-surface shadow-card">
              {dailyAttendance.length === 0 ? (
                <div className="p-8">
                  <EmptyState
                    icon={Calendar}
                    title="No records found for the selected filters."
                    description="No attendance sessions were recorded for this filter criteria."
                  />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-line bg-surface-subtle font-semibold text-muted">
                        <th className="px-6 py-3.5">Date</th>
                        <th className="px-6 py-3.5">Period</th>
                        <th className="px-6 py-3.5">Department</th>
                        <th className="px-6 py-3.5">Year</th>
                        <th className="px-6 py-3.5">Section</th>
                        <th className="px-6 py-3.5">Subject</th>
                        <th className="px-6 py-3.5">Teacher</th>
                        <th className="px-6 py-3.5 text-center">Present</th>
                        <th className="px-6 py-3.5 text-center">Absent</th>
                        <th className="px-6 py-3.5 text-center">Late</th>
                        <th className="px-6 py-3.5 text-center">Attendance %</th>
                        <th className="px-6 py-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {dailyAttendance.map((d) => (
                        <tr key={d.sessionId} className="transition hover:bg-primary/[0.02]">
                          <td className="whitespace-nowrap px-6 py-3.5 font-bold text-ink">
                            {d.date}
                          </td>
                          <td className="whitespace-nowrap px-6 py-3.5 font-medium text-muted">
                            Period {d.period}
                          </td>
                          <td className="whitespace-nowrap px-6 py-3.5 text-muted">
                            {d.department}
                          </td>
                          <td className="whitespace-nowrap px-6 py-3.5 text-muted">
                            {d.year}
                          </td>
                          <td className="whitespace-nowrap px-6 py-3.5 text-muted">
                            Sec {d.section}
                          </td>
                          <td className="whitespace-nowrap px-6 py-3.5">
                            <div className="font-semibold text-ink">
                              {d.subject.name}
                            </div>
                            <div className="text-muted text-[11px]">{d.subject.code}</div>
                          </td>
                          <td className="whitespace-nowrap px-6 py-3.5 text-muted">
                            {d.teacher}
                          </td>
                          <td className="whitespace-nowrap px-6 py-3.5 text-center font-semibold text-primary">
                            {d.present}
                          </td>
                          <td className="whitespace-nowrap px-6 py-3.5 text-center font-semibold text-rose-600">
                            {d.absent}
                          </td>
                          <td className="whitespace-nowrap px-6 py-3.5 text-center font-semibold text-amber-600">
                            {d.late}
                          </td>
                          <td className="whitespace-nowrap px-6 py-3.5 text-center font-bold">
                            {d.percentage !== null ? (
                              <span
                                className={`rounded-lg px-2.5 py-1 ${
                                  d.percentage < 75
                                    ? 'bg-rose-50 text-rose-700'
                                    : 'bg-primary/10 text-primary'
                                }`}
                              >
                                {d.percentage}%
                              </span>
                            ) : (
                              <span className="text-muted">N/A</span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-6 py-3.5 text-right">
                            <button
                              onClick={() => handleOpenSessionModal(d.sessionId)}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink shadow-sm transition hover:bg-surface-subtle"
                            >
                              <Eye className="h-3 w-3 text-muted" />
                              View Details
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* SESSION DRILL-DOWN MODAL */}
      {sessionModalId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4 backdrop-blur-sm">
          <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col rounded-[24px] border border-line bg-surface shadow-2xl">
            <div className="flex items-center justify-between border-b border-line px-6 py-4">
              <div>
                <h3 className="text-lg font-bold text-ink">
                  Session Attendance Detail
                </h3>
                <p className="text-xs text-muted">
                  {sessionModalData?.session?.subject?.name} ({sessionModalData?.session?.subject?.code}) • Period {sessionModalData?.session?.period} • {sessionModalData?.session?.department} • Sec {sessionModalData?.session?.section}
                </p>
              </div>
              <button
                onClick={() => setSessionModalId(null)}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-muted transition hover:bg-surface-subtle hover:text-ink"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {sessionModalLoading ? (
              <div className="flex h-64 items-center justify-center">
                <div className="flex items-center gap-3 text-muted">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  <span>Loading session record…</span>
                </div>
              </div>
            ) : sessionModalData ? (
              <div className="flex flex-1 flex-col overflow-hidden">
                <div className="grid grid-cols-2 gap-4 border-b border-line bg-surface-subtle p-4 sm:grid-cols-4">
                  <div>
                    <div className="text-xs text-muted">Teacher</div>
                    <div className="font-semibold text-ink">
                      {sessionModalData.session.teacher || '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted">Department / Section</div>
                    <div className="font-semibold text-ink">
                      {sessionModalData.session.department} • Sec {sessionModalData.session.section}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted">Attendance %</div>
                    <div className="font-semibold text-primary">
                      {sessionModalData.summary.percentage !== null ? `${sessionModalData.summary.percentage}%` : 'N/A'} ({sessionModalData.summary.present + sessionModalData.summary.late}/{sessionModalData.summary.total})
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted">Status</div>
                    <div className="font-semibold text-ink">
                      {sessionModalData.session.status}
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-line bg-surface-subtle text-muted">
                        <th className="px-4 py-2.5">Student</th>
                        <th className="px-4 py-2.5">Register No.</th>
                        <th className="px-4 py-2.5">Status</th>
                        <th className="px-4 py-2.5">Marked At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {sessionModalData.students?.map((st) => (
                        <tr key={st._id}>
                          <td className="px-4 py-2.5 font-medium text-ink">
                            {st.name}
                          </td>
                          <td className="px-4 py-2.5 font-bold text-ink">
                            {st.rollNumber || st.studentId}
                          </td>
                          <td className="px-4 py-2.5">
                            <span
                              className={`rounded-full px-2 py-0.5 font-semibold ${
                                st.status === 'Present' || st.status === 'Late'
                                  ? 'bg-primary/10 text-primary'
                                  : 'bg-rose-50 text-rose-700'
                              }`}
                            >
                              {st.status}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-muted">
                            {st.markedAt ? new Date(st.markedAt).toLocaleTimeString() : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            <div className="flex justify-end border-t border-line px-6 py-3">
              <button
                onClick={() => setSessionModalId(null)}
                className="btn-secondary text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STUDENT DRILL-DOWN MODAL */}
      {studentModalId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4 backdrop-blur-sm">
          <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col rounded-[24px] border border-line bg-surface shadow-2xl">
            <div className="flex items-center justify-between border-b border-line px-6 py-4">
              <div>
                <h3 className="text-lg font-bold text-ink">
                  Student Attendance History
                </h3>
                <p className="text-xs text-muted">
                  {studentModalData?.student?.name} • Register No: {studentModalData?.student?.rollNumber || studentModalData?.student?.studentId}
                </p>
              </div>
              <button
                onClick={() => setStudentModalId(null)}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-muted transition hover:bg-surface-subtle hover:text-ink"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {studentModalLoading ? (
              <div className="flex h-64 items-center justify-center">
                <div className="flex items-center gap-3 text-muted">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  <span>Loading student history…</span>
                </div>
              </div>
            ) : studentModalData ? (
              <div className="flex flex-1 flex-col overflow-hidden">
                {/* Student summary banner */}
                <div className="grid grid-cols-2 gap-4 border-b border-line bg-surface-subtle p-4 sm:grid-cols-4">
                  <div>
                    <div className="text-xs text-muted">Department / Sec</div>
                    <div className="font-semibold text-ink">
                      {studentModalData.student.department} • Sec {studentModalData.student.section}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted">Overall Attendance</div>
                    <div
                      className={`font-bold ${
                        (studentModalData.summary.percentage ?? 0) < 75
                          ? 'text-rose-600'
                          : 'text-primary'
                      }`}
                    >
                      {studentModalData.summary.percentage !== null ? `${studentModalData.summary.percentage}%` : 'N/A'} ({studentModalData.summary.present + studentModalData.summary.late}/{studentModalData.summary.totalClasses})
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted">Email</div>
                    <div className="font-medium text-ink">
                      {studentModalData.student.email}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted">Status</div>
                    <div className="font-bold text-ink">
                      {studentModalData.summary.status}
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {/* Subject Breakdown Cards */}
                  <div>
                    <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">
                      Subject Breakdown
                    </h4>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {studentModalData.subjectBreakdown?.map((sb) => (
                        <div
                          key={sb.subject._id}
                          className="rounded-2xl border border-line bg-surface p-4 shadow-sm"
                        >
                          <div className="font-semibold text-ink">
                            {sb.subject.name}
                          </div>
                          <div className="text-xs text-muted">{sb.subject.code}</div>
                          <div className="mt-2.5 flex items-center justify-between text-xs">
                            <span className="text-muted">
                              {sb.present + sb.late}/{sb.total} sessions
                            </span>
                            <span
                              className={`rounded-lg px-2 py-0.5 font-bold ${
                                sb.percentage === null
                                  ? 'bg-surface-subtle text-muted'
                                  : sb.isLow
                                  ? 'bg-rose-50 text-rose-700'
                                  : 'bg-primary/10 text-primary'
                              }`}
                            >
                              {sb.percentage !== null ? `${sb.percentage}%` : 'N/A'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Class-by-Class History Log */}
                  <div className="overflow-hidden rounded-2xl border border-line">
                    <div className="border-b border-line bg-surface-subtle px-4 py-2.5">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted">
                        Class Records
                      </h4>
                    </div>
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="border-b border-line bg-surface-subtle text-muted">
                          <th className="px-4 py-2.5">Date</th>
                          <th className="px-4 py-2.5">Period</th>
                          <th className="px-4 py-2.5">Subject</th>
                          <th className="px-4 py-2.5">Subject Code</th>
                          <th className="px-4 py-2.5">Teacher</th>
                          <th className="px-4 py-2.5">Status</th>
                          <th className="px-4 py-2.5">Marked At</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {studentModalData.history?.map((h) => (
                          <tr key={h._id} className="transition hover:bg-primary/[0.02]">
                            <td className="px-4 py-2.5 text-ink">
                              {h.date ? new Date(h.date).toLocaleDateString() : '—'}
                            </td>
                            <td className="px-4 py-2.5 text-muted">
                              Period {h.period}
                            </td>
                            <td className="px-4 py-2.5 font-medium text-ink">
                              {h.subject?.name || '—'}
                            </td>
                            <td className="px-4 py-2.5 text-muted">
                              {h.subject?.code || '—'}
                            </td>
                            <td className="px-4 py-2.5 text-muted">
                              {h.teacher}
                            </td>
                            <td className="px-4 py-2.5">
                              <span
                                className={`rounded-lg px-2 py-0.5 font-semibold ${
                                  h.status === 'Present' || h.status === 'Late'
                                    ? 'bg-primary/10 text-primary'
                                    : 'bg-rose-50 text-rose-700'
                                }`}
                              >
                                {h.status}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-muted">
                              {h.markedAt ? new Date(h.markedAt).toLocaleTimeString() : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="flex justify-end border-t border-line px-6 py-3">
              <button
                onClick={() => setStudentModalId(null)}
                className="btn-secondary text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  )
}
