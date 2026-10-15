import { useEffect, useState } from 'react'
import {
  Building2,
  GraduationCap,
  BookOpen,
  Users,
  Search,
} from 'lucide-react'
import PageContainer from '../../components/layout/PageContainer'
import AdminPageHeader from '../../components/admin/AdminPageHeader'
import DataTable from '../../components/admin/DataTable'
import StatCard from '../../components/common/StatCard'
import StatusBadge from '../../components/common/StatusBadge'
import { inputClass } from '../../components/FormField'
import { useToast } from '../../context/ToastContext'
import { departmentsApi } from '../../services/adminService'

export default function Departments() {
  const toast = useToast()
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    departmentsApi
      .list()
      .then((data) => {
        setDepartments(data.items || [])
      })
      .catch((err) => {
        toast.error(err.response?.data?.message || 'Failed to load department records')
      })
      .finally(() => setLoading(false))
  }, [toast])

  const filtered = departments.filter((d) =>
    d.name.toLowerCase().includes(search.toLowerCase()),
  )

  const totalPrograms = departments.reduce((acc, d) => acc + (d.programCount || 0), 0)
  const totalFaculty = departments.reduce((acc, d) => acc + (d.teacherCount || 0), 0)
  const totalStudents = departments.reduce((acc, d) => acc + (d.studentCount || 0), 0)

  const columns = [
    {
      key: 'name',
      header: 'Department',
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Building2 className="h-4 w-4" />
          </div>
          <span className="font-semibold text-ink">{row.name}</span>
        </div>
      ),
    },
    {
      key: 'programs',
      header: 'Academic Programs',
      render: (row) => `${row.programCount || 0} Programs`,
    },
    {
      key: 'subjects',
      header: 'Subjects',
      render: (row) => `${row.subjectCount || 0} Subjects`,
    },
    {
      key: 'faculty',
      header: 'Faculty Members',
      render: (row) => `${row.teacherCount || 0} Teachers`,
    },
    {
      key: 'students',
      header: 'Enrolled Students',
      render: (row) => `${row.studentCount || 0} Students`,
    },
    {
      key: 'status',
      header: 'Status',
      render: () => <StatusBadge status="Active" />,
    },
  ]

  return (
    <PageContainer>
      <AdminPageHeader
        title="Departments"
        subtitle="Canonical academic department records used across all timetables, attendance, and analytics."
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Building2}
          label="Total Departments"
          value={loading ? '…' : departments.length}
          subtext="Active academic divisions"
        />
        <StatCard
          icon={GraduationCap}
          label="Academic Programs"
          value={loading ? '…' : totalPrograms}
          subtext="Degree curricula"
        />
        <StatCard
          icon={Users}
          label="Faculty Members"
          value={loading ? '…' : totalFaculty}
          subtext="Assigned professors"
        />
        <StatCard
          icon={BookOpen}
          label="Enrolled Students"
          value={loading ? '…' : totalStudents}
          subtext="Registered learners"
        />
      </div>

      <div className="mt-6 space-y-4">
        <div className="flex flex-col gap-3 rounded-[22px] border border-line bg-surface p-4 shadow-card sm:flex-row sm:items-center sm:justify-between">
          <div className="relative min-w-[280px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Search departments…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${inputClass} pl-9 rounded-xl border-line bg-background text-ink`}
            />
          </div>
          <div className="text-xs font-semibold text-muted">
            Showing <span className="text-ink">{filtered.length}</span> departments
          </div>
        </div>

        <DataTable
          columns={columns}
          data={filtered}
          loading={loading}
          emptyMessage="No departments found."
        />
      </div>
    </PageContainer>
  )
}
