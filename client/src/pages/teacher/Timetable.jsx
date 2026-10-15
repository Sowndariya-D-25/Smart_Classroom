import { useEffect, useState } from 'react'
import { CalendarDays } from 'lucide-react'
import PageContainer from '../../components/layout/PageContainer'
import SectionHeader from '../../components/common/SectionHeader'
import EmptyState from '../../components/common/EmptyState'
import { useToast } from '../../context/ToastContext'
import { getTimetable } from '../../services/teacherService'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default function Timetable() {
  const toast = useToast()
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getTimetable()
      .then((data) => setEntries(data.items))
      .catch((err) => toast.error(err.response?.data?.message || 'Could not load your timetable.'))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const byDay = DAYS.map((day) => ({
    day,
    slots: entries.filter((e) => e.dayOfWeek === day).sort((a, b) => a.startTime.localeCompare(b.startTime)),
  }))

  return (
    <PageContainer>
      <SectionHeader title="My Timetable" subtitle="Your weekly class schedule." />

      {loading && <p className="text-sm text-muted">Loading…</p>}

      {!loading && entries.length === 0 && (
        <EmptyState icon={CalendarDays} title="No timetable entries yet" description="Once an admin schedules your classes, they'll appear here." />
      )}

      {!loading && entries.length > 0 && (
        <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3 mt-6">
          {byDay.map(({ day, slots }) => (
            <div
              key={day}
              className="bg-white rounded-2xl border border-line/80 p-5 shadow-xs hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-300 space-y-3.5 relative overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-line pb-3">
                <h3 className="text-base font-extrabold text-ink font-display">{day}</h3>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-canvas text-ink border border-line">
                  {slots.length} {slots.length === 1 ? 'class' : 'classes'}
                </span>
              </div>
              {slots.length === 0 ? (
                <p className="py-8 text-center text-xs text-muted font-medium">No classes scheduled</p>
              ) : (
                <ul className="divide-y divide-line/60">
                  {slots.map((slot) => (
                    <li key={slot._id} className="py-3 flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-sm text-ink">{slot.subject?.name}</p>
                        <p className="text-xs text-muted mt-0.5 font-medium">
                          {slot.subject?.code || 'Standard Period'}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs font-bold px-2.5 py-1 rounded-lg bg-primary/10 text-primary border border-primary/20 font-mono">
                        {slot.startTime} – {slot.endTime}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </PageContainer>
  )
}
