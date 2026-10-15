import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import LoadingScreen from '../components/LoadingScreen'

/**
 * Blocks unauthenticated users from everything nested under it, sending
 * them to /login (and remembering where they were headed so login can
 * return them there). This is a UX convenience only — the real security
 * boundary is the `protect` middleware on the backend.
 */
export default function ProtectedRoute() {
  const { isAuthenticated, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <LoadingScreen />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <Outlet />
}
