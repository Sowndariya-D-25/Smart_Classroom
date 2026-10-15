import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ClipboardCheck } from 'lucide-react'
import PageContainer from '../../components/layout/PageContainer'
import SectionHeader from '../../components/common/SectionHeader'
import DataTable from '../../components/admin/DataTable'
import StatusBadge from '../../components/common/StatusBadge'
import EmptyState from '../../components/common/EmptyState'
import { useToast } from '../../context/ToastContext'
import { getMyAttendanceSummary } from '../../services/studentService'

export default function Attendance() {
  const toast = useToast()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getMyAttendanceSummary()
      .then(setData)
      .catch((err) => toast.error(err.response?.data?.message || 'Unable to load attendance. Please try again.'))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const columns = [
    { key: 'code', header: 'Subject', render: (row) => `${row.subject.name} (${row.subject.code})` },
    { key: 'total', header: 'Total Sessions', render: (row) => row.totalSessions },
    { key: 'attended', header: 'Attended', render: (row) => row.attended },
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
      <SectionHeader title="My Attendance" subtitle="Your attendance percentage in each subject." />

      {!loading && data && data.subjects.length > 0 && (
        <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/70 p-4 text-xs text-emerald-950 my-4 shadow-2xs flex items-center gap-2.5">
          <div className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
          <div>
            Subjects below <span className="font-extrabold text-emerald-900">{data.threshold}%</span> are flagged as{' '}
            <StatusBadge status="Low Attendance" />. Both Present and Late statuses count toward academic attendance compliance.
          </div>
        </div>
      )}

      {!loading && data?.subjects.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="No subjects yet" description="Your attendance will appear here once you're enrolled in subjects." />
      ) : (
        <DataTable columns={columns} data={data?.subjects || []} loading={loading} emptyMessage="No attendance data yet." />
      )}

      <div className="pt-2">
        <Link to="/student/attendance/history" className="btn-secondary !px-4 !py-2.5 !text-xs !font-bold inline-flex items-center gap-2">
          <span>View Detailed Attendance History</span>
          <span>&rarr;</span>
        </Link>
      </div>
    </PageContainer>
  )
}

