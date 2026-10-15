import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import MobileSidebar from './MobileSidebar'
import Navbar from './Navbar'

/**
 * The reusable shell every authenticated page renders inside (via nested
 * routes + <Outlet/> in App.jsx). Handles the desktop sidebar / mobile
 * drawer split; individual pages only ever worry about their own content.
 */
export default function DashboardLayout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  return (
    <div className="min-h-screen bg-canvas lg:flex">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-line lg:block">
        <div className="sticky top-0 h-screen">
          <Sidebar />
        </div>
      </aside>

      {/* Mobile drawer */}
      <MobileSidebar open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

      <div className="min-w-0 flex-1">
        <Navbar onMenuClick={() => setMobileNavOpen(true)} />
        <main>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
