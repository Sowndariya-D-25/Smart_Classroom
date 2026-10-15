import { useEffect, useState, useMemo } from 'react'
import { FiX } from 'react-icons/fi'
import {
  CalendarDays,
  Plus,
  RotateCcw,
  LayoutGrid,
  List,
  Edit2,
  Trash2,
  Clock,
  User,
  BookOpen,
  Building2,
  X,
  AlertTriangle,
} from 'lucide-react'
import PageContainer from '../../components/layout/PageContainer'
import AdminPageHeader from '../../components/admin/AdminPageHeader'
import ConfirmDialog from '../../components/admin/ConfirmDialog'
import StatCard from '../../components/common/StatCard'
import EmptyState from '../../components/common/EmptyState'
import { inputClass } from '../../components/FormField'
import { useToast } from '../../context/ToastContext'
import { timetableApi, departmentsApi } from '../../services/adminService'
import { normalizeDepartment } from '../../utils/department'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8]

const INITIAL_FORM = {
  department: '',
  year: 1,
  semester: 1,
  section: 'A',
  subject: '',
  teacher: '',
  dayOfWeek: 'Monday',
  period: 1,
  startTime: '09:00',
  endTime: '10:00',
  academicYear: '2026-2027',
}

export default function AdminTimetable() {
  const toast = useToast()

  const [viewMode, setViewMode] = useState('grid') // 'grid' | 'list'
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState({
    totalEntries: 0,
    today: 0,
    departments: 0,
    activeSubjects: 0,
  })

  // Options for dropdowns
  const [options, setOptions] = useState({
    subjects: [],
    teachers: [],
    courses: [],
    departments: [],
    sections: [],
  })

  // Filters
  const [filters, setFilters] = useState({
    academicYear: '2026-2027',
    department: '',
    year: '',
    section: '',
    semester: '',
    subject: '',
    teacher: '',
  })

  // Modal states
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(INITIAL_FORM)
  const [formError, setFormError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  // Delete confirm modal
  const [deleteTarget, setDeleteTarget] = useState(null)

  const loadOptions = async () => {
    try {
      const data = await timetableApi.getOptions()
      setOptions(data)
    } catch {
      toast.error('Could not load timetable options.')
    }
  }

  const loadTimetable = async (activeFilters = filters) => {
    try {
      setLoading(true)
      const data = await timetableApi.list(activeFilters)
      setEntries(data.items || [])
      if (data.summary) {
        setSummary(data.summary)
      } else {
        const todayDayName = DAYS[new Date().getDay() - 1] || 'Monday'
        const todayCount = (data.items || []).filter((e) => e.dayOfWeek === todayDayName).length
        const uniqueDepts = new Set((data.items || []).map((e) => e.subject?.department).filter(Boolean))
        const uniqueSubs = new Set((data.items || []).map((e) => e.subject?._id).filter(Boolean))
        setSummary({
          totalEntries: (data.items || []).length,
          today: todayCount,
          departments: uniqueDepts.size,
          activeSubjects: uniqueSubs.size,
        })
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not load timetable.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadOptions()
    loadTimetable(filters)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleFilterChange = (field, val) => {
    const updated = { ...filters, [field]: val }
    if (field === 'department') {
      updated.year = ''
      updated.section = ''
      updated.semester = ''
      updated.subject = ''
      updated.teacher = ''
    } else if (field === 'year') {
      updated.section = ''
      updated.semester = ''
      updated.subject = ''
      updated.teacher = ''
    } else if (field === 'section') {
      updated.semester = ''
      updated.subject = ''
      updated.teacher = ''
    } else if (field === 'semester') {
      updated.subject = ''
      updated.teacher = ''
    } else if (field === 'subject') {
      updated.teacher = ''
    }
    setFilters(updated)
    loadTimetable(updated)
  }

  const handleResetFilters = () => {
    const reset = {
      academicYear: '2026-2027',
      department: '',
      year: '',
      section: '',
      semester: '',
      subject: '',
      teacher: '',
    }
    setFilters(reset)
    loadTimetable(reset)
  }

  const canonicalDepartments = useMemo(() => {
    const raw = options.departments || []
    const normalized = raw.map(normalizeDepartment)
    return Array.from(new Set(normalized)).filter(Boolean).sort()
  }, [options.departments])

  // Filter toolbar dependent options
  const filterSemesters = useMemo(() => {
    if (!filters.year) return [1, 2, 3, 4, 5, 6, 7, 8]
    const yr = Number(filters.year)
    return [(yr - 1) * 2 + 1, yr * 2]
  }, [filters.year])

  const filterSubjects = useMemo(() => {
    return (options.subjects || []).filter((s) => {
      if (filters.department && normalizeDepartment(s.department) !== normalizeDepartment(filters.department)) {
        return false
      }
      if (filters.semester) {
        if (s.semester !== Number(filters.semester)) return false
      } else if (filters.year) {
        const yr = Number(filters.year)
        const allowed = [(yr - 1) * 2 + 1, yr * 2]
        if (!allowed.includes(s.semester)) return false
      }
      return true
    })
  }, [options.subjects, filters.department, filters.year, filters.semester])

  const filterTeachers = useMemo(() => {
    let list = options.teachers || []
    if (filters.department) {
      list = list.filter(
        (t) => normalizeDepartment(t.department) === normalizeDepartment(filters.department),
      )
    }
    if (filters.subject) {
      const selectedSub = (options.subjects || []).find((s) => s._id === filters.subject)
      if (selectedSub?.teachers?.length > 0) {
        const assignedIds = new Set(selectedSub.teachers.map((t) => (t._id || t).toString()))
        list = list.filter((t) => assignedIds.has(t._id.toString()))
      } else {
        list = []
      }
    }
    return list
  }, [options.teachers, options.subjects, filters.subject, filters.department])

  // Available Semesters for selected Year
  const availableSemesters = useMemo(() => {
    const yr = Number(form.year) || 1
    return [(yr - 1) * 2 + 1, (yr - 1) * 2 + 2]
  }, [form.year])

  // Open Add Modal
  const openAddModal = () => {
    setEditingId(null)
    const dept = filters.department || canonicalDepartments[0] || 'CSE'
    const yr = filters.year ? Number(filters.year) : 1
    const sem = filters.semester ? Number(filters.semester) : (yr - 1) * 2 + 1
    const sec = filters.section || 'A'
    const matchingSubjects = (options.subjects || []).filter(
      (s) => normalizeDepartment(s.department) === normalizeDepartment(dept) && s.semester === sem,
    )
    const firstSub = matchingSubjects[0]?._id || ''
    let firstTeacher = ''
    if (matchingSubjects[0]?.teachers?.length > 0) {
      const assignedId = (matchingSubjects[0].teachers[0]._id || matchingSubjects[0].teachers[0]).toString()
      firstTeacher = (options.teachers || []).find((t) => t._id.toString() === assignedId)?._id || ''
    }
    setForm({
      ...INITIAL_FORM,
      department: dept,
      year: yr,
      section: sec,
      semester: sem,
      subject: firstSub,
      teacher: firstTeacher,
    })
    setFormError(null)
    setModalOpen(true)
  }

  // Open Edit Modal
  const openEditModal = (entry) => {
    setEditingId(entry._id)
    const sem = entry.semester || 1
    const yr = Math.ceil(sem / 2)
    const dept = normalizeDepartment(entry.subject?.department || 'CSE')
    setForm({
      department: dept,
      year: yr,
      semester: sem,
      section: entry.section || 'A',
      subject: entry.subject?._id || entry.subject || '',
      teacher: entry.teacher?._id || entry.teacher || '',
      dayOfWeek: entry.dayOfWeek || 'Monday',
      period: entry.period || 1,
      startTime: entry.startTime || '09:00',
      endTime: entry.endTime || '10:00',
      academicYear: entry.academicYear || '2026-2027',
    })
    setFormError(null)
    setModalOpen(true)
  }

  // Dependent dropdown: Subjects matching selected department and semester
  const filteredModalSubjects = useMemo(() => {
    if (!form.department) return []
    const normDept = normalizeDepartment(form.department)
    return (options.subjects || []).filter((s) => {
      const sDept = normalizeDepartment(s.department)
      const matchesDept = sDept === normDept
      const matchesSem = s.semester === Number(form.semester)
      return matchesDept && matchesSem
    })
  }, [form.department, form.semester, options.subjects])

  // Dependent dropdown: Faculty/Teachers assigned to selected subject
  const filteredModalTeachers = useMemo(() => {
    if (!form.subject) return []
    const subjectDoc = (options.subjects || []).find((s) => s._id === form.subject)
    if (!subjectDoc || !subjectDoc.teachers || subjectDoc.teachers.length === 0) {
      return []
    }
    const assignedIds = new Set(subjectDoc.teachers.map((t) => (t._id ? t._id.toString() : t.toString())))
    return (options.teachers || []).filter((t) => assignedIds.has(t._id.toString()))
  }, [form.subject, options.teachers, options.subjects])

  // Handlers for dependent changes
  const handleFormDepartmentChange = (dept) => {
    const yr = 1
    const sem = 1
    const matchingSubjects = (options.subjects || []).filter(
      (s) => normalizeDepartment(s.department) === normalizeDepartment(dept) && s.semester === sem,
    )
    const firstSub = matchingSubjects[0]?._id || ''
    let firstTeacher = ''
    if (matchingSubjects[0]?.teachers?.length > 0) {
      const assignedId = (matchingSubjects[0].teachers[0]._id || matchingSubjects[0].teachers[0]).toString()
      firstTeacher = (options.teachers || []).find((t) => t._id.toString() === assignedId)?._id || ''
    }
    setForm((prev) => ({
      ...prev,
      department: dept,
      year: yr,
      semester: sem,
      subject: firstSub,
      teacher: firstTeacher,
    }))
  }

  const handleFormYearChange = (yrNum) => {
    const yr = Number(yrNum)
    const sem = (yr - 1) * 2 + 1
    const matchingSubjects = (options.subjects || []).filter(
      (s) => normalizeDepartment(s.department) === normalizeDepartment(form.department) && s.semester === sem,
    )
    const firstSub = matchingSubjects[0]?._id || ''
    let firstTeacher = ''
    if (matchingSubjects[0]?.teachers?.length > 0) {
      const assignedId = (matchingSubjects[0].teachers[0]._id || matchingSubjects[0].teachers[0]).toString()
      firstTeacher = (options.teachers || []).find((t) => t._id.toString() === assignedId)?._id || ''
    }
    setForm((prev) => ({
      ...prev,
      year: yr,
      semester: sem,
      subject: firstSub,
      teacher: firstTeacher,
    }))
  }

  const handleFormSemesterChange = (semNum) => {
    const sem = Number(semNum)
    const matchingSubjects = (options.subjects || []).filter(
      (s) => normalizeDepartment(s.department) === normalizeDepartment(form.department) && s.semester === sem,
    )
    const firstSub = matchingSubjects[0]?._id || ''
    let firstTeacher = ''
    if (matchingSubjects[0]?.teachers?.length > 0) {
      const assignedId = (matchingSubjects[0].teachers[0]._id || matchingSubjects[0].teachers[0]).toString()
      firstTeacher = (options.teachers || []).find((t) => t._id.toString() === assignedId)?._id || ''
    }
    setForm((prev) => ({
      ...prev,
      semester: sem,
      subject: firstSub,
      teacher: firstTeacher,
    }))
  }

  const handleFormSubjectChange = (subId) => {
    const subjectDoc = (options.subjects || []).find((s) => s._id === subId)
    let firstTeacher = ''
    if (subjectDoc?.teachers?.length > 0) {
      const assignedId = (subjectDoc.teachers[0]._id || subjectDoc.teachers[0]).toString()
      firstTeacher = (options.teachers || []).find((t) => t._id.toString() === assignedId)?._id || ''
    }
    setForm((prev) => ({
      ...prev,
      subject: subId,
      teacher: firstTeacher,
    }))
  }

  // Submit Add / Edit
  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setFormError(null)

    if (!form.subject) {
      setFormError('Please select a subject matching the selected Department and Semester.')
      setSubmitting(false)
      return
    }

    if (!form.teacher) {
      setFormError('No faculty assigned to this subject. Please assign faculty to this subject under Academic Management.')
      setSubmitting(false)
      return
    }

    try {
      const payload = {
        subject: form.subject,
        teacher: form.teacher,
        dayOfWeek: form.dayOfWeek,
        period: Number(form.period),
        startTime: form.startTime,
        endTime: form.endTime,
        semester: Number(form.semester),
        academicYear: form.academicYear,
        section: form.section.trim().toUpperCase(),
      }

      if (editingId) {
        await timetableApi.update(editingId, payload)
        toast.success('Timetable entry updated successfully.')
      } else {
        await timetableApi.create(payload)
        toast.success('Timetable entry created successfully.')
      }

      setModalOpen(false)
      loadTimetable(filters)
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to save timetable slot.')
    } finally {
      setSubmitting(false)
    }
  }

  // Delete Timetable Entry
  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await timetableApi.remove(deleteTarget._id)
      toast.success('Timetable entry removed.')
      setDeleteTarget(null)
      loadTimetable(filters)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not delete entry.')
    }
  }

  // Grid / Weekly Schedule matrix
  // Matrix: period x day
  const gridMatrix = useMemo(() => {
    const matrix = {}
    PERIODS.forEach((p) => {
      matrix[p] = {}
      DAYS.forEach((d) => {
        matrix[p][d] = []
      })
    })

    entries.forEach((e) => {
      const p = e.period || 1
      const d = e.dayOfWeek
      if (matrix[p] && matrix[p][d]) {
        matrix[p][d].push(e)
      }
    })

    return matrix
  }, [entries])

  return (
    <PageContainer>
      <AdminPageHeader
        title="Timetable"
        subtitle="Create and manage the academic timetable for all departments, years, sections, and subjects."
        actionLabel="Add Timetable"
        onAction={openAddModal}
      />

      {/* Exactly 4 Summary Cards (No Classroom) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={CalendarDays}
          label="Total Entries"
          value={loading ? '…' : summary.totalEntries}
          subtext="Scheduled class slots"
          colorScheme="emerald"
        />
        <StatCard
          icon={Clock}
          label="Today"
          value={loading ? '…' : summary.today}
          subtext="Sessions scheduled today"
          colorScheme="blue"
        />
        <StatCard
          icon={Building2}
          label="Departments"
          value={loading ? '…' : summary.departments}
          subtext="Departments scheduled"
          colorScheme="purple"
        />
        <StatCard
          icon={BookOpen}
          label="Active Subjects"
          value={loading ? '…' : summary.activeSubjects}
          subtext="Subjects in active rotation"
          colorScheme="amber"
        />
      </div>

      {/* Filter Toolbar */}
      {/* Filter Toolbar */}
      <div className="mt-6 card rounded-[22px] border border-line bg-surface p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-muted font-display">
            Schedule Filters
          </span>
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-1 rounded-2xl border border-line bg-[#F0F5F1] p-1 shadow-2xs">
              <button
                onClick={() => setViewMode('grid')}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                  viewMode === 'grid'
                    ? 'bg-ink text-white shadow-xs'
                    : 'text-muted hover:text-ink'
                }`}
              >
                <LayoutGrid size={14} /> Weekly View
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                  viewMode === 'list'
                    ? 'bg-ink text-white shadow-xs'
                    : 'text-muted hover:text-ink'
                }`}
              >
                <List size={14} /> List View
              </button>
            </div>
            <button
              onClick={handleResetFilters}
              title="Reset Filters"
              className="rounded-xl border border-line bg-surface p-2 text-muted hover:text-ink transition shadow-xs"
            >
              <RotateCcw size={15} />
            </button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {/* Academic Year */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted">Academic Year</label>
            <select
              value={filters.academicYear}
              onChange={(e) => handleFilterChange('academicYear', e.target.value)}
              className="mt-1 h-10 w-full rounded-xl border border-line bg-surface px-3 text-xs font-semibold text-ink shadow-xs transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              {(options.academicYears?.length ? options.academicYears : ['2026-2027']).map((ay) => (
                <option key={ay} value={ay}>
                  {ay}
                </option>
              ))}
            </select>
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
              {(options.sections || ['A', 'B']).map((s) => (
                <option key={s} value={s}>
                  Section {s}
                </option>
              ))}
            </select>
          </div>

          {/* Semester */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted">Semester</label>
            <select
              value={filters.semester}
              onChange={(e) => handleFilterChange('semester', e.target.value)}
              className="mt-1 h-10 w-full rounded-xl border border-line bg-surface px-3 text-xs font-semibold text-ink shadow-xs transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">All Semesters</option>
              {filterSemesters.map((s) => (
                <option key={s} value={s}>
                  Semester {s}
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
              className="mt-1 h-10 w-full rounded-xl border border-line bg-surface px-3 text-xs font-semibold text-ink shadow-xs transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">All Teachers</option>
              {filterTeachers.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.name || t.employeeId}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* View Mode: Grid (Weekly View) */}
      {viewMode === 'grid' && (
        <div className="mt-6 card rounded-[22px] border border-line bg-surface shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-line bg-[#F8FAF7]/90 text-muted">
                  <th className="w-24 p-3.5 font-bold uppercase tracking-wider text-[11px] text-center border-r border-line">
                    Period
                  </th>
                  {DAYS.map((day) => (
                    <th key={day} className="min-w-[160px] p-3.5 font-bold uppercase tracking-wider text-[11px]">
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {PERIODS.map((period) => (
                  <tr key={period} className="hover:bg-sage-50/20">
                    <td className="p-3.5 font-bold text-center border-r border-line text-ink bg-[#F8FAF7]/60">
                      Period {period}
                    </td>
                    {DAYS.map((day) => {
                      const cellEntries = gridMatrix[period]?.[day] || []
                      return (
                        <td key={day} className="p-2.5 align-top">
                          {cellEntries.length > 0 ? (
                            <div className="space-y-2">
                              {cellEntries.map((e) => (
                                <div
                                  key={e._id}
                                  className="group relative rounded-xl border border-line bg-[#F8FAF7] p-2.5 text-ink transition-all hover:border-primary/50 hover:bg-white hover:shadow-sm"
                                >
                                  <div className="flex items-start justify-between gap-1">
                                    <p className="font-bold text-ink line-clamp-1">
                                      {e.subject?.name || 'Subject'}
                                    </p>
                                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition">
                                      <button
                                        onClick={() => openEditModal(e)}
                                        className="rounded-lg p-1 text-muted hover:bg-slate-200/60 hover:text-ink transition"
                                        title="Edit"
                                      >
                                        <Edit2 size={12} />
                                      </button>
                                      <button
                                        onClick={() => setDeleteTarget(e)}
                                        className="rounded-lg p-1 text-rose-400 hover:bg-rose-50 hover:text-rose-600 transition"
                                        title="Delete"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    </div>
                                  </div>
                                  <p className="mt-0.5 font-mono text-[11px] font-bold text-primary">
                                    {e.subject?.code}
                                  </p>
                                  <p className="mt-1 flex items-center gap-1 text-[11px] text-muted line-clamp-1 font-medium">
                                    <User size={11} /> {e.teacher?.user?.name || e.teacher?.employeeId}
                                  </p>
                                  <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted font-semibold">
                                    <span>
                                      {e.startTime} - {e.endTime}
                                    </span>
                                    <span className="rounded-md bg-sage-50 px-1.5 py-0.5 text-emerald-800 border border-line/60">Sec {e.section}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="h-16 rounded-xl border border-dashed border-line/60" />
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* View Mode: List View */}
      {viewMode === 'list' && (
        <div className="mt-6 card rounded-[22px] border border-line bg-surface shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-line bg-[#F8FAF7]/90 text-[11px] font-bold uppercase tracking-wider text-muted">
                <tr>
                  <th className="p-3.5">Day</th>
                  <th className="p-3.5">Period</th>
                  <th className="p-3.5">Time</th>
                  <th className="p-3.5">Year</th>
                  <th className="p-3.5">Dept</th>
                  <th className="p-3.5">Section</th>
                  <th className="p-3.5">Subject</th>
                  <th className="p-3.5">Teacher</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {entries.length > 0 ? (
                  entries.map((row) => (
                    <tr key={row._id} className="transition-colors hover:bg-sage-50/40">
                      <td className="p-3.5 font-bold text-ink">
                        {row.dayOfWeek}
                      </td>
                      <td className="p-3.5 font-medium text-ink">Period {row.period || 1}</td>
                      <td className="p-3.5 font-mono text-muted">
                        {row.startTime} – {row.endTime}
                      </td>
                      <td className="p-3.5 font-medium text-muted">Year {row.semester ? Math.ceil(row.semester / 2) : 1}</td>
                      <td className="p-3.5 font-medium text-ink">{normalizeDepartment(row.subject?.department)}</td>
                      <td className="p-3.5 font-bold text-ink">
                        {row.section || 'A'}
                      </td>
                      <td className="p-3.5">
                        <span className="font-semibold text-ink">
                          {row.subject?.name}
                        </span>{' '}
                        <span className="text-muted text-[11px]">({row.subject?.code})</span>
                      </td>
                      <td className="p-3.5 font-medium text-ink">
                        {row.teacher?.user?.name || row.teacher?.employeeId || '—'}
                      </td>
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditModal(row)}
                            className="rounded-xl p-2 text-muted hover:bg-surface-elevated hover:text-ink transition"
                            title="Edit"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(row)}
                            className="rounded-xl p-2 text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition"
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
                    <td colSpan={9} className="p-12 text-center text-xs font-semibold text-muted">
                      No timetable entries found matching your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Timetable Modal (NO Classroom) */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 p-5">
              <h2 className="text-base font-semibold text-slate-900">
                {editingId ? 'Edit Timetable Entry' : 'Add Timetable Entry'}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                aria-label="Close modal"
              >
                <FiX size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 p-5 text-sm">
              {formError && (
                <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Dependent dropdown flow: Department -> Year -> Section -> Semester -> Subject -> Faculty */}
              <div className="grid grid-cols-2 gap-3">
                {/* 1. Department */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    Department
                  </label>
                  <select
                    value={form.department}
                    onChange={(e) => handleFormDepartmentChange(e.target.value)}
                    required
                    className={inputClass}
                  >
                    <option value="">Select Department…</option>
                    {canonicalDepartments.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Year */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    Year
                  </label>
                  <select
                    value={form.year}
                    onChange={(e) => handleFormYearChange(e.target.value)}
                    className={inputClass}
                  >
                    <option value={1}>1st Year</option>
                    <option value={2}>2nd Year</option>
                    <option value={3}>3rd Year</option>
                    <option value={4}>4th Year</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* 3. Section */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    Section
                  </label>
                  <select
                    value={form.section}
                    onChange={(e) => setForm({ ...form, section: e.target.value })}
                    className={inputClass}
                  >
                    {['A', 'B', 'C', 'D'].map((s) => (
                      <option key={s} value={s}>
                        Section {s}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 4. Semester */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    Semester
                  </label>
                  <select
                    value={form.semester}
                    onChange={(e) => handleFormSemesterChange(e.target.value)}
                    className={inputClass}
                    required
                  >
                    {availableSemesters.map((s) => (
                      <option key={s} value={s}>
                        Semester {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 5. Subject */}
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Subject (matching {form.department || 'Dept'}, Sem {form.semester})
                </label>
                <select
                  value={form.subject}
                  onChange={(e) => handleFormSubjectChange(e.target.value)}
                  required
                  className={inputClass}
                >
                  <option value="">Select Subject…</option>
                  {filteredModalSubjects.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
                {filteredModalSubjects.length === 0 && (
                  <p className="mt-1 text-xs text-amber-600">
                    No subjects found for Semester {form.semester} in {form.department || 'CSE'}.
                  </p>
                )}
              </div>

              {/* 6. Assigned Faculty / Teacher */}
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Faculty / Teacher
                </label>
                <select
                  value={form.teacher}
                  onChange={(e) => setForm({ ...form, teacher: e.target.value })}
                  required
                  disabled={filteredModalTeachers.length === 0}
                  className={inputClass}
                >
                  {filteredModalTeachers.length === 0 ? (
                    <option value="">No faculty assigned to this subject</option>
                  ) : (
                    <>
                      <option value="">Select Faculty…</option>
                      {filteredModalTeachers.map((t) => (
                        <option key={t._id} value={t._id}>
                          {t.name} ({t.employeeId || 'Faculty'})
                        </option>
                      ))}
                    </>
                  )}
                </select>
                {form.subject && filteredModalTeachers.length === 0 && (
                  <p className="mt-1 text-xs text-amber-600 font-medium">
                    No faculty assigned to this subject. Please assign faculty to this subject under Academic Management before scheduling.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    Day of Week
                  </label>
                  <select
                    value={form.dayOfWeek}
                    onChange={(e) => setForm({ ...form, dayOfWeek: e.target.value })}
                    className={inputClass}
                  >
                    {DAYS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    Period
                  </label>
                  <select
                    value={form.period}
                    onChange={(e) => setForm({ ...form, period: Number(e.target.value) })}
                    className={inputClass}
                  >
                    {PERIODS.map((p) => (
                      <option key={p} value={p}>
                        Period {p}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    Start Time
                  </label>
                  <input
                    type="time"
                    required
                    value={form.startTime}
                    onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    End Time
                  </label>
                  <input
                    type="time"
                    required
                    value={form.endTime}
                    onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary text-xs"
                >
                  {submitting ? 'Saving Slot…' : editingId ? 'Save Changes' : 'Create Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Remove Timetable Slot?"
        description={`Are you sure you want to remove ${deleteTarget?.subject?.name || 'this class'} on ${deleteTarget?.dayOfWeek} (Period ${deleteTarget?.period})?`}
        confirmLabel="Remove Entry"
        danger={true}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </PageContainer>
  )
}
