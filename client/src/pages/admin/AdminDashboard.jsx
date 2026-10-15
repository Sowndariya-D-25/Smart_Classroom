import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  FiUsers,
  FiUserCheck,
  FiBook,
  FiCalendar,
  FiCheckSquare,
  FiAlertTriangle,
  FiActivity,
  FiCheckCircle,
  FiXCircle,
  FiClock,
  FiShield,
  FiArrowRight,
  FiRefreshCw,
  FiTrendingUp,
  FiInfo,
} from 'react-icons/fi'
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
} from 'recharts'
import PageContainer from '../../components/layout/PageContainer'
import StatCard from '../../components/common/StatCard'
import StatusBadge from '../../components/common/StatusBadge'
import EmptyState from '../../components/common/EmptyState'
import { useToast } from '../../context/ToastContext'
import { getDashboardStats } from '../../services/adminService'

const PIE_COLORS = {
  present: '#10B981',
  late: '#F59E0B',
  absent: '#EF4444',
}

const normalizeDepartment = (dept) => {
  if (!dept) return ''
  const trimmed = typeof dept === 'string' ? dept.trim() : String(dept).trim()
  if (/^(computer science|cse|c\.s\.e\.|cse department)$/i.test(trimmed)) {
    return 'CSE'
  }
  return trimmed
}

export default function AdminDashboard() {
  const toast = useToast()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchStats = () => {
    setLoading(true)
    setError(null)
    getDashboardStats()
      .then((data) => {
        setStats(data)
      })
      .catch((err) => {
        const msg = err.response?.data?.message || 'Could not load dashboard statistics.'
        setError(msg)
        toast.error(msg)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchStats()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const todayPercentageDisplay =
    stats?.todayAttendance?.percentage !== null && stats?.todayAttendance?.percentage !== undefined
      ? `${stats.todayAttendance.percentage}%`
      : 'N/A'

  // Exactly 5 summary cards
  const statCards = [
    {
      title: 'Total Students',
      value: stats?.students?.total ?? 0,
      description: `${stats?.students?.active ?? 0} active students`,
      icon: FiUsers,
    },
    {
      title: 'Total Teachers',
      value: stats?.teachers?.total ?? 0,
      description: `${stats?.teachers?.active ?? 0} active teachers`,
      icon: FiUserCheck,
    },
    {
      title: 'Courses',
      value: stats?.courses?.total ?? 0,
      description: `${stats?.courses?.active ?? 0} active academic programs`,
      icon: FiBook,
    },
    {
      title: 'Subjects',
      value: stats?.subjects?.total ?? 0,
      description: `${stats?.subjects?.active ?? 0} active subjects`,
      icon: FiCalendar,
    },
    {
      title: "Today's Attendance",
      value: todayPercentageDisplay,
      description:
        stats?.todayAttendance?.total > 0
          ? `${stats.todayAttendance.total} records marked today`
          : 'No sessions conducted today',
      icon: FiCheckSquare,
    },
  ]

  // Pie chart data for Today's Attendance Overview
  const donutData = [
    { name: 'Present', value: stats?.todayAttendance?.present || 0, color: PIE_COLORS.present },
    { name: 'Late', value: stats?.todayAttendance?.late || 0, color: PIE_COLORS.late },
    { name: 'Absent', value: stats?.todayAttendance?.absent || 0, color: PIE_COLORS.absent },
  ]
  const hasTodayAttendance = (stats?.todayAttendance?.total || 0) > 0

  return (
    <PageContainer>
      {/* Top Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-line/80 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-primary">
              Institutional Administration
            </span>
          </div>
          <h1 className="mt-1 text-2xl sm:text-3xl font-black font-display tracking-tight text-ink">
            Administrative Overview
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-muted">
            Institutional governance, department-level attendance metrics, and compliance tracking.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/admin/attendance"
            className="btn-primary !px-4.5 !py-2.5 !text-xs !font-bold shadow-sm hover:shadow-md inline-flex items-center gap-2"
          >
            <FiCheckSquare size={15} />
            <span>Attendance Records</span>
          </Link>
          <Link
            to="/admin/analytics"
            className="btn-secondary !px-4 !py-2.5 !text-xs !font-bold inline-flex items-center gap-1.5"
          >
            <span>Deep Analytics</span>
            <FiArrowRight size={13} />
          </Link>
        </div>
      </div>

      {/* Error state with retry option */}
      {error && !stats && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/90 p-4 text-xs font-medium text-rose-800 flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={fetchStats}
            className="btn-secondary !py-1.5 !px-3 !text-xs inline-flex items-center gap-1"
          >
            <FiRefreshCw size={12} />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Exactly 5 Summary KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {statCards.map((stat, idx) => (
          <StatCard
            key={stat.title}
            {...stat}
            value={loading ? '—' : stat.value}
            colorScheme={idx === 0 ? 'purple' : idx === 1 ? 'blue' : idx === 2 ? 'amber' : idx === 3 ? 'purple' : 'emerald'}
          />
        ))}
      </div>

      {/* Row 1: Today's Attendance Overview (Donut) & Attendance Trend (Line Chart) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-stretch">
        {/* Today's Attendance Overview (4 cols) */}
        <div className="lg:col-span-4 card rounded-[22px] p-6 shadow-card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold font-display text-ink">
                  Today's Attendance Overview
                </h2>
                <p className="text-xs text-muted">Distribution of marked records today</p>
              </div>
            </div>

            {hasTodayAttendance ? (
              <div className="mt-4 flex flex-col items-center">
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={donutData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={58}
                        outerRadius={84}
                        paddingAngle={5}
                      >
                        {donutData.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ borderRadius: '12px', border: '1px solid #E2EAE4', fontSize: '12px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="mt-2 grid grid-cols-3 w-full border-t border-line pt-4 text-center">
                  <div>
                    <span className="flex items-center justify-center gap-1 text-[11px] text-emerald-700 font-bold uppercase tracking-wider">
                      <FiCheckCircle size={13} /> Present
                    </span>
                    <p className="mt-1 text-base font-black text-ink">
                      {stats?.todayAttendance?.present ?? 0}
                    </p>
                  </div>
                  <div>
                    <span className="flex items-center justify-center gap-1 text-[11px] text-amber-700 font-bold uppercase tracking-wider">
                      <FiClock size={13} /> Late
                    </span>
                    <p className="mt-1 text-base font-black text-ink">
                      {stats?.todayAttendance?.late ?? 0}
                    </p>
                  </div>
                  <div>
                    <span className="flex items-center justify-center gap-1 text-[11px] text-rose-700 font-bold uppercase tracking-wider">
                      <FiXCircle size={13} /> Absent
                    </span>
                    <p className="mt-1 text-base font-black text-ink">
                      {stats?.todayAttendance?.absent ?? 0}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="my-8">
                <EmptyState
                  icon={FiCheckSquare}
                  title="No attendance marked today"
                  description="When faculty conduct attendance sessions today, real-time breakdowns will render here."
                />
              </div>
            )}
          </div>
        </div>

        {/* Attendance Trend Line Chart (8 cols) */}
        <div className="lg:col-span-8 card rounded-[22px] p-6 shadow-card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h2 className="text-base font-bold font-display text-ink">
                  Institutional Attendance Trend
                </h2>
                <p className="text-xs text-muted">Aggregated attendance percentages over the past 7 days</p>
              </div>
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200">
                Last 7 Days
              </span>
            </div>

            {(() => {
              const validPoints = (stats?.trend || []).filter(
                (item) => typeof item.percentage === 'number' && !Number.isNaN(item.percentage)
              )

              if (validPoints.length === 0) {
                return (
                  <div className="my-8">
                    <EmptyState
                      icon={FiTrendingUp}
                      title="No attendance trend data"
                      description="No institutional attendance records found for the past 7 days."
                    />
                  </div>
                )
              }

              return (
                <>
                  {validPoints.length === 1 && (
                    <div className="mt-4 flex items-center gap-2 rounded-xl bg-amber-50/90 border border-amber-200/80 px-3.5 py-2.5 text-xs font-medium text-amber-800">
                      <FiInfo className="shrink-0 text-amber-600" size={15} />
                      <span>
                        Not enough data to display a trend yet. Only 1 day of attendance recorded in this 7-day period (minimum 2 days required).
                      </span>
                    </div>
                  )}

                  <div className="mt-6 h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={stats?.trend || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2EAE4" />
                        <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#7C9388' }} tickLine={false} axisLine={false} />
                        <YAxis
                          domain={[0, 100]}
                          unit="%"
                          tick={{ fontSize: 11, fill: '#7C9388' }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip
                          formatter={(val) =>
                            typeof val === 'number' && !Number.isNaN(val)
                              ? [`${val}%`, 'Attendance']
                              : ['No sessions held', 'Attendance']
                          }
                          contentStyle={{ borderRadius: '12px', border: '1px solid #E2EAE4', fontSize: '12px' }}
                        />
                        <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                        <Line
                          type="monotone"
                          dataKey="percentage"
                          name="Attendance %"
                          stroke="#059669"
                          strokeWidth={3}
                          connectNulls={true}
                          dot={{ r: 4, fill: '#059669', strokeWidth: 2, stroke: '#FFFFFF' }}
                          activeDot={{ r: 6, fill: '#10B981' }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      </div>

      {/* Row 2: Department-wise Attendance (Bar chart) */}
      <div className="card rounded-[22px] p-6 shadow-card">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div>
            <h2 className="text-base font-bold font-display text-ink">
              Department-wise Attendance Breakdown
            </h2>
            <p className="text-xs text-muted">Attendance compliance across institutional academic faculties</p>
          </div>
          <Link to="/admin/analytics" className="text-xs font-bold text-primary hover:underline inline-flex items-center gap-1">
            <span>View Analytics Breakdown</span>
            <FiArrowRight size={12} />
          </Link>
        </div>

        {stats?.departmentWise?.length > 0 ? (
          <div className="mt-6 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={(stats.departmentWise || []).map((d) => ({ ...d, department: normalizeDepartment(d.department) }))}
                barSize={32}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2EAE4" />
                <XAxis dataKey="department" tick={{ fontSize: 11, fill: '#7C9388' }} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 11, fill: '#7C9388' }} tickLine={false} axisLine={false} />
                <Tooltip
                  formatter={(val) => (val !== null ? [`${val}%`, 'Attendance'] : ['N/A', 'Attendance'])}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #E2EAE4', fontSize: '12px' }}
                />
                <Bar dataKey="percentage" name="Attendance %" fill="#059669" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="my-8">
            <EmptyState
              icon={FiBook}
              title="No department records found"
              description="Department metrics will automatically aggregate as faculty mark classroom sessions."
            />
          </div>
        )}
      </div>

      {/* Row 3: Attendance Alerts & Recent Activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Attendance Alerts Card */}
        <div className="card rounded-[22px] p-6 shadow-card">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <div>
              <h2 className="text-base font-bold font-display text-ink">
                Attendance Compliance Alerts
              </h2>
              <p className="text-xs text-muted">Students falling below policy threshold (&lt;75%)</p>
            </div>
            {stats?.alerts?.length > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-bold text-rose-700 border border-rose-200">
                <FiAlertTriangle size={13} /> {stats.alerts.length} Students
              </span>
            )}
          </div>

          <div className="mt-4">
            {stats?.alerts?.length > 0 ? (
              <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-[#F8FAF7]/50">
                {stats.alerts.slice(0, 5).map((student) => (
                  <div key={student._id} className="flex items-center justify-between p-3.5 text-xs transition-colors hover:bg-white">
                    <div>
                      <p className="font-bold text-ink">{student.name}</p>
                      <p className="text-[11px] text-muted">
                        {student.studentId} · {student.department} (Sec {student.section})
                      </p>
                    </div>
                    <div className="text-right">
                      <span
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-black ${
                          student.isCritical
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {student.isCritical && <FiShield size={12} />}
                        {student.percentage}%
                      </span>
                      <p className="mt-0.5 text-[9px] uppercase font-bold tracking-wider text-muted">
                        {student.isCritical ? 'Critical' : 'Low'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-muted">
                <FiCheckCircle className="mx-auto mb-2 h-8 w-8 text-emerald-500" />
                All active students currently satisfy the 75% institutional attendance policy.
              </div>
            )}
          </div>
        </div>

        {/* Recent Institutional Activity Card */}
        <div className="card rounded-[22px] p-6 shadow-card">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <div>
              <h2 className="text-base font-bold font-display text-ink">
                Recent Campus Activity
              </h2>
              <p className="text-xs text-muted">Audit trail of completed sessions and updates</p>
            </div>
            <FiActivity className="h-4 w-4 text-muted" />
          </div>

          <div className="mt-4">
            {stats?.recentActivity?.length > 0 ? (
              <ul className="space-y-2.5">
                {stats.recentActivity.slice(0, 4).map((item) => (
                  <li
                    key={item.id}
                    className="flex items-start justify-between gap-3 rounded-xl border border-line bg-[#F8FAF7] p-3 text-xs transition hover:bg-sage-50/50"
                  >
                    <div>
                      <p className="font-bold text-ink">{item.text}</p>
                      <p className="mt-0.5 text-[10px] text-muted">
                        {item.time
                          ? new Date(item.time).toLocaleString('en-US', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })
                          : 'Recent'}
                      </p>
                    </div>
                    <StatusBadge status={item.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <div className="py-8 text-center text-xs text-muted">
                No recent activity recorded today.
              </div>
            )}
          </div>
        </div>
      </div>
    </PageContainer>
  )
}
