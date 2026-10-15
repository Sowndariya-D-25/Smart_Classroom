import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PlayCircle } from 'lucide-react'
import PageContainer from '../../components/layout/PageContainer'
import SectionHeader from '../../components/common/SectionHeader'
import DataTable from '../../components/admin/DataTable'
import Pagination from '../../components/admin/Pagination'
import FilterBar from '../../components/admin/FilterBar'
import StatusBadge from '../../components/common/StatusBadge'
import { useAdminList } from '../../hooks/useAdminList'
import { getAttendanceSessions, getSubjects } from '../../services/teacherService'
import { normalizeDepartment } from '../../utils/department'

export default function AttendanceHistory() {
  const list = useAdminList(getAttendanceSessions, { initialFilters: { subject: '', status: '' } })
  const [subjects, setSubjects] = useState([])

  useEffect(() => {
    getSubjects({ limit: 100, status: 'active' }).then((data) => setSubjects(data.items)).catch(() => {})
  }, [])

  const columns = [
    { key: 'date', header: 'Date', render: (row) => new Date(row.session.date).toLocaleDateString() },
    {
      key: 'department',
      header: 'Department',
      render: (row) =>
        normalizeDepartment(row.session.department || row.session.subject?.department || row.session.subject?.course?.department),
    },
    { key: 'subject', header: 'Subject', render: (row) => row.session.subject?.name },
    { key: 'period', header: 'Period', render: (row) => row.session.period ?? '—' },
    { key: 'marked', header: 'Present / Total', render: (row) => `${row.presentCount ?? row.studentsMarked} / ${row.totalStudents ?? '—'}` },
    { key: 'percentage', header: 'Attendance %', render: (row) => (row.percentage === null ? '—' : `${row.percentage}%`) },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.session.status} /> },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <Link to={`/teacher/attendance/session/${row.session._id}`} className="text-sm font-medium text-primary hover:underline">
          {row.session.status === 'Active' ? 'Continue' : 'View'}
        </Link>
      ),
    },
  ]

  return (
    <PageContainer>
      <SectionHeader
        title="Attendance History"
        subtitle="Sessions you've conducted."
        action={
          <Link to="/teacher/attendance/start" className="btn-primary">
            <PlayCircle size={16} /> Take Attendance
          </Link>
        }
      />

      <FilterBar
        filters={[
          { key: 'subject', label: 'All subjects', options: subjects.map((s) => ({ value: s._id, label: `${s.name} (${s.code})` })) },
          {
            key: 'status',
            label: 'All statuses',
            options: [
              { value: 'Scheduled', label: 'Scheduled' },
              { value: 'Active', label: 'Active' },
              { value: 'Completed', label: 'Completed' },
              { value: 'Cancelled', label: 'Cancelled' },
            ],
          },
        ]}
        values={list.filters}
        onChange={list.updateFilter}
      />

      <DataTable
        columns={columns}
        data={list.items}
        loading={list.loading}
        emptyMessage="No attendance sessions yet. Start one from the button above."
      />
      <Pagination page={list.pagination.page} totalPages={list.pagination.totalPages} total={list.pagination.total} onPageChange={list.setPage} />
    </PageContainer>
  )
}
