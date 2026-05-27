'use client'

import AppShell from '@/components/layout/AppShell'
import RequireSubscription from '@/components/rse/RequireSubscription'
import { AgriTracker } from '@/components/apps/AgriTracker'

export default function AgriTrackerPage() {
  return (
    <AppShell>
      <RequireSubscription appSlug="agri-tracker" appName="AgriTracker">
        <AgriTracker />
      </RequireSubscription>
    </AppShell>
  )
}
