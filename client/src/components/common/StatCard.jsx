import { FiTrendingUp, FiTrendingDown } from 'react-icons/fi'

/**
 * Reusable summary KPI card for ClassVision AI dashboards.
 * Clean, medium-sized typography prevents overflows with long text (e.g. department names)
 * and keeps dashboard cards aligned and responsive across all viewports.
 */
export default function StatCard({
  title,
  label,
  name,
  value,
  icon: Icon,
  description,
  subtext,
  trend,
  trendType,
  colorScheme = 'emerald', // 'emerald' | 'purple' | 'amber' | 'blue' | 'rose'
}) {
  const displayTitle = title || label || name
  const displayDesc = description || subtext

  const isDown = trendType === 'down' || (typeof trend === 'string' && trend.trim().startsWith('-'))
  const isUp = trendType === 'up' || (typeof trend === 'string' && trend.trim().startsWith('+'))
  const TrendIcon = isDown ? FiTrendingDown : FiTrendingUp

  // Cohesive Light Green / Emerald theme system for cards
  const colorMap = {
    emerald: {
      icon: 'bg-emerald-50 text-emerald-800 border-emerald-200/80 shadow-[0_0_12px_rgba(5,150,105,0.12)]',
      bar: 'from-[#10B981] to-[#059669]',
    },
    // Subtle functional indicator variants (maintaining green bar accent)
    amber: {
      icon: 'bg-amber-50/80 text-amber-800 border-amber-200/70 shadow-[0_0_12px_rgba(217,119,6,0.10)]',
      bar: 'from-[#059669] to-amber-500',
    },
    rose: {
      icon: 'bg-rose-50/80 text-rose-800 border-rose-200/70 shadow-[0_0_12px_rgba(225,29,72,0.10)]',
      bar: 'from-[#059669] to-rose-500',
    },
    neutral: {
      icon: 'bg-emerald-50/60 text-emerald-900 border-emerald-200/60 shadow-[0_0_12px_rgba(5,150,105,0.08)]',
      bar: 'from-[#34D399] to-[#059669]',
    },
  }

  // Consistent green-primary theme: do not auto-force multicolour blue/purple
  let resolvedScheme = 'emerald'
  if (colorScheme === 'rose' || colorScheme === 'amber') {
    resolvedScheme = colorScheme
  } else if (colorScheme === 'neutral') {
    resolvedScheme = 'neutral'
  }

  const activeConf = colorMap[resolvedScheme] || colorMap.emerald

  // Adaptive font sizing: long names (e.g. Department names) use text-xl to avoid wrap/overflow
  const isLongValue = typeof value === 'string' && value.length > 10

  return (
    <div className="group relative overflow-hidden rounded-[20px] border border-line/90 bg-surface p-4 sm:p-5 shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover flex flex-col justify-between">
      {/* Top accent gradient shimmer line */}
      <div className={`absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r ${activeConf.bar} opacity-80 group-hover:opacity-100 transition-opacity`} />

      <div className="flex items-start justify-between">
        {Icon ? (
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${
              activeConf.icon
            } transition-transform duration-300 group-hover:scale-105`}
          >
            <Icon size={20} />
          </div>
        ) : (
          <div className="h-6" />
        )}
      </div>

      <div className="mt-3.5">
        <p className="text-xs font-bold uppercase tracking-wider text-muted truncate" title={displayTitle}>
          {displayTitle}
        </p>
        <p
          className={`mt-1 font-extrabold font-display tracking-tight text-ink ${
            isLongValue ? 'text-xl truncate' : 'text-2xl sm:text-3xl'
          }`}
          title={typeof value === 'string' ? value : undefined}
        >
          {value}
        </p>
      </div>

      {(displayDesc || trend) && (
        <div className="mt-2.5 flex items-center gap-1.5 text-xs">
          {trend && (
            <span
              className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-bold ${
                isDown
                  ? 'bg-rose-50 text-rose-700 border border-rose-200/60'
                  : 'bg-emerald-50 text-emerald-800 border border-emerald-200/60'
              }`}
            >
              <TrendIcon size={12} />
              <span>{trend}</span>
            </span>
          )}
          {displayDesc && (
            <span className="truncate text-muted text-xs font-normal" title={displayDesc}>
              {displayDesc}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

