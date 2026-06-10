'use client'

import RequireSubscription from '@/components/rse/RequireSubscription'
import RseAppShell, { type RseContext } from '@/components/rse/RseAppShell'
import Iso45001DiagnosticApp from '@/components/apps/Iso45001DiagnosticApp'

export default function Iso45001Page() {
  return (
    <RequireSubscription appSlug="iso45001" appName="Diagnostic ISO 45001">
      <RseAppShell appSlug="iso45001" title="Diagnostic ISO 45001 — Santé et sécurité au travail (ISO 45001:2018)">
        {(ctx: RseContext) => <Iso45001DiagnosticApp ctx={ctx} />}
      </RseAppShell>
    </RequireSubscription>
  )
}
