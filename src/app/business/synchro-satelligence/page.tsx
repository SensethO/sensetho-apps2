'use client'

import RseAppShell from '@/components/rse/RseAppShell'
import RequireSubscription from '@/components/rse/RequireSubscription'
import SynchroSatelligenceApp from '@/components/apps/SynchroSatelligenceApp'

export default function SynchroSatelligencePage() {
  return (
    <RseAppShell appSlug="synchro-satelligence" title="Synchro Satelligence" requireYear={false}>
      {(ctx) => (
        <RequireSubscription appSlug="synchro-satelligence" appName="Synchro Satelligence">
          <SynchroSatelligenceApp ctx={ctx} />
        </RequireSubscription>
      )}
    </RseAppShell>
  )
}
