import { useEffect, useState } from 'react'
import {
  Users,
  CalendarDays,
  Clock,
  TrendingUp,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  AlertTriangle,
  History,
  BookOpen,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts'
import PageContainer from '../../components/layout/PageContainer'
import StatCard from '../../components/common/StatCard'
import StatusBadge from '../../components/common/StatusBadge'
import EmptyState from '../../components/common/EmptyState'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { getDashboardStats, getTodayTimetable } from '../../services/teacherService'

export default function TeacherDashboard() {
  const { user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [today, setToday] = useState(null)
  const [loading, setLoading] = useState(true)
  const [timeframe, setTimeframe] = useState('week') // 'week' | 'month'

  useEffect(() => {
    Promise.all([getDashboardStats(), getTodayTimetable()])
      .then(([statsData, todayData]) => {
        setStats(statsData)
        setToday(todayData)
      })
      .catch((err) => toast.error(err.response?.data?.message || 'Could not load your dashboard.'))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Greeting based on current hour
  const currentHour = new Date().getHours()
  const greetingTime =
    currentHour < 12 ? 'Good morning' : currentHour < 17 ? 'Good afternoon' : 'Good evening'
  const teacherFirstName = user?.name ? user.name.split(' ')[0] : 'Faculty'

  // Dynamic Bar Chart Data backed by MongoDB
  const chartData =
    timeframe === 'week'
      ? stats?.weeklyChart || []
      : stats?.monthlyChart || []

  const hasChartData = chartData.some((item) => item.total > 0)

  // First upcoming or live class from today's timetable
  const firstSlot = today?.items?.[0]
  const avgAttendanceDisplay =
    stats?.averageAttendance !== null && stats?.averageAttendance !== undefined
      ? `${stats.averageAttendance}%`
      : 'N/A'

  const recentSessions = stats?.recentSessions || []
  const attentionStudents = stats?.attentionStudents || []

  return (
    <PageContainer>
      {/* Top Welcome & CTA Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-line/80 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-primary">
              Faculty Dashboard
            </span>
          </div>
          <h1 className="mt-1 text-2xl sm:text-3xl font-black font-display tracking-tight text-ink">
            {greetingTime}, {teacherFirstName}.
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-muted">
            Overview of your assigned classes, live timetable, and student attendance records.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/teacher/attendance/start"
            className="btn-primary !px-4.5 !py-2.5 !text-xs !font-bold shadow-sm hover:shadow-md inline-flex items-center gap-2"
          >
            <CheckCircle2 size={16} strokeWidth={2.2} />
            <span>Take Attendance</span>
          </Link>
          <Link
            to="/teacher/attendance"
            className="btn-secondary !px-4 !py-2.5 !text-xs !font-bold inline-flex items-center gap-1.5"
          >
            <History size={15} />
            <span>Attendance History</span>
          </Link>
        </div>
      </div>

      {/* Row 1: 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Students"
          value={loading ? '…' : (stats?.totalStudents ?? 0)}
          description={`${stats?.subjectsCount ?? 0} assigned subject${stats?.subjectsCount === 1 ? '' : 's'}`}
          colorScheme="emerald"
          icon={Users}
        />
        <StatCard
          title="Today's Sessions"
          value={loading ? '…' : (stats?.todaySessionsCount ?? 0)}
          description={`${stats?.todayClassesCount ?? 0} scheduled classes today`}
          colorScheme="emerald"
          icon={CalendarDays}
        />
        <StatCard
          title="Present Today"
          value={loading ? '…' : (stats?.presentToday ?? 0)}
          description="Students marked present today"
          colorScheme="emerald"
          icon={CheckCircle2}
        />
        <StatCard
          title="Avg. Attendance"
          value={loading ? '…' : avgAttendanceDisplay}
          description={
            stats?.averageAttendance !== null && stats?.averageAttendance !== undefined
              ? 'Based on all conducted sessions'
              : 'No sessions recorded yet'
          }
          colorScheme="amber"
          icon={TrendingUp}
        />
      </div>

      {/* Row 2: Live Class / Schedule Card & Attendance Overview Bar Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Attendance Overview Card */}
        <div className="lg:col-span-7 card rounded-[20px] p-5 shadow-card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold font-display text-ink">Attendance Overview</h2>
                <p className="text-xs text-muted">Real attendance distribution across your classes</p>
              </div>
              {/* Pill Toggle */}
              <div className="flex rounded-xl border border-line bg-[#F8FAF7] p-1 text-xs font-semibold">
                <button
                  onClick={() => setTimeframe('week')}
                  className={`rounded-lg px-2.5 py-1 transition text-xs ${
                    timeframe === 'week' ? 'bg-white text-ink shadow-2xs font-bold' : 'text-muted hover:text-ink'
                  }`}
                >
                  Last 7 Days
                </button>
                <button
                  onClick={() => setTimeframe('month')}
                  className={`rounded-lg px-2.5 py-1 transition text-xs ${
                    timeframe === 'month' ? 'bg-white text-ink shadow-2xs font-bold' : 'text-muted hover:text-ink'
                  }`}
                >
                  Last 4 Weeks
                </button>
              </div>
            </div>

            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold font-display text-ink">{avgAttendanceDisplay}</span>
              <span className="text-xs font-medium text-muted">average attendance rate</span>
            </div>

            {/* Rounded Pill Bar Chart */}
            <div className="mt-4 h-52 w-full">
              {loading ? (
                <div className="flex h-full items-center justify-center text-xs text-muted">
                  Loading attendance records…
                </div>
              ) : hasChartData ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} barSize={20} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#7C9388' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#7C9388' }} domain={[0, 100]} />
                    <Tooltip
                      formatter={(val, name, item) => [
                        `${val}% (${item.payload.total} record${item.payload.total === 1 ? '' : 's'})`,
                        'Attendance Rate',
                      ]}
                      contentStyle={{ borderRadius: '12px', border: '1px solid #E2EAE4', fontSize: '12px' }}
                    />
                    <Bar dataKey="capacity" fill="#DCECE4" radius={[8, 8, 8, 8]} />
                    <Bar dataKey="present" fill="#059669" radius={[8, 8, 8, 8]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full flex-col items-center justify-center text-center p-4 rounded-xl border border-dashed border-line bg-[#F8FAF7]">
                  <TrendingUp className="h-7 w-7 text-muted/60 mb-1.5" />
                  <p className="text-xs font-bold text-ink">No attendance sessions in this timeframe</p>
                  <p className="text-[11px] text-muted mt-0.5">
                    Records will populate as you conduct and finalize attendance sessions.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-3 flex items-center justify-center gap-6 text-xs text-muted font-medium border-t border-line pt-2.5">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#059669]" />
              <span>Attended % (Present + Late)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#DCECE4]" />
              <span>Benchmark (100%)</span>
            </div>
          </div>
        </div>

        {/* Today's Schedule Card */}
        <div className="lg:col-span-5 card rounded-[20px] p-5 shadow-card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h2 className="text-base font-bold font-display text-ink">Today's Schedule</h2>
                <p className="text-xs text-muted">
                  {today?.items?.length ? `${today.items.length} class${today.items.length === 1 ? '' : 'es'} scheduled today` : 'Daily class timetable'}
                </p>
              </div>
              <Link to="/teacher/timetable" className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline">
                <span>View timetable</span>
                <ArrowRight size={13} />
              </Link>
            </div>

            <div className="mt-3 space-y-2.5">
              {loading ? (
                <p className="py-6 text-center text-xs text-muted">Loading schedule…</p>
              ) : today?.items?.length ? (
                today.items.slice(0, 4).map((slot, index) => (
                  <div
                    key={slot._id}
                    className="flex items-center justify-between rounded-xl border border-line bg-[#F8FAF7] p-3 text-xs transition-colors hover:bg-sage-50/50"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex flex-col text-center min-w-[50px] shrink-0">
                        <span className="font-bold font-mono text-ink text-[11px]">{slot.startTime}</span>
                        <span className="text-[10px] text-muted">{slot.endTime}</span>
                      </div>
                      <div className="h-7 w-px bg-line shrink-0" />
                      <div className="min-w-0">
                        <p className="font-bold text-ink truncate text-xs">{slot.subject?.name}</p>
                        <p className="text-[11px] text-muted truncate">
                          {slot.classroom?.name || 'Classroom'} · {slot.subject?.code} {slot.section ? `· Sec ${slot.section}` : ''}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={index === 0 ? 'Live' : 'Upcoming'} />
                  </div>
                ))
              ) : (
                <EmptyState
                  icon={CalendarDays}
                  title="No classes scheduled today"
                  description="You have no lectures assigned for today. You can still initiate attendance anytime."
                />
              )}
            </div>
          </div>

          <div className="mt-3 border-t border-line pt-2.5">
            <Link
              to="/teacher/timetable"
              className="flex w-full items-center justify-center gap-1 text-xs font-bold text-muted hover:text-ink transition"
            >
              <span>Explore complete weekly timetable</span>
              <ChevronRight size={14} />
            </Link>
          </div>
        </div>
      </div>

      {/* Row 3: Recent Attendance Sessions & Students with Low Attendance */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Recent Attendance Sessions Card */}
        <div className="lg:col-span-6 card rounded-[20px] p-5 shadow-card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h2 className="text-base font-bold font-display text-ink">Recent Attendance Sessions</h2>
                <p className="text-xs text-muted">Sessions you have conducted</p>
              </div>
              <Link to="/teacher/attendance" className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline">
                <span>View all</span>
                <ArrowRight size={13} />
              </Link>
            </div>

            <div className="mt-3 divide-y divide-line">
              {loading ? (
                <p className="py-6 text-center text-xs text-muted">Loading recent sessions…</p>
              ) : recentSessions.length > 0 ? (
                recentSessions.map((s) => (
                  <div key={s._id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-700 font-bold text-xs">
                        <BookOpen size={15} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-ink truncate">{s.subjectName || 'Session'}</p>
                        <p className="text-[11px] text-muted truncate">
                          {new Date(s.date).toLocaleDateString()} · Period {s.period} {s.section ? `· Sec ${s.section}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 shrink-0">
                      <span className="text-xs font-semibold text-ink">
                        {s.presentCount} Present
                      </span>
                      <StatusBadge status={s.status} />
                      <Link
                        to={`/teacher/attendance/session/${s._id}`}
                        className="text-xs font-bold text-primary hover:underline"
                      >
                        {s.status === 'Active' ? 'Resume' : 'View'}
                      </Link>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-6">
                  <EmptyState
                    icon={History}
                    title="No recent sessions"
                    description="When you take attendance, recent sessions will appear here."
                  />
                </div>
              )}
            </div>
          </div>

          <div className="mt-3 border-t border-line pt-2.5">
            <Link
              to="/teacher/attendance"
              className="flex w-full items-center justify-center gap-1 text-xs font-bold text-muted hover:text-ink transition"
            >
              <span>Full Attendance History</span>
              <ChevronRight size={14} />
            </Link>
          </div>
        </div>

        {/* Students with Low Attendance Card */}
        <div className="lg:col-span-6 card rounded-[20px] p-5 shadow-card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h2 className="text-base font-bold font-display text-ink">Students Below 75% Attendance</h2>
                <p className="text-xs text-muted">Institutional attendance policy threshold alert</p>
              </div>
              <Link to="/teacher/analytics" className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline">
                <span>View analytics</span>
                <ArrowRight size={13} />
              </Link>
            </div>

            <div className="mt-3 divide-y divide-line">
              {loading ? (
                <p className="py-6 text-center text-xs text-muted">Checking attendance records…</p>
              ) : attentionStudents.length > 0 ? (
                attentionStudents.map((st) => (
                  <div key={st.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-700 font-bold text-xs">
                        {st.initial}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-ink truncate">{st.name}</p>
                        <p className="text-[11px] text-muted truncate">
                          {st.studentId} · {st.course} {st.section ? `(${st.section})` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <span className="rounded-lg bg-rose-50 px-2 py-0.5 text-xs font-extrabold text-rose-700 border border-rose-200/60">
                        {st.attendance}%
                      </span>
                      <Link
                        to={`/teacher/reports`}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-line bg-surface text-muted hover:bg-sage-50 hover:text-ink transition"
                        title="View student report"
                      >
                        <ChevronRight size={14} />
                      </Link>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-6 text-center">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 mb-2 border border-emerald-100">
                    <CheckCircle2 size={18} />
                  </div>
                  <p className="text-xs font-bold text-ink">All students in good standing</p>
                  <p className="text-[11px] text-muted mt-0.5">
                    No students currently fall below the 75% institutional attendance policy.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-3 border-t border-line pt-2.5">
            <Link
              to="/teacher/reports"
              className="flex w-full items-center justify-center gap-1 text-xs font-bold text-muted hover:text-ink transition"
            >
              <span>View full student attendance analytics</span>
              <ChevronRight size={14} />
            </Link>
          </div>
        </div>
      </div>
    </PageContainer>
  )
}
