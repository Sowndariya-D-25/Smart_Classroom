import { Link, useLocation } from 'react-router-dom'

const toTitle = (segment) =>
  segment
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')

/**
 * Derives "Dashboard" or "Dashboard / Attendance" from the current URL.
 * Segment 0 is the role ("admin"/"teacher"/"student") and is skipped;
 * segment 1 is either "dashboard" itself or the current section.
 */
export default function Breadcrumbs() {
  const { pathname } = useLocation()
  const segments = pathname.split('/').filter(Boolean) // e.g. ['admin', 'attendance']
  const role = segments[0]
  const section = segments[1]
  const isDashboardRoot = !section || section === 'dashboard'

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm">
      <Link
        to={`/${role}/dashboard`}
        className={isDashboardRoot ? 'font-medium text-ink' : 'text-muted hover:text-ink'}
      >
        Dashboard
      </Link>
      {!isDashboardRoot && (
        <>
          <span className="text-muted">/</span>
          <span className="font-medium text-ink">{toTitle(section)}</span>
        </>
      )}
    </nav>
  )
}
