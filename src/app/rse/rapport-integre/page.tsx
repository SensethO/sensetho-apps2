'use client'
import RequireSubscription from '@/components/rse/RequireSubscription'
import RseAppShell, { type RseContext } from '@/components/rse/RseAppShell'
import RapportIntegre from '@/components/apps/RapportIntegre'

export default function RapportIntegrePage() {
  return (
    <RseAppShell appSlug="rapport-integre" title="Rapport Intégré">
      {(ctx: RseContext) => (
        <RequireSubscription appSlug="rapport-integre" appName="Rapport Intégré">
          <RapportIntegre ctx={ctx} />
        </RequireSubscription>
      )}
    </RseAppShell>
  )
}
