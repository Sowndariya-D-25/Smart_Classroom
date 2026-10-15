import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, LoaderCircle } from 'lucide-react'

/**
 * Used before any destructive/status-changing action (deactivate,
 * delete). Never fires the action on the first click — this dialog is
 * the confirmation step. Rendered via React portal directly to body.
 */
export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  onConfirm,
  onCancel,
  loading,
  danger = true,
}) {
  useEffect(() => {
    if (!open) return undefined

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = originalOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onCancel])

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md bg-slate-900/60 overflow-hidden"
      role="alertdialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        className="absolute inset-0 h-full w-full bg-[#091D17]/60 cursor-default focus:outline-none"
        aria-label="Cancel dialog overlay"
        onClick={onCancel}
      />
      <div className="relative w-full max-w-sm rounded-[24px] border border-line/90 bg-surface p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200 z-10">
        <div className="flex items-start gap-4">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
              danger
                ? 'bg-rose-50 text-rose-600 border border-rose-200/60 shadow-xs'
                : 'bg-primary-50 text-primary-700 border border-primary-200/60 shadow-xs'
            }`}
          >
            <AlertTriangle size={24} />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-ink font-display">{title}</h2>
            {description && <p className="mt-1 text-xs leading-relaxed text-muted">{description}</p>}
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="btn-secondary !px-4 !py-2 !text-xs font-semibold"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`btn-primary !px-4 !py-2 !text-xs font-bold ${
              danger
                ? '!bg-gradient-to-r !from-rose-600 !to-rose-700 hover:!from-rose-700 hover:!to-rose-800'
                : ''
            }`}
          >
            {loading && <LoaderCircle size={16} className="animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

