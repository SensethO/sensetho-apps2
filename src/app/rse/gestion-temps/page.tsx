'use client'

import RseAppShell, { type RseContext } from '@/components/rse/RseAppShell'
import RequireSubscription from '@/components/rse/RequireSubscription'
import GestionTempsApp from '@/components/apps/GestionTempsApp'

export default function GestionTempsPage() {
  return (
    <RseAppShell appSlug="gestion-temps" title="Gestion du temps">
      {(ctx: RseContext) => (
        <RequireSubscription appSlug="gestion-temps">
          <GestionTempsApp ctx={ctx} />
        </RequireSubscription>
      )}
    </RseAppShell>
  )
}
