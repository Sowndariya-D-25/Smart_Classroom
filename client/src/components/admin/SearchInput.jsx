import { Search } from 'lucide-react'

export default function SearchInput({ value, onChange, placeholder = 'Search…' }) {
  return (
    <div className="relative max-w-xs flex-1">
      <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted/70" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full rounded-xl border border-line/90 bg-[#FAFCFA] py-2 pl-10 pr-3.5 text-xs text-ink placeholder:text-muted/60 shadow-2xs transition-all focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 hover:border-slate-300"
      />
    </div>
  )
}

