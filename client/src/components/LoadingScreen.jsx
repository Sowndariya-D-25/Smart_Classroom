import { ScanFace } from 'lucide-react'

// Small full-page loading state used while auth is initializing (checking
// a stored token against /api/auth/me) so the app never flashes the
// wrong screen or gets stuck blank.
export default function LoadingScreen({ label = 'Loading…' }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F7FAF7]">
      <div className="flex flex-col items-center gap-4">
        <div className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-[#081B15] border border-emerald-400/30 shadow-card">
          <img src="/logo.png" alt="ClassVision AI" className="h-full w-full object-contain animate-pulse" />
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-primary animate-ping" />
          <p className="text-xs font-bold text-muted font-display tracking-wide uppercase">{label}</p>
        </div>
      </div>
    </div>
  )
}
