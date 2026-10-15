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
import { classroomsApi } from '../../services/adminService'
import { Pencil, Power } from 'lucide-react'

const EMPTY_FORM = { name: '', code: '', building: '', floor: '', capacity: '', roomNumber: '', hasCamera: false, cameraId: '' }

export default function Classrooms() {
  const toast = useToast()
  const list = useAdminList(classroomsApi.list)

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

  const openEditModal = (classroom) => {
    setEditingId(classroom._id)
    setForm({
      name: classroom.name || '',
      code: classroom.code || '',
      building: classroom.building || '',
      floor: classroom.floor ?? '',
      capacity: classroom.capacity ?? '',
      roomNumber: classroom.roomNumber || '',
      hasCamera: Boolean(classroom.hasCamera),
      cameraId: classroom.cameraId || '',
    })
    setFormError(null)
    setFieldErrors({})
    setModalOpen(true)
  }

  const handleChange = (e) => {
    const { name, type, checked, value } = e.target
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }))
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setFormError(null)
    setFieldErrors({})
    try {
      const payload = {
        ...form,
        capacity: Number(form.capacity),
        floor: form.floor === '' ? undefined : Number(form.floor),
      }
      if (editingId) {
        await classroomsApi.update(editingId, payload)
        toast.success('Classroom updated successfully.')
      } else {
        await classroomsApi.create(payload)
        toast.success('Classroom created successfully.')
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
      await classroomsApi.updateStatus(confirmTarget.classroom._id, confirmTarget.nextActive)
      toast.success(`Classroom ${confirmTarget.nextActive ? 'activated' : 'deactivated'} successfully.`)
      setConfirmTarget(null)
      list.refetch()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to update classroom status.')
    } finally {
      setConfirmLoading(false)
    }
  }

  const columns = [
    { key: 'code', header: 'Code' },
    { key: 'name', header: 'Name' },
    { key: 'building', header: 'Building', render: (row) => row.building || '—' },
    { key: 'capacity', header: 'Capacity' },
    { key: 'hasCamera', header: 'Camera', render: (row) => (row.hasCamera ? 'Yes' : 'No') },
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
            onClick={() => setConfirmTarget({ classroom: row, nextActive: !row.isActive })}
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
      <AdminPageHeader title="Classrooms" subtitle="Manage physical rooms and camera setup." actionLabel="Add Classroom" onAction={openAddModal} />

      <SearchInput value={list.search} onChange={list.setSearch} placeholder="Search by name, code, or room number…" />

      <DataTable columns={columns} data={list.items} loading={list.loading} emptyMessage="No classrooms found. Try adjusting your search or add a new classroom." />
      <Pagination page={list.pagination.page} totalPages={list.pagination.totalPages} total={list.pagination.total} onPageChange={list.setPage} />

      <AdminFormModal
        title={editingId ? 'Edit Classroom' : 'Add Classroom'}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        submitting={submitting}
        submitLabel={editingId ? 'Save changes' : 'Create classroom'}
        error={formError}
      >
        <FormField label="Classroom name" htmlFor="cr-name" error={fieldErrors.name}>
          <input id="cr-name" name="name" required value={form.name} onChange={handleChange} className={inputClass} placeholder="Lecture Hall 1" />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Classroom code" htmlFor="cr-code" error={fieldErrors.code}>
            <input id="cr-code" name="code" required value={form.code} onChange={handleChange} className={inputClass} placeholder="CR-101" />
          </FormField>
          <FormField label="Capacity" htmlFor="cr-capacity" error={fieldErrors.capacity}>
            <input id="cr-capacity" name="capacity" type="number" min="1" required value={form.capacity} onChange={handleChange} className={inputClass} />
          </FormField>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <FormField label="Building" htmlFor="cr-building">
            <input id="cr-building" name="building" value={form.building} onChange={handleChange} className={inputClass} />
          </FormField>
          <FormField label="Floor" htmlFor="cr-floor">
            <input id="cr-floor" name="floor" type="number" value={form.floor} onChange={handleChange} className={inputClass} />
          </FormField>
          <FormField label="Room #" htmlFor="cr-roomNumber">
            <input id="cr-roomNumber" name="roomNumber" value={form.roomNumber} onChange={handleChange} className={inputClass} />
          </FormField>
        </div>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" name="hasCamera" checked={form.hasCamera} onChange={handleChange} className="h-4 w-4 rounded border-line text-primary focus:ring-primary/30" />
          This room has a camera installed (for Computer Vision attendance)
        </label>
        {form.hasCamera && (
          <FormField label="Camera ID" htmlFor="cr-cameraId">
            <input id="cr-cameraId" name="cameraId" value={form.cameraId} onChange={handleChange} className={inputClass} placeholder="CAM-101" />
          </FormField>
        )}
      </AdminFormModal>

      <ConfirmDialog
        open={Boolean(confirmTarget)}
        title={`${confirmTarget?.nextActive ? 'Activate' : 'Deactivate'} classroom?`}
        description={confirmTarget?.nextActive ? 'This classroom will become available again.' : 'This classroom will be hidden from new timetable selections.'}
        confirmLabel={confirmTarget?.nextActive ? 'Activate' : 'Deactivate'}
        danger={!confirmTarget?.nextActive}
        onConfirm={handleToggleStatus}
        onCancel={() => setConfirmTarget(null)}
        loading={confirmLoading}
      />
    </PageContainer>
  )
}
