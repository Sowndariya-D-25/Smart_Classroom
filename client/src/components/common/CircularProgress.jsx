// Lightweight SVG circular progress ring with gradient stroke & soft glow
export default function CircularProgress({
  percentage = 0,
  size = 140,
  strokeWidth = 11,
  label = '',
}) {
  const validPercent = Math.min(100, Math.max(0, Number(percentage) || 0))
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (validPercent / 100) * circumference
  const isGood = validPercent >= 75
  const gradientId = `circle-grad-${validPercent >= 75 ? 'emerald' : 'rose'}`

  return (
    <div className="relative inline-flex items-center justify-center transition-transform hover:scale-105 duration-300">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <defs>
          <linearGradient id="circle-grad-emerald" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#34D399" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
          <linearGradient id="circle-grad-rose" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FB7185" />
            <stop offset="100%" stopColor="#E11D48" />
          </linearGradient>
        </defs>

        {/* Track Circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          stroke="#E6ECE7"
          className="fill-none opacity-80"
        />

        {/* Progress Arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          stroke={`url(#${gradientId})`}
          className="fill-none transition-all duration-1000 ease-out"
          style={{
            filter: isGood
              ? 'drop-shadow(0 2px 6px rgba(16, 185, 129, 0.35))'
              : 'drop-shadow(0 2px 6px rgba(244, 63, 94, 0.35))',
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="font-display text-3xl font-black tracking-tight text-ink">
          {validPercent}%
        </span>
        {label && (
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-muted mt-0.5">
            {label}
          </span>
        )}
      </div>
    </div>
  )
}

