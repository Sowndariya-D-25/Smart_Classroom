import { NavLink } from 'react-router-dom'
import { FiLogOut } from 'react-icons/fi'
import { useAuth } from '../../context/AuthContext'
import { navigationByRole } from '../../constants/navigation'

/**
 * ClassVision AI Navigation Sidebar with deep pine obsidian glass theme,
 * official brand logo, and intuitive role-based navigation.
 */
export default function Sidebar({ onNavigate }) {
  const { user, logout } = useAuth()
  const sections = navigationByRole[user?.role] || []
  const initial = (user?.name || '?').trim().charAt(0).toUpperCase()

  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-[#091D17] via-[#0D251F] to-[#0A1E18] text-white select-none border-r border-[#16382E] shadow-xl">
      {/* Brand Header with ClassVision AI Logo */}
      <div className="flex items-center gap-3.5 px-5 py-5 border-b border-[#1A4237]/80 bg-[#081B15]/50 backdrop-blur-sm">
        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#081B15] border border-emerald-400/30 shadow-[0_0_15px_rgba(16,185,129,0.25)] transition-transform hover:scale-105">
          <img src="/logo.png" alt="ClassVision AI Logo" className="h-full w-full object-contain" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-display text-base font-extrabold tracking-tight text-white drop-shadow-xs">
              ClassVision AI
            </span>
          </div>
          <p className="truncate text-[10px] font-bold uppercase tracking-widest text-[#6EE7B7]/90">
            Smart Attendance
          </p>
        </div>
      </div>

      {/* Navigation Groups */}
      <nav className="flex-1 overflow-y-auto px-3.5 py-4 space-y-6">
        {sections.map((section, idx) => (
          <div key={section.section || `section-${idx}`}>
            <p className="px-3 pb-2 text-[10px] font-extrabold uppercase tracking-wider text-[#63877C] flex items-center gap-1.5">
              <span className="h-1 w-1 rounded-full bg-[#10B981]/60" />
              <span>{section.section || 'Workspace'}</span>
            </p>
            <ul className="space-y-1">
              {section.items.map(({ label, to, icon: Icon }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      `group relative flex items-center justify-between rounded-xl px-3 py-2.5 text-xs sm:text-sm transition-all duration-200 ${
                        isActive
                          ? 'bg-gradient-to-r from-[#174A3C] to-[#205E4D] text-white font-semibold shadow-[0_2px_12px_rgba(16,185,129,0.18)] border-l-2 border-[#34D399]'
                          : 'text-[#92ADA3] hover:bg-[#14352C] hover:text-white font-medium hover:translate-x-0.5'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <div className="flex items-center gap-3 truncate">
                          <Icon
                            size={18}
                            className={`shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                              isActive ? 'text-[#34D399]' : 'text-[#7D9F92] group-hover:text-white'
                            }`}
                          />
                          <span className="truncate">{label}</span>
                        </div>
                        {label === 'Attendance' && (
                          <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-gradient-to-r from-amber-500 to-amber-600 px-1.5 text-[10px] font-extrabold text-white shadow-xs animate-pulse">
                            Live
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* User Footer & Logout */}
      <div className="border-t border-[#183D32] p-3.5 bg-[#081B15]/80 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-2 rounded-2xl bg-white/[0.04] border border-white/[0.08] p-2 hover:bg-white/[0.07] transition-all">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#10B981] to-[#047857] shadow-[0_0_12px_rgba(16,185,129,0.3)] text-xs font-black text-white">
              {initial}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-white">{user?.name || 'User'}</p>
              <p className="truncate text-[10px] capitalize font-medium text-[#7E9F94]">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={logout}
            title="Logout"
            aria-label="Logout"
            className="rounded-xl p-2 text-[#85A297] transition hover:bg-rose-950/80 hover:text-rose-300 active:scale-95"
          >
            <FiLogOut size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
