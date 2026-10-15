import { FiPlus } from 'react-icons/fi'

export default function AdminPageHeader({ title, subtitle, actionLabel, onAction }) {
  // Strip any accidental leading "+ " so we guarantee exactly one plus icon
  const labelText = typeof actionLabel === 'string' ? actionLabel.replace(/^\+\s*/, '') : actionLabel

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line/80 pb-5">
      <div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-primary">Administration</span>
        </div>
        <h1 className="mt-1 text-2xl sm:text-3xl font-black font-display tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-xs sm:text-sm text-muted font-normal leading-relaxed">{subtitle}</p>}
      </div>
      {actionLabel && (
        <button
          onClick={onAction}
          className="btn-primary inline-flex items-center gap-2 !px-4.5 !py-2.5 !text-xs !font-bold shadow-sm hover:shadow-md transition-all active:scale-95"
        >
          <FiPlus className="h-4 w-4 stroke-[2.5]" />
          <span>{labelText}</span>
        </button>
      )}
    </div>
  )
}

