import { useEffect, useState } from 'react'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { BarChart3, ClipboardCheck, AlertTriangle, CheckCircle2 } from 'lucide-react'
import PageContainer from '../../components/layout/PageContainer'
import SectionHeader from '../../components/common/SectionHeader'
import StatCard from '../../components/common/StatCard'
import StatusBadge from '../../components/common/StatusBadge'
import DataTable from '../../components/admin/DataTable'
import EmptyState from '../../components/common/EmptyState'
import { useToast } from '../../context/ToastContext'
import { getAnalyticsOverview } from '../../services/studentService'

const COLORS = { present: '#2F6F5E', late: '#DB9558', absent: '#DC2626' }

export default function Analytics() {
  const toast = useToast()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    getAnalyticsOverview()
      .then(setData)
      .catch((err) => {
        setError(true)
        toast.error(err.response?.data?.message || 'Unable to load attendance. Please try again.')
      })
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading) {
    return (
      <PageContainer>
        <SectionHeader title="Attendance Analytics" subtitle="Loading attendance…" />
      </PageContainer>
    )
  }

  if (error || !data) {
    return (
      <PageContainer>
        <SectionHeader title="Attendance Analytics" />
        <EmptyState icon={AlertTriangle} title="Unable to load attendance" description="Please try again." />
      </PageContainer>
    )
  }

  const { kpis, subjectWise, trend, distribution, threshold } = data
  const hasAnyData = subjectWise.length > 0
  const distributionData = [
    { name: 'Present', value: distribution.present, color: COLORS.present },
    { name: 'Late', value: distribution.late, color: COLORS.late },
    { name: 'Absent', value: distribution.absent, color: COLORS.absent },
  ].filter((d) => d.value > 0)

  const subjectColumns = [
    { key: 'subject', header: 'Subject', render: (row) => `${row.subject.name} (${row.subject.code})` },
    { key: 'present', header: 'Present' },
    { key: 'late', header: 'Late' },
    { key: 'absent', header: 'Absent' },
    { key: 'total', header: 'Total', render: (row) => row.totalSessions },
    {
      key: 'percentage',
      header: 'Attendance %',
      render: (row) => (
        <div className="flex items-center gap-2">
          <span className={`font-bold ${row.isLow ? 'text-rose-600' : 'text-emerald-700'}`}>
            {row.percentage === null ? 'N/A' : `${row.percentage}%`}
          </span>
          {row.isLow && <StatusBadge status="Low Attendance" />}
        </div>
      ),
    },
  ]

  return (
    <PageContainer>
      <SectionHeader title="Attendance Analytics" subtitle="Your attendance insights across subjects." />

      {!hasAnyData ? (
        <EmptyState icon={BarChart3} title="No analytics yet" description="Once your teachers complete attendance sessions, your insights will appear here." />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mt-6">
            <StatCard
              title="Overall Attendance"
              value={kpis.overallPercentage === null ? 'N/A' : `${kpis.overallPercentage}%`}
              icon={BarChart3}
              description={`Below ${threshold}% is flagged low`}
              colorScheme="emerald"
            />
            <StatCard title="Total Sessions" value={kpis.totalSessions} icon={ClipboardCheck} colorScheme="blue" />
            <StatCard title="Attended Classes" value={kpis.presentCount + kpis.lateCount} icon={CheckCircle2} description="Present + Late" colorScheme="purple" />
            <StatCard
              title="Below Threshold"
              value={kpis.subjectsBelowThreshold}
              icon={AlertTriangle}
              description={`Under ${threshold}%`}
              colorScheme="rose"
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2 mt-6">
            <div className="bg-white rounded-2xl border border-line/80 p-6 shadow-xs space-y-2">
              <SectionHeader title="Subject-wise Attendance" />
              <div className="mt-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={subjectWise.map((s) => ({ name: s.subject.code, percentage: s.percentage ?? 0 }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0F4F1" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#4E6151' }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#4E6151' }} unit="%" />
                    <Tooltip formatter={(v) => `${v}%`} contentStyle={{ borderRadius: '12px', border: '1px solid rgba(13,37,31,0.1)' }} />
                    <Bar dataKey="percentage" fill={COLORS.present} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-line/80 p-6 shadow-xs space-y-2">
              <SectionHeader title="Present / Late / Absent" />
              {distributionData.length === 0 ? (
                <EmptyState title="No attendance records yet" />
              ) : (
                <div className="mt-4 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={distributionData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={4}>
                        {distributionData.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid rgba(13,37,31,0.1)' }} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-line/80 p-6 shadow-xs space-y-2 mt-6">
            <SectionHeader title="Attendance Trend" subtitle="Daily attendance % (most recent 30 days with records)" />
            {trend.length === 0 ? (
              <EmptyState title="No trend data yet" />
            ) : (
              <div className="mt-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0F4F1" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#4E6151' }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#4E6151' }} unit="%" />
                    <Tooltip formatter={(v) => `${v}%`} contentStyle={{ borderRadius: '12px', border: '1px solid rgba(13,37,31,0.1)' }} />
                    <Line type="monotone" dataKey="percentage" stroke={COLORS.present} strokeWidth={2.5} dot={{ r: 4, fill: COLORS.present }} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="mt-8 space-y-3">
            <SectionHeader title="Subject Breakdown" />
            <div className="mt-4">
              <DataTable columns={subjectColumns} data={subjectWise} loading={false} />
            </div>
          </div>
        </>
      )}
    </PageContainer>
  )
}
