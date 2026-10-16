import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  FiShield,
  FiEye,
  FiEyeOff,
  FiKey,
  FiArrowLeft,
  FiCheckCircle,
  FiAlertTriangle,
  FiLock,
  FiLoader,
  FiInfo,
  FiRefreshCw,
  FiDatabase,
} from 'react-icons/fi'
import { getAdminSetupStatus, setupAdmin } from '../services/authService'
import { getApiBaseUrl } from '../services/api'
import FormField, { inputClass } from '../components/FormField'

export default function AdminSetup() {
  const navigate = useNavigate()

  const [statusLoading, setStatusLoading] = useState(true)
  const [statusData, setStatusData] = useState(null)
  const [statusError, setStatusError] = useState(null)
  const [statusTargetUrl, setStatusTargetUrl] = useState('')
  const [statusErrorDetails, setStatusErrorDetails] = useState(null)

  const [form, setForm] = useState({
    name: '',
    email: '',
    department: 'CSE',
    password: '',
    confirmPassword: '',
    setupKey: '',
  })

  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [showSetupKey, setShowSetupKey] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})
  const [success, setSuccess] = useState(false)

  // Verify backend setup availability and existing admin status on mount or retry
  const checkStatus = useCallback(() => {
    setStatusLoading(true)
    setStatusError(null)
    setStatusErrorDetails(null)
    const targetUrl = `${getApiBaseUrl()}/auth/setup/status`
    setStatusTargetUrl(targetUrl)

    getAdminSetupStatus()
      .then((data) => {
        setStatusData(data)
        setStatusLoading(false)
      })
      .catch((err) => {
        if (err.response) {
          const status = err.response.status
          const serverMsg = err.response.data?.message
          if (serverMsg) {
            setStatusError(serverMsg)
          } else if (status === 404) {
            setStatusError(`Setup endpoint not found (HTTP 404) at ${targetUrl}.`)
            setStatusErrorDetails(
              'The backend route /api/auth/setup/status was not found. Please ensure VITE_API_URL in Vercel includes the /api path.',
            )
          } else if (status === 502 || status === 503 || status === 504) {
            setStatusError(`Backend service is temporarily unavailable (HTTP ${status}).`)
            setStatusErrorDetails(
              'Render free-tier instances sleep after inactivity. It may take 30–60 seconds for the backend to start up. Please wait and click "Retry Connection".',
            )
          } else {
            setStatusError(`Backend returned error status ${status}.`)
          }
        } else {
          // No response: Network Error, CORS rejection, DNS failure, or sleeping backend
          setStatusError('Unable to connect to the backend API.')
          setStatusErrorDetails(
            `Target endpoint: ${targetUrl}\n\n` +
              'Likely causes:\n' +
              '1. CORS policy: Render backend must allow your Vercel frontend origin in CLIENT_URL or ALLOWED_ORIGINS.\n' +
              '2. Render free tier sleep: If inactive for 15+ minutes, Render takes ~30–60 seconds to spin up. Please wait and click "Retry Connection".\n' +
              '3. Vercel build variable: Ensure VITE_API_URL is set in Vercel to https://smart-classroom-1-gv3a.onrender.com/api and redeployed.',
          )
        }
        setStatusLoading(false)
      })
  }, [])

  useEffect(() => {
    checkStatus()
  }, [checkStatus])

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: null }))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setFieldErrors({})

    // Client-side quick validation
    const clientErrors = {}
    if (!form.name.trim()) clientErrors.name = 'Full name is required'
    if (!form.email.trim()) clientErrors.email = 'Email address is required'
    if (!form.setupKey.trim()) clientErrors.setupKey = 'Admin setup key is required'
    if (form.password.length < 8) clientErrors.password = 'Password must be at least 8 characters'
    if (form.password !== form.confirmPassword) {
      clientErrors.confirmPassword = 'Passwords do not match'
    }

    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors)
      return
    }

    setSubmitting(true)
    try {
      await setupAdmin({
        name: form.name.trim(),
        email: form.email.trim(),
        department: form.department.trim() || 'CSE',
        password: form.password,
        confirmPassword: form.confirmPassword,
        setupKey: form.setupKey.trim(),
      })

      setSuccess(true)
      // Redirect to login after 3 seconds so the admin can test sign-in
      setTimeout(() => {
        navigate('/login', {
          replace: true,
          state: { setupSuccess: true, email: form.email.trim() },
        })
      }, 3000)
    } catch (err) {
      const apiErrors = err.response?.data?.errors
      if (apiErrors?.length) {
        setFieldErrors(Object.fromEntries(apiErrors.map((item) => [item.field, item.message])))
      } else if (err.response?.data?.message) {
        setError(err.response.data.message)
      } else if (!err.response) {
        setError(
          `Network or CORS error connecting to ${getApiBaseUrl()}/auth/setup. Ensure your Render backend is running and allows requests from your Vercel domain.`,
        )
      } else {
        setError(
          `Server returned status ${err.response.status}. Could not complete administrator setup.`,
        )
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F6F9F7] px-4 py-12 relative overflow-hidden text-ink">
      {/* Ambient background glows */}
      <div className="absolute top-10 -left-20 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 -right-20 h-96 w-96 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-xl">
        {/* Navigation & Brand Header */}
        <div className="mb-6 flex flex-col items-center text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-3 transition-transform hover:scale-105 mb-3"
            aria-label="Back to Homepage"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#081B15] border border-emerald-400/30 shadow-xs">
              <img src="/logo.png" alt="ClassVision AI Logo" className="h-full w-full object-contain" />
            </div>
            <div className="text-left">
              <span className="block font-black text-2xl font-display tracking-tight text-ink leading-tight">
                ClassVision AI
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
                Institutional Setup Portal
              </span>
            </div>
          </Link>

          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200/80 px-3 py-1 text-xs font-semibold text-emerald-800">
            <FiShield size={13} className="text-emerald-600" />
            <span>First-Time Administrator Provisioning</span>
          </div>
          <h1 className="mt-3 text-2xl sm:text-3xl font-black font-display tracking-tight text-ink">
            Admin Account Initialization
          </h1>
          <p className="mt-1.5 text-xs sm:text-sm text-muted max-w-md">
            Create the primary administrator account for this instance. This setup portal automatically locks once the initial admin is registered.
          </p>
        </div>

        {/* Card Content */}
        <div className="rounded-[24px] border border-line/90 bg-white p-7 sm:p-9 shadow-card">
          {/* Loading status */}
          {statusLoading && (
            <div className="py-12 text-center">
              <FiLoader size={32} className="animate-spin mx-auto text-primary" />
              <p className="mt-3 text-xs font-semibold text-muted">Checking database and setup eligibility…</p>
            </div>
          )}

          {/* Backend Connection Error */}
          {!statusLoading && statusError && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50/90 p-5 text-center">
              <FiAlertTriangle size={28} className="mx-auto text-rose-600 mb-2" />
              <h2 className="text-sm font-bold text-rose-900">Service Unreachable</h2>
              <p className="mt-1 text-xs text-rose-700 leading-relaxed font-semibold">{statusError}</p>

              {statusTargetUrl && (
                <div className="mt-3 rounded-lg bg-white/90 border border-rose-200 p-2 text-[11px] font-mono text-slate-700 break-all text-left">
                  <span className="font-bold text-slate-500">Target Endpoint: </span>
                  {statusTargetUrl}
                </div>
              )}

              {statusErrorDetails && (
                <div className="mt-2 text-left rounded-xl bg-white/90 border border-rose-200/80 p-3 text-[11px] text-slate-700 whitespace-pre-line leading-relaxed">
                  {statusErrorDetails}
                </div>
              )}

              <div className="mt-4 flex justify-center gap-3">
                <button
                  type="button"
                  onClick={checkStatus}
                  className="btn-primary !py-2 !px-4 !text-xs font-bold inline-flex items-center gap-1.5"
                >
                  <FiRefreshCw size={13} />
                  <span>Retry Connection</span>
                </button>
                <Link to="/login" className="btn-secondary !py-2 !px-4 !text-xs font-bold">
                  Go to Login
                </Link>
              </div>
            </div>
          )}

          {/* Case 0: MongoDB Database Connection Not Ready */}
          {!statusLoading && !statusError && statusData?.dbConnected === false && (
            <div className="py-4 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 shadow-xs">
                <FiDatabase size={26} />
              </div>
              <h2 className="text-lg font-bold text-ink">MongoDB Database Connection Failed</h2>
              <p className="mt-2 text-xs sm:text-sm text-muted leading-relaxed max-w-md mx-auto">
                {statusData?.message ||
                  'The backend is running, but cannot establish a connection to MongoDB Atlas.'}
              </p>
              <div className="mt-4 text-left rounded-xl bg-slate-50 border border-slate-200 p-4 text-xs space-y-2 text-slate-700">
                <p className="font-semibold text-slate-900 flex items-center gap-1.5">
                  <FiInfo size={14} className="text-slate-600 shrink-0" />
                  Troubleshooting Checklist:
                </p>
                <ol className="list-decimal list-inside space-y-1 text-slate-600 text-[11px] leading-relaxed">
                  <li>Verify <strong>MONGO_URI</strong> or <strong>MONGODB_URI</strong> is set in Render Environment Variables.</li>
                  <li>In MongoDB Atlas &gt; <strong>Network Access</strong>, ensure IP <code>0.0.0.0/0</code> is allowed.</li>
                  <li>In MongoDB Atlas &gt; <strong>Database Access</strong>, ensure the username and password in the connection string are correct.</li>
                </ol>
              </div>
              <div className="mt-6 flex justify-center gap-3">
                <button
                  type="button"
                  onClick={checkStatus}
                  className="btn-primary !py-2.5 !px-5 !text-xs font-bold inline-flex items-center gap-1.5"
                >
                  <FiRefreshCw size={13} />
                  <span>Retry Connection</span>
                </button>
                <Link to="/login" className="btn-secondary !py-2.5 !px-4 !text-xs font-bold">
                  Go to Login
                </Link>
              </div>
            </div>
          )}

          {/* Case 1: Admin Already Exists (Setup permanently locked) */}
          {!statusLoading && !statusError && statusData?.adminExists && (
            <div className="py-4 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 shadow-xs">
                <FiLock size={26} />
              </div>
              <h2 className="text-lg font-bold text-ink">Admin Account Already Initialized</h2>
              <p className="mt-2 text-xs sm:text-sm text-muted leading-relaxed max-w-md mx-auto">
                An administrator account is already registered in MongoDB Atlas. For institutional security, initial admin setup is permanently closed.
              </p>
              <div className="mt-5 rounded-xl bg-[#F8FAF7] border border-line p-3 text-xs text-[#52796F]">
                If you already have credentials, sign in through the primary institutional login portal.
              </div>
              <div className="mt-6 flex justify-center gap-3">
                <Link
                  to="/login"
                  className="btn-primary !py-2.5 !px-6 !text-xs !font-bold inline-flex items-center gap-2 shadow-sm"
                >
                  <span>Go to Login Page</span>
                </Link>
                <Link to="/" className="btn-secondary !py-2.5 !px-4 !text-xs font-bold">
                  Back to Home
                </Link>
              </div>
            </div>
          )}

          {/* Case 2: ADMIN_SETUP_KEY not set on server */}
          {!statusLoading && !statusError && !statusData?.adminExists && !statusData?.hasSetupKey && (
            <div className="py-4 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 shadow-xs">
                <FiKey size={26} />
              </div>
              <h2 className="text-lg font-bold text-ink">Setup Key Not Configured on Server</h2>
              <p className="mt-2 text-xs sm:text-sm text-muted leading-relaxed max-w-md mx-auto">
                The backend server requires an environment variable named <code className="rounded bg-rose-100/80 px-1.5 py-0.5 font-mono text-[11px] text-rose-800">ADMIN_SETUP_KEY</code> before admin creation can be unlocked.
              </p>
              <div className="mt-4 text-left rounded-xl bg-slate-50 border border-slate-200 p-4 text-xs space-y-2 text-slate-700">
                <p className="font-semibold text-slate-900 flex items-center gap-1.5">
                  <FiInfo size={14} className="text-slate-600 shrink-0" />
                  How to enable on Render:
                </p>
                <ol className="list-decimal list-inside space-y-1 text-slate-600 text-[11px] leading-relaxed">
                  <li>Go to your Render Dashboard &gt; Backend Web Service.</li>
                  <li>Click <strong>Environment</strong> &gt; <strong>Add Environment Variable</strong>.</li>
                  <li>Key: <code className="font-mono font-bold">ADMIN_SETUP_KEY</code>, Value: <em>any secure passphrase</em>.</li>
                  <li>Save changes (Render will automatically redeploy), then refresh this page.</li>
                </ol>
              </div>
              <div className="mt-6 flex justify-center gap-3">
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="btn-primary !py-2.5 !px-5 !text-xs font-bold"
                >
                  Refresh Page
                </button>
                <Link to="/login" className="btn-secondary !py-2.5 !px-4 !text-xs font-bold">
                  Cancel
                </Link>
              </div>
            </div>
          )}

          {/* Case 3: Success Screen */}
          {success && (
            <div className="py-6 text-center animate-in fade-in zoom-in-95 duration-300">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 shadow-xs">
                <FiCheckCircle size={28} />
              </div>
              <h2 className="text-xl font-black font-display text-ink">Administrator Created Successfully!</h2>
              <p className="mt-2 text-xs sm:text-sm text-muted max-w-md mx-auto">
                Your primary institutional admin account has been registered and initialized in the database.
              </p>
              <div className="mt-4 rounded-xl bg-emerald-50/80 border border-emerald-200/80 p-3.5 text-xs text-emerald-800">
                <p className="font-semibold">Account: {form.email}</p>
                <p className="mt-0.5 text-[11px] text-emerald-700">Redirecting to login portal in a few seconds…</p>
              </div>
              <div className="mt-6">
                <Link
                  to="/login"
                  state={{ setupSuccess: true, email: form.email }}
                  className="btn-primary w-full !py-3 !text-sm !font-bold inline-flex items-center justify-center gap-2 shadow-sm"
                >
                  <span>Sign In Now with New Admin Account</span>
                </Link>
              </div>
            </div>
          )}

          {/* Case 4: Setup Form (Active and ready) */}
          {!statusLoading &&
            !statusError &&
            statusData?.dbConnected !== false &&
            !statusData?.adminExists &&
            statusData?.hasSetupKey &&
            !success && (
              <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50/90 p-3.5 text-xs font-semibold text-rose-700 flex items-start gap-2">
                  <FiAlertTriangle size={15} className="shrink-0 mt-0.5 text-rose-600" />
                  <span>{error}</span>
                </div>
              )}

              <div className="rounded-xl bg-emerald-50/70 border border-emerald-200/60 p-3 text-xs text-emerald-800 flex items-center gap-2">
                <FiShield size={16} className="text-emerald-700 shrink-0" />
                <span>
                  Authorized institutional setup: this endpoint registers the root administrator with full management access.
                </span>
              </div>

              {/* Admin Setup Key */}
              <FormField
                label="Admin Setup Key (configured in Render backend env)"
                htmlFor="setupKey"
                error={fieldErrors.setupKey}
              >
                <div className="relative">
                  <input
                    id="setupKey"
                    name="setupKey"
                    type={showSetupKey ? 'text' : 'password'}
                    autoComplete="off"
                    required
                    value={form.setupKey}
                    onChange={handleChange}
                    className={`${inputClass} pr-10 font-mono`}
                    placeholder="Enter the secret ADMIN_SETUP_KEY value"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSetupKey((s) => !s)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-muted hover:text-ink transition"
                    aria-label={showSetupKey ? 'Hide setup key' : 'Show setup key'}
                  >
                    {showSetupKey ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                  </button>
                </div>
                <p className="mt-1 text-[11px] text-muted">
                  Must match the backend <code className="font-mono">ADMIN_SETUP_KEY</code> environment variable exactly.
                </p>
              </FormField>

              {/* Admin Name & Department in 2 cols */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label="Administrator Full Name" htmlFor="name" error={fieldErrors.name}>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    required
                    value={form.name}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder="Dr. Eleanor Vance"
                  />
                </FormField>

                <FormField label="Department (Optional)" htmlFor="department" error={fieldErrors.department}>
                  <input
                    id="department"
                    name="department"
                    type="text"
                    value={form.department}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder="CSE"
                  />
                </FormField>
              </div>

              {/* Admin Email */}
              <FormField label="Institutional Admin Email" htmlFor="email" error={fieldErrors.email}>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={form.email}
                  onChange={handleChange}
                  className={inputClass}
                  placeholder="admin@institution.edu"
                />
              </FormField>

              {/* Password */}
              <FormField label="Admin Password" htmlFor="password" error={fieldErrors.password}>
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
                    {showPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                  </button>
                </div>
                <p className="mt-1 text-[11px] text-muted">
                  8+ characters, including at least one uppercase letter, one lowercase letter, and one number.
                </p>
              </FormField>

              {/* Confirm Password */}
              <FormField
                label="Confirm Admin Password"
                htmlFor="confirmPassword"
                error={fieldErrors.confirmPassword}
              >
                <div className="relative">
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    value={form.confirmPassword}
                    onChange={handleChange}
                    className={`${inputClass} pr-10`}
                    placeholder="Re-enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((s) => !s)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-muted hover:text-ink transition"
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                  </button>
                </div>
              </FormField>

              {/* Submit button */}
              <button
                type="submit"
                disabled={submitting}
                className="btn-primary w-full !py-3 !text-sm !font-bold shadow-md hover:shadow-lg mt-3 inline-flex items-center justify-center gap-2"
              >
                {submitting && <FiLoader size={18} className="animate-spin" />}
                {submitting ? 'Creating Administrator Account…' : 'Create Administrator Account'}
              </button>

              <div className="mt-4 flex items-center justify-between pt-2 border-t border-line text-xs">
                <Link
                  to="/login"
                  className="text-muted hover:text-ink font-semibold inline-flex items-center gap-1 transition"
                >
                  <FiArrowLeft size={13} />
                  <span>Return to Sign In</span>
                </Link>
                <span className="text-[11px] text-muted">ClassVision AI Governance</span>
              </div>
            </form>
          )}
        </div>

        {/* Back to Home and Login Links */}
        <div className="mt-6 text-center text-xs text-muted flex items-center justify-center gap-4">
          <Link to="/login" className="font-bold text-primary hover:underline">
            Go to Institutional Sign In
          </Link>
          <span>·</span>
          <Link to="/" className="text-muted hover:text-ink">
            Portal Homepage
          </Link>
        </div>
      </div>
    </div>
  )
}
