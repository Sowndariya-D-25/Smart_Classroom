import { useEffect, useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import {
  GraduationCap,
  Users,
  Building2,
  UserCheck,
  UserX,
  Search,
  Eye,
  Pencil,
  Power,
  Trash2,
  Plus,
  BookOpen,
  X,
} from 'lucide-react'
import PageContainer from '../../components/layout/PageContainer'
import AdminPageHeader from '../../components/admin/AdminPageHeader'
import DataTable from '../../components/admin/DataTable'
import Pagination from '../../components/admin/Pagination'
import AdminFormModal from '../../components/admin/AdminFormModal'
import ConfirmDialog from '../../components/admin/ConfirmDialog'
import StatusBadge from '../../components/common/StatusBadge'
import StatCard from '../../components/common/StatCard'
import FormField, { inputClass } from '../../components/FormField'
import { useAdminList } from '../../hooks/useAdminList'
import { useToast } from '../../context/ToastContext'
import { teachersApi, subjectsApi, departmentsApi } from '../../services/adminService'
import { normalizeDepartment } from '../../utils/department'

const EMPTY_ADD_FORM = {
  name: '',
  employeeId: '',
  email: '',
  mobile: '',
  department: '',
  designation: 'Assistant Professor',
  password: '',
  confirmPassword: '',
}

export default function Teachers() {
  const toast = useToast()
  const list = useAdminList(teachersApi.list, {
    initialFilters: { department: '', designation: '', year: '', status: '' },
  })

  const [departments, setDepartments] = useState([])
  const [availableSubjects, setAvailableSubjects] = useState([])

  // Add Teacher Modal State
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [addForm, setAddForm] = useState(EMPTY_ADD_FORM)
  const [addFormError, setAddFormError] = useState(null)
  const [addSubmitting, setAddSubmitting] = useState(false)

  // Edit Teacher Modal State
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingTeacherId, setEditingTeacherId] = useState(null)
  const [editForm, setEditForm] = useState({
    name: '',
    employeeId: '',
    email: '',
    mobile: '',
    department: '',
    designation: 'Assistant Professor',
    assignments: [],
  })
  const [editFormError, setEditFormError] = useState(null)
  const [editSubmitting, setEditSubmitting] = useState(false)

  // View Teacher Modal State
  const [viewTeacher, setViewTeacher] = useState(null)

  // Toggle status state
  const [confirmStatusTarget, setConfirmStatusTarget] = useState(null)
  const [statusLoading, setStatusLoading] = useState(false)

  // Delete Permanently state
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  useEffect(() => {
    departmentsApi.list().then((d) => setDepartments(d.items || [])).catch(() => {})
    subjectsApi.list({ limit: 100, status: 'active' }).then((s) => setAvailableSubjects(s.items || [])).catch(() => {})
  }, [])

  const canonicalDepartments = useMemo(() => {
    const names = departments.map((d) => normalizeDepartment(d.name || d))
    return Array.from(new Set(names)).filter(Boolean).sort()
  }, [departments])

  // ================= Add Teacher =================
  const openAddModal = () => {
    setAddForm({
      ...EMPTY_ADD_FORM,
      department: canonicalDepartments[0] || 'CSE',
    })
    setAddFormError(null)
    setAddModalOpen(true)
  }

  const handleAddSubmit = async () => {
    if (addForm.password !== addForm.confirmPassword) {
      setAddFormError('Passwords do not match')
      return
    }
    if (addForm.password.length < 8) {
      setAddFormError('Password must be at least 8 characters')
      return
    }

    setAddSubmitting(true)
    setAddFormError(null)
    try {
      await teachersApi.create({
        name: addForm.name.trim(),
        employeeId: addForm.employeeId.trim().toUpperCase(),
        email: addForm.email.trim(),
        mobile: addForm.mobile.trim(),
        department: addForm.department.trim(),
        designation: addForm.designation.trim(),
        password: addForm.password,
        confirmPassword: addForm.confirmPassword,
      })
      toast.success('Teacher created successfully.')
      setAddModalOpen(false)
      list.refetch()
    } catch (err) {
      setAddFormError(err.response?.data?.message || 'Failed to create teacher.')
    } finally {
      setAddSubmitting(false)
    }
  }

  // ================= Edit Teacher & Assignments =================
  const openEditModal = (t) => {
    setEditingTeacherId(t._id)
    setEditForm({
      name: t.user?.name || '',
      employeeId: t.employeeId || '',
      email: t.user?.email || '',
      mobile: t.user?.phone || t.phone || '',
      department: normalizeDepartment(t.department) || '',
      designation: t.designation || 'Assistant Professor',
      assignments: Array.isArray(t.assignments)
        ? t.assignments.map((a) => ({
            year: a.year || 1,
            department: normalizeDepartment(a.department || t.department) || '',
            section: a.section || 'A',
            subject: a.subject?._id || a.subject || '',
          }))
        : [],
    })
    setEditFormError(null)
    setEditModalOpen(true)
  }

  const addAssignmentRow = () => {
    setEditForm((prev) => ({
      ...prev,
      assignments: [
        ...prev.assignments,
        {
          year: 1,
          department: editForm.department || '',
          section: 'A',
          subject: availableSubjects[0]?._id || '',
        },
      ],
    }))
  }

  const updateAssignmentRow = (index, field, value) => {
    setEditForm((prev) => {
      const next = [...prev.assignments]
      next[index] = { ...next[index], [field]: value }
      return { ...prev, assignments: next }
    })
  }

  const removeAssignmentRow = (index) => {
    setEditForm((prev) => ({
      ...prev,
      assignments: prev.assignments.filter((_, i) => i !== index),
    }))
  }

  const handleEditSubmit = async () => {
    setEditSubmitting(true)
    setEditFormError(null)
    try {
      await teachersApi.update(editingTeacherId, {
        name: editForm.name.trim(),
        employeeId: editForm.employeeId.trim().toUpperCase(),
        email: editForm.email.trim(),
        mobile: editForm.mobile.trim(),
        department: editForm.department.trim(),
        designation: editForm.designation.trim(),
        assignments: editForm.assignments,
      })
      toast.success('Teacher and assignments updated successfully.')
      setEditModalOpen(false)
      list.refetch()
    } catch (err) {
      setEditFormError(err.response?.data?.message || 'Failed to update teacher.')
    } finally {
      setEditSubmitting(false)
    }
  }

  // ================= Status & Deletion =================
  const handleToggleStatus = async () => {
    if (!confirmStatusTarget) return
    setStatusLoading(true)
    try {
      await teachersApi.updateStatus(confirmStatusTarget.teacher._id, confirmStatusTarget.nextActive)
      toast.success(
        `Teacher ${confirmStatusTarget.nextActive ? 'activated' : 'deactivated'} successfully.`,
      )
      setConfirmStatusTarget(null)
      list.refetch()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to update status.')
    } finally {
      setStatusLoading(false)
    }
  }

  const handlePermanentDelete = async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      await teachersApi.remove(deleteTarget._id)
      toast.success('Faculty member deleted permanently.')
      setDeleteTarget(null)
      list.refetch()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to delete faculty member.')
    } finally {
      setDeleteLoading(false)
    }
  }

  // Summary counts
  const summary = list.rawResponse?.summary || {
    total: list.pagination.total,
    active: list.items.filter((t) => t.isActive).length,
    inactive: list.items.filter((t) => !t.isActive).length,
    departments: new Set(list.items.filter((t) => t.isActive).map((t) => t.department)).size,
  }

  // Table Columns: Teacher | Employee ID | Department | Designation | Email | Mobile | Status | Actions
  const columns = [
    {
      key: 'name',
      header: 'Teacher',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900">{row.user?.name || '—'}</p>
          {row.assignments?.length > 0 && (
            <p className="text-xs text-slate-500">
              {row.assignments.length} Teaching {row.assignments.length === 1 ? 'Assignment' : 'Assignments'}
            </p>
          )}
        </div>
      ),
    },
    { key: 'employeeId', header: 'Employee ID' },
    { key: 'department', header: 'Department', render: (row) => normalizeDepartment(row.department) },
    { key: 'designation', header: 'Designation', render: (row) => row.designation || '—' },
    { key: 'email', header: 'Email', render: (row) => row.user?.email || '—' },
    { key: 'mobile', header: 'Mobile', render: (row) => row.user?.phone || row.phone || '—' },
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
            onClick={() => setViewTeacher(row)}
            aria-label={`View ${row.user?.name}`}
            title="View Details"
            className="rounded-xl p-2 text-muted hover:bg-surface-elevated hover:text-ink transition"
          >
            <Eye size={15} />
          </button>
          <button
            onClick={() => openEditModal(row)}
            aria-label={`Edit ${row.user?.name}`}
            title="Edit Teacher & Assignments"
            className="rounded-xl p-2 text-muted hover:bg-surface-elevated hover:text-ink transition"
          >
            <Pencil size={15} />
          </button>
          <button
            onClick={() => setConfirmStatusTarget({ teacher: row, nextActive: !row.isActive })}
            aria-label={`${row.isActive ? 'Deactivate' : 'Activate'} ${row.user?.name}`}
            title={row.isActive ? 'Deactivate' : 'Activate'}
            className="rounded-xl p-2 text-muted hover:bg-surface-elevated hover:text-ink transition"
          >
            <Power size={15} />
          </button>
          <button
            onClick={() => setDeleteTarget(row)}
            aria-label={`Delete ${row.user?.name}`}
            title="Delete Permanently"
            className="rounded-xl p-2 text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition"
          >
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ]

  return (
    <PageContainer>
      <AdminPageHeader
        title="Teachers"
        subtitle="Manage faculty members and their academic teaching assignments."
        actionLabel="Add Teacher"
        onAction={openAddModal}
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={GraduationCap}
          label="Total Teachers"
          value={list.loading ? '…' : summary.total}
          subtext="Registered faculty members"
          colorScheme="emerald"
        />
        <StatCard
          icon={UserCheck}
          label="Active Teachers"
          value={list.loading ? '…' : summary.active}
          subtext="Active teaching assignments"
          colorScheme="blue"
        />
        <StatCard
          icon={UserX}
          label="Inactive Teachers"
          value={list.loading ? '…' : summary.inactive}
          subtext="Disabled access"
          colorScheme="rose"
        />
        <StatCard
          icon={Building2}
          label="Departments"
          value={list.loading ? '…' : summary.departments}
          subtext="Unique active departments"
          colorScheme="purple"
        />
      </div>

      {/* Filters and Search */}
      <div className="mt-6 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[280px] flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, employee ID, or email…"
              value={list.search}
              onChange={(e) => list.setSearch(e.target.value)}
              className={`${inputClass} pl-9`}
            />
          </div>

          {/* Department Filter */}
          <select
            value={list.filters.department || ''}
            onChange={(e) => list.updateFilter('department', e.target.value)}
            className="h-10 rounded-xl border border-line bg-surface px-3 text-xs font-semibold text-ink shadow-xs transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">All Departments</option>
            {canonicalDepartments.map((deptName) => (
              <option key={deptName} value={deptName}>
                {deptName}
              </option>
            ))}
          </select>

          {/* Designation Filter */}
          <select
            value={list.filters.designation || ''}
            onChange={(e) => list.updateFilter('designation', e.target.value)}
            className="h-10 rounded-xl border border-line bg-surface px-3 text-xs font-semibold text-ink shadow-xs transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">All Designations</option>
            <option value="Professor">Professor</option>
            <option value="Associate Professor">Associate Professor</option>
            <option value="Assistant Professor">Assistant Professor</option>
            <option value="Lecturer">Lecturer</option>
            <option value="Head of Department">Head of Department</option>
          </select>

          {/* Year Filter */}
          <select
            value={list.filters.year || ''}
            onChange={(e) => list.updateFilter('year', e.target.value)}
            className="h-10 rounded-xl border border-line bg-surface px-3 text-xs font-semibold text-ink shadow-xs transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">All Years</option>
            <option value="1">Year 1</option>
            <option value="2">Year 2</option>
            <option value="3">Year 3</option>
            <option value="4">Year 4</option>
          </select>

          {/* Status Filter */}
          <select
            value={list.filters.status || ''}
            onChange={(e) => list.updateFilter('status', e.target.value)}
            className="h-10 rounded-xl border border-line bg-surface px-3 text-xs font-semibold text-ink shadow-xs transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        <DataTable
          columns={columns}
          data={list.items}
          loading={list.loading}
          emptyMessage="No teachers found matching your filters."
        />
        <Pagination
          page={list.pagination.page}
          totalPages={list.pagination.totalPages}
          total={list.pagination.total}
          onPageChange={list.setPage}
        />
      </div>

      {/* Add Teacher Modal */}
      <AdminFormModal
        title="Add Teacher"
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSubmit={handleAddSubmit}
        submitting={addSubmitting}
        submitLabel="Create Teacher"
        error={addFormError}
      >
        <FormField label="Full Name" htmlFor="t-name">
          <input
            id="t-name"
            required
            value={addForm.name}
            onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
            className={inputClass}
            placeholder="Dr. Rajesh Mehta"
          />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Employee ID" htmlFor="t-empid">
            <input
              id="t-empid"
              required
              value={addForm.employeeId}
              onChange={(e) => setAddForm({ ...addForm, employeeId: e.target.value })}
              className={inputClass}
              placeholder="EMP-012"
            />
          </FormField>
          <FormField label="Email" htmlFor="t-email">
            <input
              id="t-email"
              type="email"
              required
              value={addForm.email}
              onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
              className={inputClass}
              placeholder="rajesh@college.edu"
            />
          </FormField>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <FormField label="Department" htmlFor="t-dept">
            <select
              id="t-dept"
              required
              value={addForm.department}
              onChange={(e) => setAddForm({ ...addForm, department: e.target.value })}
              className={inputClass}
            >
              <option value="">Select Department…</option>
              {canonicalDepartments.map((deptName) => (
                <option key={deptName} value={deptName}>
                  {deptName}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Designation" htmlFor="t-desig">
            <input
              id="t-desig"
              value={addForm.designation}
              onChange={(e) => setAddForm({ ...addForm, designation: e.target.value })}
              className={inputClass}
            />
          </FormField>
          <FormField label="Mobile Number" htmlFor="t-mobile">
            <input
              id="t-mobile"
              value={addForm.mobile}
              onChange={(e) => setAddForm({ ...addForm, mobile: e.target.value })}
              className={inputClass}
              placeholder="+91..."
            />
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Initial Password" htmlFor="t-pass">
            <input
              id="t-pass"
              type="password"
              required
              value={addForm.password}
              onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
              className={inputClass}
              placeholder="Min. 8 characters"
            />
          </FormField>
          <FormField label="Confirm Password" htmlFor="t-cpass">
            <input
              id="t-cpass"
              type="password"
              required
              value={addForm.confirmPassword}
              onChange={(e) => setAddForm({ ...addForm, confirmPassword: e.target.value })}
              className={inputClass}
            />
          </FormField>
        </div>
      </AdminFormModal>

      {/* Edit Teacher & Manage Teaching Assignments Modal */}
      <AdminFormModal
        title="Edit Faculty & Teaching Assignments"
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        onSubmit={handleEditSubmit}
        submitting={editSubmitting}
        submitLabel="Save Changes"
        error={editFormError}
        maxWidth="max-w-2xl"
      >
        <FormField label="Full Name" htmlFor="te-name">
          <input
            id="te-name"
            required
            value={editForm.name}
            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            className={inputClass}
          />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Employee ID" htmlFor="te-empid">
            <input
              id="te-empid"
              required
              value={editForm.employeeId}
              onChange={(e) => setEditForm({ ...editForm, employeeId: e.target.value })}
              className={inputClass}
            />
          </FormField>
          <FormField label="Institutional Email" htmlFor="te-email">
            <input
              id="te-email"
              type="email"
              required
              value={editForm.email}
              onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              className={inputClass}
            />
          </FormField>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <FormField label="Department" htmlFor="te-dept">
            <select
              id="te-dept"
              value={editForm.department}
              onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
              className={inputClass}
            >
              <option value="">Select Department…</option>
              {canonicalDepartments.map((deptName) => (
                <option key={deptName} value={deptName}>
                  {deptName}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Designation" htmlFor="te-desig">
            <input
              id="te-desig"
              value={editForm.designation}
              onChange={(e) => setEditForm({ ...editForm, designation: e.target.value })}
              className={inputClass}
            />
          </FormField>
          <FormField label="Mobile Number" htmlFor="te-mobile">
            <input
              id="te-mobile"
              value={editForm.mobile}
              onChange={(e) => setEditForm({ ...editForm, mobile: e.target.value })}
              className={inputClass}
            />
          </FormField>
        </div>

        {/* Teaching Assignments Section */}
        <div className="mt-4 border-t border-slate-100 pt-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                Academic Teaching Assignments
              </p>
              <p className="text-[11px] text-slate-400">
                These assignments directly populate the teacher's "My Classes" roster.
              </p>
            </div>
            <button
              type="button"
              onClick={addAssignmentRow}
              className="flex items-center gap-1 rounded bg-primary/10 px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/20"
            >
              <Plus size={13} /> Add Assignment
            </button>
          </div>

          {editForm.assignments.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">
              No assignments yet. Click "+ Add Assignment" to assign a subject and class section.
            </p>
          ) : (
            <div className="space-y-2">
              {editForm.assignments.map((row, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2"
                >
                  <div className="w-20">
                    <label className="text-[10px] text-slate-400">Year</label>
                    <select
                      value={row.year}
                      onChange={(e) => updateAssignmentRow(idx, 'year', Number(e.target.value))}
                      className="h-8 w-full rounded border border-slate-200 bg-white px-1 text-xs"
                    >
                      <option value={1}>Yr 1</option>
                      <option value={2}>Yr 2</option>
                      <option value={3}>Yr 3</option>
                      <option value={4}>Yr 4</option>
                    </select>
                  </div>

                  <div className="w-28">
                    <label className="text-[10px] text-slate-400">Department</label>
                    <select
                      value={row.department}
                      onChange={(e) => updateAssignmentRow(idx, 'department', e.target.value)}
                      className="h-8 w-full rounded border border-slate-200 bg-white px-1 text-xs"
                    >
                      <option value="">Dept…</option>
                      {departments.map((d) => (
                        <option key={d.name} value={d.name}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="w-16">
                    <label className="text-[10px] text-slate-400">Sec</label>
                    <select
                      value={row.section}
                      onChange={(e) => updateAssignmentRow(idx, 'section', e.target.value)}
                      className="h-8 w-full rounded border border-slate-200 bg-white px-1 text-xs"
                    >
                      {['A', 'B', 'C', 'D', 'E', 'F'].map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex-1">
                    <label className="text-[10px] text-slate-400">Subject</label>
                    <select
                      value={row.subject}
                      onChange={(e) => updateAssignmentRow(idx, 'subject', e.target.value)}
                      className="h-8 w-full rounded border border-slate-200 bg-white px-2 text-xs"
                    >
                      <option value="">Select Subject…</option>
                      {availableSubjects.map((s) => (
                        <option key={s._id} value={s._id}>
                          {s.name} ({s.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeAssignmentRow(idx)}
                    className="mt-4 rounded p-1 text-rose-500 hover:bg-rose-50"
                    title="Remove assignment"
                  >
                    <X size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </AdminFormModal>

      {/* View Teacher Modal */}
      {viewTeacher &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 backdrop-blur-md bg-slate-900/60 overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Faculty Profile Details"
          >
            <button
              type="button"
              className="absolute inset-0 h-full w-full bg-[#091D17]/60 cursor-default focus:outline-none"
              aria-label="Close dialog overlay"
              onClick={() => setViewTeacher(null)}
            />
            <div
              className="relative flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col min-h-0 overflow-hidden rounded-[24px] border border-line/90 bg-surface shadow-2xl animate-in fade-in zoom-in-95 duration-150 z-10"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex shrink-0 items-center justify-between border-b border-line/80 bg-gradient-to-r from-[#F6FAF7] to-[#F4F8F5] px-6 py-4">
                <h2 className="text-base font-extrabold text-ink font-display tracking-tight">
                  Faculty Profile Details
                </h2>
                <button
                  type="button"
                  onClick={() => setViewTeacher(null)}
                  className="rounded-xl p-2 text-muted hover:bg-slate-200/60 hover:text-ink transition active:scale-95"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 min-h-0 space-y-4 overflow-y-auto p-6 text-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Full Name</span>
                    <p className="mt-0.5 font-bold text-ink">
                      {viewTeacher.user?.name || '—'}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Employee ID</span>
                    <p className="mt-0.5 font-bold text-ink">
                      {viewTeacher.employeeId || '—'}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Department</span>
                    <p className="mt-0.5 font-medium text-ink">
                      {normalizeDepartment(viewTeacher.department)}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Designation</span>
                    <p className="mt-0.5 font-medium text-ink">
                      {viewTeacher.designation || '—'}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Email</span>
                    <p className="mt-0.5 font-medium text-ink truncate">
                      {viewTeacher.user?.email || '—'}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Mobile</span>
                    <p className="mt-0.5 font-medium text-ink">
                      {viewTeacher.user?.phone || viewTeacher.phone || '—'}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Account Status</span>
                    <div className="mt-1">
                      <StatusBadge status={viewTeacher.isActive ? 'Active' : 'Inactive'} />
                    </div>
                  </div>
                </div>

                {/* Teaching Assignments in View */}
                <div className="rounded-2xl border border-line bg-sage-50/50 p-4">
                  <p className="mb-2.5 text-xs font-bold text-ink font-display">
                    Assigned Teaching Classes ({viewTeacher.assignments?.length || 0})
                  </p>
                  {viewTeacher.assignments?.length > 0 ? (
                    <ul className="divide-y divide-line/60 text-xs">
                      {viewTeacher.assignments.map((a, i) => (
                        <li key={i} className="py-2 flex items-center justify-between">
                          <span className="font-semibold text-ink">
                            {a.subject?.name || 'Subject'} ({a.subject?.code || '—'})
                          </span>
                          <span className="text-muted text-[11px] font-medium">
                            Year {a.year} · {a.department} · Sec {a.section}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted font-medium">No active teaching assignments.</p>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 justify-end border-t border-line/80 bg-[#F8FAF7]/80 px-6 py-4">
                <button
                  type="button"
                  onClick={() => setViewTeacher(null)}
                  className="btn-secondary !px-4 !py-2 !text-xs font-semibold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Activate / Deactivate Confirmation */}
      <ConfirmDialog
        open={Boolean(confirmStatusTarget)}
        title={`${confirmStatusTarget?.nextActive ? 'Activate' : 'Deactivate'} Faculty Member?`}
        description={
          confirmStatusTarget?.nextActive
            ? `${confirmStatusTarget?.teacher.user?.name} will be able to log in and conduct attendance.`
            : `${confirmStatusTarget?.teacher.user?.name} will be blocked from logging in. Teaching records remain intact.`
        }
        confirmLabel={confirmStatusTarget?.nextActive ? 'Activate' : 'Deactivate'}
        danger={!confirmStatusTarget?.nextActive}
        onConfirm={handleToggleStatus}
        onCancel={() => setConfirmStatusTarget(null)}
        loading={statusLoading}
      />

      {/* Delete Permanently Confirmation */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Permanently Delete Teacher?"
        description={`Are you sure you want to permanently delete faculty member ${deleteTarget?.user?.name || deleteTarget?.employeeId}? This unlinks their teaching assignments and deletes their user account. All past attendance sessions and historical student records are preserved.`}
        confirmLabel="Delete Permanently"
        danger={true}
        onConfirm={handlePermanentDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleteLoading}
      />
    </PageContainer>
  )
}
