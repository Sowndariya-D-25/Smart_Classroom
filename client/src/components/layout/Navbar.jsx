import { useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  FiMenu,
  FiBell,
  FiChevronDown,
  FiUser,
  FiLogOut,
  FiSearch,
  FiCommand,
} from 'react-icons/fi'
import { useAuth } from '../../context/AuthContext'
import Breadcrumbs from './Breadcrumbs'
import { getTeacherNotificationUnreadCount } from '../../services/teacherService'
import { getStudentNotificationUnreadCount } from '../../services/studentService'

export default function Navbar({ onMenuClick }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const menuRef = useRef(null)
  const searchInputRef = useRef(null)
  const initial = (user?.name || '?').trim().charAt(0).toUpperCase()

  // Format today's date e.g. "October 11, 2026"
  const formattedToday = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date())

  // Ctrl+K / Cmd+K keyboard shortcut to focus search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Fetch real unread notification count for teachers and students from MongoDB
  useEffect(() => {
    if (user?.role !== 'teacher' && user?.role !== 'student') return undefined

    let isMounted = true
    const fetchUnread = () => {
      const fetcher =
        user.role === 'teacher'
          ? getTeacherNotificationUnreadCount
          : getStudentNotificationUnreadCount

      fetcher()
        .then((data) => {
          if (isMounted && data) {
            setUnreadCount(data.unreadCount || 0)
          }
        })
        .catch(() => {})
    }

    fetchUnread()
    const timer = setInterval(fetchUnread, 20000)

    return () => {
      isMounted = false
      clearInterval(timer)
    }
  }, [user?.role, location.pathname])

  // Close profile dropdown on outside click or Escape
  useEffect(() => {
    if (!menuOpen) return undefined
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [menuOpen])

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    if (!searchQuery.trim()) return
    const q = searchQuery.trim().toLowerCase()
    // Quick contextual routing
    if (user?.role === 'admin') {
      if (q.includes('teacher')) navigate('/admin/teachers')
      else if (q.includes('sub') || q.includes('course')) navigate('/admin/academic-management')
      else navigate(`/admin/students`)
    } else if (user?.role === 'teacher') {
      if (q.includes('class')) navigate('/teacher/classes')
      else if (q.includes('att')) navigate('/teacher/attendance')
      else navigate('/teacher/subjects')
    } else {
      if (q.includes('time')) navigate('/student/timetable')
      else navigate('/student/attendance')
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-line/80 bg-white/80 px-4 sm:px-8 backdrop-blur-xl transition-all shadow-[0_1px_12px_rgba(13,37,31,0.03)]">
      {/* Left: Mobile Menu + Search Bar */}
      <div className="flex items-center gap-3 flex-1 max-w-xl">
        <button
          onClick={onMenuClick}
          aria-label="Open menu"
          className="rounded-xl p-2.5 text-muted hover:bg-sage-50/80 hover:text-ink lg:hidden transition active:scale-95"
        >
          <FiMenu size={20} />
        </button>

        {/* Reference Search Bar */}
        <form onSubmit={handleSearchSubmit} className="relative w-full max-w-md hidden sm:block">
          <FiSearch size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted/70" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search students, classes, records..."
            className="w-full rounded-2xl border border-line bg-[#FAFCFA] py-2 pl-10 pr-16 text-xs text-ink placeholder:text-muted/60 focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-2xs transition-all"
          />
          <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5 rounded-lg border border-line/80 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-muted shadow-2xs">
            <FiCommand size={10} />
            <span>K</span>
          </div>
        </form>

        <div className="sm:hidden">
          <Breadcrumbs />
        </div>
      </div>

      {/* Right: Date, Notifications & User */}
      <div className="flex items-center gap-3 sm:gap-5">
        {/* Today's Date Widget */}
        <div className="hidden md:flex items-center gap-2 rounded-xl bg-sage-50/60 border border-line/70 px-3 py-1.5 shadow-2xs">
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <div className="flex flex-col text-right">
            <span className="text-[9px] font-extrabold uppercase tracking-widest text-muted">Today</span>
            <span className="text-xs font-bold text-ink leading-none">{formattedToday}</span>
          </div>
        </div>

        <div className="hidden md:block h-7 w-px bg-line/80" />

        {/* Notifications Squircle */}
        <button
          onClick={() => navigate(`/${user?.role || 'teacher'}/notifications`)}
          aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : 'Notifications'}
          className="relative flex h-10 w-10 items-center justify-center rounded-2xl border border-line bg-surface text-muted shadow-2xs transition-all duration-200 hover:border-slate-300 hover:bg-sage-50/60 hover:text-ink active:scale-95"
        >
          <FiBell size={18} />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-gradient-to-r from-amber-500 to-rose-500 px-1 text-[10px] font-extrabold text-white shadow-xs ring-2 ring-white animate-pulse">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {/* User Profile Dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="flex items-center gap-2.5 rounded-2xl p-1.5 hover:bg-sage-50/80 transition border border-transparent hover:border-line active:scale-[0.98]"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#1E6552] to-[#124235] text-xs font-black text-white shadow-2xs">
              {initial}
            </div>
            <div className="hidden text-left sm:block">
              <span className="block text-xs font-bold leading-tight text-ink">{user?.name}</span>
              <span className="block text-[10px] capitalize font-medium text-muted">{user?.role}</span>
            </div>
            <FiChevronDown size={14} className={`hidden text-muted sm:block transition-transform duration-200 ${menuOpen ? 'rotate-180' : ''}`} />
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 mt-2 w-56 overflow-hidden rounded-2xl border border-line bg-surface shadow-dropdown animate-in fade-in zoom-in-95 duration-100 z-50"
            >
              <div className="border-b border-line bg-canvas/70 px-4 py-3">
                <p className="truncate text-xs font-bold text-ink">{user?.name}</p>
                <p className="truncate text-[11px] text-muted">{user?.email}</p>
                <span className="mt-1.5 inline-block rounded-md bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-emerald-800">
                  {user?.role}
                </span>
              </div>
              <div className="p-1.5 space-y-0.5">
                <button
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false)
                    navigate(`/${user?.role}/profile`)
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-semibold text-ink hover:bg-sage-50 transition"
                >
                  <FiUser size={15} className="text-muted" /> My Profile
                </button>
                <button
                  role="menuitem"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-semibold text-danger hover:bg-rose-50 transition"
                >
                  <FiLogOut size={15} /> Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
