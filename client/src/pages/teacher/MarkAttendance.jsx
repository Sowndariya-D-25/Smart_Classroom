import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { CheckCircle2, LoaderCircle, Users, ScanFace } from 'lucide-react'
import PageContainer from '../../components/layout/PageContainer'
import SectionHeader from '../../components/common/SectionHeader'
import EmptyState from '../../components/common/EmptyState'
import AttendanceStatusSelector from '../../components/teacher/AttendanceStatusSelector'
import { useToast } from '../../context/ToastContext'
import { getAttendanceSession, markAttendance, completeSession } from '../../services/teacherService'

const SUMMARY_ITEMS = [
  { key: 'total', label: 'Total' },
  { key: 'present', label: 'Present' },
  { key: 'late', label: 'Late' },
  { key: 'absent', label: 'Absent' },
  { key: 'od', label: 'OD' },
  { key: 'leave', label: 'Leave' },
]

export default function MarkAttendance() {
  const { id } = useParams()
  const toast = useToast()
  const navigate = useNavigate()

  const [data, setData] = useState(null)
  const [statuses, setStatuses] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [completing, setCompleting] = useState(false)

  const load = () => {
    setLoading(true)
    getAttendanceSession(id)
      .then((res) => {
        setData(res)
        const initial = {}
        res.roster.forEach((student) => {
          const existing = res.marksByStudent[student._id]?.status
          const approved = res.approvedByStudent?.[student._id]
          initial[student._id] = existing || (approved ? approved.type : 'Present')
        })
        setStatuses(initial)
      })
      .catch((err) => toast.error(err.response?.data?.message || 'Could not load this attendance session.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async () => {
    setSaving(true)
    try {
      const records = Object.entries(statuses).map(([student, status]) => ({ student, status }))
      const res = await markAttendance(id, records)
      toast.success(res.message || 'Attendance saved successfully.')
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to save attendance.')
    } finally {
      setSaving(false)
    }
  }

  const handleComplete = async () => {
    setCompleting(true)
    try {
      const records = Object.entries(statuses).map(([student, status]) => ({ student, status }))
      await completeSession(id, { records })
      toast.success('Attendance session completed.')
      navigate('/teacher/attendance')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to complete the session.')
    } finally {
      setCompleting(false)
    }
  }

  if (loading) {
    return (
      <PageContainer>
        <p className="text-sm text-muted">Loading attendance…</p>
      </PageContainer>
    )
  }

  if (!data) {
    return (
      <PageContainer>
        <EmptyState title="Session not found" description="This attendance session doesn't exist or doesn't belong to you." />
      </PageContainer>
    )
  }

  const { session, roster, marksByStudent, summary } = data
  const isLocked = session.status === 'Completed' || session.status === 'Cancelled'

  return (
    <PageContainer>
      <SectionHeader
        title={`Manual Attendance — ${session.subject?.name} (${session.subject?.code})`}
        subtitle={`${session.department ? `${session.department} · ` : ''}Section ${session.section || 'A'} · ${new Date(session.date).toLocaleDateString()} · Period ${session.period}${session.startTime ? ` (${session.startTime} - ${session.endTime})` : ''}`}
      />

      {summary && (
        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-7">
          {SUMMARY_ITEMS.map((item) => (
            <div key={item.key} className="card rounded-[20px] p-4 text-center shadow-card border border-line/90 bg-white">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-muted">{item.label}</p>
              <p className="mt-1 text-2xl font-black font-display text-ink">{summary[item.key]}</p>
            </div>
          ))}
          <div className="card rounded-[20px] p-4 text-center shadow-card bg-emerald-50/70 border-emerald-200/80">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-800">Attendance %</p>
            <p className="mt-1 text-2xl font-black font-display text-emerald-700">
              {summary.percentage === null ? '—' : `${summary.percentage}%`}
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2.5 rounded-2xl border border-line/90 bg-white p-3.5 text-xs text-muted font-medium shadow-2xs">
        <Users size={16} className="text-primary" />
        <span>
          <strong className="text-ink font-bold">{roster.length}</strong> student{roster.length === 1 ? '' : 's'} enrolled in this section · Session status:{' '}
          <strong className="text-primary font-bold">{session.status}</strong>
        </span>
      </div>

      {roster.length === 0 ? (
        <EmptyState title="No students found for this class" description="Once students are enrolled in this subject's course, they'll appear here." />
      ) : (
        <div className="overflow-hidden rounded-[22px] border border-line/90 bg-surface shadow-card">
          <ul className="divide-y divide-line/70">
            {roster.map((student) => {
              const mark = marksByStudent[student._id]
              const approvedException = data.approvedByStudent?.[student._id]
              const initial = (student.user?.name || '?').charAt(0).toUpperCase()
              return (
                <li key={student._id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-5 transition-colors hover:bg-[#F4F8F5]/80">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#1E6552] to-[#124235] font-black text-xs text-white shadow-2xs">
                      {initial}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-ink">{student.user?.name}</p>
                      <p className="text-xs text-muted mt-0.5">
                        <span className="font-mono text-ink/80">{student.studentId}</span> · Roll {student.rollNumber}
                        {mark && (
                          <>
                            {' · '}
                            <span className="font-bold text-emerald-700">{mark.method}</span>
                            {mark.method === 'Face Recognition' && mark.confidence != null && ` (${Math.round(mark.confidence * 100)}%)`}
                            {mark.timestamp && ` · ${new Date(mark.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                          </>
                        )}
                      </p>
                      {approvedException && (
                        <div className="mt-1 flex items-center gap-1.5">
                          <span
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold ${
                              approvedException.type === 'OD'
                                ? 'bg-indigo-50 text-indigo-800 border border-indigo-200'
                                : 'bg-purple-50 text-purple-800 border border-purple-200'
                            }`}
                          >
                            Approved {approvedException.type === 'OD' ? 'On-Duty' : 'Leave'}
                            {approvedException.reason ? `: "${approvedException.reason}"` : ''}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 self-end sm:self-auto">
                    <AttendanceStatusSelector
                      value={statuses[student._id]}
                      onChange={(status) => setStatuses((s) => ({ ...s, [student._id]: status }))}
                      approvedException={approvedException}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {!isLocked && roster.length > 0 && (
        <div className="flex flex-wrap gap-3 pt-2">
          <button onClick={handleSave} disabled={saving} className="btn-primary !px-5 !py-2.5 !text-xs !font-bold shadow-sm hover:shadow-md">
            {saving && <LoaderCircle size={16} className="animate-spin" />}
            {saving ? 'Saving…' : 'Save Attendance'}
          </button>
          <Link to={`/teacher/attendance/session/${id}/face`} className="btn-secondary !px-4 !py-2.5 !text-xs !font-bold inline-flex items-center gap-1.5">
            <ScanFace size={16} /> Start Face Recognition
          </Link>
          <button onClick={handleComplete} disabled={completing} className="btn-secondary !px-4 !py-2.5 !text-xs !font-bold inline-flex items-center gap-1.5">
            {completing && <LoaderCircle size={16} className="animate-spin" />}
            <CheckCircle2 size={16} /> Complete Session
          </button>
        </div>
      )}

      {isLocked && (
        <p className="text-sm text-muted">
          This session is {session.status.toLowerCase()} and can no longer be edited.{' '}
          <Link to="/teacher/attendance" className="font-medium text-primary hover:underline">Back to history</Link>
        </p>
      )}
    </PageContainer>
  )
}
