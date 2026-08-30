'use client'

import RequireSubscription from '@/components/rse/RequireSubscription'
import RseAppShell, { type RseContext } from '@/components/rse/RseAppShell'
import BilanGesDiagnosticApp from '@/components/apps/BilanGesDiagnosticApp'

export default function BilanGesPage() {
  return (
    <RseAppShell appSlug="bilan-ges" title="Bilan d'Émissions de Gaz à Effet de Serre (BEGES) — art. L229-25 / décret n°2022-982">
      {(ctx: RseContext) => (
        <RequireSubscription appSlug="bilan-ges" appName="Bilan GES">
          <BilanGesDiagnosticApp ctx={ctx} />
        </RequireSubscription>
      )}
    </RseAppShell>
  )
}
