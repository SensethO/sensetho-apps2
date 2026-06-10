'use client'

import RequireSubscription from '@/components/rse/RequireSubscription'
import RseAppShell, { type RseContext } from '@/components/rse/RseAppShell'
import Afaq26000DiagnosticApp from '@/components/apps/Afaq26000DiagnosticApp'

export default function Afaq26000Page() {
  return (
    <RequireSubscription appSlug="afaq26000" appName="Évaluation AFAQ 26000">
      <RseAppShell appSlug="afaq26000" title="Évaluation AFAQ 26000 — Modèle d'évaluation RSE AFNOR Certification (1000 points)">
        {(ctx: RseContext) => <Afaq26000DiagnosticApp ctx={ctx} />}
      </RseAppShell>
    </RequireSubscription>
  )
}
