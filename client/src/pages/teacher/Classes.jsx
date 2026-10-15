import { Link } from 'react-router-dom'
import PageContainer from '../../components/layout/PageContainer'
import SectionHeader from '../../components/common/SectionHeader'
import SearchInput from '../../components/admin/SearchInput'
import DataTable from '../../components/admin/DataTable'
import Pagination from '../../components/admin/Pagination'
import { useAdminList } from '../../hooks/useAdminList'
import { getClasses } from '../../services/teacherService'
import { normalizeDepartment } from '../../utils/department'

export default function Classes() {
  const list = useAdminList(getClasses)

  const columns = [
    { key: 'name', header: 'Subject', render: (row) => row.subject?.name || '—' },
    { key: 'department', header: 'Department', render: (row) => normalizeDepartment(row.department || row.course?.department || row.subject?.department || row.course?.code) },
    { key: 'section', header: 'Section', render: (row) => row.section || (Array.isArray(row.sections) ? row.sections.join(', ') : 'A') },
    { key: 'students', header: 'Students', render: (row) => row.studentCount },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-2 text-sm">
          <Link
            to={`/teacher/attendance/class/${row.subject._id}`}
            className="font-medium text-primary hover:underline"
          >
            View
          </Link>
          <span className="text-muted">·</span>
          <Link
            to={`/teacher/attendance/start?subject=${row.subject._id}`}
            className="font-medium text-primary hover:underline"
          >
            Attendance
          </Link>
          <span className="text-muted">·</span>
          <Link
            to={`/teacher/classes/${row.subject._id}/faces`}
            className="font-medium text-primary hover:underline"
          >
            Register Faces
          </Link>
        </div>
      ),
    },
  ]

  return (
    <PageContainer>
      <SectionHeader title="My Classes" subtitle="Classes and student rosters assigned to you." />
      <SearchInput value={list.search} onChange={list.setSearch} placeholder="Search by subject or code…" />
      <DataTable
        columns={columns}
        data={list.items}
        loading={list.loading}
        emptyMessage="You don't have any classes yet — once you're assigned a subject, it will appear here."
      />
      <Pagination page={list.pagination.page} totalPages={list.pagination.totalPages} total={list.pagination.total} onPageChange={list.setPage} />
    </PageContainer>
  )
}

