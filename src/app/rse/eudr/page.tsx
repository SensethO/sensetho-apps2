'use client'

import RequireSubscription from '@/components/rse/RequireSubscription'
import RseAppShell, { type RseContext } from '@/components/rse/RseAppShell'
import EudrDiagnosticApp from '@/components/apps/EudrDiagnosticApp'

export default function EudrPage() {
  return (
    <RseAppShell appSlug="eudr" title="EUDR — Règlement (UE) 2023/1115 Sans Déforestation">
      {(ctx: RseContext) => (
        <RequireSubscription appSlug="eudr" appName="EUDR — Sans Déforestation">
          <EudrDiagnosticApp ctx={ctx} />
        </RequireSubscription>
      )}
    </RseAppShell>
  )
}
