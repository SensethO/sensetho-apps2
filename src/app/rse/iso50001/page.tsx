'use client'

import RequireSubscription from '@/components/rse/RequireSubscription'
import RseAppShell, { type RseContext } from '@/components/rse/RseAppShell'
import Iso50001DiagnosticApp from '@/components/apps/Iso50001DiagnosticApp'

export default function Iso50001Page() {
  return (
    <RequireSubscription appSlug="iso50001" appName="Diagnostic ISO 50001">
      <RseAppShell appSlug="iso50001" title="Diagnostic ISO 50001 — Management de l'énergie (ISO 50001:2018)">
        {(ctx: RseContext) => <Iso50001DiagnosticApp ctx={ctx} />}
      </RseAppShell>
    </RequireSubscription>
  )
}
