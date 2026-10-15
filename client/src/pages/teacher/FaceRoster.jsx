import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ScanFace } from 'lucide-react'
import PageContainer from '../../components/layout/PageContainer'
import SectionHeader from '../../components/common/SectionHeader'
import StatusBadge from '../../components/common/StatusBadge'
import EmptyState from '../../components/common/EmptyState'
import { useToast } from '../../context/ToastContext'
import { getClassRoster } from '../../services/teacherService'

// Student picker for face registration — a teacher can only ever land
// here from their own Classes page and can only pick a student who's
// actually enrolled in that subject's course. The backend enforces this
// independently (see faceProfile.controller.js), this is just the UI
// that keeps the teacher from ever typing an arbitrary student ID.
export default function FaceRoster() {
  const { subjectId } = useParams()
  const toast = useToast()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getClassRoster(subjectId)
      .then(setData)
      .catch((err) => toast.error(err.response?.data?.message || 'Could not load this class roster.'))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectId])

  if (loading) {
    return (
      <PageContainer>
        <p className="text-sm text-muted">Loading…</p>
      </PageContainer>
    )
  }

  if (!data) {
    return (
      <PageContainer>
        <EmptyState title="Class not found" description="This subject doesn't exist or isn't assigned to you." />
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <SectionHeader title={`Register Faces — ${data.subject.name}`} subtitle="Select a student to register or update their face." />

      {data.items.length === 0 ? (
        <EmptyState icon={ScanFace} title="No students in this class yet" />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line/80 bg-white shadow-xs mt-6">
          <ul className="divide-y divide-line/60">
            {data.items.map((student) => (
              <li key={student._id} className="flex items-center justify-between gap-3 px-6 py-4 hover:bg-canvas/60 transition-colors">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-ink">{student.name}</p>
                  <p className="text-xs text-muted mt-0.5">{student.studentId} · Roll {student.rollNumber}</p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={student.faceRegistered ? 'Active' : 'Pending'} />
                  <Link
                    to={`/teacher/students/${student._id}/face?subject=${subjectId}&name=${encodeURIComponent(student.name || '')}`}
                    className="btn-secondary text-xs font-semibold"
                  >
                    <ScanFace size={15} /> {student.faceRegistered ? 'Re-register' : 'Register'}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </PageContainer>
  )
}
