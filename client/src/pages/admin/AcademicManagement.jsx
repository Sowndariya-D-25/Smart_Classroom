import { useEffect, useState } from 'react'
import {
  BookOpen,
  GraduationCap,
  Pencil,
  Power,
  Search,
} from 'lucide-react'
import PageContainer from '../../components/layout/PageContainer'
import AdminPageHeader from '../../components/admin/AdminPageHeader'
import DataTable from '../../components/admin/DataTable'
import Pagination from '../../components/admin/Pagination'
import AdminFormModal from '../../components/admin/AdminFormModal'
import ConfirmDialog from '../../components/admin/ConfirmDialog'
import StatusBadge from '../../components/common/StatusBadge'
import FormField, { inputClass } from '../../components/FormField'
import { useAdminList } from '../../hooks/useAdminList'
import { useToast } from '../../context/ToastContext'
import { coursesApi, subjectsApi } from '../../services/adminService'
import { normalizeDepartment } from '../../utils/department'

const EMPTY_COURSE_FORM = {
  name: '',
  department: '',
  duration: 4,
  description: '',
}

const EMPTY_SUBJECT_FORM = {
  name: '',
  code: '',
  course: '',
  department: '',
  year: 1,
  semester: 1,
  credits: 3,
  description: '',
}

export default function AcademicManagement() {
  const toast = useToast()
  const [activeTab, setActiveTab] = useState('programs') // 'programs' | 'subjects'

  // --- Courses / Academic Programs State ---
  const coursesList = useAdminList(coursesApi.list, {
    initialFilters: { course: '', status: '' },
  })
  const [courseModalOpen, setCourseModalOpen] = useState(false)
  const [editingCourseId, setEditingCourseId] = useState(null)
  const [courseForm, setCourseForm] = useState(EMPTY_COURSE_FORM)
  const [courseFormError, setCourseFormError] = useState(null)
  const [courseSubmitting, setCourseSubmitting] = useState(false)
  const [courseConfirm, setCourseConfirm] = useState(null)
  const [courseConfirmLoading, setCourseConfirmLoading] = useState(false)

  // --- Subjects State ---
  const subjectsList = useAdminList(subjectsApi.list, {
    initialFilters: { course: '', semester: '', year: '', status: '' },
  })
  const [subjectModalOpen, setSubjectModalOpen] = useState(false)
  const [editingSubjectId, setEditingSubjectId] = useState(null)
  const [subjectForm, setSubjectForm] = useState(EMPTY_SUBJECT_FORM)
  const [subjectFormError, setSubjectFormError] = useState(null)
  const [subjectSubmitting, setSubjectSubmitting] = useState(false)
  const [subjectConfirm, setSubjectConfirm] = useState(null)
  const [subjectConfirmLoading, setSubjectConfirmLoading] = useState(false)

  // Active courses for dropdowns
  const [activePrograms, setActivePrograms] = useState([])

  useEffect(() => {
    coursesApi
      .list({ limit: 100 })
      .then((data) => setActivePrograms(data.items || []))
      .catch(() => {})
  }, [coursesList.items])

  // ================= Course Handlers =================
  const openAddCourse = () => {
    setEditingCourseId(null)
    setCourseForm(EMPTY_COURSE_FORM)
    setCourseFormError(null)
    setCourseModalOpen(true)
  }

  const openEditCourse = (c) => {
    setEditingCourseId(c._id)
    setCourseForm({
      name: c.name || '',
      department: c.department || '',
      duration: c.duration ?? 4,
      description: c.description || '',
    })
    setCourseFormError(null)
    setCourseModalOpen(true)
  }

  const handleCourseSubmit = async () => {
    setCourseSubmitting(true)
    setCourseFormError(null)
    try {
      // Generate clean internal code from department or name if creating
      const generatedCode = courseForm.department
        ? courseForm.department.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10).toUpperCase()
        : courseForm.name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10).toUpperCase()

      const payload = {
        name: courseForm.name.trim(),
        code: generatedCode || 'PROG',
        department: courseForm.department.trim(),
        duration: Number(courseForm.duration) || 4,
        description: courseForm.description?.trim() || '',
      }

      if (editingCourseId) {
        await coursesApi.update(editingCourseId, payload)
        toast.success('Academic program updated successfully.')
      } else {
        await coursesApi.create(payload)
        toast.success('Academic program created successfully.')
      }
      setCourseModalOpen(false)
      coursesList.refetch()
    } catch (err) {
      setCourseFormError(err.response?.data?.message || 'Failed to save academic program.')
    } finally {
      setCourseSubmitting(false)
    }
  }

  const handleToggleCourseStatus = async () => {
    if (!courseConfirm) return
    setCourseConfirmLoading(true)
    try {
      await coursesApi.updateStatus(courseConfirm.course._id, courseConfirm.nextActive)
      toast.success(
        `Program ${courseConfirm.nextActive ? 'activated' : 'deactivated'} successfully.`,
      )
      setCourseConfirm(null)
      coursesList.refetch()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to update program status.')
    } finally {
      setCourseConfirmLoading(false)
    }
  }

  // ================= Subject Handlers =================
  const openAddSubject = () => {
    setEditingSubjectId(null)
    setSubjectForm(EMPTY_SUBJECT_FORM)
    setSubjectFormError(null)
    setSubjectModalOpen(true)
  }

  const openEditSubject = (s) => {
    setEditingSubjectId(s._id)
    setSubjectForm({
      name: s.name || '',
      code: s.code || '',
      course: s.course?._id || '',
      department: s.department || s.course?.department || '',
      year: s.semester ? Math.ceil(s.semester / 2) : 1,
      semester: s.semester ?? 1,
      credits: s.credits ?? 3,
      description: s.description || '',
    })
    setSubjectFormError(null)
    setSubjectModalOpen(true)
  }

  const handleSubjectSubmit = async () => {
    setSubjectSubmitting(true)
    setSubjectFormError(null)
    try {
      const selectedProg = activePrograms.find((p) => p._id === subjectForm.course)
      const payload = {
        name: subjectForm.name.trim(),
        code: subjectForm.code.trim().toUpperCase(),
        course: subjectForm.course,
        department: subjectForm.department.trim() || selectedProg?.department || '',
        semester: Number(subjectForm.semester),
        credits: Number(subjectForm.credits) || 3,
        description: subjectForm.description?.trim() || '',
      }

      if (editingSubjectId) {
        await subjectsApi.update(editingSubjectId, payload)
        toast.success('Subject updated successfully.')
      } else {
        await subjectsApi.create(payload)
        toast.success('Subject created successfully.')
      }
      setSubjectModalOpen(false)
      subjectsList.refetch()
    } catch (err) {
      setSubjectFormError(err.response?.data?.message || 'Failed to save subject.')
    } finally {
      setSubjectSubmitting(false)
    }
  }

  const handleToggleSubjectStatus = async () => {
    if (!subjectConfirm) return
    setSubjectConfirmLoading(true)
    try {
      await subjectsApi.updateStatus(subjectConfirm.subject._id, subjectConfirm.nextActive)
      toast.success(
        `Subject ${subjectConfirm.nextActive ? 'activated' : 'deactivated'} successfully.`,
      )
      setSubjectConfirm(null)
      subjectsList.refetch()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to update subject status.')
    } finally {
      setSubjectConfirmLoading(false)
    }
  }

  // ================= Columns =================
  const courseColumns = [
    {
      key: 'name',
      header: 'Academic Program',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900">{row.name}</p>
          {row.description && <p className="text-xs text-slate-500 line-clamp-1">{row.description}</p>}
        </div>
      ),
    },
    { key: 'department', header: 'Department', render: (row) => normalizeDepartment(row.department) },
    {
      key: 'duration',
      header: 'Duration',
      render: (row) => (row.duration ? `${row.duration} Years` : '—'),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.isActive ? 'Active' : 'Inactive'} />,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => openEditCourse(row)}
            aria-label={`Edit ${row.name}`}
            className="rounded-xl p-2 text-muted hover:bg-surface-elevated hover:text-ink transition"
          >
            <Pencil size={15} />
          </button>
          <button
            onClick={() => setCourseConfirm({ course: row, nextActive: !row.isActive })}
            aria-label={`${row.isActive ? 'Deactivate' : 'Activate'} ${row.name}`}
            className="rounded-xl p-2 text-muted hover:bg-surface-elevated hover:text-ink transition"
          >
            <Power size={15} />
          </button>
        </div>
      ),
    },
  ]

  const subjectColumns = [
    { key: 'name', header: 'Subject' },
    { key: 'code', header: 'Subject Code' },
    {
      key: 'program',
      header: 'Academic Program',
      render: (row) => row.course?.name || row.department || '—',
    },
    {
      key: 'year',
      header: 'Year',
      render: (row) => (row.semester ? `Year ${Math.ceil(row.semester / 2)}` : '—'),
    },
    {
      key: 'semester',
      header: 'Semester',
      render: (row) => (row.semester ? `Sem ${row.semester}` : '—'),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.isActive ? 'Active' : 'Inactive'} />,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => openEditSubject(row)}
            aria-label={`Edit ${row.name}`}
            className="rounded-xl p-2 text-muted hover:bg-surface-elevated hover:text-ink transition"
          >
            <Pencil size={15} />
          </button>
          <button
            onClick={() => setSubjectConfirm({ subject: row, nextActive: !row.isActive })}
            aria-label={`${row.isActive ? 'Deactivate' : 'Activate'} ${row.name}`}
            className="rounded-xl p-2 text-muted hover:bg-surface-elevated hover:text-ink transition"
          >
            <Power size={15} />
          </button>
        </div>
      ),
    },
  ]

  return (
    <PageContainer>
      <AdminPageHeader
        title="Academic Management"
        subtitle="Manage academic degree programs and course subjects."
        actionLabel={activeTab === 'programs' ? 'Add Program' : 'Add Subject'}
        onAction={activeTab === 'programs' ? openAddCourse : openAddSubject}
      />

      {/* Tabs */}
      <div className="mb-6 flex">
        <div className="inline-flex items-center gap-1.5 rounded-2xl border border-line bg-[#F0F5F1] p-1.5 shadow-2xs">
          <button
            onClick={() => setActiveTab('programs')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              activeTab === 'programs'
                ? 'bg-ink text-white shadow-sm'
                : 'text-muted hover:text-ink'
            }`}
          >
            <GraduationCap className="h-4 w-4" /> Academic Programs
          </button>
          <button
            onClick={() => setActiveTab('subjects')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              activeTab === 'subjects'
                ? 'bg-ink text-white shadow-sm'
                : 'text-muted hover:text-ink'
            }`}
          >
            <BookOpen className="h-4 w-4" /> Subjects
          </button>
        </div>
      </div>

      {/* Content: Programs Tab */}
      {activeTab === 'programs' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[260px] flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search academic programs…"
                value={coursesList.search}
                onChange={(e) => coursesList.setSearch(e.target.value)}
                className={`${inputClass} pl-9`}
              />
            </div>

            {/* Filter: Academic Program */}
            <select
              value={coursesList.filters.course || ''}
              onChange={(e) => coursesList.updateFilter('course', e.target.value)}
              className="h-10 rounded-xl border border-line bg-surface px-3 text-xs font-semibold text-ink shadow-xs transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">All Programs</option>
              {activePrograms.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <DataTable
            columns={courseColumns}
            data={coursesList.items}
            loading={coursesList.loading}
            emptyMessage="No academic programs found. Create a new program to get started."
          />
          <Pagination
            page={coursesList.pagination.page}
            totalPages={coursesList.pagination.totalPages}
            total={coursesList.pagination.total}
            onPageChange={coursesList.setPage}
          />
        </div>
      )}

      {/* Content: Subjects Tab */}
      {activeTab === 'subjects' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[260px] flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search subjects or subject code…"
                value={subjectsList.search}
                onChange={(e) => subjectsList.setSearch(e.target.value)}
                className={`${inputClass} pl-9`}
              />
            </div>

            {/* Filter: Academic Program */}
            <select
              value={subjectsList.filters.course || ''}
              onChange={(e) => subjectsList.updateFilter('course', e.target.value)}
              className="h-10 rounded-xl border border-line bg-surface px-3 text-xs font-semibold text-ink shadow-xs transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">All Programs</option>
              {activePrograms.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name}
                </option>
              ))}
            </select>

            {/* Filter: Semester */}
            <select
              value={subjectsList.filters.semester || ''}
              onChange={(e) => subjectsList.updateFilter('semester', e.target.value)}
              className="h-10 rounded-xl border border-line bg-surface px-3 text-xs font-semibold text-ink shadow-xs transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">All Semesters</option>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                <option key={s} value={s}>
                  Semester {s}
                </option>
              ))}
            </select>

            {/* Filter: Status */}
            <select
              value={subjectsList.filters.status || ''}
              onChange={(e) => subjectsList.updateFilter('status', e.target.value)}
              className="h-10 rounded-xl border border-line bg-surface px-3 text-xs font-semibold text-ink shadow-xs transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <DataTable
            columns={subjectColumns}
            data={subjectsList.items}
            loading={subjectsList.loading}
            emptyMessage="No subjects found matching the selected filters."
          />
          <Pagination
            page={subjectsList.pagination.page}
            totalPages={subjectsList.pagination.totalPages}
            total={subjectsList.pagination.total}
            onPageChange={subjectsList.setPage}
          />
        </div>
      )}

      {/* Course / Program Modal */}
      <AdminFormModal
        title={editingCourseId ? 'Edit Academic Program' : 'Add Academic Program'}
        open={courseModalOpen}
        onClose={() => setCourseModalOpen(false)}
        onSubmit={handleCourseSubmit}
        submitting={courseSubmitting}
        submitLabel={editingCourseId ? 'Save Changes' : 'Create Program'}
        error={courseFormError}
      >
        <FormField label="Program Name" htmlFor="cp-name">
          <input
            id="cp-name"
            required
            value={courseForm.name}
            onChange={(e) => setCourseForm({ ...courseForm, name: e.target.value })}
            className={inputClass}
            placeholder="e.g. B.E. Computer Science and Engineering"
          />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Department" htmlFor="cp-dept">
            <input
              id="cp-dept"
              required
              value={courseForm.department}
              onChange={(e) => setCourseForm({ ...courseForm, department: e.target.value })}
              className={inputClass}
              placeholder="e.g. Computer Science"
            />
          </FormField>
          <FormField label="Duration (Years)" htmlFor="cp-dur">
            <input
              id="cp-dur"
              type="number"
              min="1"
              max="6"
              required
              value={courseForm.duration}
              onChange={(e) => setCourseForm({ ...courseForm, duration: e.target.value })}
              className={inputClass}
            />
          </FormField>
        </div>
        <FormField label="Description (optional)" htmlFor="cp-desc">
          <textarea
            id="cp-desc"
            rows={2}
            value={courseForm.description}
            onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })}
            className={inputClass}
            placeholder="Program overview and degree information"
          />
        </FormField>
      </AdminFormModal>

      {/* Subject Modal */}
      <AdminFormModal
        title={editingSubjectId ? 'Edit Subject' : 'Add Subject'}
        open={subjectModalOpen}
        onClose={() => setSubjectModalOpen(false)}
        onSubmit={handleSubjectSubmit}
        submitting={subjectSubmitting}
        submitLabel={editingSubjectId ? 'Save Changes' : 'Create Subject'}
        error={subjectFormError}
      >
        <FormField label="Subject Name" htmlFor="sub-name">
          <input
            id="sub-name"
            required
            value={subjectForm.name}
            onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
            className={inputClass}
            placeholder="e.g. Data Structures & Algorithms"
          />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Subject Code" htmlFor="sub-code">
            <input
              id="sub-code"
              required
              value={subjectForm.code}
              onChange={(e) => setSubjectForm({ ...subjectForm, code: e.target.value })}
              className={inputClass}
              placeholder="e.g. CS301"
            />
          </FormField>
          <FormField label="Academic Program" htmlFor="sub-prog">
            <select
              id="sub-prog"
              required
              value={subjectForm.course}
              onChange={(e) => {
                const prog = activePrograms.find((p) => p._id === e.target.value)
                setSubjectForm({
                  ...subjectForm,
                  course: e.target.value,
                  department: prog?.department || subjectForm.department,
                })
              }}
              className={inputClass}
            >
              <option value="">Select Academic Program…</option>
              {activePrograms.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name}
                </option>
              ))}
            </select>
          </FormField>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <FormField label="Year" htmlFor="sub-year">
            <select
              id="sub-year"
              value={subjectForm.year}
              onChange={(e) => setSubjectForm({ ...subjectForm, year: Number(e.target.value) })}
              className={inputClass}
            >
              <option value={1}>Year 1</option>
              <option value={2}>Year 2</option>
              <option value={3}>Year 3</option>
              <option value={4}>Year 4</option>
            </select>
          </FormField>
          <FormField label="Semester" htmlFor="sub-sem">
            <input
              id="sub-sem"
              type="number"
              min="1"
              max="12"
              required
              value={subjectForm.semester}
              onChange={(e) =>
                setSubjectForm({
                  ...subjectForm,
                  semester: Number(e.target.value),
                  year: Math.ceil(Number(e.target.value) / 2),
                })
              }
              className={inputClass}
            />
          </FormField>
          <FormField label="Credits" htmlFor="sub-cred">
            <input
              id="sub-cred"
              type="number"
              min="1"
              max="10"
              required
              value={subjectForm.credits}
              onChange={(e) => setSubjectForm({ ...subjectForm, credits: e.target.value })}
              className={inputClass}
            />
          </FormField>
        </div>
      </AdminFormModal>

      {/* Course Confirm Dialog */}
      <ConfirmDialog
        open={Boolean(courseConfirm)}
        title={`${courseConfirm?.nextActive ? 'Activate' : 'Deactivate'} Program?`}
        description={
          courseConfirm?.nextActive
            ? 'This academic program will be restored to active status.'
            : 'This academic program will be marked inactive.'
        }
        confirmLabel={courseConfirm?.nextActive ? 'Activate' : 'Deactivate'}
        danger={!courseConfirm?.nextActive}
        onConfirm={handleToggleCourseStatus}
        onCancel={() => setCourseConfirm(null)}
        loading={courseConfirmLoading}
      />

      {/* Subject Confirm Dialog */}
      <ConfirmDialog
        open={Boolean(subjectConfirm)}
        title={`${subjectConfirm?.nextActive ? 'Activate' : 'Deactivate'} Subject?`}
        description={
          subjectConfirm?.nextActive
            ? 'This subject will be restored to active status.'
            : 'This subject will be marked inactive.'
        }
        confirmLabel={subjectConfirm?.nextActive ? 'Activate' : 'Deactivate'}
        danger={!subjectConfirm?.nextActive}
        onConfirm={handleToggleSubjectStatus}
        onCancel={() => setSubjectConfirm(null)}
        loading={subjectConfirmLoading}
      />
    </PageContainer>
  )
}
