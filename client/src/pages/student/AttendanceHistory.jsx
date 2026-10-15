import PageContainer from '../../components/layout/PageContainer'
import SectionHeader from '../../components/common/SectionHeader'
import DataTable from '../../components/admin/DataTable'
import Pagination from '../../components/admin/Pagination'
import StatusBadge from '../../components/common/StatusBadge'
import { useAdminList } from '../../hooks/useAdminList'
import { getMyAttendanceHistory } from '../../services/studentService'
import { normalizeDepartment } from '../../utils/department'

export default function AttendanceHistory() {
  const list = useAdminList(getMyAttendanceHistory)

  const columns = [
    { key: 'date', header: 'Date', render: (row) => (row.date ? new Date(row.date).toLocaleDateString() : '—') },
    { key: 'period', header: 'Period', render: (row) => (row.period != null ? `Period ${row.period}` : '—') },
    { key: 'department', header: 'Department', render: (row) => normalizeDepartment(row.subject?.department, 'CSE') },
    { key: 'subject', header: 'Subject', render: (row) => row.subject?.name || '—' },
    { key: 'code', header: 'Subject Code', render: (row) => row.subject?.code || '—' },
    { key: 'teacher', header: 'Teacher', render: (row) => row.teacher?.user?.name || '—' },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'method', header: 'Method', render: (row) => row.method || 'Manual' },
    {
      key: 'confidence',
      header: 'Confidence',
      render: (row) => (row.method === 'Face Recognition' && row.confidence != null ? `${Math.round(row.confidence * (row.confidence <= 1 ? 100 : 1))}%` : '—'),
    },
  ]

  return (
    <PageContainer>
      <SectionHeader title="Attendance History" subtitle="Every session you've been marked in." />
      <DataTable columns={columns} data={list.items} loading={list.loading} emptyMessage="No attendance records found." />
      <Pagination page={list.pagination.page} totalPages={list.pagination.totalPages} total={list.pagination.total} onPageChange={list.setPage} />
    </PageContainer>
  )
}
