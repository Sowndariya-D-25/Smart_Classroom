import { useEffect, useState } from 'react'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { BarChart3, Users, ClipboardCheck, AlertTriangle } from 'lucide-react'
import PageContainer from '../../components/layout/PageContainer'
import SectionHeader from '../../components/common/SectionHeader'
import StatCard from '../../components/common/StatCard'
import StatusBadge from '../../components/common/StatusBadge'
import DataTable from '../../components/admin/DataTable'
import EmptyState from '../../components/common/EmptyState'
import { inputClass } from '../../components/FormField'
import { useToast } from '../../context/ToastContext'
import { getAnalyticsOverview } from '../../services/teacherService'

// Matches the app's Tailwind color tokens (tailwind.config.js) so charts
// don't introduce a separate palette.
const COLORS = { present: '#2F6F5E', late: '#DB9558', absent: '#DC2626' }

export default function Analytics() {
  const toast = useToast()
  const [subjectId, setSubjectId] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    setLoading(true)
    setError(false)
    getAnalyticsOverview(subjectId ? { subject: subjectId } : undefined)
      .then(setData)
      .catch((err) => {
        setError(true)
        toast.error(err.response?.data?.message || 'Unable to load attendance. Please try again.')
      })
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectId])

  if (loading) {
    return (
      <PageContainer>
        <SectionHeader title="Class Analytics" subtitle="Loading attendance…" />
      </PageContainer>
    )
  }

  if (error || !data) {
    return (
      <PageContainer>
        <SectionHeader title="Class Analytics" />
        <EmptyState icon={AlertTriangle} title="Unable to load attendance" description="Please try again." />
      </PageContainer>
    )
  }

  const { kpis, subjectWise, trend, distribution, lowAttendance, threshold, subjects } = data
  const hasAnyData = subjects.length > 0
  const distributionData = [
    { name: 'Present', value: distribution.present, color: COLORS.present },
    { name: 'Late', value: distribution.late, color: COLORS.late },
    { name: 'Absent', value: distribution.absent, color: COLORS.absent },
  ].filter((d) => d.value > 0)

  const lowColumns = [
    { key: 'name', header: 'Student', render: (row) => row.student.name },
    { key: 'studentId', header: 'Student ID', render: (row) => row.student.studentId },
    { key: 'subject', header: 'Subject', render: (row) => `${row.subject.name} (${row.subject.code})` },
    { key: 'present', header: 'Present' },
    { key: 'late', header: 'Late' },
    { key: 'absent', header: 'Absent' },
    {
      key: 'percentage',
      header: 'Attendance %',
      render: (row) => (
        <div className="flex items-center gap-2">
          <span className="font-bold text-rose-600">{row.percentage}%</span>
          <StatusBadge status="Low Attendance" />
        </div>
      ),
    },
  ]

  return (
    <PageContainer>
      <SectionHeader
        title="Class Analytics"
        subtitle="Attendance insights across your subjects."
        action={
          subjects.length > 0 && (
            <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className={`${inputClass} max-w-xs text-xs font-semibold`}>
              <option value="">All subjects</option>
              {subjects.map((s) => (
                <option key={s._id} value={s._id}>{s.name} ({s.code})</option>
              ))}
            </select>
          )
        }
      />

      {!hasAnyData ? (
        <EmptyState
          icon={BarChart3}
          title="No analytics yet"
          description="Once you're assigned a subject and complete at least one attendance session, insights will appear here."
        />
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
            <StatCard title="Total Sessions" value={kpis.totalSessions} icon={ClipboardCheck} description="Completed" colorScheme="blue" />
            <StatCard title="Total Students" value={kpis.totalStudents} icon={Users} colorScheme="purple" />
            <StatCard
              title="Below Threshold"
              value={kpis.studentsBelowThreshold}
              icon={AlertTriangle}
              description={`Students under ${threshold}%`}
              colorScheme="rose"
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2 mt-6">
            <div className="bg-white rounded-2xl border border-line/80 p-6 shadow-xs space-y-2">
              <SectionHeader title="Subject-wise Attendance" />
              {subjectWise.length === 0 ? (
                <EmptyState title="No subjects yet" />
              ) : (
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
              )}
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
            <SectionHeader title="Attendance Trend" subtitle="Daily attendance % across your sessions (most recent 30 days with records)" />
            {trend.length === 0 ? (
              <EmptyState title="No trend data yet" description="This fills in once you have attendance recorded across multiple dates." />
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
            <SectionHeader title="Students Below Threshold" subtitle={`Sorted lowest attendance first · below ${threshold}%`} />
            {lowAttendance.length === 0 ? (
              <div className="mt-4">
                <EmptyState title="No students below the threshold" description="Everyone is meeting the minimum attendance requirement." />
              </div>
            ) : (
              <div className="mt-4">
                <DataTable columns={lowColumns} data={lowAttendance} loading={false} />
              </div>
            )}
          </div>
        </>
      )}
    </PageContainer>
  )
}
