import { useEffect, useState } from 'react'
import PageContainer from '../../components/layout/PageContainer'
import AdminPageHeader from '../../components/admin/AdminPageHeader'
import SearchInput from '../../components/admin/SearchInput'
import DataTable from '../../components/admin/DataTable'
import Pagination from '../../components/admin/Pagination'
import AdminFormModal from '../../components/admin/AdminFormModal'
import ConfirmDialog from '../../components/admin/ConfirmDialog'
import StatusBadge from '../../components/common/StatusBadge'
import FormField, { inputClass } from '../../components/FormField'
import { useAdminList } from '../../hooks/useAdminList'
import { useToast } from '../../context/ToastContext'
import { subjectsApi, coursesApi, teachersApi } from '../../services/adminService'
import { Pencil, Power } from 'lucide-react'

const EMPTY_FORM = { name: '', code: '', credits: '', semester: '', department: '', course: '', description: '', teachers: [] }

export default function Subjects() {
  const toast = useToast()
  const list = useAdminList(subjectsApi.list)
  const [courses, setCourses] = useState([])
  const [teacherOptions, setTeacherOptions] = useState([])

  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [confirmTarget, setConfirmTarget] = useState(null)
  const [confirmLoading, setConfirmLoading] = useState(false)

  useEffect(() => {
    coursesApi.list({ limit: 100, status: 'active' }).then((data) => setCourses(data.items)).catch(() => {})
    teachersApi.list({ limit: 100, status: 'active' }).then((data) => setTeacherOptions(data.items)).catch(() => {})
  }, [])

  const openAddModal = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFormError(null)
    setFieldErrors({})
    setModalOpen(true)
  }

  const openEditModal = (subject) => {
    setEditingId(subject._id)
    setForm({
      name: subject.name || '',
      code: subject.code || '',
      credits: subject.credits ?? '',
      semester: subject.semester ?? '',
      department: subject.department || '',
      course: subject.course?._id || '',
      description: subject.description || '',
      teachers: (subject.teachers || []).map((t) => t._id),
    })
    setFormError(null)
    setFieldErrors({})
    setModalOpen(true)
  }

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
  const handleTeachersChange = (e) => {
    const selected = Array.from(e.target.selectedOptions).map((o) => o.value)
    setForm((f) => ({ ...f, teachers: selected }))
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setFormError(null)
    setFieldErrors({})
    try {
      const payload = { ...form, credits: Number(form.credits), semester: Number(form.semester) }
      if (editingId) {
        await subjectsApi.update(editingId, payload)
        toast.success('Subject updated successfully.')
      } else {
        await subjectsApi.create(payload)
        toast.success('Subject created successfully.')
      }
      setModalOpen(false)
      list.refetch()
    } catch (err) {
      const apiErrors = err.response?.data?.errors
      if (apiErrors?.length) {
        setFieldErrors(Object.fromEntries(apiErrors.map((e) => [e.field, e.message])))
      } else {
        setFormError(err.response?.data?.message || 'Something went wrong. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleStatus = async () => {
    if (!confirmTarget) return
    setConfirmLoading(true)
    try {
      await subjectsApi.updateStatus(confirmTarget.subject._id, confirmTarget.nextActive)
      toast.success(`Subject ${confirmTarget.nextActive ? 'activated' : 'deactivated'} successfully.`)
      setConfirmTarget(null)
      list.refetch()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to update subject status.')
    } finally {
      setConfirmLoading(false)
    }
  }

  const columns = [
    { key: 'code', header: 'Code' },
    { key: 'name', header: 'Name' },
    { key: 'course', header: 'Course', render: (row) => row.course?.code || '—' },
    { key: 'credits', header: 'Credits' },
    { key: 'semester', header: 'Semester' },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.isActive ? 'Active' : 'Inactive'} /> },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-1">
          <button onClick={() => openEditModal(row)} aria-label={`Edit ${row.name}`} className="rounded-xl p-2 text-muted hover:bg-surface-elevated hover:text-ink transition">
            <Pencil size={15} />
          </button>
          <button
            onClick={() => setConfirmTarget({ subject: row, nextActive: !row.isActive })}
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
      <AdminPageHeader title="Subjects" subtitle="Manage subjects offered under each course." actionLabel="Add Subject" onAction={openAddModal} />

      <SearchInput value={list.search} onChange={list.setSearch} placeholder="Search by name or subject code…" />

      <DataTable columns={columns} data={list.items} loading={list.loading} emptyMessage="No subjects found. Try adjusting your search or add a new subject." />
      <Pagination page={list.pagination.page} totalPages={list.pagination.totalPages} total={list.pagination.total} onPageChange={list.setPage} />

      <AdminFormModal
        title={editingId ? 'Edit Subject' : 'Add Subject'}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        submitting={submitting}
        submitLabel={editingId ? 'Save changes' : 'Create subject'}
        error={formError}
      >
        <FormField label="Subject name" htmlFor="sub-name" error={fieldErrors.name}>
          <input id="sub-name" name="name" required value={form.name} onChange={handleChange} className={inputClass} />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Subject code" htmlFor="sub-code" error={fieldErrors.code}>
            <input id="sub-code" name="code" required value={form.code} onChange={handleChange} className={inputClass} />
          </FormField>
          <FormField label="Credits" htmlFor="sub-credits" error={fieldErrors.credits}>
            <input id="sub-credits" name="credits" type="number" min="0" max="20" required value={form.credits} onChange={handleChange} className={inputClass} />
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Semester" htmlFor="sub-semester" error={fieldErrors.semester}>
            <input id="sub-semester" name="semester" type="number" min="1" max="12" required value={form.semester} onChange={handleChange} className={inputClass} />
          </FormField>
          <FormField label="Department" htmlFor="sub-department">
            <input id="sub-department" name="department" value={form.department} onChange={handleChange} className={inputClass} />
          </FormField>
        </div>
        <FormField label="Course" htmlFor="sub-course" error={fieldErrors.course}>
          <select id="sub-course" name="course" required value={form.course} onChange={handleChange} className={inputClass}>
            <option value="">Select a course…</option>
            {courses.map((c) => (
              <option key={c._id} value={c._id}>{c.name} ({c.code})</option>
            ))}
          </select>
        </FormField>
        <FormField label="Teachers (optional)" htmlFor="sub-teachers">
          <select id="sub-teachers" name="teachers" multiple value={form.teachers} onChange={handleTeachersChange} className={`${inputClass} h-24`}>
            {teacherOptions.map((t) => (
              <option key={t._id} value={t._id}>{t.user?.name} ({t.employeeId})</option>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-muted">Hold Ctrl/Cmd to select multiple.</p>
        </FormField>
        <FormField label="Description (optional)" htmlFor="sub-description">
          <textarea id="sub-description" name="description" rows={2} value={form.description} onChange={handleChange} className={inputClass} />
        </FormField>
      </AdminFormModal>

      <ConfirmDialog
        open={Boolean(confirmTarget)}
        title={`${confirmTarget?.nextActive ? 'Activate' : 'Deactivate'} subject?`}
        description={confirmTarget?.nextActive ? 'This subject will become available again.' : 'This subject will be hidden from new timetable/attendance selections.'}
        confirmLabel={confirmTarget?.nextActive ? 'Activate' : 'Deactivate'}
        danger={!confirmTarget?.nextActive}
        onConfirm={handleToggleStatus}
        onCancel={() => setConfirmTarget(null)}
        loading={confirmLoading}
      />
    </PageContainer>
  )
}
