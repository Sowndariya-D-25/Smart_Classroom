import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// Lets a link just say "/dashboard" without knowing the user's role;
// nested inside <ProtectedRoute/> in App.jsx, so `user` is always set
// by the time this renders.
export default function DashboardRedirect() {
  const { user } = useAuth()
  return <Navigate to={`/${user.role}/dashboard`} replace />
}
