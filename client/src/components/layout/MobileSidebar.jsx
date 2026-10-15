import { useEffect } from 'react'
import { FiX } from 'react-icons/fi'
import Sidebar from './Sidebar'

/**
 * Slide-in drawer version of the sidebar for < lg viewports. Closes on
 * backdrop click, Escape, or navigating to a link (via Sidebar's
 * onNavigate callback).
 */
export default function MobileSidebar({ open, onClose }) {
  useEffect(() => {
    if (!open) return undefined
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    // Prevent the page behind the drawer from scrolling while it's open.
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
      <button
        className="absolute inset-0 bg-ink/40"
        aria-label="Close menu"
        onClick={onClose}
      />
      <div className="relative flex h-full w-72 max-w-[85vw] flex-col bg-[#0D251F] shadow-2xl">
        <button
          onClick={onClose}
          aria-label="Close menu"
          className="absolute right-3.5 top-5 z-20 rounded-xl p-1.5 text-[#85A297] hover:bg-[#15342B] hover:text-white transition"
        >
          <FiX size={18} />
        </button>
        <Sidebar onNavigate={onClose} />
      </div>
    </div>
  )
}
