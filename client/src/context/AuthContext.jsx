import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import * as authService from '../services/authService'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true) // true until the initial /me check finishes

  const refreshUser = useCallback(async () => {
    if (!authService.getToken()) {
      setUser(null)
      setProfile(null)
      return null
    }
    try {
      const { user: freshUser, profile: freshProfile } = await authService.getMe()
      setUser(freshUser)
      setProfile(freshProfile)
      return freshUser
    } catch {
      // Token is invalid/expired — the api.js response interceptor already
      // cleared it from storage; just clear local state to match.
      setUser(null)
      setProfile(null)
      return null
    }
  }, [])

  // On app start: if there's a stored token, verify it against /me before
  // treating the user as logged in. Always resolves `loading` so the app
  // never gets stuck on a spinner.
  useEffect(() => {
    refreshUser().finally(() => setLoading(false))
  }, [refreshUser])

  // If any other request gets a 401 mid-session (token expired while the
  // tab was open), api.js fires this event — react by clearing state.
  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null)
      setProfile(null)
    }
    window.addEventListener('scaap:unauthorized', handleUnauthorized)
    return () => window.removeEventListener('scaap:unauthorized', handleUnauthorized)
  }, [])

  const login = useCallback(async (credentials) => {
    const loggedInUser = await authService.login(credentials)
    setUser(loggedInUser)
    // Fetch the role profile (Student/Teacher/Admin) too, best-effort.
    await refreshUser()
    return loggedInUser
  }, [refreshUser])

  const register = useCallback(async (details) => {
    const registeredUser = await authService.register(details)
    setUser(registeredUser)
    await refreshUser()
    return registeredUser
  }, [refreshUser])

  const logout = useCallback(async () => {
    await authService.logout()
    setUser(null)
    setProfile(null)
  }, [])

  const value = {
    user,
    profile,
    loading,
    isAuthenticated: Boolean(user),
    login,
    register,
    logout,
    refreshUser,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an <AuthProvider>')
  }
  return ctx
}
