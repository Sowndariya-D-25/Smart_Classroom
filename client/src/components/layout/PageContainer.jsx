// Consistent max-width/padding/spacing wrapper for everything rendered
// inside DashboardLayout's <Outlet />, so individual pages don't each
// reinvent their own container.
export default function PageContainer({ children, className = '' }) {
  return (
    <div className={`mx-auto max-w-7xl space-y-7 px-4 py-6 sm:px-8 sm:py-8 animate-fade-in ${className}`}>
      {children}
    </div>
  )
}

