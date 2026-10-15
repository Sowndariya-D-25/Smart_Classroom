import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CheckCircle2,
  XCircle,
  BookOpen,
  CalendarDays,
  AlertTriangle,
  Clock,
  ArrowRight,
  ScanFace,
  Target,
  TrendingUp,
  Info,
  ShieldCheck,
} from 'lucide-react'
import PageContainer from '../../components/layout/PageContainer'
import SectionHeader from '../../components/common/SectionHeader'
import StatCard from '../../components/common/StatCard'
import StatusBadge from '../../components/common/StatusBadge'
import CircularProgress from '../../components/common/CircularProgress'
import EmptyState from '../../components/common/EmptyState'
import { useToast } from '../../context/ToastContext'
import { getStudentDashboardStats } from '../../services/studentService'

export default function StudentDashboard() {
  const toast = useToast()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getStudentDashboardStats()
      .then((res) => {
        setData(res)
      })
      .catch((err) => {
        toast.error(err.response?.data?.message || 'Failed to load dashboard data')
      })
      .finally(() => setLoading(false))
  }, [toast])

  const stats = data?.stats || {}
  const today = data?.today || { classes: [], totalClassesToday: 0 }
  const recentAttendance = data?.recentAttendance || []
  const hasPercentage = stats.overallPercentage !== null && stats.overallPercentage !== undefined
  const isLow = hasPercentage && stats.overallPercentage < (stats.threshold || 75)

  return (
    <PageContainer>
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-line/80 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-primary">
              Student Academic Portal
            </span>
          </div>
          <h1 className="mt-1 text-2xl sm:text-3xl font-black font-display tracking-tight text-ink">
            Attendance &amp; Schedule
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-muted">
            Track your verified biometric attendance, class timetable, and academic standing.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/student/attendance"
            className="btn-primary !px-4.5 !py-2.5 !text-xs !font-bold shadow-sm hover:shadow-md inline-flex items-center gap-1.5"
          >
            <span>Subject Breakdown</span>
            <ArrowRight size={13} />
          </Link>
          <Link
            to="/student/timetable"
            className="btn-secondary !px-4 !py-2.5 !text-xs !font-bold inline-flex items-center gap-1.5"
          >
            <span>Full Timetable</span>
          </Link>
        </div>
      </div>

      {/* Warning banner if low attendance */}
      {!loading && isLow && (
        <div className="flex items-center gap-3.5 rounded-2xl border border-rose-200 bg-rose-50/80 p-4 text-rose-900 shadow-sm animate-in fade-in">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-700">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="text-xs leading-relaxed">
            <span className="font-bold text-rose-800">Academic Policy Alert:</span> Your current overall attendance is{' '}
            <strong className="font-extrabold text-rose-700">
              {stats.overallPercentage}%
            </strong>
            , which is below the institutional requirement of {stats.threshold || 75}%. Please attend upcoming scheduled lectures to prevent shortage warnings.
          </div>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={CheckCircle2}
          title="Overall Attendance"
          value={loading ? '…' : hasPercentage ? `${stats.overallPercentage}%` : 'N/A'}
          description={`Policy Target: ≥${stats.threshold || 75}%`}
          colorScheme={isLow ? 'rose' : 'emerald'}
          trend={hasPercentage && !isLow ? 'On Target' : isLow ? 'Below Target' : undefined}
          trendType={isLow ? 'down' : 'up'}
        />
        <StatCard
          icon={BookOpen}
          title="Classes Attended"
          value={loading ? '…' : (stats.classesAttended ?? 0)}
          description={`Missed: ${stats.classesMissed ?? 0} sessions`}
          colorScheme="emerald"
        />
        <StatCard
          icon={CalendarDays}
          title="Today's Classes"
          value={loading ? '…' : (today.totalClassesToday ?? 0)}
          description={today.day ? `${today.day}'s Timetable` : 'Scheduled today'}
          colorScheme="emerald"
        />
        <StatCard
          icon={AlertTriangle}
          title="At-Risk Subjects"
          value={loading ? '…' : (stats.lowAttendanceSubjectsCount ?? 0)}
          description="Subjects under 75% threshold"
          colorScheme="amber"
          trendType={stats.lowAttendanceSubjectsCount > 0 ? 'down' : 'up'}
        />
      </div>

      {/* Smart Attendance Recovery Planner Section */}
      <div className="card rounded-[22px] p-6 shadow-card bg-white border border-line/90">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-line pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Target className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold font-display text-ink">
                  Smart Attendance Recovery Planner
                </h3>
                <span className="inline-flex items-center gap-1 rounded-md bg-primary-50 px-2 py-0.5 text-[10px] font-bold text-primary border border-primary-200/60">
                  Target: {stats.threshold || 75}%
                </span>
              </div>
              <p className="text-xs text-muted mt-0.5">
                Consecutive upcoming classes you must attend to meet or maintain the required 75% eligibility threshold.
              </p>
            </div>
          </div>
          <Link
            to="/student/attendance"
            className="text-xs font-bold text-primary hover:underline flex items-center gap-1 shrink-0"
          >
            <span>Subject Details</span>
            <ArrowRight size={13} />
          </Link>
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs text-muted animate-pulse">
            Calculating attendance recovery projections…
          </div>
        ) : (data?.recoveryPlanner || stats.recoveryPlanner || []).length === 0 ? (
          <div className="py-8 text-center text-xs text-muted">
            No enrolled subjects available for recovery planning.
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {(data?.recoveryPlanner || stats.recoveryPlanner || []).map((item) => {
              const currentPct = item.currentPercentage
              const hasPct = currentPct !== null && currentPct !== undefined
              const isAtRisk = item.status === 'at_risk'
              const isOnTarget = item.status === 'on_target'
              const isNoClasses = item.status === 'no_classes'

              const projectedTotal = (item.totalSessions || 0) + (item.classesToAttendConsecutively || 0)
              const projectedAttended = (item.classesAttended || 0) + (item.classesToAttendConsecutively || 0)
              const projectedPct = projectedTotal > 0 ? Math.round((projectedAttended / projectedTotal) * 100) : 75

              return (
                <div
                  key={item.subject?._id || item.subject?.code}
                  className={`rounded-2xl border p-4.5 flex flex-col justify-between transition-all duration-200 hover:shadow-card-hover ${
                    isAtRisk
                      ? 'border-rose-200/90 bg-gradient-to-b from-rose-50/40 to-white'
                      : isOnTarget
                        ? 'border-emerald-200/90 bg-gradient-to-b from-emerald-50/30 to-white'
                        : 'border-line/80 bg-white'
                  }`}
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-ink text-sm truncate" title={item.subject?.name}>
                          {item.subject?.name}
                        </p>
                        <p className="font-mono text-[11px] text-muted uppercase mt-0.5">
                          {item.subject?.code}
                        </p>
                      </div>
                      {isAtRisk && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-100/80 px-2.5 py-0.5 text-[10px] font-extrabold text-rose-800 border border-rose-200 shrink-0">
                          <AlertTriangle size={11} /> Below 75%
                        </span>
                      )}
                      {isOnTarget && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100/80 px-2.5 py-0.5 text-[10px] font-extrabold text-emerald-800 border border-emerald-200 shrink-0">
                          <ShieldCheck size={11} /> Target Met
                        </span>
                      )}
                      {isNoClasses && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-600 border border-slate-200 shrink-0">
                          <Info size={11} /> Pending
                        </span>
                      )}
                    </div>

                    {/* Stats Grid */}
                    <div className="mt-3.5 grid grid-cols-3 gap-2 rounded-xl bg-canvas/70 p-2.5 text-center border border-line/60">
                      <div>
                        <p className="text-[10px] font-bold text-muted uppercase">Attended</p>
                        <p className="text-xs font-black text-ink mt-0.5">
                          {item.classesAttended} / {item.totalSessions}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-muted uppercase">Current</p>
                        <p
                          className={`text-xs font-black mt-0.5 ${
                            isAtRisk ? 'text-rose-700' : isOnTarget ? 'text-emerald-700' : 'text-ink'
                          }`}
                        >
                          {hasPct ? `${currentPct}%` : '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-muted uppercase">Required</p>
                        <p className="text-xs font-black text-ink mt-0.5">
                          {item.requiredPercentage || 75}%
                        </p>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-3">
                      <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-100 border border-line/40">
                        <div
                          className={`h-full transition-all duration-500 ${
                            isAtRisk
                              ? 'bg-gradient-to-r from-rose-500 to-amber-500'
                              : isOnTarget
                                ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                                : 'bg-slate-300'
                          }`}
                          style={{ width: `${Math.min(100, Math.max(0, currentPct || 0))}%` }}
                        />
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[10px] text-muted">
                        <span>0%</span>
                        <span className="font-semibold text-primary">75% Target</span>
                        <span>100%</span>
                      </div>
                    </div>
                  </div>

                  {/* Recovery Outcome Alert */}
                  <div className="mt-4 pt-3 border-t border-line/60">
                    {isAtRisk ? (
                      <div className="rounded-xl border border-rose-200/90 bg-rose-50/80 p-2.5">
                        <div className="flex items-center gap-1.5 text-rose-900">
                          <TrendingUp className="h-4 w-4 text-rose-600 shrink-0" />
                          <span className="text-xs font-extrabold">
                            Classes to attend consecutively:{' '}
                            <span className="text-sm underline decoration-rose-400 font-black">
                              {item.classesToAttendConsecutively}
                            </span>
                          </span>
                        </div>
                        <p className="text-[11px] text-rose-700 mt-1 leading-snug">
                          Attending next {item.classesToAttendConsecutively} eligible session{item.classesToAttendConsecutively === 1 ? '' : 's'} without absence brings projected standing to {projectedAttended}/{projectedTotal} ({projectedPct}%).
                        </p>
                      </div>
                    ) : isOnTarget ? (
                      <div className="rounded-xl border border-emerald-200/90 bg-emerald-50/80 p-2.5">
                        <div className="flex items-center gap-1.5 text-emerald-900">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                          <span className="text-xs font-extrabold">
                            You currently meet the 75% target
                          </span>
                        </div>
                        <p className="text-[11px] text-emerald-700 mt-1 leading-snug">
                          Maintain your current attendance consistency to stay eligible for exams.
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                        <div className="flex items-center gap-1.5 text-slate-700">
                          <Info className="h-4 w-4 text-slate-500 shrink-0" />
                          <span className="text-xs font-bold">Attendance not available yet</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                          No classes conducted yet. Recovery tracker will activate once sessions begin.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Main Grid: Circular Progress & Today's Schedule */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-stretch">
        {/* Attendance Gauge Card (4 cols) */}
        <div className="lg:col-span-4 card rounded-[22px] p-6 shadow-card flex flex-col items-center justify-between text-center">
          <div className="w-full">
            <h3 className="text-base font-bold font-display text-ink">
              Verified Attendance
            </h3>
            <p className="text-xs text-muted mt-0.5">Automated biometric rate</p>
          </div>

          <div className="my-6">
            <CircularProgress
              percentage={stats.overallPercentage || 0}
              size={140}
              label={hasPercentage ? 'Verified' : 'Pending'}
            />
          </div>

          <div className="w-full border-t border-line pt-4">
            <p className="text-xs text-muted leading-relaxed">
              {hasPercentage
                ? `Calculated across ${stats.totalSubjects ?? 0} enrolled academic subjects.`
                : 'No attendance records registered yet.'}
            </p>
            <Link
              to="/student/attendance"
              className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
            >
              <span>View Subject Breakdown</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* Today's Schedule Card (8 cols) */}
        <div className="lg:col-span-8 card rounded-[22px] p-6 shadow-card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h3 className="text-base font-bold font-display text-ink">
                  Today's Periods ({today.day || 'Today'})
                </h3>
                <p className="text-xs text-muted">Lectures and labs scheduled for your batch</p>
              </div>
              <Link
                to="/student/timetable"
                className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
              >
                <span>View Full Week</span>
                <ArrowRight size={13} />
              </Link>
            </div>

            {today.classes?.length === 0 ? (
              <div className="py-10">
                <EmptyState
                  icon={CalendarDays}
                  title="No classes scheduled today"
                  description="Enjoy your day off or review upcoming assignments."
                />
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {today.classes.map((slot) => (
                  <div
                    key={slot._id}
                    className="flex items-center justify-between rounded-xl border border-line bg-[#F8FAF7] p-3.5 text-xs transition hover:bg-sage-50/50"
                  >
                    <div>
                      <p className="font-bold text-ink text-sm">
                        {slot.subject}
                      </p>
                      <p className="text-xs text-muted mt-0.5">
                        Period {slot.period}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-1.5 font-mono text-xs font-bold text-ink shadow-2xs">
                      <Clock className="h-3.5 w-3.5 text-muted" />
                      <span>{slot.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Attendance Log Card */}
      <div className="card rounded-[22px] p-6 shadow-card">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div>
            <h3 className="text-base font-bold font-display text-ink">
              Recent Attendance Marks
            </h3>
            <p className="text-xs text-muted">Latest verified session marks</p>
          </div>
          <Link
            to="/student/attendance/history"
            className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
          >
            <span>Full History</span>
            <ArrowRight size={13} />
          </Link>
        </div>

        {recentAttendance.length === 0 ? (
          <div className="py-10">
            <EmptyState
              icon={CheckCircle2}
              title="No attendance marks yet"
              description="Your attendance will appear here once teachers conduct and complete sessions."
            />
          </div>
        ) : (
          <div className="mt-4 overflow-hidden rounded-[20px] border border-line/90 shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-line/80 bg-gradient-to-r from-[#F5F8F6] to-[#F8FAF8] text-muted font-bold text-[11px] uppercase tracking-wider">
                    <th className="px-5 py-3.5">Date</th>
                    <th className="px-5 py-3.5">Subject</th>
                    <th className="px-5 py-3.5">Period</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5">Verification Method</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/70">
                  {recentAttendance.map((item) => (
                    <tr key={item._id} className="transition-colors hover:bg-[#F4F8F5]/80">
                      <td className="px-5 py-3.5 font-semibold text-ink">
                        {item.date}
                      </td>
                      <td className="px-5 py-3.5 font-bold text-ink">
                        {item.subject}
                      </td>
                      <td className="px-5 py-3.5 text-muted">Period {item.period ?? '—'}</td>
                      <td className="px-5 py-3.5">
                        <StatusBadge status={item.status} />
                      </td>
                      <td className="px-5 py-3.5 text-muted">
                        {item.method === 'Face Recognition' ? (
                          <span className="inline-flex items-center gap-1.5 font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200/80 shadow-2xs">
                            <ScanFace className="h-3.5 w-3.5 text-emerald-600" />
                            Face Recognition
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-muted font-medium">
                            Manual entry
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  )
}
