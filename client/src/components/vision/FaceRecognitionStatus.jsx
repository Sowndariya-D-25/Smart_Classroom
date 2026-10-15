import { LoaderCircle, AlertTriangle, ScanFace, CheckCircle2, XCircle, Users, VideoOff } from 'lucide-react'

// Every state the camera/recognition workflow can be in, and how to
// display it. Reused by both FaceRegistration and FaceAttendance so the
// two pages "speak" consistently.
const STATUS_CONFIG = {
  'loading-models': { icon: LoaderCircle, spin: true, tone: 'muted', text: 'Loading face recognition models…' },
  'requesting-camera': { icon: LoaderCircle, spin: true, tone: 'muted', text: 'Requesting camera permission…' },
  'camera-error': { icon: VideoOff, tone: 'danger', text: 'Camera permission is required for face recognition.' },
  'models-error': { icon: AlertTriangle, tone: 'danger', text: 'Face recognition models could not be loaded. Please check the model files.' },
  'no-face': { icon: ScanFace, tone: 'accent', text: 'No face detected. Please position your face inside the camera frame.' },
  'multiple-faces': { icon: Users, tone: 'accent', text: 'Multiple faces detected. Only one face should be visible.' },
  'poor-quality': { icon: ScanFace, tone: 'accent', text: 'Face is too small or distant. Please move closer to the camera.' },
  verifying: { icon: LoaderCircle, spin: true, tone: 'accent', text: 'Verifying identity consistency… Please hold steady.' },
  detected: { icon: ScanFace, tone: 'primary', text: 'Face detected.' },
  recognized: { icon: CheckCircle2, tone: 'primary', text: 'Student recognized.' },
  unknown: { icon: XCircle, tone: 'danger', text: 'Face not recognized. Please register this student before taking attendance.' },
  'already-marked': { icon: CheckCircle2, tone: 'accent', text: 'Attendance already marked.' },
  locked: { icon: CheckCircle2, tone: 'muted', text: 'This session is no longer accepting attendance.' },
  'camera-stopped': { icon: VideoOff, tone: 'muted', text: 'Camera is currently stopped. Click "Start Camera" to activate live recognition.' },
  success: { icon: CheckCircle2, tone: 'primary', text: 'Attendance marked successfully.' },
  error: { icon: AlertTriangle, tone: 'danger', text: 'Something went wrong.' },
}


const TONE_CLASSES = {
  muted: 'border-pine-900/10 bg-ivory/60 text-pine-700',
  primary: 'border-emerald-500/30 bg-emerald-50/70 text-emerald-800',
  accent: 'border-amber-500/30 bg-amber-50/80 text-amber-800',
  danger: 'border-rose-500/30 bg-rose-50/80 text-rose-850',
}

export default function FaceRecognitionStatus({ status, detail }) {
  const config = STATUS_CONFIG[status]
  if (!config) return null
  const Icon = config.icon

  return (
    <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-sm ${TONE_CLASSES[config.tone]}`}>
      <Icon size={18} className={`mt-0.5 shrink-0 ${config.spin ? 'animate-spin' : ''}`} />
      <div>
        <p className="font-semibold">{config.text}</p>
        {detail && <p className="mt-0.5 text-xs opacity-90">{detail}</p>}
      </div>
    </div>
  )
}

export { STATUS_CONFIG }
