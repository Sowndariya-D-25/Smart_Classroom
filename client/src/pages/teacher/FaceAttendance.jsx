import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  CheckCircle2,
  XCircle,
  Video,
  VideoOff,
  ClipboardList,
  ArrowLeft,
  Users,
  AlertTriangle,
  Clock,
  Calendar,
  Layers,
  Sparkles,
  LoaderCircle,
} from 'lucide-react'
import PageContainer from '../../components/layout/PageContainer'
import SectionHeader from '../../components/common/SectionHeader'
import StatusBadge from '../../components/common/StatusBadge'
import FaceCamera from '../../components/vision/FaceCamera'
import FaceRecognitionStatus from '../../components/vision/FaceRecognitionStatus'
import { useToast } from '../../context/ToastContext'
import {
  getAttendanceSession,
  recognizeFace,
  completeSession,
} from '../../services/teacherService'

// Cooldown to prevent spamming the backend when the same face remains in front of camera
const COOLDOWN_MS = 1800

export default function FaceAttendance() {
  const { id } = useParams()
  const toast = useToast()
  const navigate = useNavigate()

  const [sessionData, setSessionData] = useState(null)
  const [loading, setLoading] = useState(true)

  // Camera states
  const [cameraActive, setCameraActive] = useState(true)
  const [cameraStatus, setCameraStatus] = useState('loading-models')

  // Detection states
  const [currentOverlay, setCurrentOverlay] = useState(null) // for canvas overlay in FaceCamera
  const [lastDetection, setLastDetection] = useState(null) // for UI panel
  const [unknownCount, setUnknownCount] = useState(0)

  // Attendance tracking
  const [marksByStudent, setMarksByStudent] = useState({})
  const [recentScans, setRecentScans] = useState([])
  const [rosterView, setRosterView] = useState('recent') // 'recent' | 'roster'

  // Completion modal
  const [showConfirmFinish, setShowConfirmFinish] = useState(false)
  const [finishing, setFinishing] = useState(false)

  const processingRef = useRef(false)
  const cooldownRef = useRef(false)
  const pendingVerificationRef = useRef(null) // { studentId, timestamp, student, confidence }
  const TEMPORAL_WINDOW_MS = 1500

  // Load session & roster
  const loadData = () => {
    getAttendanceSession(id)
      .then((data) => {
        setSessionData(data)
        setMarksByStudent(data.marksByStudent || {})
        setUnknownCount(data.session?.unknownFaces?.length || 0)
      })
      .catch((err) => {
        toast.error(err.response?.data?.message || 'Could not load this attendance session.')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // Handle incoming face descriptor from FaceCamera with two-frame temporal confirmation
  const handleFaceDetected = async (descriptor) => {
    if (processingRef.current || cooldownRef.current || !cameraActive) return
    if (!sessionData?.session || sessionData.session.status === 'Completed') return

    // Expire pending temporal verification if older than TEMPORAL_WINDOW_MS
    if (pendingVerificationRef.current && Date.now() - pendingVerificationRef.current.timestamp > TEMPORAL_WINDOW_MS) {
      pendingVerificationRef.current = null
    }

    const isPendingConfirmation = Boolean(pendingVerificationRef.current)
    const expectedStudentId = pendingVerificationRef.current?.studentId

    processingRef.current = true

    try {
      // Step 1: When no pending verification, verify without committing Attendance (commit: false)
      // Step 2: When pending verification exists, commit Attendance on second confirmation (commit: true)
      const res = await recognizeFace(id, descriptor, { commit: isPendingConfirmation })
      const { matched, alreadyMarked, student, confidence } = res.data

      if (!matched) {
        // Unknown / Unregistered Face or Ambiguous margin failure
        // Temporal rule: Any Unknown resets pending verification buffer
        pendingVerificationRef.current = null

        setCurrentOverlay({ status: 'unknown', student: null })
        setLastDetection({
          status: 'unknown',
          matched: false,
          student: null,
          time: new Date().toLocaleTimeString(),
        })
        setUnknownCount((c) => c + 1)
      } else if (alreadyMarked) {
        // Student already marked present in this session
        pendingVerificationRef.current = null

        setCurrentOverlay({
          status: 'already-marked',
          student,
          confidence,
        })
        setLastDetection({
          status: 'already-marked',
          matched: true,
          student,
          confidence,
          time: new Date().toLocaleTimeString(),
        })

        // Apply cooldown for already marked student
        cooldownRef.current = true
        setTimeout(() => {
          cooldownRef.current = false
        }, COOLDOWN_MS)
      } else if (!isPendingConfirmation) {
        // --- FRAME 1: INITIAL RECOGNITION (VERIFICATION STARTED) ---
        // Do NOT create attendance yet. Store in temporal verification buffer.
        pendingVerificationRef.current = {
          studentId: student._id,
          timestamp: Date.now(),
          student,
          confidence,
        }

        setCurrentOverlay({
          status: 'verifying',
          student,
          confidence,
        })
        setLastDetection({
          status: 'verifying',
          matched: true,
          student,
          confidence,
          time: new Date().toLocaleTimeString(),
        })
        // No cooldown: we need the camera to capture frame 2 immediately (~600ms)
      } else {
        // --- FRAME 2: CONFIRMATION STAGE ---
        if (student._id === expectedStudentId) {
          // Both Frame 1 and Frame 2 identified the SAME student within 1500ms!
          // Identity confirmed! Attendance has now been committed to DB.
          pendingVerificationRef.current = null

          setCurrentOverlay({
            status: 'success',
            student,
            confidence,
          })
          setLastDetection({
            status: 'success',
            matched: true,
            student,
            confidence,
            time: new Date().toLocaleTimeString(),
          })

          // Update local marks
          setMarksByStudent((prev) => ({
            ...prev,
            [student._id]: {
              student: student._id,
              status: 'Present',
              method: 'Face Recognition',
              confidence,
              timestamp: new Date().toISOString(),
            },
          }))

          // Add to recent recognitions
          setRecentScans((prev) => [
            {
              id: student._id,
              name: student.name,
              studentId: student.studentId,
              rollNumber: student.rollNumber,
              confidence: Math.round((confidence || 0.9) * 100),
              timestamp: new Date().toLocaleTimeString(),
            },
            ...prev.filter((p) => p.id !== student._id),
          ])

          toast.success(`✓ Marked Present: ${student.name} (${student.studentId})`)

          // Activate cooldown after successful attendance creation
          cooldownRef.current = true
          setTimeout(() => {
            cooldownRef.current = false
          }, COOLDOWN_MS)
        } else {
          // Identity changed between frames (e.g. Vijay -> Ajith).
          // Reset buffer and restart verification with the new student.
          pendingVerificationRef.current = {
            studentId: student._id,
            timestamp: Date.now(),
            student,
            confidence,
          }

          setCurrentOverlay({
            status: 'verifying',
            student,
            confidence,
          })
          setLastDetection({
            status: 'verifying',
            matched: true,
            student,
            confidence,
            time: new Date().toLocaleTimeString(),
          })
        }
      }
    } catch (err) {
      console.error('Recognition API error:', err)
      pendingVerificationRef.current = null
      setCurrentOverlay(null)
    } finally {
      processingRef.current = false
    }
  }


  // Finalize attendance session
  const handleFinishAttendance = async () => {
    setFinishing(true)
    try {
      const res = await completeSession(id)
      toast.success(res.message || 'Attendance finalized successfully!')
      setCameraActive(false)
      setShowConfirmFinish(false)
      navigate(`/teacher/attendance/session/${id}`)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to finalize attendance session.')
    } finally {
      setFinishing(false)
    }
  }

  if (loading) {
    return (
      <PageContainer>
        <div className="flex h-64 items-center justify-center">
          <LoaderCircle size={32} className="animate-spin text-primary-600" />
        </div>
      </PageContainer>
    )
  }

  if (!sessionData || !sessionData.session) {
    return (
      <PageContainer>
        <p className="text-sm text-muted">Attendance session not found.</p>
        <Link to="/teacher/attendance" className="mt-2 inline-block text-primary hover:underline">
          Back to History
        </Link>
      </PageContainer>
    )
  }

  const { session, roster } = sessionData
  const isLocked = session.status === 'Completed' || session.status === 'Cancelled'

  // Summary counts
  const totalStudents = roster.length
  const presentCount = Object.values(marksByStudent).filter((r) => r.status === 'Present').length
  const lateCount = Object.values(marksByStudent).filter((r) => r.status === 'Late').length
  const absentCount = Math.max(0, totalStudents - (presentCount + lateCount))

  return (
    <PageContainer>
      {/* Top Navigation & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to={`/teacher/attendance/session/${id}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-ink"
        >
          <ArrowLeft size={15} /> Switch to Manual Attendance
        </Link>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {!isLocked && (
            <>
              <button
                type="button"
                onClick={() => setCameraActive(!cameraActive)}
                className={`btn-secondary flex items-center gap-1.5 text-xs font-semibold ${
                  cameraActive ? 'text-amber-700 hover:bg-amber-50' : 'text-emerald-700 hover:bg-emerald-50'
                }`}
              >
                {cameraActive ? <VideoOff size={15} /> : <Video size={15} />}
                {cameraActive ? 'Stop Camera' : 'Start Camera'}
              </button>

              <button
                type="button"
                onClick={() => setShowConfirmFinish(true)}
                className="btn-primary flex items-center gap-1.5 text-xs font-semibold"
              >
                <CheckCircle2 size={15} /> Finish Attendance
              </button>
            </>
          )}

          <Link to="/teacher/attendance" className="btn-secondary text-xs">
            Cancel
          </Link>
        </div>
      </div>

      {/* Session Title */}
      <SectionHeader
        title={`Face Recognition Attendance — ${session.subject?.name} (${session.subject?.code})`}
        subtitle={`${session.department ? `${session.department} · ` : ''}Section ${session.section || '—'} · Period ${session.period} · ${new Date(session.date).toLocaleDateString()}`}
      />

      {/* Session Details Bar */}
      <div className="grid grid-cols-2 gap-3 rounded-2xl border border-pine-900/10 bg-white p-5 shadow-sm sm:grid-cols-3 lg:grid-cols-6 mt-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-pine-600">Department</span>
          <p className="text-sm font-bold text-pine-950 truncate mt-0.5">{session.department || session.subject?.department || '—'}</p>
        </div>
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-pine-600">Section</span>
          <p className="text-sm font-bold text-pine-950 mt-0.5">Section {session.section || '—'}</p>
        </div>
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-pine-600">Subject</span>
          <p className="text-sm font-bold text-pine-950 truncate mt-0.5">{session.subject?.name || '—'}</p>
        </div>
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-pine-600">Period</span>
          <p className="text-sm font-bold text-pine-950 mt-0.5">Period {session.period}</p>
        </div>
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-pine-600">Time Slot</span>
          <p className="text-sm font-bold text-pine-950 mt-0.5">
            {session.startTime && session.endTime ? `${session.startTime} - ${session.endTime}` : 'Regular Class'}
          </p>
        </div>
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-pine-600">Status</span>
          <div className="mt-0.5">
            <StatusBadge status={session.status === 'Completed' ? 'Completed' : 'Active'} />
          </div>
        </div>
      </div>

      {/* Attendance Summary Widgets */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="bg-white rounded-2xl border border-pine-900/10 p-4 text-center shadow-sm">
          <span className="text-xs font-semibold text-pine-600">Total Enrolled</span>
          <p className="mt-1 text-3xl font-extrabold tracking-tight text-pine-950">{totalStudents}</p>
          <span className="text-[11px] text-pine-600/80 font-medium">Class Roster</span>
        </div>

        <div className="bg-white rounded-2xl border border-emerald-500/30 bg-emerald-50/20 p-4 text-center shadow-sm">
          <span className="text-xs font-bold text-emerald-800">Present</span>
          <p className="mt-1 text-3xl font-extrabold tracking-tight text-emerald-600">{presentCount}</p>
          <span className="text-[11px] text-emerald-700 font-medium">Recognized Faces</span>
        </div>

        <div className="bg-white rounded-2xl border border-amber-500/30 bg-amber-50/20 p-4 text-center shadow-sm">
          <span className="text-xs font-bold text-amber-800">Absent</span>
          <p className="mt-1 text-3xl font-extrabold tracking-tight text-amber-600">{absentCount}</p>
          <span className="text-[11px] text-amber-700 font-medium">Undetected</span>
        </div>

        <div className="bg-white rounded-2xl border border-pine-900/10 p-4 text-center shadow-sm">
          <span className="text-xs font-semibold text-rose-600">Unknown Faces</span>
          <p className="mt-1 text-3xl font-extrabold tracking-tight text-rose-600">{unknownCount}</p>
          <span className="text-[11px] text-pine-600/80 font-medium">Unregistered sightings</span>
        </div>
      </div>

      {/* Locked notice */}
      {isLocked && (
        <div className="rounded-2xl border border-pine-900/10 bg-ivory/60 p-5 text-center shadow-sm">
          <p className="text-sm font-bold text-pine-950">This attendance session is Completed.</p>
          <p className="mt-1 text-xs text-pine-700">
            All recognized students are saved as Present, and undetected students are saved as Absent.{' '}
            <Link to={`/teacher/attendance/session/${id}`} className="font-semibold text-olive-700 hover:underline">
              View or edit attendance record &rarr;
            </Link>
          </p>
        </div>
      )}

      {/* Main Grid: Camera Area & Detection Info */}
      {!isLocked && (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Left Column: Live Camera with Canvas Bounding Boxes (7 cols) */}
          <div className="space-y-4 lg:col-span-7">
            <div className="bg-white rounded-2xl border border-pine-900/10 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="h-2.5 w-2.5 animate-ping rounded-full bg-emerald-500" />
                  <h3 className="text-sm font-bold text-pine-950">AI Facial Recognition Camera</h3>
                  {session.section && (
                    <span className="rounded-md bg-pine-50 px-2 py-0.5 text-xs font-bold text-pine-800 border border-pine-200">
                      Section {session.section}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 text-xs text-pine-600">
                  <span className="font-mono text-[11px]">Threshold: 0.50 | Margin: 0.08</span>
                </div>
              </div>

              {/* Camera Video with Overlaid Canvas */}
              <FaceCamera
                active={cameraActive}
                onStatusChange={setCameraStatus}
                onFaceDetected={handleFaceDetected}
                overlayInfo={currentOverlay}
              />

              {/* Status Banner */}
              <FaceRecognitionStatus status={cameraActive ? cameraStatus : 'camera-stopped'} />
            </div>

            {/* Real-time Detection Information Panel */}
            <div className="bg-white rounded-2xl border border-pine-900/10 p-5 shadow-sm">
              <h4 className="text-xs font-bold uppercase tracking-wider text-pine-600">
                Live Detection Feed
              </h4>

              {lastDetection ? (
                <div className="mt-3">
                  {lastDetection.status === 'verifying' && (
                    <div className="flex items-start gap-3 rounded-xl border-2 border-amber-500 bg-amber-50/70 p-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-600 text-white shadow-sm">
                        <LoaderCircle size={20} className="animate-spin" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-bold text-amber-950 truncate">
                            ⏳ Verifying: {lastDetection.student?.name}
                          </p>
                          <span className="rounded-md bg-amber-600 px-2 py-0.5 text-[11px] font-bold text-white">
                            FRAME 1/2
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs font-semibold text-amber-800">
                          Register No: <strong>{lastDetection.student?.studentId}</strong> · Please hold face steady for confirmation…
                        </p>
                      </div>
                    </div>
                  )}

                  {lastDetection.status === 'success' && (
                    <div className="flex items-start gap-3 rounded-xl border-2 border-emerald-500 bg-emerald-50/70 p-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
                        <CheckCircle2 size={20} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-bold text-emerald-950 truncate">
                            ✓ {lastDetection.student?.name}
                          </p>
                          <span className="rounded-md bg-emerald-600 px-2 py-0.5 text-[11px] font-bold text-white">
                            PRESENT
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs font-semibold text-emerald-800">
                          Register No: <strong>{lastDetection.student?.studentId}</strong> · Roll: {lastDetection.student?.rollNumber}
                        </p>
                        <p className="mt-1 text-[11px] text-emerald-700 font-medium">
                          Status: Matched ({Math.round(lastDetection.confidence * 100)}% Confidence) · Confirmed 2/2 · {lastDetection.time}
                        </p>
                      </div>
                    </div>
                  )}

                  {lastDetection.status === 'already-marked' && (
                    <div className="flex items-start gap-3 rounded-xl border border-pine-900/10 bg-ivory/60 p-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-pine-700 text-white shadow-sm">
                        <CheckCircle2 size={20} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-bold text-pine-950 truncate">
                            {lastDetection.student?.name}
                          </p>
                          <span className="rounded-md bg-pine-100 px-2 py-0.5 text-[11px] font-bold text-pine-800">
                            ALREADY PRESENT
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-pine-700">
                          Register No: {lastDetection.student?.studentId} · Duplicate attendance prevented.
                        </p>
                      </div>
                    </div>
                  )}

                  {lastDetection.status === 'unknown' && (
                    <div className="flex items-start gap-3 rounded-xl border-2 border-rose-500/40 bg-rose-50/70 p-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-600 text-white shadow-sm">
                        <XCircle size={20} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-bold text-rose-950">Unknown / Unregistered Face</p>
                          <span className="rounded-md bg-rose-600 px-2 py-0.5 text-[11px] font-bold text-white">
                            NOT REGISTERED
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-rose-800">
                          This face did not match any registered student in this class. No attendance was recorded.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-3 flex items-center justify-center rounded-xl border border-dashed border-pine-900/15 p-5 text-xs text-pine-600/80 bg-ivory/30">
                  Have students look toward the camera to automatically identify and mark them Present.
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Attendance Roster / Recent Detections (5 cols) */}
          <div className="space-y-4 lg:col-span-5">
            <div className="bg-white rounded-2xl border border-pine-900/10 p-5 shadow-sm space-y-4">
              {/* Selector */}
              <div className="flex items-center justify-between border-b border-pine-900/10 pb-3">
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setRosterView('recent')}
                    className={`text-xs font-bold transition-colors pb-1 border-b-2 ${
                      rosterView === 'recent' ? 'border-pine-900 text-pine-950' : 'border-transparent text-pine-600 hover:text-pine-950'
                    }`}
                  >
                    Recent Scans ({recentScans.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setRosterView('roster')}
                    className={`text-xs font-bold transition-colors pb-1 border-b-2 ${
                      rosterView === 'roster' ? 'border-pine-900 text-pine-950' : 'border-transparent text-pine-600 hover:text-pine-950'
                    }`}
                  >
                    Class Roster ({roster.length})
                  </button>
                </div>

                <span className="text-[11px] font-semibold text-pine-700">
                  {presentCount} / {totalStudents} Present
                </span>
              </div>

              {/* View 1: Recent Scans */}
              {rosterView === 'recent' && (
                <div className="max-h-[500px] overflow-y-auto pr-1">
                  {recentScans.length === 0 ? (
                    <div className="py-12 text-center text-xs text-pine-600/80">
                      No faces recognized yet during this session.
                    </div>
                  ) : (
                    <ul className="divide-y divide-pine-900/5">
                      {recentScans.map((r) => (
                        <li key={r.id} className="flex items-center justify-between py-3 text-xs">
                          <div>
                            <p className="font-bold text-pine-950">{r.name}</p>
                            <p className="text-[11px] text-pine-600/80 mt-0.5">
                              {r.studentId} · Roll {r.rollNumber} · {r.timestamp}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-pine-600 font-mono font-medium">{r.confidence}%</span>
                            <span className="rounded-md bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
                              Present
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* View 2: Full Class Roster */}
              {rosterView === 'roster' && (
                <div className="max-h-[500px] overflow-y-auto pr-1">
                  <ul className="divide-y divide-pine-900/5">
                    {roster.map((student) => {
                      const isPresent = marksByStudent[student._id]?.status === 'Present'
                      return (
                        <li key={student._id} className="flex items-center justify-between py-2.5 text-xs">
                          <div className="min-w-0 pr-2">
                            <p className="truncate font-semibold text-pine-950">{student.user?.name}</p>
                            <p className="text-[11px] text-pine-600/80 mt-0.5">
                              {student.studentId} · Roll {student.rollNumber}
                            </p>
                          </div>
                          <span
                            className={`rounded-md px-2.5 py-0.5 text-[10px] font-bold shrink-0 ${
                              isPresent
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-ivory border border-pine-900/10 text-pine-600'
                            }`}
                          >
                            {isPresent ? '✓ Present' : 'Absent'}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal to Finish Attendance */}
      {showConfirmFinish && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-pine-950/60 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl border border-pine-900/10 max-w-md w-full space-y-5 p-7 shadow-xl animate-in fade-in zoom-in-95">
            <div className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                <CheckCircle2 size={28} />
              </div>
              <h3 className="mt-4 text-xl font-bold text-pine-950">Finish Attendance Session?</h3>
              <p className="mt-1 text-xs text-pine-700/80">
                Finalizing will save the attendance session to the database.
              </p>
            </div>

            <div className="rounded-2xl border border-pine-900/10 bg-ivory/50 p-4 space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-pine-700">Total Students in Class:</span>
                <strong className="text-pine-950 font-bold">{totalStudents}</strong>
              </div>
              <div className="flex justify-between text-emerald-800 font-bold">
                <span>Recognized Faces (Marked Present):</span>
                <span>{presentCount}</span>
              </div>
              <div className="flex justify-between text-amber-800 font-bold">
                <span>Undetected Students (Will be marked Absent):</span>
                <span>{absentCount}</span>
              </div>
            </div>

            <p className="text-[11px] text-pine-600/80 text-center">
              You can still review and adjust student statuses after finishing if needed.
            </p>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmFinish(false)}
                className="btn-secondary flex-1 py-2.5 text-xs justify-center font-semibold"
              >
                Continue Scanning
              </button>
              <button
                type="button"
                onClick={handleFinishAttendance}
                disabled={finishing}
                className="btn-primary flex-1 justify-center py-2.5 text-xs font-semibold shadow-sm"
              >
                {finishing && <LoaderCircle size={14} className="animate-spin" />}
                {finishing ? 'Finalizing…' : 'Confirm & Finish'}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  )
}
