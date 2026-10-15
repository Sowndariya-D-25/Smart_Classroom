export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[22px] border border-dashed border-line/90 bg-[#F8FAF8] px-6 py-14 text-center">
      {Icon && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-line/80 bg-white text-primary shadow-xs">
          <Icon size={26} strokeWidth={2} />
        </div>
      )}
      <h3 className="text-base font-extrabold font-display text-ink">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-xs sm:text-sm leading-relaxed text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

