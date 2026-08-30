'use client'

import RequireSubscription from '@/components/rse/RequireSubscription'
import RseAppShell, { type RseContext } from '@/components/rse/RseAppShell'
import EcoVadisDiagnosticApp from '@/components/apps/EcoVadisDiagnosticApp'

export default function EcoVadisPage() {
  return (
    <RseAppShell appSlug="ecovadis" title="EcoVadis — Diagnostic RSE">
      {(ctx: RseContext) => (
        <RequireSubscription appSlug="ecovadis" appName="EcoVadis Diagnostic RSE">
          <EcoVadisDiagnosticApp ctx={ctx} />
        </RequireSubscription>
      )}
    </RseAppShell>
  )
}
