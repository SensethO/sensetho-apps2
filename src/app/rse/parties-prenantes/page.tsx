'use client'

import RseAppShell, { type RseContext } from '@/components/rse/RseAppShell'
import RequireSubscription from '@/components/rse/RequireSubscription'
import PartiesPrenantesApp from '@/components/apps/PartiesPrenantesApp'

export default function PartiesPrenantesPage() {
  return (
    <RequireSubscription appSlug="parties-prenantes" appName="Parties Prenantes & Matérialité">
      <RseAppShell appSlug="parties-prenantes" title="Parties Prenantes & Matérialité">
        {(ctx: RseContext) => <PartiesPrenantesApp ctx={ctx} />}
      </RseAppShell>
    </RequireSubscription>
  )
}
