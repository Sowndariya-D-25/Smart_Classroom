// Shared input wrapper for form fields across ClassVision AI
export default function FormField({ label, error, children, htmlFor }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-xs sm:text-sm font-semibold text-ink">
        {label}
      </label>
      {children}
      {error && <p className="mt-1.5 text-xs font-medium text-danger">{error}</p>}
    </div>
  )
}

export const inputClass =
  'w-full rounded-xl border border-line/90 bg-[#FAFCFA] px-3.5 py-2.5 text-xs sm:text-sm text-ink placeholder:text-muted/60 shadow-2xs transition-all focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 hover:border-slate-300'

