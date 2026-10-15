import { useEffect, useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import {
  Users,
  Search,
  Eye,
  Pencil,
  Power,
  Trash2,
  AlertTriangle,
  UserCheck,
  UserX,
  Clock,
  ClipboardCheck,
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
import { studentsApi, departmentsApi } from '../../services/adminService'
import { normalizeDepartment } from '../../utils/department'

export default function Students() {
  const toast = useToast()
  const list = useAdminList(studentsApi.list, {
    initialFilters: { year: '', department: '', section: '', status: '' },
  })

  const [departments, setDepartments] = useState([])

  // View modal state
  const [viewStudent, setViewStudent] = useState(null)
  const [viewLoading, setViewLoading] = useState(false)

  // Edit modal state
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    phone: '',
    department: '',
    year: '',
    section: '',
    studentId: '',
    rollNumber: '',
  })
  const [editFormError, setEditFormError] = useState(null)
  const [editSubmitting, setEditSubmitting] = useState(false)

  // Toggle status state
  const [confirmStatusTarget, setConfirmStatusTarget] = useState(null)
  const [statusLoading, setStatusLoading] = useState(false)

  // Permanent Delete state
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const [availableSections, setAvailableSections] = useState([])
  const [sectionsLoading, setSectionsLoading] = useState(false)

  useEffect(() => {
    departmentsApi
      .list()
      .then((data) => setDepartments(data.items || []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    let cancelled = false
    setSectionsLoading(true)
    studentsApi
      .getSections({ department: list.filters.department, year: list.filters.year })
      .then((res) => {
        if (!cancelled) {
          const secs = res?.sections || []
          setAvailableSections(secs)
          if (list.filters.section && !secs.includes(list.filters.section)) {
            list.updateFilter('section', '')
          }
        }
      })
      .catch(() => {
        if (!cancelled) setAvailableSections([])
      })
      .finally(() => {
        if (!cancelled) setSectionsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [list.filters.department, list.filters.year])

  const canonicalDepartments = useMemo(() => {
    const names = departments.map((d) => normalizeDepartment(d.name || d))
    return Array.from(new Set(names)).filter(Boolean).sort()
  }, [departments])

  // View Details
  const handleOpenView = async (student) => {
    setViewLoading(true)
    try {
      const res = await studentsApi.get(student._id)
      // res returns { student, attendance } from getStudent
      setViewStudent(res)
    } catch (err) {
      toast.error('Failed to load student details')
    } finally {
      setViewLoading(false)
    }
  }

  // Open Edit Modal
  const handleOpenEdit = (student) => {
    setEditingId(student._id)
    setEditForm({
      name: student.user?.name || '',
      email: student.user?.email || '',
      phone: student.user?.phone || student.phone || '',
      department: normalizeDepartment(student.department || student.course?.department) || '',
      year: student.year || '',
      section: student.section || '',
      studentId: student.studentId || '',
      rollNumber: student.rollNumber || '',
    })
    setEditFormError(null)
    setEditModalOpen(true)
  }

  // Handle Edit Submit
  const handleEditSubmit = async () => {
    setEditSubmitting(true)
    setEditFormError(null)
    try {
      await studentsApi.update(editingId, {
        name: editForm.name.trim(),
        email: editForm.email.trim(),
        phone: editForm.phone?.trim(),
        department: editForm.department?.trim(),
        year: editForm.year ? Number(editForm.year) : undefined,
        section: editForm.section?.trim().toUpperCase(),
        studentId: editForm.studentId?.trim().toUpperCase(),
      })
      toast.success('Student profile updated successfully.')
      setEditModalOpen(false)
      list.refetch()
    } catch (err) {
      setEditFormError(err.response?.data?.message || 'Failed to update student profile.')
    } finally {
      setEditSubmitting(false)
    }
  }

  // Toggle Active/Inactive Status
  const handleToggleStatus = async () => {
    if (!confirmStatusTarget) return
    setStatusLoading(true)
    try {
      await studentsApi.updateStatus(confirmStatusTarget.student._id, confirmStatusTarget.nextActive)
      toast.success(
        `Student ${confirmStatusTarget.nextActive ? 'activated' : 'deactivated'} successfully.`,
      )
      setConfirmStatusTarget(null)
      list.refetch()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to update student status.')
    } finally {
      setStatusLoading(false)
    }
  }

  // Permanent Delete
  const handlePermanentDelete = async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      await studentsApi.remove(deleteTarget._id)
      toast.success('Student account and profile deleted permanently.')
      setDeleteTarget(null)
      list.refetch()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to delete student.')
    } finally {
      setDeleteLoading(false)
    }
  }

  // Summary counts
  const summary = list.rawResponse?.summary || {
    total: list.pagination.total,
    active: list.items.filter((s) => s.isActive).length,
    inactive: list.items.filter((s) => !s.isActive).length,
    recentlyRegistered: 0,
  }

  // Table columns: Student | Register No. | Year | Department | Section | Email | Status | Actions
  // DO NOT show: Course, Face Status, Classroom
  const columns = [
    {
      key: 'student',
      header: 'Student',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900">
            {row.user?.name || row.studentId}
          </p>
          <p className="text-xs text-slate-500">ID: {row.studentId}</p>
        </div>
      ),
    },
    {
      key: 'rollNumber',
      header: 'Register No.',
      render: (row) => row.rollNumber || '—',
    },
    {
      key: 'year',
      header: 'Year',
      render: (row) => (row.year ? `Year ${row.year}` : '—'),
    },
    {
      key: 'department',
      header: 'Department',
      render: (row) => normalizeDepartment(row.department || row.course?.department),
    },
    {
      key: 'section',
      header: 'Section',
      render: (row) => row.section || '—',
    },
    {
      key: 'email',
      header: 'Email',
      render: (row) => row.user?.email || '—',
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
            onClick={() => handleOpenView(row)}
            aria-label={`View ${row.user?.name}`}
            title="View Details"
            className="rounded-xl p-2 text-muted hover:bg-surface-elevated hover:text-ink transition"
          >
            <Eye size={15} />
          </button>
          <button
            onClick={() => handleOpenEdit(row)}
            aria-label={`Edit ${row.user?.name}`}
            title="Edit Student"
            className="rounded-xl p-2 text-muted hover:bg-surface-elevated hover:text-ink transition"
          >
            <Pencil size={15} />
          </button>
          <button
            onClick={() => setConfirmStatusTarget({ student: row, nextActive: !row.isActive })}
            aria-label={`${row.isActive ? 'Deactivate' : 'Activate'} ${row.user?.name}`}
            title={row.isActive ? 'Deactivate Student' : 'Activate Student'}
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
        title="Students"
        subtitle="View and manage students registered through the academic system."
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Users}
          label="Total Students"
          value={list.loading ? '…' : summary.total}
          subtext="Enrolled students"
          colorScheme="emerald"
        />
        <StatCard
          icon={UserCheck}
          label="Active Students"
          value={list.loading ? '…' : summary.active}
          subtext="Authorized accounts"
          colorScheme="blue"
        />
        <StatCard
          icon={UserX}
          label="Inactive Students"
          value={list.loading ? '…' : summary.inactive}
          subtext="Disabled access"
          colorScheme="rose"
        />
        <StatCard
          icon={Clock}
          label="Recently Registered"
          value={list.loading ? '…' : summary.recentlyRegistered}
          subtext="Past 30 days"
          colorScheme="amber"
        />
      </div>

      {/* Filter and Search Bar */}
      <div className="mt-6 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[280px] flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, register number, student ID, or email…"
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

          {/* Section Filter */}
          <select
            value={list.filters.section || ''}
            onChange={(e) => list.updateFilter('section', e.target.value)}
            disabled={sectionsLoading}
            className="h-10 rounded-xl border border-line bg-surface px-3 text-xs font-semibold text-ink shadow-xs transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
          >
            <option value="">
              {availableSections.length > 0 ? 'All Sections' : 'No sections available'}
            </option>
            {availableSections.map((sec) => (
              <option key={sec} value={sec}>
                Section {sec}
              </option>
            ))}
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
          emptyMessage="No students found matching the selected filters."
        />
        <Pagination
          page={list.pagination.page}
          totalPages={list.pagination.totalPages}
          total={list.pagination.total}
          onPageChange={list.setPage}
        />
      </div>

      {/* View Student Details Modal */}
      {viewStudent &&
        (() => {
          const studentData = viewStudent.student || viewStudent
          const attendanceData = viewStudent.attendance || {}
          return createPortal(
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 backdrop-blur-md bg-slate-900/60 overflow-hidden"
              role="dialog"
              aria-modal="true"
              aria-label="Student Profile Details"
            >
              <button
                type="button"
                className="absolute inset-0 h-full w-full bg-[#091D17]/60 cursor-default focus:outline-none"
                aria-label="Close dialog overlay"
                onClick={() => setViewStudent(null)}
              />
              <div
                className="relative flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col min-h-0 overflow-hidden rounded-[24px] border border-line/90 bg-surface shadow-2xl animate-in fade-in zoom-in-95 duration-150 z-10"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex shrink-0 items-center justify-between border-b border-line/80 bg-gradient-to-r from-[#F6FAF7] to-[#F4F8F5] px-6 py-4">
                  <h2 className="text-base font-extrabold text-ink font-display tracking-tight">
                    Student Profile Details
                  </h2>
                  <button
                    type="button"
                    onClick={() => setViewStudent(null)}
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
                        {studentData.user?.name || studentData.name || '—'}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Student ID</span>
                      <p className="mt-0.5 font-bold text-ink">
                        {studentData.studentId || '—'}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Register / Roll No.</span>
                      <p className="mt-0.5 font-medium text-ink">
                        {studentData.rollNumber || studentData.registerNumber || '—'}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Department</span>
                      <p className="mt-0.5 font-medium text-ink">
                        {normalizeDepartment(studentData.department || studentData.course?.department)}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Academic Year</span>
                      <p className="mt-0.5 font-medium text-ink">
                        {studentData.year ? `Year ${studentData.year}` : '—'}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Section</span>
                      <p className="mt-0.5 font-medium text-ink">
                        {studentData.section ? `Section ${studentData.section}` : '—'}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Email</span>
                      <p className="mt-0.5 font-medium text-ink truncate">
                        {studentData.user?.email || studentData.email || '—'}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Mobile</span>
                      <p className="mt-0.5 font-medium text-ink">
                        {studentData.user?.phone || studentData.phone || studentData.mobile || '—'}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Status</span>
                      <div className="mt-1">
                        <StatusBadge status={studentData.isActive ? 'Active' : 'Inactive'} />
                      </div>
                    </div>
                  </div>

                  {/* Attendance Statistics */}
                  <div className="rounded-2xl border border-line bg-sage-50/50 p-4">
                    <div className="mb-2.5 flex items-center gap-2">
                      <ClipboardCheck className="h-4 w-4 text-primary" />
                      <span className="text-xs font-bold text-ink font-display">
                        Attendance Record Summary
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center text-xs">
                      <div className="rounded-xl bg-white p-2.5 shadow-2xs border border-line/60">
                        <p className="text-[10px] font-bold text-muted uppercase">Total</p>
                        <p className="mt-0.5 font-black text-ink">
                          {attendanceData.total ?? 0}
                        </p>
                      </div>
                      <div className="rounded-xl bg-white p-2.5 shadow-2xs border border-line/60">
                        <p className="text-[10px] font-bold text-emerald-700 uppercase">Present</p>
                        <p className="mt-0.5 font-black text-ink">
                          {attendanceData.present ?? 0}
                        </p>
                      </div>
                      <div className="rounded-xl bg-white p-2.5 shadow-2xs border border-line/60">
                        <p className="text-[10px] font-bold text-amber-700 uppercase">Late</p>
                        <p className="mt-0.5 font-black text-ink">
                          {attendanceData.late ?? 0}
                        </p>
                      </div>
                      <div className="rounded-xl bg-white p-2.5 shadow-2xs border border-line/60">
                        <p className="text-[10px] font-bold text-primary uppercase">Attendance</p>
                        <p className="mt-0.5 font-black text-primary">
                          {attendanceData.percentage !== null && attendanceData.percentage !== undefined
                            ? `${attendanceData.percentage}%`
                            : 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 justify-end border-t border-line/80 bg-[#F8FAF7]/80 px-6 py-4">
                  <button
                    type="button"
                    onClick={() => setViewStudent(null)}
                    className="btn-secondary !px-4 !py-2 !text-xs font-semibold"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        })()}



      {/* Edit Student Modal */}
      <AdminFormModal
        title="Edit Student Profile"
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        onSubmit={handleEditSubmit}
        submitting={editSubmitting}
        submitLabel="Save Changes"
        error={editFormError}
      >
        <FormField label="Full Name" htmlFor="stu-name">
          <input
            id="stu-name"
            required
            value={editForm.name}
            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            className={inputClass}
          />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Email" htmlFor="stu-email">
            <input
              id="stu-email"
              type="email"
              required
              value={editForm.email}
              onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              className={inputClass}
            />
          </FormField>
          <FormField label="Mobile Number" htmlFor="stu-phone">
            <input
              id="stu-phone"
              value={editForm.phone}
              onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
              className={inputClass}
              placeholder="+91..."
            />
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Student ID" htmlFor="stu-id">
            <input
              id="stu-id"
              required
              value={editForm.studentId}
              onChange={(e) => setEditForm({ ...editForm, studentId: e.target.value })}
              className={inputClass}
            />
          </FormField>
          <FormField label="Register / Roll No." htmlFor="stu-roll">
            <input
              id="stu-roll"
              value={editForm.rollNumber}
              disabled
              className={`${inputClass} bg-slate-50 cursor-not-allowed`}
            />
          </FormField>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <FormField label="Department" htmlFor="stu-dept">
            <select
              id="stu-dept"
              value={editForm.department}
              onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
              className={inputClass}
            >
              <option value="">Select Dept…</option>
              {canonicalDepartments.map((deptName) => (
                <option key={deptName} value={deptName}>
                  {deptName}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Year" htmlFor="stu-year">
            <input
              id="stu-year"
              type="number"
              min="1"
              max="5"
              value={editForm.year}
              onChange={(e) => setEditForm({ ...editForm, year: e.target.value })}
              className={inputClass}
            />
          </FormField>
          <FormField label="Section" htmlFor="stu-sec">
            <input
              id="stu-sec"
              value={editForm.section}
              onChange={(e) => setEditForm({ ...editForm, section: e.target.value })}
              className={inputClass}
            />
          </FormField>
        </div>
      </AdminFormModal>

      {/* Activate / Deactivate Confirmation */}
      <ConfirmDialog
        open={Boolean(confirmStatusTarget)}
        title={`${confirmStatusTarget?.nextActive ? 'Activate' : 'Deactivate'} Student Account?`}
        description={
          confirmStatusTarget?.nextActive
            ? `${confirmStatusTarget?.student.user?.name} will be able to log in to the portal again.`
            : `${confirmStatusTarget?.student.user?.name} will be blocked from logging in. Attendance records are kept.`
        }
        confirmLabel={confirmStatusTarget?.nextActive ? 'Activate' : 'Deactivate'}
        danger={!confirmStatusTarget?.nextActive}
        onConfirm={handleToggleStatus}
        onCancel={() => setConfirmStatusTarget(null)}
        loading={statusLoading}
      />

      {/* Permanent Deletion Confirmation */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Permanently Delete Student?"
        description={`Are you sure you want to permanently delete ${deleteTarget?.user?.name || deleteTarget?.studentId}? This action permanently deletes their student account, login credentials, and facial recognition profile. Historical attendance records will remain preserved for institutional auditing.`}
        confirmLabel="Delete Permanently"
        danger={true}
        onConfirm={handlePermanentDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleteLoading}
      />
    </PageContainer>
  )
}
