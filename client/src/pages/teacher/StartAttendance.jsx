import { useEffect, useState, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ClipboardCheck,
  ScanFace,
  LoaderCircle,
  Calendar,
  Clock,
  Layers,
  Sparkles,
} from 'lucide-react'
import PageContainer from '../../components/layout/PageContainer'
import SectionHeader from '../../components/common/SectionHeader'
import FormField, { inputClass } from '../../components/FormField'
import { useToast } from '../../context/ToastContext'
import {
  getSubjects,
  createAttendanceSession,
  getReportFilterOptions,
} from '../../services/teacherService'
import { normalizeDepartment } from '../../utils/department'

const todayIso = () => new Date().toISOString().slice(0, 10)

// Helper for default hour strings
const getDefaultTimes = () => {
  const now = new Date()
  const startHour = String(now.getHours()).padStart(2, '0')
  const endHour = String((now.getHours() + 1) % 24).padStart(2, '0')
  return {
    start: `${startHour}:00`,
    end: `${endHour}:00`,
  }
}

export default function StartAttendance() {
  const toast = useToast()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const preselectedSubject = searchParams.get('subject') || ''

  const [subjects, setSubjects] = useState([])
  const [filterData, setFilterData] = useState(null)

  const defaultTimes = getDefaultTimes()
  const [form, setForm] = useState({
    department: '',
    section: '',
    subject: preselectedSubject,
    date: todayIso(),
    period: '1',
    startTime: defaultTimes.start,
    endTime: defaultTimes.end,
  })

  const [submitting, setSubmitting] = useState(false)
  const [createdSession, setCreatedSession] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    Promise.all([
      getSubjects({ limit: 100, status: 'active' }),
      getReportFilterOptions(),
    ])
      .then(([subjectsData, filterOpts]) => {
        const subList = subjectsData?.items || []
        setSubjects(subList)
        setFilterData(filterOpts)

        // Initialize department and section
        const defaultDept = normalizeDepartment(
          subList[0]?.department ||
          subList[0]?.course?.department ||
          filterOpts?.departments?.[0] ||
          'CSE',
          'CSE'
        )
        const defaultSec = filterOpts?.sections?.[0] || 'A'

        setForm((f) => {
          let chosenSub = f.subject
          if (!chosenSub && subList.length > 0) {
            // Find subject matching default department if possible
            const matching = subList.find(
              (s) => normalizeDepartment(s.department, '') === defaultDept || normalizeDepartment(s.course?.department, '') === defaultDept
            )
            chosenSub = matching ? matching._id : subList[0]._id
          }
          return {
            ...f,
            department: f.department ? normalizeDepartment(f.department, 'CSE') : defaultDept,
            section: f.section || defaultSec,
            subject: chosenSub,
          }
        })
      })
      .catch(() => toast.error('Could not load subjects or filter options.'))
  }, [])

  // Derive available departments strictly from database
  const availableDepartments = useMemo(() => {
    const list = new Set()
    subjects.forEach((s) => {
      const d1 = normalizeDepartment(s.department, '')
      if (d1) list.add(d1)
      const d2 = normalizeDepartment(s.course?.department, '')
      if (d2) list.add(d2)
    })
    if (filterData?.departments) {
      filterData.departments.forEach((d) => {
        const d3 = normalizeDepartment(d, '')
        if (d3) list.add(d3)
      })
    }
    return Array.from(list).filter(Boolean).sort()
  }, [subjects, filterData])

  // Derive available sections for the selected department
  const availableSections = useMemo(() => {
    if (filterData?.students?.length && form.department) {
      const normDept = normalizeDepartment(form.department, '')
      const deptMatches = filterData.students.filter(
        (s) => normalizeDepartment(s.department, '') === normDept
      )
      const deptSections = Array.from(new Set(deptMatches.map((s) => s.section).filter(Boolean))).sort()
      if (deptSections.length > 0) return deptSections
    }
    if (filterData?.sections?.length) {
      return filterData.sections
    }
    return ['A', 'B', 'C']
  }, [filterData, form.department])

  // Filter subjects applicable to the selected department
  const availableSubjects = useMemo(() => {
    if (!form.department) return subjects
    const normDept = normalizeDepartment(form.department, '')
    const filtered = subjects.filter((s) => {
      const matchDept = normalizeDepartment(s.department, '') === normDept
      const matchCourseCode = normalizeDepartment(s.course?.code, '') === normDept
      const matchCourseDept = normalizeDepartment(s.course?.department, '') === normDept
      return matchDept || matchCourseCode || matchCourseDept
    })
    return filtered.length > 0 ? filtered : subjects
  }, [subjects, form.department])

  const handleDepartmentChange = (dept) => {
    const norm = normalizeDepartment(dept, '')
    setForm((f) => {
      // Find valid subject in this department
      const matchingSubs = subjects.filter((s) => {
        const matchDept = normalizeDepartment(s.department, '') === norm
        const matchCourseCode = normalizeDepartment(s.course?.code, '') === norm
        const matchCourseDept = normalizeDepartment(s.course?.department, '') === norm
        return matchDept || matchCourseCode || matchCourseDept
      })
      const newSubject = matchingSubs.length > 0 ? matchingSubs[0]._id : f.subject
      return {
        ...f,
        department: norm,
        subject: newSubject,
      }
    })
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((f) => ({ ...f, [name]: value }))
  }

  // Create session and prompt user with Option A (Manual) or Option B (Face Recognition)
  const handleCreateSession = async (preferredMode = null) => {
    if (!form.department) {
      toast.error('Please select a Department.')
      return
    }
    if (!form.section || !form.section.trim()) {
      toast.error('Please select an Academic Section.')
      return
    }
    if (!form.subject) {
      toast.error('Please select a Subject.')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const payload = {
        subject: form.subject,
        department: form.department,
        section: form.section,
        date: form.date,
        period: Number(form.period),
        startTime: form.startTime,
        endTime: form.endTime,
      }
      const res = await createAttendanceSession(payload)
      const session = res.data.session

      toast.success('Attendance session started successfully!')

      if (preferredMode === 'manual') {
        navigate(`/teacher/attendance/session/${session._id}`)
      } else if (preferredMode === 'face') {
        navigate(`/teacher/attendance/session/${session._id}/face`)
      } else {
        // Show choice modal
        setCreatedSession(session)
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Could not start attendance session.')
      toast.error(err.response?.data?.message || 'Could not start attendance session.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PageContainer>
      <SectionHeader
        title="Take Attendance"
        subtitle="Configure the class period details, then choose Manual or Camera Face Recognition attendance."
      />

      <div className="mx-auto max-w-2xl space-y-6 mt-6">
        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50/90 p-4 text-xs font-semibold text-rose-700">
            {error}
          </div>
        )}

        {/* Attendance Setup Form */}
        <div className="rounded-[24px] border border-line/90 bg-white p-7 sm:p-8 shadow-card space-y-6">
          <div className="border-b border-line/80 pb-4">
            <h3 className="text-lg font-extrabold font-display tracking-tight text-ink">Class &amp; Period Details</h3>
            <p className="text-xs text-muted mt-0.5">
              Select the department, section, and subject for this attendance session.
            </p>
          </div>

          {/* 1. Department */}
          <FormField label="Department *" htmlFor="department">
            <select
              id="department"
              name="department"
              required
              value={form.department}
              onChange={(e) => handleDepartmentChange(e.target.value)}
              className={inputClass}
            >
              <option value="">Select a Department…</option>
              {availableDepartments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </FormField>

          {/* 2. Section */}
          <FormField label="Section *" htmlFor="section">
            <select
              id="section"
              name="section"
              required
              value={form.section}
              onChange={handleChange}
              className={inputClass}
            >
              <option value="">Select a Section…</option>
              {availableSections.map((sec) => (
                <option key={sec} value={sec}>
                  Section {sec}
                </option>
              ))}
            </select>
          </FormField>

          {/* 3. Subject */}
          <FormField label="Subject *" htmlFor="subject">
            <select
              id="subject"
              name="subject"
              required
              value={form.subject}
              onChange={handleChange}
              className={inputClass}
            >
              <option value="">Select a Subject…</option>
              {availableSubjects.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </FormField>

          {/* 4. Period & Date */}
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Period Number *" htmlFor="period">
              <select
                id="period"
                name="period"
                required
                value={form.period}
                onChange={handleChange}
                className={inputClass}
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map((p) => (
                  <option key={p} value={p}>
                    Period {p}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Date *" htmlFor="date">
              <input
                id="date"
                name="date"
                type="date"
                required
                value={form.date}
                onChange={handleChange}
                className={inputClass}
              />
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Start Time" htmlFor="startTime">
              <input
                id="startTime"
                name="startTime"
                type="time"
                value={form.startTime}
                onChange={handleChange}
                className={inputClass}
              />
            </FormField>

            <FormField label="End Time" htmlFor="endTime">
              <input
                id="endTime"
                name="endTime"
                type="time"
                value={form.endTime}
                onChange={handleChange}
                className={inputClass}
              />
            </FormField>
          </div>

          {/* 5. Start Attendance Buttons */}
          <div className="pt-2">
            <p className="mb-3 text-[11px] font-extrabold uppercase tracking-wider text-muted">
              Choose Attendance Marking Method:
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => handleCreateSession('manual')}
                disabled={submitting}
                className="group flex flex-col items-start rounded-[22px] border border-line/90 bg-[#FAFCFA] p-5 text-left transition-all duration-300 hover:border-slate-300 hover:bg-white hover:shadow-card-hover hover:-translate-y-1"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-50 to-indigo-100/70 text-indigo-700 border border-indigo-200/60 shadow-[0_0_12px_rgba(99,102,241,0.12)] group-hover:scale-105 transition-transform">
                  <ClipboardCheck size={22} />
                </div>
                <p className="mt-4 text-base font-extrabold font-display text-ink">Option A — Manual</p>
                <p className="mt-1 text-xs text-muted leading-relaxed">
                  View full class roster for Dept &amp; Section. Manually mark each student Present or Absent.
                </p>
                <span className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-primary group-hover:text-primary-700">
                  Start Manual Roster &rarr;
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleCreateSession('face')}
                disabled={submitting}
                className="group relative flex flex-col items-start rounded-[22px] border-2 border-emerald-500/80 bg-emerald-50/30 p-5 text-left transition-all duration-300 hover:border-emerald-600 hover:bg-white hover:shadow-card-hover hover:-translate-y-1"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white group-hover:scale-105 transition-transform shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                  <ScanFace size={22} />
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <p className="text-base font-extrabold font-display text-ink">Option B — AI Recognition</p>
                  <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-800 tracking-wider">
                    AI VISION
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted leading-relaxed">
                  Opens live camera feed. Automatically recognizes registered student faces and marks Present in real time.
                </p>
                <span className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-emerald-700 group-hover:text-emerald-800">
                  Launch Face Camera &rarr;
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Choice Modal (if launched without pre-selected mode) */}
      {createdSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#091D17]/60 p-4 backdrop-blur-md">
          <div className="bg-white rounded-[26px] border border-line/90 max-w-lg w-full space-y-6 p-7 sm:p-8 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 border border-emerald-200/60 text-emerald-700 shadow-xs">
                <Sparkles size={26} />
              </div>
              <h3 className="mt-4 text-xl font-black font-display text-ink">Attendance Session Active!</h3>
              <p className="mt-1 text-xs text-muted">
                {createdSession.subject?.name} · Dept: {createdSession.department || '—'} · Sec {createdSession.section || '—'} · Period {createdSession.period}
              </p>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => navigate(`/teacher/attendance/session/${createdSession._id}/face`)}
                className="flex w-full items-center justify-between rounded-2xl border-2 border-emerald-500 bg-emerald-50/60 p-4 text-left transition-all hover:bg-emerald-50 hover:shadow-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-xs">
                    <ScanFace size={22} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-ink">Start Face Recognition Attendance</p>
                    <p className="text-xs text-muted">Automated camera-based facial recognition</p>
                  </div>
                </div>
                <span className="text-sm font-bold text-emerald-700">&rarr;</span>
              </button>

              <button
                type="button"
                onClick={() => navigate(`/teacher/attendance/session/${createdSession._id}`)}
                className="flex w-full items-center justify-between rounded-2xl border border-line/90 bg-[#FAFCFA] p-4 text-left transition-all hover:bg-white hover:shadow-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-50 to-indigo-100/70 text-indigo-700 border border-indigo-200/60">
                    <ClipboardCheck size={22} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-ink">Start Manual Attendance</p>
                    <p className="text-xs text-muted">Review class roster and mark Present / Absent</p>
                  </div>
                </div>
                <span className="text-sm font-bold text-muted">&rarr;</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  )
}
