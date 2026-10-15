import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { FiEye, FiEyeOff, FiArrowLeft, FiLoader } from 'react-icons/fi'
import { useAuth } from '../context/AuthContext'
import { inputClass } from '../components/FormField'
import FormField from '../components/FormField'

const ROLE_HOME = {
  admin: '/admin/dashboard',
  teacher: '/teacher/dashboard',
  student: '/student/dashboard',
}

export default function Login() {
  const { user, isAuthenticated, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [form, setForm] = useState({ email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  // If already authenticated, redirect straight to their role home
  useEffect(() => {
    if (isAuthenticated && user?.role) {
      navigate(ROLE_HOME[user.role] || '/', { replace: true })
    }
  }, [isAuthenticated, user, navigate])

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const loggedUser = await login(form)
      const redirectTo = location.state?.from?.pathname || ROLE_HOME[loggedUser.role] || '/'
      navigate(redirectTo, { replace: true })
    } catch (err) {
      if (!err.response) {
        setError('Unable to connect to the server. Please check your network connection.')
      } else if (err.response.status === 401) {
        setError(err.response.data?.message || 'Invalid email or password.')
      } else if (err.response.status === 403) {
        setError(err.response.data?.message || 'Your account is inactive or you do not have permission to sign in.')
      } else if (err.response.status === 404) {
        setError('Authentication service not found.')
      } else if (err.response.status >= 500) {
        setError('Server error while signing in.')
      } else {
        setError(err.response.data?.message || 'Could not sign in. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-[#F7FAF7] text-ink">
      {/* Left visual column - desktop only */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-[#0D251F] p-12 text-white relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute -left-20 -top-20 h-96 w-96 rounded-full bg-emerald-600/10 blur-3xl pointer-events-none" />
        <div className="absolute -right-20 -bottom-20 h-96 w-96 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />

        {/* Top Header & Home Navigation Control */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#081B15] border border-emerald-400/30 shadow-sm">
              <img src="/logo.png" alt="ClassVision AI Logo" className="h-full w-full object-contain" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold tracking-tight text-white">ClassVision AI</h2>
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#7E9F97]">Smart Classroom AI Portal</p>
            </div>
          </div>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3.5 py-2 text-xs font-semibold text-white hover:bg-white/20 transition backdrop-blur-sm"
            aria-label="Back to Homepage"
          >
            <FiArrowLeft size={14} />
            <span>Home</span>
          </Link>
        </div>

        {/* Center Illustration with ClassVision AI project aesthetic */}
        <div className="relative z-10 my-8 flex flex-col items-center">
          <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/15 shadow-2xl">
            <img
              src="/classvision_auth_hero.jpg"
              alt="ClassVision AI Smart Classroom Attendance"
              className="h-80 w-full object-cover brightness-95 transition-transform duration-700 hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0D251F] via-[#0D251F]/40 to-transparent" />
            <div className="absolute bottom-4 left-4 right-4 rounded-2xl bg-black/50 p-4 backdrop-blur-md border border-white/10">
              <p className="text-xs font-bold text-emerald-300 uppercase tracking-wide">Computer Vision Attendance</p>
              <p className="text-xs text-white/90 mt-1 leading-relaxed">
                Automated facial recognition verification, lecture session tracking, and institutional analytics.
              </p>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="relative z-10 text-xs text-[#7B9B8F]">
          Protected institutional portal. Computer vision features operate in compliance with campus security standards.
        </div>
      </div>

      {/* Right form column */}
      <div className="flex w-full lg:w-1/2 flex-col justify-center px-6 py-12 sm:px-12 lg:px-16 xl:px-24">
        <div className="mx-auto w-full max-w-md">
          {/* Back to Home link on desktop */}
          <div className="hidden lg:flex mb-6">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-ink transition"
              aria-label="Back to Homepage"
            >
              <FiArrowLeft size={14} />
              <span>Back to Homepage</span>
            </Link>
          </div>

          {/* Mobile brand header with Back to Home control */}
          <div className="lg:hidden mb-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white p-1.5 border border-line shadow-sm">
                <img src="/logo.png" alt="ClassVision AI Logo" className="h-full w-full object-contain" />
              </div>
              <div>
                <span className="font-display text-lg font-bold tracking-tight text-ink">ClassVision AI</span>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Smart Classroom</p>
              </div>
            </div>
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-muted hover:text-ink transition"
              aria-label="Back to Homepage"
            >
              <FiArrowLeft size={14} />
              <span>Home</span>
            </Link>
          </div>

          <div className="mb-8">
            <span className="inline-block rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800 border border-emerald-200/60 mb-3">
              Institutional Single Sign-On
            </span>
            <h1 className="text-3xl font-extrabold font-display tracking-tight text-ink">Welcome back</h1>
            <p className="mt-2 text-xs text-muted leading-relaxed">
              Sign in with your institutional credentials to manage classrooms, verify face attendance, and view real-time reports.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-3.5 text-xs font-semibold text-rose-700 animate-in fade-in">
                {error}
              </div>
            )}

            <FormField label="Email address" htmlFor="email">
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={form.email}
                onChange={handleChange}
                className={inputClass}
                placeholder="name@institution.edu"
              />
            </FormField>

            <FormField label="Password" htmlFor="password">
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={form.password}
                  onChange={handleChange}
                  className={`${inputClass} pr-11`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-muted hover:text-ink transition"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                </button>
              </div>
            </FormField>

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full !py-3 !text-sm !font-bold shadow-md hover:shadow-lg transition-all inline-flex items-center justify-center gap-2"
            >
              {submitting && <FiLoader size={18} className="animate-spin" />}
              {submitting ? 'Authenticating…' : 'Sign in to Portal'}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-muted">
            Institutional access only. Contact your academic administrator for account provisioning.
          </p>
        </div>
      </div>
    </div>
  )
}
