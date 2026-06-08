'use client'

import RseAppShell, { type RseContext } from '@/components/rse/RseAppShell'
import RequireSubscription from '@/components/rse/RequireSubscription'
import GestionTempsApp from '@/components/apps/GestionTempsApp'

export default function GestionTempsPage() {
  return (
    <RequireSubscription appSlug="gestion-temps">
      <RseAppShell appSlug="gestion-temps" title="Gestion du temps">
        {(ctx: RseContext) => <GestionTempsApp ctx={ctx} />}
      </RseAppShell>
    </RequireSubscription>
  )
}
