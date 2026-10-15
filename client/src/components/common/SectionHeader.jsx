// Consistent "title + optional subtitle + optional right-side action"
// header, reused above every dashboard section and feature page.
export default function SectionHeader({ title, subtitle, action, className = '' }) {
  return (
    <div className={`flex flex-wrap items-center justify-between gap-4 border-b border-line/80 pb-4 ${className}`}>
      <div>
        <h2 className="text-xl sm:text-2xl font-extrabold font-display tracking-tight text-ink">{title}</h2>
        {subtitle && <p className="mt-1 text-xs sm:text-sm text-muted font-normal leading-relaxed">{subtitle}</p>}
      </div>
      {action && <div className="flex items-center gap-2.5">{action}</div>}
    </div>
  )
}


