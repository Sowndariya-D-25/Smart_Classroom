import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import PageContainer from '../../components/layout/PageContainer'
import SectionHeader from '../../components/common/SectionHeader'
import DataTable from '../../components/admin/DataTable'
import EmptyState from '../../components/common/EmptyState'
import StatusBadge from '../../components/common/StatusBadge'
import { BarChart3 } from 'lucide-react'
import { useToast } from '../../context/ToastContext'
import { getClassAttendance } from '../../services/teacherService'

export default function ClassAttendance() {
  const { subjectId } = useParams()
  const toast = useToast()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getClassAttendance(subjectId)
      .then(setData)
      .catch((err) => toast.error(err.response?.data?.message || 'Could not load attendance for this class.'))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectId])

  const columns = [
    { key: 'rollNumber', header: 'Roll No.', render: (row) => row.student.rollNumber },
    { key: 'name', header: 'Name', render: (row) => row.student.name },
    { key: 'present', header: 'Present' },
    { key: 'late', header: 'Late' },
    { key: 'absent', header: 'Absent' },
    {
      key: 'percentage',
      header: 'Attendance %',
      render: (row) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{row.percentage === null ? 'N/A' : `${row.percentage}%`}</span>
          {row.isLow && <StatusBadge status="Low Attendance" />}
        </div>
      ),
    },
  ]

  return (
    <PageContainer>
      <SectionHeader
        title={data ? `Attendance — ${data.subject.name}` : 'Class Attendance'}
        subtitle={
          data
            ? `${data.totalSessions} completed session${data.totalSessions === 1 ? '' : 's'} · Present + Late counts as attended · below ${data.threshold}% is flagged Low Attendance`
            : undefined
        }
      />

      {!loading && data?.totalSessions === 0 && (
        <EmptyState icon={BarChart3} title="No attendance yet" description="Percentages will appear once you've completed at least one attendance session for this subject." />
      )}

      <DataTable columns={columns} data={data?.rows || []} loading={loading} emptyMessage="No students are enrolled in this class yet." />
    </PageContainer>
  )
}
