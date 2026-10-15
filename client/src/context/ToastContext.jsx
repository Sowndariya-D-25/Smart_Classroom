import { createContext, useCallback, useContext, useState } from 'react'
import { CheckCircle2, XCircle, X } from 'lucide-react'

const ToastContext = createContext(null)
let nextId = 1

/**
 * Minimal toast/notification system — no library, just enough to satisfy
 * "the user must know when an operation succeeds/fails" across the Admin
 * module (and reusable by any later phase). Call useToast() anywhere
 * inside <ToastProvider>.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => {
    setToasts((t) => t.filter((toast) => toast.id !== id))
  }, [])

  const push = useCallback(
    (message, type = 'success') => {
      const id = nextId++
      setToasts((t) => [...t, { id, message, type }])
      setTimeout(() => dismiss(id), 4000)
    },
    [dismiss],
  )

  const toast = {
    success: (message) => push(message, 'success'),
    error: (message) => push(message, 'error'),
  }

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4 sm:items-end sm:right-4 sm:left-auto">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-md border px-3.5 py-3 shadow-lg sm:w-96 ${
              t.type === 'error' ? 'border-danger/30 bg-white' : 'border-primary/20 bg-white'
            }`}
          >
            {t.type === 'error' ? (
              <XCircle size={18} className="mt-0.5 shrink-0 text-danger" />
            ) : (
              <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-primary-600" />
            )}
            <p className="flex-1 text-sm text-ink">{t.message}</p>
            <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="text-muted hover:text-ink">
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used within a <ToastProvider>')
  }
  return ctx
}
