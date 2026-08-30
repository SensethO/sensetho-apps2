'use client'

import RseAppShell, { type RseContext } from '@/components/rse/RseAppShell'
import RequireSubscription from '@/components/rse/RequireSubscription'
import PartiesPrenantesApp from '@/components/apps/PartiesPrenantesApp'

export default function PartiesPrenantesPage() {
  return (
    <RseAppShell appSlug="parties-prenantes" title="Parties Prenantes & Matérialité" requireYear={false}>
      {(ctx: RseContext) => (
        <RequireSubscription appSlug="parties-prenantes" appName="Parties Prenantes & Matérialité">
          <PartiesPrenantesApp ctx={ctx} />
        </RequireSubscription>
      )}
    </RseAppShell>
  )
}
