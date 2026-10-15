import { useEffect, useState } from 'react'
import {
  CalendarDays,
  Clock,
  User,
  RotateCcw,
} from 'lucide-react'
import PageContainer from '../../components/layout/PageContainer'
import SectionHeader from '../../components/common/SectionHeader'
import EmptyState from '../../components/common/EmptyState'
import { inputClass } from '../../components/FormField'
import { useToast } from '../../context/ToastContext'
import { getMyTimetable, getTodayTimetable } from '../../services/studentService'
import { normalizeDepartment } from '../../utils/department'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default function StudentTimetable() {
  const toast = useToast()

  const [timetableData, setTimetableData] = useState(null)
  const [todayData, setTodayData] = useState(null)
  const [loading, setLoading] = useState(true)

  // Filters
  const [filters, setFilters] = useState({
    dayOfWeek: '',
    subject: '',
  })

  // Load today's schedule on mount
  useEffect(() => {
    getTodayTimetable()
      .then(setTodayData)
      .catch(() => {})
  }, [])

  // Fetch timetable when filters change
  const fetchTimetable = () => {
    setLoading(true)
    getMyTimetable(filters)
      .then((res) => {
        setTimetableData(res)
      })
      .catch((err) => {
        toast.error(err.response?.data?.message || 'Failed to load your timetable')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchTimetable()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.dayOfWeek, filters.subject])

  const resetFilters = () => {
    setFilters({
      dayOfWeek: '',
      subject: '',
    })
  }

  const weeklyGrid = timetableData?.weeklyGrid || {}
  const filterOptions = timetableData?.filterOptions || { days: DAYS, subjects: [] }
  const totalClasses = timetableData?.items?.length || 0

  return (
    <PageContainer>
      <SectionHeader
        title="Class Timetable"
        subtitle="Your scheduled periods and faculty timetable."
      />

      {/* TODAY'S SCHEDULE & ACTIVE CLASS HIGHLIGHT */}
      {todayData && (
        <div className="rounded-[24px] border border-line/90 bg-white p-6 sm:p-7 shadow-card mt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3.5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#1E6552] to-[#124235] text-white shadow-2xs">
                <CalendarDays className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold font-display text-ink">
                  Today's Schedule ({todayData.day})
                </h3>
                <p className="text-xs text-muted mt-0.5">
                  Current Time: {todayData.currentTime} • {todayData.totalClasses} classes scheduled
                </p>
              </div>
            </div>

            {/* Current / Next Class Banner */}
            {todayData.currentClass ? (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-50/80 px-4 py-2 text-xs text-emerald-800 shadow-2xs">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                </span>
                <span className="font-extrabold">In Progress:</span>
                <span className="font-bold">{todayData.currentClass.subject?.name}</span>
                <span className="text-emerald-700/80 font-mono text-[11px]">(Period {todayData.currentClass.period})</span>
              </div>
            ) : todayData.nextClass ? (
              <div className="flex items-center gap-2 rounded-xl border border-line/90 bg-[#FAFCFA] px-4 py-2 text-xs text-ink shadow-2xs">
                <Clock className="h-3.5 w-3.5 text-primary" />
                <span className="font-extrabold">Next Up:</span>
                <span className="font-medium">{todayData.nextClass.subject?.name}</span>
                <span className="text-muted font-mono text-[11px]">at {todayData.nextClass.startTime} (Period {todayData.nextClass.period})</span>
              </div>
            ) : (
              <div className="text-xs text-muted font-medium">
                No class currently in progress.
              </div>
            )}
          </div>

          {/* Today's Classes List */}
          {todayData.classes?.length > 0 ? (
            <div className="mt-5 grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
              {todayData.classes.map((c) => {
                const isCurrent = todayData.currentClass?._id === c._id
                return (
                  <div
                    key={c._id}
                    className={`rounded-2xl border p-4 transition-all duration-200 ${
                      isCurrent
                        ? 'border-emerald-500/60 bg-emerald-50/40 shadow-card'
                        : 'border-line/90 bg-[#FAFCFA] hover:bg-white hover:shadow-card'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-extrabold text-ink">
                        Period {c.period}
                      </span>
                      <span className="font-mono text-[11px] text-muted font-semibold">
                        {c.startTime} – {c.endTime}
                      </span>
                    </div>
                    <div className="mt-2 font-bold text-sm text-ink truncate">
                      {c.subject?.name}
                    </div>
                    <div className="mt-1 flex items-center justify-between text-xs text-muted">
                      <span className="truncate">{c.teacher?.name || 'Faculty'}</span>
                      {c.subject?.department && (
                        <span className="font-bold text-[11px] text-primary">
                          {normalizeDepartment(c.subject.department)}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="mt-3 text-xs text-muted">
              No classes scheduled for today. Enjoy your day!
            </p>
          )}
        </div>
      )}

      {/* FILTER BAR */}
      <div className="rounded-[22px] border border-line/90 bg-white p-5 shadow-card mt-6">
        <div className="mb-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-ink">
            <span>Filter Timetable</span>
            <span className="rounded-full bg-sage-50 border border-line px-2.5 py-0.5 text-[11px] font-bold text-primary">
              {totalClasses} {totalClasses === 1 ? 'Class' : 'Classes'} Scheduled
            </span>
          </div>

          <button
            onClick={resetFilters}
            className="flex items-center gap-1 text-xs font-semibold text-muted hover:text-ink transition"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Day Filter */}
          <div>
            <select
              value={filters.dayOfWeek}
              onChange={(e) => setFilters({ ...filters, dayOfWeek: e.target.value })}
              className={`${inputClass} text-xs font-medium`}
            >
              <option value="">All Days (Mon – Sat)</option>
              {DAYS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* Subject Filter */}
          <div>
            <select
              value={filters.subject}
              onChange={(e) => setFilters({ ...filters, subject: e.target.value })}
              className={`${inputClass} text-xs font-medium`}
            >
              <option value="">All Subjects</option>
              {filterOptions.subjects?.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* WEEKLY SCHEDULE GRID */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="flex items-center gap-3 text-muted">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="text-sm font-semibold">Loading timetable…</span>
          </div>
        </div>
      ) : totalClasses === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No timetable entries found"
          description="Try clearing your filters or check back once the semester timetable is published."
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 mt-6">
          {DAYS.map((day) => {
            const dayClasses = weeklyGrid[day] || []
            if (filters.dayOfWeek && filters.dayOfWeek !== day) return null

            return (
              <div
                key={day}
                className="rounded-[22px] border border-line/90 bg-white flex flex-col p-5 shadow-card"
              >
                {/* Day Header */}
                <div className="flex items-center justify-between border-b border-line/80 pb-3">
                  <h4 className="font-bold text-ink font-display">{day}</h4>
                  <span className="rounded-full bg-sage-50 border border-line px-2.5 py-0.5 text-[11px] font-bold text-primary">
                    {dayClasses.length} {dayClasses.length === 1 ? 'Period' : 'Periods'}
                  </span>
                </div>

                {/* Class Slots */}
                <div className="mt-3.5 flex-1 space-y-3">
                  {dayClasses.length === 0 ? (
                    <div className="flex h-32 items-center justify-center rounded-xl bg-[#F8FAF7] text-xs text-muted font-medium">
                      No classes scheduled
                    </div>
                  ) : (
                    dayClasses.map((item) => (
                      <div
                        key={item._id}
                        className="rounded-2xl border border-line/80 bg-[#FAFCFA] p-3.5 transition-all duration-200 hover:bg-white hover:shadow-card hover:-translate-y-0.5"
                      >
                        <div className="flex items-center justify-between text-xs text-muted">
                          <span className="font-bold text-primary">Period {item.period}</span>
                          <span className="font-mono text-[11px] font-semibold">{item.startTime} – {item.endTime}</span>
                        </div>

                        <div className="mt-1.5 font-bold text-sm text-ink truncate font-display">
                          {item.subject?.name}
                        </div>
                        <div className="text-[11px] text-muted font-medium">
                          {item.subject?.code}
                        </div>

                        <div className="mt-2.5 flex items-center justify-between border-t border-line/80 pt-2 text-[11px] text-muted">
                          <div className="flex items-center gap-1.5 truncate">
                            <User className="h-3 w-3 shrink-0 text-muted/70" />
                            <span className="truncate">{item.teacher?.name || 'Faculty'}</span>
                          </div>
                          {item.subject?.department && (
                            <span className="font-bold text-primary">
                              {normalizeDepartment(item.subject.department)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </PageContainer>
  )
}
