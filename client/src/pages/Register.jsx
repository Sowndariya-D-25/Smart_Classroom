import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, ScanFace, LoaderCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import FormField, { inputClass } from '../components/FormField'

/**
 * Public registration always creates a `student` account — there is no
 * role selector here on purpose. See docs/AUTHENTICATION.md ("Why
 * registration can't set role") for the reasoning: letting a public form
 * choose `admin` (or even `teacher`) would let anyone grant themselves
 * elevated access, and the backend ignores this field anyway even if a
 * request were crafted by hand.
 */
export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setFieldErrors({})

    if (form.password !== form.confirmPassword) {
      setFieldErrors({ confirmPassword: 'Passwords do not match' })
      return
    }

    setSubmitting(true)
    try {
      await register({ name: form.name, email: form.email, password: form.password })
      navigate('/student/dashboard', { replace: true })
    } catch (err) {
      const apiErrors = err.response?.data?.errors
      if (apiErrors?.length) {
        setFieldErrors(Object.fromEntries(apiErrors.map((e) => [e.field, e.message])))
      } else {
        setError(err.response?.data?.message || 'Could not create your account. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F6F9F7] px-4 py-12 relative overflow-hidden">
      {/* Ambient background light */}
      <div className="absolute top-10 -left-20 h-80 w-80 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 -right-20 h-80 w-80 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <Link to="/" className="inline-flex items-center gap-3 transition-transform hover:scale-105 mb-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#081B15] border border-emerald-400/30 shadow-xs">
              <img src="/logo.png" alt="ClassVision AI Logo" className="h-full w-full object-contain" />
            </div>
            <div className="text-left">
              <span className="block font-black text-2xl font-display tracking-tight text-ink leading-tight">ClassVision AI</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Student Portal</span>
            </div>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-black font-display tracking-tight text-ink">Create your account</h1>
          <p className="mt-1.5 text-xs sm:text-sm text-muted">Student self-enrollment for attendance tracking</p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-[24px] border border-line/90 bg-white p-7 sm:p-8 shadow-card space-y-4">
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">
              {error}
            </div>
          )}

          <FormField label="Full name" htmlFor="name" error={fieldErrors.name}>
            <input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              required
              value={form.name}
              onChange={handleChange}
              className={inputClass}
              placeholder="Jordan Lee"
            />
          </FormField>

          <FormField label="Email address" htmlFor="email" error={fieldErrors.email}>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={form.email}
              onChange={handleChange}
              className={inputClass}
              placeholder="you@institution.edu"
            />
          </FormField>

          <FormField label="Password" htmlFor="password" error={fieldErrors.password}>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                value={form.password}
                onChange={handleChange}
                className={`${inputClass} pr-10`}
                placeholder="At least 8 characters"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-muted hover:text-ink transition"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <p className="mt-1.5 text-xs text-muted">
              8+ characters, with an uppercase letter, a lowercase letter, and a number.
            </p>
          </FormField>

          <FormField label="Confirm password" htmlFor="confirmPassword" error={fieldErrors.confirmPassword}>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required
              value={form.confirmPassword}
              onChange={handleChange}
              className={inputClass}
              placeholder="Re-enter your password"
            />
          </FormField>

          <button type="submit" disabled={submitting} className="btn-primary w-full !py-3 justify-center !text-sm !font-bold shadow-md hover:shadow-lg mt-2">
            {submitting && <LoaderCircle size={16} className="animate-spin" />}
            {submitting ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-muted">
          Already have an account?{' '}
          <Link to="/login" className="font-bold text-primary hover:underline">
            Sign in to Portal
          </Link>
        </p>
      </div>
    </div>
  )
}

