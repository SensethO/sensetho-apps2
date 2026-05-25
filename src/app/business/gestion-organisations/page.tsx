'use client'

import RequireSubscription from '@/components/rse/RequireSubscription'
import GestionOrganisationsApp from '@/components/apps/GestionOrganisationsApp'

export default function GestionOrganisationsPage() {
  return (
    <RequireSubscription appSlug="gestion-organisations" appName="Gestion des organisations">
      <GestionOrganisationsApp />
    </RequireSubscription>
  )
}
