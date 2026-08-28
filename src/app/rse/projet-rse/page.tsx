'use client'

import RseAppShell from '@/components/rse/RseAppShell'
import RequireSubscription from '@/components/rse/RequireSubscription'
import ProjetRseApp from '@/components/apps/ProjetRseApp'

export default function ProjetRsePage() {
  return (
    <RequireSubscription appSlug="projet-rse" appName="Projet RSE">
      <RseAppShell appSlug="projet-rse" title="Projet RSE" requireYear={false}>
        {(ctx) => <ProjetRseApp ctx={ctx} />}
      </RseAppShell>
    </RequireSubscription>
  )
}
