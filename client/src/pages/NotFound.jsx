import { Link } from 'react-router-dom'
import { ScanFace } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function NotFound() {
  const { isAuthenticated, user } = useAuth()
  const backTo = isAuthenticated ? `/${user.role}/dashboard` : '/login'
  const backLabel = isAuthenticated ? 'Back to Dashboard' : 'Back to Login'

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F7FAF7] px-4 text-center">
      <div className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-[#081B15] border border-emerald-400/30 shadow-card">
        <img src="/logo.png" alt="ClassVision AI" className="h-full w-full object-contain" />
      </div>
      <p className="mt-6 text-6xl font-black font-display text-primary">404</p>
      <h1 className="mt-2 text-xl font-bold font-display text-ink">Page not found</h1>
      <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted">
        The requested resource doesn't exist or may have been moved within the institution portal.
      </p>
      <Link to={backTo} className="btn-primary mt-6 !px-6 !py-2.5 !text-xs !font-bold">
        {backLabel}
      </Link>
    </div>
  )
}
