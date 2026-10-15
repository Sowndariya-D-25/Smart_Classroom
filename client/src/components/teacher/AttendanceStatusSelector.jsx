const BASE_OPTIONS = [
  { value: 'Present', activeClass: 'bg-emerald-600 text-white font-bold shadow-2xs' },
  { value: 'Late', activeClass: 'bg-amber-600 text-white font-bold shadow-2xs' },
  { value: 'Absent', activeClass: 'bg-rose-600 text-white font-bold shadow-2xs' },
]

export default function AttendanceStatusSelector({ value, onChange, approvedException }) {
  const options = [...BASE_OPTIONS]

  if (approvedException?.type === 'OD' || value === 'OD') {
    options.push({
      value: 'OD',
      activeClass: 'bg-indigo-600 text-white font-bold shadow-2xs',
      badgeClass: 'text-indigo-700 hover:bg-indigo-50',
    })
  }

  if (approvedException?.type === 'Leave' || value === 'Leave') {
    options.push({
      value: 'Leave',
      activeClass: 'bg-purple-600 text-white font-bold shadow-2xs',
      badgeClass: 'text-purple-700 hover:bg-purple-50',
    })
  }

  return (
    <div className="inline-flex rounded-xl border border-line bg-[#F8FAF7] p-1 text-xs font-semibold gap-0.5">
      {options.map((opt) => {
        const isActive = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`rounded-lg px-2.5 py-1 transition-all ${
              isActive
                ? opt.activeClass
                : opt.badgeClass || 'text-muted hover:text-ink hover:bg-white/60'
            }`}
          >
            {opt.value}
          </button>
        )
      })}
    </div>
  )
}
