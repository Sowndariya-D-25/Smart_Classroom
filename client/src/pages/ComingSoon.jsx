import { useLocation } from 'react-router-dom'
import { Construction } from 'lucide-react'
import PageContainer from '../components/layout/PageContainer'
import SectionHeader from '../components/common/SectionHeader'
import EmptyState from '../components/common/EmptyState'

const toTitle = (segment = '') =>
  segment
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')

/**
 * Renders for every sidebar link that doesn't have a real page yet (see
 * the "*" route nested under each role in App.jsx). This is how Phase 4
 * can make the full navigation structure real/clickable without
 * building any of the actual feature pages, which belong to later phases.
 */
export default function ComingSoon() {
  const { pathname } = useLocation()
  const segments = pathname.split('/').filter(Boolean)
  const title = toTitle(segments[segments.length - 1]) || 'This page'

  return (
    <PageContainer>
      <SectionHeader title={title} subtitle="This section isn't built yet." />
      <EmptyState
        icon={Construction}
        title={`${title} is coming in a later phase`}
        description="The navigation and routing for this page are already wired up — the actual feature will be built in an upcoming phase of this project."
      />
    </PageContainer>
  )
}
