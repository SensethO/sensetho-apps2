'use client'

import RequireSubscription from '@/components/rse/RequireSubscription'
import RseAppShell, { type RseContext } from '@/components/rse/RseAppShell'
import Afaq26000DiagnosticApp from '@/components/apps/Afaq26000DiagnosticApp'

export default function Afaq26000Page() {
  return (
    <RseAppShell appSlug="afaq26000" title="Évaluation AFAQ 26000 — Modèle d'évaluation RSE AFNOR Certification (1000 points)">
      {(ctx: RseContext) => (
        <RequireSubscription appSlug="afaq26000" appName="Évaluation AFAQ 26000">
          <Afaq26000DiagnosticApp ctx={ctx} />
        </RequireSubscription>
      )}
    </RseAppShell>
  )
}
