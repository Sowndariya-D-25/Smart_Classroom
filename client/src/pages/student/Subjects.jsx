import { useEffect, useState } from 'react'
import {
  BookOpen,
  User,
  Building2,
  Calendar,
  Award,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Eye,
  X,
  ScanFace,
} from 'lucide-react'
import PageContainer from '../../components/layout/PageContainer'
import SectionHeader from '../../components/common/SectionHeader'
import EmptyState from '../../components/common/EmptyState'
import { useToast } from '../../context/ToastContext'
import { getMySubjects, getMySubjectDetail } from '../../services/studentService'
import { normalizeDepartment } from '../../utils/department'

export default function StudentSubjects() {
  const toast = useToast()

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  // Subject Detail Modal state
  const [selectedSubjectId, setSelectedSubjectId] = useState(null)
  const [subjectDetail, setSubjectDetail] = useState(null)
  const [modalLoading, setModalLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    getMySubjects()
      .then((res) => {
        setData(res)
      })
      .catch((err) => {
        toast.error(err.response?.data?.message || 'Failed to load your enrolled subjects')
      })
      .finally(() => setLoading(false))
  }, [toast])

  const handleOpenDetail = (subjectId) => {
    setSelectedSubjectId(subjectId)
    setModalLoading(true)
    getMySubjectDetail(subjectId)
      .then((res) => {
        setSubjectDetail(res)
      })
      .catch((err) => {
        toast.error(err.response?.data?.message || 'Failed to load subject details')
        setSelectedSubjectId(null)
      })
      .finally(() => setModalLoading(false))
  }

  const handleCloseModal = () => {
    setSelectedSubjectId(null)
    setSubjectDetail(null)
  }

  const subjects = data?.subjects || []
  const threshold = data?.threshold ?? 75

  return (
    <PageContainer>
      <SectionHeader
        title="My Subjects"
        subtitle="View your enrolled subjects and attendance information."
      />

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="flex items-center gap-3 text-muted">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="text-sm font-medium">Loading your subjects…</span>
          </div>
        </div>
      ) : subjects.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No subjects found"
          description="You are currently not enrolled in any subjects for this term."
        />
      ) : (
        <div className="space-y-6 mt-6">
          {/* Policy Info banner */}
          <div className="bg-white/95 rounded-2xl border border-line/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 shadow-xs backdrop-blur-sm">
            <div className="flex items-center gap-2.5 text-xs text-muted">
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-primary/10 text-primary border border-primary/20">
                Attendance Policy
              </span>
              <span>
                Minimum required attendance is <strong className="text-ink font-bold">{threshold}%</strong>.
                Subjects below {threshold}% are flagged with a low attendance notice.
              </span>
            </div>
            <span className="self-start sm:self-auto rounded-full bg-canvas border border-line px-3.5 py-1 text-xs font-bold text-ink">
              {subjects.length} Enrolled {subjects.length === 1 ? 'Subject' : 'Subjects'}
            </span>
          </div>

          {/* Subject Cards Grid */}
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {subjects.map((subj) => {
              const isLow = subj.isLow
              const hasPercentage = subj.percentage !== null

              return (
                <div
                  key={subj._id}
                  className={`bg-white rounded-2xl border p-6 flex flex-col justify-between shadow-xs hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden ${
                    isLow ? 'border-rose-200/90' : 'border-line/80'
                  }`}
                >
                  <div
                    className={`absolute top-0 left-0 right-0 h-1 ${
                      isLow
                        ? 'bg-gradient-to-r from-rose-500 to-amber-500'
                        : 'bg-gradient-to-r from-emerald-500 to-teal-400'
                    }`}
                  />
                  <div>
                    {/* Header: Code & Status */}
                    <div className="flex items-start justify-between gap-2 pt-1">
                      <span className="rounded-lg bg-primary/10 px-3 py-1 font-mono text-xs font-bold text-primary border border-primary/15">
                        {subj.code}
                      </span>
                      {hasPercentage ? (
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                            isLow
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          }`}
                        >
                          {isLow ? (
                            <AlertTriangle className="h-3 w-3" />
                          ) : (
                            <CheckCircle2 className="h-3 w-3" />
                          )}
                          {subj.status}
                        </span>
                      ) : (
                        <span className="rounded-full bg-canvas px-2.5 py-0.5 text-xs font-semibold text-muted border border-line">
                          No Classes Held
                        </span>
                      )}
                    </div>

                    {/* Subject Title */}
                    <h3 className="mt-3.5 text-base font-extrabold text-ink font-display tracking-tight">
                      {subj.name}
                    </h3>

                    {/* Meta details: Teacher, Department, Credits */}
                    <div className="mt-4 space-y-2 text-xs text-muted">
                      <div className="flex items-center gap-2">
                        <User className="h-3.5 w-3.5 text-primary/70 shrink-0" />
                        <span className="truncate">
                          Faculty:{' '}
                          <strong className="text-ink font-semibold">
                            {subj.primaryTeacher?.name || 'Assigned Faculty'}
                          </strong>
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Building2 className="h-3.5 w-3.5 text-primary/70 shrink-0" />
                        <span className="truncate">
                          {normalizeDepartment(subj.department)} • Sec {subj.section || 'A'}
                          {subj.semester ? ` • Sem ${subj.semester}` : ''}
                        </span>
                      </div>

                      {subj.credits !== undefined && (
                        <div className="flex items-center gap-2">
                          <Award className="h-3.5 w-3.5 text-primary/70 shrink-0" />
                          <span>{subj.credits} Credits</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Attendance Progress & Action */}
                  <div className="mt-6 border-t border-line/70 pt-4">
                    <div className="mb-2 flex items-center justify-between text-xs">
                      <span className="font-semibold text-muted">Your Attendance</span>
                      <span
                        className={`text-sm font-extrabold font-display ${
                          isLow ? 'text-rose-600' : 'text-primary'
                        }`}
                      >
                        {hasPercentage ? `${subj.percentage}%` : 'N/A'}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-2 w-full overflow-hidden rounded-full bg-canvas border border-line">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          isLow
                            ? 'bg-gradient-to-r from-rose-500 to-amber-500'
                            : 'bg-gradient-to-r from-emerald-500 to-teal-400'
                        }`}
                        style={{ width: `${Math.min(subj.percentage || 0, 100)}%` }}
                      />
                    </div>

                    <div className="mt-2.5 flex items-center justify-between text-[11px] text-muted">
                      <span>
                        Attended: <strong className="text-ink">{subj.attended}</strong> / {subj.totalConducted} classes
                      </span>
                      <span>Missed: {subj.absent}</span>
                    </div>

                    <button
                      onClick={() => handleOpenDetail(subj._id)}
                      className="btn-secondary mt-4 flex w-full items-center justify-center gap-1.5 py-2.5 text-xs font-semibold"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      View Subject Details & History
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Subject Detail & Recent Attendance Modal */}
      {selectedSubjectId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4 backdrop-blur-sm animate-fade-in">
          <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-3xl border border-line bg-white shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-line px-7 py-5 bg-canvas/40">
              <div>
                <h3 className="text-lg font-extrabold text-ink font-display">
                  {subjectDetail?.subject?.name || 'Subject Details'}
                </h3>
                <p className="text-xs text-muted mt-0.5">
                  Code: {subjectDetail?.subject?.code} • {normalizeDepartment(subjectDetail?.subject?.department)} • {subjectDetail?.subject?.credits} Credits
                </p>
              </div>
              <button
                onClick={handleCloseModal}
                className="rounded-xl p-2 text-muted hover:bg-canvas hover:text-ink transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            {modalLoading ? (
              <div className="flex h-64 items-center justify-center">
                <div className="flex items-center gap-3 text-muted">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  <span className="text-sm font-semibold">Loading subject history…</span>
                </div>
              </div>
            ) : subjectDetail ? (
              <div className="flex flex-1 flex-col overflow-y-auto p-7 space-y-6">
                {/* Stats Summary Banner */}
                <div className="grid grid-cols-2 gap-4 rounded-2xl border border-line/80 bg-canvas/60 p-4.5 sm:grid-cols-4">
                  <div className="p-2">
                    <div className="text-[11px] font-semibold text-muted uppercase tracking-wider">Conducted</div>
                    <div className="text-xl font-extrabold text-ink font-display mt-0.5">
                      {subjectDetail.stats.totalConducted}
                    </div>
                  </div>
                  <div className="p-2">
                    <div className="text-[11px] font-semibold text-muted uppercase tracking-wider">Attended</div>
                    <div className="text-xl font-extrabold text-primary font-display mt-0.5">
                      {subjectDetail.stats.attended}
                    </div>
                  </div>
                  <div className="p-2">
                    <div className="text-[11px] font-semibold text-muted uppercase tracking-wider">Absent</div>
                    <div className="text-xl font-extrabold text-rose-600 font-display mt-0.5">
                      {subjectDetail.stats.absent}
                    </div>
                  </div>
                  <div className="p-2">
                    <div className="text-[11px] font-semibold text-muted uppercase tracking-wider">Attendance %</div>
                    <div
                      className={`text-xl font-extrabold font-display mt-0.5 ${
                        subjectDetail.stats.isLow
                          ? 'text-rose-600'
                          : 'text-primary'
                      }`}
                    >
                      {subjectDetail.stats.percentage !== null
                        ? `${subjectDetail.stats.percentage}%`
                        : 'N/A'}
                    </div>
                  </div>
                </div>

                {/* Faculty In-Charge */}
                {subjectDetail.subject.teachers?.length > 0 && (
                  <div className="rounded-2xl border border-line/80 bg-white p-4">
                    <span className="text-xs font-bold text-ink">Faculty In-Charge:</span>
                    <div className="mt-1.5 flex flex-wrap gap-3">
                      {subjectDetail.subject.teachers.map((t) => (
                        <div key={t._id} className="text-xs">
                          <span className="font-bold text-ink">
                            {t.user?.name || t.employeeId}
                          </span>
                          {t.user?.email && (
                            <span className="text-muted"> ({t.user.email})</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent Attendance History Table */}
                <div>
                  <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">
                    Recent Class Attendance History
                  </h4>

                  {subjectDetail.history.length === 0 ? (
                    <EmptyState
                      icon={Calendar}
                      title="No class records yet"
                      description="No attendance sessions have been logged for this subject yet."
                    />
                  ) : (
                    <div className="overflow-hidden rounded-2xl border border-line">
                      <table className="w-full border-collapse text-left text-xs">
                        <thead>
                          <tr className="border-b border-line bg-canvas text-muted font-bold">
                            <th className="px-4 py-3">Date</th>
                            <th className="px-4 py-3">Period</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3">Method</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-line/60">
                          {subjectDetail.history.map((h) => (
                            <tr key={h._id} className="hover:bg-canvas/60 transition-colors">
                              <td className="px-4 py-3 font-semibold text-ink">
                                {h.date ? new Date(h.date).toLocaleDateString() : '—'}
                              </td>
                              <td className="px-4 py-3 text-muted font-medium">
                                Period {h.period ?? '—'}
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                                    h.status === 'Present' || h.status === 'Late'
                                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                                  }`}
                                >
                                  {h.status === 'Present' ? (
                                    <CheckCircle2 className="h-3 w-3" />
                                  ) : (
                                    <XCircle className="h-3 w-3" />
                                  )}
                                  {h.status}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-muted font-medium">
                                {h.method === 'Face Recognition' ? (
                                  <span className="inline-flex items-center gap-1 font-semibold text-primary">
                                    <ScanFace className="h-3.5 w-3.5" />
                                    AI Vision
                                    {h.confidence && ` (${h.confidence}%)`}
                                  </span>
                                ) : (
                                  'Manual'
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {/* Modal Footer */}
            <div className="flex justify-end border-t border-line px-7 py-4 bg-canvas/30">
              <button
                onClick={handleCloseModal}
                className="btn-secondary px-5 py-2 text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  )
}
