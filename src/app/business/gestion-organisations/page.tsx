'use client'

import RseAppShell from '@/components/rse/RseAppShell'
import RequireSubscription from '@/components/rse/RequireSubscription'
import GestionOrganisationsApp from '@/components/apps/GestionOrganisationsApp'

export default function GestionOrganisationsPage() {
  return (
    <RequireSubscription appSlug="gestion-organisations" appName="Gestion des organisations">
      <RseAppShell appSlug="gestion-organisations" title="Gestion des organisations" requireYear={false}>
        {() => <GestionOrganisationsApp />}
      </RseAppShell>
    </RequireSubscription>
  )
}
