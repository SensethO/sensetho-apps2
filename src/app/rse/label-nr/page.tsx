'use client'

import RequireSubscription from '@/components/rse/RequireSubscription'
import RseAppShell, { type RseContext } from '@/components/rse/RseAppShell'
import LabelNrDiagnosticApp from '@/components/apps/LabelNrDiagnosticApp'

export default function LabelNrPage() {
  return (
    <RseAppShell appSlug="label-nr" title="Label Numérique Responsable (Label NR) — Agence LUCIE / INR">
      {(ctx: RseContext) => (
        <RequireSubscription appSlug="label-nr" appName="Label Numérique Responsable">
          <LabelNrDiagnosticApp ctx={ctx} />
        </RequireSubscription>
      )}
    </RseAppShell>
  )
}
