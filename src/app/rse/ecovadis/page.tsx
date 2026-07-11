'use client'

import RequireSubscription from '@/components/rse/RequireSubscription'
import RseAppShell, { type RseContext } from '@/components/rse/RseAppShell'
import EcoVadisDiagnosticApp from '@/components/apps/EcoVadisDiagnosticApp'

export default function EcoVadisPage() {
  return (
    <RequireSubscription appSlug="ecovadis" appName="EcoVadis Diagnostic RSE">
      <RseAppShell appSlug="ecovadis" title="EcoVadis — Diagnostic RSE">
        {(ctx: RseContext) => <EcoVadisDiagnosticApp ctx={ctx} />}
      </RseAppShell>
    </RequireSubscription>
  )
}
