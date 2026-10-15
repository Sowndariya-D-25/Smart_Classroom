import { useState } from 'react'
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
import { coursesApi } from '../../services/adminService'
import { Pencil, Power } from 'lucide-react'

const EMPTY_FORM = { name: '', code: '', department: '', duration: '', description: '' }

export default function Courses() {
  const toast = useToast()
  const list = useAdminList(coursesApi.list)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [confirmTarget, setConfirmTarget] = useState(null)
  const [confirmLoading, setConfirmLoading] = useState(false)

  const openAddModal = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFormError(null)
    setFieldErrors({})
    setModalOpen(true)
  }

  const openEditModal = (course) => {
    setEditingId(course._id)
    setForm({
      name: course.name || '',
      code: course.code || '',
      department: course.department || '',
      duration: course.duration ?? '',
      description: course.description || '',
    })
    setFormError(null)
    setFieldErrors({})
    setModalOpen(true)
  }

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }))

  const handleSubmit = async () => {
    setSubmitting(true)
    setFormError(null)
    setFieldErrors({})
    try {
      const payload = { ...form, duration: form.duration ? Number(form.duration) : undefined }
      if (editingId) {
        await coursesApi.update(editingId, payload)
        toast.success('Course updated successfully.')
      } else {
        await coursesApi.create(payload)
        toast.success('Course created successfully.')
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
      await coursesApi.updateStatus(confirmTarget.course._id, confirmTarget.nextActive)
      toast.success(`Course ${confirmTarget.nextActive ? 'activated' : 'deactivated'} successfully.`)
      setConfirmTarget(null)
      list.refetch()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to update course status.')
    } finally {
      setConfirmLoading(false)
    }
  }

  const columns = [
    { key: 'code', header: 'Code' },
    { key: 'name', header: 'Name' },
    { key: 'department', header: 'Department', render: (row) => row.department || '—' },
    { key: 'duration', header: 'Duration', render: (row) => (row.duration ? `${row.duration} yrs` : '—') },
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
            onClick={() => setConfirmTarget({ course: row, nextActive: !row.isActive })}
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
      <AdminPageHeader title="Courses" subtitle="Manage academic programs." actionLabel="Add Course" onAction={openAddModal} />

      <SearchInput value={list.search} onChange={list.setSearch} placeholder="Search by name or course code…" />

      <DataTable columns={columns} data={list.items} loading={list.loading} emptyMessage="No courses found. Try adjusting your search or add a new course." />
      <Pagination page={list.pagination.page} totalPages={list.pagination.totalPages} total={list.pagination.total} onPageChange={list.setPage} />

      <AdminFormModal
        title={editingId ? 'Edit Course' : 'Add Course'}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        submitting={submitting}
        submitLabel={editingId ? 'Save changes' : 'Create course'}
        error={formError}
      >
        <FormField label="Course name" htmlFor="c-name" error={fieldErrors.name}>
          <input id="c-name" name="name" required value={form.name} onChange={handleChange} className={inputClass} placeholder="B.E. Computer Science and Engineering" />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Course code" htmlFor="c-code" error={fieldErrors.code}>
            <input id="c-code" name="code" required value={form.code} onChange={handleChange} className={inputClass} placeholder="CSE" />
          </FormField>
          <FormField label="Duration (years)" htmlFor="c-duration" error={fieldErrors.duration}>
            <input id="c-duration" name="duration" type="number" min="1" max="10" value={form.duration} onChange={handleChange} className={inputClass} />
          </FormField>
        </div>
        <FormField label="Department" htmlFor="c-department">
          <input id="c-department" name="department" value={form.department} onChange={handleChange} className={inputClass} />
        </FormField>
        <FormField label="Description (optional)" htmlFor="c-description">
          <textarea id="c-description" name="description" rows={2} value={form.description} onChange={handleChange} className={inputClass} />
        </FormField>
      </AdminFormModal>

      <ConfirmDialog
        open={Boolean(confirmTarget)}
        title={`${confirmTarget?.nextActive ? 'Activate' : 'Deactivate'} course?`}
        description={confirmTarget?.nextActive ? 'This course will become available again.' : 'This course will be hidden from new student/subject selections.'}
        confirmLabel={confirmTarget?.nextActive ? 'Activate' : 'Deactivate'}
        danger={!confirmTarget?.nextActive}
        onConfirm={handleToggleStatus}
        onCancel={() => setConfirmTarget(null)}
        loading={confirmLoading}
      />
    </PageContainer>
  )
}
