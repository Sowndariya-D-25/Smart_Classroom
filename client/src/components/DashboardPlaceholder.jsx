import { LogOut } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'

/**
 * Minimal authenticated shell used by all three role dashboards for now —
 * just enough to prove login/JWT/role-authorization actually work end to
 * end. The real sidebar/navbar/cards/charts come in Phase 4.
 */
export default function DashboardPlaceholder({ roleLabel, accentClass }) {
  const { user, profile, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div>
            <span className={`badge ${accentClass}`}>{roleLabel}</span>
            <h1 className="mt-1 text-lg font-semibold">Welcome, {user?.name}</h1>
          </div>
          <button onClick={handleLogout} className="btn-secondary">
            <LogOut size={16} /> Logout
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="card p-6">
          <h2 className="text-sm font-semibold text-muted">Authenticated session</h2>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted">Email</dt>
              <dd className="font-medium">{user?.email}</dd>
            </div>
            <div>
              <dt className="text-muted">Role</dt>
              <dd className="font-medium capitalize">{user?.role}</dd>
            </div>
            <div>
              <dt className="text-muted">Last login</dt>
              <dd className="font-medium">
                {user?.lastLogin ? new Date(user.lastLogin).toLocaleString() : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Role profile</dt>
              <dd className="font-medium">
                {profile
                  ? `Linked (${profile.studentId || profile.employeeId || 'found'})`
                  : 'Not yet created (an admin completes this in Phase 5)'}
              </dd>
            </div>
          </dl>
        </div>

        <p className="mt-6 text-sm text-muted">
          This is a placeholder dashboard confirming authentication works. The full{' '}
          {roleLabel.toLowerCase()} dashboard — sidebar, stats, charts, and tables —
          is built in Phase 4.
        </p>
      </main>
    </div>
  )
}
