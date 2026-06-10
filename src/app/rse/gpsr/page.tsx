'use client'

import RequireSubscription from '@/components/rse/RequireSubscription'
import RseAppShell, { type RseContext } from '@/components/rse/RseAppShell'
import GpsrDiagnosticApp from '@/components/apps/GpsrDiagnosticApp'

export default function GpsrPage() {
  return (
    <RequireSubscription appSlug="gpsr" appName="Diagnostic GPSR">
      <RseAppShell appSlug="gpsr" title="Diagnostic GPSR — Règlement (UE) 2023/988 relatif à la sécurité générale des produits">
        {(ctx: RseContext) => <GpsrDiagnosticApp ctx={ctx} />}
      </RseAppShell>
    </RequireSubscription>
  )
}
