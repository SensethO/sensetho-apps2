'use client'
import RequireSubscription from '@/components/rse/RequireSubscription'
import RseAppShell, { type RseContext } from '@/components/rse/RseAppShell'
import RapportIntegre from '@/components/apps/RapportIntegre'

export default function RapportIntegrePage() {
  return (
    <RequireSubscription appSlug="rapport-integre" appName="Rapport Intégré">
      <RseAppShell appSlug="rapport-integre" title="Rapport Intégré">
        {(ctx: RseContext) => <RapportIntegre ctx={ctx} />}
      </RseAppShell>
    </RequireSubscription>
  )
}
