'use client'

import RseAppShell from '@/components/rse/RseAppShell'
import RequireSubscription from '@/components/rse/RequireSubscription'
import EudrFournisseursApp from '@/components/apps/EudrFournisseursApp'

export default function EudrFournisseursPage() {
  return (
    <RseAppShell appSlug="eudr-fournisseurs" title="Gestion des fournisseurs EUDR" requireYear={false}>
      {(ctx) => (
        <RequireSubscription appSlug="eudr-fournisseurs" appName="Gestion des fournisseurs EUDR">
          <EudrFournisseursApp ctx={ctx} />
        </RequireSubscription>
      )}
    </RseAppShell>
  )
}
