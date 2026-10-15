import { useEffect, useState } from 'react'
import {
  User,
  Shield,
  Key,
  Server,
  Save,
  Lock,
  Mail,
  Phone,
  Building,
  BadgeCheck,
} from 'lucide-react'
import PageContainer from '../../components/layout/PageContainer'
import SectionHeader from '../../components/common/SectionHeader'
import { inputClass } from '../../components/FormField'
import { useToast } from '../../context/ToastContext'
import { adminSettingsApi } from '../../services/adminService'

export default function AdminSettings() {
  const toast = useToast()

  // Profile Form state
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    phone: '',
    department: '',
    employeeId: '',
    role: 'admin',
    lastLogin: null,
  })

  // System Configuration Info
  const [system, setSystem] = useState({
    attendanceThreshold: 75,
    academicYear: '2026-2027',
    defaultSemester: 3,
    environment: 'development',
  })

  // Password Change Form state
  const [passwords, setPasswords] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })

  const [loading, setLoading] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)

  // Load profile on mount
  useEffect(() => {
    adminSettingsApi
      .getProfile()
      .then((data) => {
        if (data.user) {
          setProfile({
            name: data.user.name || '',
            email: data.user.email || '',
            phone: data.user.phone || '',
            department: data.admin?.department || '',
            employeeId: data.admin?.employeeId || 'ADM-001',
            role: data.user.role || 'admin',
            lastLogin: data.user.lastLogin,
          })
        }
        if (data.system) {
          setSystem(data.system)
        }
      })
      .catch((err) => {
        toast.error(err.response?.data?.message || 'Failed to load administrator profile')
      })
      .finally(() => setLoading(false))
  }, [toast])

  // Save Profile Handler
  const handleSaveProfile = async (e) => {
    e.preventDefault()
    if (!profile.name.trim()) {
      toast.error('Full Name is required')
      return
    }

    setSavingProfile(true)
    try {
      const res = await adminSettingsApi.updateProfile({
        name: profile.name,
        phone: profile.phone,
        department: profile.department,
      })
      toast.success(res.message || 'Profile updated successfully')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update profile')
    } finally {
      setSavingProfile(false)
    }
  }

  // Change Password Handler
  const handleChangePassword = async (e) => {
    e.preventDefault()
    if (!passwords.currentPassword) {
      toast.error('Please enter your current password')
      return
    }
    if (!passwords.newPassword) {
      toast.error('Please enter a new password')
      return
    }
    if (passwords.newPassword.length < 8) {
      toast.error('New password must be at least 8 characters')
      return
    }
    if (passwords.newPassword !== passwords.confirmPassword) {
      toast.error('New passwords do not match')
      return
    }

    setSavingPassword(true)
    try {
      const res = await adminSettingsApi.changePassword({
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword,
        confirmPassword: passwords.confirmPassword,
      })
      toast.success(res.message || 'Password updated successfully')
      setPasswords({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      })
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password')
    } finally {
      setSavingPassword(false)
    }
  }

  if (loading) {
    return (
      <PageContainer>
        <SectionHeader title="System & Profile Settings" subtitle="Loading administrative settings…" />
        <div className="flex h-64 items-center justify-center">
          <div className="flex items-center gap-3 text-slate-500">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span>Loading profile…</span>
          </div>
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <SectionHeader
        title="Settings & System Configuration"
        subtitle="Manage your administrative credentials, security preferences, and institutional attendance thresholds."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Profile Card */}
        <div className="rounded-[22px] border border-line bg-surface p-6 shadow-card">
          <div className="mb-5 flex items-center gap-3 border-b border-line pb-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <User className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-ink">
                Administrator Profile
              </h2>
              <p className="text-xs text-muted">
                Your institutional identification and contact details.
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  className={`${inputClass} pl-9 text-xs rounded-xl border-line bg-background text-ink`}
                  required
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-ink">
                Email Address (Institutional ID)
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  type="email"
                  value={profile.email}
                  disabled
                  className={`${inputClass} cursor-not-allowed bg-surface-subtle pl-9 text-xs text-muted rounded-xl border-line`}
                />
              </div>
              <p className="mt-1 text-[11px] text-muted">
                Primary authentication email cannot be altered directly.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  <input
                    type="text"
                    value={profile.phone}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    placeholder="+91 98765 43210"
                    className={`${inputClass} pl-9 text-xs rounded-xl border-line bg-background text-ink`}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-ink">
                  Department
                </label>
                <div className="relative">
                  <Building className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  <input
                    type="text"
                    value={profile.department}
                    onChange={(e) => setProfile({ ...profile, department: e.target.value })}
                    placeholder="Academic Affairs"
                    className={`${inputClass} pl-9 text-xs rounded-xl border-line bg-background text-ink`}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink">
                  Employee ID
                </label>
                <div className="relative">
                  <BadgeCheck className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  <input
                    type="text"
                    value={profile.employeeId}
                    disabled
                    className={`${inputClass} cursor-not-allowed bg-surface-subtle pl-9 text-xs text-muted rounded-xl border-line`}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-ink">
                  System Role
                </label>
                <div className="relative">
                  <Shield className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
                  <input
                    type="text"
                    value="Super Administrator"
                    disabled
                    className={`${inputClass} cursor-not-allowed bg-surface-subtle pl-9 text-xs font-semibold text-primary rounded-xl border-line`}
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={savingProfile}
                className="flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-primary-hover disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
                {savingProfile ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>

        {/* Security & Password Card */}
        <div className="rounded-[22px] border border-line bg-surface p-6 shadow-card">
          <div className="mb-5 flex items-center gap-3 border-b border-line pb-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/15 text-accent-hover">
              <Key className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-ink">
                Security & Password
              </h2>
              <p className="text-xs text-muted">
                Update your administrative login credentials.
              </p>
            </div>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink">
                Current Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  type="password"
                  placeholder="Enter current password"
                  value={passwords.currentPassword}
                  onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })}
                  className={`${inputClass} pl-9 text-xs rounded-xl border-line bg-background text-ink`}
                  required
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-ink">
                New Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  type="password"
                  placeholder="Minimum 8 characters"
                  value={passwords.newPassword}
                  onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
                  className={`${inputClass} pl-9 text-xs rounded-xl border-line bg-background text-ink`}
                  required
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-ink">
                Confirm New Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  type="password"
                  placeholder="Re-enter new password"
                  value={passwords.confirmPassword}
                  onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })}
                  className={`${inputClass} pl-9 text-xs rounded-xl border-line bg-background text-ink`}
                  required
                />
              </div>
            </div>

            <div className="rounded-xl border border-line bg-surface-subtle p-3.5 text-[11px] text-muted">
              <span className="font-semibold text-ink">Password requirements:</span>
              <ul className="mt-1 list-inside list-disc space-y-0.5">
                <li>Minimum 8 characters length</li>
                <li>Hashed securely using bcrypt (salt rounds: 10)</li>
              </ul>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={savingPassword}
                className="flex items-center gap-1.5 rounded-xl bg-ink px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-ink/90 disabled:opacity-50"
              >
                <Key className="h-3.5 w-3.5" />
                {savingPassword ? 'Updating…' : 'Update Password'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* System & Institutional Policy Configuration */}
      <div className="mt-6 rounded-[22px] border border-line bg-surface p-6 shadow-card">
        <div className="mb-5 flex items-center gap-3 border-b border-line pb-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Server className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-ink">
              Institutional Policy & AI System Configuration
            </h2>
            <p className="text-xs text-muted">
              Global system parameters, attendance threshold policy, and computer vision stack.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-line bg-background p-4 transition hover:border-primary/30">
            <div className="text-xs font-semibold text-muted">Attendance Threshold</div>
            <div className="mt-1.5 text-2xl font-bold text-rose-600">
              {system.attendanceThreshold}%
            </div>
            <p className="mt-1 text-[11px] text-muted">
              Mandatory minimum attendance required for exam eligibility.
            </p>
          </div>

          <div className="rounded-2xl border border-line bg-background p-4 transition hover:border-primary/30">
            <div className="text-xs font-semibold text-muted">Academic Year</div>
            <div className="mt-1.5 text-2xl font-bold text-ink">
              {system.academicYear}
            </div>
            <p className="mt-1 text-[11px] text-muted">
              Current active academic session.
            </p>
          </div>

          <div className="rounded-2xl border border-line bg-background p-4 transition hover:border-primary/30">
            <div className="text-xs font-semibold text-muted">Default Semester</div>
            <div className="mt-1.5 text-2xl font-bold text-ink">
              Semester {system.defaultSemester}
            </div>
            <p className="mt-1 text-[11px] text-muted">
              Active semester for timetable scheduling.
            </p>
          </div>

          <div className="rounded-2xl border border-line bg-background p-4 transition hover:border-primary/30">
            <div className="text-xs font-semibold text-muted">AI Vision Engine</div>
            <div className="mt-1.5 text-sm font-bold text-primary">
              Face-API.js (128D)
            </div>
            <p className="mt-1 text-[11px] text-muted">
              SSD MobileNet V1 & 68 Landmark biometrics.
            </p>
          </div>
        </div>
      </div>
    </PageContainer>
  )
}
