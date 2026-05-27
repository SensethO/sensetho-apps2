'use client'

import RseAppShell from '@/components/rse/RseAppShell'
import RequireSubscription from '@/components/rse/RequireSubscription'
import { AgriTracker } from '@/components/apps/AgriTracker'

export default function AgriTrackerPage() {
  return (
    <RequireSubscription appSlug="agri-tracker" appName="AgriTracker">
      <RseAppShell appSlug="agri-tracker" title="AgriTracker" requireYear={false}>
        {() => <AgriTracker />}
      </RseAppShell>
    </RequireSubscription>
  )
}
