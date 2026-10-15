import PageContainer from '../../components/layout/PageContainer'
import SectionHeader from '../../components/common/SectionHeader'
import SearchInput from '../../components/admin/SearchInput'
import DataTable from '../../components/admin/DataTable'
import Pagination from '../../components/admin/Pagination'
import StatusBadge from '../../components/common/StatusBadge'
import { useAdminList } from '../../hooks/useAdminList'
import { getSubjects } from '../../services/teacherService'

export default function Subjects() {
  const list = useAdminList(getSubjects)

  const columns = [
    { key: 'code', header: 'Code' },
    { key: 'name', header: 'Name' },
    { key: 'course', header: 'Course', render: (row) => row.course?.name || '—' },
    { key: 'credits', header: 'Credits' },
    { key: 'semester', header: 'Semester' },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.isActive ? 'Active' : 'Inactive'} /> },
  ]

  return (
    <PageContainer>
      <SectionHeader title="My Subjects" subtitle="Subjects assigned to you." />
      <SearchInput value={list.search} onChange={list.setSearch} placeholder="Search by name or subject code…" />
      <DataTable columns={columns} data={list.items} loading={list.loading} emptyMessage="No subjects are assigned to you yet." />
      <Pagination page={list.pagination.page} totalPages={list.pagination.totalPages} total={list.pagination.total} onPageChange={list.setPage} />
    </PageContainer>
  )
}
