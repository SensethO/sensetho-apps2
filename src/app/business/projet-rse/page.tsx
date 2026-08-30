'use client'

import RseAppShell from '@/components/rse/RseAppShell'
import RequireSubscription from '@/components/rse/RequireSubscription'
import ProjetRseApp from '@/components/apps/ProjetRseApp'

export default function ProjetRsePage() {
  return (
    <RseAppShell appSlug="projet-rse" title="Plan Stratégique" requireYear={false}>
      {(ctx) => (
        <RequireSubscription appSlug="projet-rse" appName="Plan Stratégique">
          <ProjetRseApp ctx={ctx} />
        </RequireSubscription>
      )}
    </RseAppShell>
  )
}
