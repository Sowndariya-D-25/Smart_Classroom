// Row of <select> filters, driven by a config array
export default function FilterBar({ filters, values, onChange }) {
  if (!filters?.length) return null
  return (
    <div className="flex flex-wrap gap-2.5 items-center">
      {filters.map((filter) => (
        <select
          key={filter.key}
          value={values[filter.key] || ''}
          onChange={(e) => onChange(filter.key, e.target.value)}
          aria-label={filter.label}
          className="rounded-xl border border-line/90 bg-[#FAFCFA] px-3.5 py-2 text-xs font-semibold text-ink shadow-2xs transition-all focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 hover:border-slate-300 cursor-pointer"
        >
          <option value="">{filter.label}</option>
          {filter.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ))}
    </div>
  )
}

