import { useEffect, useState } from 'react'
import {
  User,
  Mail,
  Phone,
  Calendar,
  GraduationCap,
  Key,
  Lock,
  Save,
  CheckCircle2,
  AlertCircle,
  ScanFace,
} from 'lucide-react'
import PageContainer from '../../components/layout/PageContainer'
import SectionHeader from '../../components/common/SectionHeader'
import { inputClass } from '../../components/FormField'
import { useToast } from '../../context/ToastContext'
import {
  getStudentProfile,
  updateStudentProfile,
  changeStudentPassword,
} from '../../services/studentService'
import { normalizeDepartment } from '../../utils/department'

function formatYearOrdinal(year) {
  const y = Number(year)
  if (!y || isNaN(y)) return '—'
  if (y === 1) return '1st Year'
  if (y === 2) return '2nd Year'
  if (y === 3) return '3rd Year'
  return `${y}th Year`
}

export default function StudentProfile() {
  const toast = useToast()

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  // Edit contact info form state
  const [contactForm, setContactForm] = useState({
    name: '',
    phone: '',
  })
  const [savingContact, setSavingContact] = useState(false)

  // Password change form state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [savingPassword, setSavingPassword] = useState(false)

  useEffect(() => {
    setLoading(true)
    getStudentProfile()
      .then((res) => {
        setData(res)
        if (res.personal) {
          setContactForm({
            name: res.personal.name || '',
            phone: res.personal.phone || '',
          })
        }
      })
      .catch((err) => {
        toast.error(err.response?.data?.message || 'Failed to load your student profile')
      })
      .finally(() => setLoading(false))
  }, [toast])

  const handleUpdateContact = async (e) => {
    e.preventDefault()
    if (!contactForm.name.trim()) {
      toast.error('Full Name is required')
      return
    }

    setSavingContact(true)
    try {
      const res = await updateStudentProfile(contactForm)
      toast.success(res.message || 'Profile updated successfully')
      setData((prev) => ({
        ...prev,
        personal: {
          ...prev.personal,
          name: res.data.name,
          phone: res.data.phone,
        },
      }))
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update contact info')
    } finally {
      setSavingContact(false)
    }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    if (!passwordForm.currentPassword) {
      toast.error('Please enter your current password')
      return
    }
    if (!passwordForm.newPassword) {
      toast.error('Please enter a new password')
      return
    }
    if (passwordForm.newPassword.length < 8) {
      toast.error('New password must be at least 8 characters long')
      return
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('New passwords do not match')
      return
    }

    setSavingPassword(true)
    try {
      const res = await changeStudentPassword(passwordForm)
      toast.success(res.message || 'Password updated successfully')
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      })
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update password')
    } finally {
      setSavingPassword(false)
    }
  }

  if (loading) {
    return (
      <PageContainer>
        <SectionHeader title="Student Profile" subtitle="Loading profile…" />
        <div className="flex h-64 items-center justify-center">
          <div className="flex items-center gap-3 text-muted">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span>Loading your records…</span>
          </div>
        </div>
      </PageContainer>
    )
  }

  const { personal = {}, academic = {} } = data || {}

  return (
    <PageContainer>
      <SectionHeader
        title="Student Profile"
        subtitle="Manage your personal contact details and view official institutional records."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 mt-6">
        {/* CARD 1: PERSONAL & CONTACT INFORMATION */}
        <div className="bg-white rounded-2xl border border-line p-7 shadow-xs space-y-6">
          <div className="flex items-center gap-3.5 border-b border-line pb-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <User className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-ink font-display">
                Personal Information
              </h2>
              <p className="text-xs text-muted mt-0.5">
                Update your preferred name and contact phone number.
              </p>
            </div>
          </div>

          <form onSubmit={handleUpdateContact} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-bold text-ink">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-2.5 h-4 w-4 text-muted" />
                <input
                  type="text"
                  value={contactForm.name}
                  onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                  className={`${inputClass} pl-10 text-xs`}
                  required
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-ink">
                Institutional Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-2.5 h-4 w-4 text-muted" />
                <input
                  type="email"
                  value={personal.email}
                  disabled
                  className={`${inputClass} cursor-not-allowed bg-canvas pl-10 text-xs text-muted`}
                />
              </div>
              <p className="mt-1 text-[11px] text-muted">
                Assigned by institutional administration.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-bold text-ink">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-2.5 h-4 w-4 text-muted" />
                  <input
                    type="text"
                    value={contactForm.phone}
                    onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                    placeholder="+91 98765 43210"
                    className={`${inputClass} pl-10 text-xs`}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-ink">
                  Gender
                </label>
                <div className="rounded-xl border border-line bg-canvas p-3 text-xs font-bold text-ink">
                  {personal.gender || 'Not specified'}
                  <span className="block text-[11px] font-normal text-muted mt-0.5">
                    Read-only (Institution Managed)
                  </span>
                </div>
              </div>
            </div>

            {personal.dateOfBirth && (
              <div>
                <label className="mb-1 block text-xs font-bold text-ink">
                  Date of Birth
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3.5 top-2.5 h-4 w-4 text-muted" />
                  <input
                    type="text"
                    value={new Date(personal.dateOfBirth).toLocaleDateString()}
                    disabled
                    className={`${inputClass} cursor-not-allowed bg-canvas pl-10 text-xs text-muted`}
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={savingContact}
                className="btn-primary px-6 py-2.5 text-xs font-semibold shadow-xs"
              >
                <Save className="h-3.5 w-3.5" />
                {savingContact ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>

        {/* CARD 2: OFFICIAL ACADEMIC INFORMATION (PROTECTED) */}
        <div className="bg-white rounded-2xl border border-line p-7 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-line pb-4">
            <div className="flex items-center gap-3.5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <GraduationCap className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-ink font-display">
                  Academic Record
                </h2>
                <p className="text-xs text-muted mt-0.5">
                  Verified institutional enrollment data.
                </p>
              </div>
            </div>

            <span className="rounded-full bg-canvas border border-line px-3 py-1 text-[11px] font-bold text-ink">
              Admin Managed
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="rounded-xl border border-line bg-canvas/40 p-4">
              <span className="text-muted font-medium">Student ID</span>
              <div className="mt-1 font-mono text-sm font-bold text-ink">
                {academic.studentId}
              </div>
            </div>

            <div className="rounded-xl border border-line bg-canvas/40 p-4">
              <span className="text-muted font-medium">Roll Number</span>
              <div className="mt-1 font-mono text-sm font-bold text-ink">
                {academic.rollNumber}
              </div>
            </div>

            <div className="col-span-2 rounded-xl border border-line bg-canvas/40 p-4">
              <span className="text-muted font-medium">Enrolled Program / Course</span>
              <div className="mt-1 font-bold text-ink">
                {academic.course}
              </div>
            </div>

            <div className="rounded-xl border border-line bg-canvas/40 p-4">
              <span className="text-muted font-medium">Department</span>
              <div className="mt-1 font-bold text-ink">
                {normalizeDepartment(academic.department)}
              </div>
            </div>

            <div className="rounded-xl border border-line bg-canvas/40 p-4">
              <span className="text-muted font-medium">Academic Standing</span>
              <div className="mt-1 font-bold text-ink">
                {academic.yearLabel || formatYearOrdinal(academic.year)} • Sec {academic.section || '—'}
              </div>
            </div>

            <div className="col-span-2 rounded-xl border border-line bg-canvas/40 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-muted font-medium">Face Recognition Profile</span>
                  <div className="mt-1 font-bold text-ink">
                    {academic.hasFaceRegistered ? (
                      <span className="inline-flex items-center gap-1.5 text-primary">
                        <CheckCircle2 className="h-4 w-4" />
                        Biometrics Registered (128D Active)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-amber-600">
                        <AlertCircle className="h-4 w-4" />
                        Pending Biometric Registration
                      </span>
                    )}
                  </div>
                </div>
                <ScanFace className="h-7 w-7 text-muted" />
              </div>
            </div>
          </div>
        </div>

        {/* CARD 3: SECURITY & PASSWORD CHANGE */}
        <div className="bg-white rounded-2xl border border-line p-7 shadow-xs space-y-6 lg:col-span-2">
          <div className="flex items-center gap-3.5 border-b border-line pb-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Key className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-ink font-display">
                Security &amp; Password
              </h2>
              <p className="text-xs text-muted mt-0.5">
                Change your portal login password.
              </p>
            </div>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-4 sm:max-w-xl">
            <div>
              <label className="mb-1 block text-xs font-bold text-ink">
                Current Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-2.5 h-4 w-4 text-muted" />
                <input
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(e) =>
                    setPasswordForm({ ...passwordForm, currentPassword: e.target.value })
                  }
                  placeholder="Enter current password"
                  className={`${inputClass} pl-10 text-xs`}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-bold text-ink">
                  New Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-2.5 h-4 w-4 text-muted" />
                  <input
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(e) =>
                      setPasswordForm({ ...passwordForm, newPassword: e.target.value })
                    }
                    placeholder="Min 8 characters"
                    className={`${inputClass} pl-10 text-xs`}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-ink">
                  Confirm New Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-2.5 h-4 w-4 text-muted" />
                  <input
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) =>
                      setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })
                    }
                    placeholder="Re-enter new password"
                    className={`${inputClass} pl-10 text-xs`}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={savingPassword}
                className="btn-primary px-6 py-2.5 text-xs font-semibold shadow-xs"
              >
                <Key className="h-3.5 w-3.5" />
                {savingPassword ? 'Updating…' : 'Update Password'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </PageContainer>
  )
}
