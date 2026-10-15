import { useEffect, useState } from 'react'
import {
  User,
  Mail,
  Phone,
  GraduationCap,
  Briefcase,
  BookOpen,
  Save,
  CheckCircle2,
  Clock,
  LoaderCircle,
  Lock,
  Key,
} from 'lucide-react'
import PageContainer from '../../components/layout/PageContainer'
import SectionHeader from '../../components/common/SectionHeader'
import StatusBadge from '../../components/common/StatusBadge'
import { inputClass } from '../../components/FormField'
import { useToast } from '../../context/ToastContext'
import { getProfile, updateProfile, changePassword } from '../../services/teacherService'
import { normalizeDepartment } from '../../utils/department'

export default function Profile() {
  const toast = useToast()
  const [teacher, setTeacher] = useState(null)
  const [form, setForm] = useState({
    name: '',
    phone: '',
  })
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)

  const load = () => {
    setLoading(true)
    getProfile()
      .then((data) => {
        setTeacher(data.teacher)
        setForm({
          name: data.teacher.user?.name || '',
          phone: data.teacher.user?.phone || data.teacher.phone || '',
        })
      })
      .catch((err) => toast.error(err.response?.data?.message || 'Could not load your profile.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) {
      toast.error('Full Name is required.')
      return
    }

    setSaving(true)
    try {
      const res = await updateProfile({
        name: form.name.trim(),
        phone: form.phone?.trim() || '',
      })
      toast.success(res.message || 'Profile updated successfully.')
      setTeacher(res.data.teacher)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update your profile.')
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    if (!passwordForm.currentPassword || !passwordForm.newPassword) {
      toast.error('Current and new passwords are required.')
      return
    }
    if (passwordForm.newPassword.length < 8) {
      toast.error('New password must be at least 8 characters long.')
      return
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('New passwords do not match.')
      return
    }

    setSavingPassword(true)
    try {
      const res = await changePassword(passwordForm)
      toast.success(res.message || 'Password updated successfully.')
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update password.')
    } finally {
      setSavingPassword(false)
    }
  }

  if (loading) {
    return (
      <PageContainer>
        <SectionHeader title="Teacher Profile" subtitle="Loading profile…" />
        <div className="flex h-64 items-center justify-center">
          <div className="flex items-center gap-3 text-muted">
            <LoaderCircle className="h-5 w-5 animate-spin text-primary" />
            <span>Loading your records…</span>
          </div>
        </div>
      </PageContainer>
    )
  }

  const { user = {}, subjects = [] } = teacher || {}

  return (
    <PageContainer>
      <SectionHeader
        title="Teacher Profile"
        subtitle="Manage your personal contact details and view official faculty employment records."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 mt-6">
        {/* CARD 1: PERSONAL & CONTACT INFORMATION */}
        <div className="bg-white rounded-2xl border border-line p-7 shadow-xs space-y-6">
          <div className="flex items-center gap-3.5 border-b border-line pb-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <User className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-ink font-display">Personal Information</h2>
              <p className="text-xs text-muted mt-0.5">
                Update your preferred name, phone number, and contact details.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-bold text-ink">Full Name *</label>
              <div className="relative">
                <User className="absolute left-3.5 top-2.5 h-4 w-4 text-muted" />
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  className={`${inputClass} pl-10 text-xs`}
                  required
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-ink">Institutional Email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-2.5 h-4 w-4 text-muted" />
                <input
                  type="email"
                  value={user.email || ''}
                  disabled
                  className={`${inputClass} cursor-not-allowed bg-canvas pl-10 text-xs text-muted`}
                />
              </div>
              <p className="mt-1 text-[11px] text-muted">
                Managed by institutional administration.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-ink">Mobile Number</label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-2.5 h-4 w-4 text-muted" />
                <input
                  type="tel"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="+91 98765 43210"
                  className={`${inputClass} pl-10 text-xs`}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-bold text-ink">Department</label>
                <div className="rounded-xl border border-line bg-canvas p-3 text-xs">
                  <div className="font-bold text-ink">
                    {normalizeDepartment(teacher?.department)}
                  </div>
                  <span className="text-[11px] text-muted">Read-only (Admin Controlled)</span>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-ink">Designation</label>
                <div className="rounded-xl border border-line bg-canvas p-3 text-xs">
                  <div className="font-bold text-ink">
                    {teacher?.designation || 'Faculty Member'}
                  </div>
                  <span className="text-[11px] text-muted">Read-only (Admin Controlled)</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={saving}
                className="btn-primary flex items-center gap-1.5 px-6 py-2.5 text-xs font-semibold shadow-xs"
              >
                {saving && <LoaderCircle size={14} className="animate-spin" />}
                <Save className="h-3.5 w-3.5" />
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>

        {/* CARD 2: OFFICIAL FACULTY RECORD (PROTECTED) */}
        <div className="bg-white rounded-2xl border border-line p-7 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-line pb-4">
            <div className="flex items-center gap-3.5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Briefcase className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-ink font-display">Faculty Record</h2>
                <p className="text-xs text-muted mt-0.5">Verified institutional appointment details.</p>
              </div>
            </div>

            <span className="rounded-full bg-canvas px-3 py-1 text-[11px] font-bold text-ink border border-line">
              Admin Verified
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="rounded-xl border border-line bg-canvas/40 p-4">
              <span className="text-muted font-medium">Employee ID</span>
              <div className="mt-1 font-mono text-sm font-bold text-ink">
                {teacher.employeeId}
              </div>
            </div>

            <div className="rounded-xl border border-line bg-canvas/40 p-4">
              <span className="text-muted font-medium">Role / Position</span>
              <div className="mt-1 font-bold capitalize text-ink">
                {user.role || 'Teacher'}
              </div>
            </div>

            <div className="rounded-xl border border-line bg-canvas/40 p-4">
              <span className="text-muted font-medium">Department</span>
              <div className="mt-1 font-bold text-ink">
                {normalizeDepartment(teacher.department)}
              </div>
            </div>

            <div className="rounded-xl border border-line bg-canvas/40 p-4">
              <span className="text-muted font-medium">Designation</span>
              <div className="mt-1 font-bold text-ink">
                {teacher.designation || '—'}
              </div>
            </div>

            <div className="rounded-xl border border-line bg-canvas/40 p-4">
              <span className="text-muted font-medium">Account Status</span>
              <div className="mt-1.5">
                <StatusBadge status={user.isActive ? 'Active' : 'Inactive'} />
              </div>
            </div>

            <div className="rounded-xl border border-line bg-canvas/40 p-4">
              <span className="text-muted font-medium">Last Login</span>
              <div className="mt-1 font-semibold text-ink">
                {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Active Today'}
              </div>
            </div>

            {/* Assigned Teaching Subjects */}
            <div className="col-span-2 rounded-xl border border-line bg-canvas/40 p-4">
              <div className="flex items-center gap-2 mb-2">
                <BookOpen size={16} className="text-primary" />
                <span className="font-bold text-ink">Assigned Teaching Subjects ({subjects.length})</span>
              </div>
              {subjects.length > 0 ? (
                <div className="flex flex-wrap gap-2 mt-2">
                  {subjects.map((sub) => (
                    <span
                      key={sub._id || sub.code}
                      className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink shadow-2xs"
                    >
                      {sub.name} <span className="text-muted">({sub.code})</span>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted">No specific subjects assigned yet.</p>
              )}
            </div>
          </div>
        </div>

        {/* CARD 3: SECURITY & PASSWORD */}
        <div className="bg-white rounded-2xl border border-line p-7 shadow-xs space-y-6 lg:col-span-2">
          <div className="flex items-center gap-3.5 border-b border-line pb-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-ink font-display">Security &amp; Password</h2>
              <p className="text-xs text-muted mt-0.5">
                Change your faculty portal login password.
              </p>
            </div>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-4 max-w-xl">
            <div>
              <label className="mb-1 block text-xs font-bold text-ink">Current Password *</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-2.5 h-4 w-4 text-muted" />
                <input
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                  placeholder="Enter current password"
                  className={`${inputClass} pl-10 text-xs`}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-bold text-ink">New Password *</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-2.5 h-4 w-4 text-muted" />
                  <input
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    placeholder="Min 8 characters"
                    className={`${inputClass} pl-10 text-xs`}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-ink">Confirm New Password *</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-2.5 h-4 w-4 text-muted" />
                  <input
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
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
                className="btn-primary flex items-center gap-1.5 px-6 py-2.5 text-xs font-semibold shadow-xs"
              >
                {savingPassword && <LoaderCircle size={14} className="animate-spin" />}
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
