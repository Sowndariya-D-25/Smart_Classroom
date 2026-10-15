import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import LoadingScreen from '../components/LoadingScreen'

/**
 * Nested inside <ProtectedRoute>, so the user is already known to be
 * authenticated by the time this runs. Restricts a route subtree to a
 * set of roles, e.g.:
 *
 *   <Route element={<ProtectedRoute />}>
 *     <Route element={<RoleRoute allow={['admin']} />}>
 *       <Route path="/admin/dashboard" element={<AdminDashboard />} />
 *     </Route>
 *   </Route>
 *
 * A student who manually types /admin/dashboard lands here and is sent
 * to their own dashboard instead — but again, this is UX only. The
 * backend's authorizeRoles(...) middleware is what actually stops them
 * from calling admin APIs.
 */
export default function RoleRoute({ allow = [] }) {
  const { user, loading } = useAuth()

  if (loading) {
    return <LoadingScreen />
  }

  if (!user || !allow.includes(user.role)) {
    return <Navigate to={`/${user?.role || 'login'}/dashboard`} replace />
  }

  return <Outlet />
}
