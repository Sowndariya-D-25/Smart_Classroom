import { useEffect, useState } from 'react'
import {
  User,
  Shield,
  Key,
  Save,
  Lock,
  Mail,
  Phone,
  BadgeCheck,
} from 'lucide-react'
import PageContainer from '../../components/layout/PageContainer'
import SectionHeader from '../../components/common/SectionHeader'
import { inputClass } from '../../components/FormField'
import { useToast } from '../../context/ToastContext'
import { adminProfileApi } from '../../services/adminService'
import { useAuth } from '../../context/AuthContext'

export default function AdminProfile() {
  const toast = useToast()
  const { user: authUser } = useAuth()

  // Profile Form state - ONLY Full Name, Email, Mobile Number, Role, Account Status
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'Administrator',
    isActive: true,
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
    adminProfileApi
      .getProfile()
      .then((data) => {
        if (data.user) {
          setProfile({
            name: data.user.name || '',
            email: data.user.email || '',
            phone: data.user.phone || '',
            role: 'Administrator',
            isActive: data.admin?.isActive ?? data.user.isActive ?? true,
          })
        }
      })
      .catch((err) => {
        toast.error(err.response?.data?.message || 'Failed to load administrator profile')
      })
      .finally(() => setLoading(false))
  }, [toast])

  // Save Profile Handler (Full Name & Mobile Number)
  const handleSaveProfile = async (e) => {
    e.preventDefault()
    if (!profile.name.trim()) {
      toast.error('Full Name is required')
      return
    }

    setSavingProfile(true)
    try {
      const res = await adminProfileApi.updateProfile({
        name: profile.name.trim(),
        phone: profile.phone.trim(),
      })
      toast.success(res.message || 'Profile updated successfully')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update profile')
    } finally {
      setSavingProfile(false)
    }
  }

  // Update Password Handler
  const handleChangePassword = async (e) => {
    e.preventDefault()
    if (!passwords.currentPassword) {
      toast.error('Current password is required')
      return
    }
    if (!passwords.newPassword) {
      toast.error('New password is required')
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
      const res = await adminProfileApi.changePassword({
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
        <SectionHeader
          title="Admin Profile"
          subtitle="Manage your personal account information and security."
        />
        <div className="flex h-64 items-center justify-center">
          <div className="flex items-center gap-3 text-slate-500">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="text-sm font-medium">Loading profile…</span>
          </div>
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <SectionHeader
        title="Admin Profile"
        subtitle="Manage your personal account information and security."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Section 1: Profile Information */}
        <div className="rounded-[22px] border border-line bg-surface p-6 shadow-card">
          <div className="mb-5 flex items-center gap-3 border-b border-line pb-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <User className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-ink">
                Profile Information
              </h2>
              <p className="text-xs text-muted">Update your personal account information.</p>
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
                  required
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  className={`${inputClass} pl-9 text-xs rounded-xl border-line bg-background text-ink`}
                  placeholder="Administrator Name"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-ink">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  type="email"
                  readOnly
                  disabled
                  value={profile.email}
                  className={`${inputClass} cursor-not-allowed bg-surface-subtle pl-9 text-xs text-muted rounded-xl border-line`}
                />
              </div>
              <p className="mt-1 text-[11px] text-muted">
                Institutional login email is managed by system administration.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-ink">
                Mobile Number
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  type="tel"
                  value={profile.phone}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  className={`${inputClass} pl-9 text-xs rounded-xl border-line bg-background text-ink`}
                  placeholder="+91 98765 43210"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink">
                  Role
                </label>
                <div className="flex h-10 items-center rounded-xl border border-line bg-surface-subtle px-3 text-xs font-semibold text-primary">
                  <Shield className="mr-2 h-4 w-4" />
                  Administrator
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-ink">
                  Account Status
                </label>
                <div className="flex h-10 items-center rounded-xl border border-primary/20 bg-primary/10 px-3 text-xs font-semibold text-primary">
                  <BadgeCheck className="mr-2 h-4 w-4" />
                  Active
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={savingProfile}
                className="flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-primary-hover disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {savingProfile ? 'Saving Changes…' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>

        {/* Section 2: Security & Password */}
        <div className="rounded-[22px] border border-line bg-surface p-6 shadow-card">
          <div className="mb-5 flex items-center gap-3 border-b border-line pb-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/15 text-accent-hover">
              <Key className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-ink">
                Security & Password
              </h2>
              <p className="text-xs text-muted">Change your portal login password.</p>
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
                  required
                  value={passwords.currentPassword}
                  onChange={(e) =>
                    setPasswords({ ...passwords, currentPassword: e.target.value })
                  }
                  className={`${inputClass} pl-9 text-xs rounded-xl border-line bg-background text-ink`}
                  placeholder="Enter current password"
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
                  required
                  value={passwords.newPassword}
                  onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
                  className={`${inputClass} pl-9 text-xs rounded-xl border-line bg-background text-ink`}
                  placeholder="Enter new password (min. 8 characters)"
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
                  required
                  value={passwords.confirmPassword}
                  onChange={(e) =>
                    setPasswords({ ...passwords, confirmPassword: e.target.value })
                  }
                  className={`${inputClass} pl-9 text-xs rounded-xl border-line bg-background text-ink`}
                  placeholder="Re-enter new password"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={savingPassword}
                className="flex items-center gap-1.5 rounded-xl bg-ink px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-ink/90 disabled:opacity-50"
              >
                <Key className="h-4 w-4" />
                {savingPassword ? 'Updating Password…' : 'Update Password'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </PageContainer>
  )
}
