// Consistent status pill styling used everywhere a status is shown
const STYLES = {
  Present: { bg: 'bg-emerald-50 text-emerald-800 border-emerald-200/80 shadow-2xs', dot: 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]' },
  Active: { bg: 'bg-emerald-50 text-emerald-800 border-emerald-200/80 shadow-2xs', dot: 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]' },
  Completed: { bg: 'bg-teal-50 text-teal-800 border-teal-200/80 shadow-2xs', dot: 'bg-teal-500' },
  Live: { bg: 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white border-transparent font-bold shadow-xs', dot: 'bg-white animate-ping' },
  Done: { bg: 'bg-slate-50 text-slate-700 border-slate-200', dot: 'bg-slate-400' },
  Upcoming: { bg: 'bg-indigo-50 text-indigo-800 border-indigo-200/80 shadow-2xs', dot: 'bg-indigo-500' },
  Absent: { bg: 'bg-rose-50 text-rose-800 border-rose-200/80 shadow-2xs', dot: 'bg-rose-500 shadow-[0_0_6px_rgba(239,68,68,0.4)]' },
  Inactive: { bg: 'bg-slate-50 text-slate-600 border-slate-200', dot: 'bg-slate-400' },
  'Low Attendance': { bg: 'bg-rose-50 text-rose-800 border-rose-200/80 shadow-2xs', dot: 'bg-rose-500 shadow-[0_0_6px_rgba(239,68,68,0.4)]' },
  Cancelled: { bg: 'bg-rose-50 text-rose-700 border-rose-200/60', dot: 'bg-rose-400' },
  Late: { bg: 'bg-amber-50 text-amber-800 border-amber-200/80 shadow-2xs', dot: 'bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.5)]' },
  Pending: { bg: 'bg-amber-50 text-amber-800 border-amber-200/80 shadow-2xs', dot: 'bg-amber-500' },
  Scheduled: { bg: 'bg-sky-50 text-sky-800 border-sky-200/80 shadow-2xs', dot: 'bg-sky-500' },
  OD: { bg: 'bg-purple-50 text-purple-800 border-purple-200/80 shadow-2xs', dot: 'bg-purple-500' },
}

export default function StatusBadge({ status }) {
  const conf = STYLES[status] || { bg: 'bg-slate-50 text-slate-600 border-slate-200', dot: 'bg-slate-400' }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-wide transition-all ${conf.bg}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${conf.dot}`} />
      <span>{status}</span>
    </span>
  )
}

