import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { FiX, FiLoader } from 'react-icons/fi'

/**
 * Shared modal chrome (overlay, header, close button, scrollable body,
 * and footer with Cancel/Submit action pair) used for Add/Edit forms in Admin.
 * Renders via React Portal directly into document.body to ensure true viewport-level
 * centering and prevent ancestor transform/overflow clipping issues.
 */
export default function AdminFormModal({
  title,
  open,
  onClose,
  onSubmit,
  submitting,
  submitLabel = 'Save',
  error,
  children,
  maxWidth = 'max-w-lg',
}) {
  useEffect(() => {
    if (!open) return undefined

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = originalOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 backdrop-blur-md bg-slate-900/60 overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Clickable backdrop overlay */}
      <button
        type="button"
        className="absolute inset-0 h-full w-full bg-[#091D17]/60 cursor-default focus:outline-none"
        aria-label="Close dialog overlay"
        onClick={onClose}
      />

      {/* Viewport-constrained modal card */}
      <div
        className={`relative flex max-h-[calc(100dvh-2rem)] w-full ${maxWidth} flex-col min-h-0 overflow-hidden rounded-[24px] border border-line/90 bg-surface shadow-2xl animate-in fade-in zoom-in-95 duration-200 z-10`}
      >
        {/* Sticky Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-line/80 bg-gradient-to-r from-[#F6FAF7] to-[#F4F8F5] px-6 py-4">
          <h2 className="text-base font-extrabold text-ink font-display tracking-tight">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-xl p-2 text-muted hover:bg-slate-200/60 hover:text-ink transition active:scale-95"
          >
            <FiX size={18} />
          </button>
        </div>

        {/* Form element with min-h-0 allowing internal flex shrinkage */}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            onSubmit()
          }}
          className="flex flex-1 flex-col min-h-0 overflow-hidden"
        >
          {/* Scrollable Form Body with min-h-0 */}
          <div className="flex-1 min-h-0 space-y-4 overflow-y-auto px-6 py-5">
            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50/80 px-4 py-2.5 text-xs font-semibold text-rose-700">
                {error}
              </div>
            )}
            {children}
          </div>

          {/* Sticky Action Footer */}
          <div className="flex shrink-0 justify-end gap-2.5 border-t border-line/80 bg-[#F8FAF7]/80 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary !px-4 !py-2 !text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary !px-5 !py-2 !text-xs font-bold inline-flex items-center gap-1.5 shadow-sm"
            >
              {submitting && <FiLoader size={16} className="animate-spin" />}
              {submitting ? 'Saving…' : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}

