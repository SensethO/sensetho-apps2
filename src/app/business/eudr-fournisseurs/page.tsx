'use client'

import RseAppShell from '@/components/rse/RseAppShell'
import RequireSubscription from '@/components/rse/RequireSubscription'
import EudrFournisseursApp from '@/components/apps/EudrFournisseursApp'

export default function EudrFournisseursPage() {
  return (
    <RequireSubscription appSlug="eudr-fournisseurs" appName="Gestion des fournisseurs EUDR">
      <RseAppShell appSlug="eudr-fournisseurs" title="Gestion des fournisseurs EUDR" requireYear={false}>
        {(ctx) => <EudrFournisseursApp ctx={ctx} />}
      </RseAppShell>
    </RequireSubscription>
  )
}
